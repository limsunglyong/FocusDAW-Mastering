// FocusDAW Mastering Desk - Mastering Wizard 데이터 모델 (v0.13.0)
// 대화형 마법사 7단계(I~VII)의 질문·선택지·요약 섹션·UI 문자열 정의.
// 디자인 출처: _refer/Mastering Wizard.standalone.html (DCLogic 프로토타입)을 앱 구조로 이식.
// 이 파일은 순수 데이터/타입만 담는다(오디오·DOM 의존 없음 → 매핑 로직과 함께 테스트 가능).

export type Lang = 'ko' | 'en';
export type Localized = { ko: string; en: string };

/** 각 단계의 응답 키와 허용값(내부 코드). UI 라벨은 STEPS.opts 에서 별도 관리. */
export type WizardAnswers = {
  genre: 'pop' | 'dance' | 'rock' | 'classic' | 'hiphop';
  mood: 'bright' | 'warm' | 'punchy' | 'smooth';
  bass: 'light' | 'normal' | 'thick';
  space: 'dry' | 'subtle' | 'wide';
  loudness: 'dynamic' | 'balanced' | 'loud';
  source: 'clean' | 'slight' | 'noisy';
  output: 'streaming' | 'archive' | 'video';
};

export type StepKey = keyof WizardAnswers;

export type WizardOption = {
  /** 내부 응답값(WizardAnswers[key] 에 저장). */
  v: string;
  /** WizardIcons 스프라이트의 심볼 id 접미사(#wz-<icon>). */
  icon: string;
  t: Localized;
  d: Localized;
  /** 권장(기본) 선택지 — "Rec." 배지 표시. */
  rec?: boolean;
};

export type WizardStep = {
  key: StepKey;
  roman: string;
  label: Localized;
  q: Localized;
  sub: Localized;
  /** 선택지 그리드 열 수(1=세로 리스트, 2·3=그리드). */
  cols: number;
  opts: WizardOption[];
};

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

/** 마법사가 조정하는 7개 섹션(요약 카드 행 순서 = 신호 흐름). */
export const WIZARD_SECTIONS: { roman: string; name: string }[] = [
  { roman: 'I', name: 'Input' },
  { roman: 'II', name: 'Pre' },
  { roman: 'III', name: 'Spectral EQ' },
  { roman: 'IV', name: 'Dynamics' },
  { roman: 'V', name: 'Stereo' },
  { roman: 'VI', name: 'Loudness' },
  { roman: 'VII', name: 'Export' },
];

export const DEFAULT_ANSWERS: WizardAnswers = {
  genre: 'pop',
  mood: 'warm',
  bass: 'normal',
  space: 'subtle',
  loudness: 'balanced',
  source: 'clean',
  output: 'streaming',
};

