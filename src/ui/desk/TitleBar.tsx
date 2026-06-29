// FocusDAW Mastering Desk v0.1.1 (Phase 0 UI) - 타이틀바 (원본 dc.html 이식)
// Project/Edit/Help 메뉴(원본) + 레이트/포맷 칩 + 윈도우 컨트롤(IPC).
import { useEffect } from 'react';
import logoUrl from '../../../assets/logo.png';
import { css } from '../../desk/css';
import { useAppStore } from '../../store/appStore';
import { openAudioFilePicker } from '../../audio/filePicker';
import type { DeskView } from '../../desk/compute';

export function TitleBar({ view }: { view: DeskView }) {
  const toggleMenu = useAppStore((s) => s.toggleMenu);
  const closeMenu = useAppStore((s) => s.closeMenu);
  const transportOpen = useAppStore((s) => s.transportOpen);
  const toggleTransport = useAppStore((s) => s.toggleTransport);
  const win = window.focusdaw?.win;

  useEffect(() => {
    const h = () => closeMenu();
    window.addEventListener('click', h);
    return () => window.removeEventListener('click', h);
  }, [closeMenu]);

  // v0.2.12: F4 로 Transport 패널 열고 닫기
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'F4' || e.repeat) return;
      e.preventDefault();
      useAppStore.getState().toggleTransport();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // v0.8.9: Undo/Redo 단축키 바인딩 (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;

      if (e.key?.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          useAppStore.getState().redo();
        } else {
          useAppStore.getState().undo();
        }
      } else if (e.key?.toLowerCase() === 'y') {
        e.preventDefault();
        useAppStore.getState().redo();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  // 메뉴 항목 동작
  const onMenuItem = async (label: string) => {
    closeMenu();
    if (label === 'Undo') {
      useAppStore.getState().undo();
    } else if (label === 'Redo') {
      useAppStore.getState().redo();
    } else if (label === 'New Session') {
      useAppStore.getState().clearFiles();
    } else if (label === 'Open') {
      const picked = await openAudioFilePicker({ directory: false });
      if (picked.length) {
        useAppStore.getState().clearFiles();
        await useAppStore.getState().loadFiles(picked);
      }
    } else if (label === 'Import Files...' || label === 'Import Files…') {
      const picked = await openAudioFilePicker({ directory: false });
      if (picked.length) await useAppStore.getState().loadFiles(picked);
    } else if (label === 'Import Folder') {
      const recursive = useAppStore.getState().vals['input.scope'] === 'Sub Folder';
      const picked = await openAudioFilePicker({ directory: true, recursive });
      if (picked.length) await useAppStore.getState().loadFiles(picked);
    } else if (label === 'Preference (Setup)') {
      window.focusdaw?.win?.openPreferences?.();
    } else if (label === 'About') {
      window.focusdaw?.win?.openAbout?.();
    } else if (label === 'Manual') {
      window.focusdaw?.win?.openManual?.();
    } else if (label === 'Quit') {
      window.focusdaw?.win?.close?.();
    }
  };

  return (
    <div
      className="app-drag"
      style={{ position: 'relative', height: 44, display: 'flex', alignItems: 'center', gap: 11, padding: '0 15px', background: '#1a1f25', borderBottom: '1px solid #0a0d10' }}
    >
      <img src={logoUrl} alt="FocusDAW" style={{ height: 26, width: 26, objectFit: 'contain', flex: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }} />

      <div className="app-no-drag" style={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative', zIndex: 20 }} onClick={(e) => e.stopPropagation()}>
        {view.menus.filter((mn) => mn.label !== 'Help').map((mn) => (
          <div key={mn.label} style={{ position: 'relative' }}>
            <div onClick={() => toggleMenu(mn.label)} style={css(mn.btnStyle)}>{mn.label}</div>
            {mn.open && (
              <div style={{ position: 'absolute', top: 30, left: 0, minWidth: 172, background: '#20262d', border: '1px solid #323b44', borderRadius: 8, boxShadow: '0 14px 34px -10px rgba(0,0,0,0.7)', padding: 5, zIndex: 30 }}>
                {mn.items.map((it, idx) =>
                  it.isDiv ? (
                    <div key={idx} style={{ height: 1, margin: '5px 8px', background: '#323b44' }} />
                  ) : (
                    <div key={idx} onClick={() => onMenuItem(it.label)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, fontFamily: 'Archivo', fontSize: 11.5, color: '#cdd8de', padding: '7px 9px', borderRadius: 5, cursor: 'pointer' }}>
                      <span>{it.label}</span>
                      <span style={{ fontFamily: 'Archivo', fontSize: 10, color: '#5e6b73' }}>{it.key}</span>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        ))}

        {/* Transport 패널 토글 (v0.2.11) */}
        <div onClick={() => toggleTransport()} style={css(`font-family:'Archivo';font-size:11.5px;font-weight:500;color:${transportOpen ? view.accent : '#9aa7af'};padding:5px 10px;border-radius:6px;cursor:pointer;background:${transportOpen ? '#283038' : 'transparent'};white-space:nowrap`)}>Transport(F4)</div>

        {/* Help 메뉴 (v0.8.9: Transport 우측 이동) */}
        {view.menus.filter((mn) => mn.label === 'Help').map((mn) => (
          <div key={mn.label} style={{ position: 'relative' }}>
            <div onClick={() => toggleMenu(mn.label)} style={css(mn.btnStyle)}>{mn.label}</div>
            {mn.open && (
              <div style={{ position: 'absolute', top: 30, left: 0, minWidth: 172, background: '#20262d', border: '1px solid #323b44', borderRadius: 8, boxShadow: '0 14px 34px -10px rgba(0,0,0,0.7)', padding: 5, zIndex: 30 }}>
                {mn.items.map((it, idx) =>
                  it.isDiv ? (
                    <div key={idx} style={{ height: 1, margin: '5px 8px', background: '#323b44' }} />
                  ) : (
                    <div key={idx} onClick={() => onMenuItem(it.label)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, fontFamily: 'Archivo', fontSize: 11.5, color: '#cdd8de', padding: '7px 9px', borderRadius: 5, cursor: 'pointer' }}>
                      <span>{it.label}</span>
                      <span style={{ fontFamily: 'Archivo', fontSize: 10, color: '#5e6b73' }}>{it.key}</span>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'Spectral, serif', fontSize: 16, fontWeight: 600, letterSpacing: '0.04em', color: '#efe7d6' }}>FocusDAW - Mastering Desk</span>
        <span style={{ fontSize: 11.5, color: '#6f7d86' }}>Station Edition</span>
      </div>

      <div style={{ flex: 1 }} />

      <span style={{ fontFamily: 'Archivo', fontSize: 10.5, color: '#6f7d86', border: '1px solid #303841', borderRadius: 5, padding: '3px 8px' }}>{view.titleRate} · {view.titleBit}</span>
      <span style={{ fontFamily: 'Archivo', fontSize: 10.5, color: view.accent, border: '1px solid #303841', borderRadius: 5, padding: '3px 8px' }}>{view.titleFormat}</span>

      <div className="app-no-drag tb-win" style={{ display: 'flex', alignItems: 'center', gap: 7, marginLeft: 6 }}>
        <div onClick={() => win?.minimize()} style={{ width: 22, height: 20, borderRadius: 5, display: 'grid', placeItems: 'center', background: '#252b32', border: '1px solid #303841', cursor: 'pointer' }}><div style={{ width: 8, height: 1.5, background: '#9aa7af' }} /></div>
        <div onClick={() => win?.close()} style={{ width: 22, height: 20, borderRadius: 5, display: 'grid', placeItems: 'center', background: '#252b32', border: '1px solid #303841', color: '#9aa7af', fontSize: 12, cursor: 'pointer' }}>×</div>
      </div>
    </div>
  );
}
