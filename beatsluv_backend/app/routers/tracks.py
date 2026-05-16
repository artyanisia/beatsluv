from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.auth import verify_token
from app.database import get_connection
from app.services.musicbrainz_importer import MusicBrainzImporter, MusicBrainzImportError


router = APIRouter(prefix="/tracks", tags=["tracks"])


class TrackCreate(BaseModel):
    generation_request_id: int
    title: str
    audio_url: str
    duration_seconds: int
    status: str = "READY"
    artist: Optional[str] = None
    album: Optional[str] = None
    release_date: Optional[str] = None
    source: Optional[str] = None
    external_id: Optional[str] = None
    external_url: Optional[str] = None
    genre: Optional[str] = None


class TrackUpdate(BaseModel):
    title: Optional[str] = None
    audio_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    status: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    release_date: Optional[str] = None
    source: Optional[str] = None
    external_id: Optional[str] = None
    external_url: Optional[str] = None
    genre: Optional[str] = None


class MusicBrainzImportRequest(BaseModel):
    query: str = "pop"
    limit: int = 10
    genre: Optional[str] = None
    mood: Optional[str] = "reference"


def ensure_track_metadata_columns(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            ALTER TABLE tracks
            ADD COLUMN IF NOT EXISTS artist VARCHAR(255),
            ADD COLUMN IF NOT EXISTS album VARCHAR(255),
            ADD COLUMN IF NOT EXISTS release_date VARCHAR(50),
            ADD COLUMN IF NOT EXISTS source VARCHAR(50),
            ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS external_url TEXT,
            ADD COLUMN IF NOT EXISTS genre VARCHAR(100);
            """
        )


@router.get("")
def get_tracks(current_user: dict = Depends(verify_token)):
    # Manual SQL query. No ORM is used in this project.
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM tracks ORDER BY id;")
            return cur.fetchall()


@router.get("/{track_id}")
def get_track(track_id: int, current_user: dict = Depends(verify_token)):
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
                    artist,
                    album,
                    release_date,
                    source,
                    external_id,
                    external_url,
                    genre
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *;
                """,
                (
                    track.generation_request_id,
                    track.title,
                    track.audio_url,
                    track.duration_seconds,
                    track.status,
                    track.artist,
                    track.album,
                    track.release_date,
                    track.source,
                    track.external_id,
                    track.external_url,
                    track.genre,
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
                    artist = %s,
                    album = %s,
                    release_date = %s,
                    source = %s,
                    external_id = %s,
                    external_url = %s,
                    genre = %s
                WHERE id = %s
                RETURNING *;
                """,
                (
                    updated_title,
                    updated_audio_url,
                    updated_duration,
                    updated_status,
                    updated_artist,
                    updated_album,
                    updated_release_date,
                    updated_source,
                    updated_external_id,
                    updated_external_url,
                    updated_genre,
                    track_id,
                ),
            )
            updated_track = cur.fetchone()
            conn.commit()

    return updated_track


@router.post("/import/musicbrainz")
def import_musicbrainz_tracks(
    request: MusicBrainzImportRequest,
    current_user: dict = Depends(verify_token),
):
    importer = MusicBrainzImporter()

    try:
        imported_tracks = importer.search_tracks(
            query=request.query,
            limit=request.limit,
            genre=request.genre,
        )
    except MusicBrainzImportError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    with get_connection() as conn:
        ensure_track_metadata_columns(conn)
        created_tracks = []

        with conn.cursor() as cur:
            for imported_track in imported_tracks:
                prompt = self_contained_import_prompt(imported_track)
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
                        prompt,
                        imported_track.genre,
                        request.mood,
                        None,
                        imported_track.duration_seconds,
                        "IMPORTED",
                    ),
                )
                generation_request = cur.fetchone()

                cur.execute(
                    """
                    INSERT INTO tracks (
                        generation_request_id,
                        title,
                        audio_url,
                        duration_seconds,
                        status,
                        artist,
                        album,
                        release_date,
                        source,
                        external_id,
                        external_url,
                        genre
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *;
                    """,
                    (
                        generation_request["id"],
                        imported_track.title,
                        imported_track.audio_url,
                        imported_track.duration_seconds,
                        "IMPORTED",
                        imported_track.artist,
                        imported_track.album,
                        imported_track.release_date,
                        "MusicBrainz",
                        imported_track.external_id,
                        imported_track.external_url,
                        imported_track.genre,
                    ),
                )
                created_tracks.append(cur.fetchone())

            conn.commit()

    return {
        "source": "MusicBrainz",
        "count": len(created_tracks),
        "tracks": created_tracks,
    }


def self_contained_import_prompt(imported_track):
    parts = [f"Imported MusicBrainz recording: {imported_track.title}"]
    if imported_track.artist:
        parts.append(f"by {imported_track.artist}")
    if imported_track.album:
        parts.append(f"from {imported_track.album}")
    return " ".join(parts)


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
