// FocusDAW Mastering Desk v0.2.15 - 접힌 Transport 진행 막대 포함 Footer
import { useEffect, useRef } from 'react';
import type { DeskView } from '../../desk/compute';
import { previewEngine } from '../../audio/previewEngine';
import { useAppStore } from '../../store/appStore';
import { APP_VERSION_LABEL } from '../../version';

export function Footer({ view }: { view: DeskView }) {
  const transportOpen = useAppStore((s) => s.transportOpen);
  const toggleTransport = useAppStore((s) => s.toggleTransport);
  const duration = useAppStore((s) => s.files[s.curFile]?.meta.duration ?? 0);
  const progressRef = useRef<HTMLDivElement>(null);
  const progressTipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const fraction = duration > 0
        ? Math.max(0, Math.min(1, previewEngine.getCurrentTime() / duration))
        : 0;
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${fraction})`;
      }
      if (progressTipRef.current) {
        progressTipRef.current.style.left = `${fraction * 100}%`;
        progressTipRef.current.style.opacity = fraction > 0 ? '1' : '0';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration]);

  return (
    <div style={{ position: 'relative', height: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 15px', background: '#13171c', borderTop: '1px solid #0a0d10' }}>
      {!transportOpen && (
        <div style={{ position: 'absolute', top: -1, left: 0, right: 0, height: 3, overflow: 'hidden', background: view.pal.panelDark, pointerEvents: 'none' }}>
          <div
            ref={progressRef}
            style={{
              width: '100%', height: '100%', transform: 'scaleX(0)', transformOrigin: 'left center',
              background: view.accent, boxShadow: `0 0 5px ${view.accent}, 0 0 10px ${view.pal.glow}`,
              willChange: 'transform',
            }}
          />
          <div
            ref={progressTipRef}
            style={{
              position: 'absolute', top: 0, left: 0, width: 8, height: '100%', opacity: 0,
              transform: 'translateX(-100%)', background: view.pal.aBright,
              boxShadow: `0 0 5px ${view.pal.aBright}, 0 0 11px ${view.pal.aGlow}`,
              willChange: 'left', pointerEvents: 'none',
            }}
          />
        </div>
      )}
      <span style={{ fontFamily: 'Archivo', fontSize: 10, color: '#5e6b73' }}>{view.batchCount} files queued · {view.batchSize}</span>
      <button
        type="button"
        onClick={toggleTransport}
        title={transportOpen ? 'Close Transport (F4)' : 'Open Transport (F4)'}
        aria-label={transportOpen ? 'Close Transport' : 'Open Transport'}
        style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          width: 32, height: 20, padding: 0, display: 'grid', placeItems: 'center',
          border: '1px solid #303841', borderRadius: 6,
          background: transportOpen ? `${view.accent}24` : '#20262d',
          color: transportOpen ? view.accent : '#7f8b93',
          cursor: 'pointer', zIndex: 2,
        }}
      >
        <svg width="12" height="7" viewBox="0 0 12 7" aria-hidden="true">
          <path
            d={transportOpen ? 'M1 6l5-5 5 5' : 'M1 1l5 5 5-5'}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <span style={{ fontFamily: 'Archivo', fontSize: 10, color: '#5e6b73' }}>{APP_VERSION_LABEL}</span>
    </div>
  );
}
