// FocusDAW Mastering Desk v0.2.1 (Phase 1 Patch) - 원본 오디오 재생기
// Preview 체인을 거치지 않고 선택된 AudioBuffer 를 그대로 destination 에 연결한다.
export class OriginalPlayer {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private onEnded: (() => void) | null = null;
  private startedAt = 0;
  private offset = 0;
  private playing = false;
  private playSeq = 0;

  isPlaying() {
    return this.playing;
  }

  getCurrentTime() {
    if (!this.ctx || !this.playing) return this.offset;
    return Math.max(0, this.offset + (this.ctx.currentTime - this.startedAt));
  }

  async toggle(buffer: AudioBuffer, onEnded: () => void, offset?: number) {
    if (this.playing) {
      this.pause();
      return false;
    }
    return this.play(buffer, onEnded, offset);
  }

  // v0.2.4: 파일 선택 변경 중에는 "pause"가 아니라 새 선택 파일로 transport를 이어간다.
  async play(buffer: AudioBuffer, onEnded: () => void, offset = 0) {
    const seq = ++this.playSeq;
    await this.ensureContext();
    if (seq !== this.playSeq) return false;
    this.stopSource();
    this.buffer = buffer;
    this.onEnded = onEnded;
    this.offset = Math.max(0, offset);
    this.start();
    return true;
  }

  pause() {
    if (!this.playing || !this.ctx) return;
    this.playSeq++;
    this.offset = Math.max(0, this.offset + (this.ctx.currentTime - this.startedAt));
    this.stopSource();
    this.playing = false;
  }

  stop() {
    this.playSeq++;
    this.stopSource();
    this.buffer = null;
    this.onEnded = null;
    this.offset = 0;
    this.playing = false;
  }

  private async ensureContext() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  private start() {
    if (!this.ctx || !this.buffer) return;
    if (this.offset >= this.buffer.duration) this.offset = 0;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(this.ctx.destination);
    src.onended = () => {
      if (this.source !== src) return;
      this.stopSource();
      this.offset = 0;
      this.playing = false;
      this.onEnded?.();
    };
    this.source = src;
    this.startedAt = this.ctx.currentTime;
    this.playing = true;
    src.start(0, Math.min(this.offset, Math.max(0, this.buffer.duration - 0.001)));
  }

  private stopSource() {
    const src = this.source;
    if (!src) return;
    src.onended = null;
    try { src.stop(); } catch { /* already stopped */ }
    try { src.disconnect(); } catch { /* already disconnected */ }
    this.source = null;
  }
}

export const originalPlayer = new OriginalPlayer();
