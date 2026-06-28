// FocusDAW Mastering Desk v0.8.4 (Phase 7, 단계 7-E) - ID3v2.3 태그 빌더 (의존성 0)
// MP3 앞에 붙일 ID3v2.3.0 태그를 만든다. 텍스트 프레임은 UTF-16(BOM) 인코딩(0x01)으로 한글 등
// 유니코드를 안전하게 담는다. APIC(앨범 아트)는 ISO-8859-1(0x00) 헤더 + 바이너리 이미지.
export type Id3Tags = {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  artwork?: { mime: string; data: Uint8Array } | null;
};

// UTF-16LE + BOM 바이트열(서로게이트 쌍 처리).
function encodeUtf16(text: string): Uint8Array {
  const bytes: number[] = [0xff, 0xfe]; // BOM(LE)
  for (const cp of text) {
    let c = cp.codePointAt(0)!;
    if (c > 0xffff) {
      c -= 0x10000;
      const hi = 0xd800 + (c >> 10);
      const lo = 0xdc00 + (c & 0x3ff);
      bytes.push(hi & 0xff, (hi >> 8) & 0xff, lo & 0xff, (lo >> 8) & 0xff);
    } else {
      bytes.push(c & 0xff, (c >> 8) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

// ID3v2.3 프레임: id(4) + size(4, big-endian 일반) + flags(2) + body.
function frame(id: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(10 + body.length);
  for (let i = 0; i < 4; i++) out[i] = id.charCodeAt(i);
  const sz = body.length;
  out[4] = (sz >>> 24) & 0xff;
  out[5] = (sz >>> 16) & 0xff;
  out[6] = (sz >>> 8) & 0xff;
  out[7] = sz & 0xff;
  // flags(8,9) = 0
  out.set(body, 10);
  return out;
}

function textFrame(id: string, text: string): Uint8Array | null {
  if (!text) return null;
  const enc = encodeUtf16(text);
  const body = new Uint8Array(1 + enc.length);
  body[0] = 0x01; // UTF-16(BOM)
  body.set(enc, 1);
  return frame(id, body);
}

function apicFrame(mime: string, data: Uint8Array): Uint8Array {
  const head: number[] = [0x00]; // 인코딩 ISO-8859-1 (description 종단 = 단일 0x00)
  for (let i = 0; i < mime.length; i++) head.push(mime.charCodeAt(i) & 0xff);
  head.push(0x00); // MIME 종단
  head.push(0x03); // picture type: 3 = front cover
  head.push(0x00); // description(빈 문자열) 종단
  const body = new Uint8Array(head.length + data.length);
  body.set(head, 0);
  body.set(data, head.length);
  return frame('APIC', body);
}

/** ID3v2.3.0 태그 바이트. 담을 내용이 없으면 빈 배열. */
export function buildId3v2(tags: Id3Tags): Uint8Array {
  const frames: Uint8Array[] = [];
  const push = (f: Uint8Array | null) => { if (f) frames.push(f); };
  push(textFrame('TIT2', tags.title || ''));
  push(textFrame('TPE1', tags.artist || ''));
  push(textFrame('TALB', tags.album || ''));
  push(textFrame('TYER', tags.year || ''));
  push(textFrame('TCON', tags.genre || ''));
  if (tags.artwork && tags.artwork.data.length) push(apicFrame(tags.artwork.mime, tags.artwork.data));

  const bodyLen = frames.reduce((n, f) => n + f.length, 0);
  if (bodyLen === 0) return new Uint8Array(0);

  const out = new Uint8Array(10 + bodyLen);
  out[0] = 0x49; out[1] = 0x44; out[2] = 0x33; // "ID3"
  out[3] = 0x03; out[4] = 0x00;                // v2.3.0
  out[5] = 0x00;                               // flags
  // 헤더 size 는 synchsafe(7bit×4)
  out[6] = (bodyLen >>> 21) & 0x7f;
  out[7] = (bodyLen >>> 14) & 0x7f;
  out[8] = (bodyLen >>> 7) & 0x7f;
  out[9] = bodyLen & 0x7f;
  let off = 10;
  for (const f of frames) { out.set(f, off); off += f.length; }
  return out;
}

/** "data:image/png;base64,..." → { mime, data }. 파싱 실패 시 null. */
export function parseDataUrl(dataUrl: string | null | undefined): { mime: string; data: Uint8Array } | null {
  if (!dataUrl) return null;
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const mime = m[1] || 'image/jpeg';
  try {
    if (m[2]) {
      const bin = atob(m[3]);
      const data = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
      return { mime, data };
    }
    // 비-base64 data URL(드묾): URI 디코드 후 latin1
    const txt = decodeURIComponent(m[3]);
    const data = new Uint8Array(txt.length);
    for (let i = 0; i < txt.length; i++) data[i] = txt.charCodeAt(i) & 0xff;
    return { mime, data };
  } catch {
    return null;
  }
}
