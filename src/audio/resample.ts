// FocusDAW Mastering Desk v0.2.2 (Phase 1 Patch) - 내부 처리 샘플레이트 변환 유틸
// sourceBuffer(원본 rate)를 사용자 Input Rate의 processingBuffer 로 lazy 변환한다.
import type { ResampleWorkerRequest, ResampleWorkerResponse } from './resample.worker';

function besselI0(x: number): number {
  let sum = 1;
  let term = 1;
  const y = (x * x) / 4;
  for (let k = 1; k <= 24; k += 1) {
    term *= y / (k * k);
    sum += term;
    if (term < sum * 1e-12) break;
  }
  return sum;
}

export function designAntiAliasKernel(sourceRate: number, targetRate: number): Float32Array {
  const targetNyquist = targetRate * 0.5;
  // Keep the audible band flat, then finish the transition just below the
  // destination Nyquist. The Kaiser FIR supplies about 80 dB stop-band rejection.
  const passEdge = Math.min(20_000, targetNyquist * 0.9);
  const stopEdge = targetNyquist * 0.995;
  const transition = Math.max(100, stopEdge - passEdge);
  const transitionRadians = 2 * Math.PI * transition / sourceRate;
  const estimatedOrder = Math.ceil((80 - 8) / (2.285 * transitionRadians));
  const taps = Math.min(1023, Math.max(127, estimatedOrder | 1));
  const middle = (taps - 1) / 2;
  const cutoff = (passEdge + stopEdge) * 0.5 / sourceRate;
  const beta = 8.6;
  const denominator = besselI0(beta);
  const kernel = new Float32Array(taps);
  let sum = 0;

  for (let n = 0; n < taps; n += 1) {
    const offset = n - middle;
    const sinc = offset === 0
      ? 2 * cutoff
      : Math.sin(2 * Math.PI * cutoff * offset) / (Math.PI * offset);
    const position = offset / middle;
    const window = besselI0(beta * Math.sqrt(Math.max(0, 1 - position * position))) / denominator;
    kernel[n] = sinc * window;
    sum += kernel[n];
  }
  for (let n = 0; n < taps; n += 1) kernel[n] /= sum;
  return kernel;
}

function resampleWithWindowedSinc(
  source: AudioBuffer,
  targetSampleRate: number,
  forceTypeScript = false,
): Promise<AudioBuffer> {
  // Chromium's SRC leaves measurable high-band residue in both directions:
  // alias-like energy at 48→44.1 and an image above 24 kHz at 48→96.
  // Use one deterministic polyphase FIR path for every non-native rate.
  // PCM is copied before transfer so sourceBuffer remains available for Original Play.
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./resample.worker.ts', import.meta.url), { type: 'module' });
    const channels = Array.from({ length: source.numberOfChannels }, (_, channel) =>
      source.getChannelData(channel).slice().buffer as ArrayBuffer);
    worker.onmessage = (event: MessageEvent<ResampleWorkerResponse>) => {
      const message = event.data;
      worker.terminate();
      if (message.type === 'error') {
        reject(new Error(message.message));
        return;
      }
      const output = new AudioBuffer({
        length: message.length,
        numberOfChannels: message.channels.length,
        sampleRate: targetSampleRate,
      });
      message.channels.forEach((channel, index) => {
        output.copyToChannel(new Float32Array(channel), index);
      });
      Object.defineProperty(output, '__focusDawSrcEngine', {
        value: message.engine,
        configurable: true,
      });
      resolve(output);
    };
    worker.onerror = (error) => {
      worker.terminate();
      reject(error instanceof ErrorEvent ? new Error(error.message) : new Error('Resampling worker failed'));
    };
    const request: ResampleWorkerRequest = {
      channels,
      sourceSampleRate: source.sampleRate,
      targetSampleRate,
      forceTypeScript,
    };
    worker.postMessage(request, channels);
  });
}

export async function resampleAudioBuffer(
  source: AudioBuffer,
  targetSampleRate: number,
  options?: { forceTypeScript?: boolean },
): Promise<AudioBuffer> {
  if (source.sampleRate === targetSampleRate) return source;
  return await resampleWithWindowedSinc(source, targetSampleRate, options?.forceTypeScript);
}

export function sampleRateFromInputRate(value: unknown): number {
  if (value === '44.1k') return 44100;
  if (value === '96k') return 96000;
  return 48000;
}
