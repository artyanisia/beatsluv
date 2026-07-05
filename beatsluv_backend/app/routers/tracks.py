from pathlib import Path
from typing import Optional
from urllib.parse import unquote, urlparse

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.auth import verify_token
from app.database import get_connection


router = APIRouter(prefix="/tracks", tags=["tracks"])

GENERATED_AUDIO_DIR = Path(__file__).resolve().parents[2] / "generated_audio"


class TrackCreate(BaseModel):
    generation_request_id: int
    title: str
    audio_url: Optional[str] = None
    duration_seconds: int
    status: str = "READY"
    user_id: Optional[int] = None
    prompt: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    release_date: Optional[str] = None
    source: Optional[str] = None
    external_id: Optional[str] = None
    external_url: Optional[str] = None
    genre: Optional[str] = None
    mood: Optional[str] = None
    tempo: Optional[int] = None
    is_public: bool = False


class TrackUpdate(BaseModel):
    title: Optional[str] = None
    audio_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    status: Optional[str] = None
    user_id: Optional[int] = None
    prompt: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    release_date: Optional[str] = None
    source: Optional[str] = None
    external_id: Optional[str] = None
    external_url: Optional[str] = None
    genre: Optional[str] = None
    mood: Optional[str] = None
    tempo: Optional[int] = None
    is_public: Optional[bool] = None


class TrackVisibilityUpdate(BaseModel):
    is_public: bool


def ensure_track_metadata_columns(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            ALTER TABLE tracks
            ALTER COLUMN audio_url DROP NOT NULL,
            ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS prompt TEXT,
            ADD COLUMN IF NOT EXISTS artist VARCHAR(255),
            ADD COLUMN IF NOT EXISTS album VARCHAR(255),
            ADD COLUMN IF NOT EXISTS release_date VARCHAR(50),
            ADD COLUMN IF NOT EXISTS source VARCHAR(50),
            ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS external_url TEXT,
            ADD COLUMN IF NOT EXISTS genre VARCHAR(100),
            ADD COLUMN IF NOT EXISTS mood VARCHAR(100),
            ADD COLUMN IF NOT EXISTS tempo INT,
            ADD COLUMN IF NOT EXISTS ai_temperature NUMERIC(3, 2),
            ADD COLUMN IF NOT EXISTS key_signature VARCHAR(20),
            ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
            """
        )


def ensure_feedback_detail_columns(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            ALTER TABLE feedback
            ADD COLUMN IF NOT EXISTS melody_rating INT,
            ADD COLUMN IF NOT EXISTS originality_rating INT,
            ADD COLUMN IF NOT EXISTS emotional_impact_rating INT,
            ADD COLUMN IF NOT EXISTS commercial_potential_rating INT,
            ADD COLUMN IF NOT EXISTS production_quality_rating INT;
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


def is_playable_audio_url(audio_url: Optional[str]) -> bool:
    if not audio_url:
        return False

    if audio_url.startswith("http://") or audio_url.startswith("https://"):
        return True

    parsed_path = unquote(urlparse(audio_url).path)
    if not parsed_path.startswith("/generated-audio/"):
        return False

    relative_path = parsed_path.removeprefix("/generated-audio/").lstrip("/")
    if not relative_path:
        return False

    audio_path = (GENERATED_AUDIO_DIR / relative_path).resolve()
    try:
        audio_path.relative_to(GENERATED_AUDIO_DIR.resolve())
    except ValueError:
        return False

    return audio_path.is_file()


@router.get("")
def get_tracks(limit: Optional[int] = None, current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        ensure_track_metadata_columns(conn)
        with conn.cursor() as cur:
            if limit:
                cur.execute(
                    """
                    SELECT *
                    FROM tracks
                    WHERE user_id = %s
                    ORDER BY created_at DESC, id DESC
                    LIMIT %s;
                    """,
                    (current_user["id"], limit),
                )
            else:
                cur.execute("SELECT * FROM tracks ORDER BY created_at DESC, id DESC;")
            return cur.fetchall()


@router.get("/public")
def get_public_tracks(
    q: str = "",
    genre: str = "",
    mood: str = "",
    creator: str = "",
    min_tempo: Optional[int] = None,
    max_tempo: Optional[int] = None,
    min_rating: Optional[float] = None,
    created_after: str = "",
    created_before: str = "",
    current_user: dict = Depends(verify_token),
):
    with get_connection() as conn:
        ensure_track_metadata_columns(conn)
        ensure_feedback_detail_columns(conn)
        with conn.cursor() as cur:
            where_clauses = ["COALESCE(t.is_public, FALSE) = TRUE"]
            having_clauses = []
            params = []

            if q.strip():
                where_clauses.append("(t.title ILIKE %s OR t.prompt ILIKE %s)")
                params.extend([f"%{q.strip()}%", f"%{q.strip()}%"])
            if genre:
                where_clauses.append("t.genre = %s")
                params.append(genre)
            if mood:
                where_clauses.append("t.mood = %s")
                params.append(mood)
            if creator.strip():
                where_clauses.append("u.email ILIKE %s")
                params.append(f"%{creator.strip()}%")
            if min_tempo is not None:
                where_clauses.append("t.tempo >= %s")
                params.append(min_tempo)
            if max_tempo is not None:
                where_clauses.append("t.tempo <= %s")
                params.append(max_tempo)
            if created_after.strip():
                where_clauses.append("DATE(t.created_at) >= %s::date")
                params.append(created_after.strip())
            if created_before.strip():
                where_clauses.append("DATE(t.created_at) <= %s::date")
                params.append(created_before.strip())
            if min_rating is not None:
                having_clauses.append("COALESCE(AVG(f.rating), 0) >= %s")
                params.append(min_rating)

            where_sql = " AND ".join(where_clauses)
            having_sql = f"HAVING {' AND '.join(having_clauses)}" if having_clauses else ""

            cur.execute(
                f"""
                SELECT
                    t.*,
                    u.email AS creator_email,
                    COUNT(f.id) AS feedback_count,
                    ROUND(AVG(f.rating)::numeric, 2) AS avg_rating,
                    ROUND(AVG(f.melody_rating)::numeric, 2) AS avg_melody_rating,
                    ROUND(AVG(f.originality_rating)::numeric, 2) AS avg_originality_rating,
                    ROUND(AVG(f.emotional_impact_rating)::numeric, 2) AS avg_emotional_impact_rating,
                    ROUND(AVG(f.commercial_potential_rating)::numeric, 2) AS avg_commercial_potential_rating,
                    ROUND(AVG(f.production_quality_rating)::numeric, 2) AS avg_production_quality_rating
                FROM tracks t
                LEFT JOIN users u ON t.user_id = u.id
                LEFT JOIN feedback f ON t.id = f.track_id
                WHERE {where_sql}
                GROUP BY t.id, u.email
                {having_sql}
                ORDER BY t.created_at DESC, t.id DESC;
                """,
                params,
            )
            tracks = cur.fetchall()

    return [track for track in tracks if is_playable_audio_url(track.get("audio_url"))]


@router.get("/{track_id}")
def get_track(track_id: int, current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM tracks WHERE id = %s;", (track_id,))
            track = cur.fetchone()

    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    return track


@router.get("/{track_id}/versions")
def get_track_versions(track_id: int, current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        ensure_prompt_versions_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                WITH root AS (
                    SELECT COALESCE(parent_track_id, track_id) AS root_track_id
                    FROM prompt_versions
                    WHERE track_id = %s
                    ORDER BY version_number
                    LIMIT 1
                )
                SELECT pv.*, t.title, t.audio_url, t.status, t.created_at AS track_created_at
                FROM prompt_versions pv
                JOIN tracks t ON t.id = pv.track_id
                WHERE pv.track_id = (SELECT root_track_id FROM root)
                   OR pv.parent_track_id = (SELECT root_track_id FROM root)
                   OR pv.track_id = %s
                   OR pv.parent_track_id = %s
                ORDER BY pv.version_number, pv.created_at, pv.id;
                """,
                (track_id, track_id, track_id),
            )
            versions = cur.fetchall()

    return versions


