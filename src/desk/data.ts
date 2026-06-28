// FocusDAW Mastering Desk v0.1.1 (Phase 0 UI) - 원본 데이터 모델
// 출처: Mastering Desk Studio.standalone.html (DCLogic). 영문 라벨·기본값을 원본 그대로 보존.

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export type ModId = 'input' | 'pre' | 'spectral' | 'dynamics' | 'stereo' | 'loudness' | 'export';

export type ModDef = { id: ModId; short: string; name: string; icon: string; desc: string; viz: string };

export const MODS: ModDef[] = [
  { id: 'input', short: 'Input', name: 'Input', icon: 'input', desc: 'Load files, batch a folder and convert to PCM before the chain begins.', viz: 'BATCH QUEUE' },
  { id: 'pre', short: 'Pre-Proc', name: 'Pre Processing', icon: 'pre', desc: 'Clean up the source — denoise, fades and set the loudness targets.', viz: '3D SPECTRUM · TIME × FREQ × LEVEL' },
  { id: 'spectral', short: 'EQ', name: 'Spectral EQ', icon: 'spectral', desc: 'Air and tone balance · Min-φ Equalization', viz: 'SPECTRAL ANALYSIS' },
  { id: 'dynamics', short: 'Dynamics', name: 'Dynamics', icon: 'dynamics', desc: 'Multiband compression with transient shaping and exciter.', viz: 'DYNAMIC PROCESSING' },
  { id: 'stereo', short: 'Stereo', name: 'Stereo Image', icon: 'stereo', desc: 'Width, bass-mono and a touch of space.', viz: 'STEREO ENHANCEMENT' },
  { id: 'loudness', short: 'Loudness', name: 'Loudness / Limiter', icon: 'loudness', desc: 'True-peak limiting and LUFS maximization with saturation.', viz: 'LOUDNESS / LIMITER' },
  { id: 'export', short: 'Export', name: 'Export', icon: 'export', desc: 'Embed metadata, artwork and choose the output format.', viz: 'EXPORT' },
];

export type CtrlDef = {
  key: string;
  type: 'seg' | 'sw' | 'rot';
  label: string;
  opts?: string[];
  min?: number;
  max?: number;
  step?: number;
  dec?: number;
  k?: boolean;
  khz?: boolean;
  signed?: boolean;
  warnAbove?: number;
  warnArc?: string;
  warnVal?: string;
  band?: number;
};

export const CTRL: Record<ModId, CtrlDef[]> = {
  input: [
    { key: 'source', type: 'seg', label: 'Source', opts: ['Files', 'Folder'] },
    { key: 'bit', type: 'seg', label: 'PCM', opts: ['16', '24', '32f'] },
    { key: 'rate', type: 'seg', label: 'Rate', opts: ['44.1k', '48k', '96k'] },
    { key: 'scope', type: 'seg', label: 'Folder', opts: ['Root', 'Sub Folder'] },
    { key: 'normimp', type: 'sw', label: 'Normalize' },
  ],
  pre: [
    { key: 'denoise', type: 'sw', label: 'Denoise' },
    { key: 'noiseDepth', type: 'seg', label: 'Noise Depth', opts: ['1', '2', '3'] },
    { key: 'denoiseAmt', type: 'rot', label: 'Noise Reduction', min: 0, max: 100, step: 1, dec: 0 },
    { key: 'fadein', type: 'rot', label: 'Fade In', min: 0, max: 2000, step: 10, dec: 0, k: true },
    { key: 'fadeout', type: 'rot', label: 'Fade Out', min: 0, max: 4000, step: 10, dec: 0, k: true },
  ],
  spectral: [],
  dynamics: [
    // v0.8.3: Multiband 컴프만 on/off(섹션 전체 Bypass 와 별개). PARAMETERS 에서 Ratio 앞에 배치.
    { key: 'multiband', type: 'sw', label: 'Multiband' },
    { key: 'low', type: 'rot', label: 'Low', min: -18, max: 0, step: 0.1, dec: 1 },
    { key: 'mid', type: 'rot', label: 'Mid', min: -18, max: 0, step: 0.1, dec: 1 },
    { key: 'high', type: 'rot', label: 'High', min: -18, max: 0, step: 0.1, dec: 1 },
    { key: 'ratio', type: 'seg', label: 'Ratio', opts: ['2:1', '4:1', '8:1'] },
    { key: 'transient', type: 'rot', label: 'Transient', min: -50, max: 50, step: 1, dec: 0, signed: true },
    { key: 'exciter', type: 'rot', label: 'Exciter', min: 0, max: 100, step: 1, dec: 0 },
  ],
  stereo: [
    { key: 'width', type: 'rot', label: 'Width', min: 0, max: 200, step: 1, dec: 0 },
    { key: 'reverb', type: 'rot', label: 'Reverb', min: 0, max: 30, step: 1, dec: 0 },
    { key: 'delay', type: 'rot', label: 'Delay', min: 0, max: 30, step: 1, dec: 0 },
    { key: 'crossover', type: 'rot', label: 'Bass', min: 60, max: 300, step: 5, dec: 0 },
    { key: 'bassmono', type: 'sw', label: 'Bass Mono' },
    { key: 'mono', type: 'sw', label: 'Mono Master' },
  ],
  loudness: [
    { key: 'ceiling', type: 'rot', label: 'True Peak', min: -3, max: 0, step: 0.1, dec: 1, warnAbove: -1, warnArc: '#f6465d', warnVal: '#e0344b' },
    { key: 'target', type: 'rot', label: 'LUFS', min: -24, max: -6, step: 1, dec: 0, warnAbove: -14 },
    { key: 'sat', type: 'rot', label: 'Saturate', min: 0, max: 100, step: 1, dec: 0 },
    { key: 'limiter', type: 'seg', label: 'Limiter', opts: ['Clear', 'Punchy', 'Loud'] },
    { key: 'tplimit', type: 'sw', label: 'TP Limit' },
  ],
  export: [],
};

