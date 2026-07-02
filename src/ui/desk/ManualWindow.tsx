import { Fragment, useMemo, useRef, useState } from 'react';
import logoUrl from '../../../assets/logo-main2.png';
import appOverviewImage from '../../../assets/manual/app-overview.png';
import transportPanelImage from '../../../assets/manual/transport-panel.png';
import loadedFileInfoImage from '../../../assets/manual/loaded-file-info.png';
import playProgressImage from '../../../assets/manual/play-progress.png';
import transportPlayingImage from '../../../assets/manual/transport-playing.png';
import transportLoopImage from '../../../assets/manual/transport-loop.png';
import bypassToggleImage from '../../../assets/manual/bypass-toggle.png';
import previewToggleImage from '../../../assets/manual/preview-toggle.png';
import inputDetailsImage from '../../../assets/manual/input-details.png';
import preNoiseAnalysisImage from '../../../assets/manual/pre-noise-analysis.png';
import preDenoiseOnImage from '../../../assets/manual/pre-denoise-on.png';
import preSpectrumControlsImage from '../../../assets/manual/pre-spectrum-controls.png';
import preAutoSettingsImage from '../../../assets/manual/pre-auto-settings.png';
import eqOverviewImage from '../../../assets/manual/eq-overview.png';
import eqAdvancedImage from '../../../assets/manual/eq-advanced.png';
import eqUserPresetImage from '../../../assets/manual/eq-user-preset.png';
import eqPresetSaveImage from '../../../assets/manual/eq-preset-save.png';
import eq9BandOverviewImage from '../../../assets/manual/eq-9band-overview.png';
import eq9BandUserPresetsImage from '../../../assets/manual/eq-9band-user-presets.png';
import dynamicsDetailsImage from '../../../assets/manual/dynamics-details.png';
import stereoDetailsImage from '../../../assets/manual/stereo-details.png';
import loudnessDetailsImage from '../../../assets/manual/loudness-details.png';
import exportDetailsImage from '../../../assets/manual/export-details.png';
import renderBatchOverviewImage from '../../../assets/manual/render-batch-overview.png';
import renderBatchSessionPickerImage from '../../../assets/manual/render-batch-session-picker.png';
import renderBatchSessionLoadedImage from '../../../assets/manual/render-batch-session-loaded.png';
import renderBatchAddJobImage from '../../../assets/manual/render-batch-add-job.png';
import renderBatchMultipleJobsImage from '../../../assets/manual/render-batch-multiple-jobs.png';

type Lang = 'ko' | 'en';
type ManualSection = {
  id: string;
  title: { ko: string; en: string };
  intro: { ko: string; en: string };
  steps: { ko: string[]; en: string[] };
  effect?: { ko: string; en: string };
};

