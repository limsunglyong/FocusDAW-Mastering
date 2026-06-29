// FocusDAW Mastering Desk v0.9.1 - Render Batch 단일 파일 렌더 파이프라인
// 세션(payload) 설정으로 한 파일을 디코딩→리샘플→(denoise)→오프라인 렌더→인코딩한다.
// 메인 앱 큐와 무관하게 동작(독립 창에서 직접 호출). 저장(IO)은 호출측에서 수행.
import { decodeAudioFile } from '../audio/decoder';
import { resampleAudioBuffer, sampleRateFromInputRate } from '../audio/resample';
import { denoiseBuffer, getDenoiseRecommendation } from '../audio/denoise';
import { analyzePre } from '../audio/preAnalysis';
import { encodeMaster } from './exportRunner';
import { baseName } from './wav';
import type { PreviewParams } from '../audio/masterChain';
import type { SessionPayload } from '../session/session';

export type RenderedBatchFile = { bytes: Uint8Array; ext: string; filename: string };

/** 배치 처리 단계(우측 패널 진행 표시용). */
export type BatchStage = 'decoding' | 'analyzing' | 'denoising' | 'rendering';

/** 세션 설정으로 한 파일을 렌더·인코딩한다(저장 전 바이트 반환). */
export async function renderFileWithSession(
  file: File,
  payload: SessionPayload,
  onStage?: (stage: BatchStage) => void,
): Promise<RenderedBatchFile> {
  onStage?.('decoding');
  const decoded = await decodeAudioFile(file);
  const rate = sampleRateFromInputRate(payload.vals['input.rate']);
  let buffer = await resampleAudioBuffer(decoded.buffer, rate);

  // 세션 Denoise 토글 ON + Pre 섹션 ON 이면 적용.
  // 곡별 depth/amount 는 세션에 없으므로 메인 앱과 동일하게 **곡마다 STFT 분석(SNR)→추천값**을 산출해 적용한다.
  const denoiseOn = !!payload.vals['pre.denoise'] && payload.enabled?.pre !== false;
  if (denoiseOn) {
    let depth = '2';
    let amt = 35;
    try {
      onStage?.('analyzing');
      // 추천 기준은 원본(dry) 신호 — 메인 앱의 dry 분석과 동일하게 sourceBuffer 를 분석.
      const analysis = await analyzePre(`batch:${file.name}`, `batch:${file.name}:${rate}`, decoded.buffer);
      const rec = getDenoiseRecommendation(analysis.snrDb, analysis.floorDb);
      depth = rec.depth;
      amt = rec.amount;
    } catch {
      // 분석 실패 시 표준값(depth 2 / 30%)으로 폴백.
      depth = '2';
      amt = 30;
    }
    try {
      onStage?.('denoising');
      buffer = await denoiseBuffer(buffer, depth, amt);
    } catch {
      // denoise 실패 시 원신호로 계속 진행(파일 전체 실패 방지).
    }
  }

  onStage?.('rendering');
  const params: PreviewParams = { vals: payload.vals, enabled: payload.enabled, meta: decoded.meta };
  const format = String(payload.vals['export.format'] ?? 'WAV');
  const meta = {
    title: baseName(file.name),
    artist: String(payload.vals['export.artist'] ?? ''),
    album: String(payload.vals['export.album'] ?? ''),
    year: String(payload.vals['export.year'] ?? ''),
    genre: String(payload.vals['export.genre'] ?? ''),
    artworkDataUrl: payload.artworkDataUrl,
  };
  const { bytes, ext } = await encodeMaster(buffer, params, format, payload.vals['input.bit'], meta);
  // v0.9.1: 배치 출력 파일명 앞에 (Mastered) 접두사.
  return { bytes, ext, filename: `${MASTERED_PREFIX}${baseName(file.name)}.${ext}` };
}

/** 배치 출력 파일명 접두사. */
export const MASTERED_PREFIX = '(Mastered) ';

/** 포맷 → 출력 확장자. */
export function outputExt(format: unknown): string {
  return format === 'MP3' ? 'mp3' : format === 'FLAC' ? 'flac' : 'wav';
}