export const STEPS: WizardStep[] = [
  {
    key: 'genre', roman: 'I', label: { ko: '장르', en: 'Genre' },
    q: { ko: '이 곡은 어떤 스타일인가요?', en: 'What style is this track?' },
    sub: {
      ko: '선택한 장르가 전체 세팅의 기본 프리셋을 정합니다. 이후 단계에서 세부 조정이 더해집니다.',
      en: 'Your genre choice sets the base preset for everything. Later steps fine-tune it.',
    },
    cols: 1,
    opts: [
      { v: 'pop', icon: 'mic', t: { ko: '팝 / 보컬', en: 'Pop / Vocal' }, d: { ko: '보컬 중심, 균형 잡힌 밝기와 존재감', en: 'Vocal-forward, balanced brightness and presence' } },
      { v: 'dance', icon: 'pulse', t: { ko: '댄스 / EDM', en: 'Dance / EDM' }, d: { ko: '강한 저음과 큰 음량, 단단한 리미팅', en: 'Strong bass and high loudness, tight limiting' } },
      { v: 'rock', icon: 'note', t: { ko: '밴드 / 록', en: 'Band / Rock' }, d: { ko: '또렷한 트랜지언트와 넓은 스테레오', en: 'Crisp transients and wide stereo' } },
      { v: 'classic', icon: 'strings', t: { ko: '클래식 / 재즈', en: 'Classical / Jazz' }, d: { ko: '다이나믹 보존, 자연스러운 톤', en: 'Preserves dynamics, natural tone' } },
      { v: 'hiphop', icon: 'boom', t: { ko: '힙합 / R&B', en: 'Hip-hop / R&B' }, d: { ko: '묵직한 저음과 선명한 존재감', en: 'Weighty low end and clear presence' } },
    ],
  },
  {
    key: 'mood', roman: 'II', label: { ko: '무드', en: 'Mood' },
    q: { ko: '어떤 인상을 주고 싶나요?', en: 'What impression do you want?' },
    sub: { ko: '전체적인 색채와 질감을 결정합니다.', en: 'Sets the overall color and texture.' },
    cols: 2,
    opts: [
      { v: 'bright', icon: 'sun', t: { ko: '밝고 선명하게', en: 'Bright & clear' }, d: { ko: '고역을 살짝 끌어올려 공기감을 더합니다', en: 'Lifts the highs for more air' } },
      { v: 'warm', icon: 'flame', t: { ko: '따뜻하고 풍부하게', en: 'Warm & rich' }, d: { ko: '저·중역을 살리고 새츄레이션을 더합니다', en: 'Boosts low-mids and adds saturation' } },
      { v: 'punchy', icon: 'bolt', t: { ko: '강렬하고 단단하게', en: 'Bold & punchy' }, d: { ko: '트랜지언트를 강조해 힘 있게 만듭니다', en: 'Emphasizes transients for power' } },
      { v: 'smooth', icon: 'feather', t: { ko: '부드럽고 자연스럽게', en: 'Smooth & natural' }, d: { ko: '평탄에 가깝게, 자극을 줄입니다', en: 'Close to flat, less aggressive' } },
    ],
  },
  {
    key: 'bass', roman: 'III', label: { ko: '저음', en: 'Bass' },
    q: { ko: '저음은 어느 정도가 좋을까요?', en: 'How much bass do you want?' },
    sub: { ko: '저역대의 무게감과 베이스 모노 처리에 반영됩니다.', en: 'Affects low-end weight and bass-mono handling.' },
    cols: 3,
    opts: [
      { v: 'light', icon: 'feather', t: { ko: '얇게 / 가볍게', en: 'Light' }, d: { ko: '저역을 덜어 가볍게', en: 'Trim the lows' } },
      { v: 'normal', icon: 'target', t: { ko: '보통', en: 'Normal' }, d: { ko: '기본값 유지', en: 'Keep defaults' }, rec: true },
      { v: 'thick', icon: 'boom', t: { ko: '두껍게 / 묵직하게', en: 'Thick & heavy' }, d: { ko: '저역 강조 · 베이스 모노', en: 'Boost lows · bass mono' } },
    ],
  },
  {
    key: 'space', roman: 'IV', label: { ko: '공간감', en: 'Space' },
    q: { ko: '소리의 공간감은 어떻게 할까요?', en: 'How much space in the sound?' },
    sub: { ko: '스테레오 폭과 잔향/딜레이의 양을 정합니다.', en: 'Sets stereo width and the amount of reverb/delay.' },
    cols: 3,
    opts: [
      { v: 'dry', icon: 'target', t: { ko: '드라이 / 바로 앞', en: 'Dry / up front' }, d: { ko: '잔향 없이 · Width 100', en: 'No reverb · Width 100' } },
      { v: 'subtle', icon: 'cloud', t: { ko: '살짝 여유롭게', en: 'Slightly roomy' }, d: { ko: '은은한 공간 · Width 120', en: 'Gentle space · Width 120' }, rec: true },
      { v: 'wide', icon: 'pulse', t: { ko: '넓고 공간감 있게', en: 'Wide & spacious' }, d: { ko: '넓은 무대 · Width 150', en: 'Big stage · Width 150' } },
    ],
  },
  {
    key: 'loudness', roman: 'V', label: { ko: '음량감', en: 'Loudness' },
    q: { ko: '얼마나 크게 들리길 원하세요?', en: 'How loud should it sound?' },
    sub: { ko: '목표 라우드니스(LUFS)와 리미터 성격을 정합니다.', en: 'Sets the target loudness (LUFS) and limiter character.' },
    cols: 3,
    opts: [
      { v: 'dynamic', icon: 'wave', t: { ko: '다이나믹 살리기', en: 'Keep dynamics' }, d: { ko: '-16 LUFS · Clear', en: '-16 LUFS · Clear' } },
      { v: 'balanced', icon: 'target', t: { ko: '균형', en: 'Balanced' }, d: { ko: '-14 LUFS · Punchy', en: '-14 LUFS · Punchy' }, rec: true },
      { v: 'loud', icon: 'bolt', t: { ko: '크고 강하게', en: 'Loud & strong' }, d: { ko: '-9 LUFS · Loud · 스트리밍', en: '-9 LUFS · Loud · streaming' } },
    ],
  },
  {
    key: 'source', roman: 'VI', label: { ko: '원본 상태', en: 'Source' },
    q: { ko: '원본 녹음 상태는 어떤가요?', en: 'How is the original recording?' },
    sub: {
      ko: '디노이즈 토글과 강도 힌트에 반영됩니다. 실제 강도는 곡별 분석이 우선합니다.',
      en: 'Sets the denoise toggle and strength hint. Actual strength defers to per-track analysis.',
    },
    cols: 3,
    opts: [
      { v: 'clean', icon: 'sparkle', t: { ko: '깨끗함', en: 'Clean' }, d: { ko: '디노이즈 꺼짐', en: 'Denoise off' }, rec: true },
      { v: 'slight', icon: 'wave', t: { ko: '약간 지직 / 히스', en: 'Slight hiss' }, d: { ko: '디노이즈 · Depth 2', en: 'Denoise · Depth 2' } },
      { v: 'noisy', icon: 'static', t: { ko: '많이 노이즈', en: 'Noisy' }, d: { ko: '디노이즈 · Depth 3', en: 'Denoise · Depth 3' } },
    ],
  },
  {
    key: 'output', roman: 'VII', label: { ko: '출력 / 용도', en: 'Output' },
    q: { ko: '완성된 파일을 어디에 쓸 건가요?', en: 'Where will the file be used?' },
    sub: { ko: '샘플레이트·비트뎁스·포맷을 목적에 맞게 설정합니다.', en: 'Sets sample rate, bit depth and format for the target.' },
    cols: 3,
    opts: [
      { v: 'streaming', icon: 'globe', t: { ko: '스트리밍 / 유튜브', en: 'Streaming / YouTube' }, d: { ko: 'WAV · 48k · 24-bit', en: 'WAV · 48k · 24-bit' }, rec: true },
      { v: 'archive', icon: 'disc', t: { ko: 'CD / 고음질 보관', en: 'CD / hi-res archive' }, d: { ko: 'FLAC · 44.1k · 24-bit', en: 'FLAC · 44.1k · 24-bit' } },
      { v: 'video', icon: 'film', t: { ko: '영상 편집용', en: 'Video editing' }, d: { ko: 'WAV · 48k · 24-bit', en: 'WAV · 48k · 24-bit' } },
    ],
  },
];

