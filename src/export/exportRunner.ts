// FocusDAW Mastering Desk v0.8.0 (Phase 7) - Export 인코딩 디스패처 (단계 7-C/7-G 공용)
// 렌더 → 포맷별 인코딩을 한 곳에서 분기한다. 현재 라운드는 WAV(의존성 0)만 구현하고,
// MP3(lamejs)·FLAC(libflac.js)는 다음 라운드(7-E)에서 인코더를 추가할 자리만 둔다.
import { renderMaster } from './renderOffline';
import { encodeWav, wavBitDepthFromInput } from './wav';
import type { PreviewParams } from '../audio/masterChain';

export type ExportFormat = 'WAV' | 'MP3 320' | 'FLAC';

/** 현재 구현된(저장 가능한) 포맷. */
export const SUPPORTED_EXPORT_FORMATS: ExportFormat[] = ['WAV'];

export function isSupportedFormat(format: string): format is ExportFormat {
  return (SUPPORTED_EXPORT_FORMATS as string[]).includes(format);
}

/** 아직 인코더가 없는 포맷 선택 시 던지는 에러(7-E 에서 해소). */
export class ExportUnsupportedError extends Error {
  constructor(public format: string) {
    super(`${format} export is not available yet (WAV only in this build).`);
    this.name = 'ExportUnsupportedError';
  }
}

export type EncodedFile = { bytes: Uint8Array; ext: string };

/**
 * 처리 버퍼를 오프라인 렌더한 뒤 선택 포맷으로 인코딩한다.
 * @param buffer effectivePlaybackBuffer(denoise 반영된 processing 버퍼)
 * @param params 현재 vals/enabled/meta
 * @param format Export Format 세그먼트 값
 * @param inputPcm Input PCM 세그먼트 값('16'|'24'|'32f') — WAV 비트뎁스에 사용
 */
export async function encodeMaster(buffer: AudioBuffer, params: PreviewParams, format: string, inputPcm: unknown): Promise<EncodedFile> {
  const rendered = await renderMaster(buffer, params);
  if (format === 'WAV') {
    return { bytes: encodeWav(rendered, wavBitDepthFromInput(inputPcm)), ext: 'wav' };
  }
  // MP3 320(lamejs) / FLAC(libflac.js) 는 7-E 에서 추가.
  throw new ExportUnsupportedError(format);
}
