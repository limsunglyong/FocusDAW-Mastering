// FocusDAW Mastering Desk v0.1.1 (Phase 0 UI) - 상세 시트 col2 (시각화 패널) (원본 dc.html 이식)
import { useEffect, useRef, useState } from 'react';
import { css } from '../../desk/css';
import { useAppStore } from '../../store/appStore';
import { openAudioFilePicker } from '../../audio/filePicker';
import { DeskIcon } from '../Icons';
import { Knob } from './Knob';
import { Spectrogram3D } from './Spectrogram3D';
import { previewEngine } from '../../audio/previewEngine';
import { correlationStatus, correlationColor } from '../../audio/stereo';
import type { DeskView } from '../../desk/compute';

function InputQueue({ view }: { view: DeskView }) {
  const pickFile = useAppStore((s) => s.pickFile);
  const removeFile = useAppStore((s) => s.removeFile);
  const clearFiles = useAppStore((s) => s.clearFiles);
  const loadFiles = useAppStore((s) => s.loadFiles);
  const importing = useAppStore((s) => s.importing);
  const importError = useAppStore((s) => s.importError);
  const source = useAppStore((s) => s.vals['input.source']);
  const scope = useAppStore((s) => s.vals['input.scope']);
  // v0.2.9: 백그라운드 디코딩/LUFS 측정이 진행 중이면 [Decoding...] 표시
  const decoding = useAppStore((s) => s.files.some((f) => f.lufsState !== 'done'));
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleImport = async () => {
    const picked = await openAudioFilePicker({ directory: source === 'Folder', recursive: scope === 'Sub Folder' });
    if (picked.length) await loadFiles(picked);
  };

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9, flex: 'none' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontFamily: 'Archivo', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: '#8a8070' }}>BATCH QUEUE</span>
          {decoding && (
            <span style={{ fontFamily: 'Archivo', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: view.accent, animation: 'dkdecoding 1.3s ease-in-out infinite' }}>[Decoding…]</span>
          )}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontFamily: 'Archivo', fontSize: 9.5, color: '#6f6657' }}>{view.batchCount} · {view.batchSize}</span>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            style={{ fontFamily: 'Archivo', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', color: view.pal.aInk, background: view.accent, border: 'none', borderRadius: 6, padding: '4px 10px', cursor: importing ? 'wait' : 'pointer', opacity: importing ? 0.6 : 1 }}
          >
            {importing ? 'Loading…' : (source === 'Folder' ? '+ Folder' : '+ Import')}
          </button>
          {view.batchCount > 0 && (
            <button
              type="button"
              aria-label="Clear queue"
              title="Clear queue"
              onClick={() => setConfirmClear(true)}
              disabled={importing}
              style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', fontSize: 13, lineHeight: 1, color: '#9aa7af', background: view.pal.panelDark, border: '1px solid rgba(127,127,127,0.22)', borderRadius: 6, cursor: importing ? 'not-allowed' : 'pointer' }}
            >×</button>
          )}
        </div>
      </div>

      {confirmClear && (
        <div
          onClick={() => setConfirmClear(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,11,14,0.7)', backdropFilter: 'blur(2px)' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ minWidth: 280, padding: '22px 26px', borderRadius: 14, background: 'rgba(20,26,31,0.97)', boxShadow: `0 18px 50px -12px rgba(0,0,0,0.8),0 0 26px ${view.pal.glow}` }}>
            <div style={{ fontFamily: 'Spectral, serif', fontSize: 17, fontWeight: 600, color: '#efe7d6' }}>Clear queue?</div>
            <div style={{ fontFamily: 'Archivo', fontSize: 12, color: '#9aa7af', marginTop: 7, lineHeight: 1.5 }}>This removes all {view.batchCount} file{view.batchCount > 1 ? 's' : ''} from the queue. This action cannot be undone.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 18 }}>
              <button type="button" onClick={() => setConfirmClear(false)} style={{ fontFamily: 'Archivo', fontSize: 11, fontWeight: 600, color: '#cdd8de', background: 'rgba(255,255,255,0.06)', border: '1px solid #323b44', borderRadius: 7, padding: '7px 16px', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={() => { clearFiles(); setConfirmClear(false); }} style={{ fontFamily: 'Archivo', fontSize: 11, fontWeight: 700, color: '#fff', background: '#e0344b', border: 'none', borderRadius: 7, padding: '7px 16px', cursor: 'pointer' }}>Clear all</button>
            </div>
          </div>
        </div>
      )}
      {view.batchCount === 0 ? (
        <button
          type="button"
          onClick={handleImport}
          disabled={importing}
          style={{ width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 9, border: `1.5px dashed ${view.pal.aMain}`, background: view.pal.panelDark, color: '#8a8070', cursor: importing ? 'wait' : 'pointer' }}
        >
          <DeskIcon icon="note" size={26} />
          <span style={{ fontFamily: 'Archivo', fontSize: 11.5, fontWeight: 600, color: view.pal.nInk }}>{importing ? 'Decoding…' : 'Drop audio here or click to import'}</span>
          <span style={{ fontFamily: 'Archivo', fontSize: 9, color: '#6f6657' }}>WAV · MP3 · FLAC · OGG · M4A · AIFF</span>
        </button>
      ) : (
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
        <div ref={ref} onScroll={updateScrollState} style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 2 }}>
          {view.files.map((f) => (
            <div key={f.id} onClick={() => pickFile(f.i)} style={css(f.rowStyle)}>
              <span style={{ flex: 'none', color: f.iconColor }}><DeskIcon icon="note" size={12} /></span>
              <span style={{ flex: 1, minWidth: 0, fontFamily: 'Archivo', fontSize: 11, fontWeight: f.weight as any, color: f.nameColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
              <span style={{ fontFamily: 'Archivo', fontSize: 9, color: f.sizeColor, width: 48, textAlign: 'right' }}>{f.size}</span>
              <span
                role="button"
                aria-label={`Remove ${f.name}`}
                onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                style={{ flex: 'none', width: 16, height: 16, display: 'grid', placeItems: 'center', borderRadius: 4, fontSize: 12, lineHeight: 1, color: f.on ? view.pal.aInk : '#8a8070', cursor: 'pointer' }}
              >×</span>
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
      )}
      {importError && (
        <div style={{ marginTop: 8, flex: 'none', fontFamily: 'Archivo', fontSize: 9.5, color: '#e6502e', whiteSpace: 'pre-wrap', maxHeight: 40, overflow: 'hidden' }}>{importError}</div>
      )}
    </div>
  );
}

function PreViz({ view }: { view: DeskView }) {
  const pal = view.pal;
  // v0.2.26: Pre 뷰가 보이거나 선택 파일이 바뀌면 STFT 분석을 보장(HMR/타이밍 누락 대비).
  const curFile = useAppStore((s) => s.curFile);
  const fileCount = useAppStore((s) => s.files.length);
  const files = useAppStore((s) => s.files);
  const preAnalysis = useAppStore((s) => s.preAnalysis);
  const denoiseOn = useAppStore((s) => !!s.vals['pre.denoise']);
  const denoiseAmt = useAppStore((s) => Number(s.vals['pre.denoiseAmt']) || 0);
  useEffect(() => {
    void useAppStore.getState().analyzePreSelected();
  }, [curFile, fileCount]);

  const sel = files[curFile];
  const ready = !!preAnalysis && preAnalysis.fileId === sel?.id;
  const meta = sel?.meta;
  const lufs = meta && Number.isFinite(meta.integratedLufs) ? meta.integratedLufs.toFixed(1) + ' LUFS' : '—';
  const peak = meta && Number.isFinite(meta.peakDb) ? meta.peakDb.toFixed(1) + ' dBFS' : '—';
  const floor = ready && Number.isFinite(preAnalysis!.floorDb) ? Math.round(preAnalysis!.floorDb) + ' dBFS' : '—';
  const snr = ready && Number.isFinite(preAnalysis!.snrDb) ? Math.round(preAnalysis!.snrDb) + ' dB' : '—';

  // 통합 정보창(FFT Size/Window 등 FFT 파라미터 제거, 노이즈/라우드니스만)
  const info: { k: string; v: string }[] = [
    { k: 'Integrated LUFS', v: lufs },
    { k: 'Peak', v: peak },
    { k: 'Noise Floor', v: floor },
    { k: 'SNR', v: snr },
    { k: 'Reduction', v: denoiseOn ? Math.round(denoiseAmt) + '%' : 'off' },
  ];

  return (
    <>
      <Spectrogram3D view={view} />
      <div style={{ marginTop: 8, background: pal.panelDark, borderRadius: 8, padding: '6px 12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', gap: '1px 12px', lineHeight: 1.1 }}>
          {info.map((r, i) => (
            <span key={i} style={{ display: 'contents' }}>
              <span style={{ fontFamily: 'Archivo', fontSize: 9, color: '#8a8070', whiteSpace: 'nowrap' }}>{r.k}</span>
              <span style={{ fontFamily: 'Archivo', fontSize: 9, fontWeight: 600, color: pal.nInk, textAlign: 'right' }}>{r.v}</span>
            </span>
          ))}
        </div>
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
        <span
          style={{
            fontFamily: 'Archivo',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: view.isEqEdited ? view.pal.aBright : view.presetColor,
            animation: view.isEqEdited ? 'dkblink 0.8s infinite alternate ease-in-out' : undefined,
          }}
        >
          {view.isEqEdited ? 'EDITED' : view.presetNameUpper}
        </span>
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
  // v0.6.0 (Phase 5): 메터를 실측 상관도/폴드로스로 갱신. v0.6.1: 정지 후에도 마지막 실측을 유지
  // (freeze) — getStereoMetering 이 마지막 실측값을 반환. 한 번도 재생 전이면 null → width 추정 폴백.
  // 프레임당 작은 DOM 갱신만 수행(React 리렌더 회피 — Transport 시간표시와 동일 패턴).
  const viewRef = useRef(view); viewRef.current = view;
  const markerRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const lossRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const m = previewEngine.getStereoMetering();
      let color: string, status: string, corrLabel: string, lossLabel: string, x: string;
      if (m) {
        const c = m.correlation;
        color = correlationColor(c); status = correlationStatus(c);
        corrLabel = (c >= 0 ? '+' : '') + c.toFixed(2);
        lossLabel = (m.foldLoss > -0.05 ? '0.0' : m.foldLoss.toFixed(1)) + ' dB';
        x = (((c + 1) / 2) * 100).toFixed(1) + '%';
      } else {
        const v = viewRef.current;
        color = v.stCompatColor; status = v.stCompatStatus; corrLabel = v.stCorrLabel; lossLabel = v.stLossLabel; x = v.stCorrX;
      }
      if (markerRef.current) { markerRef.current.style.left = x; markerRef.current.style.background = color; markerRef.current.style.boxShadow = `0 0 7px ${color}`; }
      if (statusRef.current) { statusRef.current.textContent = `${status} · ${corrLabel}`; statusRef.current.style.color = color; }
      if (lossRef.current) { lossRef.current.textContent = lossLabel; lossRef.current.style.color = color; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
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
          <span style={{ fontFamily: 'Archivo', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#8a8070' }}>MONO MASTER · CORRELATION</span>
          <span style={{ fontFamily: 'Archivo', fontSize: 9, color: '#8a8070' }}>fold loss <span ref={lossRef} style={{ fontWeight: 700, color: view.stCompatColor }}>{view.stLossLabel}</span></span>
        </div>
        <div style={{ position: 'relative', height: 7, background: 'rgba(0,0,0,0.35)', borderRadius: 4 }}>
          <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: 'rgba(255,240,210,0.25)' }} />
          <div ref={markerRef} style={{ position: 'absolute', top: '50%', left: view.stCorrX, width: 9, height: 9, borderRadius: '50%', background: view.stCompatColor, transform: 'translate(-50%,-50%)', boxShadow: `0 0 7px ${view.stCompatColor}` }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: 'Archivo', fontSize: 8, color: '#6f6657' }}>-1 · out of phase</span>
          <span ref={statusRef} style={{ fontFamily: 'Archivo', fontSize: 9, fontWeight: 700, color: view.stCompatColor }}>{view.stCompatStatus} · {view.stCorrLabel}</span>
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
        <div style={{ flex: 1, background: pal.panelDark, borderRadius: 8, padding: '4px 11px', opacity: view.tpDim }}>
          <div style={{ fontFamily: 'Archivo', fontSize: 9, color: '#8a8070', letterSpacing: '0.04em' }}>TRUE PEAK</div>
          <div style={{ fontFamily: 'Archivo', fontSize: 16, fontWeight: 700, color: pal.nInk, marginTop: 1 }}>{view.loudCeiling}</div>
        </div>
        <div style={{ flex: 1, background: pal.panelDark, borderRadius: 8, padding: '4px 11px' }}>
          <div style={{ fontFamily: 'Archivo', fontSize: 9, color: '#8a8070', letterSpacing: '0.04em' }}>LIMITER</div>
          <div style={{ fontFamily: 'Archivo', fontSize: 16, fontWeight: 700, color: pal.nInk, marginTop: 1 }}>{view.loudMode}</div>
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
  // v0.8.0 (Phase 7): Artwork 드롭/선택 + Destination 폴더 선택
  const artworkDataUrl = useAppStore((s) => s.artworkDataUrl);
  const setArtwork = useAppStore((s) => s.setArtwork);
  const exportDir = useAppStore((s) => s.exportDir);
  const pickExportDir = useAppStore((s) => s.pickExportDir);
  const resetExportDir = useAppStore((s) => s.resetExportDir);
  const artInputRef = useRef<HTMLInputElement>(null);

  const loadArt = (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setArtwork(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };
  const destLabel = exportDir || `~/Masters/${view.exportAlbum}`;

  return (
    <>
      <span style={{ fontFamily: 'Archivo', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: '#8a8070' }}>ALBUM ARTWORK</span>
      <div style={{ display: 'flex', gap: 13, marginTop: 12 }}>
        <div
          className="dk-destination-card"
          data-export-artwork-dropzone="true"
          onClick={() => artInputRef.current?.click()}
          // 캡처 단계에서 파일 드롭을 소유해 하위 img/button 위에 놓아도 루트 App의
          // 오디오 드롭 핸들러로 전파되지 않게 한다. 이미지가 아니면 Export에서 조용히 거부한다.
          onDragOverCapture={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDropCapture={(e) => {
            e.preventDefault();
            e.stopPropagation();
            loadArt(Array.from(e.dataTransfer.files).find((file) => file.type.startsWith('image/')));
          }}
          title={artworkDataUrl ? 'Click to replace · double-click area to clear' : 'Drop or click to add artwork'}
          style={{ width: 98, height: 98, flex: 'none', borderRadius: 9, border: '1.5px dashed rgba(255,240,210,0.22)', background: pal.panelDark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#8a8070', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}
        >
          {artworkDataUrl ? (
            <>
              <img src={artworkDataUrl} alt="artwork" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                onClick={(e) => { e.stopPropagation(); setArtwork(null); }}
                style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: 5, border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, lineHeight: '18px', padding: 0 }}
              >×</button>
            </>
          ) : (
            <>
              <DeskIcon icon="note" size={24} />
              <span style={{ fontFamily: 'Archivo', fontSize: 8.5, letterSpacing: '0.04em' }}>Drop art</span>
            </>
          )}
          <input ref={artInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => loadArt(e.target.files?.[0])} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 9 }}>
          <div style={{ background: pal.panelDark, borderRadius: 8, padding: '9px 11px' }}><div style={{ fontFamily: 'Archivo', fontSize: 9, color: '#8a8070', letterSpacing: '0.04em' }}>OUTPUT FORMAT</div><div style={{ fontFamily: 'Archivo', fontSize: 14, fontWeight: 700, color: pal.nInk, marginTop: 2 }}>{view.exportFormat}</div></div>
          <div className="dk-destination-card" onClick={() => void pickExportDir()} title="Click to choose a destination folder" style={{ background: pal.panelDark, borderRadius: 8, padding: '9px 11px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Archivo', fontSize: 9, color: '#8a8070', letterSpacing: '0.04em' }}>DESTINATION</span>
              {exportDir && <span onClick={(e) => { e.stopPropagation(); resetExportDir(); }} style={{ fontFamily: 'Archivo', fontSize: 8.5, color: pal.nInk2, textDecoration: 'underline' }}>default</span>}
            </div>
            <div style={{ fontFamily: 'Archivo', fontSize: 11, color: pal.nInk2, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{destLabel}</div>
          </div>
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
