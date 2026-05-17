from typing import List, Dict, Any
from fastapi import APIRouter, Depends

from app.auth import verify_token
from app.database import get_db_connection

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def get_overview_stats(current_user: dict = Depends(verify_token)):
    """Get overview statistics for the dashboard."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Total tracks
            cursor.execute("SELECT COUNT(*) FROM tracks")
            total_tracks = cursor.fetchone()[0]
            
            # Total users
            cursor.execute("SELECT COUNT(*) FROM users")
            total_users = cursor.fetchone()[0]
            
            # Total feedback entries
            cursor.execute("SELECT COUNT(*) FROM feedback")
            total_feedback = cursor.fetchone()[0]
            
            # Average rating
            cursor.execute("SELECT AVG(rating) FROM feedback WHERE rating IS NOT NULL")
            avg_rating_result = cursor.fetchone()
            avg_rating = round(avg_rating_result[0], 2) if avg_rating_result[0] else 0
            
            # Most recent tracks
            cursor.execute("""
                SELECT id, title, genre, mood, created_at 
                FROM tracks 
                ORDER BY created_at DESC 
                LIMIT 5
            """)
            recent_tracks = [
                {
                    "id": row[0],
                    "title": row[1],
                    "genre": row[2],
                    "mood": row[3],
                    "created_at": row[4].isoformat() if row[4] else None
                }
                for row in cursor.fetchall()
            ]
            
            return {
                "total_tracks": total_tracks,
                "total_users": total_users,
                "total_feedback": total_feedback,
                "avg_rating": avg_rating,
                "recent_tracks": recent_tracks
            }
    finally:
        conn.close()


@router.get("/genre-distribution")
async def get_genre_distribution(current_user: dict = Depends(verify_token)):
    """Get distribution of tracks by genre."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    COALESCE(genre, 'Unknown') as genre,
                    COUNT(*) as count,
                    AVG(duration_seconds) as avg_duration
                FROM tracks 
                GROUP BY genre 
                ORDER BY count DESC
            """)
            
            return [
                {
                    "genre": row[0],
                    "count": row[1],
                    "avg_duration": round(row[2], 1) if row[2] else 0
                }
                for row in cursor.fetchall()
            ]
    finally:
        conn.close()


@router.get("/mood-analysis")
async def get_mood_analysis(current_user: dict = Depends(verify_token)):
    """Get analysis of tracks by mood."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    COALESCE(mood, 'Unknown') as mood,
                    COUNT(*) as count,
                    AVG(COALESCE(tempo, 0)) as avg_tempo
                FROM tracks 
                GROUP BY mood 
                ORDER BY count DESC
            """)
            
            return [
                {
                    "mood": row[0],
                    "count": row[1],
                    "avg_tempo": round(row[2], 1) if row[2] else 0
                }
                for row in cursor.fetchall()
            ]
    finally:
        conn.close()


@router.get("/tempo-distribution")
async def get_tempo_distribution(current_user: dict = Depends(verify_token)):
    """Get distribution of tracks by tempo ranges."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    CASE 
                        WHEN tempo IS NULL THEN 'Unknown'
                        WHEN tempo < 60 THEN 'Very Slow (< 60)'
                        WHEN tempo < 90 THEN 'Slow (60-89)'
                        WHEN tempo < 120 THEN 'Medium (90-119)'
                        WHEN tempo < 150 THEN 'Fast (120-149)'
                        ELSE 'Very Fast (150+)'
                    END as tempo_range,
                    COUNT(*) as count
                FROM tracks
                GROUP BY 
                    CASE 
                        WHEN tempo IS NULL THEN 'Unknown'
                        WHEN tempo < 60 THEN 'Very Slow (< 60)'
                        WHEN tempo < 90 THEN 'Slow (60-89)'
                        WHEN tempo < 120 THEN 'Medium (90-119)'
                        WHEN tempo < 150 THEN 'Fast (120-149)'
                        ELSE 'Very Fast (150+)'
                    END
                ORDER BY 
                    CASE 
                        WHEN tempo IS NULL THEN 0
                        WHEN tempo < 60 THEN 1
                        WHEN tempo < 90 THEN 2
                        WHEN tempo < 120 THEN 3
                        WHEN tempo < 150 THEN 4
                        ELSE 5
                    END
            """)
            
            return [
                {
                    "tempo_range": row[0],
                    "count": row[1]
                }
                for row in cursor.fetchall()
            ]
    finally:
        conn.close()


@router.get("/duration-analysis")
async def get_duration_analysis(current_user: dict = Depends(verify_token)):
    """Get analysis of tracks by duration."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    CASE 
                        WHEN duration_seconds < 15 THEN 'Very Short (< 15s)'
                        WHEN duration_seconds < 30 THEN 'Short (15-29s)'
                        WHEN duration_seconds < 60 THEN 'Medium (30-59s)'
                        WHEN duration_seconds < 120 THEN 'Long (60-119s)'
                        ELSE 'Very Long (120s+)'
                    END as duration_range,
                    COUNT(*) as count,
                    AVG(duration_seconds) as avg_duration
                FROM tracks
                GROUP BY 
                    CASE 
                        WHEN duration_seconds < 15 THEN 'Very Short (< 15s)'
                        WHEN duration_seconds < 30 THEN 'Short (15-29s)'
                        WHEN duration_seconds < 60 THEN 'Medium (30-59s)'
                        WHEN duration_seconds < 120 THEN 'Long (60-119s)'
                        ELSE 'Very Long (120s+)'
                    END
                ORDER BY avg_duration
            """)
            
            return [
                {
                    "duration_range": row[0],
                    "count": row[1],
                    "avg_duration": round(row[2], 1) if row[2] else 0
                }
                for row in cursor.fetchall()
            ]
    finally:
        conn.close()


@router.get("/rating-analysis")
async def get_rating_analysis(current_user: dict = Depends(verify_token)):
    """Get analysis of feedback ratings."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Rating distribution
            cursor.execute("""
                SELECT 
                    rating,
                    COUNT(*) as count
                FROM feedback 
                WHERE rating IS NOT NULL
                GROUP BY rating
                ORDER BY rating
            """)
            rating_distribution = [
                {"rating": row[0], "count": row[1]}
                for row in cursor.fetchall()
            ]
            
            # Average rating by genre
            cursor.execute("""
                SELECT 
                    COALESCE(t.genre, 'Unknown') as genre,
                    AVG(tf.rating) as avg_rating,
                    COUNT(tf.rating) as rating_count
                FROM tracks t
                JOIN feedback tf ON t.id = tf.track_id
                WHERE tf.rating IS NOT NULL
                GROUP BY t.genre
                HAVING COUNT(tf.rating) > 0
                ORDER BY avg_rating DESC
            """)
            genre_ratings = [
                {
                    "genre": row[0],
                    "avg_rating": round(row[1], 2) if row[1] else 0,
                    "rating_count": row[2]
                }
                for row in cursor.fetchall()
            ]
            
            return {
                "rating_distribution": rating_distribution,
                "genre_ratings": genre_ratings
            }
    finally:
        conn.close()