const SECTIONS: ManualSection[] = [
  {
    id: 'overview',
    title: { ko: '앱 둘러보기', en: 'App Overview' },
    intro: {
      ko: 'FocusDAW Mastering Desk는 여러 음원을 한 번에 불러와 같은 기준으로 다듬고 내보내는 배치 마스터링 앱입니다. 신호는 I에서 VII까지 왼쪽에서 오른쪽으로 흐릅니다.',
      en: 'FocusDAW Mastering Desk is a batch-mastering app that imports, processes, and exports multiple tracks consistently. Audio flows from section I to VII, left to right.',
    },
    steps: {
      ko: ['상단 메뉴에서 프로젝트와 환경설정을 관리합니다.', '가운데 7개 스테이지를 클릭하면 아래에 상세 조절 화면이 열립니다.', 'Preview를 켜고 재생하면 처리 전후를 들으며 조절할 수 있습니다.'],
      en: ['Use the top menu to manage projects and preferences.', 'Select one of the seven stages to open its detailed controls below.', 'Enable Preview and play audio to compare processed and original sound.'],
    },
  },
  {
    id: 'workflow',
    title: { ko: '기본 사용 방법', en: 'Basic Workflow' },
    intro: {
      ko: 'Import → Listen → Adjust → Compare → Export 순서로 작업하면 됩니다. 처음에는 작은 변화부터 적용하고 출력 음량이 지나치게 커지지 않는지 확인하세요.',
      en: 'A reliable workflow is Import → Listen → Adjust → Compare → Export. Start with subtle changes and watch the output level.',
    },
    steps: {
      ko: ['Project > Import Files 또는 Import Folder로 음원을 불러옵니다.', '큐에서 곡을 선택하고 Play로 원본을 확인합니다.', '각 섹션을 켜고 파라미터를 조절합니다. Bypass하면 해당 섹션만 건너뜁니다.', 'Preview ON/OFF로 처리음과 원음을 비교합니다.', 'VII Export에서 형식과 저장 위치를 정한 뒤 배치 출력합니다.'],
      en: ['Import audio with Project > Import Files or Import Folder.', 'Select a track in the queue and use Play to audition it.', 'Enable stages and adjust parameters. Bypass skips only that stage.', 'Use Preview ON/OFF to compare processed and original audio.', 'Choose format and destination in VII Export, then run the batch export.'],
    },
  },
  {
    id: 'input',
    title: { ko: 'I. Input — 입력', en: 'I. Input' },
    intro: {
      ko: '파일·폴더 입력, 내부 PCM 비트 깊이와 샘플레이트, 하위 폴더 검색, 정규화를 설정합니다. 큐에는 길이, 포맷, 원본 LUFS 같은 분석 정보가 표시됩니다.',
      en: 'Controls file/folder input, internal PCM depth and sample rate, subfolder scanning, and normalization. The queue shows duration, format, and measured source LUFS.',
    },
    steps: {
      ko: ['Files는 여러 파일, Folder는 폴더 단위로 불러옵니다.', 'Rate는 내부 처리 해상도입니다. 원본보다 높게 설정해도 잃어버린 고역이 복원되지는 않습니다.', 'Root는 선택 폴더만, Sub Folder는 모든 하위 폴더까지 검색합니다.', 'Normalize는 입력 피크를 안전한 기준으로 맞춰 처리 시작점을 일정하게 합니다.'],
      en: ['Files imports selected files; Folder imports a directory.', 'Rate sets the internal processing sample rate. Raising it cannot restore frequencies missing from the source.', 'Root scans only the chosen folder; Sub Folder includes nested folders.', 'Normalize aligns input peaks to provide a consistent processing starting point.'],
    },
    effect: {
      ko: '음원 효과: 음색을 꾸미기보다는 다음 단계가 안정적으로 작동하도록 입력 규격과 레벨을 정돈합니다.',
      en: 'Audible effect: Primarily prepares format and level so later stages behave consistently, rather than coloring the sound.',
    },
  },
  {
    id: 'pre',
    title: { ko: 'II. Pre — 전처리', en: 'II. Pre Processing' },
    intro: {
      ko: '본격적인 톤 조절 전에 노이즈와 곡 시작·끝을 정리합니다. 3D 스펙트로그램은 시간에 따른 주파수 에너지를 보여줍니다.',
      en: 'Cleans noise and track boundaries before tonal processing. The 3D spectrogram shows frequency energy over time.',
    },
    steps: {
      ko: ['Denoise는 조용한 구간에서 노이즈 특성을 찾아 줄입니다.', 'Noise Depth는 처리 강도, Noise Reduction은 실제 감소량입니다.', 'Fade In/Out은 시작과 끝의 클릭음이나 갑작스러운 끊김을 완화합니다.', 'Reset View로 3D 화면의 시점을 초기화할 수 있습니다.'],
      en: ['Denoise learns the noise character from quiet passages and reduces it.', 'Noise Depth chooses processing strength; Noise Reduction controls the applied amount.', 'Fade In/Out softens clicks and abrupt starts or endings.', 'Reset View restores the 3D display camera.'],
    },
    effect: {
      ko: '음원 효과: 히스·공조음 같은 일정한 바닥 노이즈가 줄고 시작과 끝이 매끄러워집니다. 과하면 고역이 물결치거나 답답해질 수 있습니다.',
      en: 'Audible effect: Reduces steady hiss or room noise and smooths edges. Excessive reduction can create watery highs or dullness.',
    },
  },
  {
    id: 'eq',
    title: { ko: 'III. Spectral EQ — 음색', en: 'III. Spectral EQ' },
    intro: {
      ko: '주파수 대역별 크기를 조절해 어둡고 밝은 정도, 저음의 무게, 중역의 선명도를 다듬습니다.',
      en: 'Shapes brightness, bass weight, and midrange clarity by adjusting frequency bands.',
    },
    steps: {
      ko: ['MIN-PHASE PARAMETRIC과 9-BAND GRAPHIC 중 원하는 방식을 선택합니다.', 'Parametric에서는 그래프의 밴드 점이나 노브로 Frequency·Gain·Q를 조절합니다.', '9-Band에서는 그래프의 9개 고정 주파수 포인트를 위아래로 드래그해 Gain을 조절하거나 전용 프리셋을 선택합니다.', '두 방식의 설정은 독립적으로 유지되므로 전환해 비교할 수 있습니다.'],
      en: ['Choose MIN-PHASE PARAMETRIC or 9-BAND GRAPHIC.', 'In Parametric mode, drag graph nodes or adjust Frequency, Gain, and Q.', 'In 9-Band mode, drag the nine fixed-frequency graph points vertically or choose a dedicated preset.', 'Both modes retain independent settings for easy comparison.'],
    },
    effect: {
      ko: '음원 효과: 탁한 저중역을 걷거나, 보컬 존재감을 높이거나, 거친 고역을 부드럽게 만들 수 있습니다.',
      en: 'Audible effect: Can clear muddy low-mids, bring vocals forward, or soften harsh treble.',
    },
  },
  {
    id: 'dynamics',
    title: { ko: 'IV. Dynamics — 다이내믹', en: 'IV. Dynamics' },
    intro: {
      ko: '큰 소리와 작은 소리의 차이를 관리하고 트랜지언트와 배음을 조절합니다.',
      en: 'Manages the gap between loud and quiet moments and shapes transients and harmonics.',
    },
    steps: {
      ko: ['Threshold보다 큰 신호가 Ratio 비율로 눌립니다.', 'Attack이 빠르면 타격음이 얌전해지고, 느리면 첫 타격이 살아납니다.', 'Release는 압축이 풀리는 속도입니다. 곡의 박자에 맞으면 자연스럽습니다.', 'Transient와 Exciter는 각각 타격감과 고조파 선명도를 보완합니다.'],
      en: ['Signals above Threshold are reduced according to Ratio.', 'Fast Attack softens hits; slower Attack preserves the initial punch.', 'Release controls how quickly compression lets go. Matching the groove sounds natural.', 'Transient and Exciter controls restore impact and harmonic detail.'],
    },
    effect: {
      ko: '음원 효과: 레벨이 안정되고 밀도가 높아집니다. 과한 압축은 숨 막히거나 펌핑하는 소리를 만듭니다.',
      en: 'Audible effect: Produces steadier level and greater density. Too much creates a squashed or pumping sound.',
    },
  },
  {
    id: 'stereo',
    title: { ko: 'V. Stereo — 공간', en: 'V. Stereo' },
    intro: {
      ko: '좌우 폭과 저역의 중심감을 다듬어 공간을 넓히거나 단단하게 만듭니다.',
      en: 'Adjusts stereo width and low-frequency focus for a wider or more solid image.',
    },
    steps: {
      ko: ['Width 100%가 원본이며 높이면 넓어지고 낮추면 중앙으로 모입니다.', 'Bass Mono는 설정 주파수 아래 저음을 중앙에 모아 재생 호환성을 높입니다.', 'Mono로 전환해 위상 상쇄로 악기나 보컬이 사라지지 않는지 확인합니다.', '스테레오 미터가 극단으로 치우치지 않는지 함께 확인하세요.'],
      en: ['Width at 100% is unchanged; higher is wider and lower moves toward mono.', 'Bass Mono centers frequencies below its cutoff for better playback compatibility.', 'Check Mono to ensure phase cancellation does not remove vocals or instruments.', 'Watch the stereo meter for extreme imbalance.'],
    },
    effect: {
      ko: '음원 효과: 코러스·패드가 넓어지고 킥·베이스는 중앙에서 단단해집니다. 과도한 확장은 모노에서 소리가 약해질 수 있습니다.',
      en: 'Audible effect: Widens pads and choruses while anchoring kick and bass. Excessive width may sound weak in mono.',
    },
  },
  {
    id: 'loudness',
    title: { ko: 'VI. Loudness / Limiter — 최종 음량', en: 'VI. Loudness / Limiter' },
    intro: {
      ko: '목표 LUFS에 맞춰 체감 음량을 올리고 순간 피크가 출력 한계를 넘지 않게 막습니다.',
      en: 'Raises perceived loudness toward a target LUFS and prevents momentary peaks from exceeding the output ceiling.',
    },
    steps: {
      ko: ['Target LUFS는 원하는 평균 체감 음량입니다. 플랫폼 권장값은 장르와 배포처에 따라 다릅니다.', 'Limiter Ceiling은 최종 피크의 상한입니다.', 'TP Limit는 샘플 사이에서 생길 수 있는 실제 재생 피크까지 고려합니다.', 'Gain Reduction이 계속 크게 움직이면 앞 단계의 압축이나 목표 음량을 다시 확인하세요.'],
      en: ['Target LUFS sets desired average perceived loudness; suitable values depend on genre and destination.', 'Limiter Ceiling is the maximum final peak.', 'TP Limit also considers inter-sample peaks that may occur during playback.', 'If Gain Reduction stays high, revisit earlier compression or lower the loudness target.'],
    },
    effect: {
      ko: '음원 효과: 더 크고 단단하게 들리며 돌발 피크가 억제됩니다. 지나치면 타격감과 깊이가 줄고 왜곡될 수 있습니다.',
      en: 'Audible effect: Sounds louder and firmer while controlling spikes. Too much can remove punch and depth or introduce distortion.',
    },
  },
  {
    id: 'export',
    title: { ko: 'VII. Export — 출력', en: 'VII. Export' },
    intro: {
      ko: '완성된 체인을 파일로 렌더링합니다. 포맷, 파일명, 저장 위치와 메타데이터를 확인하는 마지막 단계입니다.',
      en: 'Renders the completed chain to files. This is the final check for format, naming, destination, and metadata.',
    },
    steps: {
      ko: ['WAV/AIFF는 편집·보관용 무손실, FLAC은 용량을 줄인 무손실 형식입니다.', '배포처 요구에 맞춰 비트 깊이와 샘플레이트를 선택합니다.', '저장 폴더와 파일명 규칙을 확인한 뒤 Batch Export를 실행합니다.', '출력 파일을 다시 불러와 시작·끝, 음량, 왜곡 여부를 최종 확인하세요.'],
      en: ['WAV/AIFF are lossless for editing and archive; FLAC is lossless with smaller files.', 'Choose bit depth and sample rate required by the destination.', 'Confirm destination and naming, then run Batch Export.', 'Re-import an output and verify boundaries, loudness, and distortion.'],
    },
    effect: {
      ko: '음원 효과: Export 자체는 앞 단계의 소리를 파일로 고정합니다. 손실 압축이나 낮은 비트 깊이는 미세한 품질 차이를 만들 수 있습니다.',
      en: 'Audible effect: Export commits the preceding sound to a file. Lossy compression or lower bit depth may introduce subtle changes.',
    },
  },
  {
    id: 'renderBatch',
    title: { ko: 'Render Batch — 다중 작업 출력', en: 'Render Batch' },
    intro: {
      ko: '메인 프로젝트와 별도로, 여러 원본 묶음에 저장된 Session Card를 각각 지정해 한 번에 렌더링하는 독립 작업 창입니다.',
      en: 'A separate workspace that renders multiple source groups at once, each with its own saved Session Card.',
    },
    steps: {
      ko: ['+ FILE, + FOLDER 또는 드래그 앤 드롭으로 첫 작업의 원본을 추가합니다.', 'SELECT에서 해당 원본에 적용할 Session Card를 선택하고 출력 폴더를 확인합니다.', '다른 원본에 다른 설정을 적용하려면 + ADD BATCH JOB으로 작업을 추가합니다.', 'START를 누르면 모든 작업을 위에서 아래 순서로 처리하며 상단에서 전체 진행률을 확인할 수 있습니다.'],
      en: ['Add sources to the first job with + FILE, + FOLDER, or drag and drop.', 'Choose the Session Card for those sources with SELECT and confirm the output folder.', 'Use + ADD BATCH JOB when another source group needs different settings.', 'Press START to process all jobs from top to bottom while the header shows overall progress.'],
    },
  },
  {
    id: 'tips',
    title: { ko: '단축키와 문제 해결', en: 'Shortcuts & Troubleshooting' },
    intro: {
      ko: 'Space는 재생/정지, F4는 Transport 패널 열기/닫기입니다. 노브는 더블클릭하면 기본값으로 돌아갑니다.',
      en: 'Space starts/stops playback and F4 toggles the Transport panel. Double-click a knob to restore its default.',
    },
    steps: {
      ko: ['소리가 안 나면 큐 선택, 출력 장치, 시스템 음량을 확인합니다.', '재생이 끊기면 Denoise 같은 무거운 처리가 끝날 때까지 기다리고 다른 앱의 부하를 줄입니다.', '결과가 너무 크거나 찌그러지면 VI의 목표 LUFS와 Limiter 감소량을 낮춥니다.', '모든 비교는 체감 음량을 비슷하게 맞춘 상태에서 하세요. 큰 쪽이 무조건 더 좋아 들리는 착시를 줄일 수 있습니다.'],
      en: ['If silent, check queue selection, output device, and system volume.', 'If playback stutters, wait for heavy processing such as Denoise and reduce other system load.', 'If output is too loud or distorted, lower Target LUFS and limiter reduction in section VI.', 'Level-match comparisons to avoid mistaking louder for better.'],
    },
  },
  {
    id: 'glossary',
    title: { ko: '용어집 & 이펙트 가이드', en: 'Glossary & Effect Guide' },
    intro: {
      ko: '마스터링에 사용되는 주요 용어들과 각 이펙트의 실제 소리 적용 효과를 초심자의 눈높이에서 쉽게 설명합니다.',
      en: 'Easy-to-understand explanations of key mastering terms and the actual audible effects of each stage for beginners.',
    },
    steps: {
      ko: [],
      en: [],
    },
  },
];

type GlossaryItem = {
  term: { ko: string; en: string };
  desc: { ko: string; en: string };
  effect: { ko: string; en: string };
};

