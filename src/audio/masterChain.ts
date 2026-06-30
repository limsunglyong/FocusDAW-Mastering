// FocusDAW Mastering Desk v0.8.0 (Phase 7) - 컨텍스트 무관 마스터 체인 빌더
// Preview(실시간 AudioContext)와 Export(OfflineAudioContext) 가 "동일한 섹션 DSP" 를 쓰도록,
// 기존 previewEngine.buildGraph 의 섹션 구성(Input → Pre fade → Spectral EQ → Dynamics → Stereo →
// Loudness/Limiter)을 이 모듈로 추출했다. Preview 는 이 위에 dry/wet A/B·master 볼륨·상관도 탭을
// 덧씌우고, Export 는 출력 노드를 그대로 destination 에 연결한다(A2 Phase 7 단계 7-A).
//
// 신호:  source ─ inputGain ─ [pre] ─ [spectral] ─ [dynamics] ─ [stereo] ─ [loudness] ─ output
//   각 [section] 은 내부 dry/wet 병렬(On=wet / Bypass=dry)로 감싸 sum 을 반환한다.
import { GRAPHIC_EQ_FREQS, type Vals, type ModId } from '../desk/data';
import type { AudioMeta } from './decoder';
import {
  DYN_XOVER_LOW, DYN_XOVER_HIGH, DYN_EXCITER_HP, DYN_KEYS,
  ratioFromVal, dynThreshold, dynMakeup, dynAttack, dynRelease, exciterBlend, exciterDrive,
} from './dynamics';
import {
  stereoWidth, bassMonoFreq, reverbSend, delaySend,
} from './stereo';
import {
  LIMITER_LOOKAHEAD_MS, loudnessGain as loudnessMakeupGain, saturationAmount,
  ceilingLinear, limiterEnabled, limiterReleaseSec,
} from './loudnessDsp';
import { LIMITER_PROCESSOR_NAME } from './limiterWorklet';

export type EnabledMap = Record<ModId, boolean>;

export type PreviewParams = {
  vals: Vals;
  enabled: EnabledMap;
  meta: AudioMeta;
};

export type SectionGain = { dry: GainNode; wet: GainNode };

// v0.6.0 (Phase 5): Stereo 섹션 실시간 갱신 노드 참조
export type StereoNodes = {
  sWidth: GainNode;       // M/S Side 게인(Width)
  sHP: BiquadFilterNode;  // Side 고역통과(Bass Mono — 저역 Side 제거)
  reverbGain: GainNode;   // 리버브 send
  delayGain: GainNode;    // 딜레이 send
  monoDry: GainNode;      // Mono Master OFF 경로(스테레오)
  monoWet: GainNode;      // Mono Master ON 경로(모노 합)
};

// v0.5.0 (Phase 4): 멀티밴드 Dynamics 노드 참조(실시간 갱신용)
export type DynGraph = {
  bands: DynamicsCompressorNode[];   // [low, mid, high] per-band 컴프
  bandGains: GainNode[];             // 밴드별 make-up gain
  exciterShaper: WaveShaperNode;     // 고역 하모닉 셰이퍼
  exciterGain: GainNode;             // 익사이터 블렌드 게인
  mbDry: GainNode;                   // v0.8.3: Multiband OFF 경로(input 직통)
  mbWet: GainNode;                   // v0.8.3: Multiband ON 경로(3밴드 컴프)
};

// buildMasterChain 이 돌려주는 실시간 갱신용 참조 묶음(Preview live update / 시각화에서 사용).
export type MasterChainRefs = {
  inputGain: GainNode;
  fade: GainNode | null;
  eqFilters: BiquadFilterNode[];
  dyn: DynGraph | null;
  stereo: StereoNodes | null;
  loudnessGain: GainNode | null;
  loudnessSat: WaveShaperNode | null;
  limiter: AudioWorkletNode | null;
  sections: Partial<Record<ModId, SectionGain>>;
};

