// FocusDAW Mastering Desk v0.8.5 (Phase 7, 단계 7-E) - FLAC 인코더 (libflacjs 저수준 API)
// 렌더 결과(RenderedAudio) → Int32 PCM(채널별) → libflacjs(자체완결 asm.js dist) 저수준 인코더 →
// FLAC 스트림. 태그(Vorbis comment)·아트워크(PICTURE)는 인코딩 후 메타데이터 블록을 직접 삽입한다.
//
// v0.8.5: 고수준 래퍼 `libflacjs/lib/encoder`(UMD, 내부 `require('./utils/data-utils')`)가 Vite/rolldown
//   번들에서 런타임 require 오류를 내므로, **자체완결 `dist/libflac.js` 저수준 API 만 사용**하도록 교체.
//   (create_libflac_encoder → init_encoder_stream(write cb) → process → finish → delete)
import type { RenderedAudio } from './renderOffline';
import type { Id3Tags } from './id3';

// dist/libflac.js 가 노출하는 저수준 함수 일부(필요한 것만).
type FlacLib = {
  isReady(): boolean;
  onready: (() => void) | null;
  create_libflac_encoder(sampleRate: number, channels: number, bps: number, compression: number, totalSamples: number, verify: boolean): number;
  init_encoder_stream(encoder: number, write: (data: Uint8Array) => void, metadata?: (() => void) | null): number;
  FLAC__stream_encoder_process(encoder: number, channelBuffers: Int32Array[], samples: number): boolean;
  FLAC__stream_encoder_finish(encoder: number): boolean;
  FLAC__stream_encoder_delete(encoder: number): void;
  FLAC__stream_encoder_get_state(encoder: number): number;
};

// FLAC 는 정수 PCM 만 지원. Input PCM 16/24 그대로, 32f(float)는 24-bit 정수로.
function flacBitsFromInput(value: unknown): 16 | 24 {
  return value === '16' ? 16 : 24;
}

