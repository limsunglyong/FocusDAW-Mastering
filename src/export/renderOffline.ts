// FocusDAW Mastering Desk v0.8.0 (Phase 7) - 오프라인 정밀 렌더 코어 (단계 7-B)
// Preview 와 동일한 마스터 체인(buildMasterChain)을 OfflineAudioContext 에서 1회 빌드해
// 정밀 렌더한다. processingBuffer(사용자 Input Rate) 를 입력으로 받아 마스터 결과 PCM 을 돌려준다.
//
//  processingBuffer → OfflineAudioContext(ch·len·rate) → buildMasterChain(현재 vals/enabled,
//    Pre fade offset 0) → startRendering() → 최종 TP 리미팅(applyBrickwallLimiter) → RenderedAudio
//
// v0.8.1: True-Peak 리미터를 OfflineAudioContext 의 AudioWorklet 대신 **렌더 후 결정적 JS 패스**
//   (applyBrickwallLimiter)로 적용한다. 오프라인 워클릿 로드/동작 불확실성으로 인해 리미터가
//   누락되면 Loudness 단의 make-up 게인+새츄레이터 출력(최대 +18dB 헤드룸)이 WAV 에서 ±1 로
//   하드클립되어 찌그러지던 문제를 제거한다. Loudness 체인은 워클릿 없이 빌드(headroom 통과)하고,
//   렌더 PCM 에 동일 알고리즘 리미터를 적용해 항상 ceiling 이하를 보장한다.
//
// v0.14.3: closed-loop LUFS 정규화 추가. 체인 내 make-up(loudnessGainValue)은 원본 파일 LUFS 기준
//   개루프라, EQ 부스트·컴프 메이크업·익사이터·스테레오 send 등 체인이 더한 라우드니스가 그대로
//   타깃 초과분으로 남았다(설정에 따라 +1~6LU — Export 실측이 Loudness Target 을 웃돌던 원인).
//   → 렌더된 PCM 을 실측해 타깃으로 보정(normalizeToTargetLufs)한 뒤 리미팅한다.
//   순서: 렌더 → LUFS 정규화 → True-Peak 리미팅. Loudness 섹션 bypass 시 정규화도 건너뛴다.
//
// Mono Master ON 이면 출력 채널을 1ch 로 만든다(체인은 동일 2ch 합 → destination 다운믹스).
import { buildMasterChain, makeReverbIR, num, type PreviewParams } from '../audio/masterChain';
import { LIMITER_LOOKAHEAD_MS, ceilingLinear, limiterReleaseSec, limiterEnabled, normalizeToTargetLufs } from '../audio/loudnessDsp';
import { applyBrickwallLimiter } from './limiter';

/** 인코더로 넘기는 렌더 결과(AudioBuffer 비의존 — Export 파이프라인 공용). */
export type RenderedAudio = {
  sampleRate: number;
  numberOfChannels: number;
  length: number;
  channelData: Float32Array[];
};

/**
 * 처리 버퍼에 현재 마스터 체인을 오프라인 렌더한다.
 * @param buffer 사용자 Input Rate 로 변환된 processingBuffer
 * @param params 현재 vals/enabled/meta (Preview 와 동일 파라미터)
 */
export async function renderMaster(buffer: AudioBuffer, params: PreviewParams): Promise<RenderedAudio> {
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
  // workletReady=false → Loudness 단은 리미터 노드 없이 빌드(±headroom 통과). 리미팅은 렌더 후 JS 패스.
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

  // v0.14.3: closed-loop LUFS 정규화 — 렌더 결과를 실측해 Loudness Target 으로 보정(리미팅 전).
  if (params.enabled.loudness) {
    normalizeToTargetLufs(channelData, rate, num(params.vals['loudness.target'], -14));
  }

  // 최종 True-Peak 리미팅(Preview 워클릿과 동일 알고리즘, 결정적) → 항상 ceiling 이하 보장.
  applyBrickwallLimiter(channelData, {
    ceiling: ceilingLinear(params.vals),
    releaseSec: limiterReleaseSec(params.vals),
    enabled: limiterEnabled(params.vals),
    sampleRate: rate,
    lookaheadMs: LIMITER_LOOKAHEAD_MS,
  });

  return { sampleRate: rate, numberOfChannels: outChannels, length, channelData };
}
