// FocusDAW Mastering Desk - Mastering Wizard 창 (#wizard, v0.13.0)
// 대화형 8단계로 마스터링 세팅을 자동 구성 → 결과 카드 → 창 내장 A/B 청취 →
// "메인에 즉시 적용"(sessionIO.apply) / "저장"([Wizard] 세션, sessionIO.save).
// 디자인 출처: _refer/Mastering Wizard.standalone.html. 오디오는 이 창 자체의 previewEngine 인스턴스로
// 독립 디코딩/재생한다(메인 스토어 미의존 — 별도 렌더러이므로 AudioContext 도 분리됨).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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

const WAVE_BARS = 128;

const OPTION_PREVIEWS: Record<string, number[]> = {
  pop: [.5, .6, .7, .8, .75, .7, .65, .6, .55],
  dance: [.9, .95, .7, .5, .5, .55, .6, .7, .78],
  rock: [.55, .6, .7, .85, .9, .8, .7, .6, .5],
  classic: [.5, .5, .55, .6, .6, .58, .55, .5, .45],
  hiphop: [.95, .9, .75, .55, .45, .4, .4, .45, .5],
  bright: [.4, .45, .5, .55, .6, .7, .8, .9, .95],
  warm: [.9, .85, .75, .65, .55, .5, .45, .4, .35],
  punchy: [.85, .4, .9, .4, .95, .4, .88, .4, .82],
  smooth: [.55, .56, .55, .57, .56, .55, .56, .55, .56],
  light: [.35, .4, .5, .6, .65, .65, .6, .55, .5],
  normal: [.6, .62, .63, .62, .6, .6, .58, .56, .55],
  thick: [.95, .9, .8, .65, .55, .5, .48, .46, .45],
  dynamic: [.5, .7, .4, .8, .55, .75, .45, .65, .5],
  balanced: [.7, .8, .72, .85, .78, .82, .74, .8, .72],
  loud: [.9, .95, .92, .96, .9, .94, .9, .95, .9],
  clean: [.45, .5, .55, .5, .52, .5, .48, .5, .46],
  slight: [.5, .6, .55, .7, .6, .68, .55, .62, .5],
  noisy: [.7, .85, .75, .9, .8, .88, .78, .86, .75],
  streaming: [.6, .7, .65, .72, .68, .7, .66, .7, .64],
  archive: [.55, .62, .6, .66, .62, .64, .6, .64, .58],
  video: [.58, .66, .62, .68, .64, .66, .62, .66, .6],
};

const STEREO_SPREAD: Record<string, number> = { dry: .16, subtle: .5, wide: .86 };

