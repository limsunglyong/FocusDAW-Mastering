// FocusDAW Mastering Desk v0.2.11 (Phase 1) - 하단 Transport 패널
// 웨이브폼(클릭 탐색) + Rewind/Play·Pause/Forward + 모니터 볼륨 + 재생헤드(rAF).
// 기존 좌측 Play/Space 와 동일한 transport(isOriginalPlaying)·엔진을 공유한다.
import { useEffect, useMemo, useRef, useState } from 'react';
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

export function TransportPanel({ view }: { view: DeskView }) {
  const file = useAppStore((s) => s.files[s.curFile]);
  const isPlaying = useAppStore((s) => s.isOriginalPlaying);
  const toggleOriginalPlayback = useAppStore((s) => s.toggleOriginalPlayback);
  const seekPreview = useAppStore((s) => s.seekPreview);
  const skip = useAppStore((s) => s.skip);
  const volume = useAppStore((s) => s.volume);
  const setVolume = useAppStore((s) => s.setVolume);
  const muted = useAppStore((s) => s.muted);
  const toggleMute = useAppStore((s) => s.toggleMute);

  const accent = view.accent;
  const pal = view.pal;
  const hasFile = !!file;
  const duration = file?.meta.duration ?? 0;

  const waveRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const curTimeRef = useRef<HTMLSpanElement>(null);
  const [waveW, setWaveW] = useState(600);

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
    const mid = WAVE_H / 2;
    const bw = W / peaks.length;
    ctx.fillStyle = accent;
    for (let i = 0; i < peaks.length; i++) {
      const h = Math.max(1, peaks[i] * (WAVE_H - 6));
      ctx.fillRect(i * bw, mid - h / 2, Math.max(0.75, bw - 0.5), h);
    }
  }, [peaks, waveW, accent]);

  // 재생헤드 + 현재시간(rAF, React 리렌더 없이 DOM 직접 갱신).
  //   재생 중=하이라이트+breathing / 일시정지=하이라이트(정지) / 정지(종료·0)=normal.
  useEffect(() => {
    let raf = 0;
    let lastState = '';
    const apply = (state: string) => {
      const el = curTimeRef.current;
      if (!el || state === lastState) return;
      lastState = state;
      el.style.color = state === 'stop' ? '#9aa7af' : accent;
      el.style.animation = state === 'play' ? 'dktimebreath 1.3s ease-in-out infinite' : 'none';
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
  }, [duration, accent]);

  const onSeek = (e: React.MouseEvent) => {
    const el = waveRef.current;
    if (!el || duration <= 0) return;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekPreview(frac * duration);
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

  return (
    <div style={{ flex: 'none', height: PANEL_H, boxSizing: 'border-box', background: '#13171c', borderTop: '1px solid #0a0d10', padding: '10px 15px 12px' }}>
      {/* 웨이브폼 */}
      <div
        ref={waveRef}
        onClick={onSeek}
        style={{ position: 'relative', height: WAVE_H, borderRadius: 7, background: pal.panelDark, overflow: 'hidden', cursor: hasFile && duration > 0 ? 'pointer' : 'default' }}
      >
        <canvas ref={canvasRef} style={{ display: 'block', position: 'absolute', left: 0, top: 0 }} />
        {hasFile && !peaks && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'Archivo', fontSize: 10.5, color: '#6f7d86' }}>Loading waveform…</div>
        )}
        {!hasFile && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'Archivo', fontSize: 10.5, color: '#6f7d86' }}>Load an audio file</div>
        )}
        {/* 재생헤드 */}
        <div ref={headRef} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 2, background: accent, boxShadow: `0 0 7px ${pal.glow}`, pointerEvents: 'none' }} />
      </div>

      {/* 컨트롤 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
        {ctlBtn(() => skip(-SKIP_SEC), '«', `Back ${SKIP_SEC}s`)}
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
        {ctlBtn(() => skip(SKIP_SEC), '»', `Forward ${SKIP_SEC}s`)}

        {/* 현재 / 전체 시간 — 현재는 2배·상태색, 전체는 1.5배·이탤릭 */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginLeft: 6, minWidth: 128, whiteSpace: 'nowrap' }}>
          <span ref={curTimeRef} style={{ fontFamily: 'Archivo', fontSize: 22, fontWeight: 400, color: '#9aa7af', lineHeight: 1 }}>0:00</span>
          <span style={{ fontFamily: 'Archivo', fontSize: 13, color: '#5e6b73' }}>/</span>
          <span style={{ fontFamily: 'Archivo', fontStyle: 'italic', fontSize: 16.5, color: '#6f7d86', lineHeight: 1 }}>{fmt(duration)}</span>
        </div>

        <div style={{ flex: 1 }} />

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
          className="dk-vol"
          type="range" min={0} max={100} value={Math.round(volume * 100)}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          style={{ width: 150, flex: 'none', background: `linear-gradient(to right, ${accent} ${Math.round(volume * 100)}%, #2a3037 ${Math.round(volume * 100)}%)` }}
        />
        <span style={{ fontFamily: 'Archivo', fontSize: 10.5, color: '#9aa7af', width: 30, textAlign: 'right', flex: 'none' }}>{Math.round(volume * 100)}</span>
      </div>
    </div>
  );
}
