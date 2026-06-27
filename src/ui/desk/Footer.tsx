// FocusDAW Mastering Desk v0.2.15 - 접힌 Transport 진행 막대 포함 Footer
import { useEffect, useRef } from 'react';
import type { DeskView } from '../../desk/compute';
import { previewEngine } from '../../audio/previewEngine';
import { useAppStore } from '../../store/appStore';

export function Footer({ view }: { view: DeskView }) {
  const transportOpen = useAppStore((s) => s.transportOpen);
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
      <span style={{ fontFamily: 'Archivo', fontSize: 10, color: '#5e6b73' }}>Signal flows left → right · {view.activeCount}/7 stages engaged</span>
      <span style={{ fontFamily: 'Archivo', fontSize: 10, color: '#5e6b73' }}>{view.batchCount} files queued · {view.batchSize}</span>
    </div>
  );
}