function plainLines(a: WizardAnswers, lang: Lang) {
  const en = lang === 'en';
  const genre = (en
    ? { pop: 'Pop', dance: 'dance', rock: 'rock', classic: 'classical', hiphop: 'hip-hop' }
    : { pop: '팝', dance: '댄스', rock: '록', classic: '클래식', hiphop: '힙합' })[a.genre];
  const lines = [
    { key: 'genre', text: en ? `Tuned the base tone for a ${genre} track.` : `${genre} 곡에 맞춰 기본 톤을 잡았어요.` },
    { key: 'eqMode', text: a.eqMode === 'graphic' ? (en ? 'Shaped it clearly with 9-Band EQ.' : '9-Band EQ로 주파수 효과를 확실하게 잡았어요.') : (en ? 'Fine-tuned it naturally with Min-EQ.' : 'Min-EQ로 사실적이고 정밀하게 다듬었어요.') },
    { key: 'mood', text: ({ bright: en ? 'Made it bright and airy up top.' : '위쪽을 밝고 청량하게 다듬었어요.', warm: en ? 'Warmed it up, soft and rich.' : '따뜻하고 포근한 색을 입혔어요.', punchy: en ? 'Gave it a bold, punchy energy.' : '힘 있고 단단한 에너지를 더했어요.', smooth: en ? 'Kept it smooth and natural.' : '부드럽고 담백하게 유지했어요.' })[a.mood] },
    { key: 'bass', text: ({ light: en ? 'Kept the bass light and clean.' : '저음은 가볍고 산뜻하게 했어요.', normal: en ? 'Balanced the bass just right.' : '저음은 적당한 밸런스로 맞췄어요.', thick: en ? 'Made the low end full and heavy.' : '저음을 묵직하고 꽉 차게 했어요.' })[a.bass] },
    { key: 'space', text: ({ dry: en ? 'Kept it close and direct.' : '또렷하고 가깝게 들리도록 했어요.', subtle: en ? 'Added a gentle sense of space.' : '은은한 공간감을 살짝 더했어요.', wide: en ? 'Opened it up nice and wide.' : '좌우로 넓고 시원하게 펼쳤어요.' })[a.space] },
    { key: 'loudness', text: ({ dynamic: en ? 'Kept the natural dynamics.' : '음량을 무리하지 않고 자연스럽게 뒀어요.', balanced: en ? 'Set a loudness that fits streaming.' : '스트리밍에 맞는 음량으로 맞췄어요.', loud: en ? 'Pushed it big and loud.' : '어디서든 시원하게 크도록 키웠어요.' })[a.loudness] },
    { key: 'output', text: ({ streaming: en ? 'Ready to export as WAV for streaming & video.' : '스트리밍·영상용 WAV 파일로 내보낼 준비가 됐어요.', archive: en ? 'Ready to export as FLAC for CD / archive.' : 'CD·소장용 FLAC 파일로 내보낼 준비가 됐어요.', video: en ? 'Ready to export as WAV for video editing.' : '영상 편집용 WAV 파일로 내보낼 준비가 됐어요.' })[a.output] },
  ];
  return lines.map((line) => ({
    ...line,
    icon: STEPS.find((s) => s.key === line.key)?.opts.find((o) => o.v === a[line.key as StepKey])?.icon || 'sparkle',
  }));
}

