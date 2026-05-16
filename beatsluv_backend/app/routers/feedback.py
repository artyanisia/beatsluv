from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.database import get_connection


router = APIRouter(tags=["feedback"])


class FeedbackCreate(BaseModel):
    user_id: int
    rating: Optional[int] = None
    comment: Optional[str] = None
    liked: bool = False
    downloaded: bool = False
    shared: bool = False
    listen_count: int = 0
    sentiment_score: Optional[float] = None


@router.post("/tracks/{track_id}/feedback")
def create_feedback(track_id: int, feedback: FeedbackCreate):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO feedback (
                    track_id,
                    user_id,
                    rating,
                    comment,
                    liked,
                    downloaded,
                    shared,
                    listen_count,
                    sentiment_score
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *;
                """,
                (
                    track_id,
                    feedback.user_id,
                    feedback.rating,
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
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM feedback WHERE track_id = %s ORDER BY id;",
                (track_id,),
            )
            return cur.fetchall()
