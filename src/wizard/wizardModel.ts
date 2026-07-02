// FocusDAW Mastering Desk - Mastering Wizard 데이터 모델 (v0.13.0)
// 대화형 마법사 8단계(I~VIII)의 질문·선택지·요약 섹션·UI 문자열 정의.
// 디자인 출처: _refer/Mastering Wizard.standalone.html (DCLogic 프로토타입)을 앱 구조로 이식.
// 이 파일은 순수 데이터/타입만 담는다(오디오·DOM 의존 없음 → 매핑 로직과 함께 테스트 가능).

export type Lang = 'ko' | 'en';
export type Localized = { ko: string; en: string };

/** 각 단계의 응답 키와 허용값(내부 코드). UI 라벨은 STEPS.opts 에서 별도 관리. */
export type WizardAnswers = {
  genre: 'pop' | 'dance' | 'rock' | 'classic' | 'hiphop';
  eqMode: 'graphic' | 'minimal';
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

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] as const;

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
  eqMode: 'minimal',
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
      ko: '선택하신 장르에 맞춰 전체적인 기본 톤을 잡아 드려요. 세부 조정은 다음 질문들에서 이어집니다.',
      en: 'We set the overall base tone to match your genre. The next questions fine-tune it.',
    },
    cols: 1,
    opts: [
      { v: 'pop', icon: 'mic', t: { ko: '팝 · 보컬 위주', en: 'Pop · vocal-led' }, d: { ko: '목소리가 또렷하게, 전체적으로 균형 있게', en: 'Clear vocals, well balanced overall' } },
      { v: 'dance', icon: 'pulse', t: { ko: '댄스 · EDM', en: 'Dance · EDM' }, d: { ko: '저음이 힘 있고 시원하게 큰 음량으로', en: 'Powerful bass and a big, loud sound' } },
      { v: 'rock', icon: 'note', t: { ko: '밴드 · 록', en: 'Band · rock' }, d: { ko: '악기 하나하나가 살아있고 넓게 펼쳐지게', en: 'Every instrument alive, spread out wide' } },
      { v: 'classic', icon: 'strings', t: { ko: '클래식 · 재즈', en: 'Classical · jazz' }, d: { ko: '여리고 센 부분의 차이를 자연스럽게 살려서', en: 'Keeps the soft-to-loud swings natural' } },
      { v: 'hiphop', icon: 'boom', t: { ko: '힙합 · R&B', en: 'Hip-hop · R&B' }, d: { ko: '묵직한 저음과 선명한 존재감으로', en: 'Weighty low end with a clear presence' } },
    ],
  },
  {
    key: 'eqMode', roman: 'II', label: { ko: '이퀄라이저', en: 'Equalizer' },
    q: { ko: '저음, 중음, 고음 효과를 어떻게 할까요?', en: 'How should the lows, mids, and highs feel?' },
    sub: { ko: 'Equalizer의 종류를 고르는 것입니다.', en: 'Choose the type of equalizer to use.' },
    cols: 2,
    opts: [
      { v: 'graphic', icon: 'eq-knobs', t: { ko: '확실하게 느낄 수 있도록', en: 'Clearly noticeable' }, d: { ko: '9-Band EQ로 주파수별 효과를 분명하게 조정해요', en: 'Use 9-Band EQ for clearly shaped frequency ranges' } },
      { v: 'minimal', icon: 'eq-curve', t: { ko: '사실적이고 정밀하게', en: 'Natural and precise' }, d: { ko: 'Min-EQ로 자연스럽고 세밀하게 조정해요', en: 'Use Min-EQ for natural, precise adjustment' }, rec: true },
    ],
  },
  {
    key: 'mood', roman: 'III', label: { ko: '분위기', en: 'Mood' },
    q: { ko: '어떤 느낌이면 좋을까요?', en: 'What feeling do you want?' },
    sub: { ko: '곡 전체에 입혀질 색깔과 질감을 골라 주세요.', en: 'Pick the overall color and texture for the track.' },
    cols: 2,
    opts: [
      { v: 'bright', icon: 'sun', t: { ko: '밝고 청량하게', en: 'Bright & airy' }, d: { ko: '높은 소리를 살짝 올려 시원한 공기감을 더해요', en: 'Lifts the highs for a fresh, airy feel' } },
      { v: 'warm', icon: 'flame', t: { ko: '따뜻하고 포근하게', en: 'Warm & cozy' }, d: { ko: '중저음을 살려 부드럽고 풍부하게 만들어요', en: 'Fills out the low-mids, soft and rich' } },
      { v: 'punchy', icon: 'bolt', t: { ko: '힘 있고 단단하게', en: 'Bold & punchy' }, d: { ko: '치고 나오는 느낌을 강조해 에너지를 더해요', en: 'Emphasizes the hits for more energy' } },
      { v: 'smooth', icon: 'feather', t: { ko: '부드럽고 담백하게', en: 'Smooth & plain' }, d: { ko: '과하지 않게, 있는 그대로 자연스럽게', en: 'Nothing over the top, natural as-is' } },
    ],
  },
  {
    key: 'bass', roman: 'IV', label: { ko: '저음', en: 'Bass' },
    q: { ko: '저음은 얼마나 넣을까요?', en: 'How much bass would you like?' },
    sub: { ko: '쿵쿵 울리는 낮은 소리의 무게감을 정해요.', en: 'Sets the weight of the deep, rumbling low sounds.' },
    cols: 3,
    opts: [
      { v: 'light', icon: 'feather', t: { ko: '가볍게', en: 'Light' }, d: { ko: '저음을 덜어 산뜻하게', en: 'Trim the lows for a lighter sound' } },
      { v: 'normal', icon: 'target', t: { ko: '적당히', en: 'Just right' }, d: { ko: '가장 무난한 기본 밸런스', en: 'The safe, everyday balance' }, rec: true },
      { v: 'thick', icon: 'boom', t: { ko: '묵직하게', en: 'Heavy' }, d: { ko: '저음을 살려 꽉 찬 느낌으로', en: 'Boost the lows for a full sound' } },
    ],
  },
  {
    key: 'space', roman: 'V', label: { ko: '공간감', en: 'Space' },
    q: { ko: '소리가 얼마나 넓게 퍼지면 좋을까요?', en: 'How wide should the sound feel?' },
    sub: { ko: '소리가 좌우로 펼쳐지는 정도와 은은한 울림의 양이에요.', en: 'How far the sound spreads left-to-right, plus gentle ambience.' },
    cols: 3,
    opts: [
      { v: 'dry', icon: 'target', t: { ko: '또렷하게 가까이', en: 'Close & direct' }, d: { ko: '바로 앞에서 들리듯 선명하게', en: 'As if right in front of you' } },
      { v: 'subtle', icon: 'cloud', t: { ko: '살짝 여유롭게', en: 'A little roomy' }, d: { ko: '은은하게 공간이 느껴지는 정도', en: 'A gentle sense of space' }, rec: true },
      { v: 'wide', icon: 'pulse', t: { ko: '넓고 시원하게', en: 'Wide & open' }, d: { ko: '큰 무대처럼 좌우로 넓게', en: 'Spread wide, like a big stage' } },
    ],
  },
  {
    key: 'loudness', roman: 'VI', label: { ko: '음량', en: 'Loudness' },
    q: { ko: '얼마나 크게 들리길 원하세요?', en: 'How loud should it sound?' },
    sub: { ko: '전체적으로 느껴지는 소리 크기예요. 궁금하면 물음표를 눌러 보세요.', en: 'The overall perceived volume. Tap the ? if you are curious.' },
    cols: 3,
    opts: [
      { v: 'dynamic', icon: 'wave', t: { ko: '자연스럽게', en: 'Natural' }, d: { ko: '여리고 센 부분을 그대로 살려요', en: 'Keeps soft and loud parts as they are' } },
      { v: 'balanced', icon: 'target', t: { ko: '적당히 크게', en: 'Balanced' }, d: { ko: '대부분의 음악 서비스에 딱 맞는 크기', en: 'Just right for most music services' }, rec: true },
      { v: 'loud', icon: 'bolt', t: { ko: '아주 크게', en: 'Very loud' }, d: { ko: '어디서 들어도 시원하게 큰 소리로', en: 'Big and punchy wherever it plays' } },
    ],
  },
  {
    key: 'source', roman: 'VII', label: { ko: '원본 상태', en: 'Source' },
    q: { ko: '원본 녹음 상태는 어떤가요?', en: 'How clean is the original recording?' },
    sub: {
      ko: '배경 잡음이 있는지 알려 주시면 알맞게 정리해 드려요.',
      en: 'Tell us about background noise and we will clean it up.',
    },
    cols: 3,
    opts: [
      { v: 'clean', icon: 'sparkle', t: { ko: '깨끗해요', en: 'Clean' }, d: { ko: '따로 손댈 잡음이 없어요', en: 'No noise to remove' }, rec: true },
      { v: 'slight', icon: 'wave', t: { ko: '살짝 지직거려요', en: 'A little hiss' }, d: { ko: '약한 잡음을 부드럽게 줄여요', en: 'Gently reduces light noise' } },
      { v: 'noisy', icon: 'static', t: { ko: '잡음이 많아요', en: 'Quite noisy' }, d: { ko: '눈에 띄는 잡음을 확실히 정리해요', en: 'Clears up noticeable noise' } },
    ],
  },
  {
    key: 'output', roman: 'VIII', label: { ko: '용도', en: 'Use' },
    q: { ko: '완성한 파일을 어디에 쓰실 건가요?', en: 'Where will you use the finished file?' },
    sub: { ko: '쓰실 곳에 딱 맞는 형식으로 저장해 드려요.', en: 'We save it in the format that fits your destination.' },
    cols: 3,
    opts: [
      { v: 'streaming', icon: 'globe', t: { ko: '스트리밍 · 유튜브', en: 'Streaming · YouTube' }, d: { ko: '음악·영상 플랫폼 업로드용', en: 'For music and video platforms' }, rec: true },
      { v: 'archive', icon: 'disc', t: { ko: 'CD · 소장용', en: 'CD · archive' }, d: { ko: '고음질로 오래 보관하고 싶을 때', en: 'High quality to keep long-term' } },
      { v: 'video', icon: 'film', t: { ko: '영상 편집용', en: 'Video editing' }, d: { ko: '영상 편집 프로그램에 넣을 때', en: 'To drop into a video editor' } },
    ],
  },
];

