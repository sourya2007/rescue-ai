import subprocess
import sys
import os
import time
import signal

def launch_ecosystem():
    """
    Orchestrates the simultaneous launch of the FastAPI backend and React frontend.
    """
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    
    # Detect venv python interpreter
    if os.name == 'nt':
        python_exe = os.path.join(root_dir, ".venv", "Scripts", "python.exe")

    if not os.path.exists(python_exe):
        print(f"[Error] Virtual environment not found at: {python_exe}")
        print("Please run: python -m venv .venv && .\\.venv\\Scripts\\activate && pip install -r requirements.txt")
        return

    # Check for frontend dependencies
    if not os.path.exists(os.path.join(root_dir, "node_modules")):
        print("[Error] Frontend dependencies (node_modules) not found.")
        print("Please run 'npm install' in the project root before launching.")
        return

    print("\n" + "="*50)
    print("          RESCUE AI: INTEGRATED LAUNCHER          ")
    print("="*50)

    # 1. Start Python FastAPI Backend
    print("[System] Initializing Tactical Audio Pipeline (Backend)...")
    backend_proc = subprocess.Popen(
        [python_exe, "denoise_pipeline.py", "--serve"],
        cwd=backend_dir
    )

    # 2. Start React Frontend
    print("[System] Initializing Rescue Dashboard (Frontend)...")
    # shell=True is required on Windows to resolve the 'npm' command path
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=root_dir,
        shell=True
    )

    print("\n[Status] Both engines are initializing.")
    print(" -> Backend API: http://127.0.0.1:8000")
    print(" -> Frontend UI: http://localhost:5173 (standard Vite port)")
    print("\n[Action] Press CTRL+C to stop both servers safely.\n")

    try:
        while True:
            time.sleep(1)
            # Monitor if either process has died
            if backend_proc.poll() is not None:
                print("[Critical] Backend process has stopped.")
                break
            if frontend_proc.poll() is not None:
                print("[Critical] Frontend process has stopped.")
                break
    except KeyboardInterrupt:
        print("\n[Shutdown] Signal received. Terminating processes...")
    finally:
        # Graceful cleanup
        backend_proc.terminate()
        frontend_proc.terminate()
        print("[Shutdown] Servers stopped. Cleanup complete.")

if __name__ == "__main__":
    # Ensure HF_TOKEN is set in your environment before running this 
    # or add: os.environ["HF_TOKEN"] = "your_token_here"
    launch_ecosystem()