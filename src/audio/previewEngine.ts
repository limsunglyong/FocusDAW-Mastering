// FocusDAW Mastering Desk v0.2.0 (Phase 1) - Preview 오디오 엔진 코어
// 선택된 AudioBuffer 를 7단계 직렬 Web Audio 그래프로 재생한다. 현재 Phase 1에서는
// 실시간 청취용 기본 DSP(EQ/간단 dynamics/stereo/loudness)를 연결하고, 고급 단계는 후속 Phase에서 확장한다.
import type { Vals, ModId } from '../desk/data';
import type { AudioMeta } from './decoder';

type EnabledMap = Record<ModId, boolean>;

export type PreviewParams = {
  vals: Vals;
  enabled: EnabledMap;
  meta: AudioMeta;
};

type ActiveGraph = {
  source: AudioBufferSourceNode;
  nodes: AudioNode[];
  onEnded: (() => void) | null;
};

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function ratioFromVal(v: unknown): number {
  if (v === '8:1') return 8;
  if (v === '2:1') return 2;
  return 4;
}

function makeSaturator(ctx: AudioContext, amount: number): WaveShaperNode {
  const shaper = ctx.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(n);
  const drive = 1 + Math.max(0, Math.min(1, amount)) * 8;
  const norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / norm;
  }
  shaper.curve = curve;
  shaper.oversample = '4x';
  return shaper;
}

function setParam(p: AudioParam, value: number, ctx: AudioContext) {
  p.cancelScheduledValues(ctx.currentTime);
  p.setTargetAtTime(value, ctx.currentTime, 0.015);
}

export class PreviewEngine {
  private ctx: AudioContext | null = null;
  private graph: ActiveGraph | null = null;
  private params: PreviewParams | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private currentOnEnded: (() => void) | null = null;
  private startedAt = 0;
  private offset = 0;
  private playing = false;
  private desiredSampleRate: number | null = null;

  isPlaying() {
    return this.playing;
  }

  getCurrentTime() {
    if (!this.ctx || !this.playing) return this.offset;
    return Math.max(0, this.offset + (this.ctx.currentTime - this.startedAt));
  }

