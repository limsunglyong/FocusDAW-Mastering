// FocusDAW Mastering Desk v0.8.0 (Phase 7) - WAV(RIFF) 인코더 (단계 7-C, 의존성 0)
// 렌더 결과(RenderedAudio) → 인터리브 PCM → WAV 바이트. Input PCM 설정(16/24/32f)을 그대로 따른다.
//  - 16/24-bit : 정수 PCM(format code 1)
//  - 32f       : IEEE float(format code 3)
import type { RenderedAudio } from './renderOffline';

export type WavBitDepth = '16' | '24' | '32f';

/** Input PCM 세그먼트 값('16'|'24'|'32f') → WAV 비트뎁스. 알 수 없으면 24-bit. */
export function wavBitDepthFromInput(value: unknown): WavBitDepth {
  if (value === '16') return '16';
  if (value === '32f') return '32f';
  return '24';
}

const clamp = (x: number) => (x > 1 ? 1 : x < -1 ? -1 : x);

/** 렌더 결과를 WAV 바이트(Uint8Array)로 인코딩한다. */
export function encodeWav(audio: RenderedAudio, bitDepth: WavBitDepth): Uint8Array {
  const channels = Math.max(1, audio.numberOfChannels);
  const frames = audio.length;
  const isFloat = bitDepth === '32f';
  const bytesPerSample = bitDepth === '16' ? 2 : bitDepth === '24' ? 3 : 4;
  const formatCode = isFloat ? 3 : 1;
  const blockAlign = channels * bytesPerSample;
  const byteRate = audio.sampleRate * blockAlign;
  const dataBytes = frames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  // RIFF 헤더
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  // fmt 청크
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);            // fmt 청크 크기
  view.setUint16(20, formatCode, true);    // 1=PCM, 3=IEEE float
  view.setUint16(22, channels, true);
  view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  // data 청크
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  const ch = audio.channelData;
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const sample = clamp(ch[c][i] ?? 0);
      if (isFloat) {
        view.setFloat32(offset, sample, true);
        offset += 4;
      } else if (bitDepth === '16') {
        view.setInt16(offset, Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff), true);
        offset += 2;
      } else {
        // 24-bit 정수 little-endian
        const v = Math.round(sample < 0 ? sample * 0x800000 : sample * 0x7fffff);
        view.setUint8(offset, v & 0xff);
        view.setUint8(offset + 1, (v >> 8) & 0xff);
        view.setUint8(offset + 2, (v >> 16) & 0xff);
        offset += 3;
      }
    }
  }

  return new Uint8Array(buffer);
}

/** 트랙명에서 확장자를 떼고 안전한 파일명 본체를 만든다(경로 구분자/제어문자 제거). */
export function baseName(name: string): string {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return stem.replace(/[\\/:*?"<>|]/g, '_').trim() || 'master';
}