export const WIZARD_UI = {
  wizard: { ko: 'Wizard', en: 'Wizard' },
  next: { ko: '다음 →', en: 'Next →' },
  seeResult: { ko: '결과 보기 →', en: 'See result →' },
  back: { ko: '← 이전', en: '← Back' },
  rec: { ko: '권장', en: 'Rec.' },
  resultKicker: { ko: '마법사 결과 · 세션 카드', en: 'Wizard result · session card' },
  adjLabel: { ko: 'WIZARD 가 조정한 항목', en: 'WHAT THE WIZARD ADJUSTED' },
  abTitle: { ko: '비교 청취 · A/B 트랜스포트', en: 'Compare · A/B transport' },
  abNote: { ko: '미리듣기는 Denoise 제외', en: 'Preview excludes denoise' },
  loadLabel: { ko: '음악 불러오기', en: 'Load music' },
  loadHint: { ko: '곡을 불러와 원본과 마법사 결과를 즉시 비교하세요.', en: 'Load a track to A/B the original against the wizard result.' },
  aLbl: { ko: 'A · 원본', en: 'A · Original' },
  bLbl: { ko: 'B · Wizard', en: 'B · Wizard' },
  reset: { ko: '다시 설정', en: 'Start over' },
  apply: { ko: '메인에 즉시 적용', en: 'Apply to main' },
  save: { ko: '저장', en: 'Save' },
  applied: { ko: '메인 데스크에 적용됨', en: 'Applied to main desk' },
  saved: { ko: '세션으로 저장됨 · [Wizard]', en: 'Saved as session · [Wizard]' },
  saveFail: { ko: '저장 실패', en: 'Save failed' },
  decoding: { ko: '불러오는 중…', en: 'Loading…' },
  loadFail: { ko: '이 파일을 열 수 없습니다', en: 'Could not open this file' },
} as const;

/** Localized 또는 문자열을 현재 언어로 해석. */
export function L(o: Localized | string, lang: Lang): string {
  return typeof o === 'string' ? o : (o[lang] ?? o.ko);
}
