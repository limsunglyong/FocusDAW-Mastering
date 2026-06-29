// FocusDAW Mastering Desk v0.10.1 - Release Notes 창 (Help ▸ Release Notes)
// 현재 버전(releaseNotes.ts)의 변경 내용만 표시. About 창과 동일한 warm-gray borderless 스타일.
import logoUrl from '../../../assets/logo-main2.png';
import { useAppStore } from '../../store/appStore';
import { THEMES } from '../../theme/themes';
import { APP_VERSION_LABEL } from '../../version';
import { RELEASE_NOTES } from '../../releaseNotes';

export function ReleaseNotesWindow() {
  const theme = useAppStore((s) => s.theme);
  const pal = THEMES[theme] || THEMES.Teal;
  const darkColor = theme.includes('Light') ? pal.aMain : pal.aInk;

  const handleClose = () => window.focusdaw?.win?.close();

  const sections: { label: string; items: string[] }[] = [
    { label: 'New Features', items: RELEASE_NOTES.features },
    { label: 'Improvements', items: RELEASE_NOTES.improvements },
    { label: 'Bug Fixes', items: RELEASE_NOTES.fixes },
  ].filter((s) => s.items.length > 0);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#c9c3b8',
        border: '1px solid #9fa2a6',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        color: '#3a342c',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Draggable Title Bar */}
      <div
        className="app-drag"
        style={{
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          background: '#bdb6a9',
          borderBottom: '1px solid #a8aeb2',
          flex: 'none',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#3a342c', letterSpacing: '0.05em' }}>
          RELEASE NOTES
        </span>
        <div
          className="app-no-drag"
          onClick={handleClose}
          style={{
            width: 22,
            height: 20,
            borderRadius: 4,
            display: 'grid',
            placeItems: 'center',
            background: 'transparent',
            border: 'none',
            color: '#5a5347',
            fontSize: 16,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ff4d5e';
            e.currentTarget.style.background = 'rgba(255, 77, 94, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#5a5347';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          ×
        </div>
      </div>

      {/* Header: logo + version */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px 12px', flex: 'none' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: '#efe7d6',
            border: '1px solid #b5ae9f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <img src={logoUrl} alt="FocusDAW Logo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
        </div>
        <div>
          <div style={{ fontFamily: 'Spectral, serif', fontSize: 16, fontWeight: 700, color: '#3a342c' }}>
            What&apos;s New
          </div>
          <div style={{ fontSize: 11, color: '#5a5347', marginTop: 2 }}>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: darkColor }}>{APP_VERSION_LABEL}</span>
            <span style={{ margin: '0 6px', color: '#9b9384' }}>·</span>
            {RELEASE_NOTES.date}
          </div>
        </div>
      </div>

      {/* Body: sections */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px 14px' }}>
        {sections.length === 0 ? (
          <p style={{ fontSize: 12, color: '#5a5347' }}>No notes for this version.</p>
        ) : (
          sections.map((sec) => (
            <div key={sec.label} style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: darkColor,
                  marginBottom: 6,
                }}
              >
                {sec.label}
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, listStyle: 'disc' }}>
                {sec.items.map((it, i) => (
                  <li key={i} style={{ fontSize: 11.5, lineHeight: '1.55', color: '#3a342c', marginBottom: 4 }}>
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* Footer: OK */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 16px', flex: 'none' }}>
        <button
          className="app-no-drag"
          onClick={handleClose}
          style={{
            padding: '4px 20px',
            borderRadius: 6,
            border: `1px solid ${darkColor}`,
            background: `${darkColor}12`,
            color: darkColor,
            fontFamily: '"Segoe UI", sans-serif',
            fontSize: 11.5,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = darkColor;
            e.currentTarget.style.color = theme.includes('Light') ? '#ffffff' : '#efe7d6';
            e.currentTarget.style.boxShadow = `0 2px 8px ${darkColor}40`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `${darkColor}12`;
            e.currentTarget.style.color = darkColor;
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
