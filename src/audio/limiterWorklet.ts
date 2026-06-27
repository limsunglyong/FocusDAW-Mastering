// FocusDAW Mastering Desk v0.7.0 (Phase 6) - 룩어헤드 True-Peak 리미터 AudioWorklet
// 번들러 의존 없이 Blob URL 로 audioWorklet.addModule 에 로드한다(아래 코드 문자열 = 워클릿 글로벌 스코프 JS).
//
// 알고리즘(스테레오 링크 브릭월):
//  - lookahead 만큼 신호를 지연(delay line)하고, 같은 길이의 desired-gain 링버퍼를 둔다.
//  - 매 입력 샘플마다 샘플 피크로 desired = ceiling/peak(초과 시) 산출. (ISP 는 ceiling 헤드룸으로 대비;
//    정밀 폴리페이즈 True Peak 오버샘플은 후속 — 선형보간은 항상 엔드포인트가 최대라 ISP 검출 불가.)
//  - 출력 게인 target = 룩어헤드 윈도우 내 desired 최소값(미리 더킹) → attack 빠름/release 느림 스무딩.
//  - 지연된 샘플에 게인 적용 → 피크가 출력에 도달할 때 이미 천장 이하로 눌려 있어 오버슈트 없음.
//  - tplimit off(enabled=0) 면 desired=1 → 사실상 통과(룩어헤드 지연만).
//  - 주기적으로 최소 게인(grPeak)을 port 로 보고(메터링용).
export const LIMITER_PROCESSOR_NAME = 'lookahead-limiter';

const LIMITER_WORKLET_CODE = `
class LookaheadLimiter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'ceiling', defaultValue: 0.891, minValue: 0.0001, maxValue: 1, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 0.12, minValue: 0.005, maxValue: 1, automationRate: 'k-rate' },
      { name: 'enabled', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }
  constructor(options) {
    super();
    const ms = (options && options.processorOptions && options.processorOptions.lookaheadMs) || 2;
    this.la = Math.max(1, Math.round((ms / 1000) * sampleRate));
    this.delayL = new Float32Array(this.la);
    this.delayR = new Float32Array(this.la);
    this.desired = new Float32Array(this.la).fill(1);
    this.pos = 0;
    this.gain = 1;
    this.attackCoeff = 1 - Math.exp(-1 / Math.max(1, this.la * 0.5));
    this.frame = 0;
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    const N = output[0].length;
    if (!input || input.length === 0) {
      for (let c = 0; c < output.length; c++) output[c].fill(0);
      return true;
    }
    const inL = input[0];
    const inR = input.length > 1 ? input[1] : input[0];
    const nCh = output.length;
    const ceiling = parameters.ceiling[0];
    const enabled = parameters.enabled[0] >= 0.5;
    const releaseSamples = Math.max(1, parameters.release[0] * sampleRate);
    const relCoeff = 1 - Math.exp(-1 / releaseSamples);
    const la = this.la;
    const desired = this.desired;
    const delayL = this.delayL;
    const delayR = this.delayR;
    let gain = this.gain;
    let grPeak = 1;
    for (let i = 0; i < N; i++) {
      const xl = inL[i];
      const xr = inR[i];
      const al = xl < 0 ? -xl : xl;
      const ar = xr < 0 ? -xr : xr;
      const peak = al > ar ? al : ar;
      const d = (enabled && peak > ceiling) ? ceiling / peak : 1;
      // 지연 샘플 읽고 현재 샘플/ desired 기록
      const dl = delayL[this.pos];
      const dr = delayR[this.pos];
      delayL[this.pos] = xl;
      delayR[this.pos] = xr;
      desired[this.pos] = d;
      this.pos = this.pos + 1 >= la ? 0 : this.pos + 1;
      // 룩어헤드 윈도우 최소 desired
      let target = 1;
      for (let k = 0; k < la; k++) { if (desired[k] < target) target = desired[k]; }
      if (target < gain) gain += (target - gain) * this.attackCoeff;
      else gain += (target - gain) * relCoeff;
      if (gain < grPeak) grPeak = gain;
      output[0][i] = dl * gain;
      if (nCh > 1) output[1][i] = dr * gain;
    }
    this.gain = gain;
    this.frame++;
    if ((this.frame & 7) === 0) this.port.postMessage({ gr: grPeak });
    return true;
  }
}
registerProcessor('${LIMITER_PROCESSOR_NAME}', LookaheadLimiter);
`;

let cachedUrl: string | null = null;
// 워클릿 모듈 Blob URL(1회 생성 후 캐시). audioWorklet.addModule(url) 로 사용.
export function getLimiterWorkletUrl(): string {
  if (cachedUrl) return cachedUrl;
  const blob = new Blob([LIMITER_WORKLET_CODE], { type: 'application/javascript' });
  cachedUrl = URL.createObjectURL(blob);
  return cachedUrl;
}
