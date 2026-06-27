import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { THEME_NAMES, THEMES, applyTheme, ThemeName } from '../../theme/themes';
import logoUrl from '../../../assets/logo-main2.png';

// Helper to map 8 FocusDAW ThemeTokens to variations.html style preview colors
function getThemePreviewColors(name: ThemeName) {
  const t = THEMES[name];
  const isLight = name.includes('Light');

  return {
    bg: t.deskA,
    bg2: t.deskB,
    surface: t.paperCtl,
    line: t.paperB,
    text: t.pInk,
    text2: t.pInk2,
    muted: t.pInk2,
    accent: t.aMain,
    green: isLight ? '#7c9a4f' : '#94c06a',
    amber: isLight ? '#caa53f' : '#e8b04b',
    red: isLight ? '#c2593b' : '#d96a4e',
    blue: isLight ? '#5f86a6' : '#7fb0c4',
    wave: t.aMain,
    panel: t.paperA,
    aInk: t.aInk,
    glow: t.glow,
  };
}

// Hardcoded user-friendly theme descriptions
function getThemeDescription(name: ThemeName) {
  switch (name) {
    case 'Teal':
      return 'Deep teal + gold accent · dark console theme';
    case 'Sunset':
      return 'Warm orange + amber accent · vintage analog console';
    case 'Violet':
      return 'Neon violet + lilac accent · retro synthwave aesthetic';
    case 'Crimson':
      return 'Dark crimson + rose accent · aggressive modern console';
    case 'Teal Light':
      return 'Clean teal + soft dark teal · daylight studio aesthetic';
    case 'Sunset Light':
      return 'Warm paper beige + amber accent · bright vintage style';
    case 'Violet Light':
      return 'Soft purple + deep violet accent · clean lavender look';
    case 'Crimson Light':
      return 'Pale crimson + ruby ink · bright aggressive studio';
    default:
      return '';
  }
}

