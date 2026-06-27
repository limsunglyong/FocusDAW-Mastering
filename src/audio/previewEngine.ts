// FocusDAW Mastering Desk v0.2.6 (Phase 1) - Preview 오디오 엔진 코어
// 하나의 transport(좌측 Play/Space) 위에서 dry/effect A/B와 섹션별 On/Bypass를 모두
// "재생을 끊지 않는 gain/AudioParam crossfade"로 처리한다. AudioBufferSource 는 one-shot 이므로
// Preview 토글·섹션 Bypass·노브 변경 때 source 를 새로 만들지 않는다(구현 원칙 #2/#7~9).
//
// 그래프 구조:
//   source ─ dryGain ───────────────────────────────────────────────┐(top preview dry)
//   source ─ inputGain ─ [pre] ─ [spectral] ─ [dynamics] ─ [stereo] ─ [loudness] ─ wetGain ┤→ dest
// 각 [section] 은 내부적으로 dry/wet 병렬 구조를 가진다:
//   in ─ sectionDry ─────────────┐
//   in ─ sectionDSP ─ sectionWet ┤→ sum ─ (다음 섹션)
//   섹션 ON  : sectionDry=0, sectionWet=1
//   섹션 BYPASS: sectionDry=1, sectionWet=0
import type { Vals, ModId } from '../desk/data';
import type { AudioMeta } from './decoder';
import {
  DYN_XOVER_LOW, DYN_XOVER_HIGH, DYN_EXCITER_HP, DYN_KEYS,
  ratioFromVal, dynThreshold, dynMakeup, dynAttack, dynRelease, exciterBlend, exciterDrive,
} from './dynamics';
import {
  stereoWidth, bassMonoFreq, reverbSend, delaySend, computeCorrelation, computeFoldLoss,
} from './stereo';
import {
  LIMITER_LOOKAHEAD_MS, loudnessGain as loudnessMakeupGain, saturationAmount,
  ceilingLinear, limiterEnabled, limiterReleaseSec,
} from './loudnessDsp';
import { LIMITER_PROCESSOR_NAME, getLimiterWorkletUrl } from './limiterWorklet';

type EnabledMap = Record<ModId, boolean>;

export type PreviewParams = {
  vals: Vals;
  enabled: EnabledMap;
  meta: AudioMeta;
};

type SectionGain = { dry: GainNode; wet: GainNode };
// v0.6.0 (Phase 5): Stereo 섹션 실시간 갱신 노드 참조
type StereoNodes = {
  sWidth: GainNode;       // M/S Side 게인(Width)
  sHP: BiquadFilterNode;  // Side 고역통과(Bass Mono — 저역 Side 제거)
  reverbGain: GainNode;   // 리버브 send
  delayGain: GainNode;    // 딜레이 send
  monoDry: GainNode;      // Mono Compat OFF 경로(스테레오)
  monoWet: GainNode;      // Mono Compat ON 경로(모노 합)
};
// v0.5.0 (Phase 4): 멀티밴드 Dynamics 노드 참조(실시간 갱신용)
type DynGraph = {
  bands: DynamicsCompressorNode[];   // [low, mid, high] per-band 컴프
  bandGains: GainNode[];             // 밴드별 make-up gain
  exciterShaper: WaveShaperNode;     // 고역 하모닉 셰이퍼
  exciterGain: GainNode;             // 익사이터 블렌드 게인
};

type ActiveGraph = {
  source: AudioBufferSourceNode;
  nodes: AudioNode[];
  // top-level Preview A/B (dry vs 전체 effect 체인)
  dryGain: GainNode;
  wetGain: GainNode;
  // 섹션별 dry/wet (On/Bypass)
  sections: Partial<Record<ModId, SectionGain>>;
  // 실시간 갱신용 DSP 노드 참조
  inputGain: GainNode;
  fade: GainNode | null;
  eqFilters: BiquadFilterNode[];
  dyn: DynGraph | null;
  stereo: StereoNodes | null;
  corrL: AnalyserNode | null;
  corrR: AnalyserNode | null;
  loudnessGain: GainNode | null;
  loudnessSat: WaveShaperNode | null;
  limiter: AudioWorkletNode | null;
  channels: number;
  startCtxTime: number;
  startOffset: number;
  onEnded: (() => void) | null;
};

