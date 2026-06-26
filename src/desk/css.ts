// FocusDAW Mastering Desk v0.1.1 (Phase 0 UI) - 인라인 CSS 문자열 → React style 객체 변환
// compute.ts 가 원본과 동일한 "prop:val;prop:val" 문자열을 생성하므로, 렌더 시 객체로 변환해 사용한다.
import type { CSSProperties } from 'react';

export function css(text?: string): CSSProperties {
  const out: Record<string, string> = {};
  if (!text) return out as CSSProperties;
  for (const decl of text.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!prop) continue;
    const key = prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[key] = val;
  }
  return out as CSSProperties;
}