export function PreferencesWindow() {
  const theme = useAppStore((s) => s.theme);
  const setThemeStore = useAppStore((s) => s.setTheme);
  const [activeTab, setActiveTab] = useState<'theme'>('theme');

  // Apply theme to the preferences window's own document
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleThemeSelect = (name: ThemeName) => {
    setThemeStore(name);
    window.focusdaw?.win?.setTheme?.(name);
  };

  const handleClose = () => {
    window.focusdaw?.win?.close?.();
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#c9c3b8',
        color: '#3a342c',
        fontFamily: 'Archivo, sans-serif',
        overflow: 'hidden',
        border: '1px solid #9fa2a6',
        boxSizing: 'border-box',
      }}
    >
      {/* Title Bar - Warm Grey / Light Theme */}
      <div
        className="app-drag"
        style={{
          height: 44,
          background: '#bdb6a9',
          borderBottom: '1px solid #a8aeb2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flex: 'none',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logoUrl} alt="FocusDAW" style={{ height: 22, width: 22, objectFit: 'contain' }} />
          <div style={{ width: 1, height: 14, background: '#a0998c' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#3a342c', letterSpacing: '0.02em' }}>Preferences</span>
        </div>
        <button
          className="app-no-drag"
          onClick={handleClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#5a5347',
            fontSize: 22,
            fontWeight: 300,
            cursor: 'pointer',
            padding: '2px 8px',
            borderRadius: 4,
            transition: 'all 150ms ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
          &times;
        </button>
      </div>

      {/* Main Workspace */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar - Muted Warm Beige */}
        <div
          style={{
            width: 170,
            background: '#bdb6a9',
            borderRight: '1px solid #a8aeb2',
            padding: '20px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            flex: 'none',
          }}
        >
          <div
            onClick={() => setActiveTab('theme')}
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              fontFamily: 'Spectral, serif',
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 1.1,
              cursor: 'pointer',
              transition: 'all 120ms ease',
              background: activeTab === 'theme' ? '#efe7d6' : 'transparent',
              color: '#3a342c',
              border: activeTab === 'theme' ? '1px solid #a8aeb2' : '1px solid transparent',
              boxShadow: activeTab === 'theme' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'theme') {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'theme') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            Color Theme
          </div>
        </div>

        {/* Content Pane - Light beige dotted background */}
        <div
          style={{
            flex: 1,
            padding: '22px 26px',
            overflowY: 'auto',
            background: '#c9c3b8',
            backgroundImage: 'radial-gradient(#bdb6a9 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#3a342c', margin: '0 0 2px 0' }}>App Color Schemes</h2>
            <p style={{ fontSize: 11.5, color: '#6a6357', margin: 0 }}>
              Whole-app palette directions — previewed in the Input parameters
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16,
              paddingBottom: 24,
            }}
          >
            {THEME_NAMES.map((name) => {
              const previewColors = getThemePreviewColors(name);
              const isSelected = name === theme;
              const desc = getThemeDescription(name);

              return (
                <div
                  key={name}
                  onClick={() => handleThemeSelect(name)}
                  style={{
                    background: '#efe7d6',
                    border: isSelected ? `2.5px solid ${previewColors.accent}` : '1px solid #b5ae9f',
                    borderRadius: 10,
                    padding: isSelected ? '10px' : '11px',
                    cursor: 'pointer',
                    transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    boxShadow: isSelected
                      ? `0 10px 24px -8px rgba(0,0,0,0.18), 0 0 16px ${previewColors.glow}44`
                      : '0 4px 12px -8px rgba(0,0,0,0.15)',
                    transform: isSelected ? 'scale(1.01)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#8c8474';
                      e.currentTarget.style.boxShadow = '0 6px 16px -6px rgba(0,0,0,0.18)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#b5ae9f';
                      e.currentTarget.style.boxShadow = '0 4px 12px -8px rgba(0,0,0,0.15)';
                    }
                  }}
                >
                  {/* Theme Info Header */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: '#3a342c' }}>{name}</span>
                      {isSelected && (
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            background: previewColors.accent,
                            color: previewColors.aInk || '#080b0e',
                            padding: '1px 5px',
                            borderRadius: 3.5,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            boxShadow: `0 0 8px ${previewColors.glow}50`,
                          }}
                        >
                          Active
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: '#7a7264' }}>{desc}</span>
                  </div>

                  {/* Input PARAMETERS sample */}
                  <div
                    style={{
                      width: '100%',
                      borderRadius: 8,
                      padding: '12px 14px 13px',
                      boxSizing: 'border-box',
                      border: `1px solid ${previewColors.line}80`,
                      background: previewColors.panel,
                      boxShadow: '0 8px 24px -12px rgba(0,0,0,0.35)',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.14em',
                        color: previewColors.muted,
                        marginBottom: 10,
                      }}
                    >
                      PARAMETERS
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '42px 1fr 28px 1fr',
                        alignItems: 'center',
                        gap: '9px 8px',
                        fontSize: 9,
                        color: previewColors.muted,
                      }}
                    >
                      <span>Source</span>
                      <div style={{ display: 'flex', padding: 3, borderRadius: 8, background: previewColors.surface }}>
                        <span style={{ flex: 1, padding: '5px 4px', borderRadius: 6, textAlign: 'center', fontWeight: 700, color: previewColors.aInk, background: previewColors.accent }}>Files</span>
                        <span style={{ flex: 1, padding: '5px 4px', textAlign: 'center', fontWeight: 600, color: previewColors.text2 }}>Folder</span>
                      </div>
                      <span>PCM</span>
                      <div style={{ display: 'flex', padding: 3, borderRadius: 8, background: previewColors.surface }}>
                        <span style={{ flex: 1, padding: '5px 2px', textAlign: 'center', fontWeight: 600, color: previewColors.text2 }}>16</span>
                        <span style={{ flex: 1, padding: '5px 2px', borderRadius: 6, textAlign: 'center', fontWeight: 700, color: previewColors.aInk, background: previewColors.accent }}>24</span>
                        <span style={{ flex: 1, padding: '5px 2px', textAlign: 'center', fontWeight: 600, color: previewColors.text2 }}>32f</span>
                      </div>
                      <span>Folder</span>
                      <div style={{ display: 'flex', padding: 3, borderRadius: 8, background: previewColors.surface }}>
                        <span style={{ flex: 1, padding: '5px 3px', textAlign: 'center', fontWeight: 600, color: previewColors.text2 }}>Root</span>
                        <span style={{ flex: 1.4, padding: '5px 3px', borderRadius: 6, textAlign: 'center', fontWeight: 700, color: previewColors.aInk, background: previewColors.accent }}>Sub Folder</span>
                      </div>
                      <span>Normalize</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 34, height: 19, padding: 2, borderRadius: 12, boxSizing: 'border-box', background: previewColors.surface }}>
                          <i style={{ display: 'block', width: 15, height: 15, borderRadius: '50%', background: previewColors.panel, boxShadow: '0 1px 2px rgba(0,0,0,.3)' }} />
                        </span>
                        <span style={{ fontWeight: 600 }}>OFF</span>
                      </div>
                    </div>
                    <div style={{ height: 1, marginTop: 10, background: previewColors.line, opacity: 0.65 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
