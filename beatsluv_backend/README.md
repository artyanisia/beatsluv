# BeatsLuv Backend

A beginner-friendly FastAPI backend for an AI music generation and analytics platform.

This project uses:

- Python
- FastAPI
- PostgreSQL
- psycopg
- python-dotenv
- Hugging Face MusicGen
- Manual SQL queries

It does not use SQLAlchemy, SQLModel, or Alembic.

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

## 1. Create The Database

Open PostgreSQL and create a database:

```sql
CREATE DATABASE beatsluv;
```

You can do this with `psql`:

```bash
psql -U postgres
```

Then inside `psql`:

```sql
CREATE DATABASE beatsluv;
\q
```

## 2. Run The Schema

From the `beatsluv_backend` folder, run:

```bash
psql -U postgres -d beatsluv -f sql/schema.sql
```

This creates the tables:

- `users`
- `generation_requests`
- `tracks`
- `feedback`

## 3. Create The `.env` File

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Example `.env` values:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/beatsluv_db
MOCK_AUDIO_URL=https://example.com/mock-track.mp3
MUSIC_GENERATION_PROVIDER=local
LOCAL_MUSICGEN_MODEL_ID=facebook/musicgen-small
HUGGINGFACE_API_TOKEN=your_huggingface_token_here
HUGGINGFACE_MODEL_ID=facebook/musicgen-large
HUGGINGFACE_ENDPOINT_URL=
```

Update `your_password` with your local PostgreSQL password.

`MUSIC_GENERATION_PROVIDER=local` makes the backend generate WAV files on your
computer with AudioCraft MusicGen. The default `facebook/musicgen-small` model is
the fastest option, but the first request can still take a while because the
model weights must be downloaded and loaded.

If local MusicGen fails, the backend automatically uses the mock fallback track.

To use Hugging Face instead of local generation, set:

```env
MUSIC_GENERATION_PROVIDER=huggingface
```

`HUGGINGFACE_API_TOKEN` is used only by the Hugging Face provider. If the token is
missing or the external API fails, the backend automatically uses the mock
fallback track.

`facebook/musicgen-large` is a large 3.3B parameter model. For reliable API use,
create a Hugging Face Inference Endpoint and paste its URL into:

```env
HUGGINGFACE_ENDPOINT_URL=https://your-endpoint.endpoints.huggingface.cloud
```

If `HUGGINGFACE_ENDPOINT_URL` is empty, the backend tries the general Hugging
Face model inference URL for `HUGGINGFACE_MODEL_ID`.

## 4. Install Requirements

Create and activate a virtual environment:

```bash
python -m venv .venv
```

On macOS/Linux:

```bash
source .venv/bin/activate
```

On Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

AudioCraft is heavier than the rest of the backend dependencies. It works best
with Python 3.10 or 3.11. If installation fails on Python 3.12, create the
virtual environment with Python 3.10 and reinstall `requirements.txt`.

## 5. Run The FastAPI Server

From the `beatsluv_backend` folder, run:

```bash
uvicorn app.main:app --reload
```

Open:

```text
http://127.0.0.1:8000
```

API docs:

```text
http://127.0.0.1:8000/docs
```

## 6. Add A Test User

The generation request endpoint needs a real `user_id`, because the database has foreign keys.

Run this in `psql`:

```sql
INSERT INTO users (email, password_hash, role)
VALUES ('test@example.com', 'not-a-real-hash-yet', 'USER');
```

## Example API Calls

### Health Check

```bash
curl http://127.0.0.1:8000/
```

### Create A Generation Request

This inserts a generation request, calls local MusicGen, creates a track, and
returns the track. If local generation is not available, it returns a mock track.

```bash
curl -X POST http://127.0.0.1:8000/generation-requests \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "prompt": "Create a dreamy pop beat with soft vocals",
    "genre": "pop",
    "mood": "dreamy",
    "tempo": 100,
    "duration_seconds": 30
  }'
```

When real generation succeeds, the returned `audio_url` looks like this:

```text
/generated-audio/generated-file-name.wav
```

You can open it from the running server:

```text
http://127.0.0.1:8000/generated-audio/generated-file-name.wav
```

### Get All Tracks

```bash
curl http://127.0.0.1:8000/tracks
```

### Get One Track

```bash
curl http://127.0.0.1:8000/tracks/1
```

### Create A Track Manually

```bash
curl -X POST http://127.0.0.1:8000/tracks \
  -H "Content-Type: application/json" \
  -d '{
    "generation_request_id": 1,
    "title": "Manual Track",
    "audio_url": "https://example.com/manual-track.mp3",
    "duration_seconds": 45,
    "status": "READY",
    "predicted_success_score": 0.7
  }'
```

### Update A Track

```bash
curl -X PUT http://127.0.0.1:8000/tracks/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Track Title",
    "status": "PUBLISHED"
  }'
```

### Delete A Track

```bash
curl -X DELETE http://127.0.0.1:8000/tracks/1
```

### Add Feedback To A Track

```bash
curl -X POST http://127.0.0.1:8000/tracks/1/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "rating": 5,
    "comment": "Great beat!",
    "liked": true,
    "downloaded": true,
    "shared": false,
    "listen_count": 3,
    "sentiment_score": 0.9
  }'
```

### Get Feedback For A Track

```bash
curl http://127.0.0.1:8000/tracks/1/feedback
```
