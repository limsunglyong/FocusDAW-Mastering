// FocusDAW Mastering Desk v0.2.26 (Phase 2) - Pre 3D 스펙트로그램 뷰(Three.js)
// 회전 가능한 실제 3D 서피스 + 축 + 원본 colormap. 빈 상태/분석 로딩 오버레이 + Reset View.
import { useEffect, useRef } from 'react';
import { useAppStore } from '../../store/appStore';
import { SpectrogramScene } from '../../viz/SpectrogramScene';
import type { DeskView } from '../../desk/compute';

// 마우스 아이콘: side='left' → 좌클릭 버튼 강조(회전), side='right' → 우클릭 버튼 강조(PAN).
function MouseIcon({ side, accent, body }: { side: 'left' | 'right'; accent: string; body: string }) {
  const leftBtn = 'M12 3 L5 3 A9 9 0 0 0 2.2 9.5 L12 9.5 Z';
  const rightBtn = 'M12 3 L19 3 A9 9 0 0 1 21.8 9.5 L12 9.5 Z';
  return (
    <svg width="13" height="18" viewBox="0 0 24 34" style={{ display: 'block' }}>
      <rect x="2" y="2" width="20" height="30" rx="10" fill="none" stroke={body} strokeWidth="2" />
      <line x1="12" y1="2.5" x2="12" y2="9.5" stroke={body} strokeWidth="1.4" />
      <path d={side === 'left' ? leftBtn : rightBtn} fill={accent} opacity="0.92" />
    </svg>
  );
}

export function Spectrogram3D({ view, height = 168 }: { view: DeskView; height?: number }) {
  const pal = view.pal;
  const accent = view.accent;
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SpectrogramScene | null>(null);

  const files = useAppStore((s) => s.files);
  const curFile = useAppStore((s) => s.curFile);
  const preAnalysis = useAppStore((s) => s.preAnalysis);

  const hasFile = files.length > 0;
  const selId = hasFile ? files[curFile]?.id : undefined;
  const ready = !!preAnalysis && preAnalysis.fileId === selId;
  const analyzing = hasFile && !ready;

  // 씬 마운트/언마운트
  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new SpectrogramScene(containerRef.current);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // 분석 결과 주입 (현재 파일과 일치할 때만 표시)
  useEffect(() => {
    sceneRef.current?.setSpectrogram(ready && preAnalysis ? preAnalysis.spectrogram : null);
  }, [ready, preAnalysis]);

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: 10, overflow: 'hidden', background: '#031716', border: `1px solid ${pal.panelDark}` }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* 좌상단 라벨 */}
      <span style={{ position: 'absolute', top: 8, left: 10, fontFamily: 'Archivo', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: '#8a8070', pointerEvents: 'none' }}>SPECTRO · 3D</span>

      {/* 우상단 Reset View 버튼 */}
      <button
        onClick={() => sceneRef.current?.resetView()}
        style={{
          position: 'absolute', top: 6, right: 6, padding: '4px 9px', borderRadius: 6, cursor: 'pointer',
          fontFamily: 'Archivo', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.04em',
          color: accent, background: 'rgba(3,23,22,0.7)', border: `1px solid ${accent}`,
        }}
      >
        Reset View
      </button>

      {/* 빈 상태: 파일 미선택 */}
      {!hasFile && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
          <div style={{ fontFamily: 'Archivo', fontSize: 12, fontWeight: 600, color: '#9aa0a0', letterSpacing: '0.04em' }}>No audio file selected</div>
          <div style={{ fontFamily: 'Archivo', fontSize: 10, color: '#6b7472' }}>Load or select an audio file to analyze</div>
        </div>
      )}

      {/* 하단 조작 안내: 좌=좌클릭 드래그 회전, 우=우클릭 드래그 PAN */}
      {ready && (
        <>
          <div style={{ position: 'absolute', bottom: 6, left: 8, display: 'flex', alignItems: 'center', gap: 5, pointerEvents: 'none' }}>
            <MouseIcon side="left" accent={accent} body="rgba(230,240,235,0.6)" />
            <span style={{ fontFamily: 'Archivo', fontSize: 8.5, fontWeight: 600, letterSpacing: '0.04em', color: 'rgba(230,240,235,0.6)' }}>Drag · Rotate</span>
          </div>
          <div style={{ position: 'absolute', bottom: 6, right: 8, display: 'flex', alignItems: 'center', gap: 5, pointerEvents: 'none' }}>
            <span style={{ fontFamily: 'Archivo', fontSize: 8.5, fontWeight: 600, letterSpacing: '0.04em', color: 'rgba(230,240,235,0.6)' }}>Right-drag · Pan</span>
            <MouseIcon side="right" accent={accent} body="rgba(230,240,235,0.6)" />
          </div>
        </>
      )}

      {/* 분석 로딩 오버레이 */}
      {analyzing && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: 'rgba(3,23,22,0.55)', backdropFilter: 'blur(2px)', pointerEvents: 'none' }}>
          <div
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: `conic-gradient(from 0deg, ${accent}00 0deg, ${accent}00 90deg, ${accent} 270deg, ${pal.aBright ?? accent} 360deg)`,
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px))',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px))',
              animation: 'dkspin 0.85s linear infinite',
            }}
          />
          <div style={{ fontFamily: 'Archivo', fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: accent }}>ANALYZING…</div>
        </div>
      )}
    </div>
  );
}
