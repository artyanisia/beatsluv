# BeatsLuv Backend

## What It Uses

- Python
- FastAPI
- PostgreSQL
- psycopg
- python-dotenv
- Stability AI API for music generation
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
MUSIC_PROVIDER=stability
STABILITY_API_KEY=your_stability_api_key
STABILITY_API_URL=https://api.stability.ai
STABILITY_AUDIO_ENDPOINT=/v2beta/audio/stable-audio-2/text-to-audio
STABILITY_AUDIO_MODEL=stable-audio-2
STABILITY_AUDIO_FORMAT=mp3
STABILITY_CFG_SCALE=7
STABILITY_STEPS=30
STABILITY_MAX_DURATION_SECONDS=190
JAMENDO_CLIENT_ID=your_jamendo_client_id
```

Create and activate a virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Demo Data

After creating the database and running `sql/schema.sql`, populate it with presentation data:

```powershell
.\.venv\Scripts\python.exe scripts\seed_demo_data.py
```

This creates:

- `admin@gmail.com` with password `pass123`
- `user001@gmail.com` through `user500@gmail.com` with password `pass123`
- demo tracks, feedback, playlists, and prompt versions

You can customize the size:

```powershell
.\.venv\Scripts\python.exe scripts\seed_demo_data.py --users 500 --tracks 240 --feedback 1200 --playlists 120
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

The backend calls Stability AI, saves the generated audio under `generated_audio/`, creates a track row, and returns that track.

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
GET    /playlists
POST   /playlists
GET    /playlists/{playlist_id}
POST   /playlists/{playlist_id}/tracks
DELETE /playlists/{playlist_id}/tracks/{track_id}
GET    /admin/*
```
