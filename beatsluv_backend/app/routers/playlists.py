from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.auth import verify_token
from app.database import get_connection


router = APIRouter(prefix="/playlists", tags=["playlists"])


class PlaylistCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = False


class PlaylistUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None


class PlaylistTrackCreate(BaseModel):
    track_id: int


def ensure_playlist_tables(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS playlists (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                is_public BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE playlists
            ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

            CREATE TABLE IF NOT EXISTS playlist_tracks (
                playlist_id INT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
                track_id INT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                position INT,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (playlist_id, track_id)
            );

            CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);
            CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track_id ON playlist_tracks(track_id);
            """
        )


def get_playlist_for_user(cur, playlist_id: int, user_id: int):
    cur.execute(
        """
        SELECT *
        FROM playlists
        WHERE id = %s AND user_id = %s;
        """,
        (playlist_id, user_id),
    )
    playlist = cur.fetchone()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist


@router.get("")
def list_playlists(current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        ensure_playlist_tables(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                WITH playlist_stats AS (
                    SELECT
                        pt.playlist_id,
                        COUNT(*) AS track_count,
                        COALESCE(SUM(t.duration_seconds), 0) AS total_duration_seconds
                    FROM playlist_tracks pt
                    JOIN tracks t ON pt.track_id = t.id
                    GROUP BY pt.playlist_id
                ),
                playlist_ratings AS (
                    SELECT
                        pt.playlist_id,
                        ROUND(AVG(f.rating)::numeric, 2) AS avg_rating
                    FROM playlist_tracks pt
                    JOIN feedback f ON pt.track_id = f.track_id
                    WHERE f.rating IS NOT NULL
                    GROUP BY pt.playlist_id
                )
                SELECT
                    p.id,
                    p.user_id,
                    p.name,
                    p.description,
                    COALESCE(p.is_public, FALSE) AS is_public,
                    p.created_at,
                    COALESCE(ps.track_count, 0) AS track_count,
                    COALESCE(ps.total_duration_seconds, 0) AS total_duration_seconds,
                    pr.avg_rating
                FROM playlists p
                LEFT JOIN playlist_stats ps ON p.id = ps.playlist_id
                LEFT JOIN playlist_ratings pr ON p.id = pr.playlist_id
                WHERE p.user_id = %s
                ORDER BY p.created_at DESC, p.id DESC;
                """,
                (current_user["id"],),
            )
            return cur.fetchall()