@router.patch("/{track_id}/visibility")
def update_track_visibility(
    track_id: int,
    visibility: TrackVisibilityUpdate,
    current_user: dict = Depends(verify_token),
):
    with get_connection() as conn:
        ensure_track_metadata_columns(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE tracks
                SET is_public = %s
                WHERE id = %s AND user_id = %s
                RETURNING *;
                """,
                (visibility.is_public, track_id, current_user["id"]),
            )
            updated_track = cur.fetchone()
            conn.commit()

    if not updated_track:
        raise HTTPException(status_code=404, detail="Track not found")

    return updated_track


@router.post("")
def create_track(track: TrackCreate):
    with get_connection() as conn:
        ensure_track_metadata_columns(conn)
        with conn.cursor() as cur:
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
                    artist,
                    album,
                    release_date,
                    source,
                    external_id,
                    external_url,
                    genre,
                    mood,
                    tempo,
                    is_public
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *;
                """,
                (
                    track.generation_request_id,
                    track.title,
                    track.audio_url,
                    track.duration_seconds,
                    track.status,
                    track.user_id,
                    track.prompt,
                    track.artist,
                    track.album,
                    track.release_date,
                    track.source,
                    track.external_id,
                    track.external_url,
                    track.genre,
                    track.mood,
                    track.tempo,
                    track.is_public,
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
    updated_user_id = track.user_id if track.user_id is not None else existing_track.get("user_id")
    updated_prompt = track.prompt if track.prompt is not None else existing_track.get("prompt")
    updated_artist = track.artist if track.artist is not None else existing_track.get("artist")
    updated_album = track.album if track.album is not None else existing_track.get("album")
    updated_release_date = (
        track.release_date if track.release_date is not None else existing_track.get("release_date")
    )
    updated_source = track.source if track.source is not None else existing_track.get("source")
    updated_external_id = (
        track.external_id if track.external_id is not None else existing_track.get("external_id")
    )
    updated_external_url = (
        track.external_url if track.external_url is not None else existing_track.get("external_url")
    )
    updated_genre = track.genre if track.genre is not None else existing_track.get("genre")
    updated_mood = track.mood if track.mood is not None else existing_track.get("mood")
    updated_tempo = track.tempo if track.tempo is not None else existing_track.get("tempo")
    updated_is_public = track.is_public if track.is_public is not None else existing_track.get("is_public")

    with get_connection() as conn:
        ensure_track_metadata_columns(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE tracks
                SET title = %s,
                    audio_url = %s,
                    duration_seconds = %s,
                    status = %s,
                    user_id = %s,
                    prompt = %s,
                    artist = %s,
                    album = %s,
                    release_date = %s,
                    source = %s,
                    external_id = %s,
                    external_url = %s,
                    genre = %s,
                    mood = %s,
                    tempo = %s,
                    is_public = %s
                WHERE id = %s
                RETURNING *;
                """,
                (
                    updated_title,
                    updated_audio_url,
                    updated_duration,
                    updated_status,
                    updated_user_id,
                    updated_prompt,
                    updated_artist,
                    updated_album,
                    updated_release_date,
                    updated_source,
                    updated_external_id,
                    updated_external_url,
                    updated_genre,
                    updated_mood,
                    updated_tempo,
                    updated_is_public,
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
