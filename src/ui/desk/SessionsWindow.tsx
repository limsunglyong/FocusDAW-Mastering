// FocusDAW Mastering Desk v0.9.0 - 세션(프로젝트) 저장/불러오기 창
// 별도 borderless 자식 창(#sessions). 마스터링 체인 설정(Preset형)을 카드 형식으로 저장/불러오기.
// - Save 모드: 메인 창이 전달한 현재 직렬화 세션(payload)을 이름 붙여 저장 + 기존 세션 덮어쓰기.
// - Load 모드: 저장된 세션 카드 선택 → 메인 창에 적용(IPC 릴레이).
import { useEffect, useMemo, useState, type ReactNode, type CSSProperties } from 'react';
import { MODS } from '../../desk/data';
import { THEMES, type ThemeName } from '../../theme/themes';
import { APP_VERSION } from '../../version';
import { exportFolderLabel, isDenoiseActive, type SessionPayload, type SessionSummary } from '../../session/session';

type Mode = 'save' | 'load';

function summaryFromPayload(name: string, description: string, payload: SessionPayload): SessionSummary {
  const v = payload.vals;
  return {
    id: '',
    name: name || '(current)',
    description,
    savedAt: Date.now(),
    appVersion: APP_VERSION,
    enabled: payload.enabled,
    denoise: isDenoiseActive(payload),
    eqMode: v['spectral.mode'] === '9-Band' ? '9-Band' : 'Parametric',
    eqPreset: v['spectral.mode'] === '9-Band'
      ? String(v['spectral.graphic.preset'] ?? 'Normal')
      : String(v['spectral.preset'] ?? '—'),
    lufs: typeof v['loudness.target'] === 'number' ? (v['loudness.target'] as number) : NaN,
    format: String(v['export.format'] ?? '—'),
    rate: String(v['input.rate'] ?? '—'),
    bit: String(v['input.bit'] ?? '—'),
    hasArtwork: !!payload.artworkDataUrl,
    exportDir: payload.exportDir ?? null,
    album: String(v['export.album'] ?? ''),
  };
}

