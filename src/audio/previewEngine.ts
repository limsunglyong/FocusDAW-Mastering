// FocusDAW Mastering Desk v0.2.6 (Phase 1) - Preview 오디오 엔진 코어
// 하나의 transport(좌측 Play/Space) 위에서 dry/effect A/B와 섹션별 On/Bypass를 모두
// "재생을 끊지 않는 gain/AudioParam crossfade"로 처리한다. AudioBufferSource 는 one-shot 이므로
// Preview 토글·섹션 Bypass·노브 변경 때 source 를 새로 만들지 않는다(구현 원칙 #2/#7~9).
//
// v0.8.0 (Phase 7): 섹션 DSP 구성을 ./masterChain(buildMasterChain) 로 추출해 Export(오프라인)와
//   공유한다. 이 엔진은 그 위에 dry/wet A/B·master 볼륨·상관도 탭만 덧씌운다.
//
// 그래프 구조:
//   source ─ dryGain ──────────────────────────────┐(top preview dry)
//   source ─ [buildMasterChain: Input~Loudness] ─ wetGain ┤→ master ─ dest
import { computeCorrelation, computeFoldLoss } from './stereo';
import { getLimiterWorkletUrl } from './limiterWorklet';
import {
  buildMasterChain, applyMasterChainParams, makeReverbIR,
  type PreviewParams, type MasterChainRefs,
} from './masterChain';

export type { PreviewParams } from './masterChain';

const RAMP = 0.015;

type ActiveGraph = {
  source: AudioBufferSourceNode;
  nodes: AudioNode[];
  // top-level Preview A/B (dry vs 전체 effect 체인)
  dryGain: GainNode;
  wetGain: GainNode;
  // 마스터 체인 실시간 갱신용 참조(섹션 On/Bypass·노브·EQ·Dynamics·Stereo·Loudness)
  refs: MasterChainRefs;
  corrL: AnalyserNode | null;
  corrR: AnalyserNode | null;
  channels: number;
  startCtxTime: number;
  startOffset: number;
  onEnded: (() => void) | null;
};

export class PreviewEngine {
  private ctx: AudioContext | null = null;
  private graph: ActiveGraph | null = null;
  private params: PreviewParams | null = null;
  private startedAt = 0;
  private offset = 0;
  private playing = false;
  private desiredSampleRate: number | null = null;
  private previewEnabled = false;
  // v0.2.11: Transport 패널용 — 영속 master gain(모니터 볼륨) + seek 재시작용 버퍼/콜백 참조
  private master: GainNode | null = null;
  private volume = 1;
  // v0.6.0 (Phase 5): 리버브 IR 캐시(샘플레이트별 1회 생성)
  private reverbIR: AudioBuffer | null = null;
  private reverbIRRate = 0;
  // v0.6.1: 마지막 스테레오 실측(상관도/폴드로스). 정지 후에도 유지(freeze)해 메터에 실값 표시.
  private lastStereoMetering: { correlation: number; foldLoss: number } | null = null;
  // v0.7.0 (Phase 6): 룩어헤드 리미터 워클릿 모듈 로드 여부 + 최근 게인리덕션(메터링)
  private workletReady = false;
  private limiterGr = 1;
  private currentBuffer: AudioBuffer | null = null;
  private currentOnEnded: (() => void) | null = null;
  // v0.2.21: 웨이브폼 A/B 구간 반복. source 재생성(Play/Seek/Pause 재개) 뒤에도 유지한다.
  private loopEnabled = false;
  private loopStart = 0;
  private loopEnd = 0;

  isPlaying() {
    return this.playing;
  }

  getDuration() {
    return this.currentBuffer?.duration ?? 0;
  }

  getCurrentTime() {
    if (!this.ctx || !this.playing) return this.offset;
    const raw = Math.max(0, this.offset + (this.ctx.currentTime - this.startedAt));
    if (this.loopEnabled && this.loopEnd > this.loopStart && raw >= this.loopEnd) {
      return this.loopStart + ((raw - this.loopStart) % (this.loopEnd - this.loopStart));
    }
    return raw;
  }

  async play(buffer: AudioBuffer, params: PreviewParams, onEnded: () => void, offset = 0, previewEnabled = this.previewEnabled) {
    await this.ensureContext(buffer.sampleRate);
    this.stop(false);
    if (this.currentBuffer !== buffer) this.lastStereoMetering = null; // 새 파일 → 측정 초기화
    this.params = params;
    this.currentBuffer = buffer;
    this.currentOnEnded = onEnded;
    this.offset = Math.max(0, offset);
    this.previewEnabled = previewEnabled;
    this.start(buffer, onEnded);
  }

