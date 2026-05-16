from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.database import get_connection
from app.services.music_generator import MusicGeneratorService


router = APIRouter(prefix="/generation-requests", tags=["generation requests"])


class GenerationRequestCreate(BaseModel):
    user_id: int
    prompt: str
    genre: Optional[str] = None
    mood: Optional[str] = None
    tempo: Optional[int] = None
    duration_seconds: int = 30


@router.post("")
def create_generation_request(request: GenerationRequestCreate):
    """
    Create a generation request, try to generate music, then save a track.

    The external AI call is intentionally a placeholder for now. If it fails,
    the service returns a mock track so the backend can still be tested.
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
                    request.user_id,
                    request.prompt,
                    request.genre,
                    request.mood,
                    request.tempo,
                    request.duration_seconds,
                    "PROCESSING",
                ),
            )
            generation_request = cur.fetchone()

            generated_track = generator.generate_track(
                prompt=request.prompt,
                genre=request.genre,
                mood=request.mood,
                tempo=request.tempo,
                duration_seconds=request.duration_seconds,
            )

            request_status = "COMPLETED_MOCK" if generated_track["is_mock"] else "COMPLETED"

            cur.execute(
                """
                INSERT INTO tracks (
                    generation_request_id,
                    title,
                    audio_url,
                    duration_seconds,
                    status,
                    predicted_success_score
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING *;
                """,
                (
                    generation_request["id"],
                    generated_track["title"],
                    generated_track["audio_url"],
                    generated_track["duration_seconds"],
                    request_status,
                    generated_track.get("predicted_success_score"),
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
