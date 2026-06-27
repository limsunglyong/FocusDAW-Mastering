// FocusDAW Mastering Desk v0.1.3 (Phase 1) - 자동 시험: 오디오 헤더 파서 검증
// src/audio/decoder.ts 의 parseAudioHeader 와 queueFile.ts 의 formatBytes 를
// TypeScript 로 즉석 트랜스파일해 실제 코드 그대로 검증한다(별도 빌드 산출물 불필요).
//   - 합성 WAV/FLAC/AIFF/MP3 헤더를 만들어 샘플레이트·비트뎁스 파싱 결과를 단언
//   - 표시용 용량 포매팅(formatBytes) 단언
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { writeFileSync, readFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const require = createRequire(import.meta.url);
const ts = require('typescript');

// 모든 트랜스파일 산출물을 한 디렉터리에 모아 상대 import 가 서로를 찾도록 한다.
const outDir = mkdtempSync(join(tmpdir(), 'fdaw-verify-'));

function transpileToModule(srcPath, outName) {
  const src = readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  // 확장자 없는 상대 import (예: './loudness') → '.mjs' 부여 (Node ESM 해석용)
  js = js.replace(/(from\s+['"])(\.\.?\/[^'"]+?)(['"])/g, (m, p1, spec, p3) =>
    /\.[a-z]+$/i.test(spec) ? m : `${p1}${spec}.mjs${p3}`,
  );
  const file = join(outDir, outName);
  writeFileSync(file, js, 'utf8');
  return pathToFileURL(file).href;
}

// ── 합성 헤더 빌더 ───────────────────────────────────────────────
function ascii(u8, off, str) { for (let i = 0; i < str.length; i++) u8[off + i] = str.charCodeAt(i); }

function makeWav(sampleRate, bits, channels, dataBytes = 0) {
  const u8 = new Uint8Array(44);
  const dv = new DataView(u8.buffer);
  ascii(u8, 0, 'RIFF'); dv.setUint32(4, 36, true); ascii(u8, 8, 'WAVE');
  ascii(u8, 12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);              // audioFormat = PCM
  dv.setUint16(22, channels, true);       // numChannels
  dv.setUint32(24, sampleRate, true);     // sampleRate
  dv.setUint32(28, sampleRate * channels * bits / 8, true); // byteRate
  dv.setUint16(32, channels * bits / 8, true); // blockAlign
  dv.setUint16(34, bits, true);           // bitsPerSample
  ascii(u8, 36, 'data'); dv.setUint32(40, dataBytes, true);
  return u8.buffer;
}

function makeFlac() {
  // SR=48000, channels=2, bits=24 로 고정 인코딩된 STREAMINFO
  const u8 = new Uint8Array(4 + 4 + 34);
  ascii(u8, 0, 'fLaC');
  u8[4] = 0x80; u8[5] = 0x00; u8[6] = 0x00; u8[7] = 0x22; // last-block | STREAMINFO, length=34
  const si = 8; // streaminfo data start
  // bytes 10..13 of streaminfo: SR(20) | ch-1(3) | bits-1(5) | ...
  u8[si + 10] = 0x0b; u8[si + 11] = 0xb8; u8[si + 12] = 0x03; u8[si + 13] = 0x70;
  return u8.buffer;
}

function makeMp3() {
  // ID3 없이 첫 프레임 헤더만: MPEG1, srIndex=1 → 48000
  const u8 = new Uint8Array(8);
  u8[0] = 0xff; u8[1] = 0xfb; u8[2] = 0x94; u8[3] = 0x00;
  return u8.buffer;
}

function makeAiff(sampleRate, bits, channels, frames = 0) {
  const u8 = new Uint8Array(12 + 8 + 18);
  const dv = new DataView(u8.buffer);
  ascii(u8, 0, 'FORM'); dv.setUint32(4, u8.length - 8, false); ascii(u8, 8, 'AIFF');
  ascii(u8, 12, 'COMM'); dv.setUint32(16, 18, false);
  dv.setUint16(20, channels, false);   // numChannels
  dv.setUint32(22, frames, false);     // numSampleFrames
  dv.setUint16(26, bits, false);       // sampleSize
  // 80-bit extended sampleRate (48000 = exp 0x400E, hiMant 0xBB800000)
  if (sampleRate !== 48000) throw new Error('test AIFF helper only encodes 48000');
  dv.setUint16(28, 0x400e, false);
  dv.setUint32(30, 0xbb800000, false);
  dv.setUint32(34, 0, false);
  return u8.buffer;
}

// ── 실행 ────────────────────────────────────────────────────────
let pass = 0, fail = 0;
function check(name, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}` + (ok ? '' : `\n        expected ${JSON.stringify(expected)} got ${JSON.stringify(got)}`));
  ok ? pass++ : fail++;
}

const decUrl = transpileToModule('src/audio/decoder.ts', 'decoder.mjs');
const qfUrl = transpileToModule('src/audio/queueFile.ts', 'queueFile.mjs');
const loudUrl = transpileToModule('src/audio/loudness.ts', 'loudness.mjs');
// Phase 2 STFT/Denoise 이식 모듈 (의존: noiseReduction → decoder, stft → fft, noisePrint → stft)
const fftUrl = transpileToModule('src/audio/fft.ts', 'fft.mjs');
const stftUrl = transpileToModule('src/audio/stft.ts', 'stft.mjs');
const npUrl = transpileToModule('src/audio/noisePrint.ts', 'noisePrint.mjs');
const nrUrl = transpileToModule('src/audio/noiseReduction.ts', 'noiseReduction.mjs');
const dnUrl = transpileToModule('src/audio/denoise.ts', 'denoise.mjs');
const { FFT } = await import(fftUrl);
const { depthToOptions, denoiseKeyOf } = await import(dnUrl);
const { parseAudioHeader, parseHeaderMeta } = await import(decUrl);
const { formatBytes } = await import(qfUrl);
const { integratedLufsFromChannels } = await import(loudUrl);
const { computeSpectrogram, makeWindow, DB_FLOOR } = await import(stftUrl);
const { buildNoisePrint, findQuietNoiseRange } = await import(npUrl);
const { reduceNoiseChannel } = await import(nrUrl);

function checkClose(name, got, expected, tol) {
  const ok = isFinite(got) && Math.abs(got - expected) <= tol;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}` + (ok ? '' : `\n        expected ${expected}±${tol} got ${got}`));
  ok ? pass++ : fail++;
}
function sineChannel(amp, freq, fs, sec) {
  const n = Math.round(fs * sec);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / fs);
  return out;
}

