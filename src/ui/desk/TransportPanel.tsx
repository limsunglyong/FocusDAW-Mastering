// FocusDAW Mastering Desk v0.2.11 (Phase 1) - 하단 Transport 패널
// 웨이브폼(클릭 탐색) + Rewind/Play·Pause/Forward + 모니터 볼륨 + 재생헤드(rAF).
// 기존 좌측 Play/Space 와 동일한 transport(isOriginalPlaying)·엔진을 공유한다.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useAppStore } from '../../store/appStore';
import { previewEngine } from '../../audio/previewEngine';
import type { DeskView } from '../../desk/compute';

const SKIP_SEC = 5;
const WAVE_H = 64;
const PEAK_BINS = 700;
// v0.2.12: 패널 고정 높이. App 에서 패널 펼침/접힘 시 윈도우 높이를 이 값만큼 증감해 기존 항목 높이를 유지한다.
export const PANEL_H = 132;

/** 디코딩 버퍼에서 bin 당 최대 진폭(0~1)을 추출(채널 최대값). */
function computePeaks(buffer: AudioBuffer, bins: number): Float32Array {
  const chs = Math.min(buffer.numberOfChannels, 2);
  const len = buffer.length;
  const out = new Float32Array(bins);
  for (let b = 0; b < bins; b++) {
    const start = Math.floor((b * len) / bins);
    const end = Math.max(start + 1, Math.floor(((b + 1) * len) / bins));
    let peak = 0;
    for (let c = 0; c < chs; c++) {
      const data = buffer.getChannelData(c);
      for (let i = start; i < end && i < len; i++) {
        const v = Math.abs(data[i]);
        if (v > peak) peak = v;
      }
    }
    out[b] = peak;
  }
  return out;
}

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return m + ':' + String(s).padStart(2, '0');
}

