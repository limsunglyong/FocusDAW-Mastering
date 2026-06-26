// FocusDAW Mastering Desk v0.1.1 (Phase 0 UI) - 트랜스포트/배치 바 (원본 dc.html 이식)
import { useAppStore } from '../../store/appStore';
import type { DeskView } from '../../desk/compute';

export function TransportBar({ view }: { view: DeskView }) {
  const prevFile = useAppStore((s) => s.prevFile);
  const nextFile = useAppStore((s) => s.nextFile);

  // v0.1.4: 3칸 그리드(1fr·auto·1fr)로 가운데 Preview 를 중앙 고정 — 좌측 파일명 길이와 무관.
  return (
    <div style={{ height: 40, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 13, padding: '0 15px', background: '#13171c', borderBottom: '1px solid #0a0d10' }}>
      {/* 좌: 트랜스포트 + 선택 파일 정보 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 5, flex: 'none' }}>
          <div onClick={prevFile} style={{ width: 26, height: 24, borderRadius: 6, display: 'grid', placeItems: 'center', background: '#222830', border: '1px solid #303841', cursor: 'pointer', color: '#9aa7af', fontSize: 10 }}>◀</div>
          <div style={{ width: 26, height: 24, borderRadius: 6, display: 'grid', placeItems: 'center', background: view.accent, cursor: 'pointer' }}>
            <div style={{ width: 0, height: 0, borderLeft: `7px solid ${view.pal.aInk}`, borderTop: '4.5px solid transparent', borderBottom: '4.5px solid transparent' }} />
          </div>
          <div onClick={nextFile} style={{ width: 26, height: 24, borderRadius: 6, display: 'grid', placeItems: 'center', background: '#222830', border: '1px solid #303841', cursor: 'pointer', color: '#9aa7af', fontSize: 10 }}>▶</div>
        </div>
        <span style={{ fontSize: 12, color: '#e3dccc', fontWeight: 500, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{view.curFileName}</span>
        <span style={{ fontFamily: 'Archivo', fontSize: 10.5, color: '#6f7d86', flex: 'none', whiteSpace: 'nowrap' }}>{view.curFileIdx} / {view.batchCount} · {view.sel.dur} · {view.sel.size}</span>
      </div>

      {/* 중앙: Preview (고정) */}
      <button style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'Archivo', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', color: view.accent, background: 'rgba(255,255,255,0.04)', border: `1px solid ${view.pal.aMain}`, borderRadius: 6, padding: '6px 16px', cursor: 'pointer', justifySelf: 'center' }}>
        <span style={{ width: 0, height: 0, borderLeft: `8px solid ${view.accent}`, borderTop: '5px solid transparent', borderBottom: '5px solid transparent' }} />
        Preview
      </button>

      {/* 우: 라우드니스 + Render */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, justifyContent: 'flex-end', minWidth: 0 }}>
        <span style={{ fontFamily: 'Archivo', fontSize: 11, color: '#6f7d86', whiteSpace: 'nowrap' }}>Integrated <span style={{ color: view.accent, fontWeight: 600 }}>{view.lufsVal} LUFS</span></span>
        <span style={{ fontFamily: 'Archivo', fontSize: 11, color: '#6f7d86', whiteSpace: 'nowrap' }}>Peak <span style={{ color: '#e3dccc', fontWeight: 600 }}>{view.tpVal} dBTP</span></span>
        <button style={{ fontFamily: 'Archivo', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', color: view.pal.aInk, background: view.accent, border: 'none', borderRadius: 6, padding: '7px 15px', cursor: 'pointer', flex: 'none' }}>Render Batch</button>
      </div>
    </div>
  );
}
