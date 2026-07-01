// FocusDAW polyphase sinc core for WebAssembly SIMD.
// Memory is owned by the Worker; this module performs no dynamic allocation.

@inline
function dotSimd(inputPtr: usize, kernelPtr: usize, taps: i32): f32 {
  let sum = f32x4.splat(0);
  let tap = 0;
  for (; tap + 4 <= taps; tap += 4) {
    const input = v128.load(inputPtr + (<usize>tap << 2));
    const kernel = v128.load(kernelPtr + (<usize>tap << 2));
    sum = f32x4.add(sum, f32x4.mul(input, kernel));
  }
  let result =
    f32x4.extract_lane(sum, 0) +
    f32x4.extract_lane(sum, 1) +
    f32x4.extract_lane(sum, 2) +
    f32x4.extract_lane(sum, 3);
  for (; tap < taps; tap += 1) {
    result += load<f32>(inputPtr + (<usize>tap << 2)) *
      load<f32>(kernelPtr + (<usize>tap << 2));
  }
  return result;
}

export function resample(
  inputPtr: usize,
  inputLength: i32,
  outputPtr: usize,
  outputLength: i32,
  kernelsPtr: usize,
  taps: i32,
  phases: i32,
  ratio: f64,
): void {
  const half = taps >> 1;
  for (let outIndex = 0; outIndex < outputLength; outIndex += 1) {
    const position = <f64>outIndex * ratio;
    const center = <i32>Math.floor(position);
    const fraction = position - <f64>center;
    let phase = <i32>Math.round(fraction * <f64>phases);
    if (phase >= phases) phase = phases - 1;
    const inputBase = center - half + 1;
    const kernelPtr = kernelsPtr + (<usize>(phase * taps) << 2);
    let value: f32 = 0;

    if (inputBase >= 0 && inputBase + taps <= inputLength) {
      value = dotSimd(inputPtr + (<usize>inputBase << 2), kernelPtr, taps);
    } else {
      for (let tap = 0; tap < taps; tap += 1) {
        const inputIndex = inputBase + tap;
        if (inputIndex >= 0 && inputIndex < inputLength) {
          value += load<f32>(inputPtr + (<usize>inputIndex << 2)) *
            load<f32>(kernelPtr + (<usize>tap << 2));
        }
      }
    }
    store<f32>(outputPtr + (<usize>outIndex << 2), value);
  }
}
