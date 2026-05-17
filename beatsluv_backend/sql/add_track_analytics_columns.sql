ALTER TABLE tracks
ALTER COLUMN audio_url DROP NOT NULL,
ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id),
ADD COLUMN IF NOT EXISTS prompt TEXT,
ADD COLUMN IF NOT EXISTS artist VARCHAR(255),
ADD COLUMN IF NOT EXISTS album VARCHAR(255),
ADD COLUMN IF NOT EXISTS release_date VARCHAR(50),
ADD COLUMN IF NOT EXISTS source VARCHAR(50),
ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS external_url TEXT,
ADD COLUMN IF NOT EXISTS genre VARCHAR(100),
ADD COLUMN IF NOT EXISTS mood VARCHAR(100),
ADD COLUMN IF NOT EXISTS tempo INT,
ADD COLUMN IF NOT EXISTS ai_temperature NUMERIC(3, 2),
ADD COLUMN IF NOT EXISTS key_signature VARCHAR(20);

UPDATE tracks t
SET user_id = gr.user_id,
    prompt = gr.prompt,
    genre = COALESCE(t.genre, gr.genre),
    mood = COALESCE(t.mood, gr.mood),
    tempo = COALESCE(t.tempo, gr.tempo)
FROM generation_requests gr
WHERE t.generation_request_id = gr.id
  AND (t.user_id IS NULL OR t.prompt IS NULL OR t.genre IS NULL OR t.mood IS NULL OR t.tempo IS NULL);