export type EqBand = { type: string; col: string; fmin: number; fmax: number; fstep: number };

export const EQBANDS: EqBand[] = [
  { type: 'L-Shelf', col: '#7cc4ff', fmin: 20, fmax: 240, fstep: 1 },
  { type: 'Bell', col: '#9ad29a', fmin: 80, fmax: 600, fstep: 2 },
  { type: 'Bell', col: '#e8d36a', fmin: 300, fmax: 3000, fstep: 10 },
  { type: 'Bell', col: '#e0a046', fmin: 2000, fmax: 9000, fstep: 20 },
  { type: 'H-Shelf', col: '#f06a6a', fmin: 6000, fmax: 20000, fstep: 50 },
];

export const EQPRESET_ORDER = ['Normal', 'Pop', 'Dance', 'Classic', 'User'];

export type EqPreset = { color: string; desc: string; f: number[]; g: number[]; q: number[] };

export const EQPRESETS: Record<string, EqPreset> = {
  Normal: { color: '#6f6657', desc: 'Flat reference', f: [60, 250, 1000, 4000, 12000], g: [0, 0, 0, 0, 0], q: [0.71, 1.0, 1.0, 1.2, 0.71] },
  Pop: { color: '#e0568f', desc: 'Bright vocal lift', f: [60, 250, 1200, 4000, 12000], g: [-3, -2, 2, 3, 3], q: [0.7, 1.2, 1.5, 1.8, 0.7] },
  Dance: { color: '#3fb6d6', desc: 'Big low & air', f: [35, 120, 400, 3000, 12000], g: [5, 3, -2, 3, 4], q: [0.7, 0.8, 1.5, 1.8, 0.7] },
  Classic: { color: '#c79a3f', desc: 'Warm & smooth', f: [40, 200, 800, 3000, 10000], g: [-2, 1, -1, 1, 2], q: [0.7, 1.0, 1.5, 2.0, 0.7] },
  User: { color: '#9a6fd0', desc: 'Your settings', f: [60, 250, 1000, 4000, 12000], g: [0, -3, 0, 1, 4], q: [0.71, 1.0, 1.0, 1.2, 0.71] },
};

export const UNITS: Record<string, string> = {
  'pre.denoiseAmt': '%', 'pre.fadein': 'ms', 'pre.fadeout': 'ms', 'pre.lufs': 'LUFS', 'pre.tp': 'dBTP',
  'dynamics.low': 'dB', 'dynamics.mid': 'dB', 'dynamics.high': 'dB', 'dynamics.transient': '%', 'dynamics.exciter': '%',
  'stereo.width': '%', 'stereo.reverb': '%', 'stereo.delay': '%', 'stereo.crossover': 'Hz',
  'loudness.ceiling': 'dB', 'loudness.target': 'LUFS', 'loudness.sat': '%',
};
for (let n = 0; n < 5; n++) UNITS['spectral.g' + n] = 'dB';

