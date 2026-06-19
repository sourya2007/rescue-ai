/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  Upload,
  Cpu,
  CheckCircle,
  AlertCircle,
  Sliders,
  Download,
  Activity,
  Volume2,
  Info,
  Maximize2,
  Users,
  Waves,
  ShieldAlert,
  MapPin,
  AlertTriangle,
  Shield,
  Flame,
  HeartPulse,
  Siren,
  Car,
  Lock,
  ChevronLeft,
  ChevronRight,
  Terminal,
  RefreshCw
} from "lucide-react";
import {
  applyBandpassFilter,
  applySpectralSubtraction,
  audioBufferToWav
} from "./utils/audioDsp";
import {
  analyzeEmergencySpeech
} from "./utils/localEmergencyNlp";
import WaterfallSpectrogram from "./components/WaterfallSpectrogram";

// Type definitions for Multi-Speaker Diarization Timeline
interface DiarizationSegment {
  id: string | number;
  start: number;
  end: number;
  speaker: string;
  signature_hz: number;
  text: string;
}

// Simple custom component to render interactive, beautiful audio amplitude waveforms
interface WaveformCanvasProps {
  id: string;
  audioBuffer: AudioBuffer | null;
  currentTime: number;
  duration: number;
  color: string;
  progressColor: string;
  onSeek: (percent: number) => void;
  isProcessing?: boolean;
}

