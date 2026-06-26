// FocusDAW Mastering Desk v0.1.1 (Phase 0 UI) - 데스크(시그널 패스) 7모듈 (원본 dc.html 이식)
import deskUrl from '../../../assets/desk.png';
import { css } from '../../desk/css';
import { useAppStore } from '../../store/appStore';
import { DeskIcon } from '../Icons';
import type { DeskView } from '../../desk/compute';

export function Desk({ view }: { view: DeskView }) {
  const setOpen = useAppStore((s) => s.setOpen);
  const toggleEnabled = useAppStore((s) => s.toggleEnabled);

  return (
    <div style={{ position: 'relative', height: 214, background: view.deskBg, overflow: 'hidden' }}>
      <img src={deskUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4, mixBlendMode: 'luminosity', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg,rgba(0,0,0,0) 42%,${view.pal.deskB} 100%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5, background: 'repeating-linear-gradient(91deg,transparent 0 96px,rgba(255,240,210,0.018) 96px 97px)' }} />

      <svg width="1208" height="214" viewBox="0 0 1208 214" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, display: 'block' }}>
        <defs>
          <linearGradient id="dk-rib" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={view.pal.aMain} />
            <stop offset="0.5" stopColor={view.pal.aBright} />
            <stop offset="1" stopColor={view.pal.aMain} />
          </linearGradient>
        </defs>
        <path d={view.ribbon} fill="none" stroke={view.pal.aMain} strokeWidth="11" strokeLinecap="round" opacity="0.16" />
        <path d={view.ribbon} fill="none" stroke="url(#dk-rib)" strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
        <path className="dk-flow" d={view.ribbon} fill="none" stroke={view.pal.aGlow} strokeWidth="2.4" strokeLinecap="round" opacity="0.95" />
      </svg>

      <div style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontFamily: 'Archivo', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#6f7d86', writingMode: 'vertical-rl', textOrientation: 'mixed' }}>SOURCE</div>
      <div style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', fontFamily: 'Archivo', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: view.accent, writingMode: 'vertical-rl', textOrientation: 'mixed' }}>MASTER</div>

      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '0 34px' }}>
        {view.modules.map((m) => (
          <div key={m.id} style={css(m.colStyle)}>
            <button onClick={(e) => { e.stopPropagation(); toggleEnabled(m.id); }} style={css(m.bypBtnStyle)}>{m.bypLabel}</button>
            <div className="dk-card" onClick={() => setOpen(m.i)} style={css(m.cardStyle)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                <div style={css(m.iconStyle)}><DeskIcon icon={m.icon} size={13} /></div>
              </div>
              <div style={css(m.numStyle)}>{m.roman}</div>
              <div style={{ textAlign: 'center', fontFamily: 'Archivo', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: m.nameColor }}>{m.short}</div>
              <div style={{ fontFamily: 'Archivo', fontSize: 8, letterSpacing: '0.02em', textAlign: 'center', color: m.statColor, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.stat}</div>
              <div style={css(m.tapStyle)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