const GLOSSARY_ITEMS: GlossaryItem[] = [
  {
    term: { ko: 'Denoise (노이즈 제거)', en: 'Denoise' },
    desc: {
      ko: '음원 녹음 시 함께 녹음된 원치 않는 배경 잡음(쉬익 하는 히스 소리, 바람 소리, 기기 웅웅거림 등)을 분석하여 지우는 기능입니다.',
      en: 'Analyzes and removes unwanted background noise (such as tape hiss, wind noise, or equipment hum) captured during recording.',
    },
    effect: {
      ko: '노래 뒤에 깔린 지저분한 잡음이 차분히 정리되어 목소리와 악기가 훨씬 더 깨끗하게 들립니다. 단, 너무 무리하게 작동시키면 고음이 멍해지거나 소리가 물속에 있는 것처럼 울렁거릴 수 있습니다.',
      en: 'Cleans up background noise so vocals and instruments stand out clearly. However, over-processing can make the high end sound muffled or create watery, artificial artifacts.',
    },
  },
  {
    term: { ko: 'Equalizer (이퀄라이저 / EQ)', en: 'Equalizer (EQ)' },
    desc: {
      ko: '저음, 중음, 고음 등 특정 음역대의 높낮이를 독립적으로 조절하여 소리의 밝기나 톤을 성형하는 도구입니다.',
      en: 'A tool that shapes the tone and brightness of your audio by independently boosting or cutting specific frequency ranges (bass, midrange, treble).',
    },
    effect: {
      ko: '먹먹한 소리에 고음을 살려 화사하게 만들거나, 방방거리는 저음을 깎아 깔끔하게 정리할 수 있습니다. 중음역을 조절해 보컬의 앞뒤 위치를 잡을 수도 있습니다.',
      en: 'Makes dull tracks sound brighter by boosting treble, or cleans up boominess by cutting muddy bass. Adjusting the midrange can also push the lead vocal forward or backward.',
    },
  },
  {
    term: { ko: 'Dynamics (다이내믹 / 컴프레서)', en: 'Dynamics (Compressor)' },
    desc: {
      ko: '큰 소리는 눌러서 작게 만들고 작은 소리는 위로 당겨서, 소리 간의 볼륨 편차(다이내믹 레인지)를 균일하게 조절하는 이펙터입니다.',
      en: 'An effect that evens out volume variations (dynamic range) by compressing the loudest peaks and raising the quieter details.',
    },
    effect: {
      ko: '음원의 평균적인 밀도가 단단하게 차오르며, 악기 소리들이 따로 놀지 않고 하나로 뭉쳐 들립니다. 과도하게 압축하면 소리가 답답해지고 타격감이 사라져 숨 막히는 소리가 됩니다.',
      en: 'Creates a denser, glued-together sound where everything feels unified. Excess compression squeezes out the life of the track, making it sound flat, pumping, and fatiguing.',
    },
  },
  {
    term: { ko: 'Exciter (익사이터)', en: 'Exciter' },
    desc: {
      ko: '오디오 신호에 미세한 인공 고조파(Harmonics)를 덧붙여서 원래 소리에는 없던 윤기와 귀를 자극하는 선명함을 만들어내는 도구입니다.',
      en: 'Adds subtle, artificial harmonics to the audio signal to generate shine and crisp presence that might not have been in the original recording.',
    },
    effect: {
      ko: '소리의 고역 끝자락에 얇고 선명한 막을 입힌 것처럼 청량감이 느껴집니다. 단, 많이 쓸수록 귀를 쏘거나 따가운 질감이 되어 쉽게 피로해질 수 있으니 소량만 사용해야 합니다.',
      en: 'Adds a refreshing clarity and high-frequency sparkle. Use sparingly, as excessive amounts can make the track sound harsh and painful to listen to.',
    },
  },
  {
    term: { ko: 'Stereo Width (스테레오 너비)', en: 'Stereo Width' },
    desc: {
      ko: '좌우 스피커 사이에서 소리가 울려 퍼지는 공간적인 넓이와 분포를 조절하여 입체감을 주는 기능입니다.',
      en: 'Controls the spatial width and distribution of sound between the left and right speakers to enhance the 3D stereo image.',
    },
    effect: {
      ko: '값을 높이면 소리가 양옆으로 넓게 벌어져 웅장하고 입체적인 공간을 만듭니다. 반대로 너무 넓히면 소리의 중심이 흔들리거나, 모노 스피커에서 소리가 힘없이 작아질 수 있습니다.',
      en: 'Expanding this widens the soundstage for a grand, immersive feel. However, widening it too much can blur the center focus or cause the sound to collapse and weaken on mono speakers.',
    },
  },
  {
    term: { ko: 'Bass Mono (저음 모노화)', en: 'Bass Mono' },
    desc: {
      ko: '극저역 주파수 이하의 소리들을 좌우 편차 없이 한가운데(Mono)로 강제로 정렬하는 기술입니다.',
      en: 'Forces low-frequency sub-bass sounds into the center (mono) rather than letting them spread to the sides.',
    },
    effect: {
      ko: '베이스와 킥드럼처럼 무거운 에너지를 가진 저음이 중앙에 단단하게 고정되어, 클럽 스피커나 모바일 기기에서도 저역이 흩어지지 않고 꽉 찬 펀치감을 내게 해줍니다.',
      en: 'Anchors heavy energy sources like the kick drum and bass synth firmly in the center. This ensures the low end remains tight, punchy, and consistent across various playback systems.',
    },
  },
  {
    term: { ko: 'Saturation (새츄레이션)', en: 'Saturation' },
    desc: {
      ko: '아날로그 진공관(Tube)이나 테이프 머신이 과부하될 때 생기는 부드러운 일그러짐을 복제하여 음원에 배음을 채우는 장치입니다.',
      en: 'Replicates the gentle distortion created by overdriven analog tubes or tape machines, filling the audio with rich harmonics.',
    },
    effect: {
      ko: '소리에 기분 좋은 따뜻함과 든든한 알맹이를 더해 줍니다. 리미터 진입 전에 볼륨을 채우는 역할을 하지만, 너무 과하면 뭉개지고 지저분하게 왜곡됩니다.',
      en: 'Infuses the sound with a pleasing analog warmth, weight, and grit. It helps beef up the track before the limiter, but too much will make it sound fuzzy and distorted.',
    },
  },
  {
    term: { ko: 'Limiter & True Peak (리미터와 트루 피크)', en: 'Limiter & True Peak' },
    desc: {
      ko: '소리가 특정 상한선(Ceiling)을 넘지 못하게 벽을 치고 가둬 두면서 전체 음량을 안전하게 키우는 브레이크 장치이자, 실제 기기 출력 시 생길 수 있는 아날로그 정밀 피크를 일컫는 용어입니다.',
      en: 'A limiter acts as a brick-wall ceiling preventing signal peaks from exceeding a set limit while safely pushing up the overall level. True Peak refers to the actual peak level after analog reconstruction.',
    },
    effect: {
      ko: '디지털 왜곡(클리핑)이 생기지 않는 최대 한도까지 전체적인 음량이 빵빵하게 올라갑니다. 목표를 과하게 잡으면 소리가 짓눌리고 평평해져 음악의 생동감이 죽습니다.',
      en: 'Maximizes the overall loudness of the track without causing harsh digital clipping. Pushing it too hard will squash the dynamics, leaving the song flat and devoid of life.',
    },
  },
  {
    term: { ko: 'LUFS (체감 음량 단위)', en: 'LUFS' },
    desc: {
      ko: '소리의 단순한 전압이나 물리적 크기가 아닌, 인간의 청각적 특성에 맞게 보정한 실제 \'느껴지는 음량의 크기\'를 나타내는 국제 통합 표준 단위입니다.',
      en: 'An international standard unit for measuring perceived loudness, designed to match how the human ear actually hears different frequencies.',
    },
    effect: {
      ko: '유튜브(-14 LUFS), 애플뮤직(-16 LUFS) 등 각 플랫폼별 기준에 맞추는 척도가 됩니다. 이 값보다 소리가 너무 크면 스트리밍 시 강제로 볼륨이 줄어들어 믹스의 다이내믹만 손해보게 됩니다.',
      en: 'Serves as the benchmark for platform loudness normalization. If your track is mastered too loud, streaming platforms will automatically lower its volume, leaving your music sounding flat compared to dynamic tracks.',
    },
  },
  {
    term: { ko: 'Bypass (바이패스 / 건너뛰기)', en: 'Bypass' },
    desc: {
      ko: '현재 이펙터나 보정 단계를 활성화하지 않고 신호를 그대로 흘려보내 효과를 적용하기 전 상태로 돌리는 동작입니다.',
      en: 'Bypasses the active processing block, allowing the original unprocessed signal to pass through.',
    },
    effect: {
      ko: '지금 만지고 있는 효과(예: EQ, 컴프레서)가 소리를 진짜 더 낫게 만들었는지 아니면 해쳤는지, 귀로 신속하고 객관적으로 전후를 비교해 가며 작업할 수 있게 해줍니다.',
      en: 'Enables rapid and objective A/B testing to verify whether a specific processing stage (like EQ or compression) is actually improving the sound or making it worse.',
    },
  },
];

type LocalText = { ko: string; en: string };
type Setting = { name: string; values: string; detail: LocalText };
type Media = { src: string; caption: LocalText };

