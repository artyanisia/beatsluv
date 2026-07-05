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
    confidence: float
    explanation: list[str]


def predict_popularity(features: dict):
    rows = load_training_rows()
    if len(rows) < 8:
        return PopularityPrediction(
            predicted_rating=3.5,
            training_samples=len(rows),
            model_name="RandomForestRegressor",
            status="insufficient_training_data",
            confidence=0.32,
            explanation=[
                "Nu exista inca suficiente piese evaluate, asa ca BeatsLuv foloseste o estimare neutra.",
                "Adauga mai mult feedback structurat pentru a imbunatati calitatea predictiei.",
            ],
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
    normalized = normalize_prediction_features(features)
    model.fit(x_train, y_train)
    predicted = float(model.predict([normalized])[0])
    bounded_prediction = round(max(1.0, min(5.0, predicted)), 2)

    return PopularityPrediction(
        predicted_rating=bounded_prediction,
        training_samples=len(rows),
        model_name="RandomForestRegressor",
        status="trained",
        confidence=round(min(0.94, 0.45 + (len(rows) / 80)), 2),
        explanation=build_prediction_explanation(normalized, rows, bounded_prediction),
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


def build_prediction_explanation(features, rows, predicted_rating):
    genre = features["genre"]
    mood = features["mood"]
    tempo = features["tempo"]
    explanations = []

    same_genre = [float(row["avg_rating"]) for row in rows if row["genre"].lower() == genre.lower()]
    same_mood = [float(row["avg_rating"]) for row in rows if row["mood"].lower() == mood.lower()]

    if same_genre:
        genre_avg = sum(same_genre) / len(same_genre)
        explanations.append(f"Piesele din genul {genre} au o medie de {genre_avg:.2f}/5 in setul curent de date.")

    if same_mood:
        mood_avg = sum(same_mood) / len(same_mood)
        explanations.append(f"Piesele cu starea {mood} au o medie de {mood_avg:.2f}/5 pe baza feedbackului.")

    if 95 <= tempo <= 135:
        explanations.append("Tempo-ul ales se afla intr-un interval mediu, potrivit pentru ascultare usoara.")
    elif tempo:
        explanations.append("Tempo-ul este in afara intervalului mainstream, ceea ce poate face rezultatul mai de nisa.")

    if predicted_rating >= 4:
        explanations.append("Modelul considera aceasta combinatie puternica fata de piesele evaluate anterior.")
    elif predicted_rating < 3:
        explanations.append("Modelul estimeaza un raspuns mai slab daca promptul sau aranjamentul nu este rafinat.")

    return explanations[:4] or ["Predictia se bazeaza pe gen, stare, tempo, durata, tonalitate si temperatura AI."]


def get_recommendations():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COALESCE(NULLIF(TRIM(t.genre), ''), 'Unknown') AS genre,
                    COALESCE(NULLIF(TRIM(t.mood), ''), 'Unknown') AS mood,
                    ROUND(AVG(f.rating)::numeric, 2) AS avg_rating,
                    COUNT(f.id) AS feedback_count,
                    ROUND(AVG(t.tempo)::numeric, 0) AS avg_tempo,
                    ROUND(AVG(t.duration_seconds)::numeric, 0) AS avg_duration
                FROM tracks t
                JOIN feedback f ON t.id = f.track_id
                WHERE f.rating IS NOT NULL
                GROUP BY
                    COALESCE(NULLIF(TRIM(t.genre), ''), 'Unknown'),
                    COALESCE(NULLIF(TRIM(t.mood), ''), 'Unknown')
                HAVING COUNT(f.id) >= 1
                ORDER BY avg_rating DESC, feedback_count DESC
                LIMIT 6;
                """
            )
            rows = cur.fetchall()

    if not rows:
        return {
            "insights": ["Nu exista inca piese evaluate. Incepe prin colectarea feedbackului structurat de la utilizatori."],
            "prompt_suggestions": [
                {
                    "title": "Test pop de baza",
                    "prompt": "Creeaza un beat pop memorabil, cu sintetizatoare calde, refren clar si tobe potrivite pentru radio",
                    "genre": "pop",
                    "mood": "uplifting",
                    "tempo": 118,
                    "duration_seconds": 30,
                }
            ],
            "parameter_suggestions": [],
        }

    prompt_suggestions = [
        {
            "title": f"{row['genre']} + {row['mood']}",
            "prompt": (
                f"Creeaza o piesa {row['genre'].lower()} cu stare {row['mood'].lower()}, "
                "refren memorabil, aranjament curat si contrast emotional puternic"
            ),
            "genre": row["genre"],
            "mood": row["mood"],
            "tempo": int(row["avg_tempo"] or 120),
            "duration_seconds": int(row["avg_duration"] or 30),
            "avg_rating": float(row["avg_rating"] or 0),
            "feedback_count": row["feedback_count"],
        }
        for row in rows[:3]
    ]

    return {
        "insights": [
            f"Cea mai buna combinatie curenta: {rows[0]['genre']} + {rows[0]['mood']} la {float(rows[0]['avg_rating']):.2f}/5.",
            "Recomandarile sunt recalculate pe baza feedbackului real din platforma.",
            "Foloseste versiunile pentru a compara modificari mici ale promptului fara sa inlocuiesti ideea initiala.",
        ],
        "prompt_suggestions": prompt_suggestions,
        "parameter_suggestions": rows,
    }
