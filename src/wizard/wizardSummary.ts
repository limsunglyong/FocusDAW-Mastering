// FocusDAW Mastering Desk - Mastering Wizard 요약/제목 생성 (v0.13.0)
// 결과 카드의 "WIZARD 가 조정한 항목" 섹션 칩과 자동 세션 제목을 만든다(표시 전용).
// 디자인 출처: _refer/Mastering Wizard.standalone.html 의 buildSummary/autoTitle 이식.
import type { Lang, WizardAnswers } from './wizardModel';

export type SummaryRow = { roman: string; name: string; chips: string[] };

/** 결과 카드 제목(접두사 [Wizard] 고정 + 장르·무드·음량 요약). */
export function autoTitle(a: WizardAnswers, lang: Lang): string {
  const en = lang === 'en';
  const g = (en
    ? { pop: 'Pop', dance: 'Dance', rock: 'Rock', classic: 'Classical', hiphop: 'Hip-hop' }
    : { pop: '팝', dance: '댄스', rock: '록', classic: '클래식', hiphop: '힙합' })[a.genre];
  const m = (en
    ? { bright: 'Clear', warm: 'Warm', punchy: 'Punchy', smooth: 'Smooth' }
    : { bright: '선명함', warm: '따뜻함', punchy: '강렬함', smooth: '부드러움' })[a.mood];
  const l = (en
    ? { dynamic: 'Dynamic', balanced: 'Balanced', loud: 'Loud' }
    : { dynamic: '다이나믹', balanced: '균형', loud: '크게' })[a.loudness];
  return `[Wizard] ${g} · ${m} · ${l}`;
}

/** 섹션별 조정 요약(빈 항목은 자동 제거). */
export function buildSummary(a: WizardAnswers, lang: Lang): SummaryRow[] {
  const en = lang === 'en';
  const out = { streaming: { fmt: 'WAV', sr: '48k', bit: '24-bit' }, archive: { fmt: 'FLAC', sr: '44.1k', bit: '24-bit' }, video: { fmt: 'WAV', sr: '48k', bit: '24-bit' } }[a.output];
  const eqPreset = { pop: 'Pop', dance: 'Dance', rock: 'Classic', classic: 'Classic', hiphop: 'Dance' }[a.genre];
  const eqType = a.eqMode === 'graphic' ? '9-Band EQ' : 'Min-EQ';
  const moodEq = (en
    ? { bright: 'High +2.5dB', warm: 'Low-mid + / High −', punchy: null, smooth: 'Near flat' }
    : { bright: '고역 +2.5dB', warm: '저·중역 + / 고역 −', punchy: null, smooth: '거의 평탄' })[a.mood];
  const bassEq = (en
    ? { light: 'Low −', normal: null, thick: 'Low +' }
    : { light: '저역 −', normal: null, thick: '저역 +' })[a.bass];
  const ratio = { pop: '4:1', dance: '4:1', rock: '4:1', classic: '2:1', hiphop: '4:1' }[a.genre];
  const moodDyn = { bright: 'Exciter +10', warm: null, punchy: 'Transient +', smooth: 'Transient −' }[a.mood];
  const width = { dry: 'Width 100', subtle: 'Width 120', wide: 'Width 150' }[a.space];
  const reverb = { dry: 'Reverb 0', subtle: 'Reverb 5', wide: 'Reverb 12' }[a.space];
  const loud = { dynamic: ['-16 LUFS', 'Clear'], balanced: ['-14 LUFS', 'Punchy'], loud: ['-9 LUFS', 'Loud · TP -1'] }[a.loudness];
  const pre = (en
    ? { clean: 'Denoise off', slight: 'Denoise · Depth 2', noisy: 'Denoise · Depth 3' }
    : { clean: 'Denoise 꺼짐', slight: 'Denoise · Depth 2', noisy: 'Denoise · Depth 3' })[a.source];
  const norm = a.normalize === 'align' ? (en ? 'Normalize on' : 'Normalize 켜짐') : (en ? 'Normalize off' : 'Normalize 꺼짐');

  const clean = (arr: (string | null)[]): string[] => arr.filter((x): x is string => !!x);

  return [
    { roman: 'I', name: 'Input', chips: [out.fmt, out.sr, out.bit, norm] },
    { roman: 'II', name: 'Pre', chips: [pre] },
    { roman: 'III', name: 'Spectral EQ', chips: clean([eqType, eqPreset, moodEq, bassEq]) },
    { roman: 'IV', name: 'Dynamics', chips: clean([ratio, moodDyn]) },
    { roman: 'V', name: 'Stereo', chips: clean([width, reverb, a.bass === 'thick' ? 'Bass Mono' : null]) },
    { roman: 'VI', name: 'Loudness', chips: loud },
    { roman: 'VII', name: 'Export', chips: [out.fmt + (en ? ' output' : ' 출력')] },
  ];
}
