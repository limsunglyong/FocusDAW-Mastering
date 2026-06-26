// FocusDAW Mastering Desk v0.1.0 (Phase 0) - 8 색 테마 정의
// 출처: Mastering Desk Studio.standalone.html 의 THEMES (Teal/Sunset/Violet/Crimson + 각 Light).
// 토큰 구조: 액센트(aMain/aBright/aGlow/aInk) + 배경(desk/paper/panel/card) + 잉크(pInk/nInk 등).
// 경고색(빨강/노랑)은 테마와 무관한 고정값 → tailwind.config(warn-*)에서 별도 관리.

export type ThemeTokens = {
  // accent
  aMain: string;
  aBright: string;
  aGlow: string;
  aInk: string;
  // eq gradient / glow / ellipse
  eqA: string;
  eqB: string;
  glow: string;
  ell: string;
  // desk
  deskA: string;
  deskB: string;
  gA: string;
  gB: string;
  page: string;
  frame: string;
  // paper sheet / panels
  paperA: string;
  paperB: string;
  panel: string;
  panelDark: string;
  paperCtl: string;
  paperInput: string;
  notch: string;
  // cards
  cardA: string;
  cardB: string;
  cardSelA: string;
  cardSelB: string;
  // ink
  pInk: string;
  pInk2: string;
  pNum: string;
  pSeg: string;
  nInk: string;
  nInk2: string;
};

export type ThemeName =
  | 'Teal'
  | 'Sunset'
  | 'Violet'
  | 'Crimson'
  | 'Teal Light'
  | 'Sunset Light'
  | 'Violet Light'
  | 'Crimson Light';

