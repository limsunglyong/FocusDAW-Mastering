// FocusDAW Mastering Desk v0.1.1 (Phase 0 UI) - 상세 시트 col3 (PARAMETERS) (원본 dc.html 이식)
import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { css } from '../../desk/css';
import { useAppStore } from '../../store/appStore';
import { DeskIcon } from '../Icons';
import { Knob } from './Knob';
import type { Control, DeskView } from '../../desk/compute';
import { getDenoiseRecommendation } from '../../audio/denoise';

function ControlItem({ c, view }: { c: Control; view: DeskView }) {
  const setVal = useAppStore((s) => s.setVal);
  const paperCtl = view.pal.paperCtl;

  if (c.isRot) {
    return (
      <div style={css(c.wrapStyle)}>
        <div style={{ textAlign: 'center', fontFamily: 'Archivo', fontSize: 9.5, color: '#8a8070', whiteSpace: 'nowrap', marginBottom: 5 }}>{c.label}</div>
        <Knob vm={c.knob!} size={54} sw={3.2} trackSw={3.2} />
        <div style={{ textAlign: 'center', fontFamily: 'Archivo', fontSize: 12, fontWeight: 700, color: c.knob!.valColor, marginTop: 5 }}>
          {c.knob!.display} <span style={{ fontFamily: 'Archivo', fontSize: 9.5, fontWeight: 400, color: '#8a8070' }}>{c.knob!.unitText}</span>
        </div>
      </div>
    );
  }

  if (c.isSeg) {
    return (
      <div style={css(c.wrapStyle)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ fontFamily: 'Archivo', fontSize: 9.5, color: '#8a8070', whiteSpace: 'nowrap' }}>{c.label}</span>
          <div style={{ display: 'flex', gap: 3, background: paperCtl, borderRadius: 8, padding: 3 }}>
            {c.opts!.map((o) => (
              <div key={o.value} onClick={() => setVal(c.fk, o.value)} style={css(o.style)}>{o.label}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // switch
  return (
    <div style={css(c.wrapStyle)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span style={{ fontFamily: 'Archivo', fontSize: 9.5, color: '#8a8070', lineHeight: 1.2, width: c.labelW, flex: 'none', display: 'flex', flexDirection: 'column' }}>
          {c.labelL1}{c.twoLine && <span>{c.labelL2}</span>}
        </span>
        <div onClick={() => setVal(c.fk, !c.on)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <div style={css(c.swTrack)}><div style={css(c.swKnob)} /></div>
          <span style={{ fontFamily: 'Archivo', fontSize: 10, fontWeight: 600, color: c.subColor, width: 28, display: 'inline-block', flex: 'none' }}>{c.subText}</span>
        </div>
      </div>
      {c.hasBelow && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 13, ...css(c.belowStyle) }}>
          <span style={{ fontFamily: 'Archivo', fontSize: 9.5, color: '#8a8070', lineHeight: 1.25, textAlign: 'left', width: 46, flex: 'none' }}>Noise<br />Depth</span>
          <div>
            <div style={{ display: 'flex', gap: 3, background: paperCtl, borderRadius: 8, padding: 3 }}>
              {c.belowOpts!.map((o) => (
                <div key={o.value} onClick={() => setVal('pre.noiseDepth', o.value)} style={css(o.style)}>{o.label}</div>
              ))}
            </div>
            <div style={{ fontFamily: 'Archivo', fontSize: 9.5, color: '#8a8070', textAlign: 'center', marginTop: 5 }}>{c.belowDesc}</div>
          </div>
        </div>
      )}
    </div>
  );
}



// v0.2.31: Pre(II) 전용 레이아웃 — Denoise 스위치(옆 설명) → Noise Depth → 그 아래 노브 3개(가로).
function PreControls({ view }: { view: DeskView }) {
  const denoise = view.controls.find((c) => c.key === 'denoise');
  const knobs = view.controls.filter((c) => c.isRot); // Noise Reduction, Fade In, Fade Out
  const preAnalysis = useAppStore((s) => s.preAnalysis);
  const setVal = useAppStore((s) => s.setVal);
  const currentDepth = useAppStore((s) => s.vals['pre.noiseDepth']);
  const currentAmt = useAppStore((s) => s.vals['pre.denoiseAmt']);

  let recommendationHtml = null;
  if (denoise?.on && preAnalysis) {
    const rec = getDenoiseRecommendation(preAnalysis.snrDb, preAnalysis.floorDb);
    const depthLabel = rec.depth === '1' ? 'Original' : rec.depth === '3' ? 'Deep' : 'Normal';
    const isApplied = String(currentDepth) === rec.depth && Number(currentAmt) === rec.amount;

    recommendationHtml = (
      <div style={{
        marginTop: 6,
        padding: '6px 10px',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(58, 52, 43, 0.12)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        maxWidth: 320
      }}>
        <div style={{ fontFamily: 'Archivo', fontSize: 9.5, color: '#8a8070', lineHeight: 1.35 }}>
          Recommended: <span style={{ fontWeight: 'bold', color: view.accent }}>{depthLabel}</span> (Depth) & <span style={{ fontWeight: 'bold', color: view.accent }}>{rec.amount}%</span> (Amt)
          <div style={{ fontSize: 8.5, color: '#a99f8a', marginTop: 1 }}>SNR: {preAnalysis.snrDb.toFixed(1)} dB</div>
          <div
            style={{
              fontFamily: 'Archivo',
              fontSize: 9.5,
              fontWeight: 'bold',
              color: rec.color || view.accent,
              animation: 'dkblink 1.2s infinite alternate',
              marginTop: 4
            }}
          >
            Suggested: {rec.text}
          </div>
        </div>
        {isApplied ? (
          <div
            style={{
              fontFamily: 'Archivo',
              fontSize: 9,
              fontWeight: 700,
              color: '#46c06a',
              background: 'rgba(70, 192, 106, 0.1)',
              border: '1px solid rgba(70, 192, 106, 0.25)',
              borderRadius: 6,
              padding: '4px 8px',
              whiteSpace: 'nowrap'
            }}
          >
            ✓ Applied
          </div>
        ) : (
          <button
            onClick={() => {
              setVal('pre.noiseDepth', rec.depth);
              setVal('pre.denoiseAmt', rec.amount);
            }}
            style={{
              fontFamily: 'Archivo',
              fontSize: 9,
              fontWeight: 700,
              color: view.pal.pSeg,
              background: view.pal.paperCtl,
              border: '1px solid rgba(58, 52, 43, 0.15)',
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Apply
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
        {denoise && <div style={{ flex: 'none' }}><ControlItem c={denoise} view={view} /></div>}
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 1 }}>
          <div style={{ whiteSpace: 'nowrap', fontFamily: 'Archivo', fontSize: 9.5, lineHeight: 1.45, color: '#8a8070' }}>
            Note: The <span style={{ fontWeight: 'bold', color: '#a99f8a' }}>denoise</span> feature is processing-intensive and may take a while.
          </div>
          {recommendationHtml}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '16px 22px' }}>
        {knobs.map((c) => <ControlItem key={c.key} c={c} view={view} />)}
      </div>
    </div>
  );
}

function InputPanels({ view }: { view: DeskView }) {
  const pal = view.pal;
  return (
    <>
      <div style={{ marginTop: 10, borderTop: '1px solid rgba(58,52,43,0.14)', paddingTop: 8 }}>
        <div style={{ fontFamily: 'Archivo', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: '#a99f8a', marginBottom: 6 }}>BATCH INFO</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ flex: 'none', color: view.accent }}><DeskIcon icon="note" size={14} /></span><span style={{ fontFamily: 'Archivo', fontSize: 10.5, color: pal.pInk2 }}>Total tracks</span></div>
          <span style={{ fontFamily: 'Archivo', fontSize: 13, fontWeight: 700, color: pal.pInk }}>{view.batchCount} files · {view.batchSize}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" style={{ flex: 'none', color: view.accent }}><path d="M3 7a2 2 0 0 1 2-2h4l2 2.4h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            <span style={{ fontFamily: 'Archivo', fontSize: 10.5, color: pal.pInk2 }}>Working folder</span>
          </div>
          <span style={{ fontFamily: 'Archivo', fontSize: 12, fontWeight: 500, color: pal.pInk, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{view.workFolder}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ flex: 'none', color: view.accent }}><DeskIcon icon="export" size={14} /></span><span style={{ fontFamily: 'Archivo', fontSize: 10.5, color: pal.pInk2 }}>Decode format</span></div>
          <span style={{ fontFamily: 'Archivo', fontSize: 12, fontWeight: 500, color: pal.pInk }}>PCM {view.inputFmt}</span>
        </div>
      </div>

      <div style={{ marginTop: 8, borderTop: '1px solid rgba(58,52,43,0.14)', paddingTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontFamily: 'Archivo', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: '#a99f8a' }}>NOW SELECTED</span>
          <span style={{ fontFamily: 'Archivo', fontSize: 10.5, color: pal.pInk2 }}>{view.sel.dur} · {view.sel.size}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, flex: 'none', display: 'grid', placeItems: 'center', color: pal.aInk, background: view.accent }}><DeskIcon icon="note" size={16} /></div>
          <span style={{ flex: '1 1 auto', minWidth: 0, fontFamily: 'Archivo', fontSize: 14, fontWeight: 600, color: pal.pInk, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{view.sel.name}</span>
          <div style={{ flex: '0 0 auto', display: 'flex', flexWrap: 'nowrap', gap: 6, justifyContent: 'flex-end' }}>
            {view.selChips.map((ch, i) => (
              <span key={i} style={{ fontFamily: 'Archivo', fontSize: 10, fontWeight: 600, color: pal.pSeg, background: pal.paperCtl, borderRadius: 6, padding: '5px 10px', whiteSpace: 'nowrap' }}>{ch.label}</span>
            ))}
            <span style={{ fontFamily: 'Archivo', fontSize: 10, fontWeight: 700, color: view.selLufsColor, background: pal.paperCtl, borderRadius: 6, padding: '5px 10px', whiteSpace: 'nowrap' }}>{view.sel.lufs} LUFS</span>
          </div>
        </div>
      </div>
    </>
  );
}

function DynamicsExtra({ view }: { view: DeskView }) {
  const pal = view.pal;
  return (
    <div style={{ marginTop: 12, flex: 1, borderRadius: 12, padding: '13px 15px', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: 14, ...css(view.insetBg) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {view.dynTrans?.knob && <Knob vm={view.dynTrans.knob} size={48} sw={3.6} trackSw={3.6} />}
          <div style={{ fontFamily: 'Archivo', fontSize: 8.5, color: '#8a8070', marginTop: 3 }}>Transient</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}><span style={{ fontFamily: 'Archivo', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#8a8070' }}>TRANSIENT</span><span style={{ fontFamily: 'Archivo', fontSize: 11, fontWeight: 700, color: pal.aBright }}>{view.transLabel}</span></div>
          <svg width="100%" height="50" viewBox="0 0 212 54" preserveAspectRatio="none" style={{ display: 'block' }}>
            <line x1="0" y1="27" x2="212" y2="27" stroke="rgba(255,240,210,0.12)" strokeDasharray="2 3" />
            <path d={view.transPath} fill={pal.aMain} opacity="0.5" />
            <path d={view.transPath} fill="none" stroke={pal.aBright} strokeWidth="1.3" />
          </svg>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {view.dynExc?.knob && <Knob vm={view.dynExc.knob} size={48} sw={3.6} trackSw={3.6} />}
          <div style={{ fontFamily: 'Archivo', fontSize: 8.5, color: '#8a8070', marginTop: 3 }}>Exciter</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}><span style={{ fontFamily: 'Archivo', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#8a8070' }}>EXCITER · HARMONICS</span><span style={{ fontFamily: 'Archivo', fontSize: 11, fontWeight: 700, color: pal.aBright }}>{view.exLabel}</span></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 5, height: 46 }}>
            {view.exciterBars.map((h: any, i: number) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <div style={css(h.barStyle)} />
                <span style={{ fontFamily: 'Archivo', fontSize: 7, color: '#8a8070', marginTop: 3 }}>{h.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpectralControls({ view }: { view: DeskView }) {
  const pal = view.pal;
  const applyPreset = useAppStore((s) => s.applyPreset);
  const recallUserPreset = useAppStore((s) => s.recallUserPreset);
  const saveUserPreset = useAppStore((s) => s.saveUserPreset);
  const renameUserPreset = useAppStore((s) => s.renameUserPreset);
  const toggleAdv = useAppStore((s) => s.toggleAdv);

  const [openMenuIdx, setOpenMenuIdx] = useState<number | null>(null);
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [tempName, setTempName] = useState<string>('');
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (openMenuIdx !== null && menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenuIdx(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openMenuIdx]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
        <span style={{ fontFamily: 'Archivo', fontSize: 9.5, color: '#8a8070' }}>
          Preset ·{' '}
          {view.isEqEdited ? (
            <span
              style={{
                fontWeight: 700,
                color: '#9a6fd0',
                display: 'inline-block',
              }}
            >
              Edited
            </span>
          ) : (
            <span style={{ fontWeight: 700, color: view.presetColor }}>
              {view.presetName}
            </span>
          )}
        </span>
        <button onClick={toggleAdv} style={css(view.advBtnStyle)}>{view.advLabel}</button>
      </div>
      {view.eqShowPresets && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 9 }}>
            {view.presetCards.map((p: any) => (
              <div key={p.name} onClick={() => applyPreset(p.name)} style={css(p.cardStyle)}>
                <span style={css(p.dotStyle)} />
                <span style={{ fontFamily: 'Archivo', fontSize: 12.5, fontWeight: 700, color: p.nameColor }}>{p.name}</span>
                <span style={{ fontFamily: 'Archivo', fontSize: 8.5, color: '#8a8070', textAlign: 'center', lineHeight: 1.3 }}>{p.desc}</span>
              </div>
            ))}
          </div>

          {/* User Subpresets Expansion Panel */}
          {view.isUserActive && (
            <div
              ref={menuContainerRef}
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 12,
                borderTop: '1px solid rgba(58,52,43,0.12)',
                paddingTop: 12,
              }}
            >
              {view.userPresets.map((up: any, idx: number) => {
                const isSelected = view.activeUserPresetIdx === idx;
                const textColor = isSelected ? pal.aMain : pal.pInk;
                const cardStyle = `
                  flex: 1;
                  min-width: 0;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  gap: 6px;
                  padding: 12px 6px;
                  border-radius: 9px;
                  cursor: pointer;
                  position: relative;
                  background: ${isSelected ? 'rgba(58,52,43,0.05)' : 'transparent'};
                  box-shadow: inset 0 0 0 ${isSelected ? 2 : 1.2}px ${isSelected ? pal.aMain : 'rgba(58,52,43,0.14)'}${isSelected ? ',0 4px 12px -5px ' + pal.aMain : ''};
                `;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (renamingIdx !== idx) {
                        recallUserPreset(idx);
                      }
                    }}
                    style={css(cardStyle)}
                  >
                    <span
                      style={css(
                        `width:7px;height:7px;border-radius:50%;background:${isSelected ? pal.aMain : 'rgba(58,52,43,0.25)'};` +
                          (isSelected ? `box-shadow:0 0 6px ${pal.aMain};` : '')
                      )}
                    />
                    {renamingIdx === idx ? (
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onBlur={() => {
                          if (tempName.trim() !== '') {
                            renameUserPreset(idx, tempName.trim());
                          }
                          setRenamingIdx(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (tempName.trim() !== '') {
                              renameUserPreset(idx, tempName.trim());
                            }
                            setRenamingIdx(null);
                          } else if (e.key === 'Escape') {
                            setRenamingIdx(null);
                          }
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          fontFamily: 'Archivo',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: textColor,
                          textAlign: 'center',
                          width: '100%',
                          background: 'rgba(0,0,0,0.05)',
                          border: `1px solid ${pal.aMain}`,
                          borderRadius: '4px',
                          outline: 'none',
                          padding: '2px 0',
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          fontFamily: 'Archivo',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: textColor,
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '100%',
                          padding: '0 4px',
                        }}
                        title={up.name}
                      >
                        {up.name}
                      </span>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuIdx(openMenuIdx === idx ? null : idx);
                      }}
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: 'none',
                        background: openMenuIdx === idx ? 'rgba(0,0,0,0.08)' : 'transparent',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        fontFamily: 'Archivo',
                        fontSize: 10,
                        fontWeight: 700,
                        color: pal.pInk2,
                        outline: 'none',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                      }}
                      onMouseLeave={(e) => {
                        if (openMenuIdx !== idx) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      ⋮
                    </button>

                    {openMenuIdx === idx && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: '50%',
                          transform: 'translateX(-50%) translateY(-6px)',
                          background: pal.paperInput,
                          borderRadius: 6,
                          boxShadow: '0 4px 14px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.12)',
                          zIndex: 999,
                          minWidth: 96,
                          padding: '3px 0',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setTempName(up.name);
                            setRenamingIdx(idx);
                            setOpenMenuIdx(null);
                          }}
                          style={{
                            padding: '6px 10px',
                            fontFamily: 'Archivo',
                            fontSize: 10,
                            fontWeight: 600,
                            color: pal.pInk,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            textAlign: 'left',
                            borderBottom: '1px solid rgba(58,52,43,0.08)',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          Preset Name
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            saveUserPreset(idx);
                            setOpenMenuIdx(null);
                          }}
                          style={{
                            padding: '6px 10px',
                            fontFamily: 'Archivo',
                            fontSize: 10,
                            fontWeight: 600,
                            color: pal.pInk,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          Save
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {view.eqAdvanced && (
        <div style={{ display: 'flex', gap: 7, justifyContent: 'space-between' }}>
          {view.eqColumns.map((col: any) => (
            <div key={col.num} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 3px 7px', borderRadius: 11, background: 'rgba(58,52,43,0.05)', boxShadow: 'inset 0 2px 5px rgba(58,52,43,0.2),inset 0 -1px 0 rgba(255,255,255,0.5)', border: '1px solid rgba(58,52,43,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: col.color, flex: 'none' }} /><span style={{ fontFamily: 'Archivo', fontSize: 8.5, fontWeight: 700, color: pal.pInk }}>{col.num}</span><span style={{ fontFamily: 'Archivo', fontSize: 7.5, color: '#8a8070', whiteSpace: 'nowrap' }}>{col.type}</span></div>
              {col.ctls.map((c: Control) => (
                <div key={c.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Knob vm={c.knob!} size={37} sw={4} trackSw={4} />
                  <div style={{ textAlign: 'center', fontFamily: 'Archivo', fontSize: 9.5, fontWeight: 700, color: c.knob!.valColor, lineHeight: 1.1 }}>{c.knob!.display} <span style={{ fontFamily: 'Archivo', fontSize: 7.5, fontWeight: 400, color: '#8a8070' }}>{c.knob!.unitText}</span></div>
                  <div style={{ textAlign: 'center', fontFamily: 'Archivo', fontSize: 7.5, color: '#8a8070', lineHeight: 1 }}>{c.label}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ExportMeta({ view }: { view: DeskView }) {
  const pal = view.pal;
  const setVal = useAppStore((s) => s.setVal);
  // v0.8.0 (Phase 7): Export 실행 상태/액션
  const exporting = useAppStore((s) => s.exporting);
  const exportTotal = useAppStore((s) => s.exportTotal);
  const exportDone = useAppStore((s) => s.exportDone);
  const exportCurrentName = useAppStore((s) => s.exportCurrentName);
  const exportError = useAppStore((s) => s.exportError);
  const exportLastPath = useAppStore((s) => s.exportLastPath);
  const fileCount = useAppStore((s) => s.files.length);
  const exportSelected = useAppStore((s) => s.exportSelected);
  const exportBatch = useAppStore((s) => s.exportBatch);
  const cancelExport = useAppStore((s) => s.cancelExport);
  const revealLastExport = useAppStore((s) => s.revealLastExport);

  const pct = exportTotal > 0 ? Math.min(100, Math.round((exportDone / exportTotal) * 100)) : 0;
  const btn: CSSProperties = { fontFamily: 'Archivo', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', border: 'none', textAlign: 'center' };
  const canExport = fileCount > 0 && !exporting;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', alignContent: 'start' }}>
        {view.metaFields.map((f: any) => (
          <div key={f.key} style={css(f.wrap)}>
            <div style={{ fontFamily: 'Archivo', fontSize: 9.5, color: '#8a8070', marginBottom: 2 }}>{f.label}</div>
            {f.isText ? (
              <input className="dk-in" value={f.value} placeholder={f.ph} onChange={(e) => setVal(f.fk, e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: pal.paperInput, border: '1px solid #cdbfa4', borderRadius: 7, padding: '5px 10px', color: pal.pInk, fontSize: 12.5, outline: 'none' }} />
            ) : (
              <div style={{ display: 'flex', gap: 3, background: pal.paperCtl, borderRadius: 8, padding: 3 }}>
                {f.opts.map((o: any) => (
                  <div key={o.value} onClick={() => setVal(f.fk, o.value)} style={css(o.style)}>{o.label}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* v0.8.0 (Phase 7): Export 액션 바 — 단일/배치 + 진행률·취소·에러 */}
      <div style={{ marginTop: 'auto', paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {exportError && (
          <div style={{ fontFamily: 'Archivo', fontSize: 10, lineHeight: 1.45, color: '#e0344b', whiteSpace: 'pre-wrap', maxHeight: 54, overflow: 'auto' }}>{exportError}</div>
        )}
        {exporting ? (
          <>
            <div style={{ height: 8, borderRadius: 5, background: pal.paperCtl, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: view.accent, transition: 'width 0.2s' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0, fontFamily: 'Archivo', fontSize: 10, color: pal.pInk2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {exportDone}/{exportTotal} · {exportCurrentName || 'Rendering…'}
              </span>
              <button onClick={cancelExport} style={{ ...btn, padding: '7px 12px', color: pal.pInk, background: pal.paperCtl }}>Cancel</button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => void exportSelected()} disabled={!canExport} style={{ ...btn, flex: 1, color: pal.aInk, background: view.accent, opacity: canExport ? 1 : 0.45, cursor: canExport ? 'pointer' : 'default' }}>EXPORT SELECTED</button>
            <button onClick={() => void exportBatch()} disabled={!canExport} style={{ ...btn, flex: 1, color: pal.pInk, background: pal.paperCtl, opacity: canExport ? 1 : 0.45, cursor: canExport ? 'pointer' : 'default' }}>EXPORT ALL ({fileCount})</button>
          </div>
        )}
        {!exporting && exportLastPath && (
          <button onClick={revealLastExport} style={{ ...btn, padding: '6px 10px', fontWeight: 600, fontSize: 10, color: pal.pInk2, background: 'transparent', textAlign: 'left' }}>↳ Reveal last export</button>
        )}
      </div>
    </div>
  );
}

function LoudnessControls({ view }: { view: DeskView }) {
  const ceiling = view.controls.find((c) => c.key === 'ceiling');
  const target = view.controls.find((c) => c.key === 'target');
  const sat = view.controls.find((c) => c.key === 'sat');
  const limiter = view.controls.find((c) => c.key === 'limiter');
  const tplimit = view.controls.find((c) => c.key === 'tplimit');

  return (
    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Row 1: TP Limit, True Peak & LUFS */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        {tplimit && <ControlItem c={tplimit} view={view} />}
        {ceiling && <ControlItem c={ceiling} view={view} />}
        {target && <ControlItem c={target} view={view} />}
      </div>
      {/* Row 2: Saturate & Limiter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        {sat && <ControlItem c={sat} view={view} />}
        {limiter && <ControlItem c={limiter} view={view} />}
      </div>
    </div>
  );
}

export function Controls({ view }: { view: DeskView }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontFamily: 'Archivo', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: '#a99f8a', marginBottom: 11 }}>PARAMETERS</div>

      {view.isPre ? (
        <PreControls view={view} />
      ) : view.isLoudness ? (
        <LoudnessControls view={view} />
      ) : view.genCtrl && (
        <div style={{ flex: 'none', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '16px 22px', alignContent: 'flex-start' }}>
          {view.controls.map((c) => <ControlItem key={c.key} c={c} view={view} />)}
        </div>
      )}
      {view.isInput && <InputPanels view={view} />}
      {view.isDynamics && <DynamicsExtra view={view} />}
      {view.isSpectral && <SpectralControls view={view} />}
      {view.isExport && <ExportMeta view={view} />}
    </div>
  );
}
