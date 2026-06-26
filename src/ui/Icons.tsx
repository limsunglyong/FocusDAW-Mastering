// FocusDAW Mastering Desk v0.1.0 (Phase 0) - 시그널 체인 아이콘 심볼 정의 (dc.html 이식)
// 한 번 렌더 후 <use href="#dk-<id>" /> 로 참조.
export function IconDefs() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
      <defs>
        <radialGradient id="dk-cap" cx="0.5" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#5a5347" />
          <stop offset="0.5" stopColor="#3a342b" />
          <stop offset="1" stopColor="#231f18" />
        </radialGradient>
        <symbol id="dk-note" viewBox="0 0 24 24">
          <path d="M9 18V6l10-2v12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6.2" cy="18" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="16.2" cy="16" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </symbol>
        <symbol id="dk-input" viewBox="0 0 24 24">
          <path d="M12 3v9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M8.4 9 12 12.6 15.6 9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 14v3.2A1.8 1.8 0 0 0 5.8 19h12.4a1.8 1.8 0 0 0 1.8-1.8V14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </symbol>
        <symbol id="dk-pre" viewBox="0 0 24 24">
          <path d="M3.5 5h17l-6.6 7.6v5.1l-3.8 1.8v-6.9z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </symbol>
        <symbol id="dk-spectral" viewBox="0 0 24 24">
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="20" x2="4" y2="13" />
            <line x1="8" y1="20" x2="8" y2="6" />
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="16" y1="20" x2="16" y2="4" />
            <line x1="20" y1="20" x2="20" y2="14" />
          </g>
        </symbol>
        <symbol id="dk-dynamics" viewBox="0 0 24 24">
          <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M8 4v4.2m0 0L5.8 6m2.2 2.2L10.2 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 20v-4.2m0 0L13.8 18m2.2-2.2L18.2 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
        <symbol id="dk-stereo" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          <path d="M7.6 9.2a4 4 0 0 0 0 5.6M4.8 6.8a8 8 0 0 0 0 10.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M16.4 9.2a4 4 0 0 1 0 5.6M19.2 6.8a8 8 0 0 1 0 10.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </symbol>
        <symbol id="dk-loudness" viewBox="0 0 24 24">
          <path d="M4 17a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <line x1="12" y1="17" x2="16.4" y2="11.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="12" cy="17" r="1.8" fill="currentColor" />
        </symbol>
        <symbol id="dk-export" viewBox="0 0 24 24">
          <path d="M12 15V4m0 0L8.4 7.6M12 4l3.6 3.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 14v3.2A1.8 1.8 0 0 0 5.8 19h12.4a1.8 1.8 0 0 0 1.8-1.8V14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </symbol>
      </defs>
    </svg>
  );
}

/** dk-<icon> 심볼을 그리는 헬퍼 */
export function DeskIcon({ icon, size = 13 }: { icon: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ pointerEvents: 'none' }}>
      <use href={`#dk-${icon}`} />
    </svg>
  );
}
