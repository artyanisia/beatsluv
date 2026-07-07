import os
import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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


logger = logging.getLogger(__name__)
app = FastAPI(title="BeatsLuv API")


def get_cors_config():
    configured_origins = os.getenv("CORS_ORIGINS", "").strip()
    if not configured_origins or configured_origins == "*":
        return {"allow_origins": [], "allow_origin_regex": ".*"}

    origins = [origin.strip() for origin in configured_origins.split(",") if origin.strip()]
    return {"allow_origins": origins, "allow_origin_regex": None}


cors_config = get_cors_config()
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_config["allow_origins"],
    allow_origin_regex=cors_config["allow_origin_regex"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def add_error_cors_headers(response: JSONResponse, request: Request):
    origin = request.headers.get("origin")
    if not origin:
        return

    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Vary"] = "Origin"


PROJECT_ROOT = Path(__file__).resolve().parents[1]
GENERATED_AUDIO_DIR = PROJECT_ROOT / "generated_audio"
GENERATED_AUDIO_DIR.mkdir(exist_ok=True)

app.mount("/generated-audio", StaticFiles(directory=GENERATED_AUDIO_DIR), name="generated_audio")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error while processing %s %s", request.method, request.url.path)
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
    add_error_cors_headers(response, request)
    return response


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
