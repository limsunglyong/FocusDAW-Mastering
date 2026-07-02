# Mastering Wizard — 계획 및 설계 제안서

> FocusDAW Mastering Desk 에 "대화형 마스터링 마법사" 를 추가하기 위한 설계 제안.
> 전문 지식이 없는 사용자가 **일상 언어 선택지**만으로 7개 섹션(I~VII)의 세팅을 자동 구성하고,
> 결과를 세션 카드로 저장한 뒤 실제 곡에서 On/Off 비교 청취까지 이어지는 흐름을 목표로 한다.

작성일: 2026-07-02 · 대상 버전: v0.13.0 (제안)

> **확정된 설계 결정(2026-07-02)**
> 1. **A/B 청취**: Wizard 창 **내장** A/B 트랜스포트로 구현한다(메인 창 경유 아님).
> 2. **적용**: 결과 카드에 **"메인에 즉시 적용"** 버튼을 별도로 둔다(저장과 분리).

---

## 1. 목적과 배경

### 1.1 문제
현재 앱은 7개 섹션(Input · Pre · Spectral EQ · Dynamics · Stereo · Loudness · Export)의
노브·세그먼트·스위치를 **직접** 조작해야 한다. 이는 마스터링 개념(LUFS, True Peak, Q, Transient,
Bass Mono…)에 익숙한 사용자에게는 강력하지만, 입문자에게는 진입 장벽이 높다.

### 1.2 해결
"**어떤 장르인가?**", "**어떤 느낌을 원하나?**" 같은 **비전문 대화형 질문 7단계**를 통해
사용자의 의도를 수집하고, 이를 각 섹션의 구체적 파라미터(`vals`) + 활성/Bypass(`enabled`)로
자동 변환한다. 사용자는 숫자를 몰라도 결과물을 얻고, 필요하면 이후 수동으로 미세 조정할 수 있다.

### 1.3 설계 원칙
- **기존 자산 재사용**: 새로운 오디오 엔진을 만들지 않는다. Wizard 는 결국 `SessionPayload`
  (기존 세션과 동일한 직렬화 단위)를 생성할 뿐이며, 적용·저장·프리뷰는 이미 존재하는
  `applySession()` / `sessionIO` / `previewEngine` 을 그대로 탄다.
- **비파괴적**: Wizard 는 사용자가 명시적으로 "적용/저장" 하기 전까지 현재 작업 상태를 바꾸지 않는다.
- **투명성**: 마지막 카드에서 Wizard 가 무엇을 바꿨는지 요약을 보여준다(블랙박스 금지).
- **일관된 창 패턴**: 기존 자식 창(SessionsWindow, RenderBatchWindow)과 동일한 borderless
  BrowserWindow + `#hash` 라우팅 방식을 따른다.

---

## 2. 사용자 경험(UX) 흐름

```
[메인] Project ▸ New with Wizard…  (또는 툴바 ✨ 버튼)
        │
        ▼
┌─────────────────────────────────────────────┐
│  별도 창(#wizard) 오픈                         │
│                                               │
│  Step I   장르가 뭔가요?          ● ○ ○ ○     │
│  Step II  어떤 느낌을 원하세요?    → 진행바      │
│  Step III 저음은 어느 정도로?                   │
│  Step IV  공간감/잔향은?                        │
│  Step V   음량감(크기)은?                       │
│  Step VI  원본 상태는 어떤가요?                  │
│  Step VII 어디에 쓸 파일인가요?                  │
│                                               │
│  [ ← 이전 ]              [ 다음 → ]            │
└─────────────────────────────────────────────┘
        │  (각 단계는 카드형 선택지 2~4개, 아이콘+한 줄 설명)
        ▼
┌─────────────────────────────────────────────┐
│  요약 카드 (Result Card)                       │
│  ─ 제목:  [Wizard] Pop · 따뜻함 · 크게          │  ← 편집 가능
│  ─ Wizard 가 조정한 항목 요약(섹션별 배지)        │
│  ┌──── 창 내장 A/B 트랜스포트 ─────────────┐   │
│  │  [ 음악 불러오기 ]                       │   │
│  │  ⏮ ▶/⏸  ──●───────  0:42 / 3:15         │   │
│  │  [ A: 원본 ]  ⇄  [ B: Wizard 적용 ]      │   │  ← 실시간 크로스페이드
│  └─────────────────────────────────────────┘   │
│                                               │
│  [ 다시 설정 ]  [ 메인에 즉시 적용 ]  [ 저장 ] │
└─────────────────────────────────────────────┘
        │
        ├─ 저장          → userData/sessions/<id>.json (이름 접두사 "[Wizard]")
        └─ 메인에 즉시 적용 → IPC → 메인창 applySession(payload)  (저장과 독립)
```

