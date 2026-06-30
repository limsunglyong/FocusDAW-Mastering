// FocusDAW Mastering Desk v0.2.0 (Phase 1) - 오디오 파일 디코딩
// File → AudioContext.decodeAudioData → PCM(AudioBuffer) + 표시용 메타데이터.
// v0.1.6: 원본 Integrated LUFS(BS.1770) 측정 추가 → Input 섹션 표시.
// 베이스: _refer/FocusSpectogram/src/audio/decoder.ts 를 마스터링 데스크 입력 단계에 맞게 이식.
//  - 원본 샘플레이트는 헤더에서 직접 파싱(리샘플링과 무관한 표시값 보장)
//  - 표시용 원본 비트뎁스(WAV/FLAC)도 파싱해 큐/NOW SELECTED 칩에 사용
import { computeIntegratedLufs } from './loudness';

/** 디코딩된 오디오의 메타데이터 */
export interface AudioMeta {
  fileName: string;
  /** 표시용 원본 샘플레이트 (Hz). 헤더 파싱 실패 시 analysisSampleRate 로 폴백. */
  sampleRate: number;
  /** 분석/재생에 사용되는 샘플레이트 = AudioBuffer.sampleRate */
  analysisSampleRate: number;
  /** sampleRate 가 원본 헤더에서 확인된 값이면 true */
  sampleRateIsOriginal: boolean;
  /** 채널 수 */
  channels: number;
  /** 길이 (초) */
  duration: number;
  /** 총 샘플 수 (채널당) */
  length: number;
  /** 피크 레벨 (dBFS, 0 이하). 무음이면 -Infinity */
  peakDb: number;
  /** v0.1.6: 원본 파일의 실측 Integrated LUFS (ITU-R BS.1770). 측정 불가/무음이면 -Infinity */
  integratedLufs: number;
  /** 헤더에서 파싱한 원본 비트뎁스(bit). PCM이 아니거나(예: MP3) 파싱 실패 시 null. */
  sourceBitDepth: number | null;
  /** Web Audio 디코딩 결과는 항상 32-bit float */
  bitDepthLabel: string;
}

export interface DecodedAudio {
  buffer: AudioBuffer;
  meta: AudioMeta;
}

/** 제품이 지원하는 6개 입력 포맷(AIFF의 두 확장자는 같은 포맷). */
export const ACCEPTED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aiff', '.aif'] as const;
export const ACCEPT_ATTR = '.mp3,.wav,.flac,.ogg,.m4a,.aiff,.aif,audio/mpeg,audio/wav,audio/flac,audio/ogg,audio/mp4,audio/aiff';

/** 디코딩 실패 시 사용자에게 보여줄 메시지를 담는 에러 */
export class AudioDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioDecodeError';
  }
}

export function isAcceptedAudioFile(name: string): boolean {
  return ACCEPTED_EXTENSIONS.includes(extOf(name) as (typeof ACCEPTED_EXTENSIONS)[number]);
}

// 탭당 하나의 AudioContext 재사용
let sharedContext: AudioContext | null = null;
export function getAudioContext(): AudioContext {
  if (!sharedContext) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedContext = new Ctor();
  }
  return sharedContext;
}

