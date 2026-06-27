/**
 * FocusDAW - Mastering Desk - 전역 앱 버전 상수
 *
 * 버전 출처(Single Source of Truth): **package.json 의 version**.
 * 빌드 시 vite.config 의 define 으로 `__APP_VERSION__` 에 주입되어 여기서 그대로 노출한다.
 * → 버전 변경은 package.json 한 곳만 수정(또는 `npm version patch`). electron-builder/updater 와도 일치.
 *
 * 버전 규칙: v{Major}.{Minor}.{Patch}  (참고: A2. 앱개발.md 지침)
 *  - Major : 사용자 선택 사항
 *  - Minor : A1. 개발-프로세스.md 의 phase 별 버전 규칙을 따름 (Phase 0 = v0.1.x, Phase 1 = v0.2.x ...)
 *  - Patch : 버그 수정 / 기존 기능 개선 / 개발 phase가 바뀌지 않는 수정 전부
 *
 * 변경 이력
 *  - v0.1.0 : Phase 0 프로젝트 셋업 (Vite+React+TS+Tailwind+Zustand, Electron borderless 셸,
 *             8테마 시스템, dc.html 데스크 레이아웃 React 셸 이식)
 *  - v0.1.1 : (Phase 0) UI를 원본(standalone.html) 그대로 충실 이식 — 7섹션 시각화/노브/세그먼트/스위치,
 *             EQ 그래프·프리셋, 파일 큐, 메뉴, 영문 라벨·폰트·색상·인터랙션 일치
 *  - v0.1.2 : (Phase 0) 앱 버전을 package.json 단일 출처로 일원화(빌드 시 __APP_VERSION__ 주입)
 *  - v0.1.3 : (Phase 1 착수) mock 파일 큐 제거 → 실제 오디오 파일 로딩·디코딩·메타 표시.
 *             드래그&드롭/Import, 배치 큐(추가·선택·제거), NOW SELECTED/칩 실데이터 바인딩.
 *             (오디오 엔진 그래프·Preview 재생 연결은 후속 → Phase 1 완료 시 v0.2.0)
 *  - v0.1.4 : (Phase 1) A4 수정요청 반영 — 폴더 D&D(디렉터리 재귀), Preview 버튼 3칸 그리드 중앙 고정,
 *             미지원 파일 에러 표시, 중앙 로딩 오버레이(진행 카운트), BATCH QUEUE 영역 확대,
 *             Working folder 실제 경로(Electron File.path), Top bar 선택 파일 정보 표시.
 *  - v0.1.5 : (Phase 1) A4 2차 수정요청 — Glass+원형회전 로딩 카드, Working folder 경로 수정
 *             (File.path 제거 → webUtils.getPathForFile, 최상단 파일 기준), BATCH QUEUE 전체삭제
 *             버튼+확인 모달, 앱 메시지 영어화.
 *  - v0.1.6 : (Phase 1) Input 섹션 LUFS = 원본 파일 실측값으로 표시. ITU-R BS.1770-4 기반
 *             Integrated LUFS 측정(K-weighting + 400ms/75% 게이팅) 구현(loudness.ts), 디코딩 시 산출.
 *             (Loudness 섹션 VI 의 LUFS 는 사용자 설정 목표값으로 별개)
 *  - v0.1.7 : (Phase 1) 보완 — 로딩 원형 링 두께 50%↓(4→2px), 원본 LUFS > -9 LUFS 시
 *             NOW SELECTED 칩을 진한 노란색(#d4a017)으로 경고 표시.
 *  - v0.2.0 : Phase 1 완료 — 선택 파일 Preview 재생/정지, 기본 7단계 직렬 Web Audio 체인,
 *             EQ/간단 dynamics/stereo/loudness 파라미터 연결, 노브 더블클릭 기본값 리셋.
 *  - v0.2.1 : (Phase 1 Patch) 트랜스포트 좌측 Play 버튼을 원본 재생/일시정지로 연결,
 *             Space 키 토글 및 play/pause 아이콘 상태 반영.
 *  - v0.2.2 : (Phase 1 Patch) sourceBuffer/processingBuffer 분리, 사용자 Input Rate 기준
 *             lazy resampling, Rate 변경 시 processingBuffer 무효화.
 *  - v0.2.3 : (Phase 1 Patch) 재생 중 Input Rate 변경 시 로딩 오버레이 표시,
 *             processingBuffer 리샘플링 후 중단 지점부터 자동 재개.
 *  - v0.2.4 : (Phase 1 Patch) 원본 재생 중 파일 선택 변경 시 사용자가 pause하기 전까지
 *             새 선택 파일을 자동 재생하도록 transport 의도 유지.
 *  - v0.2.5 : (Phase 1 Patch) 중앙 Preview를 별도 play/stop이 아닌 효과 모니터 ON/OFF
 *             토글로 전환. 좌측 Play/Space가 dry/effect 통합 transport를 담당.
 *  - v0.2.6 : (Phase 1 Patch) 섹션별 dry/wet bypass 구조 — 모든 섹션 DSP를 항상 빌드하고
 *             dry/wet 병렬+sum 으로 감싸, 재생 중 섹션 On/Bypass·노브 변경을 source 재생성 없이
 *             gain/AudioParam crossfade 로 반영.
 *  - v0.2.7 : (Phase 1 Patch) 곡 종료 시 transport 상태 미복귀 버그 수정 — onended 콜백을
 *             stopGraph 전에 캡처. 종료 시 정지+위치 0 리셋+Play 아이콘 복귀.
 *  - v0.2.8 : (Phase 1 Patch) 파일 lazy 로딩 — import 시 헤더만 파싱해 리스트 즉시 표시,
 *             백그라운드로 곡별 디코딩→LUFS 측정→해제(메모리 일정), 선택 파일은 우선 디코딩.
 *             원본 버퍼는 현재 파일만 유지(LRU=1)하도록 ensureSourceBuffer 도입.
 *  - v0.2.9 : (Phase 1 Patch) A4 수정요청 — 백그라운드 디코딩 중 BATCH QUEUE 옆 [Decoding…]
 *             숨쉬기(네온) 표시. Input 의 Recursive 스위치를 Root/Sub Folder 세그먼트로 바꾸고
 *             실제 폴더 스캔 깊이(Root=최상위만 / Sub Folder=하위 포함)에 연결.
 *  - v0.2.10: (Phase 1 Patch) 세그먼트 선택 버튼(Source/PCM/Rate 등 CTRL seg) Y높이 약 80% 축소
 *             (세로 패딩 6→4px). VII Export 의 Format 세그먼트는 별도 스타일이라 제외.
 */
export const APP_NAME = 'FocusDAW - Mastering Desk';
export const APP_VERSION = __APP_VERSION__;
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
