from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import get_connection


router = APIRouter(prefix="/tracks", tags=["tracks"])


class TrackCreate(BaseModel):
    generation_request_id: int
    title: str
    audio_url: str
    duration_seconds: int
    status: str = "READY"
    predicted_success_score: Optional[float] = None


class TrackUpdate(BaseModel):
    title: Optional[str] = None
    audio_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    status: Optional[str] = None
    predicted_success_score: Optional[float] = None


@router.get("")
def get_tracks():
    # Manual SQL query. No ORM is used in this project.
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM tracks ORDER BY id;")
            return cur.fetchall()


@router.get("/{track_id}")
def get_track(track_id: int):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM tracks WHERE id = %s;", (track_id,))
            track = cur.fetchone()

    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    return track


@router.post("")
def create_track(track: TrackCreate):
    with get_connection() as conn:
        with conn.cursor() as cur:
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
                    track.generation_request_id,
                    track.title,
                    track.audio_url,
                    track.duration_seconds,
                    track.status,
                    track.predicted_success_score,
                ),
            )
            created_track = cur.fetchone()
            conn.commit()

    return created_track


@router.put("/{track_id}")
def update_track(track_id: int, track: TrackUpdate):
    existing_track = get_track(track_id)

    # Keep updates beginner-friendly by replacing missing fields with old values.
    updated_title = track.title if track.title is not None else existing_track["title"]
    updated_audio_url = track.audio_url if track.audio_url is not None else existing_track["audio_url"]
    updated_duration = (
        track.duration_seconds
        if track.duration_seconds is not None
        else existing_track["duration_seconds"]
    )
    updated_status = track.status if track.status is not None else existing_track["status"]
    updated_score = (
        track.predicted_success_score
        if track.predicted_success_score is not None
        else existing_track["predicted_success_score"]
    )

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE tracks
                SET title = %s,
                    audio_url = %s,
                    duration_seconds = %s,
                    status = %s,
                    predicted_success_score = %s
                WHERE id = %s
                RETURNING *;
                """,
                (
                    updated_title,
                    updated_audio_url,
                    updated_duration,
                    updated_status,
                    updated_score,
                    track_id,
                ),
            )
            updated_track = cur.fetchone()
            conn.commit()

    return updated_track


@router.delete("/{track_id}")
def delete_track(track_id: int):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM tracks WHERE id = %s RETURNING *;", (track_id,))
            deleted_track = cur.fetchone()
            conn.commit()

    if not deleted_track:
        raise HTTPException(status_code=404, detail="Track not found")

    return {"message": "Track deleted", "track": deleted_track}
