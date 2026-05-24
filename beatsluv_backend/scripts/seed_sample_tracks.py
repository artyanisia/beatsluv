#!/usr/bin/env python3
"""Seed BeatsLuv with complete demo data, including public/private tracks."""

from __future__ import annotations

import argparse
import math
import random
import struct
import sys
import wave
from datetime import datetime, timedelta
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.auth import get_password_hash  # noqa: E402
from app.database import get_connection  # noqa: E402


GENERATED_AUDIO_DIR = BACKEND_ROOT / "generated_audio"

SAMPLE_USERS = [
    {"email": "alice@beatsluv.com", "name": "Alice"},
    {"email": "bob@beatsluv.com", "name": "Bob"},
    {"email": "carol@beatsluv.com", "name": "Carol"},
    {"email": "david@beatsluv.com", "name": "David"},
    {"email": "eve@beatsluv.com", "name": "Eve"},
    {"email": "mara@beatsluv.com", "name": "Mara"},
]

TRACK_BLUEPRINTS = [
    {
        "genre": "electronic",
        "mood": "upbeat",
        "prompt": "Create an upbeat electronic dance track with heavy bass and glossy synth leads",
        "titles": ["Neon Pulse", "Skyline Voltage", "Afterhours Signal"],
        "tempo": (122, 148),
        "duration": (145, 230),
        "temperature": (0.65, 1.1),
        "keys": ["C minor", "F minor", "G minor", "D minor"],
    },
    {
        "genre": "pop",
        "mood": "dreamy",
        "prompt": "Create a dreamy pop beat with soft vocals, warm pads, and a clean radio hook",
        "titles": ["Cloudlight", "Velvet Echo", "Moonlit Chorus"],
        "tempo": (88, 118),
        "duration": (155, 240),
        "temperature": (0.55, 0.95),
        "keys": ["C major", "G major", "A minor", "E minor"],
    },
    {
        "genre": "rock",
        "mood": "energetic",
        "prompt": "Produce a hard rock anthem with powerful drums and melodic electric guitar solos",
        "titles": ["Rift Runner", "Amp Fire", "Glass Thunder"],
        "tempo": (112, 152),
        "duration": (170, 285),
        "temperature": (0.5, 1.0),
        "keys": ["E minor", "A minor", "D major", "G major"],
    },
    {
        "genre": "jazz",
        "mood": "smooth",
        "prompt": "Make a jazzy lounge track with smooth saxophone, upright bass, and piano comping",
        "titles": ["Blue Room", "Late Set", "Velvet Seventh"],
        "tempo": (72, 108),
        "duration": (185, 315),
        "temperature": (0.45, 0.9),
        "keys": ["Bb major", "Eb major", "F major", "C minor"],
    },
    {
        "genre": "orchestral",
        "mood": "cinematic",
        "prompt": "Create a cinematic orchestral piece with rising strings, brass swells, and percussion",
        "titles": ["Solar Overture", "Kingdom Fade", "Last Horizon"],
        "tempo": (70, 112),
        "duration": (210, 360),
        "temperature": (0.4, 0.85),
        "keys": ["D minor", "G minor", "F major", "Bb major"],
    },
    {
        "genre": "hip-hop",
        "mood": "chill",
        "prompt": "Generate a lo-fi hip hop beat with vinyl crackle, dusty drums, and mellow samples",
        "titles": ["Window Rain", "Tape Bloom", "Low Sun Loop"],
        "tempo": (74, 96),
        "duration": (120, 210),
        "temperature": (0.5, 0.9),
        "keys": ["A minor", "C minor", "E minor", "D minor"],
    },
    {
        "genre": "ambient",
        "mood": "peaceful",
        "prompt": "Make a beautiful ambient soundscape for meditation with evolving pads and soft bells",
        "titles": ["Still Water", "Quiet Orbit", "Aurora Drift"],
        "tempo": (55, 82),
        "duration": (240, 420),
        "temperature": (0.35, 0.8),
        "keys": ["C major", "F major", "A minor", "D major"],
    },
    {
        "genre": "metal",
        "mood": "aggressive",
        "prompt": "Generate an aggressive metal track with fast drums, heavy riffs, and dark harmonies",
        "titles": ["Iron Static", "Black Circuit", "Wired Collapse"],
        "tempo": (135, 190),
        "duration": (165, 290),
        "temperature": (0.55, 1.15),
        "keys": ["E minor", "D minor", "F minor", "G minor"],
    },
]