export type BuildMasterChainOptions = {
  /** 빌드된 모든 노드를 모아두는 배열(호출자가 disconnect 용으로 보관). */
  nodes: AudioNode[];
  /** Pre fade 엔벨로프 기준 재생 오프셋(초). Export 는 0. */
  offset: number;
  /** 리미터 워클릿 모듈이 ctx 에 로드되어 있는지(미로드 시 리미터 통과). */
  workletReady: boolean;
  /** ctx.sampleRate 기준으로 생성된 합성 리버브 IR. */
  reverbIR: AudioBuffer;
  /** 리미터 출력 채널 수(보통 source 채널, ≥2 면 2). */
  channels: number;
  /** 리미터 게인리덕션 메터 콜백(Preview 메터링용, Export 는 생략). */
  onLimiterGr?: (gr: number) => void;
};

export const RAMP = 0.015;

export const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function setParam(p: AudioParam, value: number, ctx: BaseAudioContext) {
  p.cancelScheduledValues(ctx.currentTime);
  p.setTargetAtTime(value, ctx.currentTime, RAMP);
}

// amount<=0 이면 항등(identity) 커브를 만들어 사실상 bypass 가 되게 한다.
export function saturatorCurve(amount: number): Float32Array<ArrayBuffer> {
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

// v0.7.1: Loudness 새츄레이터 커브 — WaveShaper 는 입력을 ±1 로 하드클램프하므로 입력을 1/DOMAIN 로
// prescale 해 ±DOMAIN 까지 헤드룸을 준다. 커브는 실제 레벨(x = input×DOMAIN) 기준으로 그린다.
// v0.8.2 (버그 #3): 새츄레이터 재설계 + 헤드룸 확장.
//  ① 기존 `drive = 1 + a*8` 는 base "1" 때문에 Saturate 가 0.2% 만 넘어도 곧장 drive≈1.0 tanh 가
//     걸려, 기본 5% 인데도 0dBFS 부근 피크에 ~9% THD 를 더하고 피크를 으깨 "지직" 왜곡을 냈다.
//     → 선형 ↔ tanh 를 blend(=Saturate%) 로 섞는 방식으로 교체: 저% 는 거의 선형(피크는 그대로
//     통과시키고 천장은 리미터가 담당), % 를 올릴수록 하모닉 캐릭터만 더한다. 5% THD 8.9%→1.8%,
//     0% 는 완전 투명, 0dBFS 에서 unity 유지.
//  ② DOMAIN 8(+18dB)→32(+30dB), n 2048→8192. make-up 누적이 도메인 끝에서 하드클립되지 않게.
export const LOUDNESS_SAT_DOMAIN = 32;
export const LOUDNESS_SAT_DRIVE = 4; // blend 되는 tanh 의 캐릭터 강도(고정)
export function loudnessSatCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 8192;
  const curve = new Float32Array(n);
  const a = Math.max(0, Math.min(1, amount)); // saturationAmount = (Saturate%/100)×0.5 → [0,0.5]
  const D = LOUDNESS_SAT_DOMAIN;
  const blend = Math.min(1, a * 2);           // Saturate 0~100% → blend 0~1
  const norm = Math.tanh(LOUDNESS_SAT_DRIVE);
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * D;    // prescale 복원 = 실제 레벨
    const sat = Math.tanh(x * LOUDNESS_SAT_DRIVE) / norm;
    curve[i] = (1 - blend) * x + blend * sat; // 선형↔tanh blend
  }
  return curve;
}

// v0.5.0 (Phase 4): Linkwitz-Riley 4차(24dB/oct) = Butterworth(Q=0.7071) 2단 cascade.
function makeLR4(ctx: BaseAudioContext, type: 'lowpass' | 'highpass', freq: number, nodes: AudioNode[]): { input: BiquadFilterNode; output: BiquadFilterNode } {
  const a = ctx.createBiquadFilter();
  const b = ctx.createBiquadFilter();
  a.type = b.type = type;
  a.frequency.value = b.frequency.value = freq;
  a.Q.value = b.Q.value = Math.SQRT1_2;
  a.connect(b);
  nodes.push(a, b);
  return { input: a, output: b };
}

