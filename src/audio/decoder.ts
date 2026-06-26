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

/** 입력 허용 포맷 (우선순위: mp3/wav). 그 외는 브라우저 디코더 지원 범위. */
export const ACCEPTED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.aiff', '.aif'] as const;
export const ACCEPT_ATTR = 'audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.aiff,.aif';

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
    buffer = await decodeToBuffer(arrayBuffer, header.sampleRate);
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
