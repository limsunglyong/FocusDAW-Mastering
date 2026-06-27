// FocusDAW Mastering Desk - 앱 셸 (원본 윈도우 카드 구조 그대로)
// 전체 윈도우 프레임 안에 타이틀바 → 트랜스포트 → 데스크 → 상세 시트 → 푸터.
// v0.2.0(Phase 1): 전역 드래그&드롭으로 오디오 파일을 큐에 로딩.
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from './store/appStore';
import { computeView } from './desk/compute';
import { useKnobInteractions } from './desk/useKnob';
import { audioFilesFromDataTransfer } from './audio/filePicker';
import { IconDefs } from './ui/Icons';
import { TitleBar } from './ui/desk/TitleBar';
import { TransportBar } from './ui/desk/TransportBar';
import { Desk } from './ui/desk/Desk';
import { DetailSheet } from './ui/desk/DetailSheet';
import { TransportPanel } from './ui/desk/TransportPanel';
import { PreferencesWindow } from './ui/desk/PreferencesWindow';
import { AboutWindow } from './ui/desk/AboutWindow';
import { ManualWindow } from './ui/desk/ManualWindow';
import { Footer } from './ui/desk/Footer';

export default function App() {
  const isPreferences = window.location.hash === '#preferences' || window.location.search.includes('window=preferences');
  const isAbout = window.location.hash === '#about' || window.location.search.includes('window=about');
  const isManual = window.location.hash === '#manual' || window.location.search.includes('window=manual');

  const theme = useAppStore((s) => s.theme);

  // Apply theme dynamically to body or document even in sub-windows
  useEffect(() => {
    import('./theme/themes').then(({ applyTheme }) => {
      applyTheme(theme);
    });
  }, [theme]);

  // Listen to broadcast theme changes
  useEffect(() => {
    const unsub = window.focusdaw?.win?.onThemeUpdated?.((t: string) => {
      useAppStore.getState().setTheme(t as any);
    });
    return () => {
      unsub?.();
    };
  }, []);

  if (isPreferences) {
    return <PreferencesWindow />;
  }

  if (isAbout) {
    return <AboutWindow />;
  }

  if (isManual) {
    return <ManualWindow />;
  }

  return <StudioDesk />;
}

function StudioDesk() {
  useKnobInteractions();

  const open = useAppStore((s) => s.open);
  const curFile = useAppStore((s) => s.curFile);
  const openMenu = useAppStore((s) => s.openMenu);
  const eqAdvanced = useAppStore((s) => s.eqAdvanced);
  const enabled = useAppStore((s) => s.enabled);
  const vals = useAppStore((s) => s.vals);
  const theme = useAppStore((s) => s.theme);
  const transportOpen = useAppStore((s) => s.transportOpen);
  const files = useAppStore((s) => s.files);
  const loadFiles = useAppStore((s) => s.loadFiles);
  const importing = useAppStore((s) => s.importing);
  const importTotal = useAppStore((s) => s.importTotal);
  const importDone = useAppStore((s) => s.importDone);
  const importCurrentName = useAppStore((s) => s.importCurrentName);
  const processingAudio = useAppStore((s) => s.processingAudio);
  const processingMessage = useAppStore((s) => s.processingMessage);
  const processingCurrentName = useAppStore((s) => s.processingCurrentName);
  const processingDone = useAppStore((s) => s.processingDone);
  const processingTotal = useAppStore((s) => s.processingTotal);
  const userPresets = useAppStore((s) => s.userPresets);
  const activeUserPresetIdx = useAppStore((s) => s.activeUserPresetIdx);
  const lastActivePresetName = useAppStore((s) => s.lastActivePresetName);
  const initUserPresets = useAppStore((s) => s.initUserPresets);

  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    void initUserPresets();
  }, [initUserPresets]);

  const view = useMemo(
    () => computeView({ open, curFile, openMenu, eqAdvanced, enabled, vals, userPresets, activeUserPresetIdx, lastActivePresetName } as any, theme, files),
    [open, curFile, openMenu, eqAdvanced, enabled, vals, theme, files, userPresets, activeUserPresetIdx, lastActivePresetName],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const recursive = useAppStore.getState().vals['input.scope'] === 'Sub Folder';
      void audioFilesFromDataTransfer(e.dataTransfer, recursive).then((dropped) => {
        if (dropped.length) void loadFiles(dropped);
      });
    },
    [loadFiles],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      setDragOver(true);
    }
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (e.relatedTarget === null) setDragOver(false);
  }, []);

  const prevTransportOpen = useRef(transportOpen);
  useEffect(() => {
    if (prevTransportOpen.current === transportOpen) return;
    prevTransportOpen.current = transportOpen;
    window.focusdaw?.win?.setTransport?.(transportOpen);
  }, [transportOpen]);

  return (
    <div
      style={{ width: '100vw', height: '100vh', background: view.pal.frame, overflow: 'hidden' }}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <IconDefs />
      <div style={{ width: '100%', height: '100%', background: view.pal.frame, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <TitleBar view={view} />
        <TransportBar view={view} />
        <Desk view={view} />
        <DetailSheet view={view} />
        {transportOpen && <TransportPanel view={view} />}
        <Footer view={view} />
      </div>

      {dragOver && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(8,11,14,0.62)', backdropFilter: 'blur(2px)',
          }}
        >
          <div style={{ padding: '26px 40px', borderRadius: 16, border: `2px dashed ${view.accent}`, background: 'rgba(20,26,31,0.9)', textAlign: 'center', boxShadow: `0 0 40px ${view.pal.glow}` }}>
            <div style={{ fontFamily: 'Spectral, serif', fontSize: 22, fontWeight: 600, color: '#efe7d6' }}>Drop audio files</div>
            <div style={{ fontFamily: 'Archivo', fontSize: 12, color: '#9aa7af', marginTop: 6 }}>WAV · MP3 · FLAC · OGG · M4A · AIFF</div>
          </div>
        </div>
      )}

      {importing && (
        <LoadingCard
          accent={view.accent}
          bright={view.pal.aBright}
          glow={view.pal.glow}
          track={view.pal.panelDark}
          done={importDone}
          total={importTotal}
          name={importCurrentName}
          title="DECODING AUDIO"
        />
      )}

      {processingAudio && (
        <LoadingCard
          accent={view.accent}
          bright={view.pal.aBright}
          glow={view.pal.glow}
          track={view.pal.panelDark}
          done={processingDone}
          total={processingTotal}
          name={processingCurrentName}
          title={processingMessage || 'RESAMPLING AUDIO'}
          unit="buffer"
        />
      )}
    </div>
  );
}