### 2.1 진입점
- **메뉴**: `Project ▸ New with Wizard…` (기존 `MENUS.Project` 배열에 항목 추가)
- **툴바/빈 상태**: 파일 큐가 비어있을 때 중앙 Empty State 에 "✨ 마법사로 시작하기" CTA
- 두 경우 모두 `window.focusdaw.win.openWizard()` IPC 호출 → `#wizard` 창 오픈

### 2.2 단계 이동 규칙
- 각 단계는 **단일 선택(라디오)** 을 기본으로 하되, IV(공간감)·VI(원본상태)처럼 복합 항목은
  향후 다중선택 확장 여지를 남긴다.
- 모든 단계에 **합리적 기본 선택**을 미리 하이라이트해 두어(예: 장르=Pop, 음량=균형),
  사용자가 "다음"만 눌러도 무난한 결과가 나오게 한다("Enter 연타 friendly").
- 진행 상태는 상단 스텝 인디케이터(I~VII 로마숫자, 앱의 `ROMAN` 상수 재사용)로 표시.

---

## 3. 질문 설계 (I ~ VII)

각 단계의 선택지는 **일상 언어**로 제시하고, 내부적으로 하나의 `WizardAnswers` 키에 매핑된다.
아래 "파라미터 영향" 은 실제 `vals` 키(= `desk/data.ts` 의 `CTRL`/`DEFAULT_STATE`)를 가리킨다.

> 표기: `섹션.키` 는 `vals` 의 실제 키. `enabled.섹션` 은 섹션 Bypass 여부.

### Step I — 장르 (`genre`)
> "이 곡은 어떤 스타일인가요?"

| 선택지 | 주요 영향 |
|---|---|
| 🎤 팝 / 보컬 | EQ preset=`Pop`, `loudness.target`≈-11, `dynamics.ratio`=4:1 |
| 🔊 댄스 / EDM | EQ preset=`Dance`, 저음 강조, `loudness.target`≈-9, limiter=`Loud` |
| 🎸 밴드 / 록 | EQ=`Classic` 계열, `dynamics.transient`↑, `stereo.width`≈130 |
| 🎻 클래식 / 재즈 | EQ=`Classic`, `loudness.target`≈-16(다이나믹 보존), sat 낮음 |
| 🎧 힙합 / R&B | 저음 강조, `dynamics.exciter`↑, `loudness.target`≈-10 |

장르는 **베이스 프리셋**을 정하고, 이후 단계(II~V)가 그 위에 **가감(delta)** 을 적용한다.

### Step II — 느낌/무드 (`mood`)
> "어떤 인상을 주고 싶나요?"

| 선택지 | 주요 영향 |
|---|---|
| ☀️ 밝고 선명하게 | 고역 shelf(EQ 밴드4) +2~3dB, `dynamics.exciter` +10 |
| 🔥 따뜻하고 풍부하게 | 저·중역 +, 고역 살짝 −, `loudness.sat` +10 |
| 💥 강렬하고 단단하게 | `dynamics.transient` +, ratio↑, `loudness.limiter`=Punchy/Loud |
| 🕊️ 부드럽고 자연스럽게 | EQ 평탄에 근접, transient/exciter 낮게 |

### Step III — 저음 (`bass`)
> "저음은 어느 정도가 좋을까요?"

| 선택지 | 주요 영향 |
|---|---|
| 얇게 / 가볍게 | 저역 shelf −, `stereo.crossover` 낮게 |
| 보통 | 변화 없음 (기본) |
| 두껍게 / 묵직하게 | 저역 shelf +, `stereo.bassmono`=on, `stereo.crossover`≈120 |

### Step IV — 공간감 / 잔향 (`space`)
> "소리의 공간감은?"

| 선택지 | 주요 영향 |
|---|---|
| 🎯 드라이 / 바로 앞에서 | `stereo.reverb`=0, `stereo.delay`=0, `stereo.width`≈100 |
| 🌤️ 살짝 여유롭게 | `stereo.reverb`≈5, `stereo.delay`≈2, `stereo.width`≈120 |
| 🌌 넓고 공간감 있게 | `stereo.reverb`≈12, `stereo.delay`≈6, `stereo.width`≈150 |

