// FocusDAW Mastering Desk v0.10.5 - 릴리스 노트 (현재 버전 전용)
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
    'Greatly improved Denoise speed with fast quiet-range detection and parallel channel processing.',
    'Improved OGG and M4A metadata detection for sample rate, channels, and duration.',
    'Added drag-and-drop, duplicate filtering, source-path tooltips, and clearer progress animations to Render Batch.',
    'Added the support contact address to Help > About.',
  ],
  fixes: [
    'Fixed AIFF/AIF files failing to show metadata or play.',
    'Fixed 9-band EQ graph, preset state, export, batch render, session save, and new-project reset behavior.',
  ],
};