FEEDBACK_COMMENTS = [
    "Great mix and strong hook.",
    "The mood fits the prompt really well.",
    "Nice energy, but the middle could evolve more.",
    "This would work well in a playlist.",
    "The drums and textures feel polished.",
    "Interesting idea, I would make the lead brighter.",
    "Very replayable and clean.",
    "Good structure with a memorable ending.",
]


def parse_args():
    parser = argparse.ArgumentParser(description="Populate BeatsLuv demo users, tracks, requests, and feedback.")
    parser.add_argument("--tracks-per-user", type=int, default=8, help="Target number of seeded tracks per demo user.")
    parser.add_argument("--feedback-per-track", type=int, default=4, help="Target feedback rows per seeded public track.")
    parser.add_argument("--public-ratio", type=float, default=0.65, help="Ratio of seeded tracks that should be public.")
    parser.add_argument("--password", default="password123", help="Password assigned to demo users.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for deterministic demo data.")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be created or updated.")
    return parser.parse_args()


def ensure_schema(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
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
            ADD COLUMN IF NOT EXISTS key_signature VARCHAR(20),
            ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
            """
        )
        conn.commit()


def email_slug(email):
    return email.split("@", 1)[0].replace(".", "-")


def ensure_demo_users(conn, password_hash, dry_run):
    users = {}
    with conn.cursor() as cur:
        for user in SAMPLE_USERS:
            email = user["email"]
            if dry_run:
                users[email] = {"id": -(len(users) + 1), "name": user["name"], "email": email}
                print(f"Would ensure user {email}")
                continue

            cur.execute("SELECT id FROM users WHERE email = %s;", (email,))
            existing = cur.fetchone()
            if existing:
                cur.execute(
                    """
                    UPDATE users
                    SET password_hash = %s,
                        role = 'USER'
                    WHERE id = %s;
                    """,
                    (password_hash, existing["id"]),
                )
                user_id = existing["id"]
                action = "Updated"
            else:
                cur.execute(
                    """
                    INSERT INTO users (email, password_hash, role, created_at)
                    VALUES (%s, %s, 'USER', %s)
                    RETURNING id;
                    """,
                    (email, password_hash, datetime.now() - timedelta(days=45 + len(users))),
                )
                user_id = cur.fetchone()["id"]
                action = "Created"

            users[email] = {"id": user_id, "name": user["name"], "email": email}
            print(f"{action} user {email} (id {user_id})")
        conn.commit()
    return users


def build_track(user, index, rng, public_ratio):
    blueprint = TRACK_BLUEPRINTS[(index - 1) % len(TRACK_BLUEPRINTS)]
    title_root = blueprint["titles"][(index - 1) % len(blueprint["titles"])]
    title = f"{title_root} by {user['name']}"
    if index > len(blueprint["titles"]):
        title = f"{title} {index:02d}"

    # Ensure every user has a mix even when public_ratio is high or low.
    is_public = index % 3 != 0 if public_ratio >= 0.5 else index % 2 == 0
    if rng.random() > 0.82:
        is_public = rng.random() < public_ratio

    created_at = datetime.now() - timedelta(days=rng.randint(1, 120), hours=rng.randint(0, 23))
    external_id = f"seed-{email_slug(user['email'])}-{index:02d}"

    return {
        "external_id": external_id,
        "title": title,
        "prompt": blueprint["prompt"],
        "genre": blueprint["genre"],
        "mood": blueprint["mood"],
        "tempo": rng.randint(*blueprint["tempo"]),
        "duration_seconds": rng.randint(*blueprint["duration"]),
        "ai_temperature": round(rng.uniform(*blueprint["temperature"]), 2),
        "key_signature": rng.choice(blueprint["keys"]),
        "audio_url": f"/generated-audio/{external_id}.wav",
        "artist": user["name"],
        "album": "BeatsLuv Demo Sessions",
        "release_date": created_at.date().isoformat(),
        "source": "AI_Generated",
        "external_url": f"https://beatsluv.local/tracks/{external_id}",
        "is_public": is_public,
        "created_at": created_at,
    }


def write_demo_audio(track):
    """Create a short playable WAV preview for seeded tracks."""
    GENERATED_AUDIO_DIR.mkdir(exist_ok=True)
    file_name = track["audio_url"].rsplit("/", 1)[-1]
    file_path = GENERATED_AUDIO_DIR / file_name

    sample_rate = 16_000
    seconds = 2.0
    total_frames = int(sample_rate * seconds)
    base_frequency = 180 + (track["tempo"] % 90) * 4
    mood_offset = {
        "upbeat": 60,
        "dreamy": 35,
        "energetic": 80,
        "smooth": 20,
        "cinematic": 45,
        "chill": 15,
        "peaceful": 10,
        "aggressive": 100,
    }.get(track["mood"], 30)

    with wave.open(str(file_path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)

        frames = bytearray()
        for frame in range(total_frames):
            t = frame / sample_rate
            envelope = min(1.0, frame / (sample_rate * 0.12), (total_frames - frame) / (sample_rate * 0.18))
            carrier = math.sin(2 * math.pi * base_frequency * t)
            harmonic = 0.35 * math.sin(2 * math.pi * (base_frequency + mood_offset) * t)
            pulse = 0.18 * math.sin(2 * math.pi * (track["tempo"] / 60) * t)
            value = int(9000 * envelope * (carrier + harmonic + pulse) / 1.53)
            frames.extend(struct.pack("<h", value))

        wav_file.writeframes(frames)


def upsert_generation_request(cur, user_id, track, generation_request_id=None):
    values = (
        user_id,
        track["prompt"],
        track["genre"],
        track["mood"],
        track["tempo"],
        track["ai_temperature"],
        track["key_signature"],
        track["duration_seconds"],
        "completed",
        track["created_at"],
    )

    if generation_request_id:
        cur.execute(
            """
            UPDATE generation_requests
            SET user_id = %s,
                prompt = %s,
                genre = %s,
                mood = %s,
                tempo = %s,
                ai_temperature = %s,
                key_signature = %s,
                duration_seconds = %s,
                status = %s,
                created_at = %s
            WHERE id = %s
            RETURNING id;
            """,
            (*values, generation_request_id),
        )
        return cur.fetchone()["id"]

    cur.execute(
        """
        INSERT INTO generation_requests (
            user_id,
            prompt,
            genre,
            mood,
            tempo,
            ai_temperature,
            key_signature,
            duration_seconds,
            status,
            created_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
        """,
        values,
    )
    return cur.fetchone()["id"]


def upsert_track(cur, user_id, generation_request_id, track):
    cur.execute("SELECT id, generation_request_id FROM tracks WHERE external_id = %s;", (track["external_id"],))
    existing = cur.fetchone()

    values = (
        generation_request_id,
        track["title"],
        track["audio_url"],
        track["duration_seconds"],
        "completed",
        user_id,
        track["prompt"],
        track["artist"],
        track["album"],
        track["release_date"],
        track["source"],
        track["external_id"],
        track["external_url"],
        track["genre"],
        track["mood"],
        track["tempo"],
        track["ai_temperature"],
        track["key_signature"],
        track["is_public"],
        track["created_at"],
    )

    if existing:
        cur.execute(
            """
            UPDATE tracks
            SET generation_request_id = %s,
                title = %s,
                audio_url = %s,
                duration_seconds = %s,
                status = %s,
                user_id = %s,
                prompt = %s,
                artist = %s,
                album = %s,
                release_date = %s,
                source = %s,
                external_id = %s,
                external_url = %s,
                genre = %s,
                mood = %s,
                tempo = %s,
                ai_temperature = %s,
                key_signature = %s,
                is_public = %s,
                created_at = %s
            WHERE id = %s
            RETURNING id;
            """,
            (*values, existing["id"]),
        )
        return cur.fetchone()["id"], "updated"

    cur.execute(
        """
        INSERT INTO tracks (
            generation_request_id,
            title,
            audio_url,
            duration_seconds,
            status,
            user_id,
            prompt,
            artist,
            album,
            release_date,
            source,
            external_id,
            external_url,
            genre,
            mood,
            tempo,
            ai_temperature,
            key_signature,
            is_public,
            created_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
        """,
        values,
    )
    return cur.fetchone()["id"], "created"


def find_seed_track(cur, external_id):
    cur.execute(
        """
        SELECT id, generation_request_id
        FROM tracks
        WHERE external_id = %s;
        """,
        (external_id,),
    )
    return cur.fetchone()


def seed_tracks(conn, users, tracks_per_user, public_ratio, seed, dry_run):
    rng = random.Random(seed)
    created = 0
    updated = 0
    public_count = 0
    private_count = 0
    seeded_tracks = []

    with conn.cursor() as cur:
        for user in users.values():
            print(f"\nTracks for {user['name']}:")
            for index in range(1, tracks_per_user + 1):
                track = build_track(user, index, rng, public_ratio)
                visibility = "public" if track["is_public"] else "private"

                if dry_run:
                    print(f"  Would upsert {track['title']} ({visibility})")
                    track_id = -(len(seeded_tracks) + 1)
                    action = "created"
                else:
                    existing_track = find_seed_track(cur, track["external_id"])
                    existing_request_id = existing_track["generation_request_id"] if existing_track else None
                    generation_request_id = upsert_generation_request(cur, user["id"], track, existing_request_id)
                    track_id, action = upsert_track(cur, user["id"], generation_request_id, track)
                    write_demo_audio(track)
                    print(f"  {action.title()} {track['title']} (id {track_id}, {visibility})")

                created += action == "created"
                updated += action == "updated"
                public_count += track["is_public"]
                private_count += not track["is_public"]
                seeded_tracks.append({**track, "id": track_id, "user_id": user["id"]})

        if not dry_run:
            conn.commit()

    return seeded_tracks, created, updated, public_count, private_count


def rating_for(track, reviewer_id, index):
    score = 3
    if track["genre"] in {"pop", "rock", "electronic"}:
        score += 1
    if track["mood"] in {"upbeat", "energetic", "dreamy", "smooth"}:
        score += 1
    if index % 5 == 0:
        score -= 1
    if reviewer_id % 4 == 0:
        score -= 1
    return max(1, min(5, score))


def seed_feedback(conn, users, tracks, feedback_per_track, seed, dry_run):
    rng = random.Random(seed + 1000)
    demo_user_ids = [user["id"] for user in users.values()]
    inserted = 0
    updated = 0

    with conn.cursor() as cur:
        for track in tracks:
            if not track["is_public"]:
                continue

            reviewers = [user_id for user_id in demo_user_ids if user_id != track["user_id"]]
            rng.shuffle(reviewers)
            reviewers = reviewers[:feedback_per_track]

            for index, reviewer_id in enumerate(reviewers, start=1):
                rating = rating_for(track, reviewer_id, index)
                liked = rating >= 4
                downloaded = rating == 5 or (rating >= 4 and index % 2 == 0)
                shared = liked and index % 3 == 0
                listen_count = rating + index + rng.randint(0, 5)
                sentiment_score = round((rating - 3) / 2, 2)
                comment = FEEDBACK_COMMENTS[(track["id"] + reviewer_id + index) % len(FEEDBACK_COMMENTS)]
                created_at = track["created_at"] + timedelta(days=index + rng.randint(0, 8))

                if dry_run:
                    print(f"Would ensure feedback on track {track['id']} by user {reviewer_id}")
                    inserted += 1
                    continue

                cur.execute(
                    """
                    SELECT id
                    FROM feedback
                    WHERE track_id = %s AND user_id = %s;
                    """,
                    (track["id"], reviewer_id),
                )
                existing = cur.fetchone()
                if existing:
                    cur.execute(
                        """
                        UPDATE feedback
                        SET rating = %s,
                            comment = %s,
                            liked = %s,
                            downloaded = %s,
                            shared = %s,
                            listen_count = %s,
                            sentiment_score = %s,
                            created_at = %s
                        WHERE id = %s;
                        """,
                        (
                            rating,
                            comment,
                            liked,
                            downloaded,
                            shared,
                            listen_count,
                            sentiment_score,
                            created_at,
                            existing["id"],
                        ),
                    )
                    updated += 1
                else:
                    cur.execute(
                        """
                        INSERT INTO feedback (
                            track_id,
                            user_id,
                            rating,
                            comment,
                            liked,
                            downloaded,
                            shared,
                            listen_count,
                            sentiment_score,
                            created_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                        """,
                        (
                            track["id"],
                            reviewer_id,
                            rating,
                            comment,
                            liked,
                            downloaded,
                            shared,
                            listen_count,
                            sentiment_score,
                            created_at,
                        ),
                    )
                    inserted += 1

        if not dry_run:
            conn.commit()

    return inserted, updated


def print_table_counts(conn):
    with conn.cursor() as cur:
        for table in ("users", "generation_requests", "tracks", "feedback"):
            cur.execute(f"SELECT COUNT(*) AS count FROM {table};")
            print(f"  {table}: {cur.fetchone()['count']}")


def main():
    args = parse_args()

    if not 0 <= args.public_ratio <= 1:
        print("Error: --public-ratio must be between 0.0 and 1.0")
        sys.exit(1)
    if args.tracks_per_user < 1:
        print("Error: --tracks-per-user must be at least 1")
        sys.exit(1)
    if args.feedback_per_track < 0:
        print("Error: --feedback-per-track cannot be negative")
        sys.exit(1)

    print("BeatsLuv complete demo data seeder")
    print("=" * 40)
    if args.dry_run:
        print("Dry run only. No database changes will be made.\n")

    conn = get_connection()
    try:
        if not args.dry_run:
            ensure_schema(conn)

        password_hash = get_password_hash(args.password)
        users = ensure_demo_users(conn, password_hash, args.dry_run)
        tracks, created, updated, public_count, private_count = seed_tracks(
            conn,
            users,
            args.tracks_per_user,
            args.public_ratio,
            args.seed,
            args.dry_run,
        )
        feedback_inserted, feedback_updated = seed_feedback(
            conn,
            users,
            tracks,
            args.feedback_per_track,
            args.seed,
            args.dry_run,
        )

        print("\nSummary")
        print(f"  Demo users: {len(users)}")
        print(f"  Tracks created: {created}")
        print(f"  Tracks updated: {updated}")
        print(f"  Public tracks in seed set: {public_count}")
        print(f"  Private tracks in seed set: {private_count}")
        print(f"  Feedback inserted: {feedback_inserted}")
        print(f"  Feedback updated: {feedback_updated}")

        if not args.dry_run:
            print("\nCurrent table counts")
            print_table_counts(conn)
            print(f"\nDemo login password for seeded users: {args.password}")
    except Exception as exc:
        print(f"Error: {exc}")
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