@router.post("", status_code=status.HTTP_201_CREATED)
def create_playlist(payload: PlaylistCreate, current_user: dict = Depends(verify_token)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Playlist name is required")

    with get_connection() as conn:
        ensure_playlist_tables(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO playlists (user_id, name, description, is_public)
                VALUES (%s, %s, %s, %s)
                RETURNING *;
                """,
                (current_user["id"], name, payload.description, payload.is_public),
            )
            playlist = cur.fetchone()
            conn.commit()
            return playlist


@router.get("/{playlist_id}")
def get_playlist(playlist_id: int, current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        ensure_playlist_tables(conn)
        with conn.cursor() as cur:
            playlist = get_playlist_for_user(cur, playlist_id, current_user["id"])
            cur.execute(
                """
                WITH track_stats AS (
                    SELECT
                        COUNT(*) AS track_count,
                        COALESCE(SUM(t.duration_seconds), 0) AS total_duration_seconds
                    FROM playlist_tracks pt
                    JOIN tracks t ON t.id = pt.track_id
                    WHERE pt.playlist_id = %s
                ),
                rating_stats AS (
                    SELECT ROUND(AVG(f.rating)::numeric, 2) AS avg_rating
                    FROM playlist_tracks pt
                    JOIN feedback f ON f.track_id = pt.track_id
                    WHERE pt.playlist_id = %s
                      AND f.rating IS NOT NULL
                )
                SELECT
                    track_stats.track_count,
                    track_stats.total_duration_seconds,
                    rating_stats.avg_rating
                FROM track_stats
                CROSS JOIN rating_stats;
                """,
                (playlist_id, playlist_id),
            )
            stats = cur.fetchone()
            cur.execute(
                """
                SELECT
                    t.*,
                    pt.position,
                    pt.added_at,
                    ROUND(AVG(f.rating)::numeric, 2) AS avg_rating,
                    COUNT(f.id) AS feedback_count
                FROM playlist_tracks pt
                JOIN tracks t ON t.id = pt.track_id
                LEFT JOIN feedback f ON f.track_id = t.id
                WHERE pt.playlist_id = %s
                GROUP BY t.id, pt.position, pt.added_at
                ORDER BY pt.position NULLS LAST, pt.added_at DESC, t.id DESC;
                """,
                (playlist_id,),
            )
            tracks = cur.fetchall()

    return {**playlist, **stats, "tracks": tracks}


@router.patch("/{playlist_id}")
def update_playlist(
    playlist_id: int,
    payload: PlaylistUpdate,
    current_user: dict = Depends(verify_token),
):
    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates:
        updates["name"] = updates["name"].strip()
        if not updates["name"]:
            raise HTTPException(status_code=400, detail="Playlist name is required")

    if not updates:
        raise HTTPException(status_code=400, detail="No playlist fields to update")

    assignments = ", ".join(f"{key} = %s" for key in updates)
    values = list(updates.values()) + [playlist_id, current_user["id"]]

    with get_connection() as conn:
        ensure_playlist_tables(conn)
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE playlists
                SET {assignments}
                WHERE id = %s AND user_id = %s
                RETURNING *;
                """,
                values,
            )
            playlist = cur.fetchone()
            if not playlist:
                raise HTTPException(status_code=404, detail="Playlist not found")
            conn.commit()
            return playlist


@router.delete("/{playlist_id}")
def delete_playlist(playlist_id: int, current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        ensure_playlist_tables(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM playlists
                WHERE id = %s AND user_id = %s
                RETURNING *;
                """,
                (playlist_id, current_user["id"]),
            )
            playlist = cur.fetchone()
            if not playlist:
                raise HTTPException(status_code=404, detail="Playlist not found")
            conn.commit()
            return {"deleted_playlist": playlist}


@router.post("/{playlist_id}/tracks", status_code=status.HTTP_201_CREATED)
def add_track_to_playlist(
    playlist_id: int,
    payload: PlaylistTrackCreate,
    current_user: dict = Depends(verify_token),
):
    with get_connection() as conn:
        ensure_playlist_tables(conn)
        with conn.cursor() as cur:
            get_playlist_for_user(cur, playlist_id, current_user["id"])
            cur.execute("SELECT id FROM tracks WHERE id = %s;", (payload.track_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Track not found")

            cur.execute(
                """
                SELECT COALESCE(MAX(position), 0) + 1 AS next_position
                FROM playlist_tracks
                WHERE playlist_id = %s;
                """,
                (playlist_id,),
            )
            next_position = cur.fetchone()["next_position"]

            cur.execute(
                """
                INSERT INTO playlist_tracks (playlist_id, track_id, position)
                VALUES (%s, %s, %s)
                ON CONFLICT (playlist_id, track_id)
                DO UPDATE SET added_at = CURRENT_TIMESTAMP
                RETURNING *;
                """,
                (playlist_id, payload.track_id, next_position),
            )
            playlist_track = cur.fetchone()
            conn.commit()
            return playlist_track


@router.delete("/{playlist_id}/tracks/{track_id}")
def remove_track_from_playlist(
    playlist_id: int,
    track_id: int,
    current_user: dict = Depends(verify_token),
):
    with get_connection() as conn:
        ensure_playlist_tables(conn)
        with conn.cursor() as cur:
            get_playlist_for_user(cur, playlist_id, current_user["id"])
            cur.execute(
                """
                DELETE FROM playlist_tracks
                WHERE playlist_id = %s AND track_id = %s
                RETURNING *;
                """,
                (playlist_id, track_id),
            )
            playlist_track = cur.fetchone()
            if not playlist_track:
                raise HTTPException(status_code=404, detail="Track is not in this playlist")
            conn.commit()
            return {"removed_track": playlist_track}