// 가능하면 원본 샘플레이트로 디코드해 리샘플링을 막는다.
async function decodeToBuffer(arrayBuffer: ArrayBuffer, originalSampleRate: number | null): Promise<AudioBuffer> {
  const sharedRate = getAudioContext().sampleRate;
  if (originalSampleRate != null && originalSampleRate !== sharedRate && typeof OfflineAudioContext !== 'undefined') {
    try {
      const offline = new OfflineAudioContext(1, 1, originalSampleRate);
      // decodeAudioData 는 ArrayBuffer 를 detach 하므로 사본으로 시도 → 실패 시 원본으로 폴백
      return await offline.decodeAudioData(arrayBuffer.slice(0));
    } catch {
      // 폴백: 공유 AudioContext 로 디코드 (아래)
    }
  }
  return await getAudioContext().decodeAudioData(arrayBuffer);
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

function readAscii(view: DataView, offset: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

function makeAudioBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const buffer = getAudioContext().createBuffer(channels.length, channels[0]?.length ?? 0, sampleRate);
  channels.forEach((data, channel) => buffer.getChannelData(channel).set(data));
  return buffer;
}

/** Chromium이 지원하지 않는 AIFF/AIF PCM을 직접 AudioBuffer로 변환한다. */
export function decodeAiff(arrayBuffer: ArrayBuffer): AudioBuffer {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 12 || readAscii(view, 0, 4) !== 'FORM') throw new Error('Invalid AIFF');
  const form = readAscii(view, 8, 4);
  if (form !== 'AIFF' && form !== 'AIFC') throw new Error('Invalid AIFF');

  let channels = 0;
  let frames = 0;
  let bits = 0;
  let sampleRate = 0;
  let compression = form === 'AIFF' ? 'NONE' : '';
  let soundOffset = -1;
  let soundBytes = 0;
  for (let off = 12; off + 8 <= view.byteLength;) {
    const id = readAscii(view, off, 4);
    const size = view.getUint32(off + 4, false);
    const data = off + 8;
    if (data + size > view.byteLength) throw new Error('Truncated AIFF');
    if (id === 'COMM' && size >= 18) {
      channels = view.getUint16(data, false);
      frames = view.getUint32(data + 2, false);
      bits = view.getUint16(data + 6, false);
      sampleRate = Math.round(read80BitFloat(view, data + 8) ?? 0);
      if (form === 'AIFC' && size >= 22) compression = readAscii(view, data + 18, 4);
    } else if (id === 'SSND' && size >= 8) {
      const offset = view.getUint32(data, false);
      soundOffset = data + 8 + offset;
      soundBytes = Math.max(0, size - 8 - offset);
    }
    off = data + size + (size & 1);
  }
  if (!channels || !frames || !sampleRate || soundOffset < 0) throw new Error('Incomplete AIFF');
  const littleEndian = compression === 'sowt';
  const isFloat = compression === 'fl32' || compression === 'FL32' || compression === 'fl64' || compression === 'FL64';
  if (!isFloat && compression !== 'NONE' && compression !== 'twos' && compression !== 'sowt') {
    throw new Error(`Unsupported AIFF-C compression: ${compression}`);
  }
  const bytesPerSample = Math.ceil(bits / 8);
  if (![1, 2, 3, 4, 8].includes(bytesPerSample) || (isFloat && bits !== 32 && bits !== 64)) throw new Error('Unsupported AIFF bit depth');
  const availableFrames = Math.floor(soundBytes / (channels * bytesPerSample));
  const frameCount = Math.min(frames, availableFrames);
  const output = Array.from({ length: channels }, () => new Float32Array(frameCount));
  let pos = soundOffset;
  for (let frame = 0; frame < frameCount; frame++) {
    for (let channel = 0; channel < channels; channel++, pos += bytesPerSample) {
      let value: number;
      if (isFloat) {
        value = bits === 32 ? view.getFloat32(pos, littleEndian) : view.getFloat64(pos, littleEndian);
      } else if (bits === 8) {
        value = view.getInt8(pos) / 128;
      } else if (bits === 16) {
        value = view.getInt16(pos, littleEndian) / 32768;
      } else if (bits === 24) {
        const raw = littleEndian
          ? view.getUint8(pos) | (view.getUint8(pos + 1) << 8) | (view.getUint8(pos + 2) << 16)
          : (view.getUint8(pos) << 16) | (view.getUint8(pos + 1) << 8) | view.getUint8(pos + 2);
        value = ((raw & 0x800000) ? raw - 0x1000000 : raw) / 8388608;
      } else {
        value = view.getInt32(pos, littleEndian) / 2147483648;
      }
      output[channel][frame] = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
    }
  }
  return makeAudioBuffer(output, sampleRate);
}

