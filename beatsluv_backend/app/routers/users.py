from fastapi import APIRouter, Depends

from app.auth import verify_token
from app.database import get_connection


router = APIRouter(prefix="/users", tags=["users"])


def scalar(cur, query, params=None, default=0):
    cur.execute(query, params or ())
    row = cur.fetchone()
    if not row:
        return default
    value = next(iter(row.values()))
    return value if value is not None else default


@router.get("/me/stats")
def get_my_stats(current_user: dict = Depends(verify_token)):
    user_id = current_user["id"]
    with get_connection() as conn:
        with conn.cursor() as cur:
            tracks_generated = scalar(cur, "SELECT COUNT(*) FROM tracks WHERE user_id = %s;", (user_id,))
            feedback_given = scalar(cur, "SELECT COUNT(*) FROM feedback WHERE user_id = %s;", (user_id,))
            feedback_received = scalar(
                cur,
                """
                SELECT COUNT(*)
                FROM feedback f
                JOIN tracks t ON t.id = f.track_id
                WHERE t.user_id = %s;
                """,
                (user_id,),
            )
            avg_rating_given = scalar(
                cur,
                "SELECT ROUND(AVG(rating)::numeric, 2) FROM feedback WHERE user_id = %s AND rating IS NOT NULL;",
                (user_id,),
            )
            avg_rating_received = scalar(
                cur,
                """
                SELECT ROUND(AVG(f.rating)::numeric, 2)
                FROM feedback f
                JOIN tracks t ON t.id = f.track_id
                WHERE t.user_id = %s AND f.rating IS NOT NULL;
                """,
                (user_id,),
            )
            total_listens = scalar(
                cur,
                """
                SELECT COALESCE(SUM(f.listen_count), 0)
                FROM feedback f
                JOIN tracks t ON t.id = f.track_id
                WHERE t.user_id = %s;
                """,
                (user_id,),
            )
            likes_received = scalar(
                cur,
                """
                SELECT COUNT(*)
                FROM feedback f
                JOIN tracks t ON t.id = f.track_id
                WHERE t.user_id = %s AND f.liked = TRUE;
                """,
                (user_id,),
            )
            downloads = scalar(
                cur,
                """
                SELECT COUNT(*)
                FROM feedback f
                JOIN tracks t ON t.id = f.track_id
                WHERE t.user_id = %s AND f.downloaded = TRUE;
                """,
                (user_id,),
            )
            member_since = scalar(cur, "SELECT created_at FROM users WHERE id = %s;", (user_id,), None)

            favorite_genre = scalar(
                cur,
                """
                SELECT genre
                FROM tracks
                WHERE user_id = %s AND genre IS NOT NULL
                GROUP BY genre
                ORDER BY COUNT(*) DESC, genre ASC
                LIMIT 1;
                """,
                (user_id,),
                None,
            )
            favorite_mood = scalar(
                cur,
                """
                SELECT mood
                FROM tracks
                WHERE user_id = %s AND mood IS NOT NULL
                GROUP BY mood
                ORDER BY COUNT(*) DESC, mood ASC
                LIMIT 1;
                """,
                (user_id,),
                None,
            )

    return {
        "tracks_generated": tracks_generated,
        "feedback_given": feedback_given,
        "feedback_received": feedback_received,
        "avg_rating_given": float(avg_rating_given or 0),
        "avg_rating_received": float(avg_rating_received or 0),
        "total_listens": total_listens,
        "likes_received": likes_received,
        "downloads": downloads,
        "shares": 0,
        "member_since": member_since.isoformat() if member_since else None,
        "favorite_genre": favorite_genre,
        "favorite_mood": favorite_mood,
    }


@router.get("/me/feedback-given")
def get_my_feedback_given(current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT f.*, t.title AS track_title
                FROM feedback f
                JOIN tracks t ON t.id = f.track_id
                WHERE f.user_id = %s
                ORDER BY f.created_at DESC, f.id DESC
                LIMIT 20;
                """,
                (current_user["id"],),
            )
            return cur.fetchall()


@router.get("/me/feedback-received")
def get_my_feedback_received(current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT f.*, t.title AS track_title
                FROM feedback f
                JOIN tracks t ON t.id = f.track_id
                WHERE t.user_id = %s
                ORDER BY f.created_at DESC, f.id DESC
                LIMIT 20;
                """,
                (current_user["id"],),
            )
            return cur.fetchall()
