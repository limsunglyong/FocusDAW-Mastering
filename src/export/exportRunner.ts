// FocusDAW Mastering Desk v0.8.0 (Phase 7) - Export 인코딩 디스패처 (단계 7-C/7-G 공용)
// 렌더 → 포맷별 인코딩을 한 곳에서 분기한다.
// v0.8.4 (7-E): WAV 외에 MP3 320(lamejs, ID3v2 태그)·FLAC(libflacjs, Vorbis comment 태그) 추가.
import { renderMaster } from './renderOffline';
import { encodeWav, wavBitDepthFromInput } from './wav';
import { encodeMp3 } from './mp3';
import { encodeFlac } from './flac';
import { parseDataUrl, type Id3Tags } from './id3';
import type { PreviewParams } from '../audio/masterChain';

export type ExportFormat = 'WAV' | 'MP3' | 'FLAC';

/** 현재 구현된(저장 가능한) 포맷. */
export const SUPPORTED_EXPORT_FORMATS: ExportFormat[] = ['WAV', 'MP3', 'FLAC'];

export function isSupportedFormat(format: string): format is ExportFormat {
  return (SUPPORTED_EXPORT_FORMATS as string[]).includes(format);
}

/** 아직 인코더가 없는 포맷 선택 시 던지는 에러. */
export class ExportUnsupportedError extends Error {
  constructor(public format: string) {
    super(`${format} export is not available in this build.`);
    this.name = 'ExportUnsupportedError';
  }
}

export type EncodedFile = { bytes: Uint8Array; ext: string };

/** Export 태그/아트워크 메타(MP3 ID3v2·FLAC Vorbis comment 에 사용). */
export type ExportMeta = {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  artworkDataUrl?: string | null;
};

function id3TagsFromMeta(meta?: ExportMeta): Id3Tags {
  return {
    title: meta?.title || '',
    artist: meta?.artist || '',
    album: meta?.album || '',
    year: meta?.year || '',
    genre: meta?.genre || '',
    artwork: parseDataUrl(meta?.artworkDataUrl),
  };
}

/**
 * 처리 버퍼를 오프라인 렌더한 뒤 선택 포맷으로 인코딩한다.
 * @param buffer effectivePlaybackBuffer(denoise 반영된 processing 버퍼)
 * @param params 현재 vals/enabled/meta
 * @param format Export Format 세그먼트 값
 * @param inputPcm Input PCM 세그먼트 값('16'|'24'|'32f') — WAV/FLAC 비트뎁스에 사용
 * @param meta 태그/아트워크(MP3·FLAC 에만 적용)
 */
export async function encodeMaster(buffer: AudioBuffer, params: PreviewParams, format: string, inputPcm: unknown, meta?: ExportMeta, onStage?: (stage: 'rendering' | 'encoding') => void): Promise<EncodedFile> {
  onStage?.('rendering');
  const rendered = await renderMaster(buffer, params);
  onStage?.('encoding');
  if (format === 'WAV') {
    return { bytes: encodeWav(rendered, wavBitDepthFromInput(inputPcm)), ext: 'wav' };
  }
  if (format === 'MP3') {
    return { bytes: await encodeMp3(rendered, id3TagsFromMeta(meta)), ext: 'mp3' };
  }
  if (format === 'FLAC') {
    return { bytes: await encodeFlac(rendered, id3TagsFromMeta(meta), wavBitDepthFromInput(inputPcm)), ext: 'flac' };
  }
  throw new ExportUnsupportedError(format);
}
