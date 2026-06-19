<div align="center">
<img width="1200" height="400" alt="Rescue AI Banner" src="https://github.com/sourya2007/rescue-ai/blob/main/src/RESCUE.png?raw=true" />

# RESCUE AI
### Radio Enhancement and Speech Clarification for Urgent Emergencies
</div>

RESCUE AI is a high-performance tactical workbench designed to process, clarify, and analyze emergency radio transmissions. It utilizes advanced Digital Signal Processing (DSP), machine learning for speech-to-text and diarization, and local LLMs to provide structured tactical intelligence—all designed to function in off-grid or low-connectivity environments.

---

## 🚀 The Audio Processing Pipeline

The system employs a multi-stage pipeline to transform noisy radio audio into actionable intelligence:

1.  **DSP Cleaning (Spectral Subtraction):** Removes persistent white noise and static using STFT-based magnitude subtraction.
2.  **Speech-to-Text (Whisper):** Transcribes audio using OpenAI's Whisper model (running locally).
3.  **Speaker Diarization (Pyannote):** Identifies different speakers (e.g., 911 Dispatcher vs. Speaker) and segments the transcript.
4.  **AI Consultation (Ollama/Llama 3.2):** A local LLM analyzes the transcript to extract:
    *   **Incident Profile:** (Fire, Medical, Security, etc.)
    *   **Tactical Metadata:** Location, Hazards, and Urgency levels.
    *   **Action Items:** Specific dispatch tasks for first responders.

---

## 📂 Folder Structure

```text
rescue-ai/
├── backend/                    # Python FastAPI Backend
│   ├── denoise_pipeline.py     # Main API, DSP logic, Whisper & Pyannote integration
│   └── ollama_insights.py      # Structured AI extraction via local Ollama engine
├── src/                        # React (Vite) Frontend
│   ├── components/             # UI Components (Waterfall Spectrograms, etc.)
│   ├── utils/                  
│   │   ├── audioDsp.ts         # Client-side fallback DSP (FFT/Filters)
│   │   └── localEmergencyNlp.ts # Client-side regex-based NLP fallback
│   └── App.tsx                 # Main Dashboard and Orchestration logic
├── backend.py                  # Unified Ecosystem Launcher (starts Front & Back)
├── package.json                # Frontend dependencies
└── requirements.txt            # Python environment dependencies
```

---

## 🛠 Technical Stack

*   **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons.
*   **Audio Engine:** WebAudio API (Real-time analysis & Waterfall visualization).
*   **Backend:** FastAPI (Python), Uvicorn.
*   **AI Models:**
    *   **Whisper (small):** Local Speech-to-Text.
    *   **Pyannote 3.1:** Speaker Diarization.
    *   **Ollama (Llama 3.2:3b):** Local Tactical Intelligence extraction.

---

## ⚙️ Setup & Deployment

### Prerequisites

1.  **Node.js & npm:** For the React dashboard.
2.  **Python 3.10+:** For the AI processing pipeline.
3.  **Ollama:** Install from ollama.com and pull the model:
    ```bash
    ollama run llama3.2:3b
    ```
4.  **Hugging Face Token:** Required for Pyannote models. Accept the terms for `pyannote/speaker-diarization-3.1` on Hugging Face.

### Installation

1.  **Clone the Repository:**
    ```bash
    git clone <repository-url>
    cd rescue-ai
    ```

2.  **Setup Virtual Environment (Recommended):**
    ```bash
    python -m venv .venv
    # Windows
    .\.venv\Scripts\activate
    # Linux/Mac
    source .venv/bin/activate
    ```

3.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    npm install
    ```

4.  **Environment Variables:**
    Set your Hugging Face token (required for Diarization):
    ```bash
    # Windows (PowerShell)
    $env:HF_TOKEN = "your_token_here"
    # Linux/Mac
    export HF_TOKEN="your_token_here"
    ```

### Running the Ecosystem

You can launch both the frontend and the backend simultaneously using the integrated launcher:

```bash
python backend.py
```

*   **Dashboard:** `http://localhost:5173`
*   **API Server:** `http://127.0.0.1:8000`

---

*Note: If running in off-grid mode without the Python backend, the dashboard will automatically fall back to browser-based DSP and regex-based NLP for basic functionality.*