// 합성 리버브 IR(감쇠 노이즈) — ctx.sampleRate 기준 1회 생성. Preview 는 캐시해 재사용한다.
export function makeReverbIR(ctx: BaseAudioContext): AudioBuffer {
  const dur = 1.2, len = Math.floor(ctx.sampleRate * dur);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  let seed = 24681;
  const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = rng() * Math.pow(1 - i / len, 2.6);
  }
  return ir;
}

// ── 파라미터 → 목표값 계산 (build/update 공용) ────────────────────────────
export function inputGainValue(params: PreviewParams): number {
  const peak = Number.isFinite(params.meta.peakDb) ? Math.pow(10, params.meta.peakDb / 20) : 1;
  return params.vals['input.normimp'] ? Math.min(8, Math.pow(10, -0.1 / 20) / peak) : 1;
}

export function eqFreq(vals: Vals, i: number, nyq: number): number {
  return Math.max(20, Math.min(nyq - 1, num(vals[`spectral.f${i}`], 1000)));
}
export function eqQ(vals: Vals, i: number): number {
  return i === 0 || i === 4 ? 0.71 : Math.max(0.2, num(vals[`spectral.q${i}`], 1));
}

function isGraphicEq(vals: Vals): boolean {
  return vals['spectral.mode'] === '9-Band';
}

function configureEqFilter(f: BiquadFilterNode, vals: Vals, i: number, nyq: number) {
  if (isGraphicEq(vals)) {
    f.type = 'peaking';
    f.frequency.value = Math.min(nyq - 1, GRAPHIC_EQ_FREQS[i]);
    f.gain.value = num(vals[`spectral.graphic.g${i}`]);
    f.Q.value = Math.SQRT1_2;
    return;
  }
  if (i < 5) {
    f.type = i === 0 ? 'lowshelf' : i === 4 ? 'highshelf' : 'peaking';
    f.frequency.value = eqFreq(vals, i, nyq);
    f.gain.value = num(vals[`spectral.g${i}`]);
    f.Q.value = eqQ(vals, i);
  } else {
    f.type = 'peaking';
    f.frequency.value = Math.min(nyq - 1, GRAPHIC_EQ_FREQS[i]);
    f.gain.value = 0;
    f.Q.value = Math.SQRT1_2;
  }
}

export function loudnessGainValue(params: PreviewParams): number {
  return loudnessMakeupGain(num(params.vals['loudness.target'], -14), params.meta.integratedLufs);
}

