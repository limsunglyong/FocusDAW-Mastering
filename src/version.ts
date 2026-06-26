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
 */
export const APP_NAME = 'FocusDAW - Mastering Desk';
export const APP_VERSION = __APP_VERSION__;
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