console.log('— Header parsing —');
check('WAV 44100/16-bit',  parseAudioHeader(makeWav(44100, 16, 2), '.wav'),  { sampleRate: 44100, bitDepth: 16 });
check('WAV 96000/24-bit',  parseAudioHeader(makeWav(96000, 24, 2), '.wav'),  { sampleRate: 96000, bitDepth: 24 });
check('FLAC 48000/24-bit', parseAudioHeader(makeFlac(), '.flac'),            { sampleRate: 48000, bitDepth: 24 });
check('AIFF 48000/24-bit', parseAudioHeader(makeAiff(48000, 24, 2), '.aiff'),{ sampleRate: 48000, bitDepth: 24 });
check('MP3 48000 (no bitDepth)', parseAudioHeader(makeMp3(), '.mp3'),        { sampleRate: 48000, bitDepth: null });
check('Unknown ext → WAV signature fallback', parseAudioHeader(makeWav(44100, 16, 2), '.dat'), { sampleRate: 44100, bitDepth: 16 });

console.log('— Header-only meta (channels/duration) —');
// WAV: byteRate = 44100*2*2 = 176400 B/s, data 176400B → 1.0s, stereo, 정확
check('WAV header meta 1s stereo', parseHeaderMeta(makeWav(44100, 16, 2, 176400), '.wav', 1024),
  { sampleRate: 44100, bitDepth: 16, channels: 2, duration: 1, durationExact: true });
// AIFF: 48000 frames @ 48000 → 1.0s, stereo, 정확
check('AIFF header meta 1s stereo', parseHeaderMeta(makeAiff(48000, 24, 2, 48000), '.aiff', 1024),
  { sampleRate: 48000, bitDepth: 24, channels: 2, duration: 1, durationExact: true });
// FLAC: STREAMINFO 채널/비트뎁스(총샘플 0 → duration 미정)
check('FLAC header meta channels', parseHeaderMeta(makeFlac(), '.flac', 1024),
  { sampleRate: 48000, bitDepth: 24, channels: 2, duration: null, durationExact: false });
