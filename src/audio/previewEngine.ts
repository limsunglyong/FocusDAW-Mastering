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

type EnabledMap = Record<ModId, boolean>;

export type PreviewParams = {
  vals: Vals;
  enabled: EnabledMap;
  meta: AudioMeta;
};

type SectionGain = { dry: GainNode; wet: GainNode };
type StereoMatrix = { lToL: GainNode; rToL: GainNode; lToR: GainNode; rToR: GainNode };
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
  stereo: StereoMatrix | null;
  loudnessGain: GainNode | null;
  loudnessSat: WaveShaperNode | null;
  limiter: DynamicsCompressorNode | null;
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

function makeSaturator(ctx: AudioContext, amount: number): WaveShaperNode {
  const shaper = ctx.createWaveShaper();
  shaper.curve = saturatorCurve(amount);
  shaper.oversample = '4x';
  return shaper;
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

// IV Dynamics 의 노브→DSP 파라미터 매핑은 ./dynamics 로 추출(단위 시험 대상). LR4 노드 빌드만 여기 둔다.

const loudnessSatAmount = (vals: Vals) => (num(vals['loudness.sat']) / 100) * 0.5;

function loudnessGainValue(params: PreviewParams): number {
  const target = num(params.vals['loudness.target'], -14);
  const lufs = params.meta.integratedLufs;
  if (!Number.isFinite(lufs)) return 1;
  return Math.max(0.05, Math.min(6, Math.pow(10, (target - lufs) / 20)));
}

function limiterRelease(vals: Vals): number {
  return vals['loudness.limiter'] === 'Loud' ? 0.08 : vals['loudness.limiter'] === 'Clear' ? 0.18 : 0.12;
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
      // 영속 master gain: 그래프 재빌드와 무관하게 유지(볼륨 연속성). dry/wet → master → destination.
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
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

    // V Stereo — width matrix(스테레오만), 모노는 항등 통과
    let stereo: StereoMatrix | null = null;
    tail = wrapSection('stereo', tail, (input) => {
      if (channels < 2) {
        const g = ctx.createGain();
        input.connect(g);
        nodes.push(g);
        return g;
      }
      const built = this.buildStereoWidth(ctx, input, num(vals['stereo.width'], 100) / 100, nodes);
      stereo = built.matrix;
      return built.out;
    });

    // VI Loudness — make-up gain + saturate + true peak limiter(항상 존재)
    let loudnessGain: GainNode | null = null;
    let loudnessSat: WaveShaperNode | null = null;
    let limiter: DynamicsCompressorNode | null = null;
    tail = wrapSection('loudness', tail, (input) => {
      const g = ctx.createGain();
      g.gain.value = loudnessGainValue(params);
      const sat = makeSaturator(ctx, loudnessSatAmount(vals));
      const lim = ctx.createDynamicsCompressor();
      this.applyLimiter(lim, vals);
      input.connect(g);
      g.connect(sat);
      sat.connect(lim);
      nodes.push(g, sat, lim);
      loudnessGain = g;
      loudnessSat = sat;
      limiter = lim;
      return lim;
    });

    tail.connect(wetGain);
    wetGain.connect(out);

    return {
      source, nodes, dryGain, wetGain, sections,
      inputGain, fade, eqFilters, dyn, stereo, loudnessGain, loudnessSat, limiter,
      channels, startCtxTime: ctx.currentTime, startOffset: this.offset, onEnded: null,
    };
  }

  private buildStereoWidth(ctx: AudioContext, inputFrom: AudioNode, width: number, ownedNodes: AudioNode[]): { out: AudioNode; matrix: StereoMatrix } {
    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    const lToL = ctx.createGain();
    const rToL = ctx.createGain();
    const lToR = ctx.createGain();
    const rToR = ctx.createGain();
    const mid = 0.5;
    lToL.gain.value = mid * (1 + width);
    rToL.gain.value = mid * (1 - width);
    lToR.gain.value = mid * (1 - width);
    rToR.gain.value = mid * (1 + width);

    inputFrom.connect(splitter);
    splitter.connect(lToL, 0);
    splitter.connect(lToR, 0);
    splitter.connect(rToL, 1);
    splitter.connect(rToR, 1);
    lToL.connect(merger, 0, 0);
    rToL.connect(merger, 0, 0);
    lToR.connect(merger, 0, 1);
    rToR.connect(merger, 0, 1);

    ownedNodes.push(splitter, lToL, rToL, lToR, rToR, merger);
    return { out: merger, matrix: { lToL, rToL, lToR, rToR } };
  }

  private applyLimiter(lim: DynamicsCompressorNode, vals: Vals) {
    if (vals['loudness.tplimit']) {
      lim.threshold.value = num(vals['loudness.ceiling'], -1);
      lim.knee.value = 0;
      lim.ratio.value = 20;
      lim.attack.value = 0.001;
      lim.release.value = limiterRelease(vals);
    } else {
      // 항등 통과: ratio 1
      lim.threshold.value = 0;
      lim.knee.value = 0;
      lim.ratio.value = 1;
      lim.attack.value = 0.003;
      lim.release.value = 0.1;
    }
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

    // V Stereo
    if (graph.stereo) {
      const w = num(vals['stereo.width'], 100) / 100;
      setParam(graph.stereo.lToL.gain, 0.5 * (1 + w), ctx);
      setParam(graph.stereo.rToL.gain, 0.5 * (1 - w), ctx);
      setParam(graph.stereo.lToR.gain, 0.5 * (1 - w), ctx);
      setParam(graph.stereo.rToR.gain, 0.5 * (1 + w), ctx);
    }

    // VI Loudness
    if (graph.loudnessGain) setParam(graph.loudnessGain.gain, loudnessGainValue(params), ctx);
    if (graph.loudnessSat) graph.loudnessSat.curve = saturatorCurve(loudnessSatAmount(vals));
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
