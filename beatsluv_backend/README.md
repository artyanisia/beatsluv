# BeatsLuv Backend

## Start Everything

From the main `BeatsLuv` project folder, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\start_project.ps1
```

This starts or reuses all required local services:

- ACE-Step: `http://127.0.0.1:7860`
- Backend: `http://127.0.0.1:8001`
- Frontend: `http://127.0.0.1:5173`

ACE-Step can take a few minutes to become ready. Wait until `http://127.0.0.1:7860/health` responds before generating music.

To start everything without opening the browser:

```powershell
powershell -ExecutionPolicy Bypass -File .\start_project.ps1 -NoBrowser
```

## What It Uses

- Python
- FastAPI
- PostgreSQL
- psycopg
- python-dotenv
- ACE-Step local API
- Jamendo API for demo tracks with playable audio
- Scikit-learn for popularity prediction
- Manual SQL queries

The backend does not use SQLAlchemy, SQLModel, or Alembic.

## Setup

Create the database:

```sql
CREATE DATABASE beatsluv_db;
```

Run the schema from the `beatsluv_backend` folder:

```powershell
psql -U postgres -p 5433 -d beatsluv_db -f sql/schema.sql
```

If you already have an older database and only need the analytics columns:

```powershell
psql -U postgres -p 5433 -d beatsluv_db -f sql/add_track_analytics_columns.sql
```

Copy the environment file:

```powershell
Copy-Item .env.example .env
```

Example `.env`:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5433/beatsluv_db
ACESTEP_API_URL=http://127.0.0.1:7860
ACESTEP_MODEL=acestep-v15-turbo
ACESTEP_LM_MODEL_PATH=acestep-5Hz-lm-0.6B
ACESTEP_LM_BACKEND=pt
ACESTEP_AUDIO_FORMAT=wav
ACESTEP_BATCH_SIZE=1
ACESTEP_INFERENCE_STEPS=8
JAMENDO_CLIENT_ID=your_jamendo_client_id
```

Create and activate a virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Demo Data

To add a larger song library with playable audio URLs:

```powershell
.\.venv\Scripts\python.exe scripts\seed_jamendo_tracks.py --count 300
```

Useful variants:

```powershell
.\.venv\Scripts\python.exe scripts\seed_jamendo_tracks.py --count 50 --dry-run
.\.venv\Scripts\python.exe scripts\seed_jamendo_tracks.py --count 500 --tag reggae --tag blues
```

If the database does not have enough feedback rows for analytics and prediction:

```powershell
.\.venv\Scripts\python.exe scripts\seed_demo_feedback.py --per-track 3
```

## Analytics And Prediction

The dashboard uses SQL analytics endpoints under `/analytics` for descriptive statistics:

- `/analytics/genre-distribution`
- `/analytics/key-distribution`
- `/analytics/duration-analysis`
- `/analytics/ai-performance`
- `/analytics/monthly-evolution`

The prediction module uses Scikit-learn `RandomForestRegressor` and the local database feedback data:

```text
POST /predictions/popularity
```

## Generate A Track

```powershell
curl -X POST http://127.0.0.1:8001/generation-requests `
  -H "Content-Type: application/json" `
  -d '{
    "user_id": 1,
    "prompt": "Create a dreamy pop beat with soft vocals",
    "genre": "pop",
    "mood": "dreamy",
    "tempo": 100,
    "duration_seconds": 30
  }'
```

The backend calls ACE-Step, saves the generated audio under `generated_audio/`, creates a track row, and returns that track.

## Admin

Only this account can access the admin page:

```text
admin@gmail.com
```

The frontend hides the Admin tab for other users, and the backend rejects admin API requests unless the logged-in user has role `ADMIN` and email `admin@gmail.com`.

## Useful Endpoints

```text
GET    /
POST   /auth/register
POST   /auth/login
POST   /generation-requests
GET    /tracks
GET    /tracks/{track_id}
POST   /tracks
PUT    /tracks/{track_id}
DELETE /tracks/{track_id}
POST   /tracks/{track_id}/feedback
GET    /tracks/{track_id}/feedback
GET    /analytics/*
POST   /predictions/popularity
GET    /admin/*
```
