// FocusDAW Mastering Desk v0.1.1 (Phase 0 UI) - 푸터 (원본 dc.html 이식)
import type { DeskView } from '../../desk/compute';

export function Footer({ view }: { view: DeskView }) {
  return (
    <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 15px', background: '#13171c', borderTop: '1px solid #0a0d10' }}>
      <span style={{ fontFamily: 'Archivo', fontSize: 10, color: '#5e6b73' }}>Signal flows left → right · {view.activeCount}/7 stages engaged</span>
      <span style={{ fontFamily: 'Archivo', fontSize: 10, color: '#5e6b73' }}>{view.batchCount} files queued · {view.batchSize}</span>
    </div>
  );
}
