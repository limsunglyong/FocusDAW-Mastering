// FocusDAW Mastering Desk v0.1.1 (Phase 0 UI) - 트랜스포트/배치 바 (원본 dc.html 이식)
import { useAppStore } from '../../store/appStore';
import type { DeskView } from '../../desk/compute';

export function TransportBar({ view }: { view: DeskView }) {
  const prevFile = useAppStore((s) => s.prevFile);
  const nextFile = useAppStore((s) => s.nextFile);

  return (
    <div style={{ height: 40, display: 'flex', alignItems: 'center', gap: 13, padding: '0 15px', background: '#13171c', borderBottom: '1px solid #0a0d10' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        <div onClick={prevFile} style={{ width: 26, height: 24, borderRadius: 6, display: 'grid', placeItems: 'center', background: '#222830', border: '1px solid #303841', cursor: 'pointer', color: '#9aa7af', fontSize: 10 }}>◀</div>
        <div style={{ width: 26, height: 24, borderRadius: 6, display: 'grid', placeItems: 'center', background: view.accent, cursor: 'pointer' }}>
          <div style={{ width: 0, height: 0, borderLeft: `7px solid ${view.pal.aInk}`, borderTop: '4.5px solid transparent', borderBottom: '4.5px solid transparent' }} />
        </div>
        <div onClick={nextFile} style={{ width: 26, height: 24, borderRadius: 6, display: 'grid', placeItems: 'center', background: '#222830', border: '1px solid #303841', cursor: 'pointer', color: '#9aa7af', fontSize: 10 }}>▶</div>
      </div>
      <span style={{ fontSize: 12, color: '#e3dccc', fontWeight: 500 }}>{view.curFileName}</span>
      <span style={{ fontFamily: 'Archivo', fontSize: 10.5, color: '#6f7d86' }}>{view.curFileIdx} / {view.batchCount} · {view.batchSize}</span>

      <div style={{ flex: 1 }} />
      <button style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'Archivo', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', color: view.accent, background: 'rgba(255,255,255,0.04)', border: `1px solid ${view.pal.aMain}`, borderRadius: 6, padding: '6px 16px', cursor: 'pointer' }}>
        <span style={{ width: 0, height: 0, borderLeft: `8px solid ${view.accent}`, borderTop: '5px solid transparent', borderBottom: '5px solid transparent' }} />
        Preview
      </button>
      <div style={{ flex: 1 }} />

      <span style={{ fontFamily: 'Archivo', fontSize: 11, color: '#6f7d86' }}>Integrated <span style={{ color: view.accent, fontWeight: 600 }}>{view.lufsVal} LUFS</span></span>
      <span style={{ fontFamily: 'Archivo', fontSize: 11, color: '#6f7d86' }}>Peak <span style={{ color: '#e3dccc', fontWeight: 600 }}>{view.tpVal} dBTP</span></span>
      <button style={{ fontFamily: 'Archivo', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', color: view.pal.aInk, background: view.accent, border: 'none', borderRadius: 6, padding: '7px 15px', cursor: 'pointer' }}>Render Batch</button>
    </div>
  );
}