### Step V — 음량감 (`loudness`)
> "얼마나 크게 들리길 원하세요?"

| 선택지 | 주요 영향 |
|---|---|
| 🎚️ 다이나믹 살리기 | `loudness.target`≈-16, limiter=Clear, sat 낮음 |
| ⚖️ 균형 (권장) | `loudness.target`≈-14, limiter=Punchy |
| 📢 크고 강하게(스트리밍) | `loudness.target`≈-9~-10, limiter=Loud, `loudness.tplimit`=on, ceiling=-1 |

> ⚠️ True Peak/과도 라우드니스 경고(`warnAbove`)는 기존 노브 로직을 그대로 활용.

### Step VI — 원본 상태 (`source`)
> "원본 녹음 상태는 어떤가요?"

| 선택지 | 주요 영향 |
|---|---|
| ✨ 깨끗함 | `pre.denoise`=off |
| 🌫️ 약간 지직/히스 | `pre.denoise`=on, `pre.noiseDepth`=2 (실제 값은 곡별 STFT 추천이 우선) |
| 📻 많이 노이즈 | `pre.denoise`=on, `pre.noiseDepth`=3 |

> Denoise 의 세부 강도(`noiseDepth`/`denoiseAmt`)는 **곡별 분석값이 우선**이므로
> Wizard 는 토글과 depth 힌트만 설정한다(세션 저장 정책과 동일 — `session.ts` VAL_BLOCKLIST 참고).

### Step VII — 출력 / 용도 (`output`)
> "완성된 파일을 어디에 쓸 건가요?"

| 선택지 | 주요 영향 |
|---|---|
| 🌐 스트리밍/유튜브 업로드 | `export.format`=MP3 또는 WAV, `input.rate`=48k, `input.bit`=24 |
| 💿 CD / 고음질 보관 | `export.format`=FLAC/WAV, `input.rate`=44.1k, `input.bit`=24 |
| 🎬 영상 편집용 | `export.format`=WAV, `input.rate`=48k |

---

## 4. 매핑 엔진 설계 (핵심)

Wizard 의 두뇌는 **순수 함수** 하나다. 오디오/DOM 의존 없이 테스트 가능해야 한다.

```
src/wizard/
  wizardModel.ts     // WizardAnswers 타입, 단계 정의(STEPS), 선택지 메타
  wizardMap.ts       // answers → SessionPayload  (순수 함수, 핵심)
  wizardSummary.ts   // payload → 사람이 읽는 요약/제목 생성
```

### 4.1 타입

```ts
// wizardModel.ts
export type WizardAnswers = {
  genre:    'pop' | 'dance' | 'rock' | 'classic' | 'hiphop';
  mood:     'bright' | 'warm' | 'punchy' | 'smooth';
  bass:     'light' | 'normal' | 'thick';
  space:    'dry' | 'subtle' | 'wide';
  loudness: 'dynamic' | 'balanced' | 'loud';
  source:   'clean' | 'slight' | 'noisy';
  output:   'streaming' | 'archive' | 'video';
};
```

### 4.2 매핑 함수 (계층적 delta 방식)

```ts
// wizardMap.ts
import { DEFAULT_STATE } from '../desk/data';
import type { SessionPayload } from '../session/session';

export function answersToPayload(a: WizardAnswers): SessionPayload {
  // 1) DEFAULT_STATE.vals 를 베이스로 clone
  // 2) genre 로 베이스 프리셋(EQ/Dynamics/Loudness) 세팅
  // 3) mood → bass → space → loudness → source → output 순서로 delta 누적 적용
  //    (뒤 단계가 앞 단계를 덮어쓰는 우선순위 규칙을 명시)
  // 4) enabled: 기본 전부 on. source=clean 이면 pre.denoise=off 지만 섹션은 유지.
  // 5) session.ts 의 sanitizeSessionVals() 통과 → 화이트리스트 키만 보존
}
```

**우선순위 규칙**(충돌 시): `output` > `loudness` > `space`/`bass` > `mood` > `genre`.
즉 세부 의도가 장르 기본값을 이긴다. 각 delta 는 **절대값 세팅이 아닌 가감**을 기본으로 하되,
`loudness.target`·`export.format` 등 "선택형" 값은 마지막 우세 단계가 확정한다.

