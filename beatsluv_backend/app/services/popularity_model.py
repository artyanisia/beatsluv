from dataclasses import dataclass

from sklearn.ensemble import RandomForestRegressor
from sklearn.feature_extraction import DictVectorizer
from sklearn.pipeline import Pipeline

from app.database import get_connection


@dataclass
class PopularityPrediction:
    predicted_rating: float
    training_samples: int
    model_name: str
    status: str


def predict_popularity(features: dict):
    rows = load_training_rows()
    if len(rows) < 8:
        return PopularityPrediction(
            predicted_rating=3.5,
            training_samples=len(rows),
            model_name="RandomForestRegressor",
            status="insufficient_training_data",
        )

    x_train = [row_features(row) for row in rows]
    y_train = [float(row["avg_rating"]) for row in rows]

    model = Pipeline(
        steps=[
            ("vectorizer", DictVectorizer(sparse=False)),
            (
                "regressor",
                RandomForestRegressor(
                    n_estimators=120,
                    random_state=42,
                    min_samples_leaf=2,
                ),
            ),
        ]
    )
    model.fit(x_train, y_train)
    predicted = float(model.predict([normalize_prediction_features(features)])[0])

    return PopularityPrediction(
        predicted_rating=round(max(1.0, min(5.0, predicted)), 2),
        training_samples=len(rows),
        model_name="RandomForestRegressor",
        status="trained",
    )


def load_training_rows():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COALESCE(NULLIF(TRIM(t.genre), ''), 'Unknown') AS genre,
                    COALESCE(NULLIF(TRIM(t.mood), ''), 'Unknown') AS mood,
                    COALESCE(NULLIF(TRIM(t.key_signature), ''), 'Unknown') AS key_signature,
                    COALESCE(t.tempo, 0) AS tempo,
                    COALESCE(t.duration_seconds, 0) AS duration_seconds,
                    COALESCE(t.ai_temperature, 0.7) AS ai_temperature,
                    AVG(f.rating) AS avg_rating
                FROM tracks t
                JOIN feedback f ON t.id = f.track_id
                WHERE f.rating IS NOT NULL
                GROUP BY
                    t.id,
                    COALESCE(NULLIF(TRIM(t.genre), ''), 'Unknown'),
                    COALESCE(NULLIF(TRIM(t.mood), ''), 'Unknown'),
                    COALESCE(NULLIF(TRIM(t.key_signature), ''), 'Unknown'),
                    COALESCE(t.tempo, 0),
                    COALESCE(t.duration_seconds, 0),
                    COALESCE(t.ai_temperature, 0.7);
                """
            )
            return cur.fetchall()


def row_features(row):
    return {
        "genre": row["genre"],
        "mood": row["mood"],
        "key_signature": row["key_signature"],
        "tempo": float(row["tempo"] or 0),
        "duration_seconds": float(row["duration_seconds"] or 0),
        "ai_temperature": float(row["ai_temperature"] or 0.7),
    }


def normalize_prediction_features(features):
    return {
        "genre": features.get("genre") or "Unknown",
        "mood": features.get("mood") or "Unknown",
        "key_signature": features.get("key_signature") or "Unknown",
        "tempo": float(features.get("tempo") or 0),
        "duration_seconds": float(features.get("duration_seconds") or 0),
        "ai_temperature": float(features.get("ai_temperature") or 0.7),
    }