const RAMP = 0.015;

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// amount<=0 이면 항등(identity) 커브를 만들어 사실상 bypass 가 되게 한다.
function saturatorCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(n);
  const a = Math.max(0, Math.min(1, amount));
  if (a <= 0.001) {
    for (let i = 0; i < n; i++) curve[i] = (i / (n - 1)) * 2 - 1;
    return curve;
  }
  const drive = 1 + a * 8;
  const norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / norm;
  }
  return curve;
}

// v0.7.1: Loudness 새츄레이터 커브 — WaveShaper 는 입력을 ±1 로 하드클램프하므로, make-up 게인이
// 0dBFS 를 넘기면 리미터 전에 하드클립된다. 입력을 1/DOMAIN 로 prescale 해 ±DOMAIN(+18dB)까지
// 헤드룸을 주고, 커브는 실제 레벨 기준 tanh 로 그린다(0dBFS 부근 새츄레이션 캐릭터는 보존).
// → 0dBFS 초과분은 하드클립 없이 리미터가 천장으로 정리한다.
const LOUDNESS_SAT_DOMAIN = 8;
function loudnessSatCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(n);
  const a = Math.max(0, Math.min(1, amount));
  const D = LOUDNESS_SAT_DOMAIN;
  if (a <= 0.001) {
    for (let i = 0; i < n; i++) curve[i] = ((i / (n - 1)) * 2 - 1) * D; // 항등(±D 까지 선형 통과)
    return curve;
  }
  const drive = 1 + a * 8;
  const norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * D; // prescale 복원 = 실제 레벨
    curve[i] = Math.tanh(x * drive) / norm;
  }
  return curve;
}

// v0.5.0 (Phase 4): Linkwitz-Riley 4차(24dB/oct) = Butterworth(Q=0.7071) 2단 cascade.
// LR4 는 인접 대역 lowpass+highpass 합이 평탄(동위상)이라 3밴드 분할/합산에 적합.
function makeLR4(ctx: AudioContext, type: 'lowpass' | 'highpass', freq: number, nodes: AudioNode[]): { input: BiquadFilterNode; output: BiquadFilterNode } {
  const a = ctx.createBiquadFilter();
  const b = ctx.createBiquadFilter();
  a.type = b.type = type;
  a.frequency.value = b.frequency.value = freq;
  a.Q.value = b.Q.value = Math.SQRT1_2;
  a.connect(b);
  nodes.push(a, b);
  return { input: a, output: b };
}

function setParam(p: AudioParam, value: number, ctx: AudioContext) {
  p.cancelScheduledValues(ctx.currentTime);
  p.setTargetAtTime(value, ctx.currentTime, RAMP);
}

// ── 파라미터 → 목표값 계산 (build/update 공용) ────────────────────────────
function inputGainValue(params: PreviewParams): number {
  const peak = Number.isFinite(params.meta.peakDb) ? Math.pow(10, params.meta.peakDb / 20) : 1;
  return params.vals['input.normimp'] ? Math.min(8, Math.pow(10, -0.1 / 20) / peak) : 1;
}

function eqFreq(vals: Vals, i: number, nyq: number): number {
  return Math.max(20, Math.min(nyq - 1, num(vals[`spectral.f${i}`], 1000)));
}
function eqQ(vals: Vals, i: number): number {
  return i === 0 || i === 4 ? 0.71 : Math.max(0.2, num(vals[`spectral.q${i}`], 1));
}

// IV Dynamics 매핑은 ./dynamics, VI Loudness 매핑은 ./loudnessDsp 로 추출(단위 시험 대상).

