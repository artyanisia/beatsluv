from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth import verify_token
from app.database import get_connection


router = APIRouter(tags=["feedback"])


class FeedbackCreate(BaseModel):
    rating: Optional[int] = None
    melody_rating: Optional[int] = None
    originality_rating: Optional[int] = None
    emotional_impact_rating: Optional[int] = None
    commercial_potential_rating: Optional[int] = None
    production_quality_rating: Optional[int] = None
    comment: Optional[str] = None
    liked: bool = False
    downloaded: bool = False
    shared: bool = False
    listen_count: int = 0
    sentiment_score: Optional[float] = None


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


def overall_rating(feedback: FeedbackCreate):
    if feedback.rating is not None:
        return feedback.rating

    detailed_scores = [
        feedback.melody_rating,
        feedback.originality_rating,
        feedback.emotional_impact_rating,
        feedback.commercial_potential_rating,
        feedback.production_quality_rating,
    ]
    valid_scores = [score for score in detailed_scores if score is not None]
    if not valid_scores:
        return None

    return round(sum(valid_scores) / len(valid_scores))


@router.post("/tracks/{track_id}/feedback")
def create_feedback(
    track_id: int, 
    feedback: FeedbackCreate, 
    current_user: dict = Depends(verify_token)
):
    with get_connection() as conn:
        ensure_feedback_detail_columns(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO feedback (
                    track_id,
                    user_id,
                    rating,
                    melody_rating,
                    originality_rating,
                    emotional_impact_rating,
                    commercial_potential_rating,
                    production_quality_rating,
                    comment,
                    liked,
                    downloaded,
                    shared,
                    listen_count,
                    sentiment_score
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *;
                """,
                (
                    track_id,
                    current_user["id"],
                    overall_rating(feedback),
                    feedback.melody_rating,
                    feedback.originality_rating,
                    feedback.emotional_impact_rating,
                    feedback.commercial_potential_rating,
                    feedback.production_quality_rating,
                    feedback.comment,
                    feedback.liked,
                    feedback.downloaded,
                    feedback.shared,
                    feedback.listen_count,
                    feedback.sentiment_score,
                ),
            )
            created_feedback = cur.fetchone()
            conn.commit()

    return created_feedback


@router.get("/tracks/{track_id}/feedback")
def get_track_feedback(track_id: int):
    with get_connection() as conn:
        ensure_feedback_detail_columns(conn)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM feedback WHERE track_id = %s ORDER BY id;",
                (track_id,),
            )
            return cur.fetchall()
