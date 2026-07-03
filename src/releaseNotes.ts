// FocusDAW Mastering Desk v0.14.2 - 릴리스 노트
// Help ▸ Release Notes 창에 표시. v0.12.0 이후 변경 내용만 요약한다.
import { APP_VERSION } from './version';

export type ReleaseNotes = {
  version: string;
  date: string;
  /** 기능 추가 — 간략 */
  features: string[];
  /** 개선 — 간략 */
  improvements: string[];
  /** 버그 수정 — 상세 */
  fixes: string[];
};

export const RELEASE_NOTES: ReleaseNotes = {
  version: APP_VERSION,
  date: '2026-07-03',
  features: [
    'Added Session Wizard, a nine-step guided workflow that creates, previews, sends, and saves complete mastering setups.',
    'Added a Normalize (start level) question to the Session Wizard with an illustrated choice and plain-language guidance.',
    'Rebuilt the in-app Manual with new v0.14 screenshots, Screens & Menus and Session Wizard chapters, and a step-by-step Render Batch guide.',
    'Added Min-φ Parametric and 9-Band Graphic EQ selection to Session Wizard, with genre, mood, and bass-aware EQ mapping.',
    'Added editable Session Cards with descriptions, theme-highlighted headers, rename/delete controls, and full-title tooltips.',
    'Added a WASM SIMD Kaiser polyphase sinc sample-rate conversion engine with an automatic TypeScript fallback.',
    'Added 9-Band Graphic EQ presets, user presets, live graph control, export, batch, and session support.',
    'Added direct AIFF/AIF playback, analysis, and export support.',
    'Expanded Render Batch with multiple jobs, per-job Session Cards, and mixed file/folder input.',
  ],
  improvements: [
    'Session Wizard Balanced loudness now applies a 5% saturation baseline for subtle glue instead of no coloring.',
    'Session Wizard now provides automatic content-height sizing with extra bottom slack, fixed width and top position, Before/After switching, detailed waveforms, and monitor volume inherited from the Desk.',
    'Wizard sessions use automatic genre-based serial names, localized Korean or English names, and preserve the generated setup summary as the session description.',
    'Moved Session Wizard from the Project submenu to the main application top bar.',
    'Expanded the Transport meter to SUB/LOW/MID/HIGH/AIR plus RMS with six-segment color thresholds.',
    'Selected tracks are resampled immediately after loading, selection, or rate changes without blocking the interface.',
    'Matched spectrum FFT and hop sizes to the selected sample rate and improved Denoise analysis performance with parallel channel processing.',
    'Added MP3/96 kHz compatibility prompts, improved OGG/M4A metadata detection, and refined Render Batch feedback and file handling.',
  ],
  fixes: [
    'Fixed the Loudness saturator lifting the low-level noise floor as Saturate increased (up to +12 dB), so raising Saturate no longer adds audible hiss; harmonics and compression now occur only near peaks.',
    'Removed 48→44.1 kHz high-band alias residue and 48→96 kHz source-Nyquist imaging by replacing Chromium SRC with measured sinc conversion.',
    'Fixed 9-Band EQ graph, preset state, export, batch render, session save, and new-project reset behavior.',
    'Fixed Session Card Korean IME composition by preserving the editing input across renders.',
    'Fixed Wizard playback continuing after Start over and restored missing selected-option check icons.',
    'Fixed Wizard window clipping, repeated width changes, and off-screen bottom controls.',
    'Fixed Normalize being skipped when exporting a newly loaded file before Preview.',
    'Fixed Repeat Fade In/Out, queue selection preparation, unrelated-file removal playback, and Pause overlay state.',
    'Fixed AIFF/AIF metadata and playback issues and improved Render Batch cancellation feedback.',
  ],
};
