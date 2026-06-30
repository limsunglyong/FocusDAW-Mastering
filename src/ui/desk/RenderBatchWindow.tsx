// FocusDAW Mastering Desk - multi-job Render Batch
// Each job maps one source folder to one Session Card and one output folder.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { MODS } from '../../desk/data';
import { THEMES, type ThemeName } from '../../theme/themes';
import { openAudioFilePicker, audioFilesFromDataTransfer } from '../../audio/filePicker';
import { formatBytes } from '../../audio/queueFile';
import { isDenoiseActive, type SessionPayload, type SessionSummary } from '../../session/session';
import { renderFileWithSession, outputExt, MASTERED_PREFIX, type BatchStage } from '../../export/batchRunner';

type SourceItem = { id: string; name: string; bytes: number; file: File; folder: string };
type OutState = 'waiting' | 'processing' | 'done' | 'error' | 'cancelled';
type OutStatus = { state: OutState; ext: string; error?: string; path?: string; stage?: BatchStage };
type LoadedSession = { id: string; name: string; summary: SessionSummary; payload: SessionPayload };
type BatchJob = {
  id: string;
  folderName: string;
  sources: SourceItem[];
  session: LoadedSession | null;
  exportDir: string | null;
  statuses: Record<string, OutStatus>;
  expanded: boolean;
};

const STAGE_LABEL: Record<BatchStage, string> = {
  decoding: 'Decoding…', analyzing: 'Analyzing noise…', denoising: 'Denoising…', rendering: 'Rendering…',
};
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const newJob = (): BatchJob => ({
  id: newId('job'), folderName: '', sources: [], session: null, exportDir: null, statuses: {}, expanded: true,
});
const sanitizeFolder = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_').trim() || 'Untitled';

function summarize(name: string, payload: SessionPayload): SessionSummary {
  const v = payload.vals;
  return {
    id: '', name, description: '', savedAt: 0, appVersion: '', enabled: payload.enabled,
    denoise: isDenoiseActive(payload),
    eqMode: v['spectral.mode'] === '9-Band' ? '9-Band' : 'Parametric',
    eqPreset: v['spectral.mode'] === '9-Band'
      ? String(v['spectral.graphic.preset'] ?? 'Normal')
      : String(v['spectral.preset'] ?? '—'),
    lufs: typeof v['loudness.target'] === 'number' ? v['loudness.target'] as number : NaN,
    format: String(v['export.format'] ?? '—'), rate: String(v['input.rate'] ?? '—'),
    bit: String(v['input.bit'] ?? '—'), hasArtwork: !!payload.artworkDataUrl,
    exportDir: payload.exportDir ?? null, album: String(v['export.album'] ?? ''),
  };
}

function folderFromFiles(files: File[]) {
  const rel = files[0]?.webkitRelativePath || '';
  return rel.split('/')[0] || 'Selected Files';
}

function sourceKey(file: File) {
  return `${file.webkitRelativePath || file.name}:${file.size}:${file.lastModified}`;
}

function folderForFile(file: File) {
  const absolute = window.focusdaw?.getPathForFile?.(file) || '';
  if (absolute) return absolute.replace(/[\\/][^\\/]+$/, '') || absolute;
  const relative = file.webkitRelativePath || '';
  if (relative.includes('/')) return relative.slice(0, relative.lastIndexOf('/'));
  return 'Folder information unavailable';
}

