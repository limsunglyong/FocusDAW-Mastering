// FocusDAW Mastering Desk v0.8.4 (Phase 7, 단계 7-E) - MP3 320kbps 인코더 (@breezystack/lamejs)
// 렌더 결과(RenderedAudio) → (필요 시 MP3 지원 레이트로 리샘플) → Int16 PCM → lamejs MP3(CBR 320)
// → 앞에 ID3v2.3 태그를 붙여 반환. MP3 는 48kHz 초과를 지원하지 않으므로 96kHz 등은 48kHz 로 변환한다.
import type { RenderedAudio } from './renderOffline';
import { buildId3v2, type Id3Tags } from './id3';

// MPEG-1/2/2.5 가 지원하는 표본화율(Hz). 입력이 이 목록에 없으면 가장 가까운(이하 우선) 값으로 리샘플.
const MP3_RATES = [48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000];

function nearestMp3Rate(rate: number): number {
  if (MP3_RATES.includes(rate)) return rate;
  const below = MP3_RATES.filter((r) => r <= rate);
  return below.length ? Math.max(...below) : Math.min(...MP3_RATES);
}

// RenderedAudio 를 OfflineAudioContext 로 targetRate 에 리샘플(품질 양호). 동일 레이트면 그대로 반환.
async function resampleAudio(audio: RenderedAudio, targetRate: number): Promise<RenderedAudio> {
  if (audio.sampleRate === targetRate) return audio;
  if (typeof OfflineAudioContext === 'undefined') throw new Error('OfflineAudioContext unavailable for MP3 resample.');
  const ch = Math.max(1, audio.numberOfChannels);
  const outLen = Math.max(1, Math.ceil((audio.length * targetRate) / audio.sampleRate));
  const offline = new OfflineAudioContext(ch, outLen, targetRate);
  const buf = offline.createBuffer(ch, audio.length, audio.sampleRate);
  for (let c = 0; c < ch; c++) buf.getChannelData(c).set(audio.channelData[c]);
  const src = offline.createBufferSource();
  src.buffer = buf;
  src.connect(offline.destination);
  src.start();
  const out = await offline.startRendering();
  const channelData: Float32Array[] = [];
  for (let c = 0; c < ch; c++) channelData.push(Float32Array.from(out.getChannelData(c)));
  return { sampleRate: targetRate, numberOfChannels: ch, length: out.length, channelData };
}

function floatToInt16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    let s = f[i];
    s = s > 1 ? 1 : s < -1 ? -1 : s;
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
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

/** 렌더 결과를 MP3(CBR 320, ID3v2.3 태그 포함) 바이트로 인코딩한다. */
export async function encodeMp3(audio: RenderedAudio, tags: Id3Tags): Promise<Uint8Array> {
  const a = await resampleAudio(audio, nearestMp3Rate(audio.sampleRate));
  const channels = Math.min(2, Math.max(1, a.numberOfChannels));
  const { Mp3Encoder } = await import('@breezystack/lamejs'); // 동적 로드(메인 번들 절감)
  const enc = new Mp3Encoder(channels, a.sampleRate, 320);
  const block = 1152; // MP3 프레임 표본 수
  const left = floatToInt16(a.channelData[0]);
  const right = channels > 1 ? floatToInt16(a.channelData[1] ?? a.channelData[0]) : null;

  const chunks: Uint8Array[] = [];
  let sinceYield = 0;
  for (let i = 0; i < a.length; i += block) {
    const l = left.subarray(i, i + block);
    const buf = right ? enc.encodeBuffer(l, right.subarray(i, i + block)) : enc.encodeBuffer(l);
    if (buf.length > 0) chunks.push(new Uint8Array(buf));
    // 주기적으로 UI 스레드에 양보해 로딩 오버레이가 멈춘 것처럼 보이지 않게 한다.
    if (++sinceYield >= 256) { sinceYield = 0; await new Promise((r) => setTimeout(r, 0)); }
  }
  const tail = enc.flush();
  if (tail.length > 0) chunks.push(new Uint8Array(tail));

  const id3 = buildId3v2(tags);
  const mp3 = concat(chunks);
  return id3.length ? concat([id3, mp3]) : mp3;
}