// ---------------------------------------------------------------------------
// 헤더 파싱: 원본 샘플레이트 + 원본 비트뎁스 (표시용)
// ---------------------------------------------------------------------------

export type HeaderInfo = { sampleRate: number | null; bitDepth: number | null };

/** WAV(RIFF) 'fmt ' 청크에서 샘플레이트/비트뎁스를 읽는다. */
function parseWavHeader(view: DataView): HeaderInfo {
  if (view.byteLength < 44) return { sampleRate: null, bitDepth: null };
  if (readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE') return { sampleRate: null, bitDepth: null };
  let off = 12;
  while (off + 8 <= view.byteLength) {
    const id = readAscii(view, off, 4);
    const size = view.getUint32(off + 4, true);
    if (id === 'fmt ') {
      // audioFormat(2) numChannels(2) sampleRate(4) byteRate(4) blockAlign(2) bitsPerSample(2)
      const sampleRate = view.getUint32(off + 12, true);
      const bitDepth = view.getUint16(off + 22, true) || null;
      return { sampleRate, bitDepth };
    }
    off += 8 + size + (size & 1);
  }
  return { sampleRate: null, bitDepth: null };
}

const MP3_SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG1
  2: [22050, 24000, 16000], // MPEG2
  0: [11025, 12000, 8000], // MPEG2.5
};

/** MP3 첫 프레임 헤더에서 샘플레이트를 읽는다. (MP3는 비트뎁스 개념 없음) */
function parseMp3Header(view: DataView): HeaderInfo {
  let start = 0;
  if (view.byteLength > 10 && readAscii(view, 0, 3) === 'ID3') {
    const size = (view.getUint8(6) << 21) | (view.getUint8(7) << 14) | (view.getUint8(8) << 7) | view.getUint8(9);
    start = 10 + size;
  }
  for (let i = start; i < view.byteLength - 4; i++) {
    if (view.getUint8(i) !== 0xff) continue;
    const b1 = view.getUint8(i + 1);
    if ((b1 & 0xe0) !== 0xe0) continue;
    const version = (b1 >> 3) & 0x03;
    const b2 = view.getUint8(i + 2);
    const srIndex = (b2 >> 2) & 0x03;
    const table = MP3_SAMPLE_RATES[version];
    if (table && srIndex < 3) return { sampleRate: table[srIndex], bitDepth: null };
  }
  return { sampleRate: null, bitDepth: null };
}

/** FLAC STREAMINFO 블록에서 샘플레이트/비트뎁스를 읽는다. */
function parseFlacHeader(view: DataView): HeaderInfo {
  let off = 0;
  if (view.byteLength > 10 && readAscii(view, 0, 3) === 'ID3') {
    const size = (view.getUint8(6) << 21) | (view.getUint8(7) << 14) | (view.getUint8(8) << 7) | view.getUint8(9);
    off = 10 + size;
  }
  if (off + 4 > view.byteLength || readAscii(view, off, 4) !== 'fLaC') return { sampleRate: null, bitDepth: null };
  off += 4;
  while (off + 4 <= view.byteLength) {
    const header = view.getUint8(off);
    const blockType = header & 0x7f;
    const length = (view.getUint8(off + 1) << 16) | (view.getUint8(off + 2) << 8) | view.getUint8(off + 3);
    const dataOff = off + 4;
    if (dataOff + length > view.byteLength) return { sampleRate: null, bitDepth: null };
    if (blockType === 0) {
      if (length < 18) return { sampleRate: null, bitDepth: null };
      // STREAMINFO bytes 10..12: 20-bit sampleRate, 다음 3-bit channels, 5-bit (bitsPerSample-1)
      const sr =
        (view.getUint8(dataOff + 10) << 12) | (view.getUint8(dataOff + 11) << 4) | (view.getUint8(dataOff + 12) >> 4);
      const bits = (((view.getUint8(dataOff + 12) & 0x01) << 4) | (view.getUint8(dataOff + 13) >> 4)) + 1;
      return { sampleRate: sr > 0 ? sr : null, bitDepth: bits > 1 ? bits : null };
    }
    off = dataOff + length;
    if (header & 0x80) break;
  }
  return { sampleRate: null, bitDepth: null };
}

