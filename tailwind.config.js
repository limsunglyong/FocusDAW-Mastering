/** @type {import('tailwindcss').Config} */
// FocusDAW Mastering Desk v0.1.0 (Phase 0)
// 테마는 런타임 CSS 변수(--t-*)로 주입(themes.ts/applyTheme). Tailwind는 그 변수를 색으로 노출만 한다.
const themeColor = (name) => `var(--t-${name})`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // accent
        'a-main': themeColor('aMain'),
        'a-bright': themeColor('aBright'),
        'a-glow': themeColor('aGlow'),
        'a-ink': themeColor('aInk'),
        // backgrounds / chrome
        page: themeColor('page'),
        frame: themeColor('frame'),
        'desk-a': themeColor('deskA'),
        'desk-b': themeColor('deskB'),
        // paper sheet / panels
        'paper-a': themeColor('paperA'),
        'paper-b': themeColor('paperB'),
        panel: themeColor('panel'),
        'panel-dark': themeColor('panelDark'),
        'paper-ctl': themeColor('paperCtl'),
        'paper-input': themeColor('paperInput'),
        notch: themeColor('notch'),
        // cards
        'card-a': themeColor('cardA'),
        'card-b': themeColor('cardB'),
        'card-sel-a': themeColor('cardSelA'),
        'card-sel-b': themeColor('cardSelB'),
        // ink / text on paper + panel
        'p-ink': themeColor('pInk'),
        'p-ink2': themeColor('pInk2'),
        'p-num': themeColor('pNum'),
        'p-seg': themeColor('pSeg'),
        'n-ink': themeColor('nInk'),
        'n-ink2': themeColor('nInk2'),
        // semantic warning colors — theme 무관 고정값
        'warn-red': '#d96a4e',
        'warn-amber': '#e8b04b',
        'ok-green': '#94c06a',
      },
      fontFamily: {
        ui: ['Archivo', 'system-ui', 'sans-serif'],
        serif: ['Spectral', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