@router.get("/trends-over-time")
async def get_trends_over_time(current_user: dict = Depends(verify_token)):
    """Get trends of track creation over time."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Tracks created per day (last 30 days)
            cursor.execute("""
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as count
                FROM tracks
                WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY DATE(created_at)
                ORDER BY date
            """)
            daily_tracks = [
                {
                    "date": row[0].isoformat() if row[0] else None,
                    "count": row[1]
                }
                for row in cursor.fetchall()
            ]
            
            # Popular genres over time
            cursor.execute("""
                SELECT 
                    DATE(created_at) as date,
                    COALESCE(genre, 'Unknown') as genre,
                    COUNT(*) as count
                FROM tracks
                WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY DATE(created_at), genre
                HAVING COUNT(*) > 0
                ORDER BY date, count DESC
            """)
            genre_trends = []
            for row in cursor.fetchall():
                genre_trends.append({
                    "date": row[0].isoformat() if row[0] else None,
                    "genre": row[1],
                    "count": row[2]
                })
            
            return {
                "daily_tracks": daily_tracks,
                "genre_trends": genre_trends
            }
    finally:
        conn.close()


@router.get("/user-preferences")
async def get_user_preferences(current_user: dict = Depends(verify_token)):
    """Get analysis of user preferences and behavior."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Most active users
            cursor.execute("""
                SELECT 
                    u.email,
                    COUNT(DISTINCT t.id) as tracks_created,
                    COUNT(DISTINCT tf.id) as feedback_given
                FROM users u
                LEFT JOIN tracks t ON u.id = t.user_id
                LEFT JOIN feedback tf ON u.id = tf.user_id
                GROUP BY u.id, u.email
                HAVING COUNT(t.id) > 0 OR COUNT(tf.id) > 0
                ORDER BY tracks_created DESC, feedback_given DESC
                LIMIT 10
            """)
            active_users = [
                {
                    "email": row[0],
                    "tracks_created": row[1],
                    "feedback_given": row[2]
                }
                for row in cursor.fetchall()
            ]
            
            # User engagement metrics
            cursor.execute("""
                SELECT 
                    AVG(listen_count) as avg_listens,
                    COUNT(CASE WHEN liked THEN 1 END) * 100.0 / COUNT(*) as like_percentage,
                    COUNT(CASE WHEN downloaded THEN 1 END) * 100.0 / COUNT(*) as download_percentage
                FROM feedback
                WHERE listen_count > 0
            """)
            engagement_row = cursor.fetchone()
            engagement = {
                "avg_listens": round(engagement_row[0], 2) if engagement_row[0] else 0,
                "like_percentage": round(engagement_row[1], 1) if engagement_row[1] else 0,
                "download_percentage": round(engagement_row[2], 1) if engagement_row[2] else 0
            } if engagement_row else {}
            
            return {
                "active_users": active_users,
                "engagement": engagement
            }
    finally:
        conn.close()