/** AudioBuffer 채널0에서 세밀한 피크 막대(0..1)를 뽑는다. */
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastFitHeightRef = useRef(0);

  // ── A/B 트랜스포트 상태 ──
  const [loaded, setLoaded] = useState(false);
  const [loadedName, setLoadedName] = useState('');
  const [loadedMeta, setLoadedMeta] = useState('');
  const [wave, setWave] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [xf, setXf] = useState(100); // 0=A(원본) … 100=B(Wizard)
  const [volume, setVolume] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: 'apply' | 'save' } | null>(null);

  const bufferRef = useRef<AudioBuffer | null>(null);
  const metaRef = useRef<AudioMeta | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pal = THEMES[theme] || THEMES.Teal;
  const ac = pal.aMain, ab = pal.aBright, chipInk = inkOn(pal.aMain);

  const payload = useMemo<SessionPayload>(() => answersToPayload(answers), [answers]);
  const summary = useMemo(() => buildSummary(answers, lang), [answers, lang]);
  const titleVal = titleEdit ?? autoTitle(answers, lang);

  // 초기 테마/메인 모니터 볼륨 취득 + 브로드캐스트 구독.
  useEffect(() => {
    void window.focusdaw?.win?.getWizardContext?.().then((context) => {
      if (!context) return;
      if (context.theme) setTheme(context.theme as ThemeName);
      const initialVolume = Math.max(0, Math.min(1, context.volume));
      setVolume(initialVolume);
      previewEngine.setVolume(initialVolume);
    });
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

  const showToast = (message: string, kind: 'apply' | 'save') => {
    setToast({ message, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  // ── 네비게이션 ──
  const pick = (k: StepKey, v: string) => setAnswers((a) => ({ ...a, [k]: v }) as WizardAnswers);
  const next = () => { if (step < STEPS.length - 1) setStep(step + 1); else setPhase('result'); };
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
  const onVolume = (val: number) => {
    const nextVolume = Math.max(0, Math.min(1, val));
    setVolume(nextVolume);
    previewEngine.setVolume(nextVolume);
  };

  // ── 적용 / 저장 ──
  const onApply = async () => {
    const res = await window.focusdaw?.sessionIO?.apply?.(payload);
    showToast(res?.ok === false ? (res.error || 'Apply failed') : L(WIZARD_UI.applied, lang), 'apply');
  };
  const onSave = async () => {
    const genreName = (lang === 'en'
      ? {
          pop: 'Pop',
          dance: 'Dance',
          rock: 'Rock',
          classic: 'Classical',
          hiphop: 'HipHop',
        }
      : {
          pop: '팝',
          dance: '댄스',
          rock: '록',
          classic: '클래식',
          hiphop: '힙합',
        })[answers.genre];
    const sessions = await window.focusdaw?.sessionIO?.list?.() ?? [];
    const usedNumbers = new Set(
      sessions
        .map((session) => new RegExp(`^${genreName}\\s*(\\d+)$`).exec(session.name)?.[1])
        .filter((number): number is string => !!number)
        .map(Number),
    );
    let serial = 1;
    while (usedNumbers.has(serial)) serial++;
    const sessionName = `${genreName}${serial}`;
    const res = await window.focusdaw?.sessionIO?.save?.({
      name: sessionName, description: titleVal, payload, appVersion: APP_VERSION,
    });
    showToast(
      res?.ok
        ? (lang === 'ko' ? `세션으로 저장했어요: ${sessionName} ✓` : `Saved as session: ${sessionName} ✓`)
        : `${L(WIZARD_UI.saveFail, lang)}: ${res?.error || ''}`,
      'save',
    );
  };
  const onReset = () => {
    previewEngine.stop();
    setPlaying(false);
    setCurTime(0);
    setPhase('quiz');
    setStep(0);
    setAnswers(DEFAULT_ANSWERS);
    setTitleEdit(null);
    setShowAdvanced(false);
  };

  // ══════════════════ 렌더 ══════════════════
  const stepDef = STEPS[step];
  const sel = answers[stepDef.key];
  const afterEnabled = xf >= 50;
  const prog = dur > 0 ? curTime / dur : 0;

  const font = { archivo: "'Archivo','Noto Sans KR',system-ui,sans-serif", serif: "'Spectral','Noto Serif KR',serif" };
  const paperBg = `linear-gradient(180deg,${pal.paperA},${pal.paperB})`;

  const plain = useMemo(() => plainLines(answers, lang), [answers, lang]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    const fit = () => {
      if (!content || !window.focusdaw?.win?.fitWizardHeight) return;
      // title bar 44px + paper margin 32px + paper padding 64px + 실제 내용.
      const desired = 44 + 32 + 64 + content.scrollHeight;
      if (Math.abs(lastFitHeightRef.current - desired) < 2) return;
      lastFitHeightRef.current = desired;
      window.focusdaw.win.fitWizardHeight(desired);
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [step, phase, lang, showAdvanced, loaded, busy, loadError]);

  return (
    // 프레임리스 창 전체를 채우는 실제 윈도우 프레임(참조의 바깥 캔버스/여백 제거).
    <div style={{ position: 'fixed', inset: 0, background: pal.frame, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <WizardSprite />
      <style>{`
        @keyframes wzrise{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
        .wz-anim{animation:wzrise .34s cubic-bezier(.2,.7,.2,1) both}
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
          <button
            className="app-no-drag"
            onClick={onReset}
            style={{ border: 0, padding: '3px 7px', background: 'transparent', color: '#7f8b94', fontFamily: font.archivo, fontSize: 10.5, cursor: 'pointer' }}
          >
            {lang === 'ko' ? '처음부터시작' : 'Start over'}
          </button>
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

        {/* ── paper sheet (창 높이를 넘치면 잘리지 않고 스크롤) ── */}
        <div className="wz-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', margin: 16, borderRadius: 16, background: paperBg, boxShadow: '0 12px 34px -14px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.6)', padding: '30px 40px 34px', boxSizing: 'border-box' }}>
          <div ref={contentRef}>

          {phase === 'quiz' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontFamily: font.serif, fontSize: 15, fontWeight: 600, color: ac, whiteSpace: 'nowrap' }}>{lang === 'ko' ? `질문 ${step + 1} / ${STEPS.length}` : `Question ${step + 1} of ${STEPS.length}`}</span>
                <div style={{ flex: 1, display: 'flex', gap: 5 }}>
                  {STEPS.map((s, i) => <div key={s.key} style={{ flex: 1, height: 6, borderRadius: 4, background: i <= step ? ac : 'rgba(58,52,43,0.16)', ...(i === step ? { boxShadow: `0 0 8px ${pal.glow}` } : null) }} />)}
                </div>
                <span style={{ fontFamily: font.archivo, fontSize: 11, fontWeight: 600, color: pal.pInk2, whiteSpace: 'nowrap' }}>{L(stepDef.label, lang)}</span>
              </div>

              <div className="wz-anim" key={step} style={{ marginTop: 26 }}>
              <div style={{ fontFamily: font.serif, fontSize: 30, fontWeight: 600, color: pal.pInk, lineHeight: 1.2 }}>{L(stepDef.q, lang)}</div>
              <div style={{ fontFamily: font.archivo, fontSize: 14, color: pal.pInk2, marginTop: 9, lineHeight: 1.55, maxWidth: 640 }}>{L(stepDef.sub, lang)}</div>

              <div style={{ display: 'grid', gap: 12, marginTop: 22, gridTemplateColumns: `repeat(${stepDef.cols === 1 ? 1 : Math.min(stepDef.cols, 3)},1fr)` }}>
                {stepDef.opts.map((o, i) => {
                  const on = o.v === sel;
                  const spanFull = stepDef.cols === 1 && stepDef.opts.length === 5 && i === 4;
                  const bars = OPTION_PREVIEWS[o.v] || OPTION_PREVIEWS.normal;
                  const spread = STEREO_SPREAD[o.v];
                  const cardStyle: CSSProperties = {
                    position: 'relative', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px',
                    borderRadius: 14, cursor: 'pointer',
                    ...(spanFull ? { gridColumn: '1 / -1' } : null),
                    ...(on
                      ? { backgroundImage: `linear-gradient(180deg,${pal.cardSelA},${pal.cardSelB})`, border: `2px solid ${ac}`, boxShadow: `0 0 0 3px ${pal.glow},0 10px 22px -12px ${pal.glow}` }
                      : { backgroundImage: `linear-gradient(180deg,${pal.cardA},${pal.cardB})`, border: '2px solid transparent', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)' }),
                  };
                  return (
                    <div key={o.v} className="wz-card" onClick={() => pick(stepDef.key, o.v)} style={cardStyle}>
                      <div style={{ width: 64, height: 48, flex: 'none', borderRadius: 10, padding: 8, boxSizing: 'border-box', background: pal.paperCtl, overflow: 'hidden' }}>
                        {stepDef.key === 'eqMode' ? (
                          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: on ? ac : pal.pInk2 }}>
                            <WzIcon name={o.icon} size={31} />
                          </div>
                        ) : stepDef.key === 'space' ? (
                          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
                            <div style={{ position: 'absolute', left: 6, right: 6, top: '50%', height: 2, background: 'rgba(0,0,0,.12)' }} />
                            {[50 - spread * 42, 50 + spread * 42].map((left) => <div key={left} style={{ position: 'absolute', left: `${left}%`, top: '50%', width: 11, height: 11, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: on ? ac : pal.pInk2, boxShadow: `0 0 0 3px ${pal.paperCtl}` }} />)}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, width: '100%', height: '100%' }}>
                            {bars.map((h, k) => <div key={k} style={{ flex: 1, height: `${h * 100}%`, minHeight: 3, borderRadius: 2, background: on || h > .7 ? ac : pal.pInk2, opacity: on ? 1 : h > .7 ? .9 : .4 }} />)}
                          </div>
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: font.archivo, fontSize: 16, fontWeight: 700, color: pal.pInk }}>{L(o.t, lang)}</span>
                          {o.rec && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: font.archivo, fontSize: 10, fontWeight: 700, color: chipInk, background: ac, borderRadius: 20, padding: '2px 9px' }}><WzIcon name="heart" size={10} />{L(WIZARD_UI.rec, lang)}</span>}
                        </div>
                        <div style={{ fontFamily: font.archivo, fontSize: 13, color: pal.pInk2, marginTop: 5, lineHeight: 1.45 }}>{L(o.d, lang)}</div>
                      </div>
                      <div style={{ width: 26, height: 26, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', ...(on ? { background: ac, color: chipInk } : { border: `2px solid ${pal.paperCtl}`, color: 'transparent' }) }}><WzIcon name="check" size={15} /></div>
                    </div>
                  );
                })}
              </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', marginTop: 26 }}>
                <div onClick={back} style={{ fontFamily: font.archivo, fontSize: 13, fontWeight: 600, borderRadius: 9, padding: '11px 20px', ...(step === 0 ? { color: 'rgba(58,52,43,0.28)', border: '1px solid rgba(58,52,43,0.1)', pointerEvents: 'none' } : { color: pal.pInk2, border: '1px solid rgba(58,52,43,0.22)', cursor: 'pointer' }) }}>{L(WIZARD_UI.back, lang)}</div>
                <div style={{ flex: 1 }} />
                <div onClick={next} style={{ fontFamily: font.archivo, fontSize: 14, fontWeight: 700, color: chipInk, background: ab, borderRadius: 10, padding: '12px 32px', cursor: 'pointer', boxShadow: `0 6px 16px -5px ${pal.glow}` }}>{L(step < STEPS.length - 1 ? WIZARD_UI.next : WIZARD_UI.seeResult, lang)}</div>
              </div>
            </>
          ) : (
            <>
              {/* ── RESULT ── */}
              <div className="wz-anim" style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, flex: 'none', display: 'grid', placeItems: 'center', background: ac, boxShadow: `0 5px 14px -4px ${pal.glow}` }}><WzIcon name="sparkle" size={24} color={chipInk} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: font.archivo, fontSize: 13, fontWeight: 600, color: pal.pInk2 }}>{lang === 'ko' ? '다 됐어요! 이렇게 다듬어 드릴게요' : 'All set — here is how we will polish it'}</div>
                  <input className="wz-title" value={titleVal} onChange={(e) => setTitleEdit(e.target.value)} style={{ width: '100%', marginTop: 2, border: 'none', background: 'transparent', fontSize: 26, fontWeight: 600, color: pal.pInk, padding: 0 }} />
                </div>
              </div>

              <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px 22px' }}>
                {plain.map((p) => (
                  <div key={p.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                    <div style={{ width: 32, height: 32, flex: 'none', borderRadius: 9, display: 'grid', placeItems: 'center', background: pal.paperCtl, color: ac }}><WzIcon name={p.icon} size={17} /></div>
                    <div style={{ fontFamily: font.archivo, fontSize: 13.5, color: pal.pInk, lineHeight: 1.45, paddingTop: 5 }}>{p.text}</div>
                  </div>
                ))}
              </div>

              <div onClick={() => setShowAdvanced((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 18, fontFamily: font.archivo, fontSize: 12, fontWeight: 600, color: pal.pInk2, cursor: 'pointer', userSelect: 'none' }}>
                <span style={{ display: 'inline-block', transition: 'transform .16s', transform: `rotate(${showAdvanced ? 90 : 0}deg)` }}>▸</span>
                {showAdvanced ? (lang === 'ko' ? '고급 설정 접기' : 'Hide advanced settings') : (lang === 'ko' ? '고급 설정 자세히 보기' : 'Show advanced settings')}
              </div>
              {showAdvanced && <div style={{ marginTop: 11, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(58,52,43,0.12)' }}>
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
              </div>}

              {/* ── A/B transport ── */}
              <div style={{ marginTop: 16, borderRadius: 12, background: pal.panel, padding: '14px 15px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ fontFamily: font.archivo, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: ab }}>{L(WIZARD_UI.abTitle, lang)}</span>
                    {loaded && (
                      <button
                        onClick={busy ? undefined : onLoad}
                        style={{ border: `1px solid ${ac}`, borderRadius: 6, padding: '3px 8px', background: 'transparent', color: ab, fontFamily: font.archivo, fontSize: 9.5, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}
                      >
                        {lang === 'ko' ? '다시 불러오기' : 'Reload'}
                      </button>
                    )}
                  </div>
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
                    <div onClick={onSeek} style={{ height: 54, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', padding: '2px 0' }}>
                      {wave.map((h, i) => {
                        const played = (i / wave.length) <= prog;
                        return <div key={i} style={{ flex: 1, height: `${(h * 100).toFixed(0)}%`, minHeight: 2, borderRadius: 2, background: played ? ab : '#3a444c', ...(played ? { boxShadow: `0 0 5px ${pal.glow}` } : null) }} />;
                      })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 9 }}>
                      <div onClick={onRewind} style={{ width: 28, height: 26, borderRadius: 6, display: 'grid', placeItems: 'center', background: '#222830', border: '1px solid #303841', cursor: 'pointer', color: '#9aa7af', fontSize: 11 }}>⏮</div>
                      <div onClick={onPlay} style={{ width: 34, height: 30, borderRadius: 7, display: 'grid', placeItems: 'center', background: ac, cursor: 'pointer', color: chipInk, fontSize: 13 }}>{playing ? '❚❚' : '▶'}</div>
                      <span style={{ fontFamily: font.archivo, fontSize: 9.5, fontWeight: 700, color: '#8a8070', marginLeft: 5 }}>VOL</span>
                      <input
                        type="range"
                        className="wz-xf"
                        min={0}
                        max={100}
                        value={Math.round(volume * 100)}
                        onChange={(e) => onVolume(Number(e.target.value) / 100)}
                        style={{ width: 112, backgroundImage: `linear-gradient(90deg,${ac} ${Math.round(volume * 100)}%,#3a444c ${Math.round(volume * 100)}%)` }}
                      />
                      <span style={{ width: 26, fontFamily: font.archivo, fontSize: 10.5, color: '#9aa7af', textAlign: 'right' }}>{Math.round(volume * 100)}</span>
                      <span style={{ fontFamily: font.archivo, fontSize: 11, color: '#c8cdd2' }}>{fmt(curTime)} <span style={{ color: '#6f7d86' }}>/ {fmt(dur)}</span></span>
                      <div style={{ flex: 1 }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 42, fontFamily: font.archivo, fontSize: 10.5, fontWeight: afterEnabled ? 500 : 700, color: afterEnabled ? '#8a8070' : ab, textAlign: 'right' }}>{L(WIZARD_UI.aLbl, lang)}</span>
                        <div
                          onClick={() => onXf(afterEnabled ? 0 : 100)}
                          role="switch"
                          aria-checked={afterEnabled}
                          style={{ position: 'relative', width: 48, height: 24, flex: 'none', borderRadius: 13, background: afterEnabled ? ac : '#3a444c', border: '1px solid #4b555e', cursor: 'pointer', transition: 'background .16s' }}
                        >
                          <div style={{ position: 'absolute', top: 3, left: afterEnabled ? 27 : 3, width: 16, height: 16, borderRadius: '50%', background: '#f6f2e8', boxShadow: '0 1px 4px rgba(0,0,0,.5)', transition: 'left .16s' }} />
                        </div>
                        <span style={{ width: 34, fontFamily: font.archivo, fontSize: 10.5, fontWeight: afterEnabled ? 700 : 500, color: afterEnabled ? ab : '#8a8070' }}>{L(WIZARD_UI.bLbl, lang)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* ── footer ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
                <div onClick={onReset} style={{ fontFamily: font.archivo, fontSize: 12, fontWeight: 600, color: pal.pInk2, border: '1px solid rgba(58,52,43,0.22)', borderRadius: 8, padding: '9px 16px', cursor: 'pointer' }}>{L(WIZARD_UI.reset, lang)}</div>
                <div onClick={onApply} style={{ fontFamily: font.archivo, fontSize: 12, fontWeight: 600, color: ac, background: 'transparent', border: `1px solid ${ac}`, borderRadius: 8, padding: '9px 18px', cursor: 'pointer' }}>{L(WIZARD_UI.apply, lang)}</div>
                <div onClick={onSave} style={{ fontFamily: font.archivo, fontSize: 12, fontWeight: 700, color: chipInk, background: ab, border: 'none', borderRadius: 8, padding: '10px 22px', cursor: 'pointer' }}>{L(WIZARD_UI.save, lang)}</div>
                <div style={{ flex: 1 }} />
                {toast && <span style={{ minWidth: 0, fontFamily: font.archivo, fontSize: 11, fontWeight: 600, color: ac, textAlign: 'right' }}>{toast.message}</span>}
              </div>
            </>
          )}
          </div>
        </div>
    </div>
  );
}

const ctrlBtn: CSSProperties = { width: 22, height: 20, borderRadius: 5, display: 'grid', placeItems: 'center', background: '#252b32', border: '1px solid #303841', cursor: 'pointer' };
