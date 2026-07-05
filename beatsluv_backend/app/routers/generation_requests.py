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


def ensure_prompt_versions_table(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS prompt_versions (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES users(id),
                track_id INT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                parent_track_id INT REFERENCES tracks(id) ON DELETE SET NULL,
                version_number INT NOT NULL,
                prompt TEXT NOT NULL,
                genre VARCHAR(100),
                mood VARCHAR(100),
                tempo INT,
                duration_seconds INT,
                ai_temperature NUMERIC(3, 2),
                key_signature VARCHAR(20),
                predicted_rating NUMERIC(4, 2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )


def next_version_number(cur, parent_track_id):
    if not parent_track_id:
        return 1

    cur.execute(
        """
        SELECT COALESCE(MAX(version_number), 1) + 1 AS next_version
        FROM prompt_versions
        WHERE track_id = %s OR parent_track_id = %s;
        """,
        (parent_track_id, parent_track_id),
    )
    row = cur.fetchone()
    return row["next_version"] if row else 2


class GenerationRequestCreate(BaseModel):
    prompt: str
    genre: Optional[str] = None
    mood: Optional[str] = None
    tempo: Optional[int] = None
    ai_temperature: Optional[float] = 0.7
    key_signature: Optional[str] = None
    duration_seconds: int = 30
    is_public: bool = True
    parent_track_id: Optional[int] = None
    predicted_rating: Optional[float] = None


@router.post("")
def create_generation_request(
    request: GenerationRequestCreate, 
    current_user: dict = Depends(verify_token)
):
    generator = MusicGeneratorService()

    with get_connection() as conn:
        ensure_track_analytics_columns(conn)
        ensure_prompt_versions_table(conn)
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
                INSERT INTO prompt_versions (
                    user_id,
                    track_id,
                    parent_track_id,
                    version_number,
                    prompt,
                    genre,
                    mood,
                    tempo,
                    duration_seconds,
                    ai_temperature,
                    key_signature,
                    predicted_rating
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                """,
                (
                    current_user["id"],
                    track["id"],
                    request.parent_track_id,
                    next_version_number(cur, request.parent_track_id),
                    request.prompt,
                    request.genre,
                    request.mood,
                    request.tempo,
                    request.duration_seconds,
                    request.ai_temperature,
                    request.key_signature,
                    request.predicted_rating,
                ),
            )

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