/** AIFF COMM 청크에서 샘플레이트/비트뎁스를 읽는다(빅엔디안). */
function parseAiffHeader(view: DataView): HeaderInfo {
  if (view.byteLength < 12) return { sampleRate: null, bitDepth: null };
  if (readAscii(view, 0, 4) !== 'FORM') return { sampleRate: null, bitDepth: null };
  const form = readAscii(view, 8, 4);
  if (form !== 'AIFF' && form !== 'AIFC') return { sampleRate: null, bitDepth: null };
  let off = 12;
  while (off + 8 <= view.byteLength) {
    const id = readAscii(view, off, 4);
    const size = view.getUint32(off + 4, false);
    if (id === 'COMM') {
      const bitDepth = view.getUint16(off + 14, false) || null;
      const sampleRate = read80BitFloat(view, off + 16);
      return { sampleRate: sampleRate ? Math.round(sampleRate) : null, bitDepth };
    }
    off += 8 + size + (size & 1);
  }
  return { sampleRate: null, bitDepth: null };
}

/** IEEE 80-bit extended precision (AIFF sampleRate 표기) → number */
function read80BitFloat(view: DataView, offset: number): number | null {
  if (offset + 10 > view.byteLength) return null;
  const expon = ((view.getUint8(offset) & 0x7f) << 8) | view.getUint8(offset + 1);
  const hiMant = view.getUint32(offset + 2, false);
  const loMant = view.getUint32(offset + 6, false);
  if (expon === 0 && hiMant === 0 && loMant === 0) return 0;
  const sign = view.getUint8(offset) & 0x80 ? -1 : 1;
  const value = hiMant * Math.pow(2, expon - 16383 - 31) + loMant * Math.pow(2, expon - 16383 - 63);
  return sign * value;
}

// 확장자/시그니처 기반으로 원본 샘플레이트·비트뎁스를 파싱(표시용). 자동 시험에서 직접 호출.
export function parseAudioHeader(buf: ArrayBuffer, ext: string): HeaderInfo {
  const view = new DataView(buf);
  try {
    if (ext === '.wav') return parseWavHeader(view);
    if (ext === '.mp3') return parseMp3Header(view);
    if (ext === '.flac') return parseFlacHeader(view);
    if (ext === '.aiff' || ext === '.aif') return parseAiffHeader(view);
    // 확장자가 모호하면 시그니처 기반으로 안전한 순서로 시도
    const wav = parseWavHeader(view);
    if (wav.sampleRate) return wav;
    const flac = parseFlacHeader(view);
    if (flac.sampleRate) return flac;
    const aiff = parseAiffHeader(view);
    if (aiff.sampleRate) return aiff;
    return parseMp3Header(view);
  } catch {
    return { sampleRate: null, bitDepth: null };
  }
}

// ---------------------------------------------------------------------------
// 헤더 전용 메타(파일 디코딩 없이 리스트 표시용): sampleRate/bitDepth/channels/duration
// v0.2.8: lazy 로딩 — import 시 풀 디코딩 없이 헤더만 파싱해 리스트를 즉시 구성한다.
//   WAV/AIFF/FLAC 는 헤더로 정확한 duration/channels 산출, MP3 는 첫 프레임 기반 추정(디코딩 시 보정).
// ---------------------------------------------------------------------------

export interface HeaderMeta {
  sampleRate: number | null;
  bitDepth: number | null;
  channels: number | null;
  /** 초. MP3 등은 추정값일 수 있다. */
  duration: number | null;
  /** duration 이 헤더로 확정된 정확값이면 true, 추정이면 false */
  durationExact: boolean;
}

