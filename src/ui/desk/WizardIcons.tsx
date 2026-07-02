// FocusDAW Mastering Desk - Mastering Wizard 아이콘 스프라이트 (v0.13.0)
// 출처: _refer/Mastering Wizard.standalone.html 의 <symbol> 정의 이식.
// 한 번 렌더하면 문서 어디서든 <svg><use href="#wz-<name>"/></svg> 로 참조한다.

/** 마법사 창 상단에 1회 마운트되는 숨김 SVG 스프라이트. */
export function WizardSprite() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
      <defs>
        <symbol id="wz-sparkle" viewBox="0 0 24 24"><path d="M12 2.5l1.7 6.6 6.6 1.7-6.6 1.7L12 19.1l-1.7-6.6L3.7 10.8l6.6-1.7z" fill="currentColor" /></symbol>
        <symbol id="wz-mic" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6 11a6 6 0 0 0 12 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></symbol>
        <symbol id="wz-pulse" viewBox="0 0 24 24"><circle cx="12" cy="12" r="2" fill="currentColor" /><path d="M7.6 8.6a5 5 0 0 0 0 6.8M4.8 6.1a9 9 0 0 0 0 11.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M16.4 8.6a5 5 0 0 1 0 6.8M19.2 6.1a9 9 0 0 1 0 11.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></symbol>
        <symbol id="wz-note" viewBox="0 0 24 24"><path d="M9 18V6l10-2v12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6.2" cy="18" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="16.2" cy="16" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.6" /></symbol>
        <symbol id="wz-strings" viewBox="0 0 24 24"><path d="M6 21c0-4 3-5 3-9s-2-3-2-6 3-3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M13 21c0-4 3-5 3-9s-2-3-2-6 3-3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></symbol>
        <symbol id="wz-boom" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="14" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="8.4" r="1.2" fill="currentColor" /></symbol>
        <symbol id="wz-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" /><g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="12" y1="2.5" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="21.5" /><line x1="2.5" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="21.5" y2="12" /><line x1="5.2" y1="5.2" x2="6.9" y2="6.9" /><line x1="17.1" y1="17.1" x2="18.8" y2="18.8" /><line x1="18.8" y1="5.2" x2="17.1" y2="6.9" /><line x1="6.9" y1="17.1" x2="5.2" y2="18.8" /></g></symbol>
        <symbol id="wz-flame" viewBox="0 0 24 24"><path d="M12 3c3.4 3.8 5.2 6.2 5.2 9.2A5.2 5.2 0 0 1 6.8 12.2c0-1.6.8-2.8 1.9-3.8.1 1.3 1 2.2 2 2.2.2-3-1.1-5 1.3-7.6z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></symbol>
        <symbol id="wz-bolt" viewBox="0 0 24 24"><path d="M13 2.5L6 13h5l-1 8.5L18 10h-5z" fill="currentColor" /></symbol>
        <symbol id="wz-feather" viewBox="0 0 24 24"><path d="M19 5c0 7-5 12-11 13 0 0-2-8 3-12 3.5-2.8 8-1 8-1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><line x1="16" y1="8" x2="7" y2="18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></symbol>
        <symbol id="wz-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="12" r="2" fill="currentColor" /></symbol>
        <symbol id="wz-cloud" viewBox="0 0 24 24"><path d="M7 17a4 4 0 0 1 .3-8A5 5 0 0 1 17 9.3 3.6 3.6 0 0 1 16.8 17z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></symbol>
        <symbol id="wz-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><ellipse cx="12" cy="12" rx="3.6" ry="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><line x1="3.5" y1="12" x2="20.5" y2="12" stroke="currentColor" strokeWidth="1.5" /></symbol>
        <symbol id="wz-disc" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" /></symbol>
        <symbol id="wz-film" viewBox="0 0 24 24"><rect x="3.5" y="6" width="17" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><line x1="8" y1="6" x2="8" y2="18" stroke="currentColor" strokeWidth="1.4" /><line x1="16" y1="6" x2="16" y2="18" stroke="currentColor" strokeWidth="1.4" /></symbol>
        <symbol id="wz-wave" viewBox="0 0 24 24"><path d="M2.5 12q2.4-6 4.8 0t4.8 0 4.8 0 4.6 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></symbol>
        <symbol id="wz-static" viewBox="0 0 24 24"><g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><line x1="4" y1="15" x2="4" y2="9" /><line x1="8" y1="17" x2="8" y2="7" /><line x1="12" y1="14" x2="12" y2="10" /><line x1="16" y1="18" x2="16" y2="6" /><line x1="20" y1="16" x2="20" y2="8" /></g></symbol>
        <symbol id="wz-eq-knobs" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="5" y1="3" x2="5" y2="21" /><line x1="12" y1="3" x2="12" y2="21" /><line x1="19" y1="3" x2="19" y2="21" /></g><g fill="currentColor"><rect x="2.5" y="6" width="5" height="4" rx="1.5" /><rect x="9.5" y="13" width="5" height="4" rx="1.5" /><rect x="16.5" y="8" width="5" height="4" rx="1.5" /></g></symbol>
        <symbol id="wz-eq-curve" viewBox="0 0 24 24"><path d="M3 17c3.2 0 3.8-7 7-7s3.8 4 6.1 4S18.4 7 21 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M3 20.5h18M3 3.5v17" fill="none" stroke="currentColor" strokeWidth="1.1" opacity=".45" /></symbol>
        <symbol id="wz-check" viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 6.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></symbol>
        <symbol id="wz-heart" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-9.2-9C1.3 8 3 4.5 6.4 4.5c2 0 3.2 1.2 3.9 2.4l1.7 2 1.7-2c.7-1.2 1.9-2.4 3.9-2.4 3.4 0 5.1 3.5 3.6 6.5C19 15.6 12 20 12 20z" fill="currentColor" /></symbol>
      </defs>
    </svg>
  );
}

/** #wz-<name> 심볼을 그리는 헬퍼. */
export function WzIcon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={color ? { color } : undefined}>
      <use href={`#wz-${name}`} />
    </svg>
  );
}
