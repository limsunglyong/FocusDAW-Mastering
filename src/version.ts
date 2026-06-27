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
 *  - v0.2.11: (Phase 1 Patch) 하단 Transport 패널(#2) — Top bar Transport 메뉴로 접이식 펼침.
 *             웨이브폼(클릭 탐색)·Rewind/Play·Pause/Forward(±5s)·모니터 볼륨(영속 master gain,
 *             Export 미반영)·rAF 재생헤드. 엔진에 master gain/setVolume/seek 추가.
 *  - v0.2.12: (Phase 1 Patch) A4 Transport 보완 — 패널 펼침 시 윈도우 높이를 패널만큼 키워 기존
 *             항목 높이 유지(win:height-delta IPC). 메뉴 Transport(F4)+F4 단축키. 현재시간 폰트 2배·
 *             상태색(재생=하이라이트+breathing/일시정지=하이라이트/정지=normal), 전체길이 1.5배·이탤릭.
 *             볼륨 슬라이더 둥근 pill+라운드사각 thumb. range 포커스에서도 Space play/pause 동작.
 *  - v0.2.13: (Phase 1 Patch) A4 Transport 보완2 — 창 가로폭 누적 축소 버그 수정(상대 setBounds→
 *             기준값 절대 setSize, `win:transport`). VOL 옆 스피커 버튼(클릭 mute, 이전 볼륨 복원).
 *             볼륨 슬라이더 높이 증가(14→20px). 현재시간 폰트 bold→normal.
 *  - v0.2.14: (Phase 1 Patch) Transport 창 크기 안정화 — 처음부터 native resizable로 생성하되
 *             will-resize로 사용자 리사이즈 차단. 최초 실제 outer size를 기준으로 폭은 고정하고
 *             높이만 ±132px 변경. Windows 125% DPI 누적 드리프트 제거.
 *             Transport roll-in 애니메이션 추가.
 *  - v0.2.15: (Phase 1 Patch) Transport UI 보완 — 시간 표시 Orbitron 폰트, play 고정 highlight/
 *             pause breathing, 웨이브폼 중앙 PAUSE 점멸, 패널 접힘 시 Footer 상단 테마형 진행 막대.
 *  - v0.2.16: (Phase 1 Patch) Transport UI 보완2 — PAUSE를 Archivo·고정 붉은색·테마 어두운
 *             50% 오버레이로 변경. 시간 숫자 영역 고정폭/tabular 정렬. 접힌 진행바 선두 8px를
 *             밝은 테마색과 추가 glow로 강조.
 *  - v0.2.17: (Phase 1 Patch) Transport UI 보완3 — 시간 폰트를 Audiowide로 교체. PAUSE의
 *             테마 어두운 50% 배경을 중앙 배지에만 적용하고 붉은 글자만 점멸하도록 분리.
 *  - v0.2.18: (Phase 1 Patch) Transport UI 보완4 — 현재 시간은 Segoe UI 계열 weight 300+
 *             tabular 숫자, 전체 길이는 전역 `--mono` 스택으로 변경(크기 유지). PAUSE 글자는
 *             breathing 없이 완전한 ON/OFF 점멸로 변경.
 *  - v0.2.19: (Phase 1 Patch) 재생 중 현재 시간에 테마 accent 기반 고정 네온 glow 추가.
 *             Pause breathing과 Stop 기본 표시는 기존 동작 유지.
 *  - v0.2.20: (Phase 1 Patch) 웨이브폼에 저채도 중앙 수평선과 시간 구분선 추가. 기본 5초,
 *             긴 곡은 픽셀 밀도에 따라 10/15/30/60/120초로 자동 확장하며 30초선은 소폭 강조.
 *             현재 재생 시간 glow 강도 축소.
 *  - v0.2.21: (Phase 1 Patch) 웨이브폼 드래그 A/B 구간 선택 + REPEAT 토글. Web Audio
 *             source.loop/loopStart/loopEnd를 기존 Play/Pause/Seek 경로에 통합하고 파일 변경 시 초기화.
 *  - v0.2.22: (Phase 1 Patch) 반복 구간 설정 시 웨이브폼 우측 상단 × 버튼 표시. 클릭하면
 *             재생을 끊지 않고 REPEAT 해제 후 선택 구간을 초기화.
 *  - v0.2.23: (Phase 1 Patch) 반복 구간 삭제 × 버튼을 고정 우측 상단에서 B 지점 경계 상단으로
 *             이동. 양쪽 끝에서는 CSS clamp로 버튼이 웨이브폼 밖으로 잘리지 않도록 제한.
 */
export const APP_NAME = 'FocusDAW - Mastering Desk';
export const APP_VERSION = __APP_VERSION__;
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
