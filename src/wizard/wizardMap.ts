// FocusDAW Mastering Desk - Mastering Wizard 매핑 엔진 (v0.13.0)
// 마법사 응답(WizardAnswers) → 마스터링 체인 설정(SessionPayload) 순수 변환.
// 계층적 delta 방식: 장르가 베이스 프리셋을 정하고, 이후 단계가 그 위에 가감/확정을 누적한다.
// 우선순위(충돌 시): output > loudness > space/bass > mood > genre.
// 산출물은 기존 세션과 동일한 SessionPayload 이므로 applySession/sessionIO 로 그대로 적용·저장된다.
import { DEFAULT_STATE, EQPRESETS, type ModId, type Vals } from '../desk/data';
import { sanitizeSessionVals, type SessionPayload } from '../session/session';
import type { WizardAnswers } from './wizardModel';

// 장르 → 베이스 EQ 프리셋(Parametric 5밴드). rock/classic 은 Classic, hiphop 은 Dance 계열.
const GENRE_EQ: Record<WizardAnswers['genre'], keyof typeof EQPRESETS> = {
  pop: 'Pop', dance: 'Dance', rock: 'Classic', classic: 'Classic', hiphop: 'Dance',
};
// 장르 → 컴프 Ratio. 앱 옵션은 '2:1'|'4:1'|'8:1' 뿐이므로 그 범위로 매핑.
const GENRE_RATIO: Record<WizardAnswers['genre'], string> = {
  pop: '4:1', dance: '4:1', rock: '4:1', classic: '2:1', hiphop: '4:1',
};

/** 마법사 응답을 마스터링 체인 SessionPayload 로 변환한다(순수 함수). */
export function answersToPayload(a: WizardAnswers): SessionPayload {
  const v: Vals = { ...DEFAULT_STATE.vals };
  const num = (k: string): number => Number(v[k]) || 0;
  const add = (k: string, d: number) => { v[k] = Math.round((num(k) + d) * 100) / 100; };

  // ── I. Genre — 베이스 EQ 프리셋 + Ratio ───────────────────────────────
  const preset = GENRE_EQ[a.genre];
  const eq = EQPRESETS[preset];
  v['spectral.mode'] = 'Parametric';
  v['spectral.preset'] = preset;
  for (let n = 0; n < 5; n++) {
    v[`spectral.f${n}`] = eq.f[n];
    v[`spectral.g${n}`] = eq.g[n];
    v[`spectral.q${n}`] = eq.q[n];
  }
  v['dynamics.ratio'] = GENRE_RATIO[a.genre];

  // ── II. Mood — 색채/질감 delta ────────────────────────────────────────
  switch (a.mood) {
    case 'bright':
      add('spectral.g4', 2.5); // 고역 shelf(12k) ↑
      add('dynamics.exciter', 10);
      break;
    case 'warm':
      add('spectral.g0', 2); add('spectral.g1', 1.5); // 저·중역 ↑
      add('spectral.g4', -1.5);                        // 고역 살짝 ↓
      add('loudness.sat', 10);
      break;
    case 'punchy':
      add('dynamics.transient', 15);
      if (v['dynamics.ratio'] === '2:1') v['dynamics.ratio'] = '4:1';
      break;
    case 'smooth':
      add('dynamics.transient', -10);
      v['spectral.g3'] = Math.round(num('spectral.g3') * 0.5 * 100) / 100; // 존재감대 완화
      break;
  }

  // ── III. Bass — 저역 무게감 ───────────────────────────────────────────
  if (a.bass === 'light') {
    add('spectral.g0', -3);
    v['stereo.crossover'] = 90;
  } else if (a.bass === 'thick') {
    add('spectral.g0', 3);
    v['stereo.bassmono'] = true;
    v['stereo.crossover'] = 120;
  }

  // ── IV. Space — 스테레오 폭/잔향 ──────────────────────────────────────
  const SPACE = {
    dry: { width: 100, reverb: 0, delay: 0 },
    subtle: { width: 120, reverb: 5, delay: 2 },
    wide: { width: 150, reverb: 12, delay: 6 },
  }[a.space];
  v['stereo.width'] = SPACE.width;
  v['stereo.reverb'] = SPACE.reverb;
  v['stereo.delay'] = SPACE.delay;

  // ── V. Loudness — 목표 LUFS/리미터(확정형) ────────────────────────────
  const LOUD = {
    dynamic: { target: -16, limiter: 'Clear', sat: 5 },
    balanced: { target: -14, limiter: 'Punchy', sat: num('loudness.sat') },
    loud: { target: -9, limiter: 'Loud', sat: Math.max(8, num('loudness.sat')) },
  }[a.loudness];
  v['loudness.target'] = LOUD.target;
  v['loudness.limiter'] = LOUD.limiter;
  v['loudness.sat'] = LOUD.sat;
  v['loudness.ceiling'] = -1;
  v['loudness.tplimit'] = true;

  // ── VI. Source — Denoise 토글/Depth 힌트 ──────────────────────────────
  // 주: pre.noiseDepth 는 세션 화이트리스트에서 제외(곡별 분석 우선)라 저장 시 스트립된다.
  //     여기서는 토글(pre.denoise, 화이트리스트 포함)만 실질적으로 반영된다.
  if (a.source === 'clean') {
    v['pre.denoise'] = false;
  } else {
    v['pre.denoise'] = true;
    v['pre.noiseDepth'] = a.source === 'noisy' ? '3' : '2';
  }

  // ── VII. Output — 포맷/샘플레이트/비트뎁스 ────────────────────────────
  const OUT = {
    streaming: { format: 'WAV', rate: '48k', bit: '24' },
    archive: { format: 'FLAC', rate: '44.1k', bit: '24' },
    video: { format: 'WAV', rate: '48k', bit: '24' },
  }[a.output];
  v['export.format'] = OUT.format;
  v['input.rate'] = OUT.rate;
  v['input.bit'] = OUT.bit;

  const enabled: Record<ModId, boolean> = {
    input: true, pre: true, spectral: true, dynamics: true, stereo: true, loudness: true, export: true,
  };

  return {
    vals: sanitizeSessionVals(v),
    enabled,
    activeUserPresetIdx: -1,
    lastActivePresetName: preset,
    activeGraphicUserPresetIdx: -1,
    artworkDataUrl: null,
    exportDir: null,
  };
}