// Pre fade 엔벨로프를 재생 위치(startOffset) 기준 절대 시간으로 (재)스케줄한다.
// Export 는 startCtxTime=0, startOffset=0 으로 전체 곡 기준 1회 적용한다.
export function scheduleFade(fade: GainNode, params: PreviewParams, startCtxTime: number, startOffset: number) {
  const fadeIn = Math.max(0, num(params.vals['pre.fadein']) / 1000);
  const fadeOut = Math.max(0, num(params.vals['pre.fadeout']) / 1000);
  const duration = params.meta.duration;
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

// v0.6.0 (Phase 5): Stereo 섹션 빌드(Width/Bass Mono = M/S, Reverb/Delay = 병렬 send, Mono Master).
function buildStereoSection(ctx: BaseAudioContext, input: AudioNode, vals: Vals, nodes: AudioNode[], reverbIR: AudioBuffer): { out: AudioNode; refs: StereoNodes } {
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
  conv.buffer = reverbIR;
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

/**
 * source 에서 시작해 7단계 마스터 체인(Input → Pre → Spectral → Dynamics → Stereo → Loudness)을
 * 구성하고, 마지막 Loudness tail(output)과 실시간 갱신용 참조(refs)를 돌려준다.
 * source.connect(inputGain) 까지 내부에서 수행하며, output → (destination | wetGain) 연결은 호출자 몫.
 */
export function buildMasterChain(ctx: BaseAudioContext, source: AudioNode, params: PreviewParams, opts: BuildMasterChainOptions): { output: AudioNode; refs: MasterChainRefs } {
  const { nodes, offset, workletReady, reverbIR, channels } = opts;
  const vals = params.vals;
  const enabled = params.enabled;
  const srcChannels = params.meta.channels;
  const nyq = ctx.sampleRate / 2;
  const sections: Partial<Record<ModId, SectionGain>> = {};

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
    const dspOut = buildDSP(input);
    dspOut.connect(wet);
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
    scheduleFade(g, params, ctx.currentTime, offset);
    return g;
  });

  // III EQ — 5-band Parametric / fixed-frequency 9-band Graphic.
  // 9 nodes are always present so mode switching during playback needs no graph rebuild.
  const eqFilters: BiquadFilterNode[] = [];
  tail = wrapSection('spectral', tail, (input) => {
    let t = input;
    for (let i = 0; i < 9; i++) {
      const f = ctx.createBiquadFilter();
      configureEqFilter(f, vals, i, nyq);
      t.connect(f);
      nodes.push(f);
      eqFilters.push(f);
      t = f;
    }
    return t;
  });

  // IV Dynamics — Linkwitz-Riley 3밴드 멀티밴드 컴프 + 트랜지언트 + 익사이터  (v0.5.0 Phase 4)
  let dyn: DynGraph | null = null;
  tail = wrapSection('dynamics', tail, (input) => {
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
    // v0.8.3: Multiband 컴프를 dry/wet 으로 감싸 on/off 를 그래프 재빌드 없이 crossfade 로 처리.
    // bandSum = (Multiband OFF=input 직통) | (ON=3밴드 컴프 합). 익사이터는 bandSum 에서 추출하므로
    // OFF 시 익사이터는 원신호 고역에 작동한다.
    const mbOn = vals['dynamics.multiband'] !== false;
    const bandSum = ctx.createGain();
    const mbWet = ctx.createGain(); mbWet.gain.value = mbOn ? 1 : 0;
    const mbDry = ctx.createGain(); mbDry.gain.value = mbOn ? 0 : 1;
    input.connect(mbDry); mbDry.connect(bandSum);
    mbWet.connect(bandSum);
    nodes.push(bandSum, mbWet, mbDry);
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
      mk.connect(mbWet);
      nodes.push(c, mk);
      bands.push(c);
      bandGains.push(mk);
    }

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

    dyn = { bands, bandGains, exciterShaper: exShaper, exciterGain: exGain, mbDry, mbWet };
    return dynOut;
  });

  // V Stereo — 스테레오만 처리, 모노 입력은 항등 통과  (v0.6.0 Phase 5)
  let stereo: StereoNodes | null = null;
  tail = wrapSection('stereo', tail, (input) => {
    if (srcChannels < 2) {
      const g = ctx.createGain();
      input.connect(g);
      nodes.push(g);
      return g;
    }
    const built = buildStereoSection(ctx, input, vals, nodes, reverbIR);
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
    if (workletReady) {
      const lim = new AudioWorkletNode(ctx, LIMITER_PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [channels >= 2 ? 2 : 1],
        processorOptions: { lookaheadMs: LIMITER_LOOKAHEAD_MS },
      });
      lim.parameters.get('ceiling')!.value = ceilingLinear(vals);
      lim.parameters.get('release')!.value = limiterReleaseSec(vals);
      lim.parameters.get('enabled')!.value = limiterEnabled(vals) ? 1 : 0;
      if (opts.onLimiterGr) lim.port.onmessage = (e) => opts.onLimiterGr!(e.data?.gr ?? 1);
      sat.connect(lim);
      nodes.push(lim);
      limiter = lim;
      return lim;
    }
    return sat;
  });

  return {
    output: tail,
    refs: { inputGain, fade, eqFilters, dyn, stereo, loudnessGain, loudnessSat, limiter, sections },
  };
}

