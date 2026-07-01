const { app, BrowserWindow } = require('electron');
const targetRate = Number(process.argv.find((arg) => arg.startsWith('--target='))?.slice(9)) || 44100;
const forceTypeScript = process.argv.includes('--typescript');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false } });
  try {
    await win.loadURL('http://127.0.0.1:5173');
    const result = await win.webContents.executeJavaScript(`
      (async () => {
        const { resampleAudioBuffer } = await import('/src/audio/resample.ts');
        const { computeSpectrogram, stftParamsForSampleRate } = await import('/src/audio/stft.ts');
        const response = await fetch('/test_final/sound%20sample/4%20Synth.wav');
        const encoded = await response.arrayBuffer();
        const decodeContext = new AudioContext({ sampleRate: 48000 });
        const decoded = await decodeContext.decodeAudioData(encoded);
        const startFrame = Math.round(30 * decoded.sampleRate);
        const frameCount = Math.round(10 * decoded.sampleRate);
        const source = decodeContext.createBuffer(
          decoded.numberOfChannels,
          frameCount,
          decoded.sampleRate,
        );
        for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
          source.copyToChannel(
            decoded.getChannelData(channel).subarray(startFrame, startFrame + frameCount),
            channel,
          );
        }
        let uiTicks = 0;
        const tickTimer = setInterval(() => { uiTicks += 1; }, 10);
        const startedAt = performance.now();
        const converted = await resampleAudioBuffer(source, ${targetRate}, { forceTypeScript: ${forceTypeScript} });
        const elapsedMs = performance.now() - startedAt;
        clearInterval(tickTimer);

        const measure = (buffer) => {
          let sumSquares = 0;
          let peak = 0;
          let count = 0;
          for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < data.length; i += 1) {
              const value = data[i];
              sumSquares += value * value;
              peak = Math.max(peak, Math.abs(value));
            }
            count += data.length;
          }
          return {
            sampleRate: buffer.sampleRate,
            length: buffer.length,
            rms: Math.sqrt(sumSquares / count),
            peak,
          };
        };
        const spectralBands = (buffer) => {
          const fftSize = 8192;
          const data = buffer.getChannelData(0);
          const totals = [0, 0, 0, 0];
          const edges = [[0, 20000], [20000, 24000], [24000, 28000], [28000, 1e9]];
          let frames = 0;
          for (let offset = 0; offset + fftSize <= data.length; offset += fftSize) {
            const real = new Float64Array(fftSize);
            const imag = new Float64Array(fftSize);
            for (let i = 0; i < fftSize; i += 1) {
              real[i] = data[offset + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (fftSize - 1)));
            }
            for (let i = 1, j = 0; i < fftSize; i += 1) {
              let bit = fftSize >> 1;
              for (; j & bit; bit >>= 1) j ^= bit;
              j ^= bit;
              if (i < j) {
                [real[i], real[j]] = [real[j], real[i]];
                [imag[i], imag[j]] = [imag[j], imag[i]];
              }
            }
            for (let size = 2; size <= fftSize; size <<= 1) {
              const angle = -2 * Math.PI / size;
              const stepR = Math.cos(angle);
              const stepI = Math.sin(angle);
              for (let base = 0; base < fftSize; base += size) {
                let wr = 1;
                let wi = 0;
                for (let k = 0; k < size / 2; k += 1) {
                  const even = base + k;
                  const odd = even + size / 2;
                  const tr = wr * real[odd] - wi * imag[odd];
                  const ti = wr * imag[odd] + wi * real[odd];
                  real[odd] = real[even] - tr;
                  imag[odd] = imag[even] - ti;
                  real[even] += tr;
                  imag[even] += ti;
                  const nextWr = wr * stepR - wi * stepI;
                  wi = wr * stepI + wi * stepR;
                  wr = nextWr;
                }
              }
            }
            for (let bin = 0; bin <= fftSize / 2; bin += 1) {
              const frequency = bin * buffer.sampleRate / fftSize;
              const power = real[bin] * real[bin] + imag[bin] * imag[bin];
              const band = edges.findIndex(([low, high]) => frequency >= low && frequency < high);
              if (band >= 0) totals[band] += power;
            }
            frames += 1;
          }
          const total = totals.reduce((sum, value) => sum + value, 0);
          return {
            frames,
            relativeDb: totals.map((value) => 10 * Math.log10(Math.max(value, 1e-300) / total)),
          };
        };
        const sourceStats = measure(source);
        const convertedStats = measure(converted);
        const sourceSpectrum = spectralBands(source);
        const convertedSpectrum = spectralBands(converted);
        const convertedSpec = computeSpectrogram(
          converted.getChannelData(0),
          converted.sampleRate,
          stftParamsForSampleRate(converted.sampleRate),
        );
        const stftBandMaxDb = [-Infinity, -Infinity, -Infinity, -Infinity];
        const stftEdges = [[0, 20000], [20000, 24000], [24000, 28000], [28000, 1e9]];
        for (let frame = 0; frame < convertedSpec.frames; frame += 1) {
          for (let bin = 0; bin < convertedSpec.bins; bin += 1) {
            const frequency = bin * convertedSpec.freqStep;
            const band = stftEdges.findIndex(([low, high]) => frequency >= low && frequency < high);
            if (band >= 0) stftBandMaxDb[band] = Math.max(stftBandMaxDb[band], convertedSpec.data[frame * convertedSpec.bins + bin]);
          }
        }
        await decodeContext.close();
        return {
          source: sourceStats,
          converted: convertedStats,
          srcEngine: converted.__focusDawSrcEngine || 'unknown',
          elapsedMs,
          uiTicksDuringResample: uiTicks,
          bandLabels: ['0–20k', '20–24k', '24–28k', '>28k'],
          sourceSpectrum,
          convertedSpectrum,
          stftBandMaxDb,
          rmsChangeDb: 20 * Math.log10(convertedStats.rms / sourceStats.rms),
          peakChangeDb: 20 * Math.log10(convertedStats.peak / sourceStats.peak),
        };
      })()
    `, true);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.quit();
  }
});