  async play(buffer: AudioBuffer, params: PreviewParams, onEnded: () => void, offset = 0) {
    await this.ensureContext(buffer.sampleRate);
    this.stop(false);
    this.params = params;
    this.currentBuffer = buffer;
    this.currentOnEnded = onEnded;
    this.offset = Math.max(0, offset);
    this.start(buffer, onEnded);
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

  update(params: PreviewParams) {
    this.params = params;
    if (!this.ctx || !this.graph) return;
    this.applyLiveParams(params);
    if (this.playing && this.currentBuffer && this.currentOnEnded) {
      this.offset = Math.min(this.getCurrentTime(), Math.max(0, this.currentBuffer.duration - 0.001));
      this.stopGraph();
      this.playing = false;
      this.start(this.currentBuffer, this.currentOnEnded);
    }
  }

  private async ensureContext(sampleRate: number) {
    if (!this.ctx || this.desiredSampleRate !== sampleRate) {
      this.stop();
      this.ctx = new AudioContext({ sampleRate });
      this.desiredSampleRate = sampleRate;
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  private start(buffer: AudioBuffer, onEnded: () => void) {
    const ctx = this.ctx;
    const params = this.params;
    if (!ctx || !params) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const graph = this.buildGraph(ctx, source, params);
    source.onended = () => {
      if (this.graph !== graph) return;
      this.stopGraph();
      this.playing = false;
      this.offset = 0;
      this.currentBuffer = null;
      this.currentOnEnded = null;
      graph.onEnded?.();
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
    const nodes: AudioNode[] = [source];
    let tail: AudioNode = source;
    const append = (node: AudioNode) => {
      tail.connect(node);
      tail = node;
      nodes.push(node);
    };
    const vals = params.vals;
    const enabled = params.enabled;
    const nyq = Math.min(source.buffer?.sampleRate ?? ctx.sampleRate, ctx.sampleRate) / 2;

    const inputGain = ctx.createGain();
    const peak = Number.isFinite(params.meta.peakDb) ? Math.pow(10, params.meta.peakDb / 20) : 1;
    inputGain.gain.value = vals['input.normimp'] ? Math.min(8, Math.pow(10, -0.1 / 20) / peak) : 1;
    append(inputGain);

    if (enabled.pre) {
      const fade = ctx.createGain();
      fade.gain.value = 1;
      const fadeIn = Math.max(0, num(vals['pre.fadein']) / 1000);
      const fadeOut = Math.max(0, num(vals['pre.fadeout']) / 1000);
      const start = ctx.currentTime;
      if (fadeIn > 0) {
        fade.gain.setValueAtTime(0, start);
        fade.gain.linearRampToValueAtTime(1, start + fadeIn);
      }
      if (fadeOut > 0 && params.meta.duration > fadeOut) {
        fade.gain.setValueAtTime(1, start + params.meta.duration - fadeOut);
        fade.gain.linearRampToValueAtTime(0, start + params.meta.duration);
      }
      append(fade);
    }

    if (enabled.spectral) {
      for (let i = 0; i < 5; i++) {
        const f = ctx.createBiquadFilter();
        f.type = i === 0 ? 'lowshelf' : i === 4 ? 'highshelf' : 'peaking';
        f.frequency.value = Math.max(20, Math.min(nyq - 1, num(vals[`spectral.f${i}`], 1000)));
        f.gain.value = num(vals[`spectral.g${i}`]);
        f.Q.value = i === 0 || i === 4 ? 0.71 : Math.max(0.2, num(vals[`spectral.q${i}`], 1));
        append(f);
      }
    }

    if (enabled.dynamics) {
      const comp = ctx.createDynamicsCompressor();
      const avgThreshold = (num(vals['dynamics.low'], -4) + num(vals['dynamics.mid'], -2) + num(vals['dynamics.high'], -3)) / 3;
      comp.threshold.value = Math.max(-40, Math.min(-1, avgThreshold * 3));
      comp.knee.value = 12;
      comp.ratio.value = ratioFromVal(vals['dynamics.ratio']);
      comp.attack.value = Math.max(0.002, 0.02 - num(vals['dynamics.transient']) * 0.0002);
      comp.release.value = 0.22;
      append(comp);

      const exciter = num(vals['dynamics.exciter']) / 100;
      if (exciter > 0.01) append(makeSaturator(ctx, exciter * 0.22));
    }

    if (enabled.stereo && params.meta.channels >= 2) {
      tail = this.appendStereoWidth(ctx, tail, num(vals['stereo.width'], 100) / 100, nodes);
    }

    if (enabled.loudness) {
      const target = num(vals['loudness.target'], -14);
      const lufs = params.meta.integratedLufs;
      if (Number.isFinite(lufs)) {
        const gain = ctx.createGain();
        gain.gain.value = Math.max(0.05, Math.min(6, Math.pow(10, (target - lufs) / 20)));
        append(gain);
      }
      const sat = num(vals['loudness.sat']) / 100;
      if (sat > 0.01) append(makeSaturator(ctx, sat * 0.5));
      if (vals['loudness.tplimit']) {
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = num(vals['loudness.ceiling'], -1);
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.001;
        limiter.release.value = vals['loudness.limiter'] === 'Loud' ? 0.08 : vals['loudness.limiter'] === 'Clear' ? 0.18 : 0.12;
        append(limiter);
      }
    }

    tail.connect(ctx.destination);
    nodes.push(ctx.destination);
    return { source, nodes, onEnded: null };
  }

  private appendStereoWidth(ctx: AudioContext, inputFrom: AudioNode, width: number, ownedNodes: AudioNode[]): AudioNode {
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
    return merger;
  }

  private applyLiveParams(params: PreviewParams) {
    const ctx = this.ctx;
    const graph = this.graph;
    if (!ctx || !graph) return;
    const nodes = graph.nodes;
    let eqIndex = 0;
    const vals = params.vals;
    const nyq = ctx.sampleRate / 2;
    for (const node of nodes) {
      if (node instanceof BiquadFilterNode && eqIndex < 5) {
        setParam(node.frequency, Math.max(20, Math.min(nyq - 1, num(vals[`spectral.f${eqIndex}`], 1000))), ctx);
        setParam(node.gain, params.enabled.spectral ? num(vals[`spectral.g${eqIndex}`]) : 0, ctx);
        setParam(node.Q, eqIndex === 0 || eqIndex === 4 ? 0.71 : Math.max(0.2, num(vals[`spectral.q${eqIndex}`], 1)), ctx);
        eqIndex++;
      }
    }
  }
}

export const previewEngine = new PreviewEngine();