const SETTINGS: Partial<Record<string, Setting[]>> = {
  overview: [
    { name: 'Stage card', values: 'I–VII', detail: { ko: '카드를 클릭하면 해당 처리 단계의 상세 화면이 열립니다. 카드 아래 BYPASSED/ACTIVE 상태로 적용 여부를 확인합니다.', en: 'Click a card to open that processing stage. Its BYPASSED/ACTIVE state shows whether it is applied.' } },
    { name: 'Play / Space', values: 'Play · Pause', detail: { ko: '선택한 음원을 재생하거나 일시정지합니다. 재생 위치는 하단 진행 바로 확인합니다.', en: 'Plays or pauses the selected track. The lower progress bar shows the current position.' } },
    { name: 'Preview', values: 'OFF / ON', detail: { ko: 'OFF는 처리 전 원음, ON은 활성화된 I~VI 체인을 통과한 처리음을 재생합니다. 같은 구간을 번갈아 들어 비교하세요.', en: 'OFF auditions the source; ON auditions the active I–VI chain. Toggle it on the same passage for a fair comparison.' } },
    { name: 'Bypass', values: 'Per stage', detail: { ko: '각 단계 왼쪽 아래 버튼으로 해당 단계만 건너뜁니다. 설정값은 보존되므로 다시 켜면 그대로 복원됩니다.', en: 'Skips only that stage while preserving its settings, which return when re-enabled.' } },
  ],
  workflow: [
    { name: 'Transport', values: 'F4', detail: { ko: 'F4 또는 상단 Transport 메뉴로 파형 패널을 엽니다. 파형을 클릭하면 해당 위치로 이동합니다.', en: 'Press F4 or use the Transport menu to open the waveform panel. Click the waveform to seek.' } },
    { name: 'Skip', values: '−5 s / +5 s', detail: { ko: '되감기·앞감기 버튼으로 5초씩 이동합니다. 세밀한 비교는 파형 클릭을 사용하세요.', en: 'Moves backward or forward by five seconds. Click the waveform for more precise seeking.' } },
    { name: 'A/B Loop', values: 'A · B · Loop', detail: { ko: 'A로 시작점, B로 끝점을 지정하고 Loop를 켜면 구간을 반복합니다. 짧은 구간에서 EQ나 압축 차이를 비교할 때 유용합니다.', en: 'Set start with A, end with B, then enable Loop. This is useful for comparing EQ or compression on a short passage.' } },
    { name: 'Monitor volume', values: '0–100%', detail: { ko: '청취 전용 음량이며 Export 결과에는 반영되지 않습니다. 비교 시 원음과 처리음의 체감 음량을 비슷하게 맞추세요.', en: 'Monitoring-only level; it does not affect Export. Keep source and processed playback at similar perceived loudness.' } },
  ],
  input: [
    { name: 'Source', values: 'Files / Folder', detail: { ko: 'Files는 여러 파일을 선택하고 Folder는 폴더를 한 번에 큐에 추가합니다. 파일을 창으로 끌어 놓아도 됩니다.', en: 'Files selects multiple files; Folder adds a directory to the queue. Drag-and-drop is also supported.' } },
    { name: 'PCM', values: '16 / 24 / 32f', detail: { ko: '내부 및 출력 PCM 비트 깊이입니다. 24-bit는 일반 마스터에 권장되며 32f는 후속 편집 헤드룸을 보존합니다.', en: 'Internal/output PCM depth. 24-bit is a solid mastering default; 32f preserves headroom for later editing.' } },
    { name: 'Rate', values: '44.1k / 48k / 96k', detail: { ko: 'Preview·DSP·Export의 내부 샘플레이트입니다. 변경 시 처리 버퍼를 다시 만들며, 업샘플링이 원본에 없던 고역을 복원하지는 않습니다.', en: 'Internal rate for Preview, DSP, and Export. Changing it rebuilds the processing buffer; upsampling cannot restore missing source detail.' } },
    { name: 'Folder', values: 'Root / Sub Folder', detail: { ko: 'Root는 선택한 폴더의 파일만, Sub Folder는 하위 폴더까지 재귀 검색합니다.', en: 'Root scans only the selected folder; Sub Folder recursively includes nested folders.' } },
    { name: 'Normalize', values: 'OFF / ON', detail: { ko: '처리 시작 전 입력 피크 기준을 정돈합니다. 곡별 다이내믹 자체를 같게 만드는 기능은 아닙니다.', en: 'Aligns the input peak reference before processing. It does not make every track equally dynamic.' } },
    { name: 'LUFS badge', values: 'Measured', detail: { ko: 'NOW SELECTED의 LUFS는 원본 파일을 BS.1770 방식으로 실측한 값입니다. VI의 목표 LUFS와 구분하세요.', en: 'The NOW SELECTED LUFS badge is a BS.1770 measurement of the source, distinct from the target in section VI.' } },
  ],
  pre: [
    { name: 'Denoise', values: 'OFF / ON', detail: { ko: '조용한 구간에서 노이즈 프로필을 찾아 STFT 스펙트럴 게이팅을 적용합니다. 분석·처리에 시간이 걸릴 수 있습니다.', en: 'Finds a noise profile in quiet passages and applies STFT spectral gating. Analysis and processing may take time.' } },
    { name: 'Noise Depth', values: '1 / 2 / 3', detail: { ko: '1 Original은 가장 보수적, 2 Normal은 일반적인 정리, 3 Deep은 강한 노이즈에 사용합니다. 강할수록 인공적인 흔들림이 생길 가능성도 커집니다.', en: '1 Original is conservative, 2 Normal is general-purpose, and 3 Deep targets heavy noise. Stronger depth raises artifact risk.' } },
    { name: 'Noise Reduction', values: '0–100% · 1%', detail: { ko: '검출한 노이즈를 실제로 줄이는 양입니다. 10~35%부터 시작해 무음부와 고역을 함께 들으며 올리세요.', en: 'Amount of detected noise actually reduced. Start around 10–35% and listen to both silence and high-frequency detail.' } },
    { name: 'Fade In', values: '0–2000 ms · 10 ms', detail: { ko: '곡 시작의 클릭과 갑작스러운 진입을 완화합니다. 타격음이 중요한 곡은 짧게 설정하세요.', en: 'Softens clicks or abrupt starts. Keep it short when the opening transient matters.' } },
    { name: 'Fade Out', values: '0–4000 ms · 10 ms', detail: { ko: '곡 끝을 부드럽게 감쇠합니다. 잔향이 잘리지 않도록 마지막 소리를 들으며 조절하세요.', en: 'Smoothly attenuates the ending. Adjust while listening so natural ambience is not cut off.' } },
    { name: '3D Spectrum', values: 'Drag / Wheel / Right-drag', detail: { ko: '드래그는 회전, 휠은 확대·축소, 오른쪽 드래그는 이동입니다. Reset View로 기본 시점에 돌아갑니다.', en: 'Drag rotates, the wheel zooms, and right-drag pans. Reset View restores the default camera.' } },
    { name: 'Recommendation', values: 'Analyze → Apply', detail: { ko: 'SNR과 Noise Floor를 분석해 Depth와 Amount를 제안합니다. Apply를 누르면 추천값이 설정에 반영됩니다.', en: 'Analyzes SNR and noise floor to suggest Depth and Amount. Apply writes the recommendation into the controls.' } },
  ],
  eq: [
    { name: 'EQ mode', values: 'MIN-φ / 9-BAND', detail: { ko: 'PARAMETERS 오른쪽 위 스위치로 기존 5밴드 Min-φ Parametric EQ와 9밴드 Graphic EQ를 전환합니다. 두 모드는 각각의 설정과 프리셋을 유지합니다.', en: 'Use the switch at the upper right of PARAMETERS to choose the original five-band Min-φ Parametric EQ or the nine-band Graphic EQ. Each mode retains its own settings and presets.' } },
    { name: 'Preset', values: 'Normal / Pop / Dance / Classic / User', detail: { ko: 'Normal은 평탄, Pop은 보컬·고역 강조, Dance는 저역과 Air 강조, Classic은 따뜻하고 부드러운 방향입니다.', en: 'Normal is flat; Pop lifts vocal/treble; Dance emphasizes lows and air; Classic is warmer and smoother.' } },
    { name: '9-Band', values: '63 Hz–16 kHz · ±12 dB', detail: { ko: '9개의 고정 주파수 슬라이더를 위아래로 드래그하거나 해당 주파수 위치에서 마우스 휠을 돌려 1 dB 단위로 조절합니다. 그래프 배경의 레벨 미터로 대역별 신호를 확인할 수 있습니다.', en: 'Drag the nine fixed-frequency sliders vertically, or use the mouse wheel over a band for 1 dB steps. The graph background meters show the live level in each band.' } },
    { name: '9-Band User', values: 'User 1–5', detail: { ko: 'User를 선택하면 5개의 사용자 슬롯이 나타납니다. 각 슬롯 메뉴에서 이름을 변경하고 현재 9밴드 설정을 저장하거나 다시 불러옵니다.', en: 'Selecting User reveals five user slots. Use a slot menu to rename it, save the current nine-band curve, or recall it later.' } },
    { name: 'Graph node', values: 'Drag / Wheel', detail: { ko: '노드를 좌우로 끌면 Frequency, 위아래로 끌면 Gain이 바뀝니다. 노드 위 휠은 Bell 밴드의 Q를 0.1 단위로 조절합니다.', en: 'Drag left/right for Frequency and up/down for Gain. Wheel over a Bell node adjusts Q in 0.1 steps.' } },
    { name: 'Band 1 · L-Shelf', values: '20–240 Hz', detail: { ko: '저역 전체의 무게를 넓게 조절합니다. Q는 0.71로 고정됩니다.', en: 'Broadly adjusts low-end weight. Q is fixed at 0.71.' } },
    { name: 'Band 2 · Bell', values: '80–600 Hz', detail: { ko: '저음의 두께와 탁함이 주로 위치하는 대역입니다.', en: 'Targets bass body and common muddy low-mid content.' } },
    { name: 'Band 3 · Bell', values: '300–3000 Hz', detail: { ko: '보컬·악기의 중심 존재감과 답답함을 조절합니다.', en: 'Shapes core vocal/instrument presence and boxiness.' } },
    { name: 'Band 4 · Bell', values: '2–9 kHz', detail: { ko: '명료도, 어택, 치찰음과 거친 느낌을 조절합니다.', en: 'Controls clarity, attack, sibilance, and harshness.' } },
    { name: 'Band 5 · H-Shelf', values: '6–20 kHz', detail: { ko: '고역의 공기감과 밝기를 넓게 조절합니다. Q는 0.71로 고정됩니다.', en: 'Broadly adjusts air and brightness. Q is fixed at 0.71.' } },
    { name: 'Gain / Q', values: 'Gain · Bell Q', detail: { ko: 'Gain은 증감량, Q는 영향 폭입니다. Q가 높을수록 좁고 정밀합니다. User 프리셋은 이름 변경 후 현재 설정을 저장할 수 있습니다.', en: 'Gain sets boost/cut; Q sets bandwidth. Higher Q is narrower. Rename and save the User preset to retain current settings.' } },
  ],
  dynamics: [
    { name: 'Low / Mid / High', values: '−18.0–0.0 dB · 0.1 dB', detail: { ko: '각 대역의 컴프레서 Threshold 성격 값입니다. 더 낮을수록 해당 대역이 더 많이 압축됩니다. 크로스오버는 200 Hz와 2 kHz로 고정입니다.', en: 'Threshold-like values for each band. Lower settings apply more compression. Crossovers are fixed at 200 Hz and 2 kHz.' } },
    { name: 'Ratio', values: '2:1 / 4:1 / 8:1', detail: { ko: 'Threshold를 넘는 신호를 누르는 비율입니다. 2:1은 자연스럽고 8:1은 강하게 제어합니다.', en: 'Compression ratio above threshold. 2:1 is gentle; 8:1 is firm control.' } },
    { name: 'Transient', values: '−50–+50% · 1%', detail: { ko: '양수는 어택을 살려 펀치와 스냅을 강조하고, 음수는 타격을 부드럽게 만듭니다.', en: 'Positive values preserve attack for punch and snap; negative values soften impacts.' } },
    { name: 'Exciter', values: '0–100% · 1%', detail: { ko: '3.5 kHz 이상 고역에 배음을 병렬로 더해 선명도를 높입니다. 과하면 거칠고 피곤하게 들립니다.', en: 'Adds parallel harmonics above 3.5 kHz for clarity. Excessive settings sound harsh and fatiguing.' } },
    { name: 'Gain Reduction', values: 'Low / Mid / High', detail: { ko: '왼쪽 막대로 대역별 압축량을 확인합니다. 한 대역만 계속 크게 줄어들면 Threshold를 완화하세요.', en: 'The left meters show reduction per band. Ease the threshold if one band remains heavily reduced.' } },
  ],
  stereo: [
    { name: 'Width', values: '0–200% · 1%', detail: { ko: '100%는 원본, 0%는 Side가 없는 모노, 200%는 Side를 두 배로 확장합니다.', en: '100% is original, 0% removes Side for mono, and 200% doubles Side width.' } },
    { name: 'Reverb', values: '0–30% · 1%', detail: { ko: '고정된 공간 잔향을 병렬로 더하는 Send 양입니다. 원본의 깊이가 흐려지지 않도록 소량부터 사용하세요.', en: 'Send amount into a fixed ambience reverb. Start subtly to avoid blurring depth.' } },
    { name: 'Delay', values: '0–30% · 1%', detail: { ko: '약 220 ms 딜레이와 피드백을 병렬로 더합니다. 리듬과 공간감을 만들지만 과하면 선명도가 떨어집니다.', en: 'Adds a parallel delay of about 220 ms with feedback. It adds rhythm and space but can reduce clarity.' } },
    { name: 'Bass Mono / Bass', values: '60–300 Hz · 5 Hz', detail: { ko: 'ON이면 설정 주파수 아래의 Side 성분을 제거해 저음을 중앙에 모읍니다.', en: 'When ON, removes Side content below the cutoff to center the bass.' } },
    { name: 'Mono Master', values: 'OFF / ON', detail: { ko: '전 대역을 (L+R)/2로 합친 실제 모노 마스터입니다. ON 상태는 Export에도 반영됩니다.', en: 'Creates a true full-band (L+R)/2 mono master. The ON state is also applied to Export.' } },
    { name: 'Correlation', values: '−1 … +1', detail: { ko: '+1에 가까울수록 모노 호환성이 좋습니다. 0 미만 RISK가 반복되면 Width·공간 효과를 줄여 확인하세요.', en: 'Values near +1 are mono-compatible. If RISK below 0 persists, reduce Width or spatial effects.' } },
  ],
  loudness: [
    { name: 'True Peak', values: '−3.0–0.0 dB · 0.1 dB', detail: { ko: '최종 출력 천장입니다. −1.0 dBTP는 스트리밍용으로 여유가 있는 출발점입니다.', en: 'Final output ceiling. −1.0 dBTP is a practical starting point with streaming headroom.' } },
    { name: 'LUFS', values: '−24–−6 LUFS · 1 LU', detail: { ko: '목표 Integrated Loudness입니다. 값을 높일수록 make-up gain과 리미팅이 증가합니다. 원본 LUFS 표시와는 별개입니다.', en: 'Target integrated loudness. Higher targets increase make-up gain and limiting. This differs from the measured source LUFS.' } },
    { name: 'Saturate', values: '0–100% · 1%', detail: { ko: '리미터 앞에서 부드러운 배음을 더해 밀도와 따뜻함을 만듭니다. THD 상태가 HOT이면 줄이는 편이 안전합니다.', en: 'Adds soft harmonics before limiting for density and warmth. Reduce it when THD status reaches HOT.' } },
    { name: 'Limiter', values: 'Clear / Punchy / Loud', detail: { ko: '릴리즈 캐릭터입니다. Clear는 0.18 s로 투명하게, Punchy는 0.12 s, Loud는 0.08 s로 빠르고 밀도 높게 동작합니다.', en: 'Release character: Clear is transparent at 0.18 s, Punchy uses 0.12 s, and Loud is fast/dense at 0.08 s.' } },
    { name: 'TP Limit', values: 'OFF / ON', detail: { ko: '2 ms 룩어헤드 리미터를 켜 피크가 천장을 넘기 전에 미리 줄입니다. 최종 출력에서는 ON을 권장합니다.', en: 'Enables the 2 ms lookahead limiter, reducing peaks before they cross the ceiling. Recommended for final output.' } },
  ],
  export: [
    { name: 'Album title', values: 'Text', detail: { ko: '앨범 또는 프로젝트 이름입니다. 비워 두면 Untitled Master가 표시됩니다.', en: 'Album or project name. Untitled Master is shown when empty.' } },
    { name: 'Artist / Composer', values: 'Text', detail: { ko: '아티스트·작곡가 메타데이터입니다.', en: 'Artist or composer metadata.' } },
    { name: 'Year / Genre', values: 'Text', detail: { ko: '발매 연도와 장르 태그입니다.', en: 'Release year and genre tags.' } },
    { name: 'Album Artwork', values: 'Drop image', detail: { ko: '아트워크 영역에 이미지를 끌어 놓아 출력 파일에 포함할 표지를 지정합니다.', en: 'Drop an image onto the artwork area to select cover art for output files.' } },
    { name: 'WAV', values: 'PCM', detail: { ko: '편집·보관에 적합한 무손실 PCM입니다. Input의 Rate와 PCM 비트 깊이를 따릅니다.', en: 'Lossless PCM for editing and archive. Uses the Input Rate and PCM depth.' } },
    { name: 'MP3 320', values: '320 kbps', detail: { ko: '용량이 작고 배포가 편리한 손실 압축 형식입니다.', en: 'Lossy 320 kbps format for smaller, convenient distribution files.' } },
    { name: 'FLAC', values: 'Lossless', detail: { ko: 'WAV보다 용량을 줄이면서 PCM 품질을 보존하는 무손실 형식입니다.', en: 'Lossless compression that preserves PCM quality with smaller files than WAV.' } },
  ],
  renderBatch: [
    { name: 'Render Batch', values: 'Multiple jobs', detail: { ko: '상단 Render Batch를 열면 여러 작업을 만들 수 있습니다. 각 작업은 원본 파일·폴더, Session Card, 출력 폴더를 독립적으로 가집니다.', en: 'Open Render Batch from the top bar to create multiple jobs. Each job has independent source files/folders, a Session Card, and an output folder.' } },
    { name: 'Original Sources', values: '+ FILE / + FOLDER / Drop', detail: { ko: '파일 또는 폴더를 여러 번 추가하거나 드래그 앤 드롭해 한 작업에 누적합니다. ×는 개별 파일 삭제, 제목 옆 ×는 해당 작업의 원본 전체 삭제입니다.', en: 'Add files or folders repeatedly, or drag and drop them into one job. Use × to remove one file, or the × beside the heading to clear all sources in that job.' } },
    { name: 'Session Card', values: 'SELECT / CHANGE', detail: { ko: '저장된 Session Card를 선택하면 해당 카드의 EQ 종류, 프리셋, 활성 이펙트와 출력 형식이 작업에 적용됩니다.', en: 'Choose a saved Session Card to apply its EQ type, preset, enabled effects, and output format to that job.' } },
    { name: 'Add Batch Job', values: '+ ADD BATCH JOB', detail: { ko: '서로 다른 원본 묶음에 다른 Session Card를 적용하려면 작업을 추가합니다. START는 모든 작업을 위에서 아래 순서로 처리합니다.', en: 'Add another job when different source groups need different Session Cards. START processes every job from top to bottom.' } },
  ],
};

