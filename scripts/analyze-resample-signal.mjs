import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { designAntiAliasKernel } from '../src/audio/resample.ts';

const input = resolve(process.argv[2] ?? 'test_final/sound sample/4 Synth.wav');
const startSeconds = process.argv[3] ?? '30';
const durationSeconds = process.argv[4] ?? '60';
const sampleRate = 48_000;
const targetRate = 44_100;
const fftSize = 8192;
const hop = fftSize / 2;

const decoded = spawnSync('ffmpeg', [
  '-v', 'error', '-ss', startSeconds, '-t', durationSeconds, '-i', input,
  '-ac', '1', '-ar', String(sampleRate), '-f', 'f32le', 'pipe:1',
], { maxBuffer: 1024 * 1024 * 256 });
if (decoded.status !== 0) {
  throw new Error(decoded.stderr.toString() || `ffmpeg exited with ${decoded.status}`);
}
const pcm = new Float32Array(
  decoded.stdout.buffer,
  decoded.stdout.byteOffset,
  Math.floor(decoded.stdout.byteLength / 4),
);

function fft(real, imag) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = -2 * Math.PI / size;
    const stepR = Math.cos(angle);
    const stepI = Math.sin(angle);
    for (let offset = 0; offset < n; offset += size) {
      let wr = 1;
      let wi = 0;
      for (let k = 0; k < size / 2; k += 1) {
        const even = offset + k;
        const odd = even + size / 2;
        const tr = wr * real[odd] - wi * imag[odd];
        const ti = wr * imag[odd] + wi * real[odd];
        real[odd] = real[even] - tr;
        imag[odd] = imag[even] - ti;
        real[even] += tr;
        imag[even] += ti;
        const nextWr = wr * stepR - wi * stepI;
        wi = wr * stepI + wi * stepR;
        wr = nextWr;
      }
    }
  }
}

const kernel = designAntiAliasKernel(sampleRate, targetRate);
const responsePower = new Float64Array(fftSize / 2 + 1);
for (let bin = 0; bin < responsePower.length; bin += 1) {
  const omega = 2 * Math.PI * bin / fftSize;
  let re = 0;
  let im = 0;
  for (let tap = 0; tap < kernel.length; tap += 1) {
    re += kernel[tap] * Math.cos(omega * tap);
    im -= kernel[tap] * Math.sin(omega * tap);
  }
  responsePower[bin] = re * re + im * im;
}

const originalPower = new Float64Array(responsePower.length);
const filteredPower = new Float64Array(responsePower.length);
let frames = 0;
for (let offset = 0; offset + fftSize <= pcm.length; offset += hop) {
  const real = new Float64Array(fftSize);
  const imag = new Float64Array(fftSize);
  for (let i = 0; i < fftSize; i += 1) {
    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (fftSize - 1));
    real[i] = pcm[offset + i] * window;
  }
  fft(real, imag);
  for (let bin = 0; bin < originalPower.length; bin += 1) {
    const power = real[bin] * real[bin] + imag[bin] * imag[bin];
    originalPower[bin] += power;
    filteredPower[bin] += power * responsePower[bin];
  }
  frames += 1;
}

const bands = [
  ['0–18 kHz', 0, 18_000],
  ['18–19.8 kHz', 18_000, 19_800],
  ['19.8–20 kHz', 19_800, 20_000],
  ['20–22.05 kHz', 20_000, 22_050],
  ['22.05–24 kHz', 22_050, 24_001],
];
function sumBand(values, low, high) {
  let sum = 0;
  for (let bin = 0; bin < values.length; bin += 1) {
    const frequency = bin * sampleRate / fftSize;
    if (frequency >= low && frequency < high) sum += values[bin];
  }
  return sum;
}
function dbRatio(after, before) {
  return 10 * Math.log10(Math.max(after, 1e-300) / Math.max(before, 1e-300));
}

const originalTotal = sumBand(originalPower, 0, 24_001);
const filteredTotal = sumBand(filteredPower, 0, 24_001);
const result = {
  file: input,
  segment: `${startSeconds}s–${Number(startSeconds) + Number(durationSeconds)}s`,
  frames,
  taps: kernel.length,
  dcGain: kernel.reduce((sum, value) => sum + value, 0),
  broadbandLevelChangeDb: dbRatio(filteredTotal, originalTotal),
  bands: bands.map(([name, low, high]) => {
    const before = sumBand(originalPower, low, high);
    const after = sumBand(filteredPower, low, high);
    return {
      band: name,
      sourceShareDb: 10 * Math.log10(Math.max(before, 1e-300) / originalTotal),
      filterChangeDb: dbRatio(after, before),
    };
  }),
};
console.log(JSON.stringify(result, null, 2));
