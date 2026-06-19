import React, { useState, useEffect, useRef } from "react";
import { Activity } from "lucide-react";

interface WaterfallSpectrogramProps {
  isPlayingRaw: boolean;
  isPlayingClean: boolean;
  analyser: AnalyserNode | null;
}

export default function WaterfallSpectrogram({
  isPlayingRaw,
  isPlayingClean,
  analyser
}: WaterfallSpectrogramProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const phaseRef = useRef<number>(0);

  const [peakFreq, setPeakFreq] = useState<number>(0);
  const [signalEnergy, setSignalEnergy] = useState<number>(0);

  // Gradient interpolators for high-fidelity spectrogram visuals: Black -> Green / Red
  const getColorClean = (val: number) => {
    if (val === 0) return "#000000";
    const p = val / 255;
    // Pure Black -> Dark Green -> Bright Green -> Highlight Lime/White
    let r = 0, g = 0, b = 0;
    if (p < 0.5) {
      g = Math.floor(200 * (p / 0.5));
    } else {
      r = Math.floor(255 * ((p - 0.5) / 0.5));
      g = 255;
      b = Math.floor(180 * ((p - 0.5) / 0.5));
    }
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getColorRaw = (val: number) => {
    if (val === 0) return "#000000";
    const p = val / 255;
    // Pure Black -> Dark Red -> Bright Red -> Orange-Yellow
    let r = 0, g = 0, b = 0;
    if (p < 0.5) {
      r = Math.floor(220 * (p / 0.5));
    } else if (p < 0.85) {
      r = 255;
      g = Math.floor(150 * ((p - 0.5) / 0.35));
    } else {
      r = 255;
      g = 220;
      b = Math.floor(150 * ((p - 0.85) / 0.15));
    }
    return `rgb(${r}, ${g}, ${b})`;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fixed internal resolution optimized for spectral cascade pixelation
    const pixelWidth = 256;
    const pixelHeight = 70;
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;

    // Reset background to solid black
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, pixelWidth, pixelHeight);

    let active = true;

    const renderLoop = (timestamp: number) => {
      if (!active) return;

      // Rate limit frame drawing to ~50ms interval for ideal visual rate and performance
      const delta = timestamp - lastUpdateRef.current;
      if (delta > 35) {
        lastUpdateRef.current = timestamp;

        // Shift canvas content downward by 1 pixel to make waterfall cascade
        ctx.save();
        ctx.drawImage(canvas, 0, 0, pixelWidth, pixelHeight - 1, 0, 1, pixelWidth, pixelHeight - 1);
        ctx.restore();

        const isPlaying = isPlayingRaw || isPlayingClean;

        if (analyser && isPlaying) {
          const fftSize = analyser.fftSize || 512;
          const binCount = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(binCount);
          analyser.getByteFrequencyData(dataArray);

          // Voice frequency bounds (map the lower ~6kHz of spectrum to canvas columns)
          const sampleRate = analyser.context.sampleRate || 16000;
          const binHz = sampleRate / fftSize;
          
          let maxBinVal = -1;
          let maxBinIndex = -1;
          let totalEnergy = 0;
          let voiceSampleCount = 0;

          // Draw the brand new spectrum sample at y=0
          for (let x = 0; x < pixelWidth; x++) {
            const freqHz = (x / pixelWidth) * 6000;
            const fftIndex = Math.min(binCount - 1, Math.max(0, Math.round(freqHz / binHz)));
            
            const rawVal = dataArray[fftIndex] || 0;
            let val = rawVal;

            if (isPlayingClean) {
              const insidePassband = freqHz >= 300 && freqHz <= 3400;
              if (!insidePassband) {
                // Strongly attenuate rejected frequency bands
                val = Math.max(0, Math.floor(rawVal * 0.1));
              }
            }

            if (rawVal > maxBinVal) {
              maxBinVal = rawVal;
              maxBinIndex = fftIndex;
            }
            if (freqHz >= 300 && freqHz <= 3400) {
              totalEnergy += rawVal;
              voiceSampleCount++;
            }

            const hexColor = isPlayingClean ? getColorClean(val) : getColorRaw(val);
            ctx.fillStyle = hexColor;
            ctx.fillRect(x, 0, 1, 1);
          }

          const peakHzSelected = maxBinIndex !== -1 && maxBinVal > 15 ? Math.round(maxBinIndex * binHz) : 0;
          const energyPct = voiceSampleCount > 0 ? Math.round((totalEnergy / voiceSampleCount) / 255 * 100) : 0;

          setPeakFreq(peakHzSelected);
          setSignalEnergy(energyPct);

        } else {
          // STANDBY: Draw simulated rolling micro-voltage noise stream
          phaseRef.current += 1.0;
          const phase = phaseRef.current;

          for (let x = 0; x < pixelWidth; x++) {
            let base = 8 + Math.sin(x * 0.08 + phase * 0.1) * 4 + Math.cos(x * 0.2) * 2;
            
            if (x < 15) {
              base += Math.cos(phase * 0.15) * 5 + 4;
            } else if (Math.abs(x - 170) < 4) {
              base += (Math.sin(phase * 0.3) > 0 ? 15 : 2);
            }

            const val = Math.max(0, Math.floor(base + Math.random() * 4));
            
            ctx.fillStyle = getColorClean(val);
            ctx.fillRect(x, 0, 1, 1);
          }

          if (Math.random() > 0.8) {
            setPeakFreq(0);
            setSignalEnergy(Math.floor(2 + Math.random() * 3));
          }
        }
      }

      animationRef.current = requestAnimationFrame(renderLoop);
    };

    animationRef.current = requestAnimationFrame(renderLoop);

    return () => {
      active = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlayingRaw, isPlayingClean, analyser]);

  const isPlaying = isPlayingRaw || isPlayingClean;
  const cardBorderClass = isPlayingClean 
    ? "border-green-500/20 bg-neutral-950/40"
    : isPlayingRaw
    ? "border-red-500/20 bg-neutral-950/40"
    : "border-zinc-900 bg-black";

  return (
    <div className={`border rounded-lg p-2 flex flex-col h-[130px] justify-between relative overflow-hidden select-none transition-all duration-300 ${cardBorderClass}`}>
      
      {/* Top Header line */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <Activity className={`w-3.5 h-3.5 ${isPlayingClean ? "text-green-500" : isPlayingRaw ? "text-red-500" : "text-zinc-600"}`} />
          <span className="text-[9px] uppercase font-mono tracking-wider text-zinc-400 font-bold">WATERFALL SPECTROGRAM</span>
        </div>
        <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded font-mono border ${
          isPlayingClean 
            ? "bg-green-500/10 text-green-400 border-green-500/20" 
            : isPlayingRaw
            ? "bg-red-500/10 text-red-400 border-red-500/20"
            : "bg-zinc-900 text-zinc-600 border-zinc-900/60"
        }`}>
          {isPlayingClean ? "CLEAN" : isPlayingRaw ? "RAW TRAFFIC" : "STANDBY"}
        </span>
      </div>

      {/* Spectrogram Cascade Canvas */}
      <div className="flex-1 my-1 relative rounded border border-black overflow-hidden bg-black">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full block" 
          style={{ imageRendering: "pixelated" }} 
        />
        
        {isPlayingClean && (
          <>
            <div className="absolute left-0 top-0 bottom-0 pointer-events-none bg-red-500/10 border-r border-red-500/20" style={{ width: "5%" }} />
            <div className="absolute right-0 top-0 bottom-0 pointer-events-none bg-red-500/10 border-l border-red-500/20" style={{ width: "43%" }} />
            <div className="absolute left-[6%] top-1 pointer-events-none text-[7px] font-mono font-bold text-green-400/80 bg-black/60 px-1 rounded">
              300Hz GATE
            </div>
            <div className="absolute right-[44%] top-1 pointer-events-none text-[7px] font-mono font-bold text-green-400/80 bg-black/60 px-1 rounded">
              3.4kHz GATE
            </div>
          </>
        )}
      </div>

      {/* Live Frequency and RMS metrics */}
      <div className="grid grid-cols-2 gap-1 text-[9px] font-mono border-t border-zinc-900 pt-1.5 text-zinc-500">
        <div className="flex justify-between border-r border-zinc-900 pr-1.5">
          <span>PEAK:</span>
          <span className={isPlaying ? (isPlayingClean ? "text-green-400 font-bold" : "text-red-400 font-bold") : "text-zinc-600"}>
            {peakFreq > 0 ? `${peakFreq} Hz` : isPlaying ? "CALC..." : "--- Hz"}
          </span>
        </div>
        <div className="flex justify-between pl-1.5">
          <span>SPEECH ENERGY:</span>
          <span className={isPlaying ? (isPlayingClean ? "text-green-400 font-bold" : "text-red-400 font-bold") : "text-zinc-600"}>
            {signalEnergy}%
          </span>
        </div>
      </div>

    </div>
  );
}
