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
 */
export const APP_NAME = 'FocusDAW - Mastering Desk';
export const APP_VERSION = __APP_VERSION__;
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