export type MetaDef = { key: string; type: 'text' | 'seg'; label: string; ph?: string; opts?: string[] };

export const META: MetaDef[] = [
  { key: 'album', type: 'text', label: 'Album title', ph: 'Untitled Master' },
  { key: 'artist', type: 'text', label: 'Artist / Composer', ph: '—' },
  { key: 'year', type: 'text', label: 'Year', ph: '2026' },
  { key: 'genre', type: 'text', label: 'Genre', ph: '—' },
  { key: 'format', type: 'seg', label: 'Format', opts: ['WAV', 'MP3 320', 'FLAC'] },
];

// v0.2.0(Phase 1): 표시용 파일 항목 타입. 실제 데이터는 store 의 큐(QueueFile)에서 채운다.
// (이전 v0.1.x 의 mock FILES 더미 7곡 + TOTAL_MB 는 실제 파일 로딩으로 대체되어 제거됨)
export type FileItem = { name: string; size: string; fmt: string; dur: string; sr: string; depth: string; ch: string; lufs: string };

export const MENUS: Record<string, [string, string][]> = {
  Project: [['New Session', '⌘N'], ['Open', '⌘O'], ['Save Session', '⌘S'], ['__div', ''], ['Import Files...', '⌘I'], ['Import Folder', ''], ['Quit', '⌘Q']],
  Edit: [['Undo', '⌘Z'], ['Redo', '⇧⌘Z'], ['__div', ''], ['Preference (Setup)', '⌘,']],
  Help: [['Manual', ''], ['__div', ''], ['Check for Updates...', ''], ['About', '']],
};

// 신호 흐름 리본 (좌→우 물결)
export function buildRibbon(): string {
  let d = 'M -20 ' + (110).toFixed(1);
  for (let x = 0; x <= 1228; x += 30) {
    d += ' L ' + x + ' ' + (106 + 12 * Math.sin(x / 100)).toFixed(1);
  }
  return d;
}
export const RIBBON = buildRibbon();

export type Vals = Record<string, number | string | boolean>;

export type DeskState = {
  open: number;
  curFile: number;
  openMenu: string | null;
  eqAdvanced: boolean;
  enabled: Record<ModId, boolean>;
  vals: Vals;
  lastActivePresetName?: string;
};

export const DEFAULT_STATE: DeskState = {
  open: 0,
  curFile: 0,
  openMenu: null,
  eqAdvanced: false,
  enabled: { input: true, pre: true, spectral: true, dynamics: true, stereo: true, loudness: true, export: true },
  lastActivePresetName: 'Normal',
  vals: {
    'input.source': 'Files', 'input.bit': '24', 'input.rate': '48k', 'input.scope': 'Sub Folder', 'input.normimp': false,
    'pre.denoise': false, 'pre.noiseDepth': '2', 'pre.denoiseAmt': 35, 'pre.fadein': 20, 'pre.fadeout': 600, 'pre.lufs': -14, 'pre.tp': -1, 'pre.rms': -12,
    'spectral.band': '2', 'spectral.preset': 'Normal',
    'spectral.f0': 60, 'spectral.g0': 0, 'spectral.q0': 0.71,
    'spectral.f1': 250, 'spectral.g1': 0, 'spectral.q1': 1.0,
    'spectral.f2': 1000, 'spectral.g2': 0, 'spectral.q2': 1.0,
    'spectral.f3': 4000, 'spectral.g3': 0, 'spectral.q3': 1.2,
    'spectral.f4': 12000, 'spectral.g4': 0, 'spectral.q4': 0.71,
    'dynamics.multiband': false, 'dynamics.low': -2, 'dynamics.mid': -1, 'dynamics.high': -1, 'dynamics.ratio': '4:1', 'dynamics.transient': 10, 'dynamics.exciter': 15,
    'stereo.width': 120, 'stereo.reverb': 8, 'stereo.delay': 5, 'stereo.crossover': 120, 'stereo.bassmono': true, 'stereo.mono': false,
    'loudness.ceiling': -1, 'loudness.target': -14, 'loudness.sat': 5, 'loudness.limiter': 'Punchy', 'loudness.tplimit': true,
    'export.album': '', 'export.artist': '', 'export.year': '', 'export.genre': '', 'export.format': 'WAV',
  },
};
