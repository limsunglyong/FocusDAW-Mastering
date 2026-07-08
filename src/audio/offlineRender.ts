// FocusDAW Mastering Desk v0.14.5 - 오프라인 체인 렌더 코어(정규화/리미터 前) + Preview 라우드니스 트림 산출
// Export(renderOffline.renderMaster)와 Preview(previewEngine)가 "동일한 체인 실측"을 쓰도록,
// buildMasterChain 을 OfflineAudioContext 에서 1회 렌더해 정규화/리미터 직전의 처리 PCM 을 돌려주는
// renderChainOffline 을 이 곳에 둔다. Export 는 그 위에 closed-loop 정규화+True-Peak 리미팅을 얹고,
// Preview 는 그 실측 LUFS 로부터 Export 와 동일한 정규화 게인(computeLoudnessTrim)을 구해 실시간
// 그래프의 normTrim 노드에 걸어(v0.14.5) Preview 라우드니스를 Export 와 일치시킨다.
//
//   processingBuffer → OfflineAudioContext(outCh·len·rate) → buildMasterChain(workletReady=false,
//     normTrim=1) → startRendering() → RenderedAudio(정규화/리미터 前)
import { buildMasterChain, makeReverbIR, num, type PreviewParams } from './masterChain';
import { integratedLufsFromChannels } from './loudness';
import { loudnessGain } from './loudnessDsp';

/** 인코더/실측으로 넘기는 렌더 결과(AudioBuffer 비의존 — Export/Preview 공용). */
export type RenderedAudio = {
  sampleRate: number;
  numberOfChannels: number;
  length: number;
  channelData: Float32Array[];
};

/**
 * 현재 마스터 체인을 정규화/리미터 直前까지 오프라인 렌더한다(Export·Preview 공용 실측 기준).
 * Mono Master ON 이면 출력 채널을 1ch 로 만든다(체인 2ch 합 → destination 다운믹스).
 * @param buffer 사용자 Input Rate 로 변환된 processingBuffer
 * @param params 현재 vals/enabled/meta (Preview 와 동일 파라미터)
 */
export async function renderChainOffline(buffer: AudioBuffer, params: PreviewParams): Promise<RenderedAudio> {
  if (typeof OfflineAudioContext === 'undefined') {
    throw new Error('OfflineAudioContext is not available.');
  }
  const rate = buffer.sampleRate;
  const srcChannels = Math.max(1, buffer.numberOfChannels);
  const monoMaster = !!params.vals['stereo.mono'];
  const outChannels = monoMaster ? 1 : srcChannels;
  const length = buffer.length;

  const offline = new OfflineAudioContext(outChannels, length, rate);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  const reverbIR = makeReverbIR(offline);
  // workletReady=false → Loudness 단은 리미터 노드 없이 빌드(±headroom 통과). normTrim 은 기본 1(투명).
  const { output } = buildMasterChain(offline, source, params, {
    nodes: [],
    offset: 0,
    workletReady: false,
    reverbIR,
    channels: srcChannels,
  });
  output.connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();
  const channelData: Float32Array[] = [];
  for (let c = 0; c < outChannels; c++) {
    channelData.push(Float32Array.from(rendered.getChannelData(c)));
  }
  return { sampleRate: rate, numberOfChannels: outChannels, length, channelData };
}

// v0.14.5: 트림 실측은 "대표 구간 샘플링"으로 전체트랙 렌더(3~4분 트랙 ≈ 12s)를 ~1.9s 로 줄인다.
// 트랙 전역에 퍼진 짧은 윈도우 몇 개를 이어붙여 그 LUFS 로 트림을 추정한다. 실측상 전체트랙 대비
// 오차 ≈ 0.15 dB(가청 이하) — Preview↔Export 정합엔 충분(Export 자신은 여전히 전체트랙 정규화로 정확).
const TRIM_SAMPLE_MIN_SEC = 45;             // 이보다 짧으면 슬라이싱 이득 없음 → 전체 측정
const TRIM_SAMPLE_WINDOW_SEC = 8;           // 각 윈도우 길이
const TRIM_SAMPLE_FRACTIONS = [0.1, 0.37, 0.63, 0.9]; // 트랙 내 위치(시작/후렴/브릿지/후반 커버)

/** 트랙 전역에서 windowSec 길이 윈도우들을 위치 fractions 로 떠 이어붙인 대표 버퍼. */
function buildSampledBuffer(buffer: AudioBuffer, windowSec: number, fractions: number[]): AudioBuffer {
  const rate = buffer.sampleRate;
  const ch = Math.max(1, buffer.numberOfChannels);
  const wlen = Math.min(buffer.length, Math.round(windowSec * rate));
  const out = new AudioBuffer({ length: wlen * fractions.length, numberOfChannels: ch, sampleRate: rate });
  fractions.forEach((frac, idx) => {
    const start = Math.max(0, Math.min(buffer.length - wlen, Math.round(frac * (buffer.length - wlen))));
    for (let c = 0; c < ch; c++) {
      out.copyToChannel(buffer.getChannelData(c).subarray(start, start + wlen), c, idx * wlen);
    }
  });
  return out;
}

/**
 * Preview 용 closed-loop 라우드니스 트림 게인(선형). Export 의 렌더-後 정규화(normalizeToTargetLufs)와
 * 동일한 계산: 정규화 直前 처리 PCM 을 실측(BS.1770)해 Loudness Target 과의 보정 게인을 구한다.
 * 긴 트랙은 대표 구간만 렌더해 실측(속도), make-up 은 여전히 원본 전체 LUFS(meta.integratedLufs) 기준.
 * Loudness 섹션 bypass 시(정규화 안 함) 또는 실측 불가면 1(무보정).
 */
export async function computeLoudnessTrim(buffer: AudioBuffer, params: PreviewParams): Promise<number> {
  if (!params.enabled.loudness) return 1;
  let measureBuffer = buffer;
  let measureParams = params;
  if (buffer.duration > TRIM_SAMPLE_MIN_SEC) {
    measureBuffer = buildSampledBuffer(buffer, TRIM_SAMPLE_WINDOW_SEC, TRIM_SAMPLE_FRACTIONS);
    // 슬라이스 경계의 Pre fade 아티팩트 방지 + meta 를 샘플 버퍼 길이에 맞춤.
    // (make-up 기준인 meta.integratedLufs·peakDb 는 원본 전체값 그대로 유지 — Export 와 동일.)
    measureParams = {
      ...params,
      vals: { ...params.vals, 'pre.fadein': 0, 'pre.fadeout': 0 },
      meta: { ...params.meta, duration: measureBuffer.duration, length: measureBuffer.length },
    };
  }
  const rendered = await renderChainOffline(measureBuffer, measureParams);
  const measured = integratedLufsFromChannels(rendered.channelData, rendered.sampleRate);
  return loudnessGain(num(params.vals['loudness.target'], -14), measured);
}
