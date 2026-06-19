import os
import time
import base64
import argparse
import sys
import tempfile
import hashlib
import json

import numpy as np
from scipy.io import wavfile
from scipy import signal
import torch
import torchaudio
import soundfile as sf
import whisper
from pyannote.audio import Pipeline

try:
    from fastapi import FastAPI, UploadFile, File, Form, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn
except ImportError:
    print("FastAPI dependencies not installed inside the active environment.")
    print("Please run: pip install fastapi uvicorn python-multipart pydantic")
    sys.exit(1)

# Import the Ollama local AI Model module
try:
    from ollama_insights import generate_transcript_insights, generate_structured_intel, label_speaker_roles
except ImportError:
    # Fallback in case of module displacement
    def generate_transcript_insights(structured_transcript):
        print("[Local AI Engine] ollama_insights.py module helper missing.")
        return None

    def generate_structured_intel(structured_transcript):
        print("[Local AI Engine] ollama_insights.py module helper missing.")
        return None

    def label_speaker_roles(diarization_output):
        print("[Local AI Engine] ollama_insights.py module helper missing.")
        return diarization_output


def apply_spectral_subtraction(audio_path, alpha=3.5, beta=0.02):
    """Actual Python implementation of Spectral Subtraction DSP"""
    fs, data = wavfile.read(audio_path)
    if data.dtype != np.float32:
        data = data.astype(np.float32) / 32768.0

    # Handle multi-channel
    if len(data.shape) > 1:
        data = data[:, 0]

    # STFT
    f, t, Zxx = signal.stft(data, fs, nperseg=512, noverlap=384)
    magnitude = np.abs(Zxx) 
    phase = np.angle(Zxx)

    # Estimate noise from first 0.5s
    n_noise_frames = int(0.5 / (t[1] - t[0]))
    noise_mu = np.mean(magnitude[:, :max(1, n_noise_frames)], axis=1, keepdims=True)

    # Subtraction
    magnitude_sq = magnitude**2
    noise_mu_sq = noise_mu**2

    gain = np.maximum(magnitude_sq - alpha * noise_mu_sq, beta * magnitude_sq)
    cleaned_magnitude = np.sqrt(gain)

    # Reconstruct
    Zxx_cleaned = cleaned_magnitude * np.exp(1j * phase)
    _, x_cleaned = signal.istft(Zxx_cleaned, fs, nperseg=512, noverlap=384)

    # Convert back to 16-bit PCM for transmission
    out_bytes = (x_cleaned * 32767).astype(np.int16).tobytes()
    return fs, out_bytes

# --- MODEL INITIALIZATION ---
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[Engine] Initializing ML models on device: {DEVICE}")

# Use 'small' or 'medium' for better accuracy if your VRAM allows (>4GB)
print("[Engine] Loading Whisper (small)...")
whisper_model = whisper.load_model("small", device=DEVICE)

print("[Engine] Loading Pyannote Diarization (3.1)...")
HF_TOKEN = os.getenv("HF_TOKEN", "")
try:
    if not HF_TOKEN:
        print("!!! Warning: HF_TOKEN not found in environment. Diarization may fail if models aren't cached.")
    
    diarization_pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=HF_TOKEN)
    if diarization_pipeline:
        diarization_pipeline.to(DEVICE)
except Exception as e:
    print(f"!!! Pyannote Load Error: {e}. Diarization will be skipped.")
    diarization_pipeline = None

app = FastAPI(
    title="Tactical Audio Denoise & AI Diarization Pipeline Host",
    description="Local high-performance Python companion server using Whisper and Pyannote.audio"
)

# Enable CORS for local cross-origin React applet connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/status")
async def get_status():
    """
    Returns the server connection health indicators to the React panel.
    """
    return {
        "status": "connected",
        "engine": "Local PyServer Platform Host",
        "cuda_available": torch.cuda.is_available(),
        "supported_models": ["whisper-base", "pyannote-diarization-3.1", "llama3.2:3b (Ollama)"]
    }

