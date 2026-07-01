// FocusDAW Mastering Desk v0.11.0 - 릴리스 노트 (현재 버전 전용)
// Help ▸ Release Notes 창에 표시. v0.10.0 이후 현재 버전까지의 변경 내용을 간략히 누적한다.
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
  date: '2026-07-01',
  features: [
    'Added Help > Release Notes and an in-app update-check result window.',
    'Added direct AIFF/AIF playback, analysis, and export support.',
    'Added a 9-band graphic EQ with presets, user presets, live metering, and session support.',
    'Expanded Render Batch with multiple jobs, per-job Session Cards, and mixed file/folder input.',
  ],
  improvements: [
    'Update availability is now shown as a scrolling footer message with a single centered update dialog.',
    'Updates now ask for permission before downloading or installing.',
    'Greatly improved Denoise speed with fast quiet-range detection and parallel channel processing.',
    'Improved OGG and M4A metadata detection for sample rate, channels, and duration.',
    'Added drag-and-drop, duplicate filtering, source-path tooltips, and clearer progress animations to Render Batch.',
    'Added theme-colored glow and breathing feedback for the active Batch Job and active file.',
    'Added the support contact address to Help > About.',
  ],
  fixes: [
    'Removed the duplicate lower-right update banner and unified unavailable/error states as a normal informational message.',
    'Update-server or release-file failures no longer obstruct the app or expose raw server responses.',
    'Fixed Later still allowing an update to install automatically when the app exited.',
    'Fixed AIFF/AIF files failing to show metadata or play.',
    'Fixed 9-band EQ graph, preset state, export, batch render, session save, and new-project reset behavior.',
    'Fixed Normalize being skipped when exporting a newly loaded file before Preview.',
    'Fixed Render Batch cancellation feedback so the active job and file turn inactive immediately.',
  ],
};
