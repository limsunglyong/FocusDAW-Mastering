// FocusDAW Mastering Desk v0.2.2 (Phase 1 Patch) - 내부 처리 샘플레이트 변환 유틸
// sourceBuffer(원본 rate)를 사용자 Input Rate의 processingBuffer 로 lazy 변환한다.
export async function resampleAudioBuffer(source: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
  if (source.sampleRate === targetSampleRate) return source;
  if (typeof OfflineAudioContext === 'undefined') {
    throw new Error('OfflineAudioContext is not available.');
  }

  const length = Math.max(1, Math.ceil(source.duration * targetSampleRate));
  const offline = new OfflineAudioContext(source.numberOfChannels, length, targetSampleRate);
  const src = offline.createBufferSource();
  src.buffer = source;
  src.connect(offline.destination);
  src.start(0);
  return await offline.startRendering();
}

export function sampleRateFromInputRate(value: unknown): number {
  if (value === '44.1k') return 44100;
  if (value === '96k') return 96000;
  return 48000;
}