### 4.3 왜 SessionPayload 를 만드는가
`SessionPayload` 는 이미 앱 전체의 "마스터링 설정 1건" 직렬화 단위다(`session.ts`).
Wizard 결과를 이 타입으로 산출하면:
- **적용**: 기존 `useAppStore.applySession(payload)` 를 그대로 호출 → 메인 창 반영
- **저장**: 기존 `sessionIO.save()` 경로 재사용 (아래 6장)
- **프리뷰**: 적용 후 기존 `previewEngine`/`togglePreview` 로 A/B
새 배관을 만들 필요가 없다.

---

## 5. 화면·창 설계

### 5.1 창 생성 (기존 패턴 복제)
`electron/main.cjs` 에 `renderBatchWindow`/`sessionsWindow` 와 동일 구조로 추가:

- `let wizardWindow = null;`
- `ipcMain.on('win:open-wizard', …)` → borderless BrowserWindow 생성
- dev: `loadURL(DEV_SERVER_URL + '#wizard')` / prod: `loadFile(..., { hash: 'wizard' })`
- `preload.cjs` 에 `openWizard: (opts) => ipcRenderer.send('win:open-wizard', opts)` 추가
- `src/App.tsx` 라우팅에 `isWizard = hash === '#wizard'` 분기 → `<WizardWindow />` 렌더
- `src/ui/desk/WizardWindow.tsx` 신규 (SessionsWindow 의 테마 구독/닫기 로직 재사용)

### 5.2 WizardWindow 내부 상태
```ts
const [step, setStep] = useState(0);            // 0..6 (I~VII)
const [answers, setAnswers] = useState<Partial<WizardAnswers>>(defaults);
const [phase, setPhase] = useState<'quiz' | 'result'>('quiz');
```
`phase==='result'` 에서 `answersToPayload(answers)` 로 payload 계산 → 카드 렌더.

### 5.3 결과 카드 & 창 내장 A/B 트랜스포트  ✅(확정: 창 내장 방식)
카드는 `SessionsWindow` 의 요약(`summaryFromPayload()`)을 재사용하고, 그 아래에
**Wizard 창 자체의 미니 트랜스포트**를 둔다. 메인 창을 거치지 않고 여기서 바로 비교 청취한다.

- **음악 불러오기**: 카드의 버튼 → 파일 선택 → Wizard 창이 **직접** 디코딩/리샘플.
- **A(원본) ⇄ B(Wizard 적용)**: 토글/슬라이더로 `previewEngine.setPreviewEnabled()` 호출.
  이 엔진은 이미 **하나의 재생 위에서 dry(원본)/wet(효과) 를 gain 크로스페이드**로 A/B 하도록
  설계돼 있으므로([previewEngine.ts](src/audio/previewEngine.ts) 의 dryGain/wetGain), 재생을 끊지 않고
  즉시 비교된다. B 는 곧 `payload.vals`+`enabled` 로 구성한 마스터 체인 출력이다.
- 재생/일시정지/시크/볼륨은 `previewEngine.play/pause/seek/setVolume` 를 그대로 사용.

#### ⚠️ 렌더러 격리 — 반드시 반영할 기술 포인트
`previewEngine` 은 **모듈 싱글톤이며 자신의 AudioContext 를 소유**한다. Electron 에서 각
BrowserWindow(`#wizard` 창)는 **독립 렌더러**이므로, Wizard 창은 메인 창과 **분리된**
`previewEngine` 인스턴스/AudioContext 를 갖는다(오디오 충돌 없음). 대신 메인 창의 Zustand
스토어·디코딩된 버퍼·파일 큐를 **공유하지 않는다**. 따라서 Wizard 창은 A/B 를 위해 스스로:

1. 파일을 디코딩한다 — `src/audio/decoder.ts` (순수 렌더러 모듈, 창 무관하게 import 가능)
2. 선택 Rate 로 리샘플한다 — `src/audio/resample.ts`
3. `PreviewParams = { vals: payload.vals, enabled: payload.enabled, meta }` 를 만들어
   `previewEngine.play(buffer, params, onEnded)` 호출, `setPreviewEnabled()` 로 A/B.

즉 Wizard 창은 **미니 재생 파이프라인을 자체 보유**한다(메인 스토어 미의존). 이는 창 내장 A/B의
비용이지만, 데이터 흐름이 단순·독립적이라는 이점도 크다.

