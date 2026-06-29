// FocusDAW Mastering Desk v0.9.1 - Render Batch 창 (모달)
// 세션(프로젝트) 설정으로 파일/폴더를 일괄 Export. 좌=소스, 우=출력, 가운데=세로 진행바.
// 메인 앱은 모달로 차단(요구사항 7). 세션은 카드로 불러오고 출력 폴더를 변경할 수 있다.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { MODS } from '../../desk/data';
import { THEMES, type ThemeName } from '../../theme/themes';
import { openAudioFilePicker, audioFilesFromDataTransfer } from '../../audio/filePicker';
import { formatBytes } from '../../audio/queueFile';
import { exportFolderLabel, isDenoiseActive, type SessionPayload, type SessionSummary } from '../../session/session';
import { renderFileWithSession, outputExt, MASTERED_PREFIX, type BatchStage } from '../../export/batchRunner';

type SourceItem = { id: string; name: string; bytes: number; file: File };
type OutState = 'waiting' | 'processing' | 'done' | 'error' | 'cancelled';
type OutStatus = { state: OutState; ext: string; error?: string; path?: string; stage?: BatchStage };

const STAGE_LABEL: Record<BatchStage, string> = {
  decoding: 'Decoding…',
  analyzing: 'Analyzing noise…',
  denoising: 'Denoising…',
  rendering: 'Rendering…',
};

type LoadedSession = { id: string; name: string; summary: SessionSummary; payload: SessionPayload };

function summarize(name: string, payload: SessionPayload): SessionSummary {
  const v = payload.vals;
  return {
    id: '', name, description: '', savedAt: 0, appVersion: '',
    enabled: payload.enabled,
    denoise: isDenoiseActive(payload),
    eqPreset: String(v['spectral.preset'] ?? '—'),
    lufs: typeof v['loudness.target'] === 'number' ? (v['loudness.target'] as number) : NaN,
    format: String(v['export.format'] ?? '—'),
    rate: String(v['input.rate'] ?? '—'),
    bit: String(v['input.bit'] ?? '—'),
    hasArtwork: !!payload.artworkDataUrl,
    exportDir: payload.exportDir ?? null,
    album: String(v['export.album'] ?? ''),
  };
}