// v0.1.5: Glass 로딩 카드 — 회전하는 원형 링(가운데 퍼센트) + 현재 파일/진행률
function LoadingCard({ accent, bright, glow, track, done, total, name, title = 'DECODING AUDIO', unit = 'files' }: {
  accent: string; bright: string; glow: string; track: string; done: number; total: number; name: string; title?: string; unit?: string;
}) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  // 링 두께를 만드는 마스크: 바깥은 보이고 안쪽(반지름 - 2px)은 투명 → 글래스 배경이 비침 (v0.1.7: 두께 50%↓)
  const ringMask = 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,11,14,0.66)', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: 360, padding: '28px 30px 26px', borderRadius: 18, background: 'linear-gradient(160deg, rgba(40,48,56,0.72), rgba(18,23,28,0.82))', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(18px) saturate(1.3)', boxShadow: `0 30px 70px -18px rgba(0,0,0,0.85), 0 0 44px ${glow}, inset 0 1px 0 rgba(255,255,255,0.18)` }}>
        {/* 회전 원형 링 */}
        <div style={{ position: 'relative', width: 66, height: 66, margin: '2px auto 0' }}>
          {/* 트랙(연한 전체 원) */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: track, WebkitMask: ringMask, mask: ringMask, opacity: 0.6 }} />
          {/* 돌아가는 액센트 아크 */}
          <div
            style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: `conic-gradient(from 0deg, ${accent}00 0deg, ${accent}00 90deg, ${accent} 270deg, ${bright} 360deg)`,
              WebkitMask: ringMask, mask: ringMask,
              animation: 'dkspin 0.85s linear infinite',
            }}
          />
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'Spectral, serif', fontSize: 17, fontWeight: 600, color: accent }}>{pct}<span style={{ fontSize: 10 }}>%</span></div>
        </div>

        <div style={{ marginTop: 16, fontFamily: 'Archivo', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: '#a99f8a', textAlign: 'center' }}>{title}</div>
        <div style={{ marginTop: 6, fontFamily: 'Archivo', fontSize: 12.5, fontWeight: 600, color: '#efe7d6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{name || '—'}</div>

        <div style={{ width: '100%', height: 5, marginTop: 13, borderRadius: 4, background: track, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: `linear-gradient(90deg, ${accent}, ${bright})`, transition: 'width 0.2s ease', boxShadow: `0 0 10px ${glow}` }} />
        </div>
        <div style={{ marginTop: 8, fontFamily: 'Archivo', fontSize: 10.5, color: '#8a9099', textAlign: 'right' }}>{done} / {total} {unit}</div>
      </div>
    </div>
  );
}
