import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.auth import verify_token
from app.database import get_connection
from app.services.music_generator import MusicGenerationError, MusicGeneratorService


router = APIRouter(prefix="/generation-requests", tags=["generation requests"])
logger = logging.getLogger(__name__)


def ensure_track_analytics_columns(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            ALTER TABLE tracks
            ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS prompt TEXT,
            ADD COLUMN IF NOT EXISTS genre VARCHAR(100),
            ADD COLUMN IF NOT EXISTS mood VARCHAR(100),
            ADD COLUMN IF NOT EXISTS tempo INT,
            ADD COLUMN IF NOT EXISTS ai_temperature NUMERIC(3, 2),
            ADD COLUMN IF NOT EXISTS key_signature VARCHAR(20),
            ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
            """
        )


class GenerationRequestCreate(BaseModel):
    prompt: str
    genre: Optional[str] = None
    mood: Optional[str] = None
    tempo: Optional[int] = None
    ai_temperature: Optional[float] = 0.7
    key_signature: Optional[str] = None
    duration_seconds: int = 30
    is_public: bool = True


@router.post("")
def create_generation_request(
    request: GenerationRequestCreate, 
    current_user: dict = Depends(verify_token)
):
    """
    Create a generation request, generate music, then save a track.
    """
    generator = MusicGeneratorService()

    with get_connection() as conn:
        ensure_track_analytics_columns(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO generation_requests (
                    user_id,
                    prompt,
                    genre,
                    mood,
                    tempo,
                    ai_temperature,
                    key_signature,
                    duration_seconds,
                    status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *;
                """,
                (
                    current_user["id"],
                    request.prompt,
                    request.genre,
                    request.mood,
                    request.tempo,
                    request.ai_temperature,
                    request.key_signature,
                    request.duration_seconds,
                    "PROCESSING",
                ),
            )
            generation_request = cur.fetchone()

            try:
                generated_track = generator.generate_track(
                    prompt=request.prompt,
                    genre=request.genre,
                    mood=request.mood,
                    tempo=request.tempo,
                    duration_seconds=request.duration_seconds,
                )
                if not generated_track.get("audio_url"):
                    raise MusicGenerationError("Music generation finished without an audio file.")
            except MusicGenerationError as exc:
                logger.exception("Music generation failed")
                cur.execute(
                    """
                    UPDATE generation_requests
                    SET status = %s
                    WHERE id = %s;
                    """,
                    ("FAILED", generation_request["id"]),
                )
                conn.commit()
                raise HTTPException(status_code=502, detail=str(exc) or "Couldn't generate") from exc

            request_status = "COMPLETED"

            cur.execute(
                """
                INSERT INTO tracks (
                    generation_request_id,
                    title,
                    audio_url,
                    duration_seconds,
                    status,
                    user_id,
                    prompt,
                    genre,
                    mood,
                    tempo,
                    ai_temperature,
                    key_signature,
                    is_public
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *;
                """,
                (
                    generation_request["id"],
                    generated_track["title"],
                    generated_track["audio_url"],
                    generated_track["duration_seconds"],
                    request_status,
                    current_user["id"],
                    request.prompt,
                    request.genre,
                    request.mood,
                    request.tempo,
                    request.ai_temperature,
                    request.key_signature,
                    request.is_public,
                ),
            )
            track = cur.fetchone()

            cur.execute(
                """
                UPDATE generation_requests
                SET status = %s
                WHERE id = %s;
                """,
                (request_status, generation_request["id"]),
            )

            conn.commit()

    return track