export function RenderBatchWindow() {
  const [theme, setTheme] = useState<ThemeName>('Teal');
  const [jobs, setJobs] = useState<BatchJob[]>([newJob()]);
  const [sessionList, setSessionList] = useState<SessionSummary[]>([]);
  const [pickerJobId, setPickerJobId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [dragJobId, setDragJobId] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const pal = THEMES[theme] || THEMES.Teal;
  const accent = pal.aMain;
  const dark = theme.includes('Light') ? pal.aMain : pal.aInk;

  useEffect(() => {
    void window.focusdaw?.win?.getRenderBatchTheme?.().then((t) => { if (t) setTheme(t as ThemeName); });
    const unsub = window.focusdaw?.win?.onThemeUpdated?.((t) => setTheme(t as ThemeName));
    return () => unsub?.();
  }, []);
  useEffect(() => { void import('../../theme/themes').then(({ applyTheme }) => applyTheme(theme)); }, [theme]);

  const updateJob = (id: string, update: Partial<BatchJob> | ((j: BatchJob) => Partial<BatchJob>)) => {
    setJobs((prev) => prev.map((j) => j.id === id ? { ...j, ...(typeof update === 'function' ? update(j) : update) } : j));
  };

  const appendFiles = async (jobId: string, files: File[], sourceLabel: string) => {
    if (!files.length) return;
    const base = (await window.focusdaw?.exportIO?.defaultDir?.()) || 'Masters';
    updateJob(jobId, (job) => {
      const seen = new Set(job.sources.map((s) => sourceKey(s.file)));
      const added = files
        .filter((file) => {
          const key = sourceKey(file);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((file) => ({ id: newId('src'), name: file.name, bytes: file.size, file, folder: folderForFile(file) }));
      if (!added.length) return {};
      const folderName = !job.sources.length
        ? sourceLabel
        : job.folderName === sourceLabel ? job.folderName : 'Mixed Sources';
      return {
        folderName,
        sources: [...job.sources, ...added],
        exportDir: job.exportDir || `${base}/${sanitizeFolder(sourceLabel)}`,
      };
    });
  };

  const addFiles = async (jobId: string) => {
    const files = await openAudioFilePicker({ directory: false });
    await appendFiles(jobId, files, 'Selected Files');
  };

  const addFolder = async (jobId: string) => {
    const files = await openAudioFilePicker({ directory: true, recursive: true });
    await appendFiles(jobId, files, folderFromFiles(files));
  };

  const dropFolder = async (jobId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragJobId(null);
    if (running) return;
    const files = await audioFilesFromDataTransfer(e.dataTransfer, true);
    if (!files.length) return;
    await appendFiles(jobId, files, folderFromFiles(files));
  };

  const openSessionPicker = async (jobId: string) => {
    try { setSessionList((await window.focusdaw?.sessionIO?.list?.()) || []); } catch { setSessionList([]); }
    setPickerJobId(jobId);
  };
  const selectSession = async (sessionId: string) => {
    if (!pickerJobId) return;
    const file = await window.focusdaw?.sessionIO?.read?.(sessionId);
    if (!file?.payload) return;
    const loaded = { id: file.id, name: file.name, summary: summarize(file.name, file.payload), payload: file.payload };
    updateJob(pickerJobId, { session: loaded, statuses: {} });
    setPickerJobId(null);
  };
  const changeDir = async (jobId: string) => {
    const dir = await window.focusdaw?.exportIO?.pickDir?.();
    if (dir) updateJob(jobId, { exportDir: dir });
  };
  const openFolder = async (job: BatchJob) => {
    if (job.exportDir) await window.focusdaw?.exportIO?.openFolder?.(job.exportDir);
  };
  const removeJob = (id: string) => {
    if (running) return;
    setJobs((prev) => prev.length === 1 ? [newJob()] : prev.filter((j) => j.id !== id));
  };
  const removeSource = (jobId: string, sourceId: string) => updateJob(jobId, (job) => {
    const statuses = { ...job.statuses };
    delete statuses[sourceId];
    const sources = job.sources.filter((s) => s.id !== sourceId);
    return { sources, statuses, folderName: sources.length ? job.folderName : '' };
  });
  const clearSources = (jobId: string) => {
    if (running) return;
    updateJob(jobId, { sources: [], statuses: {}, folderName: '' });
  };
  const clearFinished = (jobId: string) => updateJob(jobId, (job) => {
    const done = new Set(job.sources.filter((s) => job.statuses[s.id]?.state === 'done').map((s) => s.id));
    return {
      sources: job.sources.filter((s) => !done.has(s.id)),
      statuses: Object.fromEntries(Object.entries(job.statuses).filter(([id]) => !done.has(id))),
    };
  });

  const runnableJobs = useMemo(() => jobs.filter((j) => j.sources.length > 0 && j.session), [jobs]);
  const totalFiles = useMemo(() => runnableJobs.reduce((n, j) => n + j.sources.length, 0), [runnableJobs]);
  const canStart = !running && jobs.length > 0 && jobs.every((j) => j.sources.length > 0 && !!j.session && !!j.exportDir);

  const setStatus = (jobId: string, sourceId: string, status: OutStatus) => {
    updateJob(jobId, (job) => ({ statuses: { ...job.statuses, [sourceId]: status } }));
  };

  const start = async () => {
    if (!canStart) return;
    const io = window.focusdaw?.exportIO;
    if (!io?.saveFile) return;
    cancelRef.current = false;
    setRunning(true); setCancelling(false); setProgress(0); setProcessedCount(0);
    setJobs((prev) => prev.map((job) => {
      const ext = outputExt(job.session?.payload.vals['export.format']);
      return { ...job, statuses: Object.fromEntries(job.sources.map((s) => [s.id, { state: 'waiting', ext }])) };
    }));

    const queue = jobs.flatMap((job) => job.sources.map((source) => ({ job, source })));
    let processed = 0;
    for (let i = 0; i < queue.length; i++) {
      const { job, source } = queue[i];
      const session = job.session!;
      const ext = outputExt(session.payload.vals['export.format']);
      if (cancelRef.current) {
        for (let k = i; k < queue.length; k++) {
          setStatus(queue[k].job.id, queue[k].source.id, { state: 'cancelled', ext: outputExt(queue[k].job.session?.payload.vals['export.format']) });
        }
        break;
      }
      setStatus(job.id, source.id, { state: 'processing', ext, stage: 'decoding' });
      setProgress((processed + 0.3) / queue.length);
      try {
        const result = await renderFileWithSession(source.file, session.payload, (stage) => {
          setJobs((prev) => prev.map((j) => j.id !== job.id ? j : {
            ...j, statuses: { ...j.statuses, [source.id]: { ...j.statuses[source.id], state: 'processing', ext, stage } },
          }));
        });
        const saved = await io.saveFile!(job.exportDir!, result.filename, result.bytes, false);
        setStatus(job.id, source.id, saved.ok
          ? { state: 'done', ext: result.ext, path: saved.path }
          : { state: 'error', ext: result.ext, error: saved.error });
      } catch (err) {
        setStatus(job.id, source.id, { state: 'error', ext, error: err instanceof Error ? err.message : 'Render failed' });
      }
      processed++;
      setProcessedCount(processed);
      setProgress(processed / queue.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    setRunning(false); setCancelling(false);
  };

  const pct = Math.round(progress * 100);
  const pane: CSSProperties = { minWidth: 0, background: '#efe7d6', border: '1px solid #cabfa9', borderRadius: 9, overflow: 'hidden' };
  const label: CSSProperties = { fontFamily: 'Archivo', fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', color: '#6b6353' };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#f3eede', border: '1px solid #9fa2a6', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', fontFamily: '"Segoe UI", sans-serif', color: '#3a342c', overflow: 'hidden', position: 'relative' }}>
      <div className="app-drag" style={{ height: 36, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', background: '#e7dfcd', borderBottom: '1px solid #d3c9b2' }}>
        <span style={{ ...label, fontSize: 10.5 }}>RENDER BATCH</span>
        <button className="app-no-drag" onClick={() => window.focusdaw?.win?.close?.()} style={closeBtn}>×</button>
      </div>

      <div style={{ flex: 'none', padding: '12px 18px 10px', display: 'flex', alignItems: 'center', gap: 22 }}>
        <span style={{ fontFamily: 'Spectral, serif', fontSize: 21, fontWeight: 700, color: accent }}>Render Batch</span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <div style={{ flex: 1, maxWidth: 540, height: 18, background: '#e0d6c0', borderRadius: 9, overflow: 'hidden', border: '1px solid #cabfa9' }}>
            <div style={{ position: 'relative', width: `${pct}%`, height: '100%', overflow: 'hidden', background: `linear-gradient(90deg, ${accent}, ${pal.aBright})`, transition: 'width .25s' }}>
              {running && pct > 0 && (
                <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '42%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent)', animation: 'dkbatchflowx 1.25s linear infinite' }} />
              )}
            </div>
          </div>
          <span style={{ width: 105, fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 800, color: accent }}>
            {pct}% <small style={{ color: '#8a8170' }}>{processedCount}/{totalFiles}</small>
          </span>
        </div>
        {running ? (
          <button
            onClick={() => setCancelModal(true)}
            disabled={cancelling}
            style={{ ...actionBtn, background: cancelling ? '#9b927f' : '#c23a52', animation: cancelling ? 'dkcancelbreathe 1.35s ease-in-out infinite' : 'none' }}
          >{cancelling ? 'CANCELLING…' : '✕ CANCEL'}</button>
        ) : (
          <button onClick={start} disabled={!canStart} title={!canStart ? 'Select a source folder and Session Card for every job.' : ''} style={{ ...actionBtn, background: canStart ? `linear-gradient(180deg, ${pal.aBright}, ${accent})` : '#cabfa9', cursor: canStart ? 'pointer' : 'default' }}>START</button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '3px 18px 12px' }}>
        {jobs.map((job, index) => {
          const done = Object.values(job.statuses).filter((s) => s.state === 'done').length;
          const active = Object.values(job.statuses).some((s) => s.state === 'processing');
          return (
            <section key={job.id} style={{ marginBottom: 10, border: `1px solid ${active ? accent : '#cabfa9'}`, borderRadius: 12, background: '#e8dfcc', boxShadow: active ? `0 0 0 2px ${accent}25` : 'none' }}>
              <div style={{ height: 34, padding: '0 10px 0 13px', display: 'flex', alignItems: 'center', gap: 9, borderBottom: job.expanded ? '1px solid #d3c9b2' : 'none' }}>
                <button onClick={() => updateJob(job.id, { expanded: !job.expanded })} style={iconBtn}>{job.expanded ? '▾' : '▸'}</button>
                <span style={label}>JOB {index + 1}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#4e473d' }}>{job.folderName || 'New batch job'}</span>
                <span style={{ fontSize: 9.5, color: '#8a8170' }}>{job.sources.length} files{job.session ? ` · ${job.session.name}` : ''}{done ? ` · ${done} done` : ''}</span>
                <span style={{ flex: 1 }} />
                {!running && <button onClick={() => removeJob(job.id)} title="Remove job" style={{ ...iconBtn, color: '#a34252' }}>×</button>}
              </div>

              {job.expanded && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 280px minmax(280px, 1fr)', gap: 10, padding: 10, minHeight: 205 }}>
                  <div
                    style={{ ...pane, display: 'flex', flexDirection: 'column', outline: dragJobId === job.id ? `2px dashed ${accent}` : 'none' }}
                    onDragOver={(e) => { e.preventDefault(); if (!running) setDragJobId(job.id); }}
                    onDragLeave={() => setDragJobId(null)}
                    onDrop={(e) => void dropFolder(job.id, e)}
                  >
                    <PaneHead label={(
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        ORIGINAL SOURCES
                        {job.sources.length > 0 && !running && (
                          <button
                            onClick={() => clearSources(job.id)}
                            title="Clear all source files"
                            style={{ ...iconBtn, width: 16, height: 16, padding: 0, borderRadius: 4, background: '#ddd2bb', color: '#7a7163', fontSize: 12, lineHeight: 1 }}
                          >×</button>
                        )}
                      </span>
                    )}>
                      <span style={countChip}>{job.sources.length} ITEMS</span>
                      {!running && <>
                        <button onClick={() => void addFiles(job.id)} style={miniBtn(dark)}>+ FILE</button>
                        <button onClick={() => void addFolder(job.id)} style={miniBtn(dark)}>+ FOLDER</button>
                      </>}
                    </PaneHead>
                    <div style={{ flex: 1, overflowY: 'auto', maxHeight: 190, padding: 7 }}>
                      {!job.sources.length ? <Empty text="Drop files / folders here or use + File / + Folder" /> : job.sources.map((s) => (
                        <div key={s.id} style={fileRow}>
                          <span style={{ opacity: .6 }}>♪</span><span title={s.folder} style={ellipsis}>{s.name}</span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: '#8a8170' }}>{formatBytes(s.bytes)}</span>
                          {!running && <button onClick={() => removeSource(job.id, s.id)} title="Remove file" style={{ ...iconBtn, color: '#a34252' }}>×</button>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ ...pane, flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <PaneHead label="SESSION CARD">
                        <button onClick={() => void openSessionPicker(job.id)} disabled={running} style={miniBtn(dark)}>{job.session ? 'CHANGE' : 'SELECT'}</button>
                      </PaneHead>
                      <div style={{ flex: 1, display: 'flex', padding: 7 }}>
                        {job.session ? <SessionMiniCard s={job.session.summary} theme={theme} dark={dark} /> : (
                          <button onClick={() => void openSessionPicker(job.id)} style={{ flex: 1, border: `1px dashed ${dark}66`, borderRadius: 8, background: `${dark}08`, color: dark, fontSize: 10, fontWeight: 800 }}>SELECT SESSION CARD</button>
                        )}
                      </div>
                    </div>
                    <div style={{ ...pane, padding: '7px 9px', display: 'flex', alignItems: 'center', gap: 7 }}>
                      <button onClick={() => void openFolder(job)} title={job.exportDir || ''} style={{ ...iconBtn, fontSize: 14 }}>📁</button>
                      <span style={{ ...ellipsis, fontFamily: 'var(--mono)', fontSize: 9 }}>{job.exportDir || 'Output folder not set'}</span>
                      <button onClick={() => void changeDir(job.id)} disabled={running} style={miniBtn(dark)}>CHANGE</button>
                    </div>
                  </div>

                  <div style={{ ...pane, display: 'flex', flexDirection: 'column' }}>
                    <PaneHead label="MASTERED FILES">
                      {!running && done > 0 && <button onClick={() => clearFinished(job.id)} style={miniBtn(dark)}>CLEAR FINISHED</button>}
                    </PaneHead>
                    <div style={{ flex: 1, overflowY: 'auto', maxHeight: 190, padding: 7 }}>
                      {!job.sources.length ? <Empty text="—" /> : job.sources.map((s) => {
                        const st = job.statuses[s.id];
                        const ext = st?.ext || outputExt(job.session?.payload.vals['export.format']);
                        return (
                          <div key={s.id} style={{ ...fileRow, opacity: !st || st.state === 'waiting' ? .5 : 1 }}>
                            <StatusIcon status={st} accent={accent} />
                            <div style={{ ...ellipsis, display: 'block' }}>
                              <div style={ellipsis}>{MASTERED_PREFIX}{s.name.replace(/\.[^.]+$/, '')}.{ext}</div>
                              {st?.state === 'processing' && <small style={{ color: accent }}>{STAGE_LABEL[st.stage || 'rendering']}</small>}
                              {st?.state === 'error' && <small style={{ color: '#c23a52' }}>{st.error}</small>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })}

        {!running && (
          <button onClick={() => setJobs((prev) => [...prev, newJob()])} style={{ width: '100%', height: 40, borderRadius: 10, border: `1px dashed ${dark}88`, background: `${dark}08`, color: dark, fontFamily: 'Archivo', fontSize: 10.5, fontWeight: 800, letterSpacing: '.07em', cursor: 'pointer' }}>
            ＋ ADD BATCH JOB
          </button>
        )}
      </div>

      {pickerJobId && (
        <div style={overlay} onClick={() => setPickerJobId(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxHeight: '78%', background: '#f3eede', border: '1px solid #cabfa9', borderRadius: 12, overflow: 'hidden', boxShadow: '0 18px 50px rgba(0,0,0,.35)' }}>
            <PaneHead label={`SELECT SESSION (${sessionList.length})`}><button onClick={() => setPickerJobId(null)} style={iconBtn}>×</button></PaneHead>
            <div style={{ maxHeight: 430, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!sessionList.length ? <Empty text="No saved sessions. Save one from the main app first." /> : sessionList.map((s) => (
                <div key={s.id} onClick={() => void selectSession(s.id)} style={{ display: 'flex', cursor: 'pointer' }}><SessionMiniCard s={s} theme={theme} dark={dark} hoverable /></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {cancelModal && (
        <div style={overlay}>
          <div style={modal}>
            <h3 style={{ fontFamily: 'Spectral, serif', margin: '0 0 8px' }}>Cancel all batch jobs?</h3>
            <p style={{ fontSize: 11.5, color: '#6b6353' }}>The current file will finish. Remaining files in every job will be skipped.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button onClick={() => setCancelModal(false)} style={secondaryBtn}>Keep rendering</button>
              <button onClick={() => { setCancelModal(false); setCancelling(true); cancelRef.current = true; }} style={{ ...secondaryBtn, border: 'none', background: '#c23a52', color: '#fff' }}>Yes, cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaneHead({ label, children }: { label: React.ReactNode; children?: React.ReactNode }) {
  return <div style={{ minHeight: 33, padding: '0 9px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #ddd2bb' }}>
    <div style={{ flex: 1, fontFamily: 'Archivo', fontSize: 9.5, fontWeight: 800, letterSpacing: '.07em', color: '#6b6353' }}>{label}</div>{children}
  </div>;
}
function Empty({ text }: { text: string }) {
  return <div style={{ minHeight: 80, height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', color: '#9b927f', fontSize: 11, padding: 12 }}>{text}</div>;
}
function StatusIcon({ status, accent }: { status?: OutStatus; accent: string }) {
  if (status?.state === 'done') return <span style={{ color: accent, fontWeight: 800 }}>✓</span>;
  if (status?.state === 'processing') return (
    <span style={{ flex: 'none', width: 16, height: 16, boxSizing: 'border-box', borderRadius: '50%', border: `2.5px solid ${accent}35`, borderTopColor: accent, borderRightColor: accent, animation: 'dkspin .7s linear infinite' }} />
  );
  if (status?.state === 'error') return <span style={{ color: '#c23a52', fontWeight: 800 }}>!</span>;
  if (status?.state === 'cancelled') return <span style={{ color: '#9b927f' }}>×</span>;
  return <span style={{ color: '#b8af9c' }}>○</span>;
}
function miniBtn(dark: string): CSSProperties {
  return { padding: '3px 8px', borderRadius: 6, border: `1px solid ${dark}44`, background: `${dark}10`, color: dark, fontFamily: 'Archivo', fontSize: 9, fontWeight: 700, cursor: 'pointer' };
}

function SessionMiniCard({ s, theme, dark, hoverable }: { s: SessionSummary; theme: ThemeName; dark: string; hoverable?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: '#efe7d6', border: '1px solid #cabfa9', borderRadius: 9, padding: '7px 9px', display: 'flex', flexDirection: 'column', gap: 5 }}
      onMouseEnter={hoverable ? (e) => { e.currentTarget.style.borderColor = dark; } : undefined}
      onMouseLeave={hoverable ? (e) => { e.currentTarget.style.borderColor = '#cabfa9'; } : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        <strong style={{ fontFamily: 'Spectral, serif', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</strong>
        <span style={{ flex: 'none', fontFamily: 'var(--mono)', fontSize: 8.5, color: '#8a8170' }}>{s.format} · {s.rate}/{s.bit}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {MODS.filter((m) => m.id !== 'input' && m.id !== 'export').flatMap((m) => {
          const on = s.enabled?.[m.id] !== false;
          const chip = (text: string, active: boolean) => <span key={`${m.id}-${text}`} style={{ fontFamily: 'Archivo', fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 12, color: active ? (theme.includes('Light') ? '#fff' : dark) : '#9b927f', background: active ? `${dark}22` : '#dcd3c0', border: `1px solid ${active ? `${dark}55` : '#cabfa9'}` }}>{text}</span>;
          if (m.id === 'pre') return [chip(m.short, on), chip(`Denoise ${s.denoise ? 'On' : 'Off'}`, s.denoise)];
          if (m.id === 'spectral') return [chip(s.eqMode === '9-Band' ? '9-EQ' : 'Min-EQ', on)];
          return [chip(m.short, on)];
        })}
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: '#5a5347' }}>{s.eqMode === '9-Band' ? 'EQ 9-band' : 'EQ Min-φ'} · {s.eqPreset} · {Number.isFinite(s.lufs) ? `${s.lufs} LUFS` : '— LUFS'}</span>
    </div>
  );
}

const ellipsis: CSSProperties = { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const fileRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, padding: '5px 7px', marginBottom: 3, borderRadius: 6, background: '#f7f1e5', border: '1px solid #e4d9c2', fontSize: 10.5 };
const countChip: CSSProperties = { fontFamily: 'Archivo', fontSize: 8.5, fontWeight: 700, color: '#8a8170', background: '#ddd2bb', borderRadius: 5, padding: '2px 6px' };
const iconBtn: CSSProperties = { border: 'none', background: 'transparent', color: '#6b6353', cursor: 'pointer', padding: 3 };
const closeBtn: CSSProperties = { ...iconBtn, fontSize: 16, width: 24 };
const actionBtn: CSSProperties = { flex: 'none', padding: '9px 25px', borderRadius: 8, border: 'none', color: '#fff', fontSize: 11, fontWeight: 800 };
const overlay: CSSProperties = { position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(40,36,30,.5)', display: 'grid', placeItems: 'center' };
const modal: CSSProperties = { width: 360, padding: 22, borderRadius: 12, textAlign: 'center', background: '#f3eede', border: '1px solid #cabfa9', boxShadow: '0 18px 50px rgba(0,0,0,.4)' };
const secondaryBtn: CSSProperties = { padding: '7px 16px', borderRadius: 7, border: '1px solid #b5ae9f', background: 'transparent', color: '#5a5347', fontSize: 11, fontWeight: 700, cursor: 'pointer' };