function WaveformCanvas({
  id,
  audioBuffer,
  currentTime,
  duration,
  color,
  progressColor,
  onSeek,
  isProcessing = false
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let active = true;

    const render = () => {
      if (!active) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        if (isProcessing) {
          animationFrameId.current = requestAnimationFrame(render);
        }
        return;
      }

      // Ensure crisp high-DPI scaling
      const targetWidth = Math.floor(rect.width * window.devicePixelRatio);
      const targetHeight = Math.floor(rect.height * window.devicePixelRatio);
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      ctx.save();
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      const width = rect.width;
      const height = rect.height;

      // Clear with slight trailing alpha if processing to create a cool motion blur!
      if (isProcessing) {
        ctx.fillStyle = "rgba(10, 15, 30, 0.85)";
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.clearRect(0, 0, width, height);
      }

      phaseRef.current += 1.0;
      const phase = phaseRef.current;

      // Draw high-fidelity technical background guide lines
      ctx.strokeStyle = isProcessing 
        ? "rgba(16, 185, 129, 0.05)" 
        : "rgba(148, 163, 184, 0.04)";
      ctx.lineWidth = 1;
      // Draw grid
      const gridSpacing = 20;
      for (let x = 0; x < width; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (!audioBuffer) {
        // Draw standby line
        ctx.strokeStyle = "rgba(100, 116, 139, 0.2)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        ctx.fillStyle = isProcessing ? "rgba(16, 185, 129, 0.6)" : "rgba(148, 163, 184, 0.35)";
        ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.textAlign = "center";
        
        if (isProcessing) {
          ctx.fillText("SYNTHESIZING CARRIER & DEMODULATING CHANNELS...", width / 2, height / 2 + 15);
        } else {
          ctx.fillText("AWAITING EMERGENCY RECORD TRANSMISSION", width / 2, height / 2 + 15);
        }
      } else {
        const data = audioBuffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        const progressPercent = duration > 0 ? currentTime / duration : 0;
        const progressX = width * progressPercent;

        // Draw baseline
        ctx.strokeStyle = isProcessing 
          ? "rgba(16, 185, 129, 0.15)" 
          : "rgba(148, 163, 184, 0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, amp);
        ctx.lineTo(width, amp);
        ctx.stroke();

        // Standard or processing animated waveform
        ctx.lineWidth = 2.0;

        for (let i = 0; i < width; i++) {
          let min = 1.0;
          let max = -1.0;
          const startIdx = i * step;
          for (let j = 0; j < step; j++) {
            const index = startIdx + j;
            if (index < data.length) {
              const datum = data[index];
              if (datum < min) min = datum;
              if (datum > max) max = datum;
            }
          }

          // Modulation amplitude during processing to simulate spectral subtraction
          let scale = 1.0;
          if (isProcessing) {
            const factor = Math.sin(phase * 0.04 + i * 0.05);
            scale = 0.65 + 0.35 * factor;
          }

          const y1 = (1 + min * scale) * amp;
          const y2 = (1 + max * scale) * amp;

          if (isProcessing) {
            const greenPulse = Math.sin(phase * 0.1) * 30;
            ctx.strokeStyle = `rgb(16, ${180 + Math.floor(greenPulse)}, 129)`;
          } else {
            ctx.strokeStyle = i < progressX ? progressColor : color;
          }

          ctx.beginPath();
          ctx.moveTo(i, Math.max(3, y1));
          ctx.lineTo(i, Math.min(height - 3, y2));
          ctx.stroke();
        }
      }

      // Add high-end cryptic telemetry scans and overlays when compiling / processing filters
      if (isProcessing) {
        // 1. Digital laser sweep bar
        const scanWidth = 60;
        const scanSpeed = 3.5;
        const scanX = (phase * scanSpeed) % (width + scanWidth) - scanWidth;

        if (scanX > -scanWidth && scanX < width) {
          const scanGrad = ctx.createLinearGradient(scanX, 0, scanX + scanWidth, 0);
          scanGrad.addColorStop(0, "rgba(16, 185, 129, 0)");
          scanGrad.addColorStop(0.5, "rgba(52, 211, 153, 0.25)");
          scanGrad.addColorStop(1, "rgba(16, 185, 129, 0)");

          ctx.fillStyle = scanGrad;
          ctx.fillRect(Math.max(0, scanX), 0, Math.min(width - Math.max(0, scanX), scanWidth), height);

          // Leading edge scanner neon pin line
          const scanEdgeX = scanX + scanWidth / 2;
          if (scanEdgeX >= 0 && scanEdgeX < width) {
            ctx.strokeStyle = "rgba(52, 211, 153, 0.8)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(scanEdgeX, 0);
            ctx.lineTo(scanEdgeX, height);
            ctx.stroke();

            // Tiny target crosshairs
            ctx.fillStyle = "#34d399";
            ctx.fillRect(scanEdgeX - 3, height / 2 - 3, 6, 6);
          }
        }

        // 2. STFT Spectral subtraction simulated background bar graphs (FFT bins noise floors)
        ctx.fillStyle = "rgba(16, 185, 129, 0.12)";
        for (let b = 0; b < width; b += 8) {
          const h = (Math.sin(phase * 0.08 + b * 0.06) + 1.0) * (height * 0.25);
          ctx.fillRect(b, height - h, 4, h);
        }

        // 3. Noise Threshold Subtractive Red-Line
        ctx.strokeStyle = "rgba(239, 68, 68, 0.55)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        const noiseFloorY = height * 0.7 + Math.sin(phase * 0.05) * 5;
        ctx.moveTo(0, noiseFloorY);
        ctx.lineTo(width, noiseFloorY);
        ctx.stroke();
        ctx.setLineDash([]); // Reset line dash

        // Draw label for the noise floor subtraction limit
        ctx.fillStyle = "rgba(239, 68, 68, 0.85)";
        ctx.font = "8px ui-monospace, SFMono-Regular, monospace";
        ctx.textAlign = "right";
        ctx.fillText(`NOISE_FLOOR_LIMIT: -28.5dB (SUBTRACTED)`, width - 8, noiseFloorY - 4);

        // 4. Live Cryptic Pipeline Status Label text overlays
        ctx.fillStyle = "#34d399";
        ctx.font = "9px ui-monospace, SFMono-Regular, monospace";
        ctx.textAlign = "left";

        const pipelineStage = Math.floor((phase / 80) % 4);
        let stageMsg = "";
        switch (pipelineStage) {
          case 0:
            stageMsg = "STAGE 1: Butterworth 300Hz-3.4kHz Bandpass Filter [ACTIVE]";
            break;
          case 1:
            stageMsg = "STAGE 2: Fast Fourier Transform (FFT) Decoupling [WINDOW: 512]";
            break;
          case 2:
            stageMsg = "STAGE 3: Short-Time Spectral Magnitude Subtraction [COMPILING]";
            break;
          case 3:
            stageMsg = "STAGE 4: Inverse FFT Reconstruction & Carrier Synthesis [STABLE]";
            break;
        }

        ctx.fillText(stageMsg, 8, 14);

        // Mini status coordinates
        const hashVal1 = Math.floor(Math.sin(phase * 0.2) * 100000).toString(16).toUpperCase();
        ctx.textAlign = "right";
        ctx.fillText(`DSP_HEX: ${hashVal1} • CH_VPC: 48kHz`, width - 8, 14);
      }

      ctx.restore();

      if (isProcessing && active) {
        animationFrameId.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      active = false;
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [audioBuffer, currentTime, duration, color, progressColor, isProcessing]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioBuffer || isProcessing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(percent);
  };

  return (
    <div className={`relative w-full h-[95px] border overflow-hidden group transition-all duration-300 ${
      isProcessing 
        ? "bg-black border-orange-500/40 shadow-[0_0_12px_rgba(249,115,22,0.15)] animate-pulse" 
        : "bg-black border-zinc-900"
    }`}>
      <canvas
        id={id}
        ref={canvasRef}
        onClick={handleCanvasClick}
        className={`w-full h-full cursor-pointer transition-opacity duration-150 ${isProcessing ? "opacity-95" : "opacity-100"}`}
      />
      {audioBuffer && (
        <div className={`absolute top-2 right-2 pointer-events-none backdrop-blur text-[9px] uppercase font-mono px-2 py-0.5 rounded transition-colors duration-300 ${
          isProcessing 
            ? "bg-orange-950/80 text-orange-400 border border-orange-500/30" 
            : "bg-black border border-zinc-900 text-zinc-400"
        }`}>
          {(audioBuffer.length / audioBuffer.sampleRate).toFixed(1)}s @ {audioBuffer.sampleRate / 1000}kHz
        </div>
      )}
    </div>
  );
}

export default function App() {

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "admin" && password === "1234") {
      setLoginError("");
      setIsAuthenticating(true);
      
      // System initialization sequence
      setTimeout(() => {
        setIsAuthenticating(false);
        setIsTransitioning(true);
        // Allow time for the slide-up animation
        setTimeout(() => {
          setIsLoggedIn(true);
          setIsTransitioning(false);
        }, 1000);
      }, 2000);
    } else {
      setLoginError("AUTH_FAILURE: ACCESS DENIED");
    }
  };

  // Connections and Environment
  const [backendStatus, setBackendStatus] = useState<"connected" | "disconnected">("disconnected");
  const [polling, setPolling] = useState(true);

  // Real-time Audio Analyser Node
  const [activeAnalyser, setActiveAnalyser] = useState<AnalyserNode | null>(null);

  // Audio files loading
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [rawBuffer, setRawBuffer] = useState<AudioBuffer | null>(null);
  const [cleanedBuffer, setCleanedBuffer] = useState<AudioBuffer | null>(null);

  // Playback parameters
  const [isPlayingRaw, setIsPlayingRaw] = useState(false);
  const [isPlayingClean, setIsPlayingClean] = useState(false);
  const [rawTime, setRawTime] = useState(0);
  const [cleanTime, setCleanTime] = useState(0);

  // DSP parameters
  const [alpha, setAlpha] = useState<number>(3.5);
  const [beta, setBeta] = useState<number>(0.02);

  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [dspTime, setDspTime] = useState<number | null>(null);
  const [whisperTime, setWhisperTime] = useState<number | null>(null);
  const [rawTranscript, setRawTranscript] = useState<string>("");
  const [denoisedTranscript, setDenoisedTranscript] = useState<string>("");
  const [ollamaInsights, setOllamaInsights] = useState<string>("");
  const [aiEmergencyIntel, setAiEmergencyIntel] = useState<any>(null);
  const [activePipelineMode, setActivePipelineMode] = useState<"client" | "hybrid">("client");

  // Multi-Speaker Diarization segments data
  const [diarizationSegments, setDiarizationSegments] = useState<DiarizationSegment[]>([]);

  // Collapsible Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);


  // Audio nodes for playing
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRawRef = useRef<AudioBufferSourceNode | null>(null);
  const sourceCleanRef = useRef<AudioBufferSourceNode | null>(null);
  const startRawTimeRef = useRef<number>(0);
  const startCleanTimeRef = useRef<number>(0);
  const pauseRawOffsetRef = useRef<number>(0);
  const pauseCleanOffsetRef = useRef<number>(0);



  // Initialize or fetch the WebAudio context lazily
  const getAudioContext = (): AudioContext => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Poll Localhost status to enable local desktop mode support
  useEffect(() => {
    let interval: any;
    const checkConnection = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/status");
        if (res.ok) {
          const data = await res.json();
          setBackendStatus("connected");
          setActivePipelineMode("hybrid"); // automatically jump to high precision server mode
        } else {
          setBackendStatus("disconnected");
          setActivePipelineMode("client");
        }
      } catch (e) {
        setBackendStatus("disconnected");
        setActivePipelineMode("client");
      }
    };

    checkConnection();
    if (polling) {
      interval = setInterval(checkConnection, 4500);
    }
    return () => clearInterval(interval);
  }, [polling]);



  // Update playback timers
  useEffect(() => {
    let timer: any;
    if (isPlayingRaw) {
      timer = setInterval(() => {
        if (rawBuffer) {
          const elapsed = (getAudioContext().currentTime - startRawTimeRef.current) + pauseRawOffsetRef.current;
          if (elapsed >= rawBuffer.duration) {
            setIsPlayingRaw(false);
            setRawTime(rawBuffer.duration);
            pauseRawOffsetRef.current = 0;
            setActiveAnalyser(null);
            clearInterval(timer);
          } else {
            setRawTime(elapsed);
          }
        }
      }, 50);
    }
    return () => clearInterval(timer);
  }, [isPlayingRaw, rawBuffer]);

  useEffect(() => {
    let timer: any;
    if (isPlayingClean) {
      timer = setInterval(() => {
        if (cleanedBuffer) {
          const elapsed = (getAudioContext().currentTime - startCleanTimeRef.current) + pauseCleanOffsetRef.current;
          if (elapsed >= cleanedBuffer.duration) {
            setIsPlayingClean(false);
            setCleanTime(cleanedBuffer.duration);
            pauseCleanOffsetRef.current = 0;
            setActiveAnalyser(null);
            clearInterval(timer);
          } else {
            setCleanTime(elapsed);
          }
        }
      }, 50);
    }
    return () => clearInterval(timer);
  }, [isPlayingClean, cleanedBuffer]);


  // Audio Playback Handling
  const playRaw = () => {
    if (!rawBuffer) return;
    const ctx = getAudioContext();

    if (isPlayingRaw) {
      // Pause
      sourceRawRef.current?.stop();
      sourceRawRef.current?.disconnect();
      pauseRawOffsetRef.current += ctx.currentTime - startRawTimeRef.current;
      setIsPlayingRaw(false);
      setActiveAnalyser(null);
    } else {
      // Resume or play from beginning
      if (isPlayingClean) pauseClean();

      const source = ctx.createBufferSource();
      source.buffer = rawBuffer;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyser.connect(ctx.destination);

      let offset = pauseRawOffsetRef.current;
      if (offset >= rawBuffer.duration) offset = 0;

      source.start(0, offset);
      startRawTimeRef.current = ctx.currentTime;
      pauseRawOffsetRef.current = offset;
      sourceRawRef.current = source;
      setActiveAnalyser(analyser);
      setIsPlayingRaw(true);
    }
  };

  const pauseRaw = () => {
    if (isPlayingRaw) {
      sourceRawRef.current?.stop();
      sourceRawRef.current?.disconnect();
      pauseRawOffsetRef.current += getAudioContext().currentTime - startRawTimeRef.current;
      setIsPlayingRaw(false);
      setActiveAnalyser(null);
    }
  };

  const seekRaw = (percent: number) => {
    if (!rawBuffer) return;
    const wasPlaying = isPlayingRaw;
    if (isPlayingRaw) {
      sourceRawRef.current?.stop();
      sourceRawRef.current?.disconnect();
      setIsPlayingRaw(false);
    }

    const targetTime = percent * rawBuffer.duration;
    pauseRawOffsetRef.current = targetTime;
    setRawTime(targetTime);

    if (wasPlaying) {
      const ctx = getAudioContext();
      const source = ctx.createBufferSource();
      source.buffer = rawBuffer;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyser.connect(ctx.destination);

      source.start(0, targetTime);
      startRawTimeRef.current = ctx.currentTime;
      sourceRawRef.current = source;
      setActiveAnalyser(analyser);
      setIsPlayingRaw(true);
    } else {
      setActiveAnalyser(null);
    }
  };

  const playClean = () => {
    if (!cleanedBuffer) return;
    const ctx = getAudioContext();

    if (isPlayingClean) {
      // Pause
      sourceCleanRef.current?.stop();
      sourceCleanRef.current?.disconnect();
      pauseCleanOffsetRef.current += ctx.currentTime - startCleanTimeRef.current;
      setIsPlayingClean(false);
      setActiveAnalyser(null);
    } else {
      // Resume or play from beginning
      if (isPlayingRaw) pauseRaw();

      const source = ctx.createBufferSource();
      source.buffer = cleanedBuffer;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyser.connect(ctx.destination);

      let offset = pauseCleanOffsetRef.current;
      if (offset >= cleanedBuffer.duration) offset = 0;

      source.start(0, offset);
      startCleanTimeRef.current = ctx.currentTime;
      pauseCleanOffsetRef.current = offset;
      sourceCleanRef.current = source;
      setActiveAnalyser(analyser);
      setIsPlayingClean(true);
    }
  };

  const pauseClean = () => {
    if (isPlayingClean) {
      sourceCleanRef.current?.stop();
      sourceCleanRef.current?.disconnect();
      pauseCleanOffsetRef.current += getAudioContext().currentTime - startCleanTimeRef.current;
      setIsPlayingClean(false);
      setActiveAnalyser(null);
    }
  };

  const seekClean = (percent: number) => {
    if (!cleanedBuffer) return;
    const wasPlaying = isPlayingClean;
    if (isPlayingClean) {
      sourceCleanRef.current?.stop();
      sourceCleanRef.current?.disconnect();
      setIsPlayingClean(false);
    }

    const targetTime = percent * cleanedBuffer.duration;
    pauseCleanOffsetRef.current = targetTime;
    setCleanTime(targetTime);

    if (wasPlaying) {
      const ctx = getAudioContext();
      const source = ctx.createBufferSource();
      source.buffer = cleanedBuffer;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyser.connect(ctx.destination);

      source.start(0, targetTime);
      startCleanTimeRef.current = ctx.currentTime;
      sourceCleanRef.current = source;
      setActiveAnalyser(analyser);
      setIsPlayingClean(true);
    } else {
      setActiveAnalyser(null);
    }
  };

  // Convert uploaded file to AudioBuffer
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFile(file);
    setIsPlayingRaw(false);
    setIsPlayingClean(false);
    setCleanedBuffer(null);
    setRawTranscript("");
    setDenoisedTranscript("");
    setDiarizationSegments([]);
    setOllamaInsights("");
    setAiEmergencyIntel(null);
    setDspTime(null);
    setWhisperTime(null);
    setRawTime(0);
    setCleanTime(0);
    pauseRawOffsetRef.current = 0;
    pauseCleanOffsetRef.current = 0;

    const ctx = getAudioContext();
    try {
      const arrayBuffer = await file.arrayBuffer();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      setRawBuffer(decodedBuffer);
      
      // Auto populate an offline fallback mock sequence of speaker segments so the UI is clickable right away offline!
      const totalDuration = decodedBuffer.duration;
      setDiarizationSegments([
        {
          id: 0,
          start: 0.0,
          end: Math.min(totalDuration, 2.5),
          speaker: "SYSTEM",
          signature_hz: 320.5,
          text: "[DSP ACTIVE] First segment voice sequence. Pitch and background humming are mathematically separated."
        },
        {
          id: 1,
          start: Math.min(totalDuration, 3.0),
          end: Math.min(totalDuration, 7.5),
          speaker: "SYSTEM",
          signature_hz: 1150.0,
          text: "[WHISPER ON] The clean sound spectral components now show distinct sound signature separation curves!"
        },
        {
          id: 2,
          start: Math.min(totalDuration, 8.0),
          end: Math.min(totalDuration, totalDuration),
          speaker: "SYSTEM",
          signature_hz: 345.8,
          text: "Perfect. Run the local python backend with FastAPI to execute real Pyannote diarization modeling dynamically."
        }
      ].filter(seg => seg.start < totalDuration));

    } catch (err) {
      console.error("Decoding audio failed:", err);
      alert("Failed to decode this audio file. Please check file format (supported: wav, mp3).");
    }
  };

  // Run the DSP and/or Local AI Speech-to-text pipeline
  const processPipeline = async (remodel: boolean = false) => {
    if (!rawBuffer || !audioFile) return;

    setIsProcessing(true);
    setRawTranscript("");
    setDenoisedTranscript("");

    const isHybrid = activePipelineMode === "hybrid" && backendStatus === "connected";

    if (isHybrid) {
      try {
        const formData = new FormData();
        formData.append("file", audioFile);
        formData.append("alpha", alpha.toString());
        formData.append("beta", beta.toString());
        formData.append("remodel", remodel.toString());

        const res = await fetch("http://127.0.0.1:8000/api/process", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error("Local backend reported processing failure");
        }

        const dataResult = await res.json();

        setDspTime(dataResult.dsp_time_sec);
        setWhisperTime(dataResult.raw_inference_time_sec);
        setRawTranscript(dataResult.raw_transcript);
        setDenoisedTranscript(dataResult.denoised_transcript);
        setOllamaInsights(dataResult.local_llm_insights || "");
        setAiEmergencyIntel(dataResult.ai_structured_intel || null);

        if (dataResult.diarization_cleaned && dataResult.diarization_cleaned.length > 0) {
          setDiarizationSegments(dataResult.diarization_cleaned);
        }

        const base64Str = dataResult.cleaned_audio_base64;
        const binaryString = window.atob(base64Str);
        const len = binaryString.length;
        const wavBytes = new Uint8Array(len);
        for (let j = 0; j < len; j++) {
          wavBytes[j] = binaryString.charCodeAt(j);
        }

        const ctx = getAudioContext();
        const decoded = await ctx.decodeAudioData(wavBytes.buffer);
        setCleanedBuffer(decoded);
      } catch (err: any) {
        console.error("Local Python backend processing error:", err);
        alert("Failed to communicate with local PyServer. Falling back to Browser DSP simulation.");
        setActivePipelineMode("client");
      } finally {
        setIsProcessing(false);
      }
    } else {
      try {
        const t0 = performance.now();
        const bandpassed = await applyBandpassFilter(rawBuffer, 300, 3400);
        const clientBuffer = applySpectralSubtraction(bandpassed, alpha, beta, 0.5);
        const clientDuration = (performance.now() - t0) / 1000;

        setCleanedBuffer(clientBuffer);
        setDspTime(clientDuration);
        setRawTranscript("[Local backend disconnected - Start your Python script with --serve to run local AI Whisper STT and Pyannote Diarization]");
        setDenoisedTranscript("[Offline Pure DSP Cleaned Successful - Active sound centroids loaded into waveform player]");
        setOllamaInsights("[LLM Analysis requires Hybrid mode - Connect local Python backend]");
      } catch (err: any) {
        console.error("Client side DSP error:", err);
        alert("Audio processing error: " + err.message);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // Download Output clean wave
  const downloadCleanedAudio = () => {
    if (!cleanedBuffer) return;
    const wavBytes = audioBufferToWav(cleanedBuffer);
    const blob = new Blob([wavBytes], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `denoised_${audioFile?.name || "audio"}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Synchronized scrubbing helper active timeline time
  const activePlayheadTime = isPlayingClean ? cleanTime : rawTime;

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-mono h-screen overflow-hidden relative">
      
      {(isLoggedIn || isTransitioning) && (
        <>
      {/* Header bar */}
      <header className="border-b border-zinc-900 bg-black px-4 py-2.5 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-2.5">
          <Activity className="h-5 w-5 text-orange-500 stroke-[2]" />
          <div>
            <h1 className="text-sm font-extrabold tracking-wider text-orange-500 uppercase leading-none">
              RESCUE AI
            </h1>
            <p className="text-[9px] text-zinc-400 font-bold uppercase mt-0.5 tracking-tight">
              Radio Enhancement and Speech Clarification for Urgent Emergencies
            </p>
          </div>
        </div>

        {/* Backend State Flag */}
        <div className="flex items-center space-x-2">
          {audioFile && (
            <button
              onClick={() => processPipeline(true)}
              disabled={isProcessing}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-[10px] font-bold uppercase transition-all border ${
                isProcessing 
                  ? "bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed" 
                  : "bg-orange-500/10 text-orange-500 border-orange-500/30 hover:bg-orange-500/20"
              }`}
              title="Reprocess current audio with full model inference"
            >
              <RefreshCw className={`w-3 h-3 ${isProcessing ? "animate-spin" : ""}`} />
              <span>Remodel</span>
            </button>
          )}
          <div className="flex items-center space-x-1.5 px-2.5 py-0.5 bg-zinc-950 border border-zinc-900 rounded">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                backendStatus === "connected"
                  ? "bg-green-500"
                  : "bg-red-500 animate-pulse"
              }`}
            />
            <span className="text-[10px] font-bold uppercase text-[9px] text-zinc-400">
              PY_SERVER: {backendStatus.toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      {/* Main Grid Workbench */}
      <main className="flex-1 flex overflow-hidden min-h-0 bg-black">
        {/* Left Side: Parameters & File loading controls */}
        <section className={`transition-all duration-300 ease-in-out border-r border-zinc-900 flex flex-col shrink-0 select-none bg-black relative ${
          isSidebarCollapsed 
            ? "w-14 p-1.5 py-4 items-center space-y-4 overflow-hidden" 
            : "w-[300px] p-4 space-y-4 overflow-y-auto"
        }`}>
          {isSidebarCollapsed ? (
            // Collapsed Compact Panel Mode
            <>
              {/* Compact 1. Audio Setup Indicator / Upload */}
              <div className="flex flex-col items-center">
                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-2 font-mono">FILE</span>
                <div className="relative">
                  <input
                    id="file-input-collapsed"
                    type="file"
                    accept="audio/mp3,audio/wav,audio/mpeg"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <label
                    htmlFor="file-input-collapsed"
                    className={`p-2.5 rounded cursor-pointer transition-all flex items-center justify-center border flex-col ${
                      audioFile
                        ? "bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20 hover:scale-105"
                        : "bg-zinc-900 border-zinc-900/40 text-zinc-450 hover:bg-zinc-800"
                    }`}
                    title={audioFile ? `Change File: ${audioFile.name}` : "Upload Sample Audio"}
                  >
                    <Upload className="w-5 h-5" />
                  </label>
                  {audioFile && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                  )}
                </div>
                {audioFile && (
                  <span className="text-[8px] font-mono text-orange-400 mt-1 max-w-[50px] truncate text-center" title={audioFile.name}>
                    {audioFile.name.substring(0, 6)}..
                  </span>
                )}
              </div>

              {/* Compact 2. Pipeline Mode Toggle */}
              <div className="flex flex-col items-center w-full">
                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-2 font-mono">MODE</span>
                <div className="flex flex-col items-center space-y-1 bg-black p-1 rounded border border-zinc-900 w-full">
                  <button
                    type="button"
                    onClick={() => setActivePipelineMode("client")}
                    className={`p-2 rounded transition-all flex items-center justify-center w-full ${
                      activePipelineMode === "client"
                        ? "bg-zinc-900 text-orange-400 border border-zinc-900"
                        : "text-zinc-600 hover:text-zinc-400"
                    }`}
                    title="Switch to Browser Client DSP"
                  >
                    <Waves className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (backendStatus === "disconnected") {
                        alert(
                          "Local PyServer is disconnected! Please run 'python denoise_pipeline.py --serve' on your computer to process using Whisper STT and Pyannote."
                        );
                        return;
                      }
                      setActivePipelineMode("hybrid");
                    }}
                    className={`p-2 rounded transition-all flex items-center justify-center w-full ${
                      activePipelineMode === "hybrid"
                        ? "bg-zinc-900 text-orange-400 border border-zinc-900"
                        : "text-zinc-600 hover:text-zinc-400"
                    } ${backendStatus === "disconnected" ? "opacity-30 cursor-not-allowed" : ""}`}
                    title="Switch to PyServer STT"
                  >
                    <Cpu className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Compact 3. DSP Hyperparameter values */}
              <div className="flex flex-col items-center w-full">
                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-2 font-mono">DSP</span>
                <div className="flex flex-col items-center space-y-3 bg-black p-2 rounded border border-zinc-900 w-full text-center">
                  <div className="flex flex-col items-center" title={`Alpha (Subtraction Intensity): ${alpha.toFixed(1)}x`}>
                    <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-tight">α</span>
                    <span className="text-[10px] font-mono font-bold text-orange-500 mt-0.5">{alpha.toFixed(1)}</span>
                  </div>
                  <div className="h-px bg-zinc-900 w-4" />
                  <div className="flex flex-col items-center" title={`Beta (Residual Floor): ${beta.toFixed(3)}`}>
                    <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-tight">β</span>
                    <span className="text-[10px] font-mono font-bold text-orange-500 mt-0.5">{beta.toFixed(3)}</span>
                  </div>
                </div>
              </div>

              {/* Compact 4. Process Trigger */}
              <div className="flex-1 flex flex-col justify-end w-full pb-2">
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => processPipeline()}
                    disabled={isProcessing || !rawBuffer}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isProcessing
                        ? "bg-zinc-950 border border-orange-500/40 text-orange-400 cursor-wait shadow-[0_0_8px_rgba(249,115,22,0.2)]"
                        : rawBuffer
                        ? "bg-orange-500 text-black hover:bg-orange-400 hover:scale-110 active:scale-95 shadow-md shadow-orange-500/10"
                        : "bg-zinc-900 text-zinc-600 border border-zinc-800/40 cursor-not-allowed"
                    }`}
                    title={isProcessing ? "Processing Pipeline..." : rawBuffer ? "Execute Pipeline" : "Awaiting File Upload"}
                  >
                    {isProcessing ? (
                      <Activity className="w-5 h-5 animate-pulse" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                  <span className="text-[7px] text-zinc-500 font-mono mt-1 text-center">RUN</span>
                </div>
              </div>
            </>
          ) : (
            // Expanded Custom Parameters Mode
            <>
              <div>
                <h2 className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase mb-1.5 font-mono">
                  1. Audio File Setup
                </h2>
                <div className="bg-zinc-950 border border-zinc-900 rounded p-2.5 flex flex-col items-center justify-center relative">
                  <input
                    id="file-input"
                    type="file"
                    accept="audio/mp3,audio/wav,audio/mpeg"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <label
                    htmlFor="file-input"
                    className="w-full flex flex-col items-center justify-center cursor-pointer py-2 hover:bg-zinc-900/60 rounded transition-all duration-200"
                  >
                    <div className="bg-zinc-900 p-2 rounded mb-2 text-orange-500 group-hover:scale-105 transition-transform">
                      <Upload className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-zinc-200 font-mono">
                      LOAD MP3 / WAV
                    </span>
                    <span className="text-[9px] text-zinc-500 mt-0.5 font-mono">
                      Target Frequency: 16kHz
                    </span>
                  </label>

                  {audioFile && (
                    <div className="w-full border-t border-zinc-900 mt-2.5 pt-2 flex flex-col space-y-0.5 text-[11px] font-mono">
                      <div className="flex justify-between">
                        <span className="text-zinc-500 uppercase text-[9px]">File Name:</span>
                        <span className="text-zinc-200 truncate max-w-[160px] font-bold">{audioFile.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 uppercase text-[9px]">Size:</span>
                        <span className="text-zinc-200 font-bold">{(audioFile.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase mb-1.5 font-mono">
                  2. Pipeline Run Mode
                </h2>
                <div className="grid grid-cols-2 gap-1.5 bg-zinc-950 p-1 rounded border border-zinc-900">
                  <button
                    type="button"
                    onClick={() => setActivePipelineMode("client")}
                    className={`py-1 px-1.5 text-[11px] font-mono rounded font-medium transition-all ${
                      activePipelineMode === "client"
                        ? "bg-orange-500 text-black shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Client-Side DSP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (backendStatus === "disconnected") {
                        alert(
                          "Local PyServer is disconnected! Please run 'python denoise_pipeline.py --serve' on your computer to process using Whisper STT and Pyannote."
                        );
                        return;
                      }
                      setActivePipelineMode("hybrid");
                    }}
                    className={`py-1 px-1.5 text-[11px] font-mono rounded font-medium transition-all flex items-center justify-center space-x-1 ${
                      activePipelineMode === "hybrid"
                        ? "bg-orange-500 text-black shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    } ${backendStatus === "disconnected" ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>STT PyServer</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <h2 className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase flex items-center space-x-1 font-mono">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>3. DSP Params</span>
                  </h2>
                </div>

                <div className="bg-zinc-950 border border-zinc-900 rounded p-2.5 space-y-3 font-mono">
                  {/* Alpha Parameter */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-zinc-300">Alpha (Subtraction)</span>
                      <span className="text-orange-500 font-bold">{alpha.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="10.0"
                      step="0.5"
                      value={alpha}
                      onChange={(e) => setAlpha(parseFloat(e.target.value))}
                      className="w-full accent-orange-500 bg-neutral-900 h-1 rounded cursor-pointer"
                    />
                    <span className="text-[9px] text-zinc-500 leading-tight block mt-0.5">
                      Subtractive intensity limit.
                    </span>
                  </div>

                  {/* Beta Parameter */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-zinc-300">Beta (Residual Floor)</span>
                      <span className="text-orange-500 font-bold">{beta.toFixed(3)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.001"
                      max="0.1"
                      step="0.005"
                      value={beta}
                      onChange={(e) => setBeta(parseFloat(e.target.value))}
                      className="w-full accent-orange-500 bg-neutral-900 h-1 rounded cursor-pointer"
                    />
                    <span className="text-[9px] text-zinc-500 leading-tight block mt-0.5">
                      Suppresses static distortion.
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-end pt-3 font-mono">
                <button
                  type="button"
                  onClick={() => processPipeline()}
                  disabled={isProcessing || !rawBuffer}
                  className={`w-full py-2 px-3 rounded font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all ${
                    isProcessing
                      ? "bg-zinc-800 text-zinc-500 cursor-wait"
                      : rawBuffer
                      ? "bg-orange-500 text-black hover:bg-orange-400 hover:scale-[1.01]"
                      : "bg-zinc-900 text-zinc-600 cursor-not-allowed"
                  }`}
                >
                  <span>{isProcessing ? "Processing..." : "Process Pipeline"}</span>
                </button>
                {!rawBuffer && (
                  <p className="text-[8px] text-zinc-500 text-center mt-1.5">
                    [Awaiting emergency track file]
                  </p>
                )}
              </div>
            </>
          )}
        </section>

        {/* Toggle separator click area */}
        <div className="relative z-30 flex items-center justify-center w-0">
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute bg-zinc-950 border border-zinc-900 hover:bg-zinc-900 text-zinc-500 hover:text-orange-500 rounded-full p-1.5 transition-all duration-200 focus:outline-none -translate-x-1/2 hover:scale-105 flex items-center justify-center"
            style={{ top: "30px" }}
            title={isSidebarCollapsed ? "Expand" : "Collapse"}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5 text-orange-500 font-bold" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5 text-orange-500 font-bold" />
            )}
          </button>
        </div>

        {/* Right Side: Waveforms, dynamic scopes & comparative analysis text */}
        <section className="flex-1 flex flex-col overflow-hidden min-h-0 bg-black p-3.5 space-y-3.5">
          


          {/* Scrolling Workbench Area */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
                     {/* Waveform 1 Section: Raw Unprocessed Signal & Oscilloscope */}
            <div className={`bg-zinc-950 border border-zinc-900 rounded p-2.5 transition-all duration-200`}>
              <div className="grid grid-cols-12 gap-3">
                
                {/* Main Audio visual wave (Col-span-8) */}
                <div className="col-span-8 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center space-x-1.5">
                      <div className={`w-2 h-2 rounded-full ${isPlayingRaw ? "bg-red-500 animate-ping" : "bg-red-500"}`} />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono">
                        Waveform A (Raw Input Signal)
                      </h3>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {rawTime.toFixed(2)}s / {(rawBuffer?.duration || 0).toFixed(2)}s
                    </div>
                  </div>

                  <WaveformCanvas
                    id="raw-waveform"
                    audioBuffer={rawBuffer}
                    currentTime={rawTime}
                    duration={rawBuffer?.duration || 0}
                    color="rgba(239, 68, 68, 0.15)"
                    progressColor="#ef4444"
                    onSeek={seekRaw}
                    isProcessing={isProcessing}
                  />

                  {/* Seek dragging controller slider directly below Waveform A as requested */}
                  <div className="mt-1.5 flex items-center space-x-2 font-mono">
                    <span className="text-[9px] text-zinc-500">0.0s</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={rawBuffer ? (rawTime / rawBuffer.duration) * 100 : 0}
                      onChange={(e) => {
                        if (!rawBuffer) return;
                        seekRaw(parseFloat(e.target.value) / 100);
                      }}
                      className="flex-1 h-1 bg-black rounded appearance-none cursor-pointer accent-red-500"
                      disabled={!rawBuffer}
                    />
                    <span className="text-[9px] text-zinc-500">{(rawBuffer?.duration || 0).toFixed(1)}s</span>
                  </div>
                </div>

                {/* Waterfall spectrogram directly beside Waveform A (Col-span-4) */}
                <div className="col-span-4 select-none">
                  <WaterfallSpectrogram
                    isPlayingRaw={isPlayingRaw}
                    isPlayingClean={isPlayingClean}
                    analyser={activeAnalyser}
                  />
                </div>

              </div>

              <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-900/60">
                <button
                  type="button"
                  onClick={playRaw}
                  disabled={!rawBuffer}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs select-none font-bold font-mono transition-all ${
                    isPlayingRaw
                      ? "bg-red-650 text-white hover:bg-red-500"
                      : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                  } disabled:opacity-30`}
                >
                  {isPlayingRaw ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{isPlayingRaw ? "Pause Raw" : "Play Raw Track"}</span>
                </button>
                <div className="text-[10px] font-mono text-zinc-500 italic max-w-[280px] truncate">
                  [Continuous white static background noise]
                </div>
              </div>
            </div>

            {/* Waveform 2 Section: Mathematically Cleaned Audio (DSP) */}
            <div className={`bg-zinc-950 border border-zinc-900 rounded p-2.5 transition-all duration-200`}>
              <div className="flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center space-x-1.5">
                    <div className={`w-2 h-2 rounded-full ${isPlayingClean ? "bg-green-500 animate-pulse" : "bg-green-500"}`} />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono">
                      Waveform B (Denoised Output Signal - Bandpass + STFT Subtraction)
                    </h3>
                  </div>
                  {cleanedBuffer && (
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {cleanTime.toFixed(2)}s / {cleanedBuffer.duration.toFixed(2)}s
                    </div>
                  )}
                </div>

                <WaveformCanvas
                  id="clean-waveform"
                  audioBuffer={cleanedBuffer}
                  currentTime={cleanTime}
                  duration={cleanedBuffer?.duration || 0}
                  color="rgba(34, 197, 94, 0.15)"
                  progressColor="#22c55e"
                  onSeek={seekClean}
                  isProcessing={isProcessing}
                />

                {/* Seek dragging controller slider directly below Waveform B for seamless symmetry */}
                <div className="mt-1.5 flex items-center space-x-2 font-mono">
                  <span className="text-[9px] text-zinc-500">0.0s</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={cleanedBuffer ? (cleanTime / cleanedBuffer.duration) * 100 : 0}
                    onChange={(e) => {
                      if (!cleanedBuffer) return;
                      seekClean(parseFloat(e.target.value) / 100);
                    }}
                    className="flex-1 h-1 bg-black rounded appearance-none cursor-pointer accent-green-500"
                    disabled={!cleanedBuffer}
                  />
                  <span className="text-[9px] text-zinc-500">{(cleanedBuffer?.duration || 0).toFixed(1)}s</span>
                </div>
              </div>

              <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-900/60 font-mono">
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={playClean}
                    disabled={!cleanedBuffer}
                    className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs select-none font-bold transition-all ${
                      isPlayingClean
                        ? "bg-green-600 text-black hover:bg-green-500"
                        : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                    } disabled:opacity-30`}
                  >
                    {isPlayingClean ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>{isPlayingClean ? "Pause Clean" : "Play Clean"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={downloadCleanedAudio}
                    disabled={!cleanedBuffer}
                    className="flex items-center space-x-1.5 px-3 py-1 rounded text-xs bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 font-medium border border-zinc-800/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Clean .wav</span>
                  </button>
                </div>

                {dspTime !== null && (
                  <div className="text-[10px] text-green-400 bg-green-500/5 px-2 py-0.5 border border-green-500/10 rounded">
                    DSP Execution Time: {dspTime.toFixed(4)}s
                  </div>
                )}
              </div>
            </div>

            {/* AI Speaker Diarization Segments - Syncs directly with current track playhead! */}
            <div className="bg-zinc-950 border border-zinc-900 rounded p-3 flex flex-col font-mono">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-2">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-orange-500" />
                  <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                    Analysis C: Multi-Speaker Diarization (Synced Seek)
                  </span>
                </div>
                <span className="text-[9px] text-zinc-500">
                  {diarizationSegments.length > 0 ? "Interactive active pointer" : "[Awaiting voice segments]"}
                </span>
              </div>

              {diarizationSegments.length > 0 ? (
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {diarizationSegments.map((segment) => {
                    const isActive = activePlayheadTime >= segment.start && activePlayheadTime <= segment.end;
                    return (
                      <div
                        key={segment.id}
                        onClick={() => {
                          const percent = segment.start / (isPlayingClean ? (cleanedBuffer?.duration || 1) : (rawBuffer?.duration || 1));
                          if (isPlayingClean) seekClean(percent);
                          else seekRaw(percent);
                        }}
                        className={`p-2 rounded border transition-all duration-150 cursor-pointer ${
                          isActive
                            ? "bg-zinc-900/70 border-orange-500/50"
                            : "bg-black border-zinc-900 hover:border-zinc-855"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              segment.speaker.includes("DISPATCHER") ? "bg-orange-500/10 text-orange-400" : "bg-red-500/10 text-red-400"
                            }`}>
                              {segment.speaker}
                            </span>
                            <span className="text-[9px] text-zinc-500">
                              Format Centroid: {segment.signature_hz}Hz
                            </span>
                          </div>
                          <span className="text-[9px] text-zinc-500">
                            {segment.start.toFixed(1)}s - {segment.end.toFixed(1)}s
                          </span>
                        </div>
                        <p className={`text-[11px] leading-normal ${isActive ? "text-orange-400 font-bold" : "text-zinc-400"}`}>
                          {segment.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-[10px] text-zinc-600 italic border border-dashed border-zinc-900 rounded bg-black">
                  Load audio file to run instant auto-diarization timelines.
                </div>
              )}
            </div>

            {/* Final Speech-to-Text Transcription Panel (Highly Interactive Editable Area) */}
            <div className="bg-zinc-950 border border-zinc-900 rounded p-3 flex flex-col font-mono">
              <div className="flex justify-between items-center mb-2 border-b border-zinc-900 pb-2">
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-4 h-4 text-orange-500" />
                  <span className="text-[11px] font-bold text-orange-500 uppercase tracking-wider">
                    Final Transcription (Direct Carrier Signal Area)
                  </span>
                </div>
                <span className="text-[9px] text-zinc-600 italic">
                  [Direct edit access active]
                </span>
              </div>
              <textarea
                value={denoisedTranscript}
                onChange={(e) => setDenoisedTranscript(e.target.value)}
                placeholder="No voice signal is currently transcribed. Select an Emergency Preset from the left, or load a custom voice signal and start the pipeline to begin..."
                className="w-full h-[80px] bg-black border border-zinc-900 rounded p-2 text-xs text-zinc-200 font-mono leading-relaxed focus:outline-none focus:border-orange-500/40 resize-none placeholder-zinc-700 transition-colors"
              />
            </div>

            {/* Analysis D: Local Off-grid Tactical Emergency Report Card */}
            {(() => {
              const intel = aiEmergencyIntel || analyzeEmergencySpeech(denoisedTranscript);
              const hasIntel = intel.type !== "UNKNOWN";

              const urgencyColors: Record<string, string> = {
                CRITICAL: "bg-red-500/10 border-red-500/20 text-red-500 font-bold",
                HIGH: "bg-orange-500/10 border-orange-500/20 text-orange-400 font-bold",
                MEDIUM: "bg-orange-500/5 border-zinc-900 text-orange-500/80",
                LOW: "bg-zinc-900 border-zinc-900 text-zinc-500"
              };

              return (
                <div className="bg-zinc-950 border border-zinc-900 rounded p-3.5 flex flex-col space-y-3 font-mono">
                  
                  {/* Title Bar */}
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                    <div className="flex items-center space-x-2">
                      <Siren className="w-4.5 h-4.5 text-orange-500" />
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-wide">
                          Analysis D: On-Device Emergency Intelligence
                        </span>
                        <span className="text-[9px] text-zinc-500">
                          {aiEmergencyIntel ? "Deep Analysis: Powered by Ollama AI" : "Fast Analysis: Local Pattern Matching"}
                        </span>
                      </div>
                    </div>
                    {hasIntel && (
                      <span className={`text-[9px] px-2 py-0.5 rounded border ${urgencyColors[intel.urgency]}`}>
                        URGENCY: {intel.urgency}
                      </span>
                    )}
                  </div>

                  {/* Dynamic Intelligence Layout */}
                  {hasIntel ? (
                    <div className="grid grid-cols-12 gap-3 text-left">
                      
                      {/* Left Bento Segment: Category, confidence and Location (Col-6) */}
                      <div className="col-span-6 space-y-2.5">
                        <div className="bg-black border border-zinc-900 rounded p-2.5 flex items-start space-x-2">
                          <div className="p-1 px-1.5 bg-zinc-950 text-orange-500 rounded border border-zinc-900 text-xs">
                            🔥
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block">
                              Emergency Incident Profile
                            </span>
                            <span className="text-xs font-bold text-zinc-100 uppercase">
                              {intel.type.replace("_", " ")}
                            </span>
                            <div className="flex items-center space-x-2 mt-1">
                              <div className="flex-1 bg-zinc-900 h-1 rounded overflow-hidden">
                                <div 
                                  className="bg-orange-500 h-full transition-all duration-300" 
                                  style={{ width: `${intel.confidence}%` }} 
                                />
                              </div>
                              <span className="text-[8px] font-bold text-orange-500">
                                {intel.confidence.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-black border border-zinc-900 rounded p-2.5 flex items-start space-x-2">
                          <div className="p-1 px-1.5 bg-zinc-950 text-orange-500 rounded border border-zinc-900 text-xs">
                            📍
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block">
                              Extracted Incident Location
                            </span>
                            <span className="text-[11px] text-zinc-300 leading-normal font-bold truncate block">
                              {intel.location}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Bento Segment: Hazards and victim status (Col-6) */}
                      <div className="col-span-6 space-y-2.5">
                        <div className="bg-black border border-zinc-900 rounded p-2.5 flex flex-col space-y-1 min-h-[56px]">
                          <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block">
                            Identified Technical Hazards
                          </span>
                          {intel.hazards.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {intel.hazards.map((hazard, i) => (
                                <span 
                                  key={i} 
                                  className="bg-red-500/10 border border-red-500/20 text-[8px] text-red-400 px-1.5 py-0.2 rounded"
                                >
                                  {hazard}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[9px] text-zinc-600 italic">No hazard vectors identified</span>
                          )}
                        </div>

                        <div className="bg-black border border-zinc-900 rounded p-2.5 flex flex-col space-y-1">
                          <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block">
                            Casualty / Victim Check
                          </span>
                          <span className="text-[10px] text-zinc-300 leading-snug">
                            {intel.casualties}
                          </span>
                        </div>
                      </div>

                      {/* Full-width Tactical Field Recommendations */}
                      <div className="col-span-12 border-t border-zinc-900 pt-2.5">
                        <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                          Tactical Action Dispatch Sequence
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {intel.tacticalAction.map((action, index) => (
                            <div key={index} className="flex items-start space-x-1.5 bg-black border border-zinc-900 p-2 rounded">
                              <span className="text-green-500 text-[10px] font-bold">✔</span>
                              <span className="text-[10.5px] text-zinc-300 leading-tight">
                                {action}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="py-6 flex flex-col items-center justify-center border border-dashed border-zinc-900 rounded bg-black text-zinc-600 select-none">
                      <span className="text-lg mb-1">🛡</span>
                      <span className="text-[10px] uppercase font-bold text-zinc-600">Off-Grid Analyzer Idle</span>
                      <span className="text-[9px] text-zinc-700 mt-0.5">Edit transcription above or click emergency preset to populate insights</span>
                    </div>
                  )}

                </div>
              );
            })()}

            {/* Analysis E: Local LLM Tactical Insights (Ollama) */}
            <div className="bg-zinc-950 border border-zinc-900 rounded p-3.5 flex flex-col space-y-3 font-mono">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-4.5 h-4.5 text-orange-500" />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-wide">
                      Analysis E: LLM Cognitive Tactical Summary
                    </span>
                    <span className="text-[9px] text-zinc-500">
                      Processed locally via Llama 3.2 (Ollama Engine)
                    </span>
                  </div>
                </div>
                {ollamaInsights && !ollamaInsights.startsWith("[") && (
                  <span className="text-[9px] px-2 py-0.5 rounded border border-green-500/20 bg-green-500/10 text-green-400">
                    AI GEN COMPLETE
                  </span>
                )}
              </div>

              {ollamaInsights ? (
                <div className="bg-black border border-zinc-900 rounded p-3 text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-[250px] overflow-y-auto custom-scrollbar">
                  {ollamaInsights}
                </div>
              ) : (
                <div className="py-6 flex flex-col items-center justify-center border border-dashed border-zinc-900 rounded bg-black text-zinc-600 select-none">
                  <span className="text-lg mb-1">🤖</span>
                  <span className="text-[10px] uppercase font-bold text-zinc-600">LLM Processor Idle</span>
                  <span className="text-[9px] text-zinc-700 mt-0.5">Run 'Hybrid Mode' to generate advanced tactical LLM insights</span>
                </div>
              )}
            </div>

          </div>
        </section>
      </main>
        </>
      )}

      {/* Login Screen Overlay */}
      {!isLoggedIn && (
        <div className={`absolute inset-0 z-[100] bg-black text-zinc-100 flex items-center justify-center font-mono p-4 transition-transform duration-1000 ease-in-out ${isTransitioning ? '-translate-y-full' : 'translate-y-0'}`}>
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 p-8 rounded shadow-2xl relative overflow-hidden">
            
            {/* Loading indicator bar */}
            {isAuthenticating && (
              <div className="absolute inset-x-0 top-0 h-1 bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.6)] animate-pulse" />
            )}

            <div className="flex flex-col items-center mb-8">
              <Activity className={`h-10 w-10 text-orange-500 mb-3 transition-transform duration-500 ${isAuthenticating ? 'animate-spin' : ''}`} />
              <h1 className="text-xl font-black tracking-[0.2em] text-orange-500 uppercase leading-none">
                RESCUE AI
              </h1>
              <div className="h-px w-12 bg-zinc-800 my-3" />
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                {isAuthenticating ? "System Initialization Underway" : "Tactical Terminal Login"}
              </p>
            </div>

            {isAuthenticating ? (
              <div className="flex flex-col items-center space-y-6 py-4 animate-pulse">
                <div className="flex space-x-1.5">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest">Handshaking DSP...</p>
                  <p className="text-[8px] text-zinc-500 uppercase tracking-tighter">Allocating Local Inference Cores</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5 tracking-wider">Username</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-black border border-zinc-900 rounded p-2 text-xs focus:outline-none focus:border-orange-500/40 transition-colors"
                    placeholder="Enter ID"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5 tracking-wider">Password</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black border border-zinc-900 rounded p-2 text-xs focus:outline-none focus:border-orange-500/40 transition-colors"
                    placeholder="••••"
                  />
                </div>

                {loginError && (
                  <div className="p-2 bg-red-500/10 border border-red-500/20 rounded flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    <span className="text-[10px] font-bold text-red-500 uppercase">{loginError}</span>
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full py-2 bg-orange-500 text-black text-xs font-bold uppercase tracking-widest hover:bg-orange-400 transition-all rounded shadow-lg shadow-orange-500/5 active:scale-[0.98]"
                >
                  Initialize Session
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