function fmtDate(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SessionsWindow() {
  const [theme, setTheme] = useState<ThemeName>('Teal');
  const [mode, setMode] = useState<Mode>('load');
  const [payload, setPayload] = useState<SessionPayload | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [list, setList] = useState<SessionSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const io = window.focusdaw?.sessionIO;
  const pal = THEMES[theme] || THEMES.Teal;
  const dark = theme.includes('Light') ? pal.aMain : pal.aInk;

  const refresh = useMemo(
    () => async () => {
      if (!io) return;
      try {
        setList(await io.list());
      } catch {
        setList([]);
      }
    },
    [io],
  );

  // 마운트: 컨텍스트(mode/payload/theme) 취득 + 목록 로드. 재오픈 시 컨텍스트 갱신 구독.
  useEffect(() => {
    let alive = true;
    (async () => {
      const ctx = await io?.getContext?.();
      if (!alive || !ctx) return;
      setMode(ctx.mode);
      setPayload((ctx.payload as SessionPayload) || null);
      if (ctx.theme) setTheme(ctx.theme as ThemeName);
      if (ctx.payload) setName((ctx.payload as SessionPayload).vals['export.album'] ? String((ctx.payload as SessionPayload).vals['export.album']) : '');
    })();
    void refresh();
    const unsub = io?.onContextUpdated?.((ctx) => {
      setMode(ctx.mode);
      setPayload((ctx.payload as SessionPayload) || null);
      if (ctx.theme) setTheme(ctx.theme as ThemeName);
      void refresh();
    });
    const unsubTheme = window.focusdaw?.win?.onThemeUpdated?.((t) => setTheme(t as ThemeName));
    return () => {
      alive = false;
      unsub?.();
      unsubTheme?.();
    };
  }, [io, refresh]);

  // 테마 CSS 변수 주입(독립 창).
  useEffect(() => {
    import('../../theme/themes').then(({ applyTheme }) => applyTheme(theme));
  }, [theme]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const doSave = async (overwriteId?: string, overwriteName?: string) => {
    if (!io || !payload || busy) return;
    const finalName = (overwriteName ?? name).trim() || 'Untitled Session';
    setBusy(true);
    try {
      const res = await io.save({ id: overwriteId, name: finalName, description: description.trim(), payload, appVersion: APP_VERSION });
      if (res.ok) {
        flash('Session saved.');
        await refresh();
      } else {
        flash(res.error || 'Save failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  const doLoad = async (id: string) => {
    if (!io || busy) return;
    setBusy(true);
    try {
      const file = await io.read(id);
      if (!file?.payload) {
        flash('Could not read session.');
        return;
      }
      const res = await io.apply(file.payload);
      if (res.ok) window.focusdaw?.win?.close?.();
      else flash(res.error || 'Apply failed.');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (id: string) => {
    if (!io) return;
    await io.delete(id);
    setConfirmDelete(null);
    await refresh();
  };

  const close = () => window.focusdaw?.win?.close?.();
  const previewSummary = payload ? summaryFromPayload(name, description, payload) : null;

  // ── 카드 렌더 ──
  const Card = ({
    s,
    action,
  }: {
    s: SessionSummary;
    action: ReactNode;
  }) => (
    <div
      style={{
        background: '#efe7d6',
        border: '1px solid #b5ae9f',
        borderRadius: 10,
        padding: '11px 13px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        height: '100%',
        boxSizing: 'border-box',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: 'Spectral, serif', fontSize: 14.5, fontWeight: 700, color: '#3a342c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.name}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: '#8a8170', flex: 'none' }}>{fmtDate(s.savedAt)}</span>
      </div>

      {/* 세부 설명 (있을 때만) */}
      {s.description && (
        <div style={{ fontSize: 10.5, color: '#6b6353', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 46, overflow: 'hidden' }}>
          {s.description}
        </div>
      )}

      {/* 모듈 칩 (켜진 모듈 = accent, Bypass = 회색) + Denoise on/off */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {MODS.filter((m) => m.id !== 'input' && m.id !== 'export').map((m) => {
          const on = s.enabled?.[m.id] !== false;
          const chip = (label: string, active: boolean) => (
            <span
              key={label}
              style={{
                fontFamily: 'Archivo',
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: '0.02em',
                padding: '2px 7px',
                borderRadius: 20,
                color: active ? (theme.includes('Light') ? '#fff' : dark) : '#9b927f',
                background: active ? `${dark}22` : '#dcd3c0',
                border: `1px solid ${active ? `${dark}55` : '#cabfa9'}`,
              }}
            >
              {label}
            </span>
          );
          // Pre 칩 바로 뒤에 Denoise on/off 칩을 덧붙여 표시.
          if (m.id === 'pre') {
            return [
              chip(m.short, on),
              chip(`Denoise ${s.denoise ? 'On' : 'Off'}`, s.denoise),
            ];
          }
          if (m.id === 'spectral') return chip(s.eqMode === '9-Band' ? '9-EQ' : 'Min-EQ', on);
          return chip(m.short, on);
        })}
      </div>

      {/* 요약 라인 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontFamily: 'var(--mono)', fontSize: 10, color: '#5a5347' }}>
        <span>{s.eqMode === '9-Band' ? 'EQ 9-band' : 'EQ Min-φ'} · {s.eqPreset}</span>
        <span>{Number.isFinite(s.lufs) ? `${s.lufs} LUFS` : '— LUFS'}</span>
        <span>{s.format} · {s.rate}/{s.bit}</span>
        {s.hasArtwork && <span style={{ color: dark }}>● art</span>}
      </div>

      {/* 작업 폴더 (Export 출력 위치) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--mono)', fontSize: 9.5, color: '#7a7163', overflow: 'hidden' }}>
        <span style={{ flex: 'none', opacity: 0.7 }}>📁</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left' }} title={exportFolderLabel(s.exportDir, s.album)}>
          {exportFolderLabel(s.exportDir, s.album)}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 'auto', paddingTop: 4 }}>{action}</div>
    </div>
  );

  const btn = (bg: string, fg: string, border: string): CSSProperties => ({
    padding: '3px 14px',
    borderRadius: 6,
    border: `1px solid ${border}`,
    background: bg,
    color: fg,
    fontFamily: '"Segoe UI", sans-serif',
    fontSize: 11,
    fontWeight: 700,
    cursor: busy ? 'default' : 'pointer',
    opacity: busy ? 0.6 : 1,
    outline: 'none',
  });

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#c9c3b8',
        border: '1px solid #9fa2a6',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        color: '#3a342c',
        overflow: 'hidden',
      }}
    >
      {/* Title bar */}
      <div
        className="app-drag"
        style={{ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', background: '#bdb6a9', borderBottom: '1px solid #a8aeb2', flex: 'none', userSelect: 'none' }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>
          {mode === 'save' ? 'SAVE SESSION' : 'OPEN SESSION'}
        </span>
        <div
          className="app-no-drag"
          onClick={close}
          style={{ width: 22, height: 20, borderRadius: 4, display: 'grid', placeItems: 'center', color: '#5a5347', fontSize: 16, cursor: 'pointer' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ff4d5e'; e.currentTarget.style.background = 'rgba(255,77,94,0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#5a5347'; e.currentTarget.style.background = 'transparent'; }}
        >
          ×
        </div>
      </div>

      {/* Save 패널 (저장 모드 + payload 존재 시) */}
      {mode === 'save' && previewSummary && (
        <div style={{ flex: 'none', padding: '12px 16px 10px', borderBottom: '1px solid #b3ac9e', background: '#c4bdb1' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Card
                s={previewSummary}
                action={
                  <button className="app-no-drag" style={btn(dark, theme.includes('Light') ? '#fff' : '#efe7d6', dark)} onClick={() => doSave()} disabled={busy}>
                    SAVE AS NEW
                  </button>
                }
              />
            </div>
            <div style={{ width: 248, flex: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 }}>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: '#5a5347' }}>Session name</label>
              <input
                className="app-no-drag"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void doSave(); }}
                placeholder="Untitled Session"
                style={{ padding: '6px 9px', borderRadius: 6, border: '1px solid #a8a092', background: '#f7f1e5', color: '#3a342c', fontSize: 12, outline: 'none' }}
              />
              <label style={{ fontSize: 10.5, fontWeight: 700, color: '#5a5347', marginTop: 1 }}>Description</label>
              <textarea
                className="app-no-drag"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes about this chain (optional)"
                rows={2}
                style={{ padding: '6px 9px', borderRadius: 6, border: '1px solid #a8a092', background: '#f7f1e5', color: '#3a342c', fontSize: 11, lineHeight: 1.4, outline: 'none', resize: 'none', fontFamily: '"Segoe UI", sans-serif' }}
              />
              <span style={{ fontSize: 9.5, color: '#8a8170', lineHeight: 1.4 }}>
                마스터링 체인 설정만 저장됩니다(파일 큐·곡별 denoise 제외).
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 저장된 세션 목록 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#6b6353', letterSpacing: '0.04em', marginBottom: 8 }}>
          SAVED SESSIONS ({list.length})
        </div>
        {list.length === 0 ? (
          <div style={{ padding: '34px 0', textAlign: 'center', color: '#8a8170', fontSize: 12 }}>
            No saved sessions yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 11 }}>
            {list.map((s) => (
              <Card
                key={s.id}
                s={s}
                action={
                  confirmDelete === s.id ? (
                    <>
                      <button className="app-no-drag" style={btn('#f0d6d6', '#a3344b', '#d99')} onClick={() => doDelete(s.id)}>DELETE</button>
                      <button className="app-no-drag" style={btn('transparent', '#5a5347', '#b5ae9f')} onClick={() => setConfirmDelete(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="app-no-drag" style={btn('transparent', '#8a5347', '#cbb9b0')} onClick={() => setConfirmDelete(s.id)}>×</button>
                      {mode === 'save' ? (
                        <button className="app-no-drag" style={btn(`${dark}14`, dark, dark)} onClick={() => doSave(s.id, s.name)} disabled={busy}>OVERWRITE</button>
                      ) : (
                        <button className="app-no-drag" style={btn(dark, theme.includes('Light') ? '#fff' : '#efe7d6', dark)} onClick={() => doLoad(s.id)} disabled={busy}>LOAD</button>
                      )}
                    </>
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', background: '#3a342c', color: '#efe7d6', fontSize: 11, fontWeight: 600, padding: '6px 16px', borderRadius: 20, boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