function floatToInt32(f: Float32Array, bps: number): Int32Array {
  const scale = 1 << (bps - 1);
  const max = scale - 1, min = -scale;
  const out = new Int32Array(f.length);
  for (let i = 0; i < f.length; i++) {
    let s = f[i];
    s = s > 1 ? 1 : s < -1 ? -1 : s;
    let v = Math.round(s * scale);
    v = v > max ? max : v < min ? min : v;
    out[i] = v;
  }
  return out;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

// libflacjs(자체완결 asm.js, ~1MB)는 FLAC Export 시에만 동적 로드(메인 번들·기동 비용 절감).
let flacLib: FlacLib | null = null;
async function loadFlac(): Promise<FlacLib> {
  if (!flacLib) {
    const mod = (await import('libflacjs/dist/libflac.js')) as unknown as { default?: FlacLib } & FlacLib;
    flacLib = (mod.default ?? mod) as FlacLib;
  }
  if (!flacLib.isReady()) await new Promise<void>((resolve) => { flacLib!.onready = () => resolve(); });
  return flacLib;
}

// ── 메타데이터 블록(인코딩 후 삽입) ─────────────────────────────────────────
function buildVorbisComment(tags: Id3Tags): Uint8Array {
  const enc = new TextEncoder();
  const vendor = enc.encode('FocusDAW Mastering Desk');
  const comments: Uint8Array[] = [];
  const add = (k: string, v?: string) => { if (v) comments.push(enc.encode(`${k}=${v}`)); };
  add('TITLE', tags.title);
  add('ARTIST', tags.artist);
  add('ALBUM', tags.album);
  add('DATE', tags.year);
  add('GENRE', tags.genre);
  const size = 4 + vendor.length + 4 + comments.reduce((n, c) => n + 4 + c.length, 0);
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  let o = 0;
  dv.setUint32(o, vendor.length, true); o += 4; out.set(vendor, o); o += vendor.length;   // LE
  dv.setUint32(o, comments.length, true); o += 4;
  for (const c of comments) { dv.setUint32(o, c.length, true); o += 4; out.set(c, o); o += c.length; }
  return out;
}

function buildPicture(mime: string, data: Uint8Array): Uint8Array {
  const mimeBytes = new TextEncoder().encode(mime);
  const desc = new Uint8Array(0);
  const head = 4 + (4 + mimeBytes.length) + (4 + desc.length) + 16 + 4;
  const out = new Uint8Array(head + data.length);
  const dv = new DataView(out.buffer);
  let o = 0;
  dv.setUint32(o, 3); o += 4;                              // picture type 3 = front cover (BE)
  dv.setUint32(o, mimeBytes.length); o += 4; out.set(mimeBytes, o); o += mimeBytes.length;
  dv.setUint32(o, desc.length); o += 4; out.set(desc, o); o += desc.length;
  dv.setUint32(o, 0); o += 4; // width
  dv.setUint32(o, 0); o += 4; // height
  dv.setUint32(o, 0); o += 4; // color depth
  dv.setUint32(o, 0); o += 4; // colors used
  dv.setUint32(o, data.length); o += 4; out.set(data, o);
  return out;
}

// FLAC 메타데이터 체인을 파싱해 기존 VORBIS_COMMENT(4)/PICTURE(6)를 제거하고 새 블록을 삽입한다.
function injectFlacMetadata(flac: Uint8Array, vorbis: Uint8Array, picture: Uint8Array | null): Uint8Array {
  if (!(flac[0] === 0x66 && flac[1] === 0x4c && flac[2] === 0x61 && flac[3] === 0x43)) return flac; // "fLaC" 아니면 그대로
  let p = 4;
  const blocks: { type: number; data: Uint8Array }[] = [];
  let audioStart = flac.length;
  while (p + 4 <= flac.length) {
    const b0 = flac[p];
    const last = (b0 & 0x80) !== 0;
    const type = b0 & 0x7f;
    const len = (flac[p + 1] << 16) | (flac[p + 2] << 8) | flac[p + 3];
    const dataStart = p + 4;
    blocks.push({ type, data: flac.subarray(dataStart, dataStart + len) });
    p = dataStart + len;
    if (last) { audioStart = p; break; }
  }
  const audio = flac.subarray(audioStart);
  const kept = blocks.filter((b) => b.type !== 4 && b.type !== 6); // 기존 vorbis/picture 제거
  const finalBlocks: { type: number; data: Uint8Array }[] = [];
  const si = kept.find((b) => b.type === 0);
  if (si) finalBlocks.push(si);
  for (const b of kept) if (b.type !== 0) finalBlocks.push(b);
  finalBlocks.push({ type: 4, data: vorbis });
  if (picture) finalBlocks.push({ type: 6, data: picture });

  const parts: Uint8Array[] = [new Uint8Array([0x66, 0x4c, 0x61, 0x43])];
  finalBlocks.forEach((b, i) => {
    const isLast = i === finalBlocks.length - 1;
    const h = new Uint8Array(4);
    h[0] = (isLast ? 0x80 : 0) | (b.type & 0x7f);
    h[1] = (b.data.length >> 16) & 0xff;
    h[2] = (b.data.length >> 8) & 0xff;
    h[3] = b.data.length & 0xff;
    parts.push(h, b.data);
  });
  parts.push(audio);
  return concat(parts);
}

/** 렌더 결과를 FLAC(태그·아트워크 포함) 바이트로 인코딩한다. */
export async function encodeFlac(audio: RenderedAudio, tags: Id3Tags, inputPcm: unknown): Promise<Uint8Array> {
  const Flac = await loadFlac();
  const channels = Math.max(1, audio.numberOfChannels);
  const bps = flacBitsFromInput(inputPcm);

  const id = Flac.create_libflac_encoder(audio.sampleRate, channels, bps, 5, audio.length, false);
  if (!id) throw new Error('FLAC encoder could not be created.');
  const chunks: Uint8Array[] = [];
  const initState = Flac.init_encoder_stream(id, (data) => { chunks.push(data.slice()); }, null);
  if (initState !== 0) {
    Flac.FLAC__stream_encoder_delete(id);
    throw new Error('FLAC init_encoder_stream failed (status ' + initState + ').');
  }
  try {
    const pcm: Int32Array[] = [];
    for (let c = 0; c < channels; c++) pcm.push(floatToInt32(audio.channelData[c] ?? audio.channelData[0], bps));
    // 블록 단위 처리(대용량 단일 호출의 heap 부담 회피). slice 로 byteOffset 0 보장.
    const BLOCK = 16384;
    let sinceYield = 0;
    for (let i = 0; i < audio.length; i += BLOCK) {
      const n = Math.min(BLOCK, audio.length - i);
      const blk = pcm.map((c) => c.slice(i, i + n));
      if (!Flac.FLAC__stream_encoder_process(id, blk, n)) {
        throw new Error('FLAC encode failed (state ' + Flac.FLAC__stream_encoder_get_state(id) + ').');
      }
      if (++sinceYield >= 16) { sinceYield = 0; await new Promise((r) => setTimeout(r, 0)); } // UI 양보
    }
    Flac.FLAC__stream_encoder_finish(id);
  } finally {
    Flac.FLAC__stream_encoder_delete(id);
  }

  const raw = concat(chunks);
  const { artwork } = tags;
  return injectFlacMetadata(raw, buildVorbisComment(tags), artwork && artwork.data.length ? buildPicture(artwork.mime, artwork.data) : null);
}
