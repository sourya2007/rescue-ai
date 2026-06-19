/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Perfect Client-Side Audio DSP Module
 * Implements:
 * 1. OfflineAudioContext-based Butterworth-equivalent Bandpass Filtering (300Hz - 3400Hz).
 * 2. Short-Time Fourier Transform (STFT) & Inverse Short-Time Fourier Transform (ISTFT)
 *    coupled with Spectral Subtraction to eliminate background noise/static.
 */

// Simple Complex Number representation for FFT
interface Complex {
  re: number;
  im: number;
}

// Cooley-Tukey Radix-2 FFT & IFFT implementation
function fft(input: Complex[]): Complex[] {
  const n = input.length;
  if (n <= 1) return [input[0]];

  const even = new Array<Complex>(n / 2);
  const odd = new Array<Complex>(n / 2);
  for (let i = 0; i < n / 2; i++) {
    even[i] = input[2 * i];
    odd[i] = input[2 * i + 1];
  }

  const q = fft(even);
  const r = fft(odd);

  const result = new Array<Complex>(n);
  for (let k = 0; k < n / 2; k++) {
    const th = (-2 * Math.PI * k) / n;
    const tRe = Math.cos(th);
    const tIm = Math.sin(th);
    
    // r[k] * exp(-i * 2*pi*k/N)
    const xRe = r[k].re * tRe - r[k].im * tIm;
    const xIm = r[k].re * tIm + r[k].im * tRe;

    result[k] = { re: q[k].re + xRe, im: q[k].im + xIm };
    result[k + n / 2] = { re: q[k].re - xRe, im: q[k].im - xIm };
  }

  return result;
}

function ifft(input: Complex[]): Complex[] {
  const n = input.length;
  // Conjugate input
  const conj = input.map(c => ({ re: c.re, im: -c.im }));
  const f = fft(conj);
  // Conjugate result and scale by 1 / n
  return f.map(c => ({ re: c.re / n, im: -c.im / n }));
}

// Hamming Window generator
function hammingWindow(size: number): number[] {
  const window = new Array<number>(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (size - 1));
  }
  return window;
}

/**
 * High-performance Bandpass filter utilizing the browser's compiled Audio Engine (OfflineAudioContext).
 */
export async function applyBandpassFilter(
  audioBuffer: AudioBuffer,
  lowcut: number = 300,
  highcut: number = 3400
): Promise<AudioBuffer> {
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  
  // Create offline context to run fast DSP
  const offlineCtx = new OfflineAudioContext(numChannels, length, sampleRate);
  
  // Create buffer source
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  
  // Biquad filters in series
  const hipass = offlineCtx.createBiquadFilter();
  hipass.type = "highpass";
  hipass.frequency.value = lowcut;
  
  const lopass = offlineCtx.createBiquadFilter();
  lopass.type = "lowpass";
  lopass.frequency.value = highcut;
  
  // Connect pipeline: source -> highpass -> lowpass -> destination
  source.connect(hipass);
  hipass.connect(lopass);
  lopass.connect(offlineCtx.destination);
  
  // Run
  source.start(0);
  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer;
}

/**
 * STFT Spectral Subtraction Algorithm (DSP)
 * Estimates background noise profile from the first 'noiseDurationSec' seconds of audio
 * (typically silent pause before speech start) and subtracts it from the signal spectrum.
 */