export const THEMES: Record<ThemeName, ThemeTokens> = {
  Teal: {
    aMain: '#16a394', aBright: '#3fd6c2', aGlow: '#baf6ec', aInk: '#0c2b27',
    eqA: 'rgba(22,163,148,0.38)', eqB: 'rgba(22,163,148,0)', glow: 'rgba(63,214,194,0.3)', ell: 'rgba(22,163,148,0.16)',
    deskA: '#1c2128', deskB: '#11151a', gA: 'rgba(232,180,90,0.2)', gB: 'rgba(232,180,90,0.03)', page: '#0c0f12', frame: '#15191e',
    paperA: '#f3ecdd', paperB: '#e9e0cd', panel: '#2a2620', panelDark: '#1c1a15', paperCtl: '#ddd2bb', paperInput: '#f7f1e5', notch: '#efe7d6',
    cardA: '#e7ddca', cardB: '#d9cfb8', cardSelA: '#fbf6ea', cardSelB: '#efe6d3',
    pInk: '#2a2620', pInk2: '#6f6657', pNum: '#3a342b', pSeg: '#5a5347', nInk: '#e3dccc', nInk2: '#9a8f7a',
  },
  Sunset: {
    aMain: '#cf7d2c', aBright: '#f2a948', aGlow: '#ffe2ad', aInk: '#2c1804',
    eqA: 'rgba(207,125,44,0.38)', eqB: 'rgba(207,125,44,0)', glow: 'rgba(242,169,72,0.34)', ell: 'rgba(207,125,44,0.18)',
    deskA: '#241a12', deskB: '#140d08', gA: 'rgba(242,169,72,0.22)', gB: 'rgba(242,169,72,0.04)', page: '#0d0906', frame: '#1a120b',
    paperA: '#f6efdf', paperB: '#ece0c8', panel: '#2b2017', panelDark: '#1e1610', paperCtl: '#e0d2b4', paperInput: '#faf3e4', notch: '#f3e9d2',
    cardA: '#ece0c8', cardB: '#ddccab', cardSelA: '#fdf7e9', cardSelB: '#f2e7cf',
    pInk: '#2a2620', pInk2: '#6f6657', pNum: '#3a342b', pSeg: '#5a5347', nInk: '#e3dccc', nInk2: '#9a8f7a',
  },
  Violet: {
    aMain: '#8b51c4', aBright: '#c081ec', aGlow: '#eccaff', aInk: '#1d0a2c',
    eqA: 'rgba(139,81,196,0.38)', eqB: 'rgba(139,81,196,0)', glow: 'rgba(192,129,236,0.34)', ell: 'rgba(139,81,196,0.18)',
    deskA: '#1c1a26', deskB: '#100e18', gA: 'rgba(192,129,236,0.18)', gB: 'rgba(192,129,236,0.03)', page: '#0b0a10', frame: '#16131e',
    paperA: '#ece8f0', paperB: '#ddd6e6', panel: '#272231', panelDark: '#1a1722', paperCtl: '#d6cee2', paperInput: '#f6f3fa', notch: '#ece4f4',
    cardA: '#ddd6e6', cardB: '#cdc4da', cardSelA: '#f5f1fa', cardSelB: '#e7e0f0',
    pInk: '#2a2620', pInk2: '#6f6657', pNum: '#3a342b', pSeg: '#5a5347', nInk: '#e3dccc', nInk2: '#9a8f7a',
  },
  Crimson: {
    aMain: '#c23a52', aBright: '#f06a82', aGlow: '#ffc9d3', aInk: '#2b0a12',
    eqA: 'rgba(194,58,82,0.38)', eqB: 'rgba(194,58,82,0)', glow: 'rgba(240,106,130,0.32)', ell: 'rgba(194,58,82,0.18)',
    deskA: '#241419', deskB: '#140a0d', gA: 'rgba(240,106,130,0.18)', gB: 'rgba(240,106,130,0.03)', page: '#0f0809', frame: '#1b1013',
    paperA: '#f5e8ea', paperB: '#e9d6da', panel: '#2b1c20', panelDark: '#1e1316', paperCtl: '#e0cace', paperInput: '#fbf0f1', notch: '#f4e2e5',
    cardA: '#e9d6da', cardB: '#dcc3c9', cardSelA: '#fcf0f2', cardSelB: '#f2dee2',
    pInk: '#2a2620', pInk2: '#6f6657', pNum: '#3a342b', pSeg: '#5a5347', nInk: '#e3dccc', nInk2: '#9a8f7a',
  },
  'Teal Light': {
    aMain: '#0f8a7d', aBright: '#13a596', aGlow: '#6fd9cb', aInk: '#eafbf7',
    eqA: 'rgba(15,138,125,0.34)', eqB: 'rgba(15,138,125,0)', glow: 'rgba(15,138,125,0.3)', ell: 'rgba(15,138,125,0.18)',
    deskA: '#dde2e6', deskB: '#c8d0d6', gA: 'rgba(15,138,125,0.12)', gB: 'rgba(15,138,125,0.02)', page: '#eef1f3', frame: '#e6eaed',
    paperA: '#26221b', paperB: '#1c1914', panel: '#efe7d6', panelDark: '#e0d6c0', paperCtl: '#39342a', paperInput: '#2e2a22', notch: '#26221b',
    cardA: '#2a261e', cardB: '#201c15', cardSelA: '#322c22', cardSelB: '#272219',
    pInk: '#f2ede1', pInk2: '#b3a890', pNum: '#7d7361', pSeg: '#d8cdb6', nInk: '#2a2620', nInk2: '#6f6657',
  },
  'Sunset Light': {
    aMain: '#bf6d1f', aBright: '#d98a2e', aGlow: '#f0bd6e', aInk: '#fdf3e4',
    eqA: 'rgba(191,109,31,0.34)', eqB: 'rgba(191,109,31,0)', glow: 'rgba(191,109,31,0.3)', ell: 'rgba(191,109,31,0.18)',
    deskA: '#ece3d4', deskB: '#ddd0bb', gA: 'rgba(191,109,31,0.14)', gB: 'rgba(191,109,31,0.03)', page: '#f6efe2', frame: '#efe6d6',
    paperA: '#241a12', paperB: '#1a1109', panel: '#f6efdf', panelDark: '#e9dcc2', paperCtl: '#3a2c1d', paperInput: '#2e2114', notch: '#241a12',
    cardA: '#281d14', cardB: '#1f160d', cardSelA: '#312418', cardSelB: '#261c12',
    pInk: '#f6efdf', pInk2: '#c2b495', pNum: '#857458', pSeg: '#ddccab', nInk: '#241a12', nInk2: '#6f6657',
  },
  'Violet Light': {
    aMain: '#7a3fb3', aBright: '#9457cc', aGlow: '#c79be8', aInk: '#f5effb',
    eqA: 'rgba(122,63,179,0.34)', eqB: 'rgba(122,63,179,0)', glow: 'rgba(122,63,179,0.3)', ell: 'rgba(122,63,179,0.18)',
    deskA: '#e3e0ea', deskB: '#d0cadc', gA: 'rgba(122,63,179,0.12)', gB: 'rgba(122,63,179,0.02)', page: '#efedf4', frame: '#e7e3ee',
    paperA: '#1c1a26', paperB: '#13111c', panel: '#ece8f0', panelDark: '#dad3e4', paperCtl: '#322d3d', paperInput: '#272231', notch: '#1c1a26',
    cardA: '#211e2c', cardB: '#181522', cardSelA: '#282336', cardSelB: '#1e1a28',
    pInk: '#ece8f0', pInk2: '#b0a8c0', pNum: '#7a7090', pSeg: '#cdc4da', nInk: '#1c1a26', nInk2: '#6f6657',
  },
  'Crimson Light': {
    aMain: '#b02f47', aBright: '#cf4862', aGlow: '#ec8298', aInk: '#fcedef',
    eqA: 'rgba(176,47,71,0.34)', eqB: 'rgba(176,47,71,0)', glow: 'rgba(176,47,71,0.3)', ell: 'rgba(176,47,71,0.18)',
    deskA: '#ece2e4', deskB: '#ddc9ce', gA: 'rgba(176,47,71,0.12)', gB: 'rgba(176,47,71,0.02)', page: '#f4edee', frame: '#ece2e4',
    paperA: '#241419', paperB: '#190d10', panel: '#f5e8ea', panelDark: '#e6d2d6', paperCtl: '#3a2a2e', paperInput: '#2e1c20', notch: '#241419',
    cardA: '#281a1e', cardB: '#1f1316', cardSelA: '#312226', cardSelB: '#26181c',
    pInk: '#f5e8ea', pInk2: '#c0a8ad', pNum: '#8a7076', pSeg: '#dcc3c9', nInk: '#241419', nInk2: '#6f6657',
  },
};

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];
export const DEFAULT_THEME: ThemeName = 'Teal';

/** 테마 토큰을 :root 의 CSS 변수(--t-<token>)로 주입. tailwind.config 의 색이 이를 참조한다. */
export function applyTheme(name: ThemeName): void {
  const tokens = THEMES[name];
  const root = document.documentElement;
  (Object.keys(tokens) as (keyof ThemeTokens)[]).forEach((key) => {
    root.style.setProperty(`--t-${key}`, tokens[key]);
  });
  root.dataset.theme = name;
}