function loudnessGainValue(params: PreviewParams): number {
  return loudnessMakeupGain(num(params.vals['loudness.target'], -14), params.meta.integratedLufs);
}

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

  stop(resetOffset = true) {
    this.stopGraph();
    this.playing = false;
    if (resetOffset) {
      this.offset = 0;
      this.currentBuffer = null;
      this.currentOnEnded = null;
    }
  }

  // 노브/세그먼트/섹션 On-Bypass 변경: 재생을 끊지 않고 live 반영한다.
  update(params: PreviewParams) {
    this.params = params;
    if (!this.ctx || !this.graph) return;
    this.applyLiveParams(params);
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

  private buildGraph(ctx: AudioContext, source: AudioBufferSourceNode, params: PreviewParams): ActiveGraph {
    const vals = params.vals;
    const enabled = params.enabled;
    const channels = params.meta.channels;
    const nyq = Math.min(source.buffer?.sampleRate ?? ctx.sampleRate, ctx.sampleRate) / 2;
    const out: AudioNode = this.master ?? ctx.destination; // v0.2.11: master gain(볼륨) 경유
    const nodes: AudioNode[] = [source];
    const sections: Partial<Record<ModId, SectionGain>> = {};

    // top-level Preview A/B
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    dryGain.gain.value = this.previewEnabled ? 0 : 1;
    wetGain.gain.value = this.previewEnabled ? 1 : 0;
    source.connect(dryGain);
    dryGain.connect(out);
    nodes.push(dryGain, wetGain);

    // 섹션을 dry/wet 병렬로 감싸 sum 을 반환한다. buildDSP 는 input 에서 시작해 output 노드를 반환.
    const wrapSection = (id: ModId, input: AudioNode, buildDSP: (input: AudioNode) => AudioNode): AudioNode => {
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      const sum = ctx.createGain();
      const on = enabled[id];
      dry.gain.value = on ? 0 : 1;
      wet.gain.value = on ? 1 : 0;
      input.connect(dry);
      dry.connect(sum);
      const out = buildDSP(input);
      out.connect(wet);
      wet.connect(sum);
      nodes.push(dry, wet, sum);
      sections[id] = { dry, wet };
      return sum;
    };

    // I Input — bypass 없음, 항상 적용
    const inputGain = ctx.createGain();
    inputGain.gain.value = inputGainValue(params);
    source.connect(inputGain);
    nodes.push(inputGain);
    let tail: AudioNode = inputGain;

    // II Pre — fade in/out 엔벨로프
    let fade: GainNode | null = null;
    tail = wrapSection('pre', tail, (input) => {
      const g = ctx.createGain();
      g.gain.value = 1;
      input.connect(g);
      nodes.push(g);
      fade = g;
      this.scheduleFade(g, params, ctx.currentTime, this.offset);
      return g;
    });

    // III Spectral EQ — 5 band biquad
    const eqFilters: BiquadFilterNode[] = [];
    tail = wrapSection('spectral', tail, (input) => {
      let t = input;
      for (let i = 0; i < 5; i++) {
        const f = ctx.createBiquadFilter();
        f.type = i === 0 ? 'lowshelf' : i === 4 ? 'highshelf' : 'peaking';
        f.frequency.value = eqFreq(vals, i, nyq);
        f.gain.value = num(vals[`spectral.g${i}`]);
        f.Q.value = eqQ(vals, i);
        t.connect(f);
        nodes.push(f);
        eqFilters.push(f);
        t = f;
      }
      return t;
    });

    // IV Dynamics — Linkwitz-Riley 3밴드 멀티밴드 컴프 + 트랜지언트(어택/릴리즈) + 익사이터(고역 하모닉)  (v0.5.0 Phase 4)
    let dyn: DynGraph | null = null;
    tail = wrapSection('dynamics', tail, (input) => {
      // 3-way LR4 split: low=LP(f1), mid=HP(f1)·LP(f2), high=HP(f2)
      const lowBand = makeLR4(ctx, 'lowpass', DYN_XOVER_LOW, nodes);
      const midHp = makeLR4(ctx, 'highpass', DYN_XOVER_LOW, nodes);
      const midLp = makeLR4(ctx, 'lowpass', DYN_XOVER_HIGH, nodes);
      const highBand = makeLR4(ctx, 'highpass', DYN_XOVER_HIGH, nodes);
      input.connect(lowBand.input);
      input.connect(midHp.input);
      midHp.output.connect(midLp.input);
      input.connect(highBand.input);
      const bandOut = [lowBand.output, midLp.output, highBand.output];

      const ratio = ratioFromVal(vals['dynamics.ratio']);
      const bands: DynamicsCompressorNode[] = [];
      const bandGains: GainNode[] = [];
      const bandSum = ctx.createGain();
      nodes.push(bandSum);
      for (let b = 0; b < 3; b++) {
        const c = ctx.createDynamicsCompressor();
        c.threshold.value = dynThreshold(num(vals[DYN_KEYS[b]]));
        c.knee.value = 6;
        c.ratio.value = ratio;
        c.attack.value = dynAttack(vals, b);
        c.release.value = dynRelease(vals, b);
        const mk = ctx.createGain();
        mk.gain.value = dynMakeup(num(vals[DYN_KEYS[b]]));
        bandOut[b].connect(c);
        c.connect(mk);
        mk.connect(bandSum);
        nodes.push(c, mk);
        bands.push(c);
        bandGains.push(mk);
      }

      // 출력 + 익사이터(밴드 합 → 고역 추출 → 하모닉 셰이퍼 → 블렌드) 병렬 가산
      const dynOut = ctx.createGain();
      bandSum.connect(dynOut);
      const exHp = ctx.createBiquadFilter();
      exHp.type = 'highpass';
      exHp.frequency.value = DYN_EXCITER_HP;
      exHp.Q.value = Math.SQRT1_2;
      const exShaper = ctx.createWaveShaper();
      exShaper.curve = saturatorCurve(exciterDrive(vals));
      exShaper.oversample = '4x';
      const exGain = ctx.createGain();
      exGain.gain.value = exciterBlend(vals);
      bandSum.connect(exHp);
      exHp.connect(exShaper);
      exShaper.connect(exGain);
      exGain.connect(dynOut);
      nodes.push(dynOut, exHp, exShaper, exGain);

      dyn = { bands, bandGains, exciterShaper: exShaper, exciterGain: exGain };
      return dynOut;
    });

    // V Stereo — Width(M/S) + Bass Mono + Reverb/Delay send + Mono Compat (스테레오만, 모노는 항등 통과)  (v0.6.0 Phase 5)
    let stereo: StereoNodes | null = null;
    tail = wrapSection('stereo', tail, (input) => {
      if (channels < 2) {
        const g = ctx.createGain();
        input.connect(g);
        nodes.push(g);
        return g;
      }
      const built = this.buildStereoSection(ctx, input, vals, nodes);
      stereo = built.refs;
      return built.out;
    });

    // VI Loudness — LUFS make-up gain → Saturation → True Peak 룩어헤드 리미터(Worklet, 최종)
    let loudnessGain: GainNode | null = null;
    let loudnessSat: WaveShaperNode | null = null;
    let limiter: AudioWorkletNode | null = null;
    tail = wrapSection('loudness', tail, (input) => {
      const g = ctx.createGain();
      g.gain.value = loudnessGainValue(params);
      // make-up 게인이 0dBFS 를 넘겨도 새츄레이터에서 하드클립되지 않도록 ±DOMAIN prescale 후 전용 커브.
      const pre = ctx.createGain();
      pre.gain.value = 1 / LOUDNESS_SAT_DOMAIN;
      const sat = ctx.createWaveShaper();
      sat.curve = loudnessSatCurve(saturationAmount(vals));
      sat.oversample = '4x';
      input.connect(g);
      g.connect(pre);
      pre.connect(sat);
      nodes.push(g, pre, sat);
      loudnessGain = g;
      loudnessSat = sat;
      // 처리 순서: LUFS 게인 → Saturation → True Peak 리미팅(최종)
      if (this.workletReady) {
        const lim = new AudioWorkletNode(ctx, LIMITER_PROCESSOR_NAME, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [channels >= 2 ? 2 : 1],
          processorOptions: { lookaheadMs: LIMITER_LOOKAHEAD_MS },
        });
        lim.parameters.get('ceiling')!.value = ceilingLinear(vals);
        lim.parameters.get('release')!.value = limiterReleaseSec(vals);
        lim.parameters.get('enabled')!.value = limiterEnabled(vals) ? 1 : 0;
        lim.port.onmessage = (e) => { this.limiterGr = e.data?.gr ?? 1; };
        sat.connect(lim);
        nodes.push(lim);
        limiter = lim;
        return lim;
      }
      // 폴백(워클릿 미로드): 리미터 없이 통과
      return sat;
    });

    tail.connect(wetGain);
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
      source, nodes, dryGain, wetGain, sections,
      inputGain, fade, eqFilters, dyn, stereo, corrL, corrR, loudnessGain, loudnessSat, limiter,
      channels, startCtxTime: ctx.currentTime, startOffset: this.offset, onEnded: null,
    };
  }

  // v0.6.0 (Phase 5): Stereo 섹션 빌드. Width/Bass Mono 는 M/S 도메인(Side 게인+Side 고역통과),
  // Reverb/Delay 는 병렬 send, Mono Compat 는 (L+R)/2 모노 합 경로와 dry crossfade.
  private buildStereoSection(ctx: AudioContext, input: AudioNode, vals: Vals, nodes: AudioNode[]): { out: AudioNode; refs: StereoNodes } {
    const splitter = ctx.createChannelSplitter(2);
    input.connect(splitter);
    // M = 0.5L + 0.5R
    const mL = ctx.createGain(); mL.gain.value = 0.5;
    const mR = ctx.createGain(); mR.gain.value = 0.5;
    const mid = ctx.createGain();
    splitter.connect(mL, 0); splitter.connect(mR, 1); mL.connect(mid); mR.connect(mid);
    // S = 0.5L - 0.5R → Width 게인 → Bass Mono(Side 고역통과)
    const sL = ctx.createGain(); sL.gain.value = 0.5;
    const sR = ctx.createGain(); sR.gain.value = -0.5;
    const side = ctx.createGain();
    splitter.connect(sL, 0); splitter.connect(sR, 1); sL.connect(side); sR.connect(side);
    const sWidth = ctx.createGain(); sWidth.gain.value = stereoWidth(vals);
    side.connect(sWidth);
    const sHP = ctx.createBiquadFilter(); sHP.type = 'highpass'; sHP.Q.value = Math.SQRT1_2; sHP.frequency.value = bassMonoFreq(vals);
    sWidth.connect(sHP);
    const sNeg = ctx.createGain(); sNeg.gain.value = -1; sHP.connect(sNeg);
    // 재구성: L = M + S, R = M - S
    const merger = ctx.createChannelMerger(2);
    mid.connect(merger, 0, 0); mid.connect(merger, 0, 1);
    sHP.connect(merger, 0, 0); sNeg.connect(merger, 0, 1);
    nodes.push(splitter, mL, mR, mid, sL, sR, side, sWidth, sHP, sNeg, merger);

    // Reverb / Delay send (병렬 가산)
    const postBus = ctx.createGain();
    merger.connect(postBus);
    const conv = ctx.createConvolver();
    conv.buffer = this.getReverbIR(ctx);
    const reverbGain = ctx.createGain(); reverbGain.gain.value = reverbSend(vals);
    merger.connect(conv); conv.connect(reverbGain); reverbGain.connect(postBus);
    const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.22;
    const delayFb = ctx.createGain(); delayFb.gain.value = 0.32;
    const delayGain = ctx.createGain(); delayGain.gain.value = delaySend(vals);
    merger.connect(delay); delay.connect(delayFb); delayFb.connect(delay); delay.connect(delayGain); delayGain.connect(postBus);
    nodes.push(postBus, conv, reverbGain, delay, delayFb, delayGain);

    // Mono Master — ON 시 (L+R)/2 모노 합으로 crossfade. 실제 마스터 처리(Export 반영, 기본 OFF).
    const monoOn = !!vals['stereo.mono'];
    const out = ctx.createGain();
    const monoDry = ctx.createGain(); monoDry.gain.value = monoOn ? 0 : 1;
    postBus.connect(monoDry); monoDry.connect(out);
    const mSplit = ctx.createChannelSplitter(2);
    const mSum = ctx.createGain(); mSum.gain.value = 0.5;
    const mMerge = ctx.createChannelMerger(2);
    const monoWet = ctx.createGain(); monoWet.gain.value = monoOn ? 1 : 0;
    postBus.connect(mSplit); mSplit.connect(mSum, 0); mSplit.connect(mSum, 1);
    mSum.connect(mMerge, 0, 0); mSum.connect(mMerge, 0, 1);
    mMerge.connect(monoWet); monoWet.connect(out);
    nodes.push(out, monoDry, mSplit, mSum, mMerge, monoWet);

    return { out, refs: { sWidth, sHP, reverbGain, delayGain, monoDry, monoWet } };
  }

  // 합성 리버브 IR(감쇠 노이즈) — 샘플레이트별 1회 생성 후 캐시.
  private getReverbIR(ctx: AudioContext): AudioBuffer {
    if (this.reverbIR && this.reverbIRRate === ctx.sampleRate) return this.reverbIR;
    const dur = 1.2, len = Math.floor(ctx.sampleRate * dur);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    let seed = 24681;
    const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = rng() * Math.pow(1 - i / len, 2.6);
    }
    this.reverbIR = ir; this.reverbIRRate = ctx.sampleRate;
    return ir;
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

  // 룩어헤드 TP 리미터 워클릿 파라미터 실시간 갱신(ceiling/release/enabled).
  private applyLimiter(lim: AudioWorkletNode, vals: Vals) {
    const ctx = this.ctx;
    if (!ctx) return;
    setParam(lim.parameters.get('ceiling')!, ceilingLinear(vals), ctx);
    setParam(lim.parameters.get('release')!, limiterReleaseSec(vals), ctx);
    setParam(lim.parameters.get('enabled')!, limiterEnabled(vals) ? 1 : 0, ctx);
  }

  private scheduleFade(fade: GainNode, params: PreviewParams, startCtxTime: number, startOffset: number) {
    const fadeIn = Math.max(0, num(params.vals['pre.fadein']) / 1000);
    const fadeOut = Math.max(0, num(params.vals['pre.fadeout']) / 1000);
    const duration = params.meta.duration;
    // 재생 위치(startOffset) 기준으로 절대 시간 엔벨로프를 다시 건다.
    fade.gain.cancelScheduledValues(startCtxTime);
    fade.gain.setValueAtTime(1, startCtxTime);
    if (fadeIn > 0 && startOffset < fadeIn) {
      const remain = fadeIn - startOffset;
      fade.gain.setValueAtTime(startOffset / fadeIn, startCtxTime);
      fade.gain.linearRampToValueAtTime(1, startCtxTime + remain);
    }
    if (fadeOut > 0 && duration > fadeOut) {
      const outStart = duration - fadeOut;
      if (startOffset < duration) {
        const at = startCtxTime + Math.max(0, outStart - startOffset);
        fade.gain.setValueAtTime(1, at);
        fade.gain.linearRampToValueAtTime(0, at + fadeOut);
      }
    }
  }

  private applyLiveParams(params: PreviewParams) {
    const ctx = this.ctx;
    const graph = this.graph;
    if (!ctx || !graph) return;
    const vals = params.vals;
    const enabled = params.enabled;
    const nyq = ctx.sampleRate / 2;

    // 섹션 On/Bypass crossfade
    for (const id of ['pre', 'spectral', 'dynamics', 'stereo', 'loudness'] as ModId[]) {
      const sg = graph.sections[id];
      if (!sg) continue;
      const on = enabled[id];
      setParam(sg.dry.gain, on ? 0 : 1, ctx);
      setParam(sg.wet.gain, on ? 1 : 0, ctx);
    }

    // I Input
    setParam(graph.inputGain.gain, inputGainValue(params), ctx);

    // II Pre fade — 현재 재생 위치 기준으로 엔벨로프 재설정
    if (graph.fade) {
      this.scheduleFade(graph.fade, params, ctx.currentTime, this.getCurrentTime());
    }

    // III Spectral EQ
    graph.eqFilters.forEach((f, i) => {
      setParam(f.frequency, eqFreq(vals, i, nyq), ctx);
      setParam(f.gain, num(vals[`spectral.g${i}`]), ctx);
      setParam(f.Q, eqQ(vals, i), ctx);
    });

    // IV Dynamics — 멀티밴드 컴프 threshold/ratio/attack/release + make-up + 익사이터
    if (graph.dyn) {
      const ratio = ratioFromVal(vals['dynamics.ratio']);
      const dynRef = graph.dyn;
      dynRef.bands.forEach((c, b) => {
        setParam(c.threshold, dynThreshold(num(vals[DYN_KEYS[b]])), ctx);
        setParam(c.ratio, ratio, ctx);
        setParam(c.attack, dynAttack(vals, b), ctx);
        setParam(c.release, dynRelease(vals, b), ctx);
        setParam(dynRef.bandGains[b].gain, dynMakeup(num(vals[DYN_KEYS[b]])), ctx);
      });
      dynRef.exciterShaper.curve = saturatorCurve(exciterDrive(vals));
      setParam(dynRef.exciterGain.gain, exciterBlend(vals), ctx);
    }

    // V Stereo — Width/Bass Mono/Reverb/Delay/Mono Compat 실시간 갱신
    if (graph.stereo) {
      setParam(graph.stereo.sWidth.gain, stereoWidth(vals), ctx);
      setParam(graph.stereo.sHP.frequency, bassMonoFreq(vals), ctx);
      setParam(graph.stereo.reverbGain.gain, reverbSend(vals), ctx);
      setParam(graph.stereo.delayGain.gain, delaySend(vals), ctx);
      const monoOn = !!vals['stereo.mono'];
      setParam(graph.stereo.monoDry.gain, monoOn ? 0 : 1, ctx);
      setParam(graph.stereo.monoWet.gain, monoOn ? 1 : 0, ctx);
    }

    // VI Loudness
    if (graph.loudnessGain) setParam(graph.loudnessGain.gain, loudnessGainValue(params), ctx);
    if (graph.loudnessSat) graph.loudnessSat.curve = loudnessSatCurve(saturationAmount(vals));
    if (graph.limiter) this.applyLimiter(graph.limiter, vals);
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
