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


def ensure_profile_support_tables(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            ALTER TABLE feedback
            ADD COLUMN IF NOT EXISTS melody_rating INT,
            ADD COLUMN IF NOT EXISTS originality_rating INT,
            ADD COLUMN IF NOT EXISTS emotional_impact_rating INT,
            ADD COLUMN IF NOT EXISTS commercial_potential_rating INT,
            ADD COLUMN IF NOT EXISTS production_quality_rating INT;

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


@router.get("/me/creator-analytics")
def get_my_creator_analytics(current_user: dict = Depends(verify_token)):
    user_id = current_user["id"]
    with get_connection() as conn:
        ensure_profile_support_tables(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    t.id,
                    t.title,
                    t.genre,
                    t.mood,
                    COUNT(f.id) AS feedback_count,
                    ROUND(AVG(f.rating)::numeric, 2) AS avg_rating,
                    COALESCE(SUM(f.listen_count), 0) AS listens,
                    COUNT(*) FILTER (WHERE f.liked = TRUE) AS likes
                FROM tracks t
                LEFT JOIN feedback f ON t.id = f.track_id
                WHERE t.user_id = %s
                GROUP BY t.id
                ORDER BY avg_rating DESC NULLS LAST, feedback_count DESC, t.created_at DESC
                LIMIT 5;
                """,
                (user_id,),
            )
            top_tracks = cur.fetchall()

            cur.execute(
                """
                SELECT
                    COALESCE(NULLIF(TRIM(t.genre), ''), 'Unknown') AS genre,
                    COUNT(DISTINCT t.id) AS track_count,
                    COUNT(f.id) AS feedback_count,
                    ROUND(AVG(f.rating)::numeric, 2) AS avg_rating
                FROM tracks t
                LEFT JOIN feedback f ON t.id = f.track_id
                WHERE t.user_id = %s
                GROUP BY COALESCE(NULLIF(TRIM(t.genre), ''), 'Unknown')
                ORDER BY avg_rating DESC NULLS LAST, track_count DESC;
                """,
                (user_id,),
            )
            genre_performance = cur.fetchall()

            cur.execute(
                """
                SELECT COUNT(*) AS version_count
                FROM prompt_versions
                WHERE user_id = %s;
                """,
                (user_id,),
            )
            version_count = cur.fetchone()["version_count"]

            success_rate = scalar(
                cur,
                """
                SELECT ROUND(
                    100.0 * COUNT(DISTINCT t.id) FILTER (WHERE rated.avg_rating >= 4)
                    / NULLIF(COUNT(DISTINCT t.id), 0),
                    1
                )
                FROM tracks t
                LEFT JOIN (
                    SELECT track_id, AVG(rating) AS avg_rating
                    FROM feedback
                    WHERE rating IS NOT NULL
                    GROUP BY track_id
                ) rated ON rated.track_id = t.id
                WHERE t.user_id = %s;
                """,
                (user_id,),
                0,
            )

    return {
        "top_tracks": top_tracks,
        "genre_performance": genre_performance,
        "prompt_versions": version_count,
        "success_rate": float(success_rate or 0),
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