// v0.12.2: audio-visual-2.html의 Level Meter/Segment LED를 Transport 높이 안에 맞춘 1×4 형태로 이식.
function TransportLevelMeter({ accent }: { accent: string }) {
  const [levels, setLevels] = useState([0, 0, 0, 0, 0, 0]);
  const smoothRef = useRef([0, 0, 0, 0, 0, 0]);

  useEffect(() => {
    let raf = 0;
    let lastPaint = 0;
    const tick = (now: number) => {
      const measured = previewEngine.getTransportLevels();
      const targets = measured ? [measured.sub, measured.low, measured.mid, measured.high, measured.air, measured.rms] : [0, 0, 0, 0, 0, 0];
      const smooth = smoothRef.current;
      for (let i = 0; i < smooth.length; i++) {
        const rate = targets[i] > smooth[i] ? 0.38 : 0.1;
        smooth[i] += (targets[i] - smooth[i]) * rate;
        if (smooth[i] < 0.004) smooth[i] = 0;
      }
      if (now - lastPaint >= 40) {
        lastPaint = now;
        setLevels([...smooth]);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const labels = ['SUB', 'LOW', 'MID', 'HIGH', 'AIR', 'RMS'];
  // v0.12.4 화면 위→아래: red/orange/yellow/green×3.
  const segments = [
    { color: '#ef4444', threshold: 0.80 },
    { color: '#f97316', threshold: 0.65 },
    { color: '#facc15', threshold: 0.50 },
    { color: '#22c55e', threshold: 0.35 },
    { color: '#22c55e', threshold: 0.20 },
    { color: '#22c55e', threshold: 0 },
  ];
  return (
    <div
      aria-label="Audio level meter"
      style={{
        flex: '1 1 250px', minWidth: 210, maxWidth: 330, height: 34,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px',
        borderLeft: '1px solid #252c32', borderRight: '1px solid #252c32',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 34px) 6px 34px', gap: 8, alignItems: 'center' }}>
        {labels.flatMap((label, meterIndex) => {
          const meter = (
            <div key={label} style={{ width: 34, minWidth: 0 }}>
              <div style={{ display: 'grid', gridTemplateRows: 'repeat(6, 1fr)', gap: 1.25, width: 24, height: 22, margin: '0 auto 2px' }}>
                {segments.map(({ color, threshold }, segmentIndex) => {
                  const active = levels[meterIndex] > threshold;
                  return (
                    <span
                      key={segmentIndex}
                      style={{
                        borderRadius: 1.5,
                        background: active ? color : '#252c31',
                        boxShadow: active ? `0 0 5px ${color}, 0 0 9px ${accent}42` : 'inset 0 0 0 1px rgba(255,255,255,0.025)',
                        opacity: active ? 1 : 0.62,
                      }}
                    />
                  );
                })}
              </div>
              <div style={{ textAlign: 'center', fontFamily: 'Archivo', fontSize: 7.5, fontWeight: 600, letterSpacing: '0.12em', color: '#68757d', lineHeight: 1 }}>
                {label}
              </div>
            </div>
          );
          return label === 'RMS'
            ? [<span key="air-rms-separator" aria-hidden="true" style={{ width: 6, textAlign: 'center', color: '#657078', fontFamily: 'Arial, sans-serif', fontSize: 8, lineHeight: 1 }}>●</span>, meter]
            : [meter];
        })}
      </div>
    </div>
  );
}

export function TransportPanel({ view }: { view: DeskView }) {
  const file = useAppStore((s) => s.files[s.curFile]);
  const isPlaying = useAppStore((s) => s.isOriginalPlaying);
  const isPaused = useAppStore((s) => s.isOriginalPaused);
  const toggleOriginalPlayback = useAppStore((s) => s.toggleOriginalPlayback);
  const stopOriginalPlayback = useAppStore((s) => s.stopOriginalPlayback);
  const seekPreview = useAppStore((s) => s.seekPreview);
  const skip = useAppStore((s) => s.skip);
  const volume = useAppStore((s) => s.volume);
  const setVolume = useAppStore((s) => s.setVolume);
  const muted = useAppStore((s) => s.muted);
  const toggleMute = useAppStore((s) => s.toggleMute);
  const loopEnabled = useAppStore((s) => s.loopEnabled);
  const loopStart = useAppStore((s) => s.loopStart);
  const loopEnd = useAppStore((s) => s.loopEnd);
  const setLoopRange = useAppStore((s) => s.setLoopRange);
  const toggleLoop = useAppStore((s) => s.toggleLoop);
  const clearLoop = useAppStore((s) => s.clearLoop);

  const accent = view.accent;
  const pal = view.pal;
  const hasFile = !!file;
  const duration = file?.meta.duration ?? 0;

  const waveRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const curTimeRef = useRef<HTMLSpanElement>(null);
  const dragStartRef = useRef<number | null>(null);
  const dragStartXRef = useRef(0);
  // v0.2.29: «/» 길게 누르기(1초) 판정용
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHoldRef = useRef(false);
  const [draftLoop, setDraftLoop] = useState<{ start: number; end: number } | null>(null);
  const [waveW, setWaveW] = useState(600);
  const shownLoop = draftLoop ?? (loopEnd - loopStart >= 0.25 ? { start: loopStart, end: loopEnd } : null);

  // 재생 상태를 rAF 안에서 읽기 위한 ref(현재시간 색/breathing 결정용)
  const playingRef = useRef(isPlaying);
  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);

  const peaks = useMemo(
    () => (file?.sourceBuffer ? computePeaks(file.sourceBuffer, PEAK_BINS) : null),
    [file?.id, file?.sourceBuffer],
  );

  // 컨테이너 폭 추적(웨이브폼 픽셀 폭)
  useEffect(() => {
    const el = waveRef.current;
    if (!el) return;
    const measure = () => setWaveW(Math.max(80, Math.floor(el.clientWidth)));
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  // 웨이브폼 렌더
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = waveW;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(WAVE_H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = WAVE_H + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, WAVE_H);
    if (!peaks) return;

    // v0.2.20: 파형 뒤쪽의 저채도 기준선. 긴 곡은 세로선 간격을 자동 확장한다.
    ctx.save();
    ctx.strokeStyle = pal.nInk2;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.14;
    ctx.beginPath();
    ctx.moveTo(0, Math.floor(WAVE_H / 2) + 0.5);
    ctx.lineTo(W, Math.floor(WAVE_H / 2) + 0.5);
    ctx.stroke();

    const intervals = [5, 10, 15, 30, 60];
    const gridSeconds = intervals.find((seconds) => duration <= 0 || (W * seconds) / duration >= 24) ?? 120;
    if (duration > 0) {
      for (let seconds = gridSeconds; seconds < duration; seconds += gridSeconds) {
        const x = Math.round((seconds / duration) * W) + 0.5;
        ctx.globalAlpha = seconds % 30 === 0 ? 0.18 : 0.09;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, WAVE_H);
        ctx.stroke();
      }
    }
    ctx.restore();

    const mid = WAVE_H / 2;
    const bw = W / peaks.length;
    ctx.fillStyle = accent;
    for (let i = 0; i < peaks.length; i++) {
      const h = Math.max(1, peaks[i] * (WAVE_H - 6));
      ctx.fillRect(i * bw, mid - h / 2, Math.max(0.75, bw - 0.5), h);
    }
  }, [peaks, waveW, accent, duration, pal.nInk2]);

  // v0.2.15: 재생헤드 + 현재시간(rAF, React 리렌더 없이 DOM 직접 갱신).
  //   재생 중=고정 하이라이트 / 일시정지=하이라이트+breathing / 정지=normal.
  useEffect(() => {
    let raf = 0;
    let lastState = '';
    const apply = (state: string) => {
      const el = curTimeRef.current;
      if (!el || state === lastState) return;
      lastState = state;
      el.style.color = state === 'stop' ? '#9aa7af' : accent;
      el.style.animation = state === 'pause' ? 'dktimebreath 1.3s ease-in-out infinite' : 'none';
      el.style.textShadow = state === 'play' ? `0 0 4px ${pal.glow}, 0 0 9px ${accent}` : 'none';
    };
    const tick = () => {
      const t = previewEngine.getCurrentTime();
      const frac = duration > 0 ? Math.max(0, Math.min(1, t / duration)) : 0;
      if (headRef.current) headRef.current.style.left = frac * 100 + '%';
      if (curTimeRef.current) curTimeRef.current.textContent = fmt(t);
      apply(playingRef.current ? 'play' : t < 0.05 ? 'stop' : 'pause');
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, accent, pal.glow]);

  const timeFromPointer = (clientX: number) => {
    const el = waveRef.current;
    if (!el || duration <= 0) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration));
  };

  const onWavePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasFile || duration <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const time = timeFromPointer(e.clientX);
    dragStartRef.current = time;
    dragStartXRef.current = e.clientX;
    setDraftLoop({ start: time, end: time });
  };

  const onWavePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (start == null) return;
    const current = timeFromPointer(e.clientX);
    setDraftLoop({ start: Math.min(start, current), end: Math.max(start, current) });
  };

  const onWavePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (start == null) return;
    const current = timeFromPointer(e.clientX);
    const moved = Math.abs(e.clientX - dragStartXRef.current);
    dragStartRef.current = null;
    setDraftLoop(null);
    if (moved < 4 || Math.abs(current - start) < 0.25) {
      seekPreview(current);
      return;
    }
    setLoopRange(Math.min(start, current), Math.max(start, current));
  };

  const ctlBtn = (onClick: () => void, label: React.ReactNode, title: string, primary = false) => (
    <div
      onClick={hasFile ? onClick : undefined}
      title={title}
      style={{
        width: primary ? 36 : 30, height: primary ? 36 : 30, borderRadius: primary ? '50%' : 7,
        display: 'grid', placeItems: 'center', flex: 'none',
        background: primary ? (hasFile ? accent : '#2a3037') : '#222830',
        border: primary ? 'none' : '1px solid #303841',
        color: '#9aa7af', fontSize: 12, cursor: hasFile ? 'pointer' : 'not-allowed', opacity: hasFile ? 1 : 0.55,
      }}
    >{label}</div>
  );

  // v0.2.29: «/» 길게(1초) 누르면 곡 처음/끝으로 이동, 짧게 누르면 ±SKIP_SEC.
  const startHold = (onHold: () => void) => {
    didHoldRef.current = false;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => { didHoldRef.current = true; onHold(); }, 1000);
  };
  const endHold = (onTap: () => void) => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (!didHoldRef.current) onTap();
  };
  const cancelHold = () => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
  };
  const holdBtn = (onTap: () => void, onHold: () => void, label: React.ReactNode, title: string) => (
    <div
      title={title}
      onPointerDown={hasFile ? () => startHold(onHold) : undefined}
      onPointerUp={hasFile ? () => endHold(onTap) : undefined}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      style={{
        width: 30, height: 30, borderRadius: 7,
        display: 'grid', placeItems: 'center', flex: 'none',
        background: '#222830', border: '1px solid #303841',
        color: '#9aa7af', fontSize: 12, cursor: hasFile ? 'pointer' : 'not-allowed', opacity: hasFile ? 1 : 0.55,
        touchAction: 'none', userSelect: 'none',
      }}
    >{label}</div>
  );

  return (
    <div className="dk-transport-roll" style={{ flex: 'none', height: PANEL_H, boxSizing: 'border-box', background: '#13171c', borderTop: '1px solid #0a0d10', padding: '10px 15px 12px' }}>
      {/* 웨이브폼 */}
      <div
        ref={waveRef}
        onPointerDown={onWavePointerDown}
        onPointerMove={onWavePointerMove}
        onPointerUp={onWavePointerUp}
        onPointerCancel={() => { dragStartRef.current = null; setDraftLoop(null); }}
        style={{ position: 'relative', height: WAVE_H, borderRadius: 7, background: pal.panelDark, overflow: 'hidden', cursor: hasFile && duration > 0 ? 'crosshair' : 'default', touchAction: 'none' }}
      >
        <canvas ref={canvasRef} style={{ display: 'block', position: 'absolute', left: 0, top: 0 }} />
        {shownLoop && duration > 0 && (
          <div
            style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${(shownLoop.start / duration) * 100}%`,
              width: `${((shownLoop.end - shownLoop.start) / duration) * 100}%`,
              background: `${accent}24`,
              borderLeft: `1px solid ${accent}`,
              borderRight: `1px solid ${accent}`,
              boxShadow: loopEnabled ? `inset 0 0 14px ${pal.glow}` : 'none',
              pointerEvents: 'none',
            }}
          />
        )}
        {loopEnd - loopStart >= 0.25 && (
          <button
            type="button"
            className="dk-loop-clear"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); clearLoop(); }}
            title="Clear repeat range"
            aria-label="Clear repeat range"
            style={{
              position: 'absolute', top: 5,
              left: `clamp(20px, ${(loopEnd / duration) * 100}%, calc(100% - 4px))`,
              transform: 'translateX(-100%)',
              zIndex: 4,
              width: 20, height: 20, padding: 0, borderRadius: 6,
              display: 'grid', placeItems: 'center',
              border: '1px solid rgba(255,255,255,0.14)',
              background: `${pal.panelDark}d9`, color: '#a8b2b8',
              fontFamily: 'Arial, sans-serif', fontSize: 15, lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        )}
        {hasFile && !peaks && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'Archivo', fontSize: 10.5, color: '#6f7d86' }}>Loading waveform…</div>
        )}
        {!hasFile && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'Archivo', fontSize: 10.5, color: '#6f7d86' }}>Load an audio file</div>
        )}
        {/* 재생헤드 */}
        <div ref={headRef} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 2, background: accent, boxShadow: `0 0 7px ${pal.glow}`, pointerEvents: 'none' }} />
        {isPaused && (
          <div
            style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none',
            }}
          >
            <div
              style={{
                padding: '7px 14px', borderRadius: 7, background: `${pal.panelDark}80`,
                border: `1px solid ${pal.panelDark}`, boxShadow: `0 4px 14px ${pal.panelDark}66`,
              }}
            >
              <span
                className="dk-pause-blink"
                style={{
                  fontFamily: 'Archivo, sans-serif', fontSize: 13, fontWeight: 600, letterSpacing: '0.22em',
                  color: '#ff4d5e', textShadow: '0 0 8px rgba(255,77,94,0.75), 0 0 18px rgba(255,77,94,0.45)',
                }}
              >
                PAUSE
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 컨트롤 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
        {holdBtn(() => skip(-SKIP_SEC), () => seekPreview(0), '«', `Back ${SKIP_SEC}s · hold: to start`)}
        {ctlBtn(
          () => { void toggleOriginalPlayback(); },
          isPlaying ? (
            <div style={{ display: 'flex', gap: 3 }}>
              <span style={{ width: 3.5, height: 12, borderRadius: 1, background: pal.aInk }} />
              <span style={{ width: 3.5, height: 12, borderRadius: 1, background: pal.aInk }} />
            </div>
          ) : (
            <div style={{ width: 0, height: 0, marginLeft: 2, borderLeft: `9px solid ${hasFile ? pal.aInk : '#6f7d86'}`, borderTop: '6px solid transparent', borderBottom: '6px solid transparent' }} />
          ),
          hasFile ? 'Play/Pause (Space)' : 'Load an audio file',
          true,
        )}
        {ctlBtn(
          stopOriginalPlayback,
          <div style={{ width: 10, height: 10, borderRadius: 1.5, background: hasFile ? accent : '#6f7d86', boxShadow: hasFile ? `0 0 6px ${pal.glow}` : 'none' }} />,
          hasFile ? 'Stop and return to start' : 'Load an audio file',
        )}
        {holdBtn(() => skip(SKIP_SEC), () => seekPreview(Math.max(0, duration)), '»', `Forward ${SKIP_SEC}s · hold: to end`)}

        {/* v0.2.18: 현재 시간은 tabular UI sans, 전체 길이는 --mono */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginLeft: 6, minWidth: 128, whiteSpace: 'nowrap' }}>
          <span ref={curTimeRef} style={{ display: 'inline-block', width: 76, textAlign: 'right', fontFamily: '"Segoe UI", Inter, Arial, sans-serif', fontVariantNumeric: 'tabular-nums', fontSize: 22, fontWeight: 300, color: '#9aa7af', lineHeight: 1 }}>0:00</span>
          <span style={{ fontFamily: 'Archivo', fontSize: 13, color: '#5e6b73' }}>/</span>
          <span style={{ display: 'inline-block', width: 58, textAlign: 'left', fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums', fontSize: 16.5, color: '#6f7d86', lineHeight: 1 }}>{fmt(duration)}</span>
        </div>

        <TransportLevelMeter accent={accent} />

        <button
          type="button"
          onClick={toggleLoop}
          disabled={!hasFile || loopEnd - loopStart < 0.25}
          title={loopEnd - loopStart >= 0.25 ? `Repeat ${fmt(loopStart)}–${fmt(loopEnd)}` : 'Drag a waveform range first'}
          style={{
            height: 27, padding: '0 11px', borderRadius: 7, flex: 'none', marginLeft: 'auto',
            display: 'inline-flex', alignItems: 'center', gap: 5,
            border: `1px solid ${loopEnabled ? accent : '#303841'}`,
            background: loopEnabled ? `${accent}2e` : '#222830',
            color: loopEnabled ? accent : '#77848c',
            boxShadow: loopEnabled ? `0 0 8px ${pal.glow}` : 'none',
            fontFamily: 'Archivo', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em',
            cursor: hasFile && loopEnd - loopStart >= 0.25 ? 'pointer' : 'not-allowed',
            opacity: hasFile && loopEnd - loopStart >= 0.25 ? 1 : 0.5,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" style={{ flex: 'none' }}>
            <path d="M3 5.2h7.3l-1.5-1.5M13 10.8H5.7l1.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12.8 5.2a3.2 3.2 0 0 1 .2 1.1M3.2 10.8A3.2 3.2 0 0 1 3 9.7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          REPEAT
        </button>

        {/* 볼륨(모니터 전용) */}
        <span style={{ fontFamily: 'Archivo', fontSize: 10.5, color: '#6f7d86', flex: 'none' }} title="Monitor volume (not applied to Export)">VOL</span>
        <div
          onClick={() => toggleMute()}
          title={muted ? 'Unmute' : 'Mute'}
          style={{ width: 26, height: 26, borderRadius: 7, display: 'grid', placeItems: 'center', flex: 'none', background: '#222830', border: '1px solid #303841', cursor: 'pointer', color: muted ? '#8a8070' : accent }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2.5 6h2.5l3.5-2.6v9.2L5 10H2.5z" fill="currentColor" />
            {muted ? (
              <path d="M10.4 6.2l3.2 3.6M13.6 6.2l-3.2 3.6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            ) : (
              <path d="M10.4 5.2a3.6 3.6 0 0 1 0 5.6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            )}
          </svg>
        </div>
        <input
          className={`dk-vol${muted ? ' dk-vol-muted' : ''}`}
          type="range" min={0} max={100} value={Math.round(volume * 100)}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          style={{
            width: 150,
            flex: 'none',
            background: `linear-gradient(to right, ${muted ? '#6f777d' : accent} ${Math.round(volume * 100)}%, #2a3037 ${Math.round(volume * 100)}%)`,
            '--dk-vol-accent': accent,
          } as CSSProperties}
        />
        <span style={{ fontFamily: 'Archivo', fontSize: 10.5, color: '#9aa7af', width: 30, textAlign: 'right', flex: 'none' }}>{Math.round(volume * 100)}</span>
      </div>
    </div>
  );
}
