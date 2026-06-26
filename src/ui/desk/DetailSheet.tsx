// FocusDAW Mastering Desk v0.1.1 (Phase 0 UI) - 상세 시트 (3컬럼: 로마자 플레이트 · 시각화 · 파라미터) (원본 이식)
import { css } from '../../desk/css';
import { useAppStore } from '../../store/appStore';
import { DeskIcon } from '../Icons';
import { Viz } from './Viz';
import { Controls } from './Controls';
import type { DeskView } from '../../desk/compute';

export function DetailSheet({ view }: { view: DeskView }) {
  const toggleEnabled = useAppStore((s) => s.toggleEnabled);
  const a = view.active;
  const pal = view.pal;

  return (
    <div style={{ position: 'relative', background: pal.frame }}>
      <div style={{ position: 'absolute', top: 6, left: view.notchLeft, width: 16, height: 16, background: pal.notch, transform: 'translateX(-50%) rotate(45deg)', borderRadius: 3 }} />
      <div style={{ margin: 14, borderRadius: 12, boxShadow: '0 10px 30px -12px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.6)', padding: '18px 20px', height: 308, boxSizing: 'border-box', display: 'flex', gap: 20, background: view.paperBg }}>

        {/* col 1: roman plate */}
        <div style={{ width: 168, flex: 'none', borderRight: '1px solid rgba(58,52,43,0.14)', paddingRight: 20, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, flex: 'none', display: 'grid', placeItems: 'center', color: '#f3ecdd', background: pal.aMain, boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
              <DeskIcon icon={a.icon} size={22} />
            </div>
            <div style={{ fontFamily: 'Spectral, serif', fontSize: 46, fontWeight: 600, color: pal.aMain, lineHeight: 0.85 }}>{a.roman}</div>
          </div>
          <div style={{ fontFamily: 'Spectral, serif', fontSize: 21, fontWeight: 600, color: pal.pInk, marginTop: 11, lineHeight: 1.05 }}>{a.name}</div>
          <div style={{ fontFamily: 'Archivo', fontSize: 11, color: pal.pInk2, marginTop: 7, lineHeight: 1.45 }}>{a.desc}</div>
          <div style={{ flex: 1 }} />
          {!a.bypassHidden && (
            <div onClick={() => toggleEnabled(a.id)} style={css(a.bypassStyle)}>{a.bypassLabel}</div>
          )}
        </div>

        {/* col 2: visualization */}
        <Viz view={view} />

        {/* col 3: controls */}
        <Controls view={view} />
      </div>
    </div>
  );
}