@app.post("/api/process")
async def process_audio(
    file: UploadFile = File(...),
    alpha: float = Form(3.5),
    beta: float = Form(0.02),
    remodel: bool = Form(False)
):
    """
    Deep-cleans noise with spectral subtraction, runs speech transcription,
    aligns speaker segments, and uses the local Ollama LLM to output insights.
    """
    t0 = time.time()

    # Read uploaded raw audio bytes
    audio_content = await file.read()

    # --- CACHE CHECK ---
    file_hash = hashlib.md5(audio_content).hexdigest()
    cache_path = os.path.join(CACHE_DIR, f"{file_hash}.json")

    if not remodel and os.path.exists(cache_path):
        print(f"[Engine] Found cached results for hash: {file_hash}. Skipping model inference.")
        with open(cache_path, "r") as f:
            return json.load(f)

    # We must save to a temporary file for Pyannote/Whisper to process efficiently
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(audio_content)
        tmp_path = tmp.name

    try:
        # Load and resample to 16kHz using Whisper's robust utility
        # This bypasses torchaudio's backend/torchcodec issues on Windows
        audio_np = whisper.load_audio(tmp_path)
        sample_rate = 16000
        sf.write(tmp_path, audio_np, sample_rate)

        # --- STEP 1: DSP Denoising ---
        dsp_t0 = time.time()
        _, cleaned_pcm = apply_spectral_subtraction(tmp_path, alpha, beta)
        dsp_time = time.time() - dsp_t0

        # --- STEP 2: STT + Diarization ---
        stt_t0 = time.time()
        result = whisper_model.transcribe(tmp_path, beam_size=5)
        stt_time = time.time() - stt_t0

        diarization_output = []
        if diarization_pipeline:
            dz = diarization_pipeline(tmp_path, num_speakers=None)
            for i, segment in enumerate(result['segments']):
                start, end = segment['start'], segment['end']
                current_speaker = "UNKNOWN"
                max_overlap = 0
                for speech_turn, _, speaker in dz.itertracks(yield_label=True):
                    overlap = max(0, min(end, speech_turn.end) - max(start, speech_turn.start))
                    if overlap > max_overlap:
                        max_overlap = overlap
                        current_speaker = speaker

                diarization_output.append({
                    "id": f"seg_{i:02d}",
                    "speaker": current_speaker,
                    "text": segment['text'].strip(),
                    "start": round(start, 2),
                    "end": round(end, 2)
                })
        else:
            # Fallback if diarization is unavailable
            diarization_output = [{
                "id": f"seg_{i:02d}", "speaker": "SPEAKER_00", "text": s['text'].strip(),
                "start": round(s['start'], 2), "end": round(s['end'], 2)
            } for i, s in enumerate(result['segments'])]

        # --- STEP 3: Contextual Role Labeling via Local LLM ---
        diarization_output = label_speaker_roles(diarization_output)

        raw_transcript = result['text']
        cleaned_transcript = "\n".join([f"{s['speaker']} [{s['start']}s]: {s['text']}" for s in diarization_output])

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    # --- STEP 4: Local AI Insights Generation via Ollama ---
    # Pack diarization output and invoke the local llama3.2 model module
    local_insights = generate_transcript_insights(diarization_output)
    ai_structured_intel = generate_structured_intel(diarization_output)
    
    # Create actual WAV header for the cleaned PCM data
    import io
    import wave
    
    with io.BytesIO() as wav_file:
        with wave.open(wav_file, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(cleaned_pcm)
        real_cleaned_b64 = base64.b64encode(wav_file.getvalue()).decode("utf-8")

    total_latency = time.time() - t0

    result = {
        "dsp_time_sec": round(dsp_time, 2),
        "raw_inference_time_sec": round(stt_time, 2),
        "raw_transcript": raw_transcript,
        "denoised_transcript": cleaned_transcript,
        "diarization_cleaned": diarization_output,
        "cleaned_audio_base64": real_cleaned_b64,
        "local_llm_insights": local_insights,
        "ai_structured_intel": ai_structured_intel,
        "server_total_latency": round(total_latency, 2)
    }

    # Save to cache for future requests
    with open(cache_path, "w") as f:
        json.dump(result, f)

    return result

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Serve tactical denoise FastAPI back-end.")
    parser.add_argument("--serve", action="store_true", help="Launch the local FastAPI host process")
    args = parser.parse_args()
    
    if args.serve or len(sys.argv) == 1:
        print("\n" + "="*60)
        print("     TACTICAL AUDIO PIPELINE PI-SERVER LAUNCHED      ")
        print("="*60)
        print("Connecting to local host at: http://127.0.0.1:8000")
        print("To connect from the React Applet UI:")
        print("1. Confirm 'llama3.2:3b' is pulled in Ollama: 'ollama run llama3.2:3b'")
        print("2. Run: python denoise_pipeline.py --serve")
        print("="*60 + "\n")
        uvicorn.run(app, host="127.0.0.1", port=8000)
    else:
        print("Invalid flags. Run 'python denoise_pipeline.py --serve' to launch the API endpoint server.")