**Denoise 미리듣기 범위**: `buildMasterChain` 의 실시간 체인에는 denoise 가 포함되지 않는다
(denoise 는 재생 전 STFT 버퍼 변환 — [denoise.ts](src/audio/denoise.ts)/워커). 창 내장 A/B 1차
구현은 **denoise 를 제외한 마스터 체인**만 비교하고(토글 값은 payload 에 저장됨), denoise 반영
프리뷰는 STFT 워커까지 끌어오는 2차 과제로 분리한다. 카드에 "미리듣기는 Denoise 제외" 안내 표기.

### 5.4 "메인에 즉시 적용" 버튼  ✅(확정: 저장과 분리)
결과 카드에 **저장(Save)** 과 **독립된** "메인에 즉시 적용" 버튼을 둔다(비파괴 원칙 — 사용자가
명시적으로 누를 때만 메인 상태 변경).

- 동작: Wizard 창 → `window.focusdaw.win.applyToMain(payload)` (신규 IPC) →
  `main.cjs` 가 메인 창 webContents 로 `session:apply` 전송 →
  메인 `App.tsx` 의 기존 구독([App.tsx:140](src/App.tsx#L140) `sessionIO.onApply`)이 받아
  `useAppStore.getState().applySession(payload)` 실행.
- 즉 **기존 세션 적용 릴레이 채널을 그대로 재사용**한다(신규 렌더 로직 최소화).
- 적용 후 토스트("메인 데스크에 적용됨")로 피드백. 저장 여부와 무관하게 동작.
- 저장 vs 적용은 독립: 저장만(디스크), 적용만(현재 세션), 둘 다 모두 가능.

### 5.5 제목 자동 생성
`wizardSummary.ts` 가 answers 로 제목을 생성. 접두사 **`[Wizard]`** 고정 + 요약:
```
[Wizard] {장르} · {무드} · {음량}      예) "[Wizard] 팝 · 따뜻함 · 크게"
```
사용자는 카드에서 이 제목을 자유롭게 편집 가능(접두사도 편집 허용하되 기본 유지 권장).

---

## 6. 저장 (세션 인프라 재사용)

Wizard 결과는 **기존 세션 저장 경로를 그대로** 탄다. 별도 저장소를 만들지 않는다.

- `SessionFile` 로 저장: `{ id, name: "[Wizard] …", description, savedAt, appVersion, payload }`
- 저장 위치: `userData/sessions/<id>.json` (기존 `main.cjs` 의 `sessionsDir()`)
- IPC: `window.focusdaw.sessionIO.save(...)` 재사용
- **구분 방법**: 이름 접두사 `[Wizard]` 로 세션 목록에서 시각적 식별.
  (선택) `SessionFile` 에 `origin?: 'wizard'` optional 필드를 추가하면 카드에 ✨ 배지 표시 가능 —
  구형 세션과 호환되도록 optional 로.

이로써 Wizard 세션은 `SessionsWindow` 의 Load 목록에도 자연히 함께 노출되어
언제든 다시 불러올 수 있다.

---

## 7. 데이터 흐름 요약

```
WizardWindow (answers)
   │ answersToPayload()            [순수 함수, 유닛 테스트 대상]
   ▼
SessionPayload  ──sanitizeSessionVals()──►  검증된 payload
   │                                   │
   │ (적용)                             │ (저장)
   ▼                                   ▼
IPC → 메인창 applySession(payload)     sessionIO.save({name:"[Wizard]…", payload})
   │                                   → userData/sessions/*.json
   ▼
previewEngine On/Off  → 실제 곡에서 A/B 비교 청취
```

---

## 8. 구현 단계 (Phase)

| Phase | 내용 | 산출물 |
|---|---|---|
| **P0** | 모델·매핑 순수 로직 | `wizard/wizardModel.ts`, `wizardMap.ts`, `wizardSummary.ts` + 유닛 테스트 |
| **P1** | 창 배관 | `main.cjs`/`preload.cjs`/`App.tsx` 라우팅, 빈 `WizardWindow` 오픈 |
| **P2** | 퀴즈 UI | Step I~VII 카드 선택지, 진행 인디케이터, 기본 선택 |
| **P3** | 결과 카드 + 저장 + 적용 | 요약 카드, 제목 편집, `[Wizard]` 저장, **"메인에 즉시 적용"**(IPC) |
| **P4** | 창 내장 A/B | Wizard 창 자체 디코딩/리샘플 + `previewEngine` dry/wet A/B 트랜스포트 |
| **P5** | 다듬기 | denoise 반영 프리뷰(2차), 다중선택 확장, ✨ 배지, 접근성/키보드, 릴리즈 노트 |

**P0 를 먼저 확정**하는 것이 핵심 — 매핑 규칙(선택지 → 파라미터)이 제품 품질을 좌우하며,
UI 없이도 "이 조합이면 어떤 세팅이 나오는가" 를 검증할 수 있다.

---

## 9. 리스크 & 결정 필요 사항

1. **매핑 값 튜닝**: 표의 수치(≈)는 초안이다. 실제 음원으로 A/B 하며 청감 튜닝 필요.
   → P0 에서 값을 상수 테이블로 분리해 조정 비용을 낮춘다.
2. **delta vs 절대값**: 단계 간 가감 누적이 예측 어려운 조합을 만들 수 있음.
   → 우선순위 규칙(4.2) 문서화 + 결과 카드에 최종값 요약 노출로 투명성 확보.
3. ~~**A/B 청취 범위**~~ → **확정**: Wizard 창 내장 A/B. 비용은 창 자체 디코딩/재생
   파이프라인(5.3), denoise 미리듣기는 2차로 분리.
4. ~~**적용 시점**~~ → **확정**: "메인에 즉시 적용" 버튼을 저장과 분리 제공(5.4).
5. **denoise 세부값**: Wizard 는 토글/depth 힌트만. 실제 강도는 곡별 STFT 추천이 우선(기존 정책 유지).
6. **창 내장 재생의 메모리**: Wizard 창이 디코딩 버퍼를 자체 보유 → 창 닫힘 시 컨텍스트/버퍼를
   확실히 해제(`previewEngine.stop()` + AudioContext close)하도록 라이프사이클 관리.

---

## 10. 재사용하는 기존 자산 (요약)

| 자산 | 위치 | Wizard 에서의 역할 |
|---|---|---|
| `SessionPayload` / `sanitizeSessionVals` | `src/session/session.ts` | Wizard 결과의 직렬화 단위 |
| `applySession(payload)` + `onApply` 릴레이 | `src/store/appStore.ts`, `App.tsx:140` | "메인에 즉시 적용" 채널 재사용 |
| `sessionIO.save/list/read` | `electron/main.cjs`, `preload.cjs` | `[Wizard]` 세션 저장/재로딩 |
| 자식 창 패턴(borderless + `#hash`) | `main.cjs`, `App.tsx` | `#wizard` 창 오픈/라우팅 |
| `previewEngine`(dry/wet A/B) | `src/audio/previewEngine.ts` | 창 내장 A/B(원본⇄적용) |
| `decoder` / `resample` | `src/audio/decoder.ts`, `resample.ts` | Wizard 창 자체 디코딩 파이프라인 |
| `summaryFromPayload` 카드 UI | `src/ui/desk/SessionsWindow.tsx` | 결과 카드 렌더 |
| `ROMAN`, `MODS`, `CTRL`, `DEFAULT_STATE`, `EQPRESETS` | `src/desk/data.ts` | 스텝 표기·매핑 소스 |

---

## 부록 A — 신규/수정 파일 목록

**신규**
- `src/wizard/wizardModel.ts` — WizardAnswers, STEPS 정의
- `src/wizard/wizardMap.ts` — `answersToPayload()` (핵심 순수 함수)
- `src/wizard/wizardSummary.ts` — 제목/요약 생성
- `src/ui/desk/WizardWindow.tsx` — 마법사 창 컴포넌트

**수정**
- `electron/main.cjs` — `wizardWindow` 생성 + `win:open-wizard` IPC + **`win:apply-to-main`**(payload 릴레이)
- `electron/preload.cjs` — `openWizard` / **`applyToMain`** 브릿지
- `src/App.tsx` — `#wizard` 라우팅 분기 (`onApply` 구독은 기존 재사용)
- `src/desk/data.ts` — `MENUS.Project` 에 "New with Wizard…" 항목
- (선택) `src/session/session.ts` — `SessionFile.origin?: 'wizard'` optional 필드

> WizardWindow 는 A/B 를 위해 `decoder`/`resample`/`previewEngine` 을 직접 import 하여
> **자체 재생 파이프라인**을 구성한다(메인 Zustand 스토어 미의존, 5.3 참고).
