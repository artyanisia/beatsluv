from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.auth import verify_token
from app.database import get_connection


router = APIRouter(prefix="/admin", tags=["admin"])
ADMIN_EMAIL = "admin@gmail.com"


def require_admin(current_user: dict = Depends(verify_token)):
    if current_user.get("role") != "ADMIN" or current_user.get("email") != ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


class UserRoleUpdate(BaseModel):
    role: str


class TrackUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    genre: Optional[str] = None
    mood: Optional[str] = None
    tempo: Optional[int] = None
    duration_seconds: Optional[int] = None
    ai_temperature: Optional[float] = None
    key_signature: Optional[str] = None


@router.get("/overview")
def get_admin_overview(current_user: dict = Depends(require_admin)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    (SELECT COUNT(*) FROM users) AS users,
                    (SELECT COUNT(*) FROM users WHERE role = 'ADMIN') AS admins,
                    (SELECT COUNT(*) FROM tracks) AS tracks,
                    (SELECT COUNT(*) FROM tracks WHERE audio_url IS NOT NULL) AS playable_tracks,
                    (SELECT COUNT(*) FROM feedback) AS feedback,
                    (SELECT COUNT(*) FROM generation_requests) AS generation_requests,
                    (SELECT COUNT(*) FROM tracks WHERE status = 'COMPLETED') AS completed_tracks;
                """
            )
            return cur.fetchone()


@router.get("/users")
def list_users(current_user: dict = Depends(require_admin)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    u.id,
                    u.email,
                    u.role,
                    u.created_at,
                    COUNT(DISTINCT t.id) AS tracks_count,
                    COUNT(DISTINCT f.id) AS feedback_count
                FROM users u
                LEFT JOIN tracks t ON u.id = t.user_id
                LEFT JOIN feedback f ON u.id = f.user_id
                GROUP BY u.id, u.email, u.role, u.created_at
                ORDER BY u.id;
                """
            )
            return cur.fetchall()


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    current_user: dict = Depends(require_admin),
):
    role = payload.role.upper()
    if role not in {"USER", "ADMIN"}:
        raise HTTPException(status_code=400, detail="Role must be USER or ADMIN")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE users
                SET role = %s
                WHERE id = %s
                RETURNING id, email, role, created_at;
                """,
                (role, user_id),
            )
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            conn.commit()
            return user


@router.get("/tracks")
def list_tracks(
    search: str = "",
    limit: int = 100,
    current_user: dict = Depends(require_admin),
):
    safe_limit = max(1, min(limit, 500))
    pattern = f"%{search.strip()}%"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    t.id,
                    t.title,
                    t.status,
                    t.genre,
                    t.mood,
                    t.tempo,
                    t.duration_seconds,
                    t.ai_temperature,
                    t.key_signature,
                    t.user_id,
                    u.email AS user_email,
                    t.created_at,
                    t.audio_url IS NOT NULL AS has_audio,
                    COUNT(f.id) AS feedback_count,
                    ROUND(AVG(f.rating)::numeric, 2) AS avg_rating
                FROM tracks t
                LEFT JOIN users u ON t.user_id = u.id
                LEFT JOIN feedback f ON t.id = f.track_id
                WHERE %s = ''
                   OR t.title ILIKE %s
                   OR t.genre ILIKE %s
                   OR t.mood ILIKE %s
                GROUP BY t.id, u.email
                ORDER BY t.id DESC
                LIMIT %s;
                """,
                (search.strip(), pattern, pattern, pattern, safe_limit),
            )
            return cur.fetchall()


@router.patch("/tracks/{track_id}")
def update_track(
    track_id: int,
    payload: TrackUpdate,
    current_user: dict = Depends(require_admin),
):
    updates = payload.model_dump(exclude_unset=True)
    allowed = {
        "title",
        "status",
        "genre",
        "mood",
        "tempo",
        "duration_seconds",
        "ai_temperature",
        "key_signature",
    }
    updates = {key: value for key, value in updates.items() if key in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="No track fields to update")

    assignments = ", ".join(f"{key} = %s" for key in updates)
    values = list(updates.values()) + [track_id]

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE tracks
                SET {assignments}
                WHERE id = %s
                RETURNING *;
                """,
                values,
            )
            track = cur.fetchone()
            if not track:
                raise HTTPException(status_code=404, detail="Track not found")
            conn.commit()
            return track


@router.delete("/tracks/{track_id}")
def delete_track(track_id: int, current_user: dict = Depends(require_admin)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT generation_request_id FROM tracks WHERE id = %s;", (track_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Track not found")

            generation_request_id = row["generation_request_id"]
            cur.execute("DELETE FROM feedback WHERE track_id = %s;", (track_id,))
            cur.execute("DELETE FROM tracks WHERE id = %s RETURNING id, title;", (track_id,))
            deleted = cur.fetchone()
            cur.execute(
                """
                DELETE FROM generation_requests gr
                WHERE gr.id = %s
                  AND NOT EXISTS (
                      SELECT 1 FROM tracks t WHERE t.generation_request_id = gr.id
                  );
                """,
                (generation_request_id,),
            )
            conn.commit()
            return {"deleted_track": deleted}


@router.get("/feedback")
def list_feedback(limit: int = 100, current_user: dict = Depends(require_admin)):
    safe_limit = max(1, min(limit, 500))
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    f.id,
                    f.track_id,
                    t.title AS track_title,
                    f.user_id,
                    u.email AS user_email,
                    f.rating,
                    f.comment,
                    f.liked,
                    f.downloaded,
                    f.shared,
                    f.listen_count,
                    f.created_at
                FROM feedback f
                LEFT JOIN tracks t ON f.track_id = t.id
                LEFT JOIN users u ON f.user_id = u.id
                ORDER BY f.id DESC
                LIMIT %s;
                """,
                (safe_limit,),
            )
            return cur.fetchall()


@router.delete("/feedback/{feedback_id}")
def delete_feedback(feedback_id: int, current_user: dict = Depends(require_admin)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM feedback WHERE id = %s RETURNING id, track_id, rating;",
                (feedback_id,),
            )
            deleted = cur.fetchone()
            if not deleted:
                raise HTTPException(status_code=404, detail="Feedback not found")
            conn.commit()
            return {"deleted_feedback": deleted}