const MEDIA: Partial<Record<string, Media[]>> = {
  overview: [
    { src: appOverviewImage, caption: { ko: '전체 앱 화면 — 상단 메뉴, Transport, 7단계 체인, 상세 화면과 하단 상태 표시', en: 'Full app — top menu, Transport, seven-stage chain, detail pane, and status footer' } },
  ],
  workflow: [
    { src: transportPanelImage, caption: { ko: 'F4로 연 Transport 파형 패널', en: 'Transport waveform panel opened with F4' } },
    { src: loadedFileInfoImage, caption: { ko: '파일 로드 후 큐와 선택 파일 분석 정보', en: 'Queue and selected-file analysis after loading audio' } },
    { src: playProgressImage, caption: { ko: '재생 중 하단 진행 바와 현재 시간', en: 'Lower progress bar and current time during playback' } },
    { src: transportPlayingImage, caption: { ko: 'Transport 패널 재생 상태와 재생 헤드', en: 'Transport playback state and playhead' } },
    { src: transportLoopImage, caption: { ko: 'A/B 시작·끝 지점을 이용한 구간 반복', en: 'A/B loop using start and end markers' } },
    { src: bypassToggleImage, caption: { ko: '섹션별 Bypass ON/OFF 비교', en: 'Per-section Bypass ON/OFF comparison' } },
    { src: previewToggleImage, caption: { ko: '원음과 전체 처리음을 비교하는 Preview ON/OFF', en: 'Preview ON/OFF for source versus processed comparison' } },
  ],
  input: [{ src: inputDetailsImage, caption: { ko: 'Input 상세 화면 — 큐, 입력 규격, 배치 정보와 선택 파일 메타데이터', en: 'Input detail — queue, input format, batch information, and selected-file metadata' } }],
  pre: [
    { src: preNoiseAnalysisImage, caption: { ko: 'Pre Processing 상세 화면과 노이즈 분석 결과', en: 'Pre Processing detail and noise analysis result' } },
    { src: preDenoiseOnImage, caption: { ko: 'Denoise를 켰을 때의 분석·처리 상태', en: 'Analysis and processing state with Denoise enabled' } },
    { src: preSpectrumControlsImage, caption: { ko: '3D 스펙트럼 회전·확대·이동 조작 안내', en: '3D spectrum rotate, zoom, and pan controls' } },
    { src: preAutoSettingsImage, caption: { ko: '노이즈 분석 후 추천 Depth·Amount 적용', en: 'Applying recommended Depth and Amount after analysis' } },
  ],
  eq: [
    { src: eqOverviewImage, caption: { ko: 'Spectral EQ 그래프와 프리셋 선택', en: 'Spectral EQ graph and preset selection' } },
    { src: eqAdvancedImage, caption: { ko: 'Advanced — 5개 밴드의 Frequency·Gain·Q', en: 'Advanced — Frequency, Gain, and Q for five bands' } },
    { src: eqUserPresetImage, caption: { ko: 'User 프리셋 선택', en: 'Selecting the User preset' } },
    { src: eqPresetSaveImage, caption: { ko: 'User 프리셋 이름 변경과 현재 설정 저장', en: 'Renaming and saving current settings to a User preset' } },
    { src: eq9BandOverviewImage, caption: { ko: '9-Band EQ 기본 화면 — 9개 고정 주파수와 모드 전환 스위치', en: '9-Band EQ overview — nine fixed frequencies and the mode switch' } },
    { src: eq9BandUserPresetsImage, caption: { ko: '9-Band Pop 프리셋 곡선과 User 1–5 사용자 프리셋', en: '9-Band Pop curve and the User 1–5 preset slots' } },
  ],
  dynamics: [{ src: dynamicsDetailsImage, caption: { ko: 'Dynamics — 3밴드 Gain Reduction, Ratio, Transient와 Exciter', en: 'Dynamics — three-band gain reduction, Ratio, Transient, and Exciter' } }],
  stereo: [{ src: stereoDetailsImage, caption: { ko: 'Stereo — Width·공간 효과·Bass Mono와 Correlation', en: 'Stereo — Width, spatial effects, Bass Mono, and Correlation' } }],
  loudness: [{ src: loudnessDetailsImage, caption: { ko: 'Loudness / Limiter — 목표 LUFS, True Peak, Saturation과 Limiter', en: 'Loudness / Limiter — target LUFS, True Peak, Saturation, and Limiter' } }],
  export: [
    { src: exportDetailsImage, caption: { ko: 'Export — 메타데이터, 아트워크, 저장 위치와 출력 포맷', en: 'Export — metadata, artwork, destination, and output format' } },
  ],
  renderBatch: [
    { src: renderBatchOverviewImage, caption: { ko: 'Render Batch 기본 화면 — 원본, Session Card, 출력으로 구성된 첫 작업', en: 'Render Batch overview — the first source, Session Card, and output job' } },
    { src: renderBatchSessionPickerImage, caption: { ko: '저장된 Session Card 목록에서 작업에 적용할 설정 선택', en: 'Selecting the settings to apply from saved Session Cards' } },
    { src: renderBatchSessionLoadedImage, caption: { ko: '원본 파일과 Session Card가 준비되어 START가 활성화된 작업', en: 'A job ready to start with source files and a loaded Session Card' } },
    { src: renderBatchAddJobImage, caption: { ko: '다른 Session Card를 적용하기 위한 두 번째 Batch Job 추가', en: 'Adding a second Batch Job for a different Session Card' } },
    { src: renderBatchMultipleJobsImage, caption: { ko: '서로 다른 원본 묶음과 Session Card를 지정한 다중 작업 목록', en: 'Multiple jobs with different source groups and Session Cards' } },
  ],
};

