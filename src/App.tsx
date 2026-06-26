// FocusDAW Mastering Desk v0.1.1 (Phase 0 UI) - 앱 셸 (원본 윈도우 카드 구조 그대로)
// 전체 윈도우 프레임(1208px 카드) 안에 타이틀바 → 트랜스포트 → 데스크 → 상세 시트 → 푸터.
import { useMemo } from 'react';
import { useAppStore } from './store/appStore';
import { computeView } from './desk/compute';
import { useKnobInteractions } from './desk/useKnob';
import { IconDefs } from './ui/Icons';
import { TitleBar } from './ui/desk/TitleBar';
import { TransportBar } from './ui/desk/TransportBar';
import { Desk } from './ui/desk/Desk';
import { DetailSheet } from './ui/desk/DetailSheet';
import { Footer } from './ui/desk/Footer';

export default function App() {
  useKnobInteractions();

  const open = useAppStore((s) => s.open);
  const curFile = useAppStore((s) => s.curFile);
  const openMenu = useAppStore((s) => s.openMenu);
  const eqAdvanced = useAppStore((s) => s.eqAdvanced);
  const enabled = useAppStore((s) => s.enabled);
  const vals = useAppStore((s) => s.vals);
  const theme = useAppStore((s) => s.theme);

  const view = useMemo(
    () => computeView({ open, curFile, openMenu, eqAdvanced, enabled, vals }, theme),
    [open, curFile, openMenu, eqAdvanced, enabled, vals, theme],
  );

  return (
    <div style={{ minHeight: '100vh', background: view.pal.page, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <IconDefs />
      <div style={{ width: 1208, background: view.pal.frame, border: '1px solid #000', borderRadius: 12, boxShadow: '0 44px 100px -34px rgba(0,0,0,0.9)', overflow: 'hidden' }}>
        <TitleBar view={view} />
        <TransportBar view={view} />
        <Desk view={view} />
        <DetailSheet view={view} />
        <Footer view={view} />
      </div>
    </div>
  );
}