const EMPTY_HEADER_META: HeaderMeta = { sampleRate: null, bitDepth: null, channels: null, duration: null, durationExact: false };

function wavHeaderMeta(view: DataView): HeaderMeta {
  if (view.byteLength < 44) return EMPTY_HEADER_META;
  if (readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE') return EMPTY_HEADER_META;
  let off = 12;
  let sampleRate: number | null = null;
  let bitDepth: number | null = null;
  let channels: number | null = null;
  let byteRate = 0;
  let dataBytes = 0;
  while (off + 8 <= view.byteLength) {
    const id = readAscii(view, off, 4);
    const size = view.getUint32(off + 4, true);
    if (id === 'fmt ') {
      channels = view.getUint16(off + 10, true) || null;
      sampleRate = view.getUint32(off + 12, true);
      byteRate = view.getUint32(off + 16, true);
      bitDepth = view.getUint16(off + 22, true) || null;
    } else if (id === 'data') {
      dataBytes = size;
      break;
    }
    off += 8 + size + (size & 1);
  }
  const duration = byteRate > 0 && dataBytes > 0 ? dataBytes / byteRate : null;
  return { sampleRate: sampleRate || null, bitDepth, channels, duration, durationExact: duration != null };
}

function aiffHeaderMeta(view: DataView): HeaderMeta {
  if (view.byteLength < 12 || readAscii(view, 0, 4) !== 'FORM') return EMPTY_HEADER_META;
  const form = readAscii(view, 8, 4);
  if (form !== 'AIFF' && form !== 'AIFC') return EMPTY_HEADER_META;
  let off = 12;
  while (off + 8 <= view.byteLength) {
    const id = readAscii(view, off, 4);
    const size = view.getUint32(off + 4, false);
    if (id === 'COMM') {
      const channels = view.getUint16(off + 8, false) || null;
      const numSampleFrames = view.getUint32(off + 10, false);
      const bitDepth = view.getUint16(off + 14, false) || null;
      const sampleRate = read80BitFloat(view, off + 16);
      const sr = sampleRate ? Math.round(sampleRate) : null;
      const duration = sr && numSampleFrames > 0 ? numSampleFrames / sr : null;
      return { sampleRate: sr, bitDepth, channels, duration, durationExact: duration != null };
    }
    off += 8 + size + (size & 1);
  }
  return EMPTY_HEADER_META;
}

function flacHeaderMeta(view: DataView): HeaderMeta {
  let off = 0;
  if (view.byteLength > 10 && readAscii(view, 0, 3) === 'ID3') {
    const size = (view.getUint8(6) << 21) | (view.getUint8(7) << 14) | (view.getUint8(8) << 7) | view.getUint8(9);
    off = 10 + size;
  }
  if (off + 4 > view.byteLength || readAscii(view, off, 4) !== 'fLaC') return EMPTY_HEADER_META;
  off += 4;
  while (off + 4 <= view.byteLength) {
    const header = view.getUint8(off);
    const blockType = header & 0x7f;
    const length = (view.getUint8(off + 1) << 16) | (view.getUint8(off + 2) << 8) | view.getUint8(off + 3);
    const dataOff = off + 4;
    if (dataOff + length > view.byteLength) return EMPTY_HEADER_META;
    if (blockType === 0 && length >= 18) {
      const sr = (view.getUint8(dataOff + 10) << 12) | (view.getUint8(dataOff + 11) << 4) | (view.getUint8(dataOff + 12) >> 4);
      const channels = ((view.getUint8(dataOff + 12) >> 1) & 0x07) + 1;
      const bits = (((view.getUint8(dataOff + 12) & 0x01) << 4) | (view.getUint8(dataOff + 13) >> 4)) + 1;
      // 36-bit total samples: byte13 하위4bit + byte14..17 (32bit). JS 32bit 한계 회피 위해 산술 사용.
      const high4 = view.getUint8(dataOff + 13) & 0x0f;
      const low32 = view.getUint32(dataOff + 14, false);
      const totalSamples = high4 * 2 ** 32 + low32;
      const duration = sr > 0 && totalSamples > 0 ? totalSamples / sr : null;
      return { sampleRate: sr > 0 ? sr : null, bitDepth: bits > 1 ? bits : null, channels, duration, durationExact: duration != null };
    }
    off = dataOff + length;
    if (header & 0x80) break;
  }
  return EMPTY_HEADER_META;
}

function oggHeaderMeta(view: DataView): HeaderMeta {
  let sampleRate: number | null = null;
  let channels: number | null = null;
  let lastGranule = 0;
  for (let off = 0; off + 27 <= view.byteLength;) {
    if (readAscii(view, off, 4) !== 'OggS') {
      off++;
      continue;
    }
    const segments = view.getUint8(off + 26);
    if (off + 27 + segments > view.byteLength) break;
    let bodySize = 0;
    for (let i = 0; i < segments; i++) bodySize += view.getUint8(off + 27 + i);
    const body = off + 27 + segments;
    if (body + bodySize > view.byteLength) break;
    const granuleLow = view.getUint32(off + 6, true);
    const granuleHigh = view.getUint32(off + 10, true);
    const granule = granuleHigh * 0x100000000 + granuleLow;
    if (Number.isSafeInteger(granule) && granule > lastGranule) lastGranule = granule;
    if (bodySize >= 16 && view.getUint8(body) === 1 && readAscii(view, body + 1, 6) === 'vorbis') {
      channels = view.getUint8(body + 11) || null;
      sampleRate = view.getUint32(body + 12, true) || null;
    }
    off = body + bodySize;
  }
  const duration = sampleRate && lastGranule ? lastGranule / sampleRate : null;
  return { sampleRate, bitDepth: null, channels, duration, durationExact: duration != null };
}

type Atom = { type: string; start: number; data: number; end: number };
function childAtoms(view: DataView, start: number, end: number): Atom[] {
  const atoms: Atom[] = [];
  for (let off = start; off + 8 <= end;) {
    let size = view.getUint32(off, false);
    const type = readAscii(view, off + 4, 4);
    let header = 8;
    if (size === 1 && off + 16 <= end) {
      const high = view.getUint32(off + 8, false);
      const low = view.getUint32(off + 12, false);
      size = high * 0x100000000 + low;
      header = 16;
    } else if (size === 0) size = end - off;
    if (size < header || off + size > end) break;
    atoms.push({ type, start: off, data: off + header, end: off + size });
    off += size;
  }
  return atoms;
}

function m4aHeaderMeta(view: DataView): HeaderMeta {
  const roots = childAtoms(view, 0, view.byteLength);
  const moov = roots.find((atom) => atom.type === 'moov');
  if (!moov) return EMPTY_HEADER_META;
  for (const trak of childAtoms(view, moov.data, moov.end).filter((atom) => atom.type === 'trak')) {
    const mdia = childAtoms(view, trak.data, trak.end).find((atom) => atom.type === 'mdia');
    if (!mdia) continue;
    const mdiaChildren = childAtoms(view, mdia.data, mdia.end);
    const hdlr = mdiaChildren.find((atom) => atom.type === 'hdlr');
    if (!hdlr || hdlr.data + 12 > hdlr.end || readAscii(view, hdlr.data + 8, 4) !== 'soun') continue;
    const mdhd = mdiaChildren.find((atom) => atom.type === 'mdhd');
    if (!mdhd) continue;
    const version = view.getUint8(mdhd.data);
    const base = mdhd.data + (version === 1 ? 20 : 12);
    if (base + (version === 1 ? 12 : 8) > mdhd.end) continue;
    const timescale = view.getUint32(base, false);
    const duration = version === 1
      ? view.getUint32(base + 4, false) * 0x100000000 + view.getUint32(base + 8, false)
      : view.getUint32(base + 4, false);
    let channels: number | null = null;
    let sampleRate: number | null = timescale || null;
    const minf = mdiaChildren.find((atom) => atom.type === 'minf');
    const stbl = minf && childAtoms(view, minf.data, minf.end).find((atom) => atom.type === 'stbl');
    const stsd = stbl && childAtoms(view, stbl.data, stbl.end).find((atom) => atom.type === 'stsd');
    if (stsd && stsd.data + 36 <= stsd.end) {
      const entry = stsd.data + 8;
      if (entry + 36 <= stsd.end) {
        channels = view.getUint16(entry + 24, false) || null;
        sampleRate = (view.getUint32(entry + 32, false) >>> 16) || sampleRate;
      }
    }
    return {
      sampleRate,
      bitDepth: null,
      channels,
      duration: timescale ? duration / timescale : null,
      durationExact: timescale > 0,
    };
  }
  return EMPTY_HEADER_META;
}

// MPEG Layer III 비트레이트(kbps) — CBR 기준 duration 추정용
const MP3_BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MP3_BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

function mp3HeaderMeta(view: DataView, fileBytes: number): HeaderMeta {
  let start = 0;
  if (view.byteLength > 10 && readAscii(view, 0, 3) === 'ID3') {
    const size = (view.getUint8(6) << 21) | (view.getUint8(7) << 14) | (view.getUint8(8) << 7) | view.getUint8(9);
    start = 10 + size;
  }
  for (let i = start; i < view.byteLength - 4; i++) {
    if (view.getUint8(i) !== 0xff) continue;
    const b1 = view.getUint8(i + 1);
    if ((b1 & 0xe0) !== 0xe0) continue;
    const version = (b1 >> 3) & 0x03; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
    const layer = (b1 >> 1) & 0x03; // 1=Layer III
    const b2 = view.getUint8(i + 2);
    const srIndex = (b2 >> 2) & 0x03;
    const brIndex = (b2 >> 4) & 0x0f;
    const table = MP3_SAMPLE_RATES[version];
    if (!table || srIndex >= 3 || layer !== 1) continue;
    const sampleRate = table[srIndex];
    const b3 = view.getUint8(i + 3);
    const channels = ((b3 >> 6) & 0x03) === 3 ? 1 : 2;
    const brTable = version === 3 ? MP3_BITRATES_V1_L3 : MP3_BITRATES_V2_L3;
    const kbps = brIndex > 0 && brIndex < brTable.length ? brTable[brIndex] : 0;
    const audioBytes = Math.max(0, fileBytes - start);
    const duration = kbps > 0 ? (audioBytes * 8) / (kbps * 1000) : null;
    return { sampleRate, bitDepth: null, channels, duration, durationExact: false };
  }
  return EMPTY_HEADER_META;
}

/** 디코딩 없이 헤더만으로 메타 추출(리스트 표시용). fileBytes 는 MP3 duration 추정에 사용. */
export function parseHeaderMeta(buf: ArrayBuffer, ext: string, fileBytes: number): HeaderMeta {
  const view = new DataView(buf);
  try {
    if (ext === '.wav') return wavHeaderMeta(view);
    if (ext === '.aiff' || ext === '.aif') return aiffHeaderMeta(view);
    if (ext === '.flac') return flacHeaderMeta(view);
    if (ext === '.mp3') return mp3HeaderMeta(view, fileBytes);
    if (ext === '.ogg') return oggHeaderMeta(view);
    if (ext === '.m4a') return m4aHeaderMeta(view);
    // 확장자 모호 시 시그니처 순서로 시도
    const wav = wavHeaderMeta(view);
    if (wav.sampleRate) return wav;
    const flac = flacHeaderMeta(view);
    if (flac.sampleRate) return flac;
    const aiff = aiffHeaderMeta(view);
    if (aiff.sampleRate) return aiff;
    return mp3HeaderMeta(view, fileBytes);
  } catch {
    return EMPTY_HEADER_META;
  }
}

/** 파일 앞부분만 읽어 헤더 메타를 파싱한다(풀 디코딩 없음). */
export async function readHeaderMeta(file: File): Promise<HeaderMeta> {
  const ext = extOf(file.name);
  if (ext && !ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])) {
    throw new AudioDecodeError(`Unsupported format: ${ext} (recommended: mp3, wav)`);
  }
  if (file.size === 0) throw new AudioDecodeError('Empty file.');
  // MP4의 moov atom은 파일 끝에 올 수 있고 OGG duration은 마지막 granule이 필요하다.
  // 두 포맷은 정확한 최초 메타 표시를 위해 전체 컨테이너를 읽는다(오디오 디코딩은 하지 않음).
  const SLICE = ext === '.ogg' || ext === '.m4a' ? file.size : 1 << 20;
  let buf: ArrayBuffer;
  try {
    buf = await file.slice(0, Math.min(file.size, SLICE)).arrayBuffer();
  } catch {
    throw new AudioDecodeError('Could not read file.');
  }
  return parseHeaderMeta(buf, ext, file.size);
}

