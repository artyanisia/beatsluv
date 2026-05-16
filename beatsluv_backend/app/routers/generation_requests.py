from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.auth import verify_token
from app.database import get_connection
from app.services.music_generator import MusicGenerationError, MusicGeneratorService


router = APIRouter(prefix="/generation-requests", tags=["generation requests"])


class GenerationRequestCreate(BaseModel):
    prompt: str
    genre: Optional[str] = None
    mood: Optional[str] = None
    tempo: Optional[int] = None
    duration_seconds: int = 30


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
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO generation_requests (
                    user_id,
                    prompt,
                    genre,
                    mood,
                    tempo,
                    duration_seconds,
                    status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING *;
                """,
                (
                    current_user["id"],
                    request.prompt,
                    request.genre,
                    request.mood,
                    request.tempo,
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
            except MusicGenerationError as exc:
                cur.execute(
                    """
                    UPDATE generation_requests
                    SET status = %s
                    WHERE id = %s;
                    """,
                    ("FAILED", generation_request["id"]),
                )
                conn.commit()
                raise HTTPException(status_code=502, detail="Couldn't generate") from exc

            request_status = "COMPLETED"

            cur.execute(
                """
                INSERT INTO tracks (
                    generation_request_id,
                    title,
                    audio_url,
                    duration_seconds,
                    status
                )
                VALUES (%s, %s, %s, %s, %s)
                RETURNING *;
                """,
                (
                    generation_request["id"],
                    generated_track["title"],
                    generated_track["audio_url"],
                    generated_track["duration_seconds"],
                    request_status,
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
