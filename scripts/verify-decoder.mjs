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

function makeWav(sampleRate, bits, channels) {
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
  ascii(u8, 36, 'data'); dv.setUint32(40, 0, true);
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

function makeAiff(sampleRate, bits, channels) {
  const u8 = new Uint8Array(12 + 8 + 18);
  const dv = new DataView(u8.buffer);
  ascii(u8, 0, 'FORM'); dv.setUint32(4, u8.length - 8, false); ascii(u8, 8, 'AIFF');
  ascii(u8, 12, 'COMM'); dv.setUint32(16, 18, false);
  dv.setUint16(20, channels, false);   // numChannels
  dv.setUint32(22, 0, false);          // numSampleFrames
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
const { parseAudioHeader } = await import(decUrl);
const { formatBytes } = await import(qfUrl);
const { integratedLufsFromChannels } = await import(loudUrl);

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