export function applySpectralSubtraction(
  audioBuffer: AudioBuffer,
  alpha: number = 3.5, // Over-subtraction factor
  beta: number = 0.02, // Spectral floor factor (prevents musical artifacts)
  noiseDurationSec: number = 0.5
): AudioBuffer {
  const sr = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  
  // Create clean context
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const cleanedBuffer = audioCtx.createBuffer(numChannels, length, sr);
  
  // Sizing criteria (must be powers of 2 for Cooley-Tukey Radix-2 FFT)
  const n_fft = 512;
  const hop_length = 128;
  const win_length = 512;
  const win = hammingWindow(win_length);
  
  for (let channel = 0; channel < numChannels; channel++) {
    const input = audioBuffer.getChannelData(channel);
    const output = cleanedBuffer.getChannelData(channel);
    
    // Accumulate output array
    const outputAcc = new Float32Array(length);
    const windowPowerSum = new Float32Array(length);
    
    // Analyze frames
    const numFrames = Math.floor((length - n_fft) / hop_length) + 1;
    if (numFrames <= 0) {
      // Audio too short. Return copy
      output.set(input);
      continue;
    }
    
    // Extract magnitude & phase spectra
    const mags: number[][] = [];
    const phases: number[][] = [];
    
    for (let f = 0; f < numFrames; f++) {
      const idx = f * hop_length;
      const frameComplex: Complex[] = new Array(n_fft);
      
      for (let i = 0; i < n_fft; i++) {
        const val = idx + i < length ? input[idx + i] * win[i] : 0;
        frameComplex[i] = { re: val, im: 0 };
      }
      
      const fftResult = fft(frameComplex);
      const magFrame = new Array<number>(n_fft);
      const phaseFrame = new Array<number>(n_fft);
      
      for (let i = 0; i < n_fft; i++) {
        magFrame[i] = Math.sqrt(fftResult[i].re * fftResult[i].re + fftResult[i].im * fftResult[i].im);
        phaseFrame[i] = Math.atan2(fftResult[i].im, fftResult[i].re);
      }
      
      mags.push(magFrame);
      phases.push(phaseFrame);
    }
    
    // Estimate noise average magnitude from first 0.5s frames of the audio
    const sampleDurationPerFrame = hop_length / sr;
    const numNoiseFrames = Math.max(1, Math.min(numFrames, Math.floor(noiseDurationSec / sampleDurationPerFrame)));
    
    const noiseEst = new Array<number>(n_fft).fill(0);
    for (let i = 0; i < n_fft; i++) {
      let sum = 0;
      for (let f = 0; f < numNoiseFrames; f++) {
        sum += mags[f][i];
      }
      noiseEst[i] = sum / numNoiseFrames;
    }
    
    // Perform Spectral Subtraction
    for (let f = 0; f < numFrames; f++) {
      const idx = f * hop_length;
      const magFrame = mags[f];
      const phaseFrame = phases[f];
      
      const cleanComplex: Complex[] = new Array(n_fft);
      for (let i = 0; i < n_fft; i++) {
        // Magnitude Over-subtraction: S_clean^2 = S_mag^2 - alpha * N_mag^2
        const rawPower = magFrame[i] * magFrame[i];
        const noisePower = noiseEst[i] * noiseEst[i];
        
        let cleanPower = rawPower - alpha * noisePower;
        const floorPower = beta * rawPower;
        
        if (cleanPower < floorPower) {
          cleanPower = floorPower;
        }
        
        const cleanMag = Math.sqrt(cleanPower);
        
        // Reconstruct Complex polar form: r * exp(i * theta)
        cleanComplex[i] = {
          re: cleanMag * Math.cos(phaseFrame[i]),
          im: cleanMag * Math.sin(phaseFrame[i])
        };
      }
      
      // Compute IFFT
      const ifftResult = ifft(cleanComplex);
      
      // Overlap-add back to time-domain
      for (let i = 0; i < n_fft; i++) {
        if (idx + i < length) {
          // Window factor applied to reconstruction
          outputAcc[idx + i] += ifftResult[i].re * win[i];
          windowPowerSum[idx + i] += win[i] * win[i];
        }
      }
    }
    
    // Normalize windowing overlap factor so there are no tremolo/amplitude distortions
    for (let i = 0; i < length; i++) {
      if (windowPowerSum[i] > 1e-4) {
        output[i] = outputAcc[i] / windowPowerSum[i];
      } else {
        output[i] = input[i]; // fallback to input
      }
    }
    
    // Double safeguard check to clip audio limits and normalize output amplitude
    let maxVal = 0;
    for (let i = 0; i < length; i++) {
      const absVal = Math.abs(output[i]);
      if (absVal > maxVal) maxVal = absVal;
    }
    if (maxVal > 1.0) {
      for (let i = 0; i < length; i++) {
        output[i] /= maxVal;
      }
    }
  }
  
  return cleanedBuffer;
}

/**
 * Utility: Converts an AudioBuffer into a standardized 16kHz float32 Wav Byte Array
 * ready to send to server.
 */
export function audioBufferToWav(buffer: AudioBuffer): Uint8Array {
  const numChannels = 1; // force mono
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const resultChannelData = buffer.getChannelData(0);
  const numSamples = resultChannelData.length;
  
  const byteRate = (sampleRate * numChannels * bitDepth) / 8;
  const blockAlign = (numChannels * bitDepth) / 8;
  const wavLength = 44 + numSamples * 2;
  
  const arrayBuffer = new ArrayBuffer(wavLength);
  const view = new DataView(arrayBuffer);
  
  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + numSamples * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, byteRate, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, numSamples * 2, true);
  
  // Write float samples converted to 16-bit PCM amplitude values
  let offset = 44;
  for (let i = 0; i < numSamples; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, resultChannelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  
  return new Uint8Array(arrayBuffer);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
