// FocusDAW Mastering Desk v0.1.1 (Phase 0 UI) - 노브 드래그/휠 전역 핸들러 (원본 componentDidMount 이식)
// data-knob-key/min/max/step 속성을 가진 SVG 노브를 세로 드래그(범위/140px)·휠(1스텝)로 조절.
import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { DEFAULT_STATE } from './data';

export function useKnobInteractions() {
  useEffect(() => {
    const store = useAppStore.getState;
    let wheelLast = 0;

    const onWheel = (e: WheelEvent) => {
      const t = e.target as HTMLElement | null;
      const k = t?.closest?.('[data-knob-key]') as HTMLElement | null;
      if (!k) return;
      const fk = k.getAttribute('data-knob-key');
      if (!fk) return;
      e.preventDefault();
      const now = Date.now();
      if (wheelLast && now - wheelLast < 70) return;
      wheelLast = now;
      const min = parseFloat(k.getAttribute('data-knob-min')!);
      const max = parseFloat(k.getAttribute('data-knob-max')!);
      const step = parseFloat(k.getAttribute('data-knob-step')!) || 1;
      const dir = e.deltaY < 0 ? 1 : -1;
      let v = (Number(store().vals[fk]) || 0) + dir * step;
      v = Math.max(min, Math.min(max, v));
      store().setVal(fk, Number(v.toFixed(4)));
    };

    const onPdown = (e: PointerEvent) => {
      if (e.button != null && e.button !== 0) return;
      const t = e.target as HTMLElement | null;
      const k = t?.closest?.('svg[data-knob-key]') as HTMLElement | null;
      if (!k) return;
      const fk = k.getAttribute('data-knob-key');
      if (!fk) return; // fixed/disabled knobs emit empty key
      e.preventDefault();
      e.stopPropagation();
      const min = parseFloat(k.getAttribute('data-knob-min')!);
      const max = parseFloat(k.getAttribute('data-knob-max')!);
      const step = parseFloat(k.getAttribute('data-knob-step')!) || 0;
      const sy = e.clientY;
      const start = Number(store().vals[fk]);
      store().pushUndoSnap(); // Drag start snapshot (v0.8.9)
      const mv = (ev: PointerEvent) => {
        let v = start + ((sy - ev.clientY) / 140) * (max - min);
        v = Math.max(min, Math.min(max, v));
        if (step) v = Math.round(v / step) * step;
        store().setVal(fk, Number(v.toFixed(4)), true); // skipUndo during drag
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    };

    const onDblClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      const k = t?.closest?.('[data-knob-key]') as HTMLElement | null;
      if (!k) return;
      const fk = k.getAttribute('data-knob-key');
      if (!fk) return;
      const def = DEFAULT_STATE.vals[fk];
      if (typeof def !== 'number') return;
      e.preventDefault();
      store().setVal(fk, def);
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointerdown', onPdown, true);
    window.addEventListener('dblclick', onDblClick, true);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointerdown', onPdown, true);
      window.removeEventListener('dblclick', onDblClick, true);
    };
  }, []);
}
