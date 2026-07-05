CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE generation_requests (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    prompt TEXT NOT NULL,
    genre VARCHAR(100),
    mood VARCHAR(100),
    tempo INT,
    ai_temperature NUMERIC(3, 2),
    key_signature VARCHAR(20),
    duration_seconds INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE tracks (
    id SERIAL PRIMARY KEY,
    generation_request_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    audio_url TEXT,
    duration_seconds INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    user_id INT,
    prompt TEXT,
    artist VARCHAR(255),
    album VARCHAR(255),
    release_date VARCHAR(50),
    source VARCHAR(50),
    external_id VARCHAR(255),
    external_url TEXT,
    genre VARCHAR(100),
    mood VARCHAR(100),
    tempo INT,
    ai_temperature NUMERIC(3, 2),
    key_signature VARCHAR(20),
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (generation_request_id) REFERENCES generation_requests(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    track_id INT NOT NULL,
    user_id INT NOT NULL,
    rating INT,
    melody_rating INT,
    originality_rating INT,
    emotional_impact_rating INT,
    commercial_potential_rating INT,
    production_quality_rating INT,
    comment TEXT,
    liked BOOLEAN DEFAULT FALSE,
    downloaded BOOLEAN DEFAULT FALSE,
    shared BOOLEAN DEFAULT FALSE,
    listen_count INT DEFAULT 0,
    sentiment_score FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE playlists (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE playlist_tracks (
    playlist_id INT NOT NULL,
    track_id INT NOT NULL,
    position INT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, track_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE INDEX idx_playlists_user_id ON playlists(user_id);
CREATE INDEX idx_playlist_tracks_track_id ON playlist_tracks(track_id);

CREATE TABLE prompt_versions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    track_id INT NOT NULL,
    parent_track_id INT,
    version_number INT NOT NULL,
    prompt TEXT NOT NULL,
    genre VARCHAR(100),
    mood VARCHAR(100),
    tempo INT,
    duration_seconds INT,
    ai_temperature NUMERIC(3, 2),
    key_signature VARCHAR(20),
    predicted_rating NUMERIC(4, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_track_id) REFERENCES tracks(id) ON DELETE SET NULL
);
