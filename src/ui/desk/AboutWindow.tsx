import logoUrl from '../../../assets/logo-main2.png';
import { useAppStore } from '../../store/appStore';
import { THEMES } from '../../theme/themes';
import { APP_VERSION_LABEL } from '../../version';

export function AboutWindow() {
  const theme = useAppStore((s) => s.theme);
  const pal = THEMES[theme] || THEMES.Teal;
  
  // Choose the dark theme-derived color to contrast with the light warm-gray base background
  const darkColor = theme.includes('Light') ? pal.aMain : pal.aInk;

  const handleClose = () => {
    window.focusdaw?.win?.close();
  };

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
          ABOUT
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

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 30px',
          textAlign: 'center',
        }}
      >
        {/* App Logo */}
        <div
          style={{
            position: 'relative',
            width: 60,
            height: 60,
            marginBottom: 10,
            borderRadius: 14,
            background: '#efe7d6',
            border: '1px solid #b5ae9f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
          }}
        >
          <img
            src={logoUrl}
            alt="FocusDAW Logo"
            style={{
              width: 44,
              height: 44,
              objectFit: 'contain',
            }}
          />
        </div>

        {/* App Name */}
        <h1
          style={{
            fontFamily: 'Spectral, serif',
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: '0.01em',
            margin: 0,
            color: '#3a342c',
          }}
        >
          FocusDAW - Mastering Desk
        </h1>

        {/* Version Badge */}
        <div
          style={{
            marginTop: 4,
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: 20,
            background: `${darkColor}1a`,
            border: `1px solid ${darkColor}33`,
            color: darkColor,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'var(--mono)',
            letterSpacing: '0.02em',
          }}
        >
          Station Edition {APP_VERSION_LABEL}
        </div>

        {/* Short Description */}
        <p
          style={{
            marginTop: 10,
            marginBottom: 14,
            fontSize: 11.5,
            color: '#5a5347',
            lineHeight: '1.55',
            maxWidth: 320,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          A professional, high-fidelity mastering environment.
          Engineered with precision gain controls, loudness normalization,
          and a real-time true-peak limiter.
        </p>

        {/* v0.10.3 (A4 ④): Contact email — OK 버튼 위, 윗줄·아랫줄 한 칸씩 띄움 */}
        <p
          style={{
            marginTop: 4,
            marginBottom: 18,
            fontSize: 11.5,
            fontWeight: 600,
            color: darkColor,
            letterSpacing: '0.01em',
          }}
        >
          focustone.el@gmail.com
        </p>

        {/* Confirm Button */}
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