const sanitizeFolder = (s: string) => (s || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Untitled Master';

export function RenderBatchWindow() {
  const [theme, setTheme] = useState<ThemeName>('Teal');
  const [session, setSession] = useState<LoadedSession | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sessionList, setSessionList] = useState<SessionSummary[]>([]);
  const [exportDir, setExportDir] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [statuses, setStatuses] = useState<Record<string, OutStatus>>({});
  const [running, setRunning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [clearModal, setClearModal] = useState(false);
  const [progress, setProgress] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const cancelRef = useRef(false);

  const pal = THEMES[theme] || THEMES.Teal;
  const accent = pal.aMain;
  const dark = theme.includes('Light') ? pal.aMain : pal.aInk;

  // 테마 취득 + CSS 변수 주입 + 변경 구독.
  useEffect(() => {
    (async () => {
      const t = await window.focusdaw?.win?.getRenderBatchTheme?.();
      if (t) setTheme(t as ThemeName);
    })();
    const unsub = window.focusdaw?.win?.onThemeUpdated?.((t) => setTheme(t as ThemeName));
    return () => { unsub?.(); };
  }, []);
  useEffect(() => {
    import('../../theme/themes').then(({ applyTheme }) => applyTheme(theme));
  }, [theme]);

  const openPicker = async () => {
    try {
      setSessionList((await window.focusdaw?.sessionIO?.list?.()) || []);
    } catch {
      setSessionList([]);
    }
    setPickerOpen(true);
  };

  const selectSession = async (id: string) => {
    const file = await window.focusdaw?.sessionIO?.read?.(id);
    if (!file?.payload) return;
    setSession({ id: file.id, name: file.name, summary: summarize(file.name, file.payload), payload: file.payload });
    setExportDir(file.payload.exportDir ?? null);
    setPickerOpen(false);
  };

  const addFiles = async (directory: boolean) => {
    const picked = await openAudioFilePicker({ directory, recursive: true });
    appendSources(picked);
  };

  const appendSources = (files: File[]) => {
    if (!files.length) return;
    setSources((prev) => {
      const seen = new Set(prev.map((s) => `${s.name}:${s.bytes}`));
      const add: SourceItem[] = [];
      files.forEach((f, i) => {
        const key = `${f.name}:${f.size}`;
        if (seen.has(key)) return;
        seen.add(key);
        add.push({ id: `src-${Date.now().toString(36)}-${i}`, name: f.name, bytes: f.size, file: f });
      });
      return [...prev, ...add];
    });
  };

  const removeSource = (id: string) => {
    if (running) return;
    setSources((prev) => prev.filter((s) => s.id !== id));
    setStatuses((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  // #2: 변환 완료(done)된 파일만 원본·결과 양쪽 리스트에서 제거(미완료/취소/오류는 남겨 작업 재개 가능).
  const clearFinished = () => {
    if (running) return;
    const doneIds = new Set(sources.filter((s) => statuses[s.id]?.state === 'done').map((s) => s.id));
    if (doneIds.size === 0) return;
    setSources((prev) => prev.filter((s) => !doneIds.has(s.id)));
    setStatuses((prev) => {
      const n: Record<string, OutStatus> = {};
      for (const [k, v] of Object.entries(prev)) if (!doneIds.has(k)) n[k] = v;
      return n;
    });
  };

  // #1: 전체 삭제 — 파일/상태/진행 초기화(창 리셋).
  const clearAll = () => {
    if (running) return;
    setSources([]);
    setStatuses({});
    setProgress(0);
    setDoneCount(0);
    setClearModal(false);
  };

  const changeDir = async () => {
    const picked = await window.focusdaw?.exportIO?.pickDir?.();
    if (picked) setExportDir(picked);
  };

  // #1: 출력 폴더를 탐색기로 연다(미지정이면 기본 Masters/<Album> 경로 해석).
  const openFolder = async () => {
    let dir = exportDir;
    if (!dir) {
      const base = (await window.focusdaw?.exportIO?.defaultDir?.()) || 'Masters';
      dir = `${base}/${sanitizeFolder(session ? String(session.payload.vals['export.album'] || '') : '')}`;
    }
    await window.focusdaw?.exportIO?.openFolder?.(dir);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (running) return;
    const files = await audioFilesFromDataTransfer(e.dataTransfer, true);
    appendSources(files);
  };

  const start = async () => {
    if (!session || sources.length === 0 || running) return;
    const io = window.focusdaw?.exportIO;
    if (!io) return;
    // 출력 폴더 결정: 사용자 선택 > 세션 exportDir > 기본 <Music>/Masters/<Album>.
    let dir = exportDir;
    if (!dir) {
      const base = (await io.defaultDir?.()) || 'Masters';
      dir = `${base}/${sanitizeFolder(String(session.payload.vals['export.album'] || ''))}`;
      setExportDir(dir);
    }
    const ext = outputExt(session.payload.vals['export.format']);
    cancelRef.current = false;
    setRunning(true);
    setCancelling(false);
    setDoneCount(0);
    setProgress(0);
    setStatuses(Object.fromEntries(sources.map((s) => [s.id, { state: 'waiting', ext } as OutStatus])));

    const total = sources.length;
    for (let i = 0; i < total; i++) {
      const s = sources[i];
      if (cancelRef.current) {
        // 남은 항목(현재 포함)을 취소 표시.
        setStatuses((prev) => {
          const n = { ...prev };
          for (let j = i; j < total; j++) n[sources[j].id] = { state: 'cancelled', ext };
          return n;
        });
        break;
      }
      setStatuses((prev) => ({ ...prev, [s.id]: { state: 'processing', ext, stage: 'decoding' } }));
      setProgress((i + 0.5) / total);
      try {
        const r = await renderFileWithSession(s.file, session.payload, (stage) => {
          setStatuses((prev) => (prev[s.id]?.state === 'processing' ? { ...prev, [s.id]: { ...prev[s.id], stage } } : prev));
        });
        const res = await io.saveFile!(dir, r.filename, r.bytes, false);
        setStatuses((prev) => ({
          ...prev,
          [s.id]: res.ok ? { state: 'done', ext: r.ext, path: res.path } : { state: 'error', ext: r.ext, error: res.error },
        }));
      } catch (err) {
        setStatuses((prev) => ({ ...prev, [s.id]: { state: 'error', ext, error: err instanceof Error ? err.message : 'Render failed' } }));
      }
      setDoneCount(i + 1);
      setProgress((i + 1) / total);
      await new Promise((r) => setTimeout(r, 0)); // UI 양보.
    }
    setRunning(false);
    setCancelling(false);
  };

  const confirmCancel = () => {
    setCancelModal(false);
    setCancelling(true);
    cancelRef.current = true;
  };

  const close = () => window.focusdaw?.win?.close?.();

  const pct = Math.round(progress * 100);
  const canStart = !!session && sources.length > 0 && !running;
  const folderLabel = useMemo(
    () => exportFolderLabel(exportDir, session ? String(session.payload.vals['export.album'] || '') : ''),
    [exportDir, session],
  );

  // ── 작은 조각들 ──
  const Spinner = ({ color }: { color: string }) => (
    <div style={{ width: 15, height: 15, borderRadius: '50%', border: `2px solid ${color}33`, borderTopColor: color, animation: 'dkspin 0.8s linear infinite' }} />
  );

  const statusIcon = (st?: OutStatus) => {
    switch (st?.state) {
      case 'done': return <span style={{ color: accent, fontSize: 14, fontWeight: 700 }}>✓</span>;
      case 'processing': return <Spinner color={accent} />;
      case 'error': return <span style={{ color: '#d4495f', fontSize: 13, fontWeight: 700 }}>!</span>;
      case 'cancelled': return <span style={{ color: '#9b927f', fontSize: 12 }}>✕</span>;
      default: return <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px dashed #b8af9c' }} />;
    }
  };

  const paneBox: CSSProperties = { flex: 1, minWidth: 0, background: '#efe7d6', border: '1px solid #cabfa9', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' };
  const paneHead: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 13px', borderBottom: '1px solid #ddd2bb' };
  const headLabel: CSSProperties = { fontFamily: 'Archivo', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#6b6353' };

  return (
    <div
      style={{ width: '100vw', height: '100vh', background: '#f3eede', border: '1px solid #9fa2a6', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif', color: '#3a342c', overflow: 'hidden', position: 'relative' }}
      onDragOver={(e) => { e.preventDefault(); if (!running) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {/* 타이틀바 */}
      <div className="app-drag" style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', background: '#e7dfcd', borderBottom: '1px solid #d3c9b2', flex: 'none', userSelect: 'none' }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', color: '#6b6353' }}>RENDER BATCH</span>
        <div className="app-no-drag" onClick={close} style={{ width: 22, height: 20, borderRadius: 4, display: 'grid', placeItems: 'center', color: '#5a5347', fontSize: 16, cursor: 'pointer' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ff4d5e'; e.currentTarget.style.background = 'rgba(255,77,94,0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#5a5347'; e.currentTarget.style.background = 'transparent'; }}>×</div>
      </div>

      {/* 헤더: 타이틀 + Select Session + (세션 카드 / 폴더) */}
      <div style={{ flex: 'none', padding: '12px 18px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: 'Spectral, serif', fontSize: 21, fontWeight: 700, color: accent }}>Render Batch</span>
          <button className="app-no-drag" onClick={openPicker} style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${dark}55`, background: session ? 'transparent' : `${dark}14`, color: dark, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
            {session ? 'Change Session Card' : 'Select Session Card'}
          </button>
        </div>

        {session && (
          // 카드 행을 하단 패널과 동일한 컬럼 폭으로 정렬: 카드(flex1) | 중앙 64 스페이서 | 폴더(flex1)
          <div style={{ display: 'flex', gap: 14, marginTop: 10, alignItems: 'stretch' }}>
            <SessionMiniCard s={session.summary} theme={theme} dark={dark} />
            <div style={{ width: 64, flex: 'none' }} />
            {/* 출력 폴더 */}
            <div style={{ flex: 1, minWidth: 0, background: '#efe7d6', border: '1px solid #cabfa9', borderRadius: 10, padding: '10px 13px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
              <div style={{ fontFamily: 'Archivo', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: '#8a8170' }}>OUTPUT FOLDER</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* #1: 클릭 시 탐색기로 열기 + hover 애니메이션 */}
                <div
                  className="app-no-drag"
                  onClick={openFolder}
                  title={`Open in explorer:\n${folderLabel}`}
                  style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#5a5347', transition: 'color 0.15s ease, transform 0.15s ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = accent; e.currentTarget.style.transform = 'translateX(2px)'; e.currentTarget.style.textDecoration = 'underline'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#5a5347'; e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.textDecoration = 'none'; }}
                >
                  <span style={{ flex: 'none', fontSize: 13 }}>📁</span>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--mono)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left' }}>{folderLabel}</span>
                </div>
                <button className="app-no-drag" onClick={changeDir} disabled={running} style={{ flex: 'none', padding: '4px 12px', borderRadius: 6, border: `1px solid ${dark}`, background: `${dark}12`, color: dark, fontSize: 11, fontWeight: 700, cursor: running ? 'default' : 'pointer', opacity: running ? 0.5 : 1 }}>Change</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 본문: 좌 패널 | 세로 진행바 | 우 패널 */}
      <div style={{ flex: 1, display: 'flex', gap: 14, padding: '4px 18px 10px', minHeight: 0 }}>
        {/* 좌: ORIGINAL FILES */}
        <div style={paneBox}>
          <div style={paneHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={headLabel}>ORIGINAL FILES</span>
              {sources.length > 0 && !running && (
                <span
                  className="app-no-drag"
                  title="Clear all files"
                  onClick={() => setClearModal(true)}
                  style={{ width: 16, height: 16, borderRadius: 4, display: 'grid', placeItems: 'center', background: '#ddd2bb', color: '#7a7163', fontSize: 12, lineHeight: 1, cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = '#c23a52'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#7a7163'; e.currentTarget.style.background = '#ddd2bb'; }}
                >×</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'Archivo', fontSize: 9.5, fontWeight: 700, color: '#8a8170', background: '#ddd2bb', borderRadius: 5, padding: '2px 7px' }}>{sources.length} ITEMS</span>
              {!running && <>
                <button className="app-no-drag" onClick={() => addFiles(false)} style={miniBtn(dark)}>+ Files</button>
                <button className="app-no-drag" onClick={() => addFiles(true)} style={miniBtn(dark)}>+ Folder</button>
              </>}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {sources.length === 0 ? (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', color: '#9b927f', fontSize: 12, padding: 20 }}>
                Drop audio files / folders here<br />or use + Files / + Folder
              </div>
            ) : sources.map((s) => {
              const active = statuses[s.id]?.state === 'processing';
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 7, marginBottom: 3, background: active ? `${accent}1e` : '#f7f1e5', border: `1px solid ${active ? accent : '#e4d9c2'}`, boxShadow: active ? `0 0 0 2px ${accent}33` : 'none', transition: 'background 0.2s, border-color 0.2s' }}>
                  <span style={{ flex: 'none', fontSize: 13, opacity: active ? 1 : 0.6, color: active ? accent : 'inherit' }}>♪</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: active ? 700 : 400, color: '#3a342c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span style={{ flex: 'none', fontFamily: 'var(--mono)', fontSize: 10, color: '#8a8170' }}>{formatBytes(s.bytes)}</span>
                  {!running && <span className="app-no-drag" onClick={() => removeSource(s.id)} style={{ flex: 'none', cursor: 'pointer', color: '#b3a890', fontSize: 13, lineHeight: 1 }}>×</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* 가운데: 세로 진행바 (가로 ×4 확대, %·메시지는 상단 배치) */}
        <div style={{ flex: 'none', width: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: accent }}>{pct}%</div>
            <div style={{ fontFamily: 'Archivo', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', color: '#8a8170' }}>
              {cancelling ? 'CANCELLING' : running ? 'PROCESSING' : doneCount > 0 ? 'DONE' : 'READY'}
            </div>
          </div>
          <div style={{ position: 'relative', width: 48, flex: 1, maxHeight: 240, background: '#e0d6c0', borderRadius: 10, overflow: 'hidden', border: '1px solid #cabfa9' }}>
            {/* 채워진 안쪽 bar — sheen 애니메이션을 이 안에서만(overflow:hidden) 흐르게 함 */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${pct}%`, background: `linear-gradient(180deg, ${pal.aBright}, ${accent})`, borderRadius: 10, overflow: 'hidden', transition: 'height 0.35s ease' }}>
              {running && pct > 0 && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '60%', background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)', animation: 'dkbatchflow 1.3s linear infinite' }} />
              )}
            </div>
          </div>
        </div>

        {/* 우: CONVERTED FILES */}
        <div style={paneBox}>
          <div style={paneHead}>
            <span style={headLabel}>MASTERED FILES</span>
            {!running && Object.values(statuses).some((v) => v.state === 'done') && (
              <button className="app-no-drag" onClick={clearFinished} style={{ ...miniBtn(dark), letterSpacing: '0.06em' }}>CLEAR FINISHED</button>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {sources.length === 0 ? (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#b8af9c', fontSize: 12 }}>—</div>
            ) : sources.map((s) => {
              const st = statuses[s.id];
              const outName = `${MASTERED_PREFIX}${s.name.replace(/\.[^.]+$/, '')}.${st?.ext || outputExt(session?.payload.vals['export.format'])}`;
              const waiting = !st || st.state === 'waiting';
              const processing = st?.state === 'processing';
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 7, marginBottom: 3, background: processing ? '#f7f1e5' : 'transparent', border: processing ? `1px solid ${accent}55` : '1px solid transparent', opacity: waiting ? 0.5 : 1 }}>
                  <span style={{ flex: 'none', width: 16, display: 'grid', placeItems: 'center' }}>{statusIcon(st)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: waiting ? '#9b927f' : '#3a342c', fontStyle: waiting ? 'italic' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {waiting ? 'Waiting for queue…' : outName}
                    </div>
                    {processing && (
                      <div style={{ fontFamily: 'Archivo', fontSize: 9, fontWeight: 700, color: accent, marginTop: 1 }}>
                        {st?.stage ? STAGE_LABEL[st.stage] : 'Processing…'}
                      </div>
                    )}
                    {st?.state === 'done' && (
                      <div style={{ display: 'flex', gap: 5, marginTop: 2 }}>
                        <span style={{ fontFamily: 'Archivo', fontSize: 8, fontWeight: 800, letterSpacing: '0.06em', color: dark, background: `${dark}1c`, borderRadius: 4, padding: '1px 5px' }}>MASTERED</span>
                        <span style={{ fontFamily: 'Archivo', fontSize: 8, color: '#8a8170' }}>{session?.summary.format} · {session?.summary.rate}/{session?.summary.bit}</span>
                      </div>
                    )}
                    {st?.state === 'error' && <div style={{ fontSize: 9.5, color: '#d4495f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.error}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 하단: Start / Cancel */}
      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '4px 0 16px' }}>
        {running ? (
          <button className="app-no-drag" onClick={() => setCancelModal(true)} disabled={cancelling} style={{ padding: '11px 34px', borderRadius: 9, border: 'none', background: cancelling ? '#9b927f' : '#c23a52', color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', cursor: cancelling ? 'default' : 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.18)', animation: cancelling ? 'dkblink 0.6s infinite alternate' : 'none' }}>
            {cancelling ? 'CANCELLING…' : '✕ CANCEL'}
          </button>
        ) : (
          <button className="app-no-drag" onClick={start} disabled={!canStart} style={{ padding: '11px 44px', borderRadius: 9, border: 'none', background: canStart ? `linear-gradient(180deg, ${pal.aBright}, ${accent})` : '#cabfa9', color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', cursor: canStart ? 'pointer' : 'default', boxShadow: canStart ? '0 4px 14px rgba(0,0,0,0.18)' : 'none' }}>
            START
          </button>
        )}
      </div>

      {/* 드래그 오버레이 */}
      {dragOver && (
        <div style={{ position: 'absolute', inset: 0, background: `${accent}22`, border: `2px dashed ${accent}`, display: 'grid', placeItems: 'center', pointerEvents: 'none', zIndex: 40 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: dark }}>Drop audio files</span>
        </div>
      )}

      {/* 세션 선택 오버레이 */}
      {pickerOpen && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(40,36,30,0.45)', display: 'grid', placeItems: 'center', zIndex: 50 }} onClick={() => setPickerOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxHeight: '78%', background: '#f3eede', border: '1px solid #cabfa9', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 18px 50px rgba(0,0,0,0.35)' }}>
            <div style={{ padding: '11px 15px', borderBottom: '1px solid #ddd2bb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Archivo', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: '#6b6353' }}>SELECT SESSION ({sessionList.length})</span>
              <span onClick={() => setPickerOpen(false)} style={{ cursor: 'pointer', color: '#8a8170', fontSize: 16 }}>×</span>
            </div>
            <div style={{ overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessionList.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#9b927f', fontSize: 12 }}>No saved sessions. Save one from the main app first.</div>
              ) : sessionList.map((s) => (
                <div key={s.id} onClick={() => selectSession(s.id)} style={{ cursor: 'pointer' }}>
                  <SessionMiniCard s={s} theme={theme} dark={dark} hoverable />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 전체 삭제 확인 모달 (#1) */}
      {clearModal && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(40,36,30,0.5)', display: 'grid', placeItems: 'center', zIndex: 60 }}>
          <div style={{ width: 360, background: '#f3eede', border: '1px solid #cabfa9', borderRadius: 12, padding: 22, textAlign: 'center', boxShadow: '0 18px 50px rgba(0,0,0,0.4)' }}>
            <div style={{ fontFamily: 'Spectral, serif', fontSize: 16, fontWeight: 700, color: '#3a342c', marginBottom: 8 }}>Clear all files?</div>
            <div style={{ fontSize: 11.5, color: '#6b6353', lineHeight: 1.5, marginBottom: 18 }}>
              Remove all {sources.length} source file{sources.length === 1 ? '' : 's'} and reset the list. Exported files on disk are kept.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setClearModal(false)} style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #b5ae9f', background: 'transparent', color: '#5a5347', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Keep files</button>
              <button onClick={clearAll} style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: '#c23a52', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Yes, clear all</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel 확인 모달 */}
      {cancelModal && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(40,36,30,0.5)', display: 'grid', placeItems: 'center', zIndex: 60 }}>
          <div style={{ width: 360, background: '#f3eede', border: '1px solid #cabfa9', borderRadius: 12, padding: 22, textAlign: 'center', boxShadow: '0 18px 50px rgba(0,0,0,0.4)' }}>
            <div style={{ fontFamily: 'Spectral, serif', fontSize: 16, fontWeight: 700, color: '#3a342c', marginBottom: 8 }}>Cancel batch render?</div>
            <div style={{ fontSize: 11.5, color: '#6b6353', lineHeight: 1.5, marginBottom: 18 }}>
              The current file will finish, then remaining files will be skipped. Files already exported are kept.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setCancelModal(false)} style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #b5ae9f', background: 'transparent', color: '#5a5347', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Keep rendering</button>
              <button onClick={confirmCancel} style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: '#c23a52', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Yes, cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function miniBtn(dark: string): CSSProperties {
  return { padding: '3px 9px', borderRadius: 6, border: `1px solid ${dark}44`, background: `${dark}10`, color: dark, fontFamily: 'Archivo', fontSize: 9.5, fontWeight: 700, cursor: 'pointer' };
}

// 세션 요약 미니 카드(헤더 + 선택 오버레이 공용).
function SessionMiniCard({ s, theme, dark, hoverable }: { s: SessionSummary; theme: ThemeName; dark: string; hoverable?: boolean }) {
  return (
    <div
      style={{ flex: 1, minWidth: 0, background: '#efe7d6', border: '1px solid #cabfa9', borderRadius: 10, padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: 6, transition: 'border-color 0.15s' }}
      onMouseEnter={hoverable ? (e) => { e.currentTarget.style.borderColor = dark; } : undefined}
      onMouseLeave={hoverable ? (e) => { e.currentTarget.style.borderColor = '#cabfa9'; } : undefined}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: 'Spectral, serif', fontSize: 13.5, fontWeight: 700, color: '#3a342c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: '#8a8170', flex: 'none' }}>{s.format} · {s.rate}/{s.bit}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {MODS.filter((m) => m.id !== 'input' && m.id !== 'export').map((m) => {
          const on = s.enabled?.[m.id] !== false;
          const chip = (label: string, active: boolean) => (
            <span key={label} style={{ fontFamily: 'Archivo', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, color: active ? (theme.includes('Light') ? '#fff' : dark) : '#9b927f', background: active ? `${dark}22` : '#dcd3c0', border: `1px solid ${active ? `${dark}55` : '#cabfa9'}` }}>{label}</span>
          );
          if (m.id === 'pre') return [chip(m.short, on), chip(`Denoise ${s.denoise ? 'On' : 'Off'}`, s.denoise)];
          return chip(m.short, on);
        })}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: '#5a5347' }}>
        EQ {s.eqPreset} · {Number.isFinite(s.lufs) ? `${s.lufs} LUFS` : '— LUFS'}{s.hasArtwork ? ' · ● art' : ''}
      </div>
    </div>
  );
}
