from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import feedback, generation_requests, tracks


app = FastAPI(title="BeatsLuv API")

# Allow the local React app to call the backend during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
GENERATED_AUDIO_DIR = PROJECT_ROOT / "generated_audio"
GENERATED_AUDIO_DIR.mkdir(exist_ok=True)

# Generated MP3 files are saved locally and exposed through this route.
app.mount("/generated-audio", StaticFiles(directory=GENERATED_AUDIO_DIR), name="generated_audio")


@app.get("/")
def health_check():
    return {"status": "ok", "message": "BeatsLuv API is running"}


app.include_router(tracks.router)
app.include_router(generation_requests.router)
app.include_router(feedback.router)
