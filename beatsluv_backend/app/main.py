from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import (
    admin,
    analytics,
    auth,
    feedback,
    generation_requests,
    playlists,
    predictions,
    tracks,
    users,
)


app = FastAPI(title="BeatsLuv API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
GENERATED_AUDIO_DIR = PROJECT_ROOT / "generated_audio"
GENERATED_AUDIO_DIR.mkdir(exist_ok=True)

app.mount("/generated-audio", StaticFiles(directory=GENERATED_AUDIO_DIR), name="generated_audio")

@app.get("/")
def health_check():
    return {"status": "ok", "message": "BeatsLuv API is running"}

app.include_router(auth.router)
app.include_router(tracks.router)
app.include_router(generation_requests.router)
app.include_router(feedback.router)
app.include_router(analytics.router)
app.include_router(predictions.router)
app.include_router(playlists.router)
app.include_router(admin.router)
app.include_router(users.router)
