// FocusDAW Mastering Desk v0.14.5 - 릴리스 노트
// Help ▸ Release Notes 창에 표시. v0.14.4 이후 변경 내용만 요약한다.
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
  date: '2026-07-08',
  features: [
    'Added Session Cards: export the current mastering setup to a single portable .fmsc file and import one back, from Project ▸ Export Session and Import Session.',
    'Added an Export button to each saved session in the Open window to write it out as a .fmsc file.',
  ],
  improvements: [
    'The session export confirmation now shows the actual saved file name instead of the album title.',
    'Importing a session card now also adds it to the session library under the imported file name.',
    'Added a divider between Save Session and Import Session in the Project menu.',
  ],
  fixes: [
    'Fixed Preview playing louder than the exported file. Preview now measures the processed chain in the background and matches the export loudness — shown by a brief “Matching loudness” indicator — so what you hear lines up with what you export. (Exported files were already at the correct target.)',
  ],
};
