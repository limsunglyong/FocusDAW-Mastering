// FocusDAW Mastering Desk - Mastering Wizard 창 (#wizard, v0.13.0)
// 대화형 7단계로 마스터링 세팅을 자동 구성 → 결과 카드 → 창 내장 A/B 청취 →
// "메인에 즉시 적용"(sessionIO.apply) / "저장"([Wizard] 세션, sessionIO.save).
// 디자인 출처: _refer/Mastering Wizard.standalone.html. 오디오는 이 창 자체의 previewEngine 인스턴스로
// 독립 디코딩/재생한다(메인 스토어 미의존 — 별도 렌더러이므로 AudioContext 도 분리됨).
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { THEMES, type ThemeName } from '../../theme/themes';
import { APP_VERSION } from '../../version';
import { decodeAudioFile } from '../../audio/decoder';
import { openAudioFilePicker } from '../../audio/filePicker';
import { previewEngine } from '../../audio/previewEngine';
import type { AudioMeta } from '../../audio/decoder';
import type { SessionPayload } from '../../session/session';
import {
  DEFAULT_ANSWERS, L, STEPS, WIZARD_UI, type Lang, type StepKey, type WizardAnswers,
} from '../../wizard/wizardModel';
import { answersToPayload } from '../../wizard/wizardMap';
import { autoTitle, buildSummary } from '../../wizard/wizardSummary';
import { WizardSprite, WzIcon } from './WizardIcons';

// aMain 위에 올릴 잉크색(밝기 기준 대비). 라이트 계열 액센트엔 어두운 잉크.
function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#f6f2e8';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum >= 0.5 ? '#1e1a13' : '#f6f2e8';
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60), x = Math.floor(s % 60);
  return `${m}:${String(x).padStart(2, '0')}`;
};

const WAVE_BARS = 60;

/** AudioBuffer 채널0에서 60개 피크 막대(0..1)를 뽑는다. */
function waveformPeaks(buf: AudioBuffer): number[] {
  const data = buf.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / WAVE_BARS));
  const peaks: number[] = [];
  for (let i = 0; i < WAVE_BARS; i++) {
    let peak = 0;
    const start = i * step;
    for (let j = start; j < start + step && j < data.length; j++) {
      const a = Math.abs(data[j]);
      if (a > peak) peak = a;
    }
    peaks.push(0.12 + 0.88 * Math.min(1, peak));
  }
  return peaks;
}