function Marked({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return <>{parts.map((part, i) => part.toLocaleLowerCase().includes(q.toLocaleLowerCase()) ? <mark key={i} style={{ background: 'var(--t-aBright)', color: 'var(--t-aInk)', borderRadius: 2 }}>{part}</mark> : <Fragment key={i}>{part}</Fragment>)}</>;
}

export function ManualWindow() {
  const [lang, setLang] = useState<Lang>('ko');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('overview');
  const [resultIndex, setResultIndex] = useState(0);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return [];
    return SECTIONS.filter((s) => {
      const searchPool = [
        s.title[lang],
        s.intro[lang],
        ...s.steps[lang],
        s.effect?.[lang] || '',
        ...(SETTINGS[s.id] || []).flatMap((setting) => [setting.name, setting.values, setting.detail[lang]]),
        ...(MEDIA[s.id] || []).map((media) => media.caption[lang]),
      ];
      if (s.id === 'glossary') {
        GLOSSARY_ITEMS.forEach((item) => {
          searchPool.push(item.term[lang], item.desc[lang], item.effect[lang]);
        });
      }
      return searchPool.join(' ').toLocaleLowerCase().includes(q);
    });
  }, [lang, query]);

  const goTo = (id: string) => {
    setActive(id);
    refs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const moveResult = (delta: number) => {
    if (!matches.length) return;
    const next = (resultIndex + delta + matches.length) % matches.length;
    setResultIndex(next);
    goTo(matches[next].id);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--t-paperA)', color: 'var(--t-pInk)', fontFamily: 'Archivo, sans-serif' }}>
      <header className="app-drag" style={{ height: 58, flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', background: 'var(--t-paperB)', borderBottom: '1px solid var(--t-ell)' }}>
        <img src={logoUrl} alt="" style={{ width: 25, height: 25, objectFit: 'contain' }} />
        <strong style={{ fontFamily: 'Spectral, serif', fontSize: 16, letterSpacing: '.04em', color: 'var(--t-pInk)' }}>FocusDAW Mastering Manual</strong>
        <span style={{ padding: '2px 7px', border: '1px solid var(--t-ell)', borderRadius: 5, fontSize: 10, color: 'var(--t-aBright)' }}>Station Edition</span>
        <div className="app-no-drag" style={{ margin: '0 auto', width: 390, height: 34, display: 'flex', alignItems: 'center', gap: 9, padding: '0 11px', border: '1px solid var(--t-ell)', borderRadius: 9, background: 'var(--t-paperInput)' }}>
          <span style={{ color: 'var(--t-pInk2)' }}>⌕</span>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setResultIndex(0); }}
            onKeyDown={(e) => { if (e.key === 'Enter') moveResult(e.shiftKey ? -1 : 1); }}
            placeholder={lang === 'ko' ? '매뉴얼 검색' : 'Search manual'}
            style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--t-pInk)', font: '12px Archivo' }}
          />
          <span style={{ fontSize: 10, color: 'var(--t-pInk2)' }}>{matches.length ? `${resultIndex + 1}/${matches.length}` : '0/0'}</span>
          <button onClick={() => moveResult(-1)} style={navButton}>‹</button>
          <button onClick={() => moveResult(1)} style={navButton}>›</button>
        </div>
        <div className="app-no-drag" style={{ display: 'flex', padding: 2, border: '1px solid var(--t-ell)', borderRadius: 8, background: 'var(--t-paperInput)' }}>
          {(['ko', 'en'] as Lang[]).map((code) => <button key={code} onClick={() => { setLang(code); setResultIndex(0); }} style={{ border: 0, borderRadius: 6, padding: '5px 10px', background: lang === code ? 'var(--t-aMain)' : 'transparent', color: lang === code ? 'var(--t-aInk)' : 'var(--t-pInk2)', fontFamily: 'Archivo, sans-serif', fontSize: 8, fontWeight: 700, cursor: 'pointer' }}>{code === 'ko' ? '한글' : 'English'}</button>)}
        </div>
        <button className="app-no-drag" aria-label="Close" onClick={() => window.focusdaw?.win?.close?.()} style={{ ...navButton, fontSize: 20, color: 'var(--t-pInk)', marginLeft: 6 }}>×</button>
      </header>

      <div style={{ minHeight: 0, flex: 1, display: 'flex' }}>
        <nav style={{ width: 230, flex: 'none', padding: '20px 12px', overflowY: 'auto', background: 'var(--t-paperB)', borderRight: '1px solid var(--t-ell)' }}>
          <div style={{ padding: '0 10px 10px', color: 'var(--t-pInk2)', fontSize: 10, fontWeight: 700, letterSpacing: '.12em' }}>{lang === 'ko' ? '목차' : 'CHAPTERS'}</div>
          {SECTIONS.map((section, i) => (
            <button key={section.id} onClick={() => goTo(section.id)} style={{ width: '100%', border: active === section.id ? '1px solid var(--t-aMain)' : '1px solid transparent', borderRadius: 7, padding: '9px 12px', background: active === section.id ? 'var(--t-aMain)' : 'transparent', color: active === section.id ? 'var(--t-aInk)' : 'var(--t-pInk)', textAlign: 'left', font: '12px Archivo', cursor: 'pointer', marginBottom: 2 }}>
              {i + 1}. {section.title[lang]}
            </button>
          ))}
        </nav>

        <main style={{ flex: 1, overflowY: 'auto', padding: '30px clamp(30px, 5vw, 70px) 70px', background: 'radial-gradient(circle at 80% 0%, var(--t-paperA) 0, var(--t-paperB) 115%)' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <SignalFlow lang={lang} />
            {SECTIONS.map((section) => (
              <article
                key={section.id}
                id={section.id}
                ref={(node) => { refs.current[section.id] = node; }}
                onMouseEnter={() => setActive(section.id)}
                style={{ scrollMarginTop: 24, marginTop: 18, padding: '25px 28px', background: 'var(--t-cardSelA)', border: '1px solid var(--t-ell)', borderRadius: 12, boxShadow: '0 14px 34px -24px rgba(0,0,0,.8)' }}
              >
                <h2 style={{ margin: 0, fontFamily: 'Spectral, serif', fontSize: 23, color: 'var(--t-pInk)' }}><Marked text={section.title[lang]} query={query} /></h2>
                <div style={{ height: 1, margin: '12px 0 15px', background: 'var(--t-ell)' }} />
                <p style={{ margin: 0, color: 'var(--t-pInk)', fontSize: 13.5, lineHeight: 1.75 }}><Marked text={section.intro[lang]} query={query} /></p>
                {!!section.steps[lang].length && (
                  <ul style={{ margin: '14px 0 0', paddingLeft: 22, color: 'var(--t-pInk2)', fontSize: 12.5, lineHeight: 1.75 }}>
                    {section.steps[lang].map((step) => <li key={step} style={{ marginBottom: 4 }}><Marked text={step} query={query} /></li>)}
                  </ul>
                )}
                {section.id === 'glossary' && (
                  <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
                    {GLOSSARY_ITEMS.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '16px 18px',
                          border: '1px solid var(--t-ell)',
                          borderRadius: 10,
                          background: 'var(--t-cardA)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                        }}
                      >
                        <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--t-aMain)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ display: 'inline-block', width: 6, height: 16, background: 'var(--t-aMain)', borderRadius: 2 }} />
                          <Marked text={item.term[lang]} query={query} />
                        </h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, lineHeight: 1.65 }}>
                          <div>
                            <strong style={{ color: 'var(--t-pInk)', display: 'block', marginBottom: 2 }}>
                              {lang === 'ko' ? '💡 기본 개념' : '💡 Concept'}
                            </strong>
                            <span style={{ color: 'var(--t-pInk2)' }}>
                              <Marked text={item.desc[lang]} query={query} />
                            </span>
                          </div>
                          
                          <div style={{ padding: '8px 10px', background: 'var(--t-cardSelA)', borderLeft: '3px solid var(--t-aBright)', borderRadius: '0 6px 6px 0', marginTop: 4 }}>
                            <strong style={{ color: 'var(--t-aBright)', display: 'block', marginBottom: 2 }}>
                              {lang === 'ko' ? '🎧 실제 적용 효과' : '🎧 Audible Effect'}
                            </strong>
                            <span style={{ color: 'var(--t-pInk)' }}>
                              <Marked text={item.effect[lang]} query={query} />
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {section.id === 'pre' && (
                  <div style={{ marginTop: 18, marginBottom: 10 }}>
                    <div style={{ marginBottom: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--t-pInk)' }}>
                      {lang === 'ko' ? '■ 지능형 Denoise 추천 기준표' : '■ Intelligent Denoise Recommendation Table'}
                    </div>
                    <div style={{ overflow: 'hidden', border: '1px solid var(--t-ell)', borderRadius: 8 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, color: 'var(--t-pInk)', background: 'var(--t-cardA)' }}>
                        <thead>
                          <tr style={{ background: 'var(--t-paperCtl)', borderBottom: '1px solid var(--t-ell)', textAlign: 'left', fontWeight: 700 }}>
                            <th style={{ padding: '9px 12px', borderRight: '1px solid var(--t-ell)' }}>{lang === 'ko' ? 'SNR 범위' : 'SNR Range'}</th>
                            <th style={{ padding: '9px 12px', borderRight: '1px solid var(--t-ell)' }}>{lang === 'ko' ? '판정 상태' : 'Status'}</th>
                            <th style={{ padding: '9px 12px', borderRight: '1px solid var(--t-ell)' }}>{lang === 'ko' ? '추천 Depth' : 'Recommended Depth'}</th>
                            <th style={{ padding: '9px 12px' }}>{lang === 'ko' ? '추천 노브량 (Amount)' : 'Recommended Amount'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { snr: '100 dB 이상', snrEn: '100 dB or more', status: 'Very Clean', statusKo: 'Very Clean', depth: 'Original (1)', amount: '5%', color: '#4ea5ff' },
                            { snr: '90 ~ 100 dB', snrEn: '90 to 100 dB', status: 'Clean', statusKo: 'Clean', depth: 'Original (1)', amount: '10%', color: '#4ea5ff' },
                            { snr: '80 ~ 90 dB', snrEn: '80 to 90 dB', status: 'Light Clean', statusKo: 'Light Clean', depth: 'Original (1)', amount: '25%', color: '#46d36e' },
                            { snr: '60 ~ 80 dB', snrEn: '60 to 80 dB', status: 'Moderate Noise', statusKo: 'Moderate Noise', depth: 'Normal (2)', amount: '10%', color: '#a2db34' },
                            { snr: '40 ~ 60 dB', snrEn: '40 to 60 dB', status: 'Heavy Noise', statusKo: 'Heavy Noise', depth: 'Normal (2)', amount: '30%', color: '#ff983d' },
                            { snr: '40 dB 미만', snrEn: 'Less than 40 dB', status: 'Extreme Noise', statusKo: 'Extreme Noise', depth: 'Deep (3)', amount: '50%', color: '#ff5a5a' },
                          ].map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: idx < 5 ? '1px solid var(--t-ell)' : 'none', background: idx % 2 ? 'var(--t-cardSelA)' : 'var(--t-cardA)' }}>
                              <td style={{ padding: '8px 12px', borderRight: '1px solid var(--t-ell)' }}>{lang === 'ko' ? row.snr : row.snrEn}</td>
                              <td style={{ padding: '8px 12px', borderRight: '1px solid var(--t-ell)', color: row.color, fontWeight: 700 }}>{row.status}</td>
                              <td style={{ padding: '8px 12px', borderRight: '1px solid var(--t-ell)' }}>{row.depth}</td>
                              <td style={{ padding: '8px 12px' }}>{row.amount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {section.id === 'loudness' && (
                  <div style={{ marginTop: 18, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Saturate Card */}
                    <div style={{ border: '1px solid var(--t-ell)', borderRadius: 8, padding: '14px 16px', background: 'var(--t-cardA)', color: 'var(--t-pInk)' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--t-aMain)' }}>
                        {lang === 'ko' ? '■ Saturate (포화/새츄레이션) 가이드' : '■ Saturate Guide'}
                      </div>
                      <div style={{ fontSize: 11.5, lineHeight: 1.65 }}>
                        {lang === 'ko' ? (
                          <>
                            <div style={{ marginBottom: 6 }}><strong>개념:</strong> 리미터 도달 전에 진공관이나 테이프처럼 부드러운 배음(Harmonics) 왜곡을 더해 소리를 더 단단하고 따뜻하게 만들어 줍니다.</div>
                            <div style={{ marginBottom: 6 }}><strong style={{ color: '#46d36e' }}>장점 (Pros):</strong> 피크 레벨을 물리적으로 손상시키지 않으면서 청감상 음량(perceived volume)을 효과적으로 키우고, 차가운 디지털 음원에 아날로그 특유의 따뜻한 질감과 음악적 색채를 부여합니다.</div>
                            <div style={{ marginBottom: 6 }}><strong style={{ color: '#ff5a5a' }}>단점 (Cons):</strong> 과도하게 설정할 경우 고음역대가 답답해지거나 저음역대에서 찌그러짐(디지털 클릭/클립성 왜곡)이 들릴 수 있으며, 다이내믹 레인지 및 트랜지언트(타격감)가 일부 손실될 수 있습니다.</div>
                            <div><strong>팁 (Tip):</strong> 레벨 메타 옆의 THD 판정이 HOT(붉은색)에 자주 머무른다면 노브 양을 낮추는 것이 바람직합니다.</div>
                          </>
                        ) : (
                          <>
                            <div style={{ marginBottom: 6 }}><strong>Concept:</strong> Adds soft harmonic saturation (like tubes or tape) before the limiter, enhancing overall density and warmth.</div>
                            <div style={{ marginBottom: 6 }}><strong style={{ color: '#46d36e' }}>Pros:</strong> Effectively increases perceived loudness without causing harsh digital clipping, and infuses clinical digital tracks with pleasant analog warmth and character.</div>
                            <div style={{ marginBottom: 6 }}><strong style={{ color: '#ff5a5a' }}>Cons:</strong> Excessive amounts can degrade treble clarity, cause mud or crackling in the low end, and mask the original transient punch and depth.</div>
                            <div><strong>Tip:</strong> If the THD status panel frequently lights up as HOT (red), it is safer to decrease the Saturate level.</div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* LUFS Card */}
                    <div style={{ border: '1px solid var(--t-ell)', borderRadius: 8, padding: '14px 16px', background: 'var(--t-cardA)', color: 'var(--t-pInk)' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--t-aMain)' }}>
                        {lang === 'ko' ? '■ LUFS (체감 음량 표준) 가이드' : '■ LUFS (Loudness Units Full Scale) Guide'}
                      </div>
                      <div style={{ fontSize: 11.5, lineHeight: 1.65 }}>
                        {lang === 'ko' ? (
                          <>
                            <div style={{ marginBottom: 6 }}><strong>개념:</strong> 인간이 실제로 느끼는 주파수대역별 감도(K-weighting)를 모사하여 측정하는 국제 표준(ITU-R BS.1770) Integrated Loudness 단위입니다.</div>
                            <div style={{ marginBottom: 6 }}><strong>필요성:</strong> 과거 오직 피크 레벨만 깎아내며 전체 볼륨을 비정상적으로 키우던 음압 경쟁(Loudness War)을 지양하고, 다른 음원들과 일관된 볼륨 밸런스를 맞추기 위해 사용됩니다.</div>
                            <div style={{ marginBottom: 6 }}><strong>방송과 음원의 차이:</strong> TV/라디오 등 방송 규격은 대개 매우 엄격한 <strong>-24 LUFS</strong> 기준을 강제 고수하는 반면, 일반 음악 스트리밍 및 상업 음원은 보통 <strong>-14 LUFS ~ -9 LUFS</strong> 범위로 더 높게 마스터링합니다.</div>
                            <div>
                              <strong>주요 플랫폼별 권장 타겟 레벨:</strong>
                              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                                <li><strong>YouTube / Spotify:</strong> 약 <strong>-14 LUFS</strong> (이 레벨보다 크게 만들 경우 플랫폼 내에서 강제로 볼륨을 낮춰 서비스합니다.)</li>
                                <li><strong>Apple Music:</strong> 약 <strong>-16 LUFS</strong></li>
                                <li><strong>상업 음반 (Pop/CD/Club):</strong> <strong>-9 LUFS ~ -8 LUFS</strong> 수준으로 강하게 마스터링하기도 하나, 스트리밍 시 노멀라이제이션으로 인해 볼륨이 크게 깎이고 다이내믹이 찌그러질 위험을 감안하여 목적에 맞는 타겟을 설정해야 합니다.</li>
                              </ul>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ marginBottom: 6 }}><strong>Concept:</strong> An international standard unit (ITU-R BS.1770) for measuring integrated perceived loudness, incorporating frequency weighting (K-weighting) based on human hearing.</div>
                            <div style={{ marginBottom: 6 }}><strong>Why it matters:</strong> Prevents the "Loudness War" where producers squashed all dynamics just to maximize peak levels, ensuring a more consistent listener experience across tracks.</div>
                            <div style={{ marginBottom: 6 }}><strong>Broadcast vs. Music:</strong> TV and radio standards strictly enforce a quiet <strong>-24 LUFS</strong> limit, whereas modern commercial music is mastered much louder, typically ranging from <strong>-14 LUFS to -9 LUFS</strong>.</div>
                            <div>
                              <strong>Platform Normalization Targets:</strong>
                              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                                <li><strong>YouTube / Spotify:</strong> ~<strong>-14 LUFS</strong> (Tracks exceeding this level will have their volume automatically attenuated by the player.)</li>
                                <li><strong>Apple Music:</strong> ~<strong>-16 LUFS</strong></li>
                                <li><strong>Commercial Masters (Pop/Club):</strong> Often finalized at <strong>-9 LUFS to -8 LUFS</strong> for raw delivery. Note that platforms will turn these down, which may make them sound flatter than dynamic mixes.</li>
                              </ul>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {section.id === 'tips' && (
                  <div style={{ marginTop: 18, marginBottom: 10 }}>
                    <div style={{ marginBottom: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--t-pInk)' }}>
                      {lang === 'ko' ? '■ 단축키 및 조작 목록' : '■ Shortcut & Control List'}
                    </div>
                    <div style={{ overflow: 'hidden', border: '1px solid var(--t-ell)', borderRadius: 8 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, color: 'var(--t-pInk)', background: 'var(--t-cardA)' }}>
                        <thead>
                          <tr style={{ background: 'var(--t-paperCtl)', borderBottom: '1px solid var(--t-ell)', textAlign: 'left', fontWeight: 700 }}>
                            <th style={{ padding: '9px 12px', borderRight: '1px solid var(--t-ell)', width: '40%' }}>{lang === 'ko' ? '기능 / 조작' : 'Action / Control'}</th>
                            <th style={{ padding: '9px 12px' }}>{lang === 'ko' ? '단축키 / 입력 방법' : 'Shortcut / Input'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { action: '재생 / 일시정지', actionEn: 'Play / Pause', key: 'Space', keyEn: 'Space' },
                            { action: 'Transport 패널 토글', actionEn: 'Toggle Transport Panel', key: 'F4', keyEn: 'F4' },
                            { action: '실행 취소 (Undo)', actionEn: 'Undo', key: 'Ctrl + Z', keyEn: 'Ctrl + Z' },
                            { action: '다시 실행 (Redo)', actionEn: 'Redo', key: 'Ctrl + Y  또는  Ctrl + Shift + Z', keyEn: 'Ctrl + Y  or  Ctrl + Shift + Z' },
                            { action: '노브 기본값 복원', actionEn: 'Reset Knob to Default', key: '마우스 더블 클릭', keyEn: 'Double-Click' },
                          ].map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: idx < 4 ? '1px solid var(--t-ell)' : 'none', background: idx % 2 ? 'var(--t-cardSelA)' : 'var(--t-cardA)' }}>
                              <td style={{ padding: '8px 12px', borderRight: '1px solid var(--t-ell)', fontWeight: 600 }}>{lang === 'ko' ? row.action : row.actionEn}</td>
                              <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', color: 'var(--t-aMain)', fontWeight: 700 }}>{lang === 'ko' ? row.key : row.keyEn}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {section.effect && <div style={{ marginTop: 16, padding: '11px 14px', borderLeft: '3px solid var(--t-aMain)', borderRadius: '0 7px 7px 0', background: 'var(--t-cardA)', color: 'var(--t-pInk)', fontSize: 12.5, lineHeight: 1.65 }}><Marked text={section.effect[lang]} query={query} /></div>}
                {!!SETTINGS[section.id]?.length && (
                  <div style={{ marginTop: 22 }}>
                    <h3 style={{ margin: '0 0 9px', fontFamily: 'Spectral, serif', fontSize: 16, color: 'var(--t-pInk)' }}>
                      {lang === 'ko' ? '설정값과 조작 방법' : 'Settings and controls'}
                    </h3>
                    <div style={{ overflow: 'hidden', border: '1px solid var(--t-ell)', borderRadius: 8 }}>
                      {SETTINGS[section.id]!.map((setting, index) => (
                        <div
                          key={`${setting.name}-${index}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(115px, .7fr) minmax(125px, .8fr) 2.5fr',
                            gap: 12,
                            padding: '10px 12px',
                            alignItems: 'start',
                            background: index % 2 ? 'var(--t-cardA)' : 'var(--t-cardSelA)',
                            borderTop: index ? '1px solid var(--t-ell)' : 'none',
                            fontSize: 11.5,
                            lineHeight: 1.55,
                          }}
                        >
                          <strong style={{ color: 'var(--t-pInk)' }}><Marked text={setting.name} query={query} /></strong>
                          <span style={{ color: 'var(--t-aMain)', fontWeight: 700 }}><Marked text={setting.values} query={query} /></span>
                          <span style={{ color: 'var(--t-pInk2)' }}><Marked text={setting.detail[lang]} query={query} /></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!!MEDIA[section.id]?.length && (
                  <div style={{ display: 'grid', gridTemplateColumns: MEDIA[section.id]!.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14, marginTop: 22 }}>
                    {MEDIA[section.id]!.map((media, index) => (
                      <figure key={`${media.src}-${index}`} style={{ margin: 0, padding: 8, border: '1px solid var(--t-ell)', borderRadius: 9, background: 'var(--t-cardA)' }}>
                        <img src={media.src} alt={media.caption[lang]} style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 6, background: 'var(--t-panelDark)' }} />
                        <figcaption style={{ padding: '8px 5px 2px', color: 'var(--t-pInk2)', fontSize: 10.5, lineHeight: 1.45, textAlign: 'center' }}>
                          <Marked text={media.caption[lang]} query={query} />
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

const navButton: React.CSSProperties = { border: 0, padding: '1px 5px', background: 'transparent', color: 'var(--t-pInk2)', cursor: 'pointer' };

function SignalFlow({ lang }: { lang: Lang }) {
  const labels = lang === 'ko'
    ? ['입력', '전처리', 'EQ', '다이내믹', '스테레오', '음량', '출력']
    : ['Input', 'Pre', 'EQ', 'Dynamics', 'Stereo', 'Loudness', 'Export'];
  return (
    <section style={{ padding: '20px 24px', borderRadius: 12, background: 'var(--t-cardSelA)', border: '1px solid var(--t-ell)' }}>
      <div style={{ marginBottom: 13, color: 'var(--t-pInk2)', fontSize: 10, fontWeight: 700, letterSpacing: '.12em' }}>{lang === 'ko' ? '신호 흐름' : 'SIGNAL FLOW'}</div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {labels.map((label, i) => <Fragment key={label}><div style={{ flex: 1, minWidth: 62, padding: '10px 4px', textAlign: 'center', borderRadius: 7, background: i === 0 || i === 6 ? 'var(--t-aMain)' : 'var(--t-paperCtl)', color: i === 0 || i === 6 ? 'var(--t-aInk)' : 'var(--t-pInk)', fontSize: 11 }}><b style={{ display: 'block', color: i === 0 || i === 6 ? 'var(--t-aInk)' : 'var(--t-aBright)', marginBottom: 3 }}>{['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][i]}</b>{label}</div>{i < 6 && <span style={{ padding: '0 5px', color: 'var(--t-aMain)' }}>›</span>}</Fragment>)}
      </div>
    </section>
  );
}