// MP3: 채널은 프레임 모드(0x00 → stereo), duration 은 추정(부정확)
{
  const hm = parseHeaderMeta(makeMp3(), '.mp3', 100000);
  const ok = hm.sampleRate === 48000 && hm.channels === 2 && hm.durationExact === false && hm.duration > 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  MP3 header meta (channels/estimate)` + (ok ? '' : `  got ${JSON.stringify(hm)}`));
  ok ? pass++ : fail++;
}

console.log('— formatBytes —');
check('50 MB',  formatBytes(50 * 1024 * 1024), '50.0 MB');
check('500 KB', formatBytes(500 * 1024), '500 KB');
check('0 bytes', formatBytes(0), '0 MB');

console.log('— Integrated LUFS (BS.1770) —');
const FS = 48000;
// 무음 → -Infinity
check('silence → -Infinity', integratedLufsFromChannels([new Float32Array(FS * 2), new Float32Array(FS * 2)], FS), -Infinity);
// 너무 짧은 입력(<400ms) → -Infinity
check('too short → -Infinity', integratedLufsFromChannels([sineChannel(0.5, 1000, FS, 0.2)], FS), -Infinity);
// 정상파 진폭 2배 → 정확히 +6.02 LU (steady tone, 게이팅 영향 없음)
{
  const lufsHalf = integratedLufsFromChannels([sineChannel(0.5, 1000, FS, 3), sineChannel(0.5, 1000, FS, 3)], FS);
  const lufsQuarter = integratedLufsFromChannels([sineChannel(0.25, 1000, FS, 3), sineChannel(0.25, 1000, FS, 3)], FS);
  checkClose('amp ×2 → +6.02 LU', lufsHalf - lufsQuarter, 6.0206, 0.05);
}
// 앵커: 0 dBFS 1kHz 스테레오 사인 ≈ 0 LUFS (BS.1770 well-known anchor)
checkClose('0 dBFS 1kHz stereo sine ≈ 0 LUFS', integratedLufsFromChannels([sineChannel(1, 1000, FS, 3), sineChannel(1, 1000, FS, 3)], FS), 0.0, 1.0);
// 모노 정상파 → 유한값
{
  const mono = integratedLufsFromChannels([sineChannel(0.5, 1000, FS, 3)], FS);
  const ok = isFinite(mono);
  console.log(`${ok ? 'PASS' : 'FAIL'}  mono sine → finite LUFS` + (ok ? '' : `  got ${mono}`));
  ok ? pass++ : fail++;
}

console.log('— FFT (Phase 2) —');
// 1) 라운드트립: random → transform → inverseTransform ≈ 원본
{
  const N = 256;
  let seed = 12345;
  const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  const re0 = new Float32Array(N), im0 = new Float32Array(N);
  for (let i = 0; i < N; i++) { re0[i] = rng(); im0[i] = 0; }
  const re = Float32Array.from(re0), im = Float32Array.from(im0);
  const fft = new FFT(N);
  fft.transform(re, im);
  fft.inverseTransform(re, im);
  let maxErr = 0;
  for (let i = 0; i < N; i++) maxErr = Math.max(maxErr, Math.abs(re[i] - re0[i]), Math.abs(im[i]));
  checkClose('FFT roundtrip max error ≈ 0', maxErr, 0, 1e-4);
}
// 2) 사인파 → 해당 bin 에 매그니튜드 피크
{
  const N = 64, binTarget = 8;
  const re = new Float32Array(N), im = new Float32Array(N);
  for (let i = 0; i < N; i++) re[i] = Math.cos((2 * Math.PI * binTarget * i) / N);
  new FFT(N).transform(re, im);
  let peakBin = 0, peakMag = -1;
  for (let k = 0; k < N / 2; k++) {
    const m = Math.hypot(re[k], im[k]);
    if (m > peakMag) { peakMag = m; peakBin = k; }
  }
  check('FFT sine peak bin', peakBin, binTarget);
}
// 3) 2의 거듭제곱이 아니면 throw
{
  let threw = false;
  try { new FFT(100); } catch { threw = true; }
  check('FFT non-power-of-2 throws', threw, true);
}

console.log('— STFT spectrogram (Phase 2) —');
// 4) 풀스케일 1kHz 사인 → 해당 bin maxDb ≈ 0 dBFS
{
  const spec = computeSpectrogram(sineChannel(1, 1000, 48000, 1), 48000, { fftSize: 2048, hopSize: 512, window: 'hann' });
  const okShape = spec.bins === 1024 && spec.frames > 0 && Math.abs(spec.freqStep - 48000 / 2048) < 1e-6;
  console.log(`${okShape ? 'PASS' : 'FAIL'}  spectrogram shape (bins/freqStep)` + (okShape ? '' : `  got bins=${spec.bins} freqStep=${spec.freqStep}`));
  okShape ? pass++ : fail++;
  checkClose('spectrogram full-scale sine maxDb ≈ 0', spec.maxDb, 0, 1.0);
}
// 5) Hann window 양끝 0
{
  const w = makeWindow('hann', 16);
  const okEnds = Math.abs(w[0]) < 1e-6 && Math.abs(w[15]) < 1e-6 && w[8] > 0.9;
  console.log(`${okEnds ? 'PASS' : 'FAIL'}  Hann window endpoints 0, center ~1` + (okEnds ? '' : `  got [0]=${w[0]} [15]=${w[15]} [8]=${w[8]}`));
  okEnds ? pass++ : fail++;
}
// 6) 무음 → 모든 데이터 DB_FLOOR
{
  const spec = computeSpectrogram(new Float32Array(48000), 48000, { fftSize: 2048, hopSize: 512, window: 'hann' });
  check('silence spectrogram minDb == DB_FLOOR', spec.minDb, DB_FLOOR);
}

console.log('— Noise print + spectral gating (Phase 2) —');
// 7) 앞 1.5초 저레벨 노이즈 + 뒤 1.5초 노이즈+톤 → findQuietNoiseRange 가 앞 구간 선택
{
  let seed = 999;
  const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  const fs = 48000, total = fs * 3;
  const sig = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    let s = rng() * 0.01; // 상시 저레벨 브로드밴드 노이즈
    if (i >= fs * 1.5) s += 0.6 * Math.sin((2 * Math.PI * 1000 * i) / fs); // 뒤쪽에 톤
    sig[i] = s;
  }
  const spec = computeSpectrogram(sig, fs, { fftSize: 2048, hopSize: 512, window: 'hann' });
  const range = findQuietNoiseRange(spec, 1.0);
  const okRange = range && range.startTime < 1.5;
  console.log(`${okRange ? 'PASS' : 'FAIL'}  findQuietNoiseRange picks quiet head` + (okRange ? '' : `  got ${JSON.stringify(range)}`));
  okRange ? pass++ : fail++;
}
// 8) 순수 저레벨 노이즈 → Deep 게이팅 후 RMS 대폭 감소
{
  let seed = 4242;
  const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  const fs = 48000, total = fs * 2;
  const noise = new Float32Array(total);
  for (let i = 0; i < total; i++) noise[i] = rng() * 0.02;
  const params = { fftSize: 2048, hopSize: 512, window: 'hann' };
  const spec = computeSpectrogram(noise, fs, params);
  const print = buildNoisePrint(spec, 0, 1.5, 2);
  // Deep 설정: 높은 threshold 로 노이즈 프로파일 근방을 적극 게이팅
  const out = reduceNoiseChannel(noise, print, params, { thresholdDb: 24, amount: 0.95, floor: 0.04 });
  const rms = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); };
  const inR = rms(noise), outR = rms(out);
  const okReduce = outR < inR * 0.5;
  console.log(`${okReduce ? 'PASS' : 'FAIL'}  spectral gating reduces noise RMS >50%` + (okReduce ? '' : `  in=${inR.toFixed(5)} out=${outR.toFixed(5)}`));
  okReduce ? pass++ : fail++;
}
// 9) amount 0 → 사실상 원본 보존 (length 동일·RMS 근접)
{
  let seed = 77;
  const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  const fs = 48000, total = fs;
  const noise = new Float32Array(total);
  for (let i = 0; i < total; i++) noise[i] = rng() * 0.05;
  const params = { fftSize: 2048, hopSize: 512, window: 'hann' };
  const spec = computeSpectrogram(noise, fs, params);
  const print = buildNoisePrint(spec, 0, 0.8, 2);
  const out = reduceNoiseChannel(noise, print, params, { thresholdDb: 0, amount: 0, floor: 0 });
  const rms = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); };
  const okPass = out.length === total && Math.abs(rms(out) - rms(noise)) < rms(noise) * 0.05;
  console.log(`${okPass ? 'PASS' : 'FAIL'}  amount 0 preserves signal` + (okPass ? '' : `  in=${rms(noise).toFixed(5)} out=${rms(out).toFixed(5)}`));
  okPass ? pass++ : fail++;
}

console.log('— Denoise depth mapping (Phase 2) —');
{
  const o1 = depthToOptions('1', 100), o2 = depthToOptions('2', 100), o3 = depthToOptions('3', 100);
  check('Deep amount > Original amount', o3.amount > o1.amount, true);
  check('Deep threshold > Normal > Original', o3.thresholdDb > o2.thresholdDb && o2.thresholdDb > o1.thresholdDb, true);
  check('amtPct 0 → amount 0', depthToOptions('2', 0).amount, 0);
  checkClose('Normal amtPct 50 → 0.85*0.5', depthToOptions('2', 50).amount, 0.425, 1e-6);
  check('Deep floor < Original floor', o3.floor < o1.floor, true);
  check('denoiseKeyOf format', denoiseKeyOf(48000, '2', 35), '48000:2:35');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
