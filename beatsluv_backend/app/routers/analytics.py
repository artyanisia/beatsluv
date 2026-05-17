from fastapi import APIRouter, Depends

from app.auth import verify_token
from app.database import get_connection


router = APIRouter(prefix="/analytics", tags=["analytics"])


def scalar(cur, query, params=None, default=0):
    cur.execute(query, params or ())
    row = cur.fetchone()
    if not row:
        return default
    value = next(iter(row.values())) if isinstance(row, dict) else row[0]
    return value if value is not None else default


@router.get("/overview")
def get_overview_stats(current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            total_tracks = scalar(cur, "SELECT COUNT(*) FROM tracks;")
            total_users = scalar(cur, "SELECT COUNT(*) FROM users;")
            total_feedback = scalar(cur, "SELECT COUNT(*) FROM feedback;")
            avg_rating = scalar(cur, "SELECT ROUND(AVG(rating)::numeric, 2) FROM feedback WHERE rating IS NOT NULL;")
            avg_duration = scalar(
                cur,
                "SELECT ROUND(AVG(duration_seconds)::numeric, 1) FROM tracks WHERE duration_seconds IS NOT NULL;",
            )
            playable_tracks = scalar(cur, "SELECT COUNT(*) FROM tracks WHERE audio_url IS NOT NULL;")

            cur.execute(
                """
                SELECT id, title, genre, mood, tempo, duration_seconds, created_at
                FROM tracks
                ORDER BY created_at DESC, id DESC
                LIMIT 8;
                """
            )
            recent_tracks = [
                {
                    "id": row["id"],
                    "title": row["title"],
                    "genre": row["genre"] or "Unknown",
                    "mood": row["mood"] or "Unknown",
                    "tempo": row["tempo"],
                    "duration_seconds": row["duration_seconds"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                }
                for row in cur.fetchall()
            ]

            return {
                "total_tracks": total_tracks,
                "total_users": total_users,
                "total_feedback": total_feedback,
                "avg_rating": float(avg_rating or 0),
                "avg_duration": float(avg_duration or 0),
                "playable_tracks": playable_tracks,
                "recent_tracks": recent_tracks,
            }


@router.get("/genre-distribution")
def get_genre_distribution(current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COALESCE(NULLIF(TRIM(genre), ''), 'Unknown') AS genre,
                    COUNT(*) AS count,
                    ROUND(AVG(duration_seconds)::numeric, 1) AS avg_duration,
                    ROUND(AVG(tempo)::numeric, 1) AS avg_tempo
                FROM tracks
                GROUP BY COALESCE(NULLIF(TRIM(genre), ''), 'Unknown')
                ORDER BY count DESC, genre ASC;
                """
            )
            return [
                {
                    "genre": row["genre"],
                    "count": row["count"],
                    "avg_duration": float(row["avg_duration"] or 0),
                    "avg_tempo": float(row["avg_tempo"] or 0),
                }
                for row in cur.fetchall()
            ]


@router.get("/mood-analysis")
def get_mood_analysis(current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COALESCE(NULLIF(TRIM(mood), ''), 'Unknown') AS mood,
                    COUNT(*) AS count,
                    ROUND(AVG(tempo)::numeric, 1) AS avg_tempo,
                    ROUND(AVG(duration_seconds)::numeric, 1) AS avg_duration
                FROM tracks
                GROUP BY COALESCE(NULLIF(TRIM(mood), ''), 'Unknown')
                ORDER BY count DESC, mood ASC;
                """
            )
            return [
                {
                    "mood": row["mood"],
                    "count": row["count"],
                    "avg_tempo": float(row["avg_tempo"] or 0),
                    "avg_duration": float(row["avg_duration"] or 0),
                }
                for row in cur.fetchall()
            ]


@router.get("/tempo-distribution")
def get_tempo_distribution(current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                WITH bucketed AS (
                    SELECT
                        CASE
                            WHEN tempo IS NULL THEN 'Unknown'
                            WHEN tempo < 60 THEN 'Very Slow (< 60)'
                            WHEN tempo < 90 THEN 'Slow (60-89)'
                            WHEN tempo < 120 THEN 'Medium (90-119)'
                            WHEN tempo < 150 THEN 'Fast (120-149)'
                            ELSE 'Very Fast (150+)'
                        END AS tempo_range,
                        CASE
                            WHEN tempo IS NULL THEN 0
                            WHEN tempo < 60 THEN 1
                            WHEN tempo < 90 THEN 2
                            WHEN tempo < 120 THEN 3
                            WHEN tempo < 150 THEN 4
                            ELSE 5
                        END AS sort_order,
                        tempo,
                        duration_seconds
                    FROM tracks
                )
                SELECT
                    tempo_range,
                    COUNT(*) AS count,
                    ROUND(AVG(tempo)::numeric, 1) AS avg_tempo,
                    ROUND(AVG(duration_seconds)::numeric, 1) AS avg_duration
                FROM bucketed
                GROUP BY tempo_range, sort_order
                ORDER BY sort_order;
                """
            )
            return [
                {
                    "tempo_range": row["tempo_range"],
                    "count": row["count"],
                    "avg_tempo": float(row["avg_tempo"] or 0),
                    "avg_duration": float(row["avg_duration"] or 0),
                }
                for row in cur.fetchall()
            ]


@router.get("/duration-analysis")
def get_duration_analysis(current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                WITH bucketed AS (
                    SELECT
                        CASE
                            WHEN duration_seconds < 30 THEN 'Short (< 30s)'
                            WHEN duration_seconds < 120 THEN 'Medium (30-119s)'
                            WHEN duration_seconds < 240 THEN 'Standard (2-4m)'
                            WHEN duration_seconds < 420 THEN 'Long (4-7m)'
                            ELSE 'Very Long (7m+)'
                        END AS duration_range,
                        CASE
                            WHEN duration_seconds < 30 THEN 1
                            WHEN duration_seconds < 120 THEN 2
                            WHEN duration_seconds < 240 THEN 3
                            WHEN duration_seconds < 420 THEN 4
                            ELSE 5
                        END AS sort_order,
                        duration_seconds,
                        tempo
                    FROM tracks
                )
                SELECT
                    duration_range,
                    COUNT(*) AS count,
                    ROUND(AVG(duration_seconds)::numeric, 1) AS avg_duration,
                    ROUND(AVG(tempo)::numeric, 1) AS avg_tempo
                FROM bucketed
                GROUP BY duration_range, sort_order
                ORDER BY sort_order;
                """
            )
            return [
                {
                    "duration_range": row["duration_range"],
                    "count": row["count"],
                    "avg_duration": float(row["avg_duration"] or 0),
                    "avg_tempo": float(row["avg_tempo"] or 0),
                }
                for row in cur.fetchall()
            ]


@router.get("/rating-analysis")
def get_rating_analysis(current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT rating, COUNT(*) AS count
                FROM feedback
                WHERE rating IS NOT NULL
                GROUP BY rating
                ORDER BY rating;
                """
            )
            rating_distribution = [
                {"rating": row["rating"], "count": row["count"]}
                for row in cur.fetchall()
            ]

            cur.execute(
                """
                SELECT
                    COALESCE(NULLIF(TRIM(t.genre), ''), 'Unknown') AS genre,
                    ROUND(AVG(f.rating)::numeric, 2) AS avg_rating,
                    COUNT(f.rating) AS rating_count
                FROM tracks t
                JOIN feedback f ON t.id = f.track_id
                WHERE f.rating IS NOT NULL
                GROUP BY COALESCE(NULLIF(TRIM(t.genre), ''), 'Unknown')
                ORDER BY avg_rating DESC, rating_count DESC;
                """
            )
            genre_ratings = [
                {
                    "genre": row["genre"],
                    "avg_rating": float(row["avg_rating"] or 0),
                    "rating_count": row["rating_count"],
                }
                for row in cur.fetchall()
            ]

            return {
                "rating_distribution": rating_distribution,
                "genre_ratings": genre_ratings,
            }


@router.get("/trends-over-time")
def get_trends_over_time(current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DATE(created_at) AS date, COUNT(*) AS count
                FROM tracks
                WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY DATE(created_at)
                ORDER BY date;
                """
            )
            daily_tracks = [
                {"date": row["date"].isoformat(), "count": row["count"]}
                for row in cur.fetchall()
            ]

            cur.execute(
                """
                SELECT
                    DATE(created_at) AS date,
                    COALESCE(NULLIF(TRIM(genre), ''), 'Unknown') AS genre,
                    COUNT(*) AS count
                FROM tracks
                WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY DATE(created_at), COALESCE(NULLIF(TRIM(genre), ''), 'Unknown')
                ORDER BY date, count DESC;
                """
            )
            genre_trends = [
                {
                    "date": row["date"].isoformat(),
                    "genre": row["genre"],
                    "count": row["count"],
                }
                for row in cur.fetchall()
            ]

            return {
                "daily_tracks": daily_tracks,
                "genre_trends": genre_trends,
            }


@router.get("/user-preferences")
def get_user_preferences(current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    u.id,
                    u.email,
                    COUNT(DISTINCT t.id) AS tracks_created,
                    COUNT(DISTINCT f.id) AS feedback_given
                FROM users u
                LEFT JOIN tracks t ON u.id = t.user_id
                LEFT JOIN feedback f ON u.id = f.user_id
                GROUP BY u.id, u.email
                HAVING COUNT(DISTINCT t.id) > 0 OR COUNT(DISTINCT f.id) > 0
                ORDER BY tracks_created DESC, feedback_given DESC
                LIMIT 10;
                """
            )
            active_users = [
                {
                    "user_id": row["id"],
                    "email": row["email"],
                    "tracks_created": row["tracks_created"],
                    "feedback_given": row["feedback_given"],
                }
                for row in cur.fetchall()
            ]

            cur.execute(
                """
                SELECT
                    ROUND(AVG(listen_count)::numeric, 2) AS avg_listens,
                    ROUND(100.0 * SUM(CASE WHEN liked THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS like_percentage,
                    ROUND(100.0 * SUM(CASE WHEN downloaded THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS download_percentage
                FROM feedback;
                """
            )
            engagement_row = cur.fetchone()

            return {
                "active_users": active_users,
                "engagement": {
                    "avg_listens": float(engagement_row["avg_listens"] or 0) if engagement_row else 0,
                    "like_percentage": float(engagement_row["like_percentage"] or 0) if engagement_row else 0,
                    "download_percentage": float(engagement_row["download_percentage"] or 0) if engagement_row else 0,
                },
            }


@router.get("/key-distribution")
def get_key_distribution(current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COALESCE(NULLIF(TRIM(key_signature), ''), 'Unknown') AS key_signature,
                    COUNT(*) AS count,
                    ROUND(AVG(duration_seconds)::numeric, 1) AS avg_duration,
                    ROUND(AVG(tempo)::numeric, 1) AS avg_tempo
                FROM tracks
                GROUP BY COALESCE(NULLIF(TRIM(key_signature), ''), 'Unknown')
                ORDER BY count DESC, key_signature ASC;
                """
            )
            return [
                {
                    "key_signature": row["key_signature"],
                    "count": row["count"],
                    "avg_duration": float(row["avg_duration"] or 0),
                    "avg_tempo": float(row["avg_tempo"] or 0),
                }
                for row in cur.fetchall()
            ]


@router.get("/ai-performance")
def get_ai_performance(current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                WITH rated AS (
                    SELECT
                        CASE
                            WHEN t.ai_temperature IS NULL THEN 'Unknown'
                            WHEN t.ai_temperature < 0.4 THEN 'Low (< 0.4)'
                            WHEN t.ai_temperature < 0.7 THEN 'Medium (0.4-0.69)'
                            WHEN t.ai_temperature < 1.0 THEN 'High (0.7-0.99)'
                            ELSE 'Very High (1.0+)'
                        END AS temperature_range,
                        CASE
                            WHEN t.ai_temperature IS NULL THEN 0
                            WHEN t.ai_temperature < 0.4 THEN 1
                            WHEN t.ai_temperature < 0.7 THEN 2
                            WHEN t.ai_temperature < 1.0 THEN 3
                            ELSE 4
                        END AS sort_order,
                        t.ai_temperature,
                        f.rating
                    FROM tracks t
                    JOIN feedback f ON t.id = f.track_id
                    WHERE f.rating IS NOT NULL
                )
                SELECT
                    temperature_range,
                    COUNT(*) AS feedback_count,
                    ROUND(AVG(rating)::numeric, 2) AS avg_rating,
                    ROUND(AVG(ai_temperature)::numeric, 2) AS avg_temperature
                FROM rated
                GROUP BY temperature_range, sort_order
                ORDER BY sort_order;
                """
            )
            return [
                {
                    "temperature_range": row["temperature_range"],
                    "feedback_count": row["feedback_count"],
                    "avg_rating": float(row["avg_rating"] or 0),
                    "avg_temperature": float(row["avg_temperature"] or 0),
                }
                for row in cur.fetchall()
            ]


@router.get("/monthly-evolution")
def get_monthly_evolution(current_user: dict = Depends(verify_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                WITH months AS (
                    SELECT DATE_TRUNC('month', created_at)::date AS month
                    FROM tracks
                    UNION
                    SELECT DATE_TRUNC('month', created_at)::date AS month
                    FROM feedback
                ),
                generated AS (
                    SELECT DATE_TRUNC('month', created_at)::date AS month, COUNT(*) AS generated_count
                    FROM tracks
                    GROUP BY DATE_TRUNC('month', created_at)::date
                ),
                feedback_months AS (
                    SELECT DATE_TRUNC('month', created_at)::date AS month, COUNT(*) AS feedback_count
                    FROM feedback
                    GROUP BY DATE_TRUNC('month', created_at)::date
                )
                SELECT
                    months.month,
                    COALESCE(generated.generated_count, 0) AS generated_count,
                    COALESCE(feedback_months.feedback_count, 0) AS feedback_count
                FROM months
                LEFT JOIN generated ON months.month = generated.month
                LEFT JOIN feedback_months ON months.month = feedback_months.month
                ORDER BY months.month;
                """
            )
            return [
                {
                    "month": row["month"].isoformat(),
                    "generated_count": row["generated_count"],
                    "feedback_count": row["feedback_count"],
                }
                for row in cur.fetchall()
            ]
