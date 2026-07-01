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

  if (targetSampleRate > source.sampleRate) {
    // OfflineAudioContext's sample-rate conversion can leave low-level images
    // above the source Nyquist frequency. Remove them with an 8th-order
    // Butterworth anti-imaging filter in the target-rate domain.
    const cutoff = Math.min(
      source.sampleRate * 0.5 * 0.96,
      targetSampleRate * 0.5 * 0.98,
    );
    const butterworthQ = [0.50979558, 0.60134489, 0.89997622, 2.56291545];
    let node: AudioNode = src;
    for (const q of butterworthQ) {
      const filter = offline.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      filter.Q.value = q;
      node.connect(filter);
      node = filter;
    }
    node.connect(offline.destination);
  } else {
    src.connect(offline.destination);
  }
  src.start(0);
  return await offline.startRendering();
}

export function sampleRateFromInputRate(value: unknown): number {
  if (value === '44.1k') return 44100;
  if (value === '96k') return 96000;
  return 48000;
}
