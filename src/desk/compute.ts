// FocusDAW Mastering Desk v0.1.1 (Phase 0 UI) - 원본 renderVals() 포팅 (순수 뷰모델 계산)
// 출처: Mastering Desk Studio.standalone.html (DCLogic.renderVals). 계산식·색·문자열을 원본 그대로 유지.
import { THEMES, type ThemeName } from '../theme/themes';
import {
  ROMAN, MODS, CTRL, EQBANDS, EQPRESETS, EQPRESET_ORDER, UNITS, META, FILES, MENUS, RIBBON, TOTAL_MB,
  type DeskState, type ModId, type CtrlDef,
} from './data';
import { APP_VERSION_LABEL } from '../version';

const num = (v: unknown) => Number(v);

// ---- 노브 기하 (28,28 중심, -135°~+135°) ----
function polar(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [28 + r * Math.sin(a), 28 - r * Math.cos(a)];
}
function arcPath(r: number, a0: number, a1: number): string {
  const p0 = polar(r, a0), p1 = polar(r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`;
}
function fmt(def: CtrlDef, v: number): string {
  let s = Number(v).toFixed(def.dec || 0);
  if ((def.k || def.khz) && Math.abs(v) >= 1000) s = (v / 1000).toFixed(1);
  else if (def.signed && v > 0) s = '+' + s;
  return s;
}

export type Knob = {
  track: string; arc: string; arcColor: string; valColor: string; display: string; unitText: string;
  px1: string; py1: string; px2: string; py2: string;
  fk: string; kmin: number; kmax: number; kstep: number; knobStyle: string; fixed: boolean;
};
export type Control = {
  key: string; label: string; labelL1: string; labelL2: string; twoLine: boolean; labelW: string;
  isRot: boolean; isSeg: boolean; isSw: boolean; wrapStyle: string;
  fk: string;
  knob?: Knob;
  opts?: { label: string; value: string; selected: boolean; style: string }[];
  on?: boolean; subText?: string; subColor?: string; swTrack?: string; swKnob?: string;
  hasBelow?: boolean; belowOpts?: { label: string; value: string; selected: boolean; style: string }[];
  belowDesc?: string; belowStyle?: string;
};

function makeKnob(fk: string, def: CtrlDef, raw: number, vals: Record<string, any>, accent: string, pal: any, satCol: string): Knob {
  const frac = (raw - def.min!) / (def.max! - def.min!);
  const a1 = -135 + frac * 270;
  const p1 = polar(8, a1), p2 = polar(16, a1);
  const warn = def.warnAbove != null && raw > def.warnAbove;
  const fixed =
    fk === 'spectral.q0' || fk === 'spectral.q4' ||
    (fk === 'stereo.crossover' && !vals['stereo.bassmono']) ||
    (fk === 'loudness.ceiling' && !vals['loudness.tplimit']);
  let u = UNITS[fk];
  if (def.k && u === 'ms' && Math.abs(raw) >= 1000) u = 'sec';
  if (def.khz) u = Math.abs(raw) >= 1000 ? 'kHz' : 'Hz';
  return {
    display: fmt(def, raw), unitText: u || '',
    track: arcPath(22, -135, 135),
    arc: Math.abs(a1 + 135) < 0.5 ? '' : arcPath(22, -135, a1),
    arcColor: fk === 'loudness.sat' ? satCol : warn ? def.warnArc || '#f5c542' : fixed ? '#9a907c' : accent,
    valColor: fk === 'loudness.sat' ? satCol : warn ? def.warnVal || '#d98a1f' : fixed ? '#9a907c' : pal.pInk,
    px1: p1[0].toFixed(2), py1: p1[1].toFixed(2), px2: p2[0].toFixed(2), py2: p2[1].toFixed(2),
    fk: fixed ? '' : fk, kmin: def.min!, kmax: def.max!, kstep: def.step || 1,
    knobStyle: fixed ? 'cursor:not-allowed;opacity:0.42;' : 'cursor:ns-resize;', fixed,
  };
}

function nyquistOf(vals: Record<string, any>): number {
  const m: Record<string, number> = { '44.1k': 22050, '48k': 24000, '96k': 48000 };
  return m[vals['input.rate']] || 24000;
}
function bandFmax(n: number, nyq: number): number {
  return n === 4 ? nyq : Math.min(EQBANDS[n].fmax, nyq);
}
function eqDefs(vals: Record<string, any>): CtrlDef[] {
  const nyq = nyquistOf(vals), defs: CtrlDef[] = [];
  EQBANDS.forEach((bd, n) => {
    defs.push({ key: 'f' + n, type: 'rot', label: 'Freq', min: bd.fmin, max: bandFmax(n, nyq), step: bd.fstep, dec: 0, khz: true, band: n });
    defs.push({ key: 'g' + n, type: 'rot', label: 'Gain', min: -12, max: 12, step: 0.1, dec: 1, signed: true, band: n });
    defs.push({ key: 'q' + n, type: 'rot', label: 'Q', min: 0.2, max: 8, step: 0.1, dec: 1, band: n });
  });
  return defs;
}
function eqResp(vals: Record<string, any>, f: number): number {
  let tot = 0;
  for (let n = 0; n < 5; n++) {
    const g = vals['spectral.g' + n], f0 = vals['spectral.f' + n], q = vals['spectral.q' + n], t = EQBANDS[n].type;
    if (t === 'L-Shelf') tot += g / (1 + Math.pow(f / f0, 2.2));
    else if (t === 'H-Shelf') tot += g / (1 + Math.pow(f0 / f, 2.2));
    else tot += g * Math.exp(-Math.pow(Math.log(f / f0), 2) / (2 * Math.pow(0.6 / q, 2)));
  }
  return tot;
}
function eqBandIdx(vals: Record<string, any>): number {
  return Math.max(0, Math.min(4, parseInt(vals['spectral.band'] || '1', 10) - 1));
}

export function computeView(state: DeskState, themeName: ThemeName) {
  const pal: any = THEMES[themeName] || THEMES.Teal;
  const accent = pal.aMain;
  const { open, vals, enabled, curFile } = state;
  const act = MODS[open];
  const id = act.id;

  const statMap: Record<ModId, string> = {
    input: vals['input.bit'] + '-bit ' + vals['input.rate'],
    pre: vals['pre.lufs'] + ' LUFS',
    spectral: '5-band',
    dynamics: String(vals['dynamics.ratio']),
    stereo: vals['stereo.width'] + '% W',
    loudness: vals['loudness.target'] + ' LUFS',
    export: String(vals['export.format']),
  };

  const modules = MODS.map((m, i) => {
    const sel = open === i, on = enabled[m.id];
    return {
      ...m, i, roman: ROMAN[i], sel, on,
      stat: on ? statMap[m.id] : 'bypassed',
      statColor: sel ? accent : '#8a8070',
      cardStyle:
        `width:100%;height:135px;box-sizing:border-box;border-radius:10px;cursor:pointer;position:relative;display:flex;flex-direction:column;padding:10px 9px 11px;` +
        (sel
          ? `background:linear-gradient(180deg,${pal.cardSelA},${pal.cardSelB});transform:translateY(-4px);box-shadow:0 16px 30px -12px rgba(0,0,0,0.7),0 0 0 2px ${accent},0 0 22px ${pal.glow};`
          : `background:linear-gradient(180deg,${pal.cardA},${pal.cardB});box-shadow:0 9px 20px -10px rgba(0,0,0,0.65),inset 0 1px 0 rgba(255,255,255,0.4);`) +
        (on ? '' : 'opacity:0.5;'),
      iconStyle: `width:21px;height:21px;border-radius:6px;display:grid;place-items:center;` + (sel ? `color:#f3ecdd;background:${accent};` : `color:${pal.pInk2};background:rgba(127,127,127,0.12);`),
      ledStyle: `width:9px;height:9px;border-radius:50%;cursor:pointer;` + (on ? `background:${accent};box-shadow:0 0 7px ${accent};` : 'background:transparent;border:1.5px solid #a99f8a;'),
      numStyle: `flex:1;display:flex;align-items:center;justify-content:center;font-family:'Spectral',serif;font-size:35px;font-weight:600;line-height:1;color:${sel ? accent : pal.pNum};text-shadow:0 1px 0 rgba(255,255,255,0.55);`,
      nameColor: sel ? pal.pInk : pal.pInk2,
      colStyle: `flex:1;min-width:0;max-width:139px;display:flex;flex-direction:column;align-items:stretch;gap:8px`,
      bypLabel: on ? '● ON' : 'BYPASS',
      bypHidden: m.id === 'input' || m.id === 'export',
      bypBtnStyle:
        `width:100%;box-sizing:border-box;padding:6px 0;border:none;border-radius:7px;font-family:'Archivo';font-size:8.5px;font-weight:700;letter-spacing:0.12em;cursor:pointer;` +
        (m.id === 'input' || m.id === 'export' ? 'visibility:hidden;pointer-events:none;' : '') +
        (on ? `color:${accent};text-shadow:0 0 6px ${pal.glow},0 0 12px ${pal.glow};background:${pal.paperCtl};box-shadow:inset 0 0 0 1px ${accent},0 0 10px ${pal.glow};` : `color:${pal.pInk2};background:${pal.paperCtl};box-shadow:inset 0 0 0 1px rgba(127,127,127,0.18);`),
      tapStyle: `position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);width:10px;height:10px;border-radius:50%;background:${sel ? pal.aGlow : 'rgba(58,52,43,0.25)'};` + (sel ? `box-shadow:0 0 10px ${accent};animation:dkpulse 1.4s ease-in-out infinite;` : ''),
    };
  });

  // ---- saturation THD status color (shared by knob + viz) ----
  const _satV = num(vals['loudness.sat']) / 100;
  const _hv = [2, 3, 4, 5].map((k) => {
    const base = (_satV * (k % 2 === 0 ? 0.9 : 0.55)) / Math.pow(k - 1, 0.7);
    return Math.max(0.03, Math.min(1, base));
  });
  const _thd = Math.sqrt((_hv[0] + _hv[2]) * (_hv[0] + _hv[2]) * 0.55 + (_hv[1] + _hv[3]) * (_hv[1] + _hv[3]) * 1.0) * 7.5 * (0.4 + _satV * 0.9);
  const satCol = _thd >= 3 ? '#e6502e' : _thd >= 1 ? '#e6c23c' : accent;

  const defs = id === 'spectral' ? eqDefs(vals) : CTRL[id] || [];
  const segStyle = (selected: boolean) =>
    `text-align:center;font-family:'Archivo';font-size:10px;font-weight:600;padding:6px 9px;border-radius:6px;cursor:pointer;white-space:nowrap;` +
    (selected ? `color:#f3ecdd;background:${accent};` : `color:${pal.pSeg};`);

  let controls: Control[] = defs.map((def) => {
    const fk = id + '.' + def.key, raw = vals[fk];
    const _l1 = def.label.split(' ')[0], _l2 = def.label.substring(_l1.length + 1);
    const base: Control = {
      key: def.key, label: def.label, labelL1: _l1, labelL2: _l2, twoLine: _l2.length > 0,
      labelW: def.type === 'sw' && id === 'stereo' ? '66px' : '46px',
      isRot: false, isSeg: false, isSw: false,
      wrapStyle: def.type === 'sw' && id === 'stereo' ? 'flex:none;flex-basis:100%' : 'flex:none',
      fk,
    };
    if (def.type === 'rot') {
      return { ...base, isRot: true, knob: makeKnob(fk, def, num(raw), vals, accent, pal, satCol) };
    }
    if (def.type === 'seg') {
      return { ...base, isSeg: true, opts: def.opts!.map((o) => ({ label: o, value: o, selected: raw === o, style: segStyle(raw === o) })) };
    }
    const on = !!raw;
    return {
      ...base, isSw: true, on, subText: on ? 'ON' : 'OFF', subColor: on ? accent : '#a99f8a',
      swTrack: `width:34px;height:19px;border-radius:10px;flex:none;position:relative;background:${on ? accent : '#cdbfa4'};`,
      swKnob: `position:absolute;top:2px;left:${on ? 17 : 2}px;width:15px;height:15px;border-radius:50%;background:#fbf6ea;transition:left .12s;box-shadow:0 1px 2px rgba(0,0,0,0.3);`,
    };
  });

  // Noise Depth segment stacked under Denoise switch
  const _nd = controls.find((c) => c.key === 'noiseDepth'), _dn = controls.find((c) => c.key === 'denoise');
  if (_nd && _dn) {
    _dn.hasBelow = true;
    _dn.belowOpts = _nd.opts;
    _dn.belowDesc = ({ '1': 'Original', '2': 'Normal', '3': 'Deep noise' } as Record<string, string>)[String(vals['pre.noiseDepth'])] || '';
    _dn.belowStyle = 'transition:opacity .15s;' + (vals['pre.denoise'] ? 'opacity:1;' : 'opacity:0.4;pointer-events:none;');
    controls = controls.filter((c) => c !== _nd);
  }

  // Dynamics: pull low/mid/high (→ viz bars) and transient/exciter (→ extra block)
  let dynLow: Control | undefined, dynMid: Control | undefined, dynHigh: Control | undefined, dynTrans: Control | undefined, dynExc: Control | undefined;
  if (id === 'dynamics') {
    dynLow = controls.find((c) => c.key === 'low'); dynMid = controls.find((c) => c.key === 'mid'); dynHigh = controls.find((c) => c.key === 'high');
    dynTrans = controls.find((c) => c.key === 'transient'); dynExc = controls.find((c) => c.key === 'exciter');
    controls = controls.filter((c) => ['low', 'mid', 'high', 'transient', 'exciter'].indexOf(c.key) < 0);
  }

  const metaFields = META.map((def) => {
    const fk = 'export.' + def.key, raw = vals[fk];
    if (def.type === 'text') return { key: def.key, label: def.label, isText: true, isSeg: false, value: String(raw || ''), ph: def.ph || '', fk, wrap: def.key === 'album' ? 'grid-column:span 2;' : '' };
    return {
      key: def.key, label: def.label, isText: false, isSeg: true, fk, wrap: 'grid-column:span 2;',
      opts: def.opts!.map((o) => ({ label: o, value: o, selected: raw === o, style: `flex:1;text-align:center;font-family:'Archivo';font-size:10px;font-weight:600;padding:5px 4px;border-radius:6px;cursor:pointer;` + (raw === o ? `color:#f3ecdd;background:${accent};` : `color:${pal.pSeg};`) })),
    };
  });

  // ===== viz =====
  const isInput = id === 'input', isPre = id === 'pre', isSpectral = id === 'spectral', isDynamics = id === 'dynamics', isStereo = id === 'stereo', isLoudness = id === 'loudness', isExport = id === 'export';

  let eqColumns: any[] = [], eqPresetCards: any[] = [];
  const eqPresetName = String(vals['spectral.preset'] || 'Normal');
  const eqPresetColor = (EQPRESETS[eqPresetName] || EQPRESETS.Normal).color;

  let waterfall: any[] = [], fftInfo: any[] = [], noiseInfo: any[] = [];
  let eqLine = '', eqArea = '', eqDots: any[] = [], eqAxis: any[] = [];
  let dynBars: any[] = [], transPath = '', transLabel = '', exciterBars: any[] = [], exLabel = '';
  let stReverb: any[] = [], stReverbLabel = '', stDelay: any[] = [], stDelayLabel = '', stMonoOn = false, stMonoRx = '20', stMonoVal = '';
  let stCompatOn = false, stCorrX = '100%', stCompatStatus = '', stCompatColor = '#8a8070', stCorrLabel = '', stLossLabel = '';
  let stereoRx = 70, stereoW = '100%';
  let loudFill = '50%', loudTargetX = '50%', loudTargetLabel = '-14 LUFS', loudCeiling = '-1.0 dB', loudMode = 'Punchy', tpDim = '1';
  let satPath = '', satLine = '', satLabel = '', satHarm: any[] = [], satThd = '0.0%', satThdStatus = 'GENTLE', satWarnColor = satCol;
  let exportFormat = 'WAV', exportAlbum = 'Untitled Master';

  if (isPre) {
    const NT = 11, NF = 46, oX = 14, plotW = 300, baseY = 128, skewX = 2.6, skewY = 8, amp = 34;
    const nrOn = !!vals['pre.denoise'], nr = nrOn ? num(vals['pre.denoiseAmt']) / 100 : 0;
    const field = (i: number, t: number) => {
      const f = i / (NF - 1);
      let h = 0.12 + 0.5 * Math.exp(-Math.pow((f - 0.06 - 0.008 * t) / 0.05, 2));
      h += 0.34 * Math.exp(-Math.pow((f - 0.3 + 0.012 * t) / 0.1, 2));
      h += 0.18 * Math.exp(-Math.pow((f - 0.62) / 0.16, 2)) * (0.6 + 0.4 * Math.sin(t * 0.7));
      h += 0.06 * Math.sin(f * 40 + t) * Math.exp(-f * 0.8);
      h += 0.05 * Math.sin(f * 120 + t * 2.0);
      if (f > 0.5) h *= 1 - 0.55 * nr * (f - 0.5) / 0.5;
      return Math.max(0.02, Math.min(1, h));
    };
    for (let t = NT - 1; t >= 0; t--) {
      const by = baseY - t * skewY;
      let line = '';
      for (let i = 0; i < NF; i++) {
        const x = oX + (i / (NF - 1)) * plotW + t * skewX;
        const y = by - field(i, t) * amp;
        line += (i === 0 ? 'M ' : 'L ') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
      }
      const x0 = (oX + t * skewX).toFixed(1), x1 = (oX + plotW + t * skewX).toFixed(1);
      const depth = t / (NT - 1);
      waterfall.push({ line: line.trim(), area: line + `L ${x1} ${by.toFixed(1)} L ${x0} ${by.toFixed(1)} Z`, sop: (0.92 - depth * 0.6).toFixed(2), fop: (0.2 - depth * 0.15).toFixed(2) });
    }
    const floor = (-62 - nr * 8).toFixed(0), snr = (48 + nr * 9).toFixed(0);
    fftInfo = [{ k: 'FFT Size', v: '4096' }, { k: 'Window', v: 'Hann' }, { k: 'Overlap', v: '75%' }, { k: 'Bin', v: '11.7 Hz' }];
    noiseInfo = [{ k: 'Floor', v: floor + ' dBFS' }, { k: 'SNR', v: snr + ' dB' }, { k: 'Profile', v: nrOn ? 'Hiss · Hum' : '—' }, { k: 'Reduction', v: nrOn ? Math.round(nr * 100) + '%' : 'off' }];
  } else if (isSpectral) {
    const W = 338, mid = 82, pxDb = 2.6, N = 90, bAct = eqBandIdx(vals);
    const nyq = nyquistOf(vals), dec = Math.log10(nyq / 20);
    const fx = (f: number) => (Math.log10(Math.max(20, f) / 20) / dec) * W;
    const yOf = (g: number) => Math.max(12, Math.min(142, mid - g * pxDb));
    let d = '';
    for (let i = 0; i < N; i++) {
      const f = 20 * Math.pow(nyq / 20, i / (N - 1));
      d += (i === 0 ? 'M ' : 'L ') + fx(f).toFixed(1) + ' ' + yOf(eqResp(vals, f)).toFixed(1) + ' ';
    }
    eqLine = d.trim();
    eqArea = eqLine + ` L ${W} 150 L 0 150 Z`;
    eqDots = EQBANDS.map((bd, n) => {
      const f0 = num(vals['spectral.f' + n]);
      return {
        cx: fx(f0).toFixed(1), cy: yOf(eqResp(vals, f0)).toFixed(1), fill: bd.col, sel: n === bAct,
        r: n === bAct ? 6.5 : 4.5, sw: n === bAct ? 2.6 : 2, num: String(n + 1), numColor: n === bAct ? bd.col : 'transparent', band: n,
        qk: 'spectral.q' + n, qmin: 0.2, qmax: 8, qstep: 0.1,
        fmin: bd.fmin, fmax: bandFmax(n, nyq), fstep: bd.fstep, nyq,
      };
    });
    eqAxis = [0, 1, 2, 3, 4].map((i) => {
      const f = 20 * Math.pow(nyq / 20, i / 4);
      return { label: f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 0 : 1) + 'k' : Math.round(f) + '' };
    });
    eqColumns = EQBANDS.map((bd, n) => ({ num: n + 1, type: bd.type, color: bd.col, ctls: [controls[n * 3], controls[n * 3 + 1], controls[n * 3 + 2]] }));
    eqPresetCards = EQPRESET_ORDER.map((name) => {
      const p = EQPRESETS[name], on = name === eqPresetName;
      return {
        name, desc: p.desc, nameColor: on ? p.color : pal.pInk,
        dotStyle: `width:9px;height:9px;border-radius:50%;background:${p.color};` + (on ? `box-shadow:0 0 8px ${p.color};` : 'opacity:0.85;'),
        cardStyle: `flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 8px;border-radius:11px;cursor:pointer;background:${on ? 'rgba(58,52,43,0.05)' : 'transparent'};box-shadow:inset 0 0 0 ${on ? 2 : 1.5}px ${on ? p.color : 'rgba(58,52,43,0.16)'}${on ? ',0 4px 14px -6px ' + p.color : ''};`,
      };
    });
  } else if (isDynamics) {
    const mk = (k: string, label: string, c: string) => { const v = num(vals[k]); return { label, val: v.toFixed(1), color: c, fill: ((Math.abs(v) / 18) * 100).toFixed(0) + '%' }; };
    dynBars = [{ ...mk('dynamics.low', 'LOW', '#7cc4ff'), knob: dynLow }, { ...mk('dynamics.mid', 'MID', pal.aBright), knob: dynMid }, { ...mk('dynamics.high', 'HIGH', '#e0a046'), knob: dynHigh }];
    const tn = num(vals['dynamics.transient']) / 50;
    const W = 212, mid = 27, half = 22, onsets = [0.07, 0.4, 0.72], N = 100;
    const ampAt = (xf: number) => { let a = 0; onsets.forEach((o) => { if (xf >= o) { const d = xf - o, dec = 0.06 * (1 - tn * 0.45) + 0.012; a += Math.exp(-d / dec) * (1 + tn * 0.7); } }); return Math.max(0, Math.min(1, a)); };
    const pts: [number, number][] = []; for (let i = 0; i < N; i++) { const xf = i / (N - 1); pts.push([xf * W, ampAt(xf)]); }
    let dt = 'M 0 ' + mid; pts.forEach((p) => { dt += ' L ' + p[0].toFixed(1) + ' ' + (mid - p[1] * half).toFixed(1); });
    for (let i = pts.length - 1; i >= 0; i--) dt += ' L ' + pts[i][0].toFixed(1) + ' ' + (mid + pts[i][1] * half).toFixed(1);
    transPath = dt + ' Z';
    transLabel = (num(vals['dynamics.transient']) > 0 ? '+' : '') + vals['dynamics.transient'] + '%';
    const ex = num(vals['dynamics.exciter']) / 100;
    exciterBars = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => {
      const base = 1 / Math.pow(k, 0.85);
      const h = k <= 2 ? base : base * (0.22 + ex * 1.25);
      const hot = k >= 3, col = hot ? pal.aBright : '#9a907c';
      return { label: k === 1 ? 'f' : k + '×', barStyle: `width:100%;border-radius:2px 2px 0 0;height:${(Math.max(0.04, Math.min(1, h)) * 100).toFixed(0)}%;background:${col};` + (hot ? `box-shadow:0 0 6px ${pal.glow};` : 'opacity:0.7;') };
    });
    exLabel = vals['dynamics.exciter'] + '%';
  } else if (isStereo) {
    const w = num(vals['stereo.width']); stereoRx = Math.max(8, (w / 200) * 128); stereoW = w + '%';
    const rev = num(vals['stereo.reverb']), dly = num(vals['stereo.delay']), bmono = !!vals['stereo.bassmono'], bfreq = num(vals['stereo.crossover']), monoOn = !!vals['stereo.mono'];
    const rN = Math.min(3, Math.round(rev / 8));
    for (let i = 1; i <= rN; i++) stReverb.push({ rx: (stereoRx + i * 16).toFixed(1), ry: (42 + i * 9).toFixed(1), op: ((rev / 30) * 0.34 * (1 - (i - 1) * 0.28)).toFixed(3) });
    stReverbLabel = rev + '%';
    const dN = Math.min(3, Math.round(dly / 8));
    for (let i = 1; i <= dN; i++) { const off = (14 + i * 12) * (0.5 + dly / 30); const op = ((dly / 30) * 0.5 * (1 - (i - 1) * 0.3)).toFixed(3); stDelay.push({ cxL: (169 - off).toFixed(1), cxR: (169 + off).toFixed(1), op }); }
    stDelayLabel = dly + '%';
    stMonoOn = bmono;
    stMonoRx = (14 + ((bfreq - 60) / 240) * 30).toFixed(1);
    stMonoVal = bmono ? '< ' + bfreq + ' Hz' : 'off';
    stCompatOn = monoOn;
    const corr = Math.max(-1, Math.min(1, 1 - (w / 200) * 1.15));
    const loss = -(Math.max(0, w - 90) / 110) * 4.2;
    stCorrX = (((corr + 1) / 2) * 100).toFixed(1) + '%';
    stCompatStatus = corr >= 0.5 ? 'GOOD' : corr >= 0 ? 'CHECK' : 'RISK';
    stCompatColor = corr >= 0.5 ? '#46c06a' : corr >= 0 ? '#e6c23c' : '#e6502e';
    stCorrLabel = (corr >= 0 ? '+' : '') + corr.toFixed(2);
    stLossLabel = (loss > -0.05 ? '0.0' : loss.toFixed(1)) + ' dB';
  } else if (isLoudness) {
    const t = num(vals['loudness.target']); const x = ((t + 30) / 30) * 100; loudFill = Math.max(0, Math.min(100, x)).toFixed(1) + '%'; loudTargetX = loudFill;
    loudTargetLabel = t + ' LUFS'; loudCeiling = vals['loudness.tplimit'] ? num(vals['loudness.ceiling']).toFixed(1) + ' dB' : 'off'; loudMode = String(vals['loudness.limiter']); tpDim = vals['loudness.tplimit'] ? '1' : '0.4';
    const sat = num(vals['loudness.sat']) / 100; const drv = 1 + sat * 5; const norm = Math.tanh(drv);
    const W = 160, H = 92, cx = W / 2, cy = H / 2, sx = W / 2 - 6, sy = H / 2 - 6;
    let sp = ''; for (let i = 0; i <= 40; i++) { const xi = -1 + i * 0.05; const yo = Math.tanh(xi * drv) / norm; sp += (i === 0 ? 'M ' : 'L ') + (cx + xi * sx).toFixed(1) + ' ' + (cy - yo * sy).toFixed(1) + ' '; }
    satPath = sp.trim();
    satLine = `M 6 ${(cy + 1 * sy).toFixed(1)} L ${W - 6} ${(cy - 1 * sy).toFixed(1)}`;
    satLabel = vals['loudness.sat'] + '%';
    const hv = [2, 3, 4, 5].map((k) => { const base = (sat * (k % 2 === 0 ? 0.9 : 0.55)) / Math.pow(k - 1, 0.7); return Math.max(0.03, Math.min(1, base)); });
    satHarm = [2, 3, 4, 5].map((k, i) => ({ label: k + '×', h: (hv[i] * 100).toFixed(0) + '%' }));
    const odd = hv[1] + hv[3], even = hv[0] + hv[2];
    const thd = Math.sqrt(even * even * 0.55 + odd * odd * 1.0) * 7.5 * (0.4 + sat * 0.9);
    satThd = thd.toFixed(1) + '%';
    satThdStatus = thd >= 3 ? 'HOT' : thd >= 1 ? 'MUSICAL' : 'GENTLE';
    satWarnColor = satCol;
  } else if (isExport) {
    exportFormat = String(vals['export.format']); exportAlbum = String(vals['export.album'] || 'Untitled Master');
  }

  const tgt = num(vals['loudness.target']), ceil = num(vals['loudness.ceiling']);

  const menus = Object.keys(MENUS).map((name) => ({
    label: name, open: state.openMenu === name,
    btnStyle: `font-family:'Archivo';font-size:11.5px;font-weight:500;color:${state.openMenu === name ? '#e6f1f4' : '#9aa7af'};padding:5px 10px;border-radius:6px;cursor:pointer;background:${state.openMenu === name ? '#283038' : 'transparent'};white-space:nowrap`,
    items: MENUS[name].map(([label, key]) => label === '__div' ? { isDiv: true, label: '', key: '' } : { isDiv: false, label, key: label === 'About FocusDAW' ? APP_VERSION_LABEL : key }),
  }));

  return {
    pal, accent, ribbon: RIBBON, menus,
    // theme-derived backgrounds
    deskBg: `radial-gradient(130% 96% at 50% -16%,${pal.gA},${pal.gB} 46%,transparent 66%),linear-gradient(180deg,${pal.deskA},${pal.deskB})`,
    paperBg: `linear-gradient(180deg,${pal.paperA},${pal.paperB})`,
    loudGrad: `linear-gradient(90deg,#0e3496 0%,#1c54be 28%,#2f8f86 47%,#33b06a 53.3%,#46be62 70%,#7cc24a 73%,#e6c23c 76.7%,#ef8a36 80%,#e6502e 83.3%,#cf2a22 90%,#a81414 100%)`,
    eqStopA: pal.eqA, eqStopB: pal.eqB, ellipseFill: pal.ell,
    modules,
    files: FILES.map((f, i) => {
      const on = i === curFile;
      return {
        ...f, i, on, iconColor: on ? pal.aInk : accent, nameColor: on ? pal.aInk : pal.nInk, sizeColor: on ? pal.aInk : '#8a8070', weight: on ? '700' : '400',
        rowStyle: `display:flex;align-items:center;gap:9px;padding:6px 9px;border-radius:7px;cursor:pointer;` + (on ? `background:${accent};box-shadow:0 0 0 1px ${accent},0 0 12px ${pal.glow};` : `background:${pal.panelDark};`),
      };
    }),
    vizTitle: act.viz,
    genCtrl: id !== 'export' && id !== 'spectral',
    isInput, isPre, isSpectral, isDynamics, isStereo, isLoudness, isExport,
    controls, metaFields, eqColumns, eqAxis,
    presetName: eqPresetName, presetNameUpper: eqPresetName.toUpperCase(), presetColor: eqPresetColor,
    eqShowPresets: !state.eqAdvanced, eqAdvanced: state.eqAdvanced,
    advLabel: state.eqAdvanced ? 'Presets ▴' : 'Advanced ▾',
    advBtnStyle: `font-family:'Archivo';font-size:9.5px;font-weight:700;letter-spacing:0.04em;padding:6px 13px;border-radius:7px;cursor:pointer;border:none;` + (state.eqAdvanced ? `color:${pal.aInk};background:${accent};` : `color:${pal.pInk};background:${pal.paperCtl};`),
    presetCards: eqPresetCards,
    waterfall, fftInfo, noiseInfo, eqLine, eqArea, eqDots, dynBars, transPath, transLabel, exciterBars, exLabel, dynTrans, dynExc,
    vizBg: isDynamics ? 'transparent' : pal.panel, vizShadow: isDynamics ? 'none' : 'inset 0 2px 8px rgba(0,0,0,0.4)', vizPad: isDynamics ? '14px 14px 0' : '14px',
    insetBg: `background:${pal.panel};box-shadow:inset 0 2px 7px rgba(0,0,0,0.45),inset 0 -1px 0 rgba(255,255,255,0.04);border:1px solid rgba(0,0,0,0.25)`,
    stereoRx: stereoRx.toFixed(1), stereoW, stReverb, stReverbLabel, stDelay, stDelayLabel, stMonoOn, stMonoRx, stMonoVal,
    stCompatOn, stCorrX, stCompatStatus, stCompatColor, stCorrLabel, stLossLabel, compatDim: '1', foldColor: stCompatOn ? stCompatColor : 'rgba(255,240,210,0.12)', bassLegendColor: stMonoOn ? pal.aBright : '#8a8070',
    loudFill, loudTargetX, loudTargetLabel, loudCeiling, loudMode, tpDim, satPath, satLine, satLabel, satHarm, satThd, satThdStatus, satWarnColor, exportFormat, exportAlbum,
    active: {
      ...act, roman: ROMAN[open], id,
      bypassHidden: id === 'input' || id === 'export',
      bypassLabel: enabled[id] ? '● ENGAGED' : '○ BYPASSED',
      bypassStyle: ((id === 'input' || id === 'export') ? 'display:none;' : '') + `font-family:'Archivo';font-size:10px;font-weight:700;letter-spacing:0.06em;padding:8px 14px;border-radius:7px;cursor:pointer;text-align:center;` + (enabled[id] ? `color:${pal.aInk};background:${accent};` : `color:#8a8070;background:${pal.paperCtl};`),
    },
    rotTrack: arcPath(22, -135, 135),
    notchLeft: `${(34 + open * 164.57 + 75.3).toFixed(1)}px`,
    titleRate: ({ '44.1k': '44.1 kHz', '48k': '48.0 kHz', '96k': '96.0 kHz' } as Record<string, string>)[String(vals['input.rate'])] || String(vals['input.rate']),
    titleBit: ({ '16': '16-bit', '24': '24-bit', '32f': '32-bit float' } as Record<string, string>)[String(vals['input.bit'])] || vals['input.bit'] + '-bit',
    titleFormat: String(vals['export.format']),
    curFileName: FILES[curFile].name, curFileIdx: String(curFile + 1).padStart(2, '0'),
    batchCount: FILES.length, batchSize: TOTAL_MB,
    workFolder: vals['input.source'] === 'Folder' ? '~/Sessions/Aurora EP/stems/' : '~/Sessions/Aurora EP/ (6 files)',
    inputFmt: vals['input.bit'] + '-bit · ' + vals['input.rate'],
    sel: FILES[curFile],
    selChips: [{ label: FILES[curFile].fmt }, { label: FILES[curFile].depth + ' · ' + FILES[curFile].sr }, { label: FILES[curFile].ch }],
    lufsVal: tgt.toFixed(1), tpVal: ceil.toFixed(1),
    activeCount: Object.values(enabled).filter(Boolean).length,
  };
}

export type DeskView = ReturnType<typeof computeView>;
