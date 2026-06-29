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
 *  - v0.4.0 : Phase 3 EQ 작업 착수 및 프리셋 변경 개시.
 *  - v0.4.1 : (Patch) 앱 아이콘을 assets/logo-main.png 로 등록 (package.json의 build.win.icon 설정 및 electron/main.cjs 창 생성 icon 옵션 적용).
 *  - v0.4.2 : (Patch) 앱 아이콘 이미지를 assets/logo-main2.png 로 변경.
 *  - v0.5.0 : Phase 4 Dynamics — 단일 컴프 → Linkwitz-Riley 3밴드 멀티밴드 컴프(Low/Mid/High,
 *             Ratio 2/4/8) + 트랜지언트(밴드별 어택/릴리즈 변조) + 익사이터(고역 추출→하모닉 블렌드).
 *             섹션 dry/wet bypass·실시간 AudioParam 갱신 구조 유지. (Linear/Dynamic EQ 모드는
 *             v0.4 범위 제외 확정.) 트랜지언트는 Preview 근사이며 정밀 셰이퍼/Export 정밀화는 후속.
 *  - v0.6.0 : Phase 5 Stereo — Width(M/S Side 게인) 위에 Bass Mono(Side 고역통과), Reverb/Delay
 *             병렬 send, Mono Compatibility(모노 합 모니터, 기본 OFF) 추가. 최종 mix L/R 상관도·
 *             모노 폴드로스를 AnalyserNode 로 실측해 Correlation 미터에 상시 표시(재생 중 실측,
 *             정지 시 width 추정 폴백). 순수 매핑/상관도는 stereo.ts 로 분리해 단위 시험.
 *  - v0.6.1 : (Phase 5 Patch) Correlation 미터 정지 시 마지막 실측값 유지(freeze). 기존에는 정지 시
 *             실측 null → width 추정식으로 폴백되어 값이 고정 표시되던 혼란을 해소(재생 전에만 추정 폴백).
 *  - v0.6.2 : (Phase 5 Patch) 'Mono Compatibility' → 'Mono Master' 로 명칭 변경. 청취 전용 모니터가
 *             아니라 실제 모노 마스터 출력 토글로 정의(Export 반영, 기본 OFF). 사용자 결정(2026-06-28).
 *  - v0.7.0 : Phase 6 Loudness/Limiter — True Peak 룩어헤드 리미터를 AudioWorklet(lookahead-limiter,
 *             Blob 로드)으로 구현. 처리 순서 LUFS make-up 게인 → Saturation → TP 리미팅(최종) 확정.
 *             리미터: 룩어헤드 윈도우 최소 desired 게인 선행 더킹(브릭월, 오버슈트 없음), 캐릭터별
 *             릴리즈(Clear/Punchy/Loud), TP Limit 토글, ceiling(−3~0dB). 순수 매핑/True Peak 추정은
 *             loudnessDsp.ts 로 분리해 단위 시험. THD 판정(GENTLE/MUSICAL/HOT)은 기존 viz 유지.
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
 *  - v0.4.0 : Phase 3 EQ 작업 착수 및 프리셋 변경 개시.
 *  - v0.4.1 : (Patch) 앱 아이콘을 assets/logo-main.png 로 등록 (package.json의 build.win.icon 설정 및 electron/main.cjs 창 생성 icon 옵션 적용).
 *  - v0.4.2 : (Patch) 앱 아이콘 이미지를 assets/logo-main2.png 로 변경.
 *  - v0.5.0 : Phase 4 Dynamics — 단일 컴프 → Linkwitz-Riley 3밴드 멀티밴드 컴프(Low/Mid/High,
 *             Ratio 2/4/8) + 트랜지언트(밴드별 어택/릴리즈 변조) + 익사이터(고역 추출→하모닉 블렌드).
 *             섹션 dry/wet bypass·실시간 AudioParam 갱신 구조 유지. (Linear/Dynamic EQ 모드는
 *             v0.4 범위 제외 확정.) 트랜지언트는 Preview 근사이며 정밀 셰이퍼/Export 정밀화는 후속.
 *  - v0.6.0 : Phase 5 Stereo — Width(M/S Side 게인) 위에 Bass Mono(Side 고역통과), Reverb/Delay
 *             병렬 send, Mono Compatibility(모노 합 모니터, 기본 OFF) 추가. 최종 mix L/R 상관도·
 *             모노 폴드로스를 AnalyserNode 로 실측해 Correlation 미터에 상시 표시(재생 중 실측,
 *             정지 시 width 추정 폴백). 순수 매핑/상관도는 stereo.ts 로 분리해 단위 시험.
 *  - v0.6.1 : (Phase 5 Patch) Correlation 미터 정지 시 마지막 실측값 유지(freeze). 기존에는 정지 시
 *             실측 null → width 추정식으로 폴백되어 값이 고정 표시되던 혼란을 해소(재생 전에만 추정 폴백).
 *  - v0.6.2 : (Phase 5 Patch) 'Mono Compatibility' → 'Mono Master' 로 명칭 변경. 청취 전용 모니터가
 *             아니라 실제 모노 마스터 출력 토글로 정의(Export 반영, 기본 OFF). 사용자 결정(2026-06-28).
 *  - v0.7.0 : Phase 6 Loudness/Limiter — True Peak 룩어헤드 리미터를 AudioWorklet(lookahead-limiter,
 *             Blob 로드)으로 구현. 처리 순서 LUFS make-up 게인 → Saturation → TP 리미팅(최종) 확정.
 *             리미터: 룩어헤드 윈도우 최소 desired 게인 선행 더킹(브릭월, 오버슈트 없음), 캐릭터별
 *             릴리즈(Clear/Punchy/Loud), TP Limit 토글, ceiling(−3~0dB). 순수 매핑/True Peak 추정은
 *             loudnessDsp.ts 로 분리해 단위 시험. THD 판정(GENTLE/MUSICAL/HOT)은 기존 viz 유지.
 *             비고: 정밀 폴리페이즈 ISP True Peak·Export 정밀 렌더는 후속(Preview 는 샘플피크+헤드룸).
 *  - v0.7.1 : (Phase 6 Patch) LUFS 를 올리면 음악이 깨지던 문제 수정. make-up 게인이 0dBFS 를 넘기면
 *             Saturation WaveShaper(입력 ±1 하드클램프)에서 리미터 전에 하드클립되던 게인스테이징 버그를,
 *             Loudness 새츄레이터에 ±DOMAIN(+18dB) prescale + 전용 커브를 적용해 해소(리미터가 천장 정리).
 *  - v0.7.2 : (Phase 6 Patch) Loudness viz 중간행 UI 미세조정 — TRUE PEAK/LIMITER 검은 박스의 세로
 *             padding(7→4px)·라벨 아래 값 줄간격(marginTop 3→1) 축소.
 *  - v0.7.3 : (Patch) Reorganized top titlebar menu items (Project, Edit, Help structure) and moved
 *             the Theme selection selector from the top bar to a new Edit-Preference child modal window
 *             supporting real-time theme synchronization across multiple Electron windows.
 *  - v0.7.4 : (Patch) Fixed Preferences black screen issue by loading routing synchronously during
 *             the first render. Implemented Help -> About modal window featuring application logo,
 *             name, version pill, brief description, and confirmation button.
 *  - v0.8.0 : Phase 7 Export 착수 — WAV 일괄/단일 내보내기 end-to-end. Preview 의 섹션 DSP 구성을
 *             컨텍스트 무관 빌더(audio/masterChain.buildMasterChain)로 추출해 Preview(실시간)와
 *             Export(OfflineAudioContext) 가 동일 체인을 공유(7-A). 오프라인 정밀 렌더(리미터 워클릿
 *             addModule + 룩어헤드 지연 보정, Mono Master ON=1ch)로 마스터 PCM 산출(7-B), WAV(RIFF)
 *             인코더 Input PCM(16/24/32f) 연동(7-C), Electron 파일 저장 IO(saveFile/pickDir/defaultDir/
 *             reveal, 기본 <Music>/Masters/<Album>, 중복 시 " (n)" 회피)(7-D). Export 패널에 단일/배치
 *             버튼·진행률·취소·에러·Reveal, Album Artwork 드롭/미리보기, Destination 폴더 선택 추가(7-F/7-G).
 *             비고: MP3 320(lamejs)·FLAC(libflac.js) 인코더+태그(7-E)와 Preview↔Export 정합 시험(7-H)은
 *             후속(WAV 외 포맷 선택 시 안내). 메타/아트워크는 현재 표시·수집만(WAV 미임베드).
 *  - v0.8.1 : (Phase 7 Patch) Export 결과물 하드클립/찌그러짐 수정. 오프라인 렌더가 True-Peak 리미터를
 *             OfflineAudioContext 의 AudioWorklet 에 의존하던 것을, 렌더 후 **결정적 JS 브릭월 리미터**
 *             (export/limiter.ts, 워클릿과 동일 룩어헤드 알고리즘)로 교체. 워클릿 로드/동작 불확실로
 *             리미터가 누락되면 Loudness make-up 게인+새츄레이터 출력(±headroom)이 WAV 에서 ±1 로
 *             하드클립되던 문제 제거 → 항상 ceiling 이하 보장(Preview 와 동일 의도). 룩어헤드 지연은
 *             리미터 내부에서 flush·정렬(별도 trim 불필요).
 *  - v0.8.2 : (Patch, 버그 #3) IV Dynamics 사용 시 "지직" 왜곡 해소 — 발생원은 VI Loudness 새츄레이터.
 *             기존 `drive=1+a*8` 매핑은 base"1" 탓에 기본 Saturate 5% 인데도 0dBFS 부근 피크에 ~9% THD 를
 *             더하고 피크를 으깼다(Dynamics make-up·압축이 신호를 그 영역으로 밀어넣는 방아쇠). 진단:
 *             컴프 무죄(make-up=1 고정 시 깨끗), 리미터 이후에도 잔존(=리미터 전 생성), Saturate=0 시 소멸.
 *             수정: ① 새츄레이터를 선형↔tanh blend(=Saturate%)로 재설계 — 저%는 거의 선형(피크 통과,
 *             천장은 리미터 담당)·고%만 하모닉 캐릭터(5% THD 8.9→1.8%, 0%=투명, 0dBFS unity).
 *             ② 새츄레이터 헤드룸 ±8→±32(make-up 누적 하드클립 방지). ③ Dynamics 밴드 make-up 계수
 *             0.3→0.12 완화(−18dB 밴드 +5.4→+2.2dB, 최종 음량은 VI 가 담당). (audio/masterChain.ts,
 *             audio/dynamics.ts) 검증: lint·build 통과 + 사용자 청취 확인.
 *  - v0.8.3 : (Patch) IV Dynamics — ① **Multiband on/off 스위치** 추가(섹션 전체 Bypass 와 별개로
 *             3밴드 컴프만 우회). PARAMETERS 영역에 Multiband 스위치 → Ratio 순 배치. dry/wet
 *             crossfade(mbDry/mbWet)로 재생 중 토글해도 source 재빌드 없음. OFF 시 익사이터는 원신호에
 *             작동(컴프만 우회). **OFF 시 좌측 GR 막대/값 + Transient 블록을 회색·비활성(입력 차단)**으로
 *             표시 — Transient 는 밴드 컴프 attack/release 변조라 Multiband OFF 면 무효(compute.ts/Controls.tsx).
 *             ② **기본값 정리(깨끗한 디폴트)** — Multiband **OFF**, Low/Mid/High −4/−2/−3 → −2/−1/−1,
 *             Transient 15→10%, Exciter 25→15%. (desk/data.ts, audio/masterChain.ts, desk/compute.ts)
 *             검증: lint·build 통과.
 *  - v0.8.4 : (Phase 7, 7-E) Export MP3 320·FLAC 인코더 + 태그·아트워크 추가. ① **MP3**(@breezystack/
 *             lamejs, CBR 320) — export/mp3.ts. 96kHz 등 MP3 미지원 레이트는 48kHz 로 리샘플. **ID3v2.3
 *             태그**(TIT2/TPE1/TALB/TYER/TCON, UTF-16) + **APIC 앨범아트**(export/id3.ts). ② **FLAC**
 *             (libflacjs 자체완결 asm.js) — export/flac.ts. Input PCM 16/24(32f→24) 정수 인코딩. 인코딩 후
 *             **VORBIS_COMMENT(TITLE/ARTIST/ALBUM/DATE/GENRE) + PICTURE 메타 블록을 직접 삽입**(libflacjs
 *             인코딩-시 메타 주입 API 부재). ③ 디스패처(exportRunner.encodeMaster)에 meta 전달,
 *             SUPPORTED_EXPORT_FORMATS = WAV/MP3 320/FLAC. 트랙 제목=파일명, 나머지 태그=Export 메타·
 *             아트워크(store). 인코더는 **동적 import**(메인 번들·기동 비용 절감, 로딩 이슈 격리).
 *             검증: lint·build 통과. *(실제 파일 재생/태그 확인은 사용자 시험 필요.)*
 *  - v0.8.5 : (Phase 7, 7-E 보완) Export 사용성/버그 수정. ① Format 라벨/값 'MP3 320'→'MP3'.
 *             ② **앨범아트(섹션 VII) 이미지 드롭이 섹션 I 큐로 흘러가 에러**나던 것 수정 — 아트워크 드롭존은
 *             stopPropagation 유지(루트 오디오 로더 차단), 'Drop audio files' 오버레이 해제는 App 의
 *             **window 캡처 'drop'/'dragend' 리스너**가 담당(자식 stopPropagation 과 무관하게 해제).
 *             ③ **Export 진행 오버레이 + 완료 알림 모달** — exporting 중 LoadingCard(EXPORTING), 완료 시
 *             ExportNotice 모달(저장 개수·경로·Reveal/OK). 무거운 작업 전 30ms 양보 + MP3/FLAC 인코드 루프
 *             주기적 yield. 로딩 표시는 **출력 파일명(현재 포맷 확장자)**, 단일 파일은 하위 진행률이 없어
 *             **불확정(스피너)** 표시(오해되는 0% 제거). ④ **FLAC require 번들 오류 수정** — 고수준
 *             `libflacjs/lib/encoder`(UMD 내부 require) 대신 **자체완결 `dist/libflac.js` 저수준 API 직접
 *             호출**. ⑤ MP3 사용자 확인 완료(태그·아트워크 정상).
 *  - v0.8.7 : 매뉴얼 노이즈 자동 추천 기준 보강(다국어 표 추가) 및 매뉴얼 창 독립화(parent: undefined).
 *             매뉴얼 창이 메인 앱 창 조작을 블로킹하지 않도록 비모달/독립 창 형태로 전환하여 사용성 개선.
 *  - v0.8.8 : 매뉴얼 VI. Loudness 세부 내용 보강. Saturate의 장단점/조작 팁 기술 및 LUFS의 개념,
 *             방송과 음원의 차이, 유튜브·애플뮤직 등 주요 스트리밍 플랫폼 타겟 레벨 설명 가이드 추가.
 *  - v0.8.9 : (Patch) Relocated Help menu to the right end of the title bar to avoid edge clipping.
 *             Implemented global Undo/Redo history tracking (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z) for all mastering
 *             parameters and module states, utilizing skipUndo on slider drags and text input typing.
 */
export const APP_NAME = 'FocusDAW - Mastering Desk';
export const APP_VERSION = __APP_VERSION__;
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
