// FocusDAW Mastering Desk v0.1.1 (Phase 0 UI) - 노브 SVG (원본 이식)
// data-knob-* 속성으로 전역 드래그/휠 핸들러(useKnob)와 연동. 고정 노브는 fk='' 라 무시된다.
import { css } from '../../desk/css';
import type { Knob as KnobVM } from '../../desk/compute';

const rotTrack = 'M 12.44 36.56 A 22 22 0 1 1 43.56 36.56'; // arc(22,-135,135)

export function Knob({ vm, size, sw, trackSw }: { vm: KnobVM; size: number; sw: number; trackSw: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      data-knob-key={vm.fk}
      data-knob-min={vm.kmin}
      data-knob-max={vm.kmax}
      data-knob-step={vm.kstep}
      style={{ touchAction: 'none', display: 'block', margin: '0 auto', ...css(vm.knobStyle) }}
    >
      <path d={rotTrack} fill="none" stroke="#cdbfa4" strokeWidth={trackSw} strokeLinecap="round" />
      {vm.arc && <path d={vm.arc} fill="none" stroke={vm.arcColor} strokeWidth={sw} strokeLinecap="round" />}
      <circle cx="28" cy="28" r="17" fill="url(#dk-cap)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <ellipse cx="28" cy="23" rx="11" ry="6" fill="rgba(255,245,225,0.07)" />
      <line x1={vm.px1} y1={vm.py1} x2={vm.px2} y2={vm.py2} stroke="#f3ecdd" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