// Preview/Export 공용 실시간 파라미터 적용. Export 는 1회 빌드로 끝나므로 Preview 만 사용한다.
// fadeOffset: Pre fade 재스케줄 기준 현재 재생 위치(초).
export function applyMasterChainParams(ctx: BaseAudioContext, refs: MasterChainRefs, params: PreviewParams, fadeOffset: number) {
  const vals = params.vals;
  const enabled = params.enabled;
  const nyq = ctx.sampleRate / 2;

  for (const id of ['pre', 'spectral', 'dynamics', 'stereo', 'loudness'] as ModId[]) {
    const sg = refs.sections[id];
    if (!sg) continue;
    const on = enabled[id];
    setParam(sg.dry.gain, on ? 0 : 1, ctx);
    setParam(sg.wet.gain, on ? 1 : 0, ctx);
  }

  setParam(refs.inputGain.gain, inputGainValue(params), ctx);

  if (refs.fade) scheduleFade(refs.fade, params, ctx.currentTime, fadeOffset);

  refs.eqFilters.forEach((f, i) => {
    if (isGraphicEq(vals)) {
      f.type = 'peaking';
      setParam(f.frequency, Math.min(nyq - 1, GRAPHIC_EQ_FREQS[i]), ctx);
      setParam(f.gain, num(vals[`spectral.graphic.g${i}`]), ctx);
      setParam(f.Q, Math.SQRT1_2, ctx);
    } else if (i < 5) {
      f.type = i === 0 ? 'lowshelf' : i === 4 ? 'highshelf' : 'peaking';
      setParam(f.frequency, eqFreq(vals, i, nyq), ctx);
      setParam(f.gain, num(vals[`spectral.g${i}`]), ctx);
      setParam(f.Q, eqQ(vals, i), ctx);
    } else {
      setParam(f.gain, 0, ctx);
    }
  });

  if (refs.dyn) {
    const ratio = ratioFromVal(vals['dynamics.ratio']);
    const dynRef = refs.dyn;
    const mbOn = vals['dynamics.multiband'] !== false; // v0.8.3
    setParam(dynRef.mbWet.gain, mbOn ? 1 : 0, ctx);
    setParam(dynRef.mbDry.gain, mbOn ? 0 : 1, ctx);
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

  if (refs.stereo) {
    setParam(refs.stereo.sWidth.gain, stereoWidth(vals), ctx);
    setParam(refs.stereo.sHP.frequency, bassMonoFreq(vals), ctx);
    setParam(refs.stereo.reverbGain.gain, reverbSend(vals), ctx);
    setParam(refs.stereo.delayGain.gain, delaySend(vals), ctx);
    const monoOn = !!vals['stereo.mono'];
    setParam(refs.stereo.monoDry.gain, monoOn ? 0 : 1, ctx);
    setParam(refs.stereo.monoWet.gain, monoOn ? 1 : 0, ctx);
  }

  if (refs.loudnessGain) setParam(refs.loudnessGain.gain, loudnessGainValue(params), ctx);
  if (refs.loudnessSat) refs.loudnessSat.curve = loudnessSatCurve(saturationAmount(vals));
  if (refs.limiter) {
    setParam(refs.limiter.parameters.get('ceiling')!, ceilingLinear(vals), ctx);
    setParam(refs.limiter.parameters.get('release')!, limiterReleaseSec(vals), ctx);
    setParam(refs.limiter.parameters.get('enabled')!, limiterEnabled(vals) ? 1 : 0, ctx);
  }
}
