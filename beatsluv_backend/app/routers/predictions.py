from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.auth import verify_token
from app.services.popularity_model import predict_popularity


router = APIRouter(prefix="/predictions", tags=["predictions"])


class PopularityPredictionRequest(BaseModel):
    genre: Optional[str] = None
    mood: Optional[str] = None
    key_signature: Optional[str] = None
    tempo: Optional[int] = None
    duration_seconds: int = Field(default=180, ge=1)
    ai_temperature: float = Field(default=0.7, ge=0, le=2)


@router.post("/popularity")
def predict_track_popularity(
    request: PopularityPredictionRequest,
    current_user: dict = Depends(verify_token),
):
    prediction = predict_popularity(request.model_dump())
    return {
        "predicted_rating": prediction.predicted_rating,
        "training_samples": prediction.training_samples,
        "model_name": prediction.model_name,
        "status": prediction.status,
    }