/** 헤더 메타 → AudioMeta. peak/LUFS 는 디코딩 전이라 미측정(-Infinity)으로 둔다. */
export function metaFromHeader(file: File, hm: HeaderMeta): AudioMeta {
  const sampleRate = hm.sampleRate ?? 44100;
  const channels = hm.channels ?? 2;
  const duration = hm.duration ?? 0;
  return {
    fileName: file.name,
    sampleRate,
    analysisSampleRate: sampleRate,
    sampleRateIsOriginal: hm.sampleRate != null,
    channels,
    duration,
    length: Math.round(duration * sampleRate),
    peakDb: -Infinity,
    integratedLufs: -Infinity,
    sourceBitDepth: hm.bitDepth,
    bitDepthLabel: '32-BIT FLOAT',
  };
}

/** 채널 전체를 훑어 최대 절대 진폭을 구한 뒤 dBFS 로 변환 */
function computePeakDb(buffer: AudioBuffer): number {
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
    }
  }
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}

/**
 * 오디오 파일을 디코딩한다.
 * @throws {AudioDecodeError} 미지원/손상 파일인 경우
 */
export async function decodeAudioFile(file: File): Promise<DecodedAudio> {
  const ext = extOf(file.name);
  if (ext && !ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])) {
    throw new AudioDecodeError(`Unsupported format: ${ext} (recommended: mp3, wav)`);
  }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    throw new AudioDecodeError('Could not read file.');
  }
  if (arrayBuffer.byteLength === 0) throw new AudioDecodeError('Empty file.');

  // 헤더 파싱은 decodeAudioData 가 ArrayBuffer 를 detach 하기 전에 수행
  const header = parseAudioHeader(arrayBuffer, ext);

  let buffer: AudioBuffer;
  try {
    buffer = ext === '.aiff' || ext === '.aif'
      ? decodeAiff(arrayBuffer)
      : await decodeToBuffer(arrayBuffer, header.sampleRate);
  } catch {
    throw new AudioDecodeError('Could not decode audio. The file may be corrupt or in an unsupported format.');
  }

  const meta: AudioMeta = {
    fileName: file.name,
    sampleRate: header.sampleRate ?? buffer.sampleRate,
    analysisSampleRate: buffer.sampleRate,
    sampleRateIsOriginal: header.sampleRate != null,
    channels: buffer.numberOfChannels,
    duration: buffer.duration,
    length: buffer.length,
    peakDb: computePeakDb(buffer),
    integratedLufs: computeIntegratedLufs(buffer),
    sourceBitDepth: header.bitDepth,
    bitDepthLabel: '32-BIT FLOAT',
  };

  return { buffer, meta };
}
