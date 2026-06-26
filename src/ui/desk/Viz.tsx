// FocusDAW Mastering Desk v0.1.1 (Phase 0 UI) - 상세 시트 col2 (시각화 패널) (원본 dc.html 이식)
import { useEffect, useRef, useState } from 'react';
import { css } from '../../desk/css';
import { useAppStore } from '../../store/appStore';
import { DeskIcon } from '../Icons';
import { Knob } from './Knob';
import type { DeskView } from '../../desk/compute';

function InputQueue({ view }: { view: DeskView }) {
  const pickFile = useAppStore((s) => s.pickFile);
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollState = () => {
    const el = ref.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    setCanScrollUp(el.scrollTop > 1);
    setCanScrollDown(maxScroll > 1 && el.scrollTop < maxScroll - 1);
  };

  useEffect(() => {
    updateScrollState();
    const el = ref.current;
    if (!el) return;

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateScrollState)
      : null;
    resizeObserver?.observe(el);
    return () => resizeObserver?.disconnect();
  }, [view.files.length]);

  const scrollQueue = (direction: 1 | -1) => {
    ref.current?.scrollBy({ top: direction * 72, behavior: 'smooth' });
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
        <span style={{ fontFamily: 'Archivo', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: '#8a8070' }}>BATCH QUEUE</span>
        <span style={{ fontFamily: 'Archivo', fontSize: 9.5, color: '#6f6657' }}>{view.batchCount} · {view.batchSize}</span>
      </div>
      <div style={{ position: 'relative' }}>
        {canScrollUp && (
          <button
            type="button"
            aria-label="Scroll queue up"
            onClick={() => scrollQueue(-1)}
            style={{ position: 'absolute', left: 0, right: 2, top: 0, zIndex: 2, height: 30, border: 0, padding: '2px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', cursor: 'pointer', background: `linear-gradient(0deg, rgba(0,0,0,0), ${view.pal.panel} 78%)` }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ animation: 'dkbob 1.2s ease-in-out infinite' }}>
              <path d="M7 14l5-5 5 5" fill="none" stroke={view.pal.aBright} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div ref={ref} onScroll={updateScrollState} style={{ maxHeight: 176, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 2 }}>
          {view.files.map((f) => (
            <div key={f.i} onClick={() => pickFile(f.i)} style={css(f.rowStyle)}>
              <span style={{ flex: 'none', color: f.iconColor }}><DeskIcon icon="note" size={12} /></span>
              <span style={{ flex: 1, fontFamily: 'Archivo', fontSize: 11, fontWeight: f.weight as any, color: f.nameColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
              <span style={{ fontFamily: 'Archivo', fontSize: 9, color: f.sizeColor, width: 48, textAlign: 'right' }}>{f.size}</span>
            </div>
          ))}
        </div>
        {canScrollDown && (
          <button
            type="button"
            aria-label="Scroll queue down"
            onClick={() => scrollQueue(1)}
            style={{ position: 'absolute', left: 0, right: 2, bottom: 0, zIndex: 2, height: 30, border: 0, padding: '0 0 2px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', cursor: 'pointer', background: `linear-gradient(180deg, rgba(0,0,0,0), ${view.pal.panel} 78%)` }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ animation: 'dkbob 1.2s ease-in-out infinite' }}>
              <path d="M7 10l5 5 5-5" fill="none" stroke={view.pal.aBright} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
}

function PreViz({ view }: { view: DeskView }) {
  const pal = view.pal;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: 'Archivo', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: '#8a8070' }}>SPECTRO · 3D</span>
        <span style={{ fontFamily: 'Archivo', fontSize: 9, color: '#8a8070' }}>time → · freq → · level ↑</span>
      </div>
      <svg width="338" height="150" viewBox="0 0 338 150" style={{ display: 'block' }}>
        <line x1="14" y1="128" x2="314" y2="128" stroke="rgba(255,240,210,0.1)" strokeWidth="1" />
        <line x1="14" y1="128" x2="38" y2="44" stroke="rgba(255,240,210,0.08)" strokeWidth="1" />
        <line x1="314" y1="128" x2="338" y2="44" stroke="rgba(255,240,210,0.08)" strokeWidth="1" />
        {view.waterfall.map((s: any, i: number) => (
          <g key={i}>
            <path d={s.area} fill={pal.panel} opacity="0.9" />
            <path d={s.area} fill={pal.aMain} opacity={s.fop} />
            <path d={s.line} fill="none" stroke={pal.aBright} strokeWidth="1.3" opacity={s.sop} />
          </g>
        ))}
        <text x="14" y="146" fontFamily="Archivo" fontSize="8" fill="#8a8070">20Hz</text>
        <text x="300" y="146" fontFamily="Archivo" fontSize="8" fill="#8a8070">20k</text>
      </svg>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        {[{ t: 'FFT', rows: view.fftInfo }, { t: 'NOISE', rows: view.noiseInfo }].map((p) => (
          <div key={p.t} style={{ flex: 1, background: pal.panelDark, borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontFamily: 'Archivo', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: pal.aBright, marginBottom: 6 }}>{p.t}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 8px' }}>
              {p.rows.map((r: any, i: number) => (
                <span key={i} style={{ display: 'contents' }}>
                  <span style={{ fontFamily: 'Archivo', fontSize: 9, color: '#8a8070' }}>{r.k}</span>
                  <span style={{ fontFamily: 'Archivo', fontSize: 9, fontWeight: 600, color: pal.nInk, textAlign: 'right' }}>{r.v}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SpectralViz({ view }: { view: DeskView }) {
  const pal = view.pal;
  const setEqNode = useAppStore((s) => s.setEqNode);
  const svgRef = useRef<SVGSVGElement>(null);

  const startDrag = (dot: any) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const apply = (cx: number, cy: number) => {
      const rect = svg.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
      const y = ((cy - rect.top) / rect.height) * 150;
      let f = 20 * Math.pow(dot.nyq / 20, x);
      f = Math.max(dot.fmin, Math.min(dot.fmax, f));
      if (dot.fstep) f = Math.round(f / dot.fstep) * dot.fstep;
      let g = (82 - y) / 2.6;
      g = Math.max(-12, Math.min(12, Math.round(g * 10) / 10));
      setEqNode(dot.band, Number(f.toFixed(0)), g);
    };
    apply(e.clientX, e.clientY);
    const mv = (ev: PointerEvent) => apply(ev.clientX, ev.clientY);
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: 'Archivo', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: view.presetColor }}>{view.presetNameUpper}</span>
        <span style={{ fontFamily: 'Archivo', fontSize: 9, color: '#6f6657' }}>20Hz — 20kHz</span>
      </div>
      <svg ref={svgRef} width="338" height="150" viewBox="0 0 338 150" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="dk-eq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={view.eqStopA} />
            <stop offset="1" stopColor={view.eqStopB} />
          </linearGradient>
        </defs>
        <line x1="0" y1="82" x2="338" y2="82" stroke="rgba(255,240,210,0.12)" strokeDasharray="3 4" />
        <line x1="0" y1="56" x2="338" y2="56" stroke="rgba(255,240,210,0.05)" /><line x1="0" y1="108" x2="338" y2="108" stroke="rgba(255,240,210,0.05)" />
        <g stroke="rgba(255,240,210,0.05)"><line x1="84" y1="10" x2="84" y2="142" /><line x1="169" y1="10" x2="169" y2="142" /><line x1="253" y1="10" x2="253" y2="142" /></g>
        <path d={view.eqArea} fill="url(#dk-eq)" />
        <path d={view.eqLine} fill="none" stroke={pal.aBright} strokeWidth="2.2" strokeLinejoin="round" />
        {view.eqDots.map((d: any) => (
          <g key={d.band} onPointerDown={startDrag(d)} data-knob-key={d.qk} data-knob-min={d.qmin} data-knob-max={d.qmax} data-knob-step={d.qstep} style={{ cursor: 'grab', touchAction: 'none' }}>
            <circle cx={d.cx} cy={d.cy} r="14" fill="transparent" />
            <circle cx={d.cx} cy={d.cy} r={d.r} fill={pal.panel} stroke={d.fill} strokeWidth={d.sw} />
            <text x={d.cx} y={d.cy} fontFamily="Archivo" fontSize="7" fontWeight="700" fill={d.numColor} textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: 'none' }}>{d.num}</text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Archivo', fontSize: 8.5, color: pal.nInk2, padding: '0 2px' }}>
        {view.eqAxis.map((t: any, i: number) => <span key={i}>{t.label}</span>)}
      </div>
    </>
  );
}

function DynamicsViz({ view }: { view: DeskView }) {
  return (
    <div style={{ height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', borderRadius: 12, padding: '13px 14px 15px', ...css(view.insetBg) }}>
      <span style={{ fontFamily: 'Archivo', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: '#8a8070' }}>MULTIBAND · GAIN REDUCTION</span>
      <div style={{ flex: 1, display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'center', marginTop: 10 }}>
        {view.dynBars.map((b: any, i: number) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
            <div style={{ position: 'relative', width: 42, height: 84, background: 'rgba(0,0,0,0.3)', borderRadius: 7, overflow: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5)' }}>
              <div style={{ width: '100%', height: b.fill, background: `linear-gradient(180deg,${b.color},rgba(0,0,0,0))` }} />
            </div>
            <span style={{ fontFamily: 'Archivo', fontSize: 12, fontWeight: 700, color: b.color }}>{b.val}</span>
            <span style={{ fontFamily: 'Archivo', fontSize: 9, letterSpacing: '0.06em', color: '#8a8070' }}>{b.label}</span>
            {b.knob?.knob && <Knob vm={b.knob.knob} size={44} sw={3.8} trackSw={3.8} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function StereoViz({ view }: { view: DeskView }) {
  const pal = view.pal;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: 'Archivo', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: '#8a8070' }}>STEREO FIELD · SPACE</span>
        <span style={{ fontFamily: 'Archivo', fontSize: 12, fontWeight: 700, color: pal.aBright }}>{view.stereoW}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="100%" height="100%" viewBox="0 0 338 150" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
          <line x1="169" y1="8" x2="169" y2="142" stroke="rgba(255,240,210,0.12)" strokeDasharray="3 4" />
          <line x1="24" y1="75" x2="314" y2="75" stroke="rgba(255,240,210,0.08)" />
          {view.stDelay.map((d: any, i: number) => (
            <g key={'d' + i}>
              <ellipse cx={d.cxL} cy="75" rx={view.stereoRx} ry="44" fill="none" stroke={pal.aBright} strokeWidth="1.1" opacity={d.op} />
              <ellipse cx={d.cxR} cy="75" rx={view.stereoRx} ry="44" fill="none" stroke={pal.aBright} strokeWidth="1.1" opacity={d.op} />
            </g>
          ))}
          {view.stReverb.map((r: any, i: number) => (
            <ellipse key={'r' + i} cx="169" cy="75" rx={r.rx} ry={r.ry} fill="none" stroke={pal.aMain} strokeWidth="1.4" opacity={r.op} />
          ))}
          <ellipse cx="169" cy="75" rx={view.stereoRx} ry="44" fill={view.ellipseFill} stroke={pal.aBright} strokeWidth="1.8" />
          {view.stMonoOn && <ellipse cx="169" cy="75" rx={view.stMonoRx} ry="30" fill={pal.aMain} opacity="0.32" stroke={pal.aBright} strokeWidth="1" strokeDasharray="2 2" />}
          {view.stCompatOn && (
            <g>
              <line x1="169" y1="29" x2="169" y2="121" stroke={view.foldColor} strokeWidth="2.4" opacity="0.9" />
              <circle cx="169" cy="29" r="2.4" fill={view.foldColor} /><circle cx="169" cy="121" r="2.4" fill={view.foldColor} />
              <text x="175" y="34" fontFamily="Archivo" fontSize="8" fill={view.foldColor}>mono fold</text>
            </g>
          )}
          <text x="28" y="79" fontFamily="Archivo" fontSize="11" fill="#8a8070">L</text>
          <text x="300" y="79" fontFamily="Archivo" fontSize="11" fill="#8a8070">R</text>
          <circle cx="169" cy="75" r="3" fill={pal.aBright} />
        </svg>
      </div>
      <div style={{ background: 'rgba(0,0,0,0.18)', borderRadius: 7, padding: '7px 10px', marginTop: 8, opacity: view.compatDim }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: 'Archivo', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#8a8070' }}>MONO COMPAT · CORRELATION</span>
          <span style={{ fontFamily: 'Archivo', fontSize: 9, color: '#8a8070' }}>fold loss <span style={{ fontWeight: 700, color: view.stCompatColor }}>{view.stLossLabel}</span></span>
        </div>
        <div style={{ position: 'relative', height: 7, background: 'rgba(0,0,0,0.35)', borderRadius: 4 }}>
          <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: 'rgba(255,240,210,0.25)' }} />
          <div style={{ position: 'absolute', top: '50%', left: view.stCorrX, width: 9, height: 9, borderRadius: '50%', background: view.stCompatColor, transform: 'translate(-50%,-50%)', boxShadow: `0 0 7px ${view.stCompatColor}` }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: 'Archivo', fontSize: 8, color: '#6f6657' }}>-1 · out of phase</span>
          <span style={{ fontFamily: 'Archivo', fontSize: 9, fontWeight: 700, color: view.stCompatColor }}>{view.stCompatStatus} · {view.stCorrLabel}</span>
          <span style={{ fontFamily: 'Archivo', fontSize: 8, color: '#6f6657' }}>mono +1</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, background: 'rgba(0,0,0,0.18)', borderRadius: 7, padding: '7px 9px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: '50%', border: `1.4px solid ${pal.aMain}`, boxSizing: 'border-box', flex: 'none' }} /><span style={{ fontFamily: 'Archivo', fontSize: 9, color: '#8a8070' }}>Reverb</span></div>
          <span style={{ fontFamily: 'Archivo', fontSize: 12, fontWeight: 700, color: pal.aBright }}>{view.stReverbLabel}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, background: 'rgba(0,0,0,0.18)', borderRadius: 7, padding: '7px 9px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 11, height: 7, borderRadius: '50%', border: `1.1px solid ${pal.aBright}`, boxSizing: 'border-box', opacity: 0.6, flex: 'none' }} /><span style={{ fontFamily: 'Archivo', fontSize: 9, color: '#8a8070' }}>Delay</span></div>
          <span style={{ fontFamily: 'Archivo', fontSize: 12, fontWeight: 700, color: pal.aBright }}>{view.stDelayLabel}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, background: 'rgba(0,0,0,0.18)', borderRadius: 7, padding: '7px 9px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: pal.aMain, opacity: 0.5, flex: 'none' }} /><span style={{ fontFamily: 'Archivo', fontSize: 9, color: '#8a8070' }}>Bass Mono</span></div>
          <span style={{ fontFamily: 'Archivo', fontSize: 12, fontWeight: 700, color: view.bassLegendColor }}>{view.stMonoVal}</span>
        </div>
      </div>
    </div>
  );
}

function LoudnessViz({ view }: { view: DeskView }) {
  const pal = view.pal;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Archivo', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: '#8a8070' }}>INTEGRATED LOUDNESS</span>
        <span style={{ fontFamily: 'Archivo', fontSize: 12, fontWeight: 700, color: pal.aBright }}>{view.loudTargetLabel}</span>
      </div>
      <div style={{ marginTop: 10, position: 'relative', height: 16, background: pal.panelDark, borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: view.loudGrad }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: view.loudFill, right: 0, background: 'rgba(6,4,2,0.9)' }} />
        <div style={{ position: 'absolute', top: -4, bottom: -4, left: view.loudTargetX, width: 2, background: '#f3ecdd', boxShadow: '0 0 6px rgba(243,236,221,0.7)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Archivo', fontSize: 8.5, color: pal.nInk2, marginTop: 5 }}>
        <span>-30</span><span>-23</span><span>-14</span><span>-9</span><span>0</span>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <div style={{ flex: 1, background: pal.panelDark, borderRadius: 8, padding: '7px 11px', opacity: view.tpDim }}>
          <div style={{ fontFamily: 'Archivo', fontSize: 9, color: '#8a8070', letterSpacing: '0.04em' }}>TRUE PEAK</div>
          <div style={{ fontFamily: 'Archivo', fontSize: 16, fontWeight: 700, color: pal.nInk, marginTop: 3 }}>{view.loudCeiling}</div>
        </div>
        <div style={{ flex: 1, background: pal.panelDark, borderRadius: 8, padding: '7px 11px' }}>
          <div style={{ fontFamily: 'Archivo', fontSize: 9, color: '#8a8070', letterSpacing: '0.04em' }}>LIMITER</div>
          <div style={{ fontFamily: 'Archivo', fontSize: 16, fontWeight: 700, color: pal.nInk, marginTop: 3 }}>{view.loudMode}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <div style={{ flex: 'none', width: 138, background: pal.panelDark, borderRadius: 8, padding: '7px 9px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}><span style={{ fontFamily: 'Archivo', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: '#8a8070' }}>SATURATION</span><span style={{ fontFamily: 'Archivo', fontSize: 11, fontWeight: 700, color: view.satWarnColor }}>{view.satLabel}</span></div>
          <svg width="100%" height="56" viewBox="0 0 160 92" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
            <line x1="80" y1="8" x2="80" y2="84" stroke="rgba(255,240,210,0.1)" />
            <line x1="6" y1="46" x2="154" y2="46" stroke="rgba(255,240,210,0.1)" />
            <path d={view.satLine} stroke="rgba(255,240,210,0.18)" strokeWidth="1" strokeDasharray="3 3" />
            <path d={view.satPath} fill="none" stroke={view.satWarnColor} strokeWidth="2" />
          </svg>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,240,210,0.08)' }}><span style={{ fontFamily: 'Archivo', fontSize: 8.5, color: '#8a8070' }}>THD <span style={{ fontWeight: 700, color: view.satWarnColor }}>{view.satThd}</span></span><span style={{ fontFamily: 'Archivo', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.04em', color: view.satWarnColor }}>{view.satThdStatus}</span></div>
        </div>
        <div style={{ flex: 1, background: pal.panelDark, borderRadius: 8, padding: '8px 11px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: 'Archivo', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: '#8a8070', marginBottom: 6 }}>ADDED HARMONICS</span>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, minHeight: 46 }}>
            {view.satHarm.map((h: any, i: number) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{ width: '100%', borderRadius: '2px 2px 0 0', height: h.h, background: view.satWarnColor }} />
                <span style={{ fontFamily: 'Archivo', fontSize: 8, color: '#8a8070', marginTop: 3 }}>{h.label}</span>
              </div>
            ))}
          </div>
          <span style={{ fontFamily: 'Archivo', fontSize: 8, color: '#8a8070', marginTop: 4 }}>even = warmth · odd = edge</span>
        </div>
      </div>
    </>
  );
}

function ExportViz({ view }: { view: DeskView }) {
  const pal = view.pal;
  return (
    <>
      <span style={{ fontFamily: 'Archivo', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: '#8a8070' }}>ALBUM ARTWORK</span>
      <div style={{ display: 'flex', gap: 13, marginTop: 12 }}>
        <div style={{ width: 98, height: 98, flex: 'none', borderRadius: 9, border: '1.5px dashed rgba(255,240,210,0.22)', background: pal.panelDark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#8a8070' }}>
          <DeskIcon icon="note" size={24} />
          <span style={{ fontFamily: 'Archivo', fontSize: 8.5, letterSpacing: '0.04em' }}>Drop art</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 9 }}>
          <div style={{ background: pal.panelDark, borderRadius: 8, padding: '9px 11px' }}><div style={{ fontFamily: 'Archivo', fontSize: 9, color: '#8a8070', letterSpacing: '0.04em' }}>OUTPUT FORMAT</div><div style={{ fontFamily: 'Archivo', fontSize: 14, fontWeight: 700, color: pal.nInk, marginTop: 2 }}>{view.exportFormat}</div></div>
          <div style={{ background: pal.panelDark, borderRadius: 8, padding: '9px 11px' }}><div style={{ fontFamily: 'Archivo', fontSize: 9, color: '#8a8070', letterSpacing: '0.04em' }}>DESTINATION</div><div style={{ fontFamily: 'Archivo', fontSize: 11, color: pal.nInk2, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>~/Masters/{view.exportAlbum}</div></div>
        </div>
      </div>
    </>
  );
}

export function Viz({ view }: { view: DeskView }) {
  return (
    <div style={{ width: 368, flex: 'none', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontFamily: 'Archivo', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: '#a99f8a', marginBottom: 11 }}>{view.vizTitle}</div>
      <div style={{ flex: 1, borderRadius: 11, padding: view.vizPad, position: 'relative', overflow: 'hidden', background: view.vizBg, boxShadow: view.vizShadow }}>
        {view.isInput && <InputQueue view={view} />}
        {view.isPre && <PreViz view={view} />}
        {view.isSpectral && <SpectralViz view={view} />}
        {view.isDynamics && <DynamicsViz view={view} />}
        {view.isStereo && <StereoViz view={view} />}
        {view.isLoudness && <LoudnessViz view={view} />}
        {view.isExport && <ExportViz view={view} />}
      </div>
    </div>
  );
}