export function WizardWindow() {
  const [theme, setTheme] = useState<ThemeName>('Teal');
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'quiz' | 'result'>('quiz');
  const [lang, setLang] = useState<Lang>('ko');
  const [answers, setAnswers] = useState<WizardAnswers>(DEFAULT_ANSWERS);
  const [titleEdit, setTitleEdit] = useState<string | null>(null);

  // ── A/B 트랜스포트 상태 ──
  const [loaded, setLoaded] = useState(false);
  const [loadedName, setLoadedName] = useState('');
  const [loadedMeta, setLoadedMeta] = useState('');
  const [wave, setWave] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [xf, setXf] = useState(100); // 0=A(원본) … 100=B(Wizard)
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const bufferRef = useRef<AudioBuffer | null>(null);
  const metaRef = useRef<AudioMeta | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pal = THEMES[theme] || THEMES.Teal;
  const ac = pal.aMain, ab = pal.aBright, chipInk = inkOn(pal.aMain);

  const payload = useMemo<SessionPayload>(() => answersToPayload(answers), [answers]);
  const summary = useMemo(() => buildSummary(answers, lang), [answers, lang]);
  const titleVal = titleEdit ?? autoTitle(answers, lang);

  // 초기 테마 취득 + 브로드캐스트 구독.
  useEffect(() => {
    void window.focusdaw?.win?.getWizardTheme?.().then((t) => { if (t) setTheme(t as ThemeName); });
    const unsub = window.focusdaw?.win?.onThemeUpdated?.((t) => setTheme(t as ThemeName));
    return () => unsub?.();
  }, []);

  const params = useCallback(() => ({ vals: payload.vals, enabled: payload.enabled, meta: metaRef.current! }), [payload]);

  // 재생 중 응답이 바뀌면 wet(B) 체인을 실시간 갱신.
  useEffect(() => {
    if (loaded && metaRef.current) previewEngine.update(params());
  }, [payload, loaded, params]);

  // 재생 위치 폴링(100ms).
  useEffect(() => {
    const iv = setInterval(() => {
      if (previewEngine.isPlaying()) {
        setCurTime(previewEngine.getCurrentTime());
      }
    }, 100);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => () => { previewEngine.stop(); if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  // ── 네비게이션 ──
  const pick = (k: StepKey, v: string) => setAnswers((a) => ({ ...a, [k]: v }) as WizardAnswers);
  const next = () => { if (step < 6) setStep(step + 1); else setPhase('result'); };
  const back = () => {
    if (phase === 'result') { setPhase('quiz'); setStep(6); }
    else if (step > 0) setStep(step - 1);
  };

  // ── 오디오 ──
  const onLoad = async () => {
    setLoadError(null);
    const picked = await openAudioFilePicker({ directory: false });
    const file = picked[0];
    if (!file) return;
    setBusy(true);
    try {
      const { buffer, meta } = await decodeAudioFile(file);
      bufferRef.current = buffer;
      metaRef.current = meta;
      setWave(waveformPeaks(buffer));
      setLoadedName(file.name);
      setLoadedMeta(`${Math.round(meta.sampleRate / 100) / 10} kHz · ${meta.bitDepthLabel}`);
      setDur(buffer.duration);
      setCurTime(0);
      setLoaded(true);
      await previewEngine.play(buffer, params(), () => { setPlaying(false); setCurTime(0); }, 0, xf >= 50);
      setPlaying(true);
    } catch {
      setLoadError(L(WIZARD_UI.loadFail, lang));
    } finally {
      setBusy(false);
    }
  };

  const onPlay = () => {
    const buf = bufferRef.current;
    if (!buf) return;
    if (previewEngine.isPlaying()) { previewEngine.pause(); setPlaying(false); }
    else { previewEngine.resume(buf, () => { setPlaying(false); setCurTime(0); }); setPlaying(true); }
  };
  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    previewEngine.seek(f * dur);
    setCurTime(f * dur);
  };
  const onRewind = () => { previewEngine.seek(0); setCurTime(0); };
  const onXf = (val: number) => { setXf(val); if (loaded) previewEngine.setPreviewEnabled(val >= 50); };

  // ── 적용 / 저장 ──
  const onApply = async () => {
    const res = await window.focusdaw?.sessionIO?.apply?.(payload);
    showToast(res?.ok === false ? (res.error || 'Apply failed') : L(WIZARD_UI.applied, lang));
  };
  const onSave = async () => {
    const res = await window.focusdaw?.sessionIO?.save?.({
      name: titleVal, description: '', payload, appVersion: APP_VERSION,
    });
    showToast(res?.ok ? L(WIZARD_UI.saved, lang) : `${L(WIZARD_UI.saveFail, lang)}: ${res?.error || ''}`);
  };
  const onReset = () => { setPhase('quiz'); setStep(0); setTitleEdit(null); };

  // ══════════════════ 렌더 ══════════════════
  const stepDef = STEPS[step];
  const sel = answers[stepDef.key];
  const abSide = xf < 50 ? 'A' : 'B';
  const prog = dur > 0 ? curTime / dur : 0;

  const font = { archivo: "'Archivo','Noto Sans KR',system-ui,sans-serif", serif: "'Spectral','Noto Serif KR',serif" };
  const paperBg = `linear-gradient(180deg,${pal.paperA},${pal.paperB})`;

  const railDot = (i: number): CSSProperties => {
    const active = i === step && phase === 'quiz';
    const done = phase === 'result' || i < step;
    const base: CSSProperties = {
      width: 29, height: 29, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center',
      fontFamily: font.serif, fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all .16s',
    };
    if (active) return { ...base, background: ac, color: chipInk, boxShadow: `0 0 12px ${pal.glow}` };
    if (done) return { ...base, background: 'transparent', border: `1.5px solid ${ac}`, color: ab };
    return { ...base, background: 'transparent', border: '1.5px solid #303841', color: '#6f7d86' };
  };
  const railClick = (i: number) => {
    if (phase === 'result') { setPhase('quiz'); setStep(i); }
    else if (i <= step) setStep(i);
  };

  return (
    // 프레임리스 창 전체를 채우는 실제 윈도우 프레임(참조의 바깥 캔버스/여백 제거).
    <div style={{ position: 'fixed', inset: 0, background: pal.frame, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <WizardSprite />
      <style>{`
        .wz-card{transition:transform .16s cubic-bezier(.4,0,.2,1),box-shadow .16s,background .16s,border-color .16s}
        .wz-card:hover{transform:translateY(-2px)}
        input.wz-title{font-family:'Spectral','Noto Serif KR',serif;outline:none}
        input.wz-title::placeholder{color:#a99f8a}
        input[type=range].wz-xf{-webkit-appearance:none;appearance:none;height:4px;border-radius:3px;outline:none}
        input[type=range].wz-xf::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:#f6f2e8;box-shadow:0 1px 4px rgba(0,0,0,.5);cursor:pointer;border:2px solid ${ac}}
        .wz-scroll::-webkit-scrollbar{width:8px;height:8px}.wz-scroll::-webkit-scrollbar-thumb{background:#cdbfa4;border-radius:4px}
      `}</style>

        {/* ── title bar ── */}
        <div className="app-drag" style={{ position: 'relative', height: 44, display: 'flex', alignItems: 'center', gap: 11, padding: '0 15px', background: '#1a1f25', borderBottom: '1px solid #0a0d10' }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, flex: 'none', display: 'grid', placeItems: 'center', background: ac, boxShadow: '0 1px 3px rgba(0,0,0,.4)' }}><WzIcon name="sparkle" size={15} color={chipInk} /></div>
          <span style={{ fontFamily: font.archivo, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: '#9aa7af' }}>Wizard</span>
          <div style={{ position: 'absolute', left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, pointerEvents: 'none' }}>
            <span style={{ fontFamily: font.serif, fontSize: 16, fontWeight: 600, letterSpacing: '0.03em', color: '#efe7d6' }}>Mastering Wizard</span>
            <span style={{ fontSize: 11.5, color: '#6f7d86' }}>FocusDAW</span>
          </div>
          <div style={{ flex: 1 }} />
          <div className="app-no-drag" style={{ display: 'flex', alignItems: 'center', background: '#252b32', border: '1px solid #303841', borderRadius: 6, padding: 2, marginRight: 9 }}>
            {(['ko', 'en'] as Lang[]).map((lng) => (
              <div key={lng} onClick={() => setLang(lng)} style={{ fontFamily: font.archivo, fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 4, cursor: 'pointer', ...(lang === lng ? { background: ac, color: chipInk } : { background: 'transparent', color: '#9aa7af' }) }}>{lng === 'ko' ? '한글' : 'EN'}</div>
            ))}
          </div>
          <div className="app-no-drag" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div onClick={() => window.focusdaw?.win?.minimize?.()} style={ctrlBtn}><div style={{ width: 8, height: 1.5, background: '#9aa7af' }} /></div>
            <div onClick={() => window.focusdaw?.win?.toggleMaximize?.()} style={ctrlBtn}><div style={{ width: 8, height: 8, border: '1.3px solid #9aa7af', borderRadius: 2 }} /></div>
            <div onClick={() => window.focusdaw?.win?.close?.()} style={{ ...ctrlBtn, color: '#9aa7af', fontSize: 12 }}>×</div>
          </div>
        </div>

        {/* ── step rail ── */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 26px', background: '#13171c', borderBottom: '1px solid #0a0d10' }}>
          {STEPS.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', ...(i < 6 ? { flex: 1 } : { flex: 'none' }) }}>
              <div onClick={() => railClick(i)} style={railDot(i)}>{s.roman}</div>
              {i < 6 && <div style={{ flex: 1, height: 2, margin: '0 8px', borderRadius: 2, background: (i < step || phase === 'result') ? ac : '#2a323a' }} />}
            </div>
          ))}
        </div>

        {/* ── paper sheet (창 높이를 넘치면 잘리지 않고 스크롤) ── */}
        <div className="wz-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', margin: 14, borderRadius: 12, background: paperBg, boxShadow: '0 10px 30px -12px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.55)', padding: '22px 24px', boxSizing: 'border-box' }}>

          {phase === 'quiz' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <div style={{ fontFamily: font.serif, fontSize: 44, fontWeight: 600, lineHeight: 0.8, color: ac }}>{stepDef.roman}</div>
                <div>
                  <div style={{ fontFamily: font.archivo, fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: pal.pInk2 }}>STEP {stepDef.roman} · {L(stepDef.label, lang)}</div>
                  <div style={{ fontFamily: font.serif, fontSize: 24, fontWeight: 600, color: pal.pInk, marginTop: 3, lineHeight: 1.15 }}>{L(stepDef.q, lang)}</div>
                </div>
              </div>
              <div style={{ fontFamily: font.archivo, fontSize: 12, color: pal.pInk2, marginTop: 8, lineHeight: 1.5 }}>{L(stepDef.sub, lang)}</div>

              <div style={{ display: 'grid', gap: 11, marginTop: 16, gridTemplateColumns: `repeat(${Math.min(stepDef.cols, 3)},1fr)` }}>
                {stepDef.opts.map((o, i) => {
                  const on = o.v === sel;
                  const spanFull = stepDef.cols === 1 && stepDef.opts.length === 5 && i === 4;
                  const cardStyle: CSSProperties = {
                    position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 15px',
                    borderRadius: 11, cursor: 'pointer',
                    ...(spanFull ? { gridColumn: '1 / -1' } : null),
                    ...(on
                      ? { backgroundImage: `linear-gradient(180deg,${pal.cardSelA},${pal.cardSelB})`, border: `1.5px solid ${ac}`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5),0 0 0 1px ${ac},0 6px 16px -8px ${pal.glow}` }
                      : { backgroundImage: `linear-gradient(180deg,${pal.cardA},${pal.cardB})`, border: '1.5px solid transparent', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)' }),
                  };
                  return (
                    <div key={o.v} className="wz-card" onClick={() => pick(stepDef.key, o.v)} style={cardStyle}>
                      <div style={{ width: 38, height: 38, flex: 'none', borderRadius: 10, display: 'grid', placeItems: 'center', ...(on ? { background: ac, color: chipInk } : { background: pal.paperCtl, color: pal.pInk2 }) }}>
                        <WzIcon name={o.icon} size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontFamily: font.archivo, fontSize: 14, fontWeight: 700, color: pal.pInk }}>{L(o.t, lang)}</span>
                          {o.rec && <span style={{ fontFamily: font.archivo, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: ac, border: `1px solid ${ac}`, borderRadius: 20, padding: '1px 7px' }}>{L(WIZARD_UI.rec, lang)}</span>}
                        </div>
                        <div style={{ fontFamily: font.archivo, fontSize: 11.5, color: pal.pInk2, marginTop: 3, lineHeight: 1.4 }}>{L(o.d, lang)}</div>
                      </div>
                      {on && <div style={{ position: 'absolute', top: 11, right: 12, width: 19, height: 19, borderRadius: '50%', background: ac, color: chipInk, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700 }}>✓</div>}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', marginTop: 22 }}>
                <div onClick={back} style={{ fontFamily: font.archivo, fontSize: 12, fontWeight: 600, borderRadius: 8, padding: '9px 16px', ...(step === 0 ? { color: 'rgba(58,52,43,0.28)', border: '1px solid rgba(58,52,43,0.1)', pointerEvents: 'none' } : { color: pal.pInk2, border: '1px solid rgba(58,52,43,0.22)', cursor: 'pointer' }) }}>{L(WIZARD_UI.back, lang)}</div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {STEPS.map((_s, i) => (
                    <div key={i} style={{ width: i === step ? 18 : 7, height: 7, borderRadius: 4, transition: 'all .16s', background: i === step ? ac : (i < step ? 'rgba(58,52,43,0.35)' : 'rgba(58,52,43,0.16)') }} />
                  ))}
                </div>
                <div onClick={next} style={{ fontFamily: font.archivo, fontSize: 12, fontWeight: 700, color: chipInk, background: ab, border: 'none', borderRadius: 8, padding: '10px 22px', cursor: 'pointer', boxShadow: `0 4px 12px -4px ${pal.glow}` }}>{step < 6 ? L(WIZARD_UI.next, lang) : L(WIZARD_UI.seeResult, lang)}</div>
              </div>
            </>
          ) : (
            <>
              {/* ── RESULT ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, flex: 'none', display: 'grid', placeItems: 'center', background: ac, boxShadow: '0 3px 10px rgba(0,0,0,.22)' }}><WzIcon name="sparkle" size={19} color={chipInk} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: font.archivo, fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: pal.pInk2 }}>{L(WIZARD_UI.resultKicker, lang)}</div>
                  <input className="wz-title" value={titleVal} onChange={(e) => setTitleEdit(e.target.value)} style={{ width: '100%', marginTop: 2, border: 'none', background: 'transparent', fontSize: 23, fontWeight: 600, color: pal.pInk, padding: 0 }} />
                </div>
              </div>

              <div style={{ fontFamily: font.archivo, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: pal.pInk2, margin: '18px 0 8px' }}>{L(WIZARD_UI.adjLabel, lang)}</div>
              <div style={{ borderRadius: 11, overflow: 'hidden', border: '1px solid rgba(58,52,43,0.12)' }}>
                {summary.map((s, i) => (
                  <div key={s.roman} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', background: i % 2 ? 'rgba(58,52,43,0.03)' : 'transparent', ...(i < 6 ? { borderBottom: '1px solid rgba(58,52,43,0.08)' } : null) }}>
                    <div style={{ width: 26, height: 26, flex: 'none', borderRadius: 7, display: 'grid', placeItems: 'center', fontFamily: font.serif, fontSize: 12, fontWeight: 600, background: pal.paperCtl, color: ac }}>{s.roman}</div>
                    <div style={{ width: 104, flex: 'none', fontFamily: font.archivo, fontSize: 12, fontWeight: 600, color: pal.pInk }}>{s.name}</div>
                    <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {s.chips.map((c, k) => (
                        <span key={k} style={{ fontFamily: font.archivo, fontSize: 10.5, fontWeight: 500, color: pal.pInk, background: pal.paperCtl, borderRadius: 20, padding: '3px 10px' }}>{c}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── A/B transport ── */}
              <div style={{ marginTop: 16, borderRadius: 12, background: pal.panel, padding: '14px 15px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                  <span style={{ fontFamily: font.archivo, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: ab }}>{L(WIZARD_UI.abTitle, lang)}</span>
                  <span style={{ fontFamily: font.archivo, fontSize: 9.5, color: '#8a8070' }}>{L(WIZARD_UI.abNote, lang)}</span>
                </div>

                {!loaded ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, padding: '16px 0 8px' }}>
                    <div onClick={busy ? undefined : onLoad} style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: font.archivo, fontSize: 12, fontWeight: 600, color: ab, background: 'rgba(255,255,255,0.04)', border: `1px solid ${ac}`, borderRadius: 8, padding: '10px 20px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                      <WzIcon name="note" size={15} />{busy ? L(WIZARD_UI.decoding, lang) : L(WIZARD_UI.loadLabel, lang)}
                    </div>
                    <div style={{ fontFamily: font.archivo, fontSize: 11, color: loadError ? '#f06a82' : '#8a8070' }}>{loadError || L(WIZARD_UI.loadHint, lang)}</div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                      <WzIcon name="note" size={13} color={ab} />
                      <span style={{ fontFamily: font.archivo, fontSize: 12, fontWeight: 500, color: pal.nInk, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{loadedName}</span>
                      <span style={{ fontFamily: font.archivo, fontSize: 10, color: '#8a8070' }}>{loadedMeta}</span>
                    </div>
                    <div onClick={onSeek} style={{ height: 44, display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', padding: '2px 0' }}>
                      {wave.map((h, i) => {
                        const played = (i / wave.length) <= prog;
                        return <div key={i} style={{ flex: 1, height: `${(h * 100).toFixed(0)}%`, minHeight: 2, borderRadius: 2, background: played ? ab : '#3a444c', ...(played ? { boxShadow: `0 0 5px ${pal.glow}` } : null) }} />;
                      })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginTop: 9 }}>
                      <div onClick={onRewind} style={{ width: 28, height: 26, borderRadius: 6, display: 'grid', placeItems: 'center', background: '#222830', border: '1px solid #303841', cursor: 'pointer', color: '#9aa7af', fontSize: 11 }}>⏮</div>
                      <div onClick={onPlay} style={{ width: 34, height: 30, borderRadius: 7, display: 'grid', placeItems: 'center', background: ac, cursor: 'pointer', color: chipInk, fontSize: 13 }}>{playing ? '❚❚' : '▶'}</div>
                      <span style={{ fontFamily: font.archivo, fontSize: 11, color: '#c8cdd2' }}>{fmt(curTime)} <span style={{ color: '#6f7d86' }}>/ {fmt(dur)}</span></span>
                      <div style={{ flex: 1 }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: font.archivo, fontSize: 10.5, fontWeight: abSide === 'A' ? 700 : 500, color: abSide === 'A' ? ab : '#8a8070' }}>{L(WIZARD_UI.aLbl, lang)}</span>
                        <input type="range" className="wz-xf" min={0} max={100} value={xf} onChange={(e) => onXf(+e.target.value)} style={{ width: 130, backgroundImage: `linear-gradient(90deg,${ac} ${xf}%,#3a444c ${xf}%)` }} />
                        <span style={{ fontFamily: font.archivo, fontSize: 10.5, fontWeight: abSide === 'B' ? 700 : 500, color: abSide === 'B' ? ab : '#8a8070' }}>{L(WIZARD_UI.bLbl, lang)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* ── footer ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
                <div onClick={onReset} style={{ fontFamily: font.archivo, fontSize: 12, fontWeight: 600, color: pal.pInk2, border: '1px solid rgba(58,52,43,0.22)', borderRadius: 8, padding: '9px 16px', cursor: 'pointer' }}>{L(WIZARD_UI.reset, lang)}</div>
                <div style={{ flex: 1 }} />
                <div onClick={onApply} style={{ fontFamily: font.archivo, fontSize: 12, fontWeight: 600, color: ac, background: 'transparent', border: `1px solid ${ac}`, borderRadius: 8, padding: '9px 18px', cursor: 'pointer' }}>{L(WIZARD_UI.apply, lang)}</div>
                <div onClick={onSave} style={{ fontFamily: font.archivo, fontSize: 12, fontWeight: 700, color: chipInk, background: ab, border: 'none', borderRadius: 8, padding: '10px 22px', cursor: 'pointer' }}>{L(WIZARD_UI.save, lang)}</div>
              </div>
              {toast && <div style={{ marginTop: 12, textAlign: 'center', fontFamily: font.archivo, fontSize: 12, fontWeight: 600, color: ac }}>{toast}</div>}
            </>
          )}
        </div>
    </div>
  );
}

const ctrlBtn: CSSProperties = { width: 22, height: 20, borderRadius: 5, display: 'grid', placeItems: 'center', background: '#252b32', border: '1px solid #303841', cursor: 'pointer' };
