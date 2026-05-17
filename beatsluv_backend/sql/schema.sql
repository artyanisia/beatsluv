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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (generation_request_id) REFERENCES generation_requests(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    track_id INT NOT NULL,
    user_id INT NOT NULL,
    rating INT,
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
