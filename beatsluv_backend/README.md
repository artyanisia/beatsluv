# BeatsLuv Backend

FastAPI backend for generating music with a local ACE-Step server, importing MusicBrainz metadata, and storing tracks in PostgreSQL.

## What It Uses

- Python
- FastAPI
- PostgreSQL
- psycopg
- python-dotenv
- ACE-Step local API
- MusicBrainz API for fake library seeding
- Manual SQL queries

It does not use SQLAlchemy, SQLModel, Alembic, or third-party paid APIs.

## Project Structure

```text
beatsluv_backend/
  app/
    main.py
    database.py
    routers/
      generation_requests.py
      tracks.py
      feedback.py
    services/
      music_generator.py
  generated_audio/
  sql/
    schema.sql
  requirements.txt
  .env.example
  README.md
```

## Setup

Create the database:

```sql
CREATE DATABASE beatsluv_db;
```

Run the schema from the `beatsluv_backend` folder:

```powershell
psql -U postgres -p 5433 -d beatsluv_db -f sql/schema.sql
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
MUSICBRAINZ_API_URL=https://musicbrainz.org/ws/2
MUSICBRAINZ_USER_AGENT=BeatsLuv/1.0 (your-email@example.com)
MUSICBRAINZ_FAKE_PREVIEW_SECONDS=10
```

If you already created the database before the MusicBrainz integration, run the additive metadata migration:

```powershell
psql -U postgres -p 5433 -d beatsluv_db -f sql/add_musicbrainz_metadata.sql
```

Create and activate a virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Start ACE-Step with API routes enabled:

```powershell
cd D:\WORK-ANISIA\FACULTATE\Anul3-sem2\_ACE-Step-1.5
powershell -ExecutionPolicy Bypass -File .\run_acestep_local.ps1
```

Start the backend from the `beatsluv_backend` folder:

```powershell
uvicorn app.main:app --reload
```

Open:

```text
http://127.0.0.1:8000/docs
```

## Test User

The generation endpoint needs a real `user_id` because of database foreign keys:

```sql
INSERT INTO users (email, password_hash, role)
VALUES ('test@example.com', 'not-a-real-hash-yet', 'USER');
```

## Generate A Track

```powershell
curl -X POST http://127.0.0.1:8000/generation-requests `
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

The backend calls ACE-Step, saves the generated audio under `generated_audio/`, creates a track row, and returns that track. If generation fails, the API returns `Couldn't generate`.

## Import Fake Songs From MusicBrainz

MusicBrainz imports do not need an API key, but they do require a meaningful `MUSICBRAINZ_USER_AGENT`. The importer makes one search request, creates local placeholder WAV previews under `generated_audio/`, and saves imported rows with artist, album, release date, source, genre, and MusicBrainz URL metadata.

```powershell
curl -X POST http://127.0.0.1:8000/tracks/import/musicbrainz `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -d '{
    "query": "pop",
    "genre": "pop",
    "mood": "reference",
    "limit": 10
  }'
```

## Useful Endpoints

```text
GET    /
POST   /generation-requests
GET    /tracks
GET    /tracks/{track_id}
POST   /tracks
POST   /tracks/import/musicbrainz
PUT    /tracks/{track_id}
DELETE /tracks/{track_id}
POST   /tracks/{track_id}/feedback
GET    /tracks/{track_id}/feedback
```
