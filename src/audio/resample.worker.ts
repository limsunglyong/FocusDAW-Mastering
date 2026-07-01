// High-quality downsampling worker. Keeps the polyphase sinc loop off the UI thread.
import resamplerWasmUrl from './wasm/resampler.wasm?url';

export interface ResampleWorkerRequest {
  channels: ArrayBuffer[];
  sourceSampleRate: number;
  targetSampleRate: number;
  forceTypeScript?: boolean;
}

export type ResampleWorkerResponse =
  | { type: 'done'; channels: ArrayBuffer[]; length: number; engine: 'wasm-simd' | 'typescript' }
  | { type: 'error'; message: string };

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

function resampleChannelTypeScript(
  input: Float32Array,
  outputLength: number,
  kernels: Float32Array,
  taps: number,
  phases: number,
  ratio: number,
): Float32Array {
  const half = taps / 2;
  const output = new Float32Array(outputLength);
  for (let outIndex = 0; outIndex < outputLength; outIndex += 1) {
    const position = outIndex * ratio;
    const center = Math.floor(position);
    const fraction = position - center;
    const phase = Math.min(phases - 1, Math.round(fraction * phases));
    const kernelBase = phase * taps;
    const inputBase = center - half + 1;
    let value = 0;
    for (let tap = 0; tap < taps; tap += 1) {
      const inputIndex = inputBase + tap;
      if (inputIndex >= 0 && inputIndex < input.length) {
        value += input[inputIndex] * kernels[kernelBase + tap];
      }
    }
    output[outIndex] = value;
  }
  return output;
}

async function resampleWithWasmSimd(
  inputs: Float32Array[],
  outputLength: number,
  kernels: Float32Array,
  taps: number,
  phases: number,
  ratio: number,
): Promise<Float32Array[]> {
  const basePtr = 65_536;
  const align16 = (value: number) => (value + 15) & ~15;
  const inputBytes = (inputs[0]?.length ?? 0) * 4;
  const kernelBytes = kernels.length * 4;
  const outputBytes = outputLength * 4;
  const inputPtr = basePtr;
  const kernelsPtr = align16(inputPtr + inputBytes);
  const outputPtr = align16(kernelsPtr + kernelBytes);
  const requiredBytes = outputPtr + outputBytes;
  const pages = Math.max(2, Math.ceil(requiredBytes / 65_536));
  const memory = new WebAssembly.Memory({ initial: pages });
  const wasmBytes = await (await fetch(resamplerWasmUrl)).arrayBuffer();
  const instance = await WebAssembly.instantiate(wasmBytes, { env: { memory } });
  const run = (instance.instance.exports as unknown as {
    resample: (
      inputPtr: number,
      inputLength: number,
      outputPtr: number,
      outputLength: number,
      kernelsPtr: number,
      taps: number,
      phases: number,
      ratio: number,
    ) => void;
  }).resample;
  if (typeof run !== 'function') throw new Error('WASM resample export is unavailable.');

  new Float32Array(memory.buffer, kernelsPtr, kernels.length).set(kernels);
  return inputs.map((input) => {
    new Float32Array(memory.buffer, inputPtr, input.length).set(input);
    run(inputPtr, input.length, outputPtr, outputLength, kernelsPtr, taps, phases, ratio);
    return new Float32Array(memory.buffer, outputPtr, outputLength).slice();
  });
}

self.onmessage = async (event: MessageEvent<ResampleWorkerRequest>) => {
  const post = (message: ResampleWorkerResponse, transfer?: ArrayBuffer[]) =>
    (self as unknown as Worker).postMessage(message, transfer ?? []);
  try {
    const { sourceSampleRate, targetSampleRate } = event.data;
    const inputChannels = event.data.channels.map((buffer) => new Float32Array(buffer));
    const inputLength = inputChannels[0]?.length ?? 0;
    const outputLength = Math.max(1, Math.ceil(inputLength * targetSampleRate / sourceSampleRate));
    const upsampling = targetSampleRate > sourceSampleRate;
    // Upsampling needs a wider source-Nyquist transition than 48→44.1 downsampling.
    // 128 taps with a 0.46 cycles/sample cutoff keeps the audible band while
    // strongly rejecting the first image beginning at the 24 kHz source Nyquist.
    const taps = upsampling ? 128 : 80;
    const phases = 1024;
    const half = taps / 2;
    const beta = 8.6;
    const betaDenominator = besselI0(beta);
    const cutoff = upsampling
      ? 0.46
      : (targetSampleRate / sourceSampleRate) * 0.5 * 0.98;
    const kernels = new Float32Array(phases * taps);

    for (let phase = 0; phase < phases; phase += 1) {
      const fraction = phase / phases;
      const base = phase * taps;
      let sum = 0;
      for (let tap = 0; tap < taps; tap += 1) {
        const distance = tap - half + 1 - fraction;
        const sinc = Math.abs(distance) < 1e-12
          ? 2 * cutoff
          : Math.sin(2 * Math.PI * cutoff * distance) / (Math.PI * distance);
        const windowPosition = distance / half;
        const window = Math.abs(windowPosition) <= 1
          ? besselI0(beta * Math.sqrt(Math.max(0, 1 - windowPosition * windowPosition))) / betaDenominator
          : 0;
        const coefficient = sinc * window;
        kernels[base + tap] = coefficient;
        sum += coefficient;
      }
      for (let tap = 0; tap < taps; tap += 1) kernels[base + tap] /= sum;
    }

    const ratio = sourceSampleRate / targetSampleRate;
    let engine: 'wasm-simd' | 'typescript' = 'wasm-simd';
    let outputArrays: Float32Array[];
    try {
      if (event.data.forceTypeScript) throw new Error('TypeScript SRC explicitly requested.');
      outputArrays = await resampleWithWasmSimd(
        inputChannels,
        outputLength,
        kernels,
        taps,
        phases,
        ratio,
      );
    } catch {
      engine = 'typescript';
      outputArrays = inputChannels.map((input) =>
        resampleChannelTypeScript(input, outputLength, kernels, taps, phases, ratio));
    }
    const outputChannels = outputArrays.map((output) => output.buffer as ArrayBuffer);
    post({ type: 'done', channels: outputChannels, length: outputLength, engine }, outputChannels);
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : 'Resampling failed' });
  }
};