  // v0.2.11: 모니터 볼륨(0~1). master gain 을 짧게 ramp. Export 와는 무관(청취 전용).
  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, RAMP);
    }
  }

  setLoop(enabled: boolean, start: number, end: number) {
    const duration = this.currentBuffer?.duration ?? Infinity;
    const nextStart = Math.max(0, Math.min(start, duration));
    const nextEnd = Math.max(nextStart, Math.min(end, duration));
    const valid = enabled && nextEnd - nextStart >= 0.25;
    const current = this.getCurrentTime();

    this.loopEnabled = valid;
    this.loopStart = nextStart;
    this.loopEnd = nextEnd;

    if (!valid) {
      this.offset = current;
      if (this.playing && this.currentBuffer && this.currentOnEnded) {
        this.stopGraph();
        this.playing = false;
        this.start(this.currentBuffer, this.currentOnEnded);
      }
      return;
    }

    if (current < nextStart || current >= nextEnd) {
      this.seek(nextStart);
      return;
    }
    // 이미 한 번 이상 wrap된 source의 경과시간과 새 구간 계산이 어긋나지 않도록
    // 현재 실제 위치를 기준으로 source를 재시작한다.
    this.offset = current;
    if (this.playing && this.currentBuffer && this.currentOnEnded) {
      this.stopGraph();
      this.playing = false;
      this.start(this.currentBuffer, this.currentOnEnded);
    }
  }

  // v0.2.11: 탐색. 재생 중이면 해당 위치에서 재시작, 일시정지면 다음 재생 시작 오프셋만 갱신.
  seek(time: number) {
    const max = this.currentBuffer ? Math.max(0, this.currentBuffer.duration - 0.001) : Infinity;
    let target = time;
    if (this.loopEnabled && this.loopEnd > this.loopStart) {
      const length = this.loopEnd - this.loopStart;
      target = this.loopStart + ((((time - this.loopStart) % length) + length) % length);
    }
    this.offset = Math.max(0, Math.min(target, max));
    if (this.playing && this.currentBuffer && this.currentOnEnded) {
      this.stopGraph();
      this.playing = false;
      this.start(this.currentBuffer, this.currentOnEnded);
    }
  }

  pause() {
    if (!this.playing) return;
    this.offset = this.getCurrentTime();
    this.stopGraph();
    this.playing = false;
  }

  resume(buffer: AudioBuffer, onEnded: () => void) {
    if (!this.params || this.playing) return;
    if (this.offset >= buffer.duration) this.offset = 0;
    this.start(buffer, onEnded);
  }

  stop(resetOffset = true, keepLoopOffset = false) {
    this.stopGraph();
    this.playing = false;
    if (resetOffset) {
      this.offset = (keepLoopOffset && this.loopEnabled && this.loopEnd > this.loopStart) ? this.loopStart : 0;
      this.currentBuffer = null;
      this.currentOnEnded = null;
    }
  }

  // 노브/세그먼트/섹션 On-Bypass 변경: 재생을 끊지 않고 live 반영한다.
  update(params: PreviewParams) {
    this.params = params;
    if (!this.ctx || !this.graph) return;
    applyMasterChainParams(this.ctx, this.graph.refs, params, this.getCurrentTime());
  }

  setPreviewEnabled(enabled: boolean) {
    this.previewEnabled = enabled;
    if (!this.ctx || !this.graph) return;
    this.crossfadePreview(enabled);
  }

  private async ensureContext(sampleRate: number) {
    if (!this.ctx || this.desiredSampleRate !== sampleRate) {
      this.stop();
      this.ctx = new AudioContext({ sampleRate });
      this.desiredSampleRate = sampleRate;
      this.workletReady = false;
      this.reverbIR = null;
      // 영속 master gain: 그래프 재빌드와 무관하게 유지(볼륨 연속성). dry/wet → master → destination.
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    // v0.7.0: 룩어헤드 리미터 워클릿 모듈 로드(컨텍스트당 1회). 실패 시 리미터는 통과로 폴백.
    if (!this.workletReady) {
      try {
        await this.ctx.audioWorklet.addModule(getLimiterWorkletUrl());
        this.workletReady = true;
      } catch {
        this.workletReady = false;
      }
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  private getReverbIR(ctx: AudioContext): AudioBuffer {
    if (this.reverbIR && this.reverbIRRate === ctx.sampleRate) return this.reverbIR;
    this.reverbIR = makeReverbIR(ctx);
    this.reverbIRRate = ctx.sampleRate;
    return this.reverbIR;
  }

  private start(buffer: AudioBuffer, onEnded: () => void) {
    const ctx = this.ctx;
    const params = this.params;
    if (!ctx || !params) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = this.loopEnabled;
    if (this.loopEnabled) {
      source.loopStart = this.loopStart;
      source.loopEnd = this.loopEnd;
    }
    const graph = this.buildGraph(ctx, source, params);
    source.onended = () => {
      if (this.graph !== graph) return;
      // stopGraph() 가 graph.onEnded 를 null 로 만들기 전에 콜백을 캡처한다.
      const notifyEnded = graph.onEnded;
      this.stopGraph();
      this.playing = false;
      this.offset = 0;
      this.currentBuffer = null;
      this.currentOnEnded = null;
      notifyEnded?.();
    };
    graph.onEnded = onEnded;
    this.graph = graph;
    this.startedAt = ctx.currentTime;
    this.playing = true;
    source.start(0, Math.min(this.offset, Math.max(0, buffer.duration - 0.001)));
  }

  private stopGraph() {
    const graph = this.graph;
    if (!graph) return;
    graph.onEnded = null;
    graph.source.onended = null;
    try { graph.source.stop(); } catch { /* already stopped */ }
    for (const node of graph.nodes) {
      try { node.disconnect(); } catch { /* already disconnected */ }
    }
    this.graph = null;
  }

  // Preview 그래프: 공유 마스터 체인(buildMasterChain) 위에 dry/wet A/B·master·상관도 탭을 덧씌운다.
  private buildGraph(ctx: AudioContext, source: AudioBufferSourceNode, params: PreviewParams): ActiveGraph {
    const channels = params.meta.channels;
    const out: AudioNode = this.master ?? ctx.destination; // v0.2.11: master gain(볼륨) 경유
    const nodes: AudioNode[] = [source];

    // top-level Preview A/B
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    dryGain.gain.value = this.previewEnabled ? 0 : 1;
    wetGain.gain.value = this.previewEnabled ? 1 : 0;
    source.connect(dryGain);
    dryGain.connect(out);
    nodes.push(dryGain, wetGain);

    // 공유 마스터 체인(Input → Pre → Spectral → Dynamics → Stereo → Loudness)
    const { output, refs } = buildMasterChain(ctx, source, params, {
      nodes,
      offset: this.offset,
      workletReady: this.workletReady,
      reverbIR: this.getReverbIR(ctx),
      channels,
      onLimiterGr: (gr) => { this.limiterGr = gr; },
    });
    output.connect(wetGain);
    wetGain.connect(out);

    // V Stereo 상관도 측정 탭 — 최종 mix(dry+wet)의 L/R 채널 분리 분석(스테레오만)
    let corrL: AnalyserNode | null = null;
    let corrR: AnalyserNode | null = null;
    if (channels >= 2) {
      const split = ctx.createChannelSplitter(2);
      corrL = ctx.createAnalyser(); corrL.fftSize = 2048;
      corrR = ctx.createAnalyser(); corrR.fftSize = 2048;
      dryGain.connect(split);
      wetGain.connect(split);
      split.connect(corrL, 0);
      split.connect(corrR, 1);
      nodes.push(split, corrL, corrR);
    }

    return {
      source, nodes, dryGain, wetGain, refs, corrL, corrR,
      channels, startCtxTime: ctx.currentTime, startOffset: this.offset, onEnded: null,
    };
  }

  // v0.6.0 (Phase 5): 최종 mix L/R 상관도·모노 폴드로스 측정(재생 중 스테레오만).
  // v0.6.1: 재생 중 유효 측정마다 lastStereoMetering 갱신하고, 정지/일시정지 시에는 마지막 실측을
  // 그대로 반환(freeze)한다. 한 번도 측정 전이면 null(→ UI 는 width 추정으로 폴백).
  getStereoMetering(): { correlation: number; foldLoss: number } | null {
    const g = this.graph;
    if (g && this.playing && g.corrL && g.corrR) {
      const n = g.corrL.fftSize;
      const l = new Float32Array(n), r = new Float32Array(n);
      g.corrL.getFloatTimeDomainData(l);
      g.corrR.getFloatTimeDomainData(r);
      const corr = computeCorrelation(l, r);
      if (corr !== null) this.lastStereoMetering = { correlation: corr, foldLoss: computeFoldLoss(l, r) };
    }
    return this.lastStereoMetering;
  }

  // v0.7.0 (Phase 6): 리미터 게인리덕션(1=무압축, <1=리덕션). 메터링용.
  getLimiterGr(): number {
    return this.limiterGr;
  }

  private crossfadePreview(enabled: boolean) {
    const ctx = this.ctx;
    const graph = this.graph;
    if (!ctx || !graph) return;
    const now = ctx.currentTime;
    graph.dryGain.gain.cancelScheduledValues(now);
    graph.wetGain.gain.cancelScheduledValues(now);
    graph.dryGain.gain.setTargetAtTime(enabled ? 0 : 1, now, RAMP);
    graph.wetGain.gain.setTargetAtTime(enabled ? 1 : 0, now, RAMP);
  }
}

export const previewEngine = new PreviewEngine();