export const WIZARD_UI = {
  wizard: { ko: 'Wizard', en: 'Wizard' },
  next: { ko: '다음', en: 'Next' },
  seeResult: { ko: '결과 보기', en: 'See result' },
  back: { ko: '이전', en: 'Back' },
  rec: { ko: '추천', en: 'Pick' },
  resultKicker: { ko: '다 됐어요! 이렇게 다듬어 드릴게요', en: 'All set — here is how we will polish it' },
  adjLabel: { ko: 'WIZARD 가 조정한 항목', en: 'WHAT THE WIZARD ADJUSTED' },
  abTitle: { ko: '들어보고 비교하기 · Before / After', en: 'Listen & compare · Before / After' },
  abNote: { ko: '미리듣기에는 잡음 제거가 빠져 있어요', en: 'Preview excludes noise removal' },
  loadLabel: { ko: '내 음악 불러오기', en: 'Load my music' },
  loadHint: { ko: '곡을 불러오면 다듬기 전과 후를 바로 비교할 수 있어요.', en: 'Load a track to compare before and after right away.' },
  aLbl: { ko: 'Before', en: 'Before' },
  bLbl: { ko: 'After', en: 'After' },
  reset: { ko: '처음부터', en: 'Start over' },
  apply: { ko: 'Desk 로 전송', en: 'Send to Desk' },
  save: { ko: '저장하기', en: 'Save' },
  applied: { ko: '메인 화면에 적용했어요 ✓', en: 'Applied to the main desk ✓' },
  saved: { ko: '세션으로 저장했어요 ✓', en: 'Saved as a session ✓' },
  saveFail: { ko: '저장 실패', en: 'Save failed' },
  decoding: { ko: '불러오는 중…', en: 'Loading…' },
  loadFail: { ko: '이 파일을 열 수 없습니다', en: 'Could not open this file' },
} as const;

/** Localized 또는 문자열을 현재 언어로 해석. */
export function L(o: Localized | string, lang: Lang): string {
  return typeof o === 'string' ? o : (o[lang] ?? o.ko);
}
