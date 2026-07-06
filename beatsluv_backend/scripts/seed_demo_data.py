import argparse
import random
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.auth import get_password_hash
from app.database import get_connection


SEED_SOURCE = "seed-demo"
ADMIN_EMAIL = "admin@gmail.com"

GENRES = ["pop", "rock", "electronic", "hip-hop", "jazz", "ambient", "lo-fi", "dance"]
MOODS = ["happy", "dreamy", "energetic", "chill", "dark", "romantic", "focused", "nostalgic"]
KEYS = ["C major", "D minor", "E minor", "F major", "G major", "A minor", "B minor"]
COMMENTS = [
    "Ritm bun si refren usor de retinut.",
    "Atmosfera puternica, potrivita pentru playlist-uri.",
    "Melodia este memorabila.",
    "Productie buna, dar ar merge mai multa variatie.",
    "Potential comercial bun.",
    "Mix curat si stare bine conturata.",
]


def parse_args():
    parser = argparse.ArgumentParser(description="Populeaza BeatsLuv cu utilizatori, piese, feedback si playlist-uri demo.")
    parser.add_argument("--users", type=int, default=500, help="Numarul de utilizatori obisnuiti care vor fi creati.")
    parser.add_argument("--tracks", type=int, default=240, help="Numarul de piese demo care vor fi create.")
    parser.add_argument("--feedback", type=int, default=1200, help="Numarul de randuri de feedback care vor fi create.")
    parser.add_argument("--playlists", type=int, default=120, help="Numarul de playlist-uri care vor fi create.")
    parser.add_argument("--password", default="pass123", help="Parola folosita pentru toti utilizatorii creati.")
    parser.add_argument("--seed", type=int, default=42, help="Seed aleator pentru date demo deterministe.")
    return parser.parse_args()


def cleanup_seed_data(cur):
    cur.execute(
        """
        DELETE FROM playlist_tracks
        WHERE playlist_id IN (
            SELECT id FROM playlists WHERE description LIKE %s
        )
        OR track_id IN (
            SELECT id FROM tracks WHERE source = %s
        );
        """,
        (f"[{SEED_SOURCE}]%", SEED_SOURCE),
    )
    cur.execute(
        """
        DELETE FROM feedback
        WHERE comment LIKE %s
           OR track_id IN (SELECT id FROM tracks WHERE source = %s);
        """,
        (f"[{SEED_SOURCE}]%", SEED_SOURCE),
    )
    cur.execute(
        "DELETE FROM prompt_versions WHERE track_id IN (SELECT id FROM tracks WHERE source = %s);",
        (SEED_SOURCE,),
    )
    cur.execute("DELETE FROM tracks WHERE source = %s;", (SEED_SOURCE,))
    cur.execute("DELETE FROM generation_requests WHERE prompt LIKE %s;", (f"[{SEED_SOURCE}]%",))
    cur.execute("DELETE FROM playlists WHERE description LIKE %s;", (f"[{SEED_SOURCE}]%",))


def upsert_users(cur, users_count, password_hash):
    users = []

    cur.execute(
        """
        INSERT INTO users (email, password_hash, role)
        VALUES (%s, %s, 'ADMIN')
        ON CONFLICT (email)
        DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'ADMIN'
        RETURNING id, email;
        """,
        (ADMIN_EMAIL, password_hash),
    )
    admin = cur.fetchone()

    for index in range(1, users_count + 1):
        email = f"user{index:03d}@gmail.com"
        cur.execute(
            """
            INSERT INTO users (email, password_hash, role)
            VALUES (%s, %s, 'USER')
            ON CONFLICT (email)
            DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'USER'
            RETURNING id, email;
            """,
            (email, password_hash),
        )
        users.append(cur.fetchone())

    return admin, users


def create_tracks(cur, users, tracks_count):
    tracks = []

    for index in range(1, tracks_count + 1):
        owner = users[(index - 1) % len(users)]
        genre = GENRES[index % len(GENRES)]
        mood = MOODS[(index * 2) % len(MOODS)]
        tempo = 72 + (index * 7) % 88
        duration = 30 + (index * 5) % 150
        key_signature = KEYS[index % len(KEYS)]
        prompt = f"[{SEED_SOURCE}] Creeaza o piesa {genre} cu stare {mood}, la {tempo} BPM."

        cur.execute(
            """
            INSERT INTO generation_requests (
                user_id, prompt, genre, mood, tempo, ai_temperature,
                key_signature, duration_seconds, status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'COMPLETED')
            RETURNING id;
            """,
            (owner["id"], prompt, genre, mood, tempo, 0.7, key_signature, duration),
        )
        generation_request_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO tracks (
                generation_request_id, title, audio_url, duration_seconds, status,
                user_id, prompt, artist, album, release_date, source, external_id,
                external_url, genre, mood, tempo, ai_temperature, key_signature,
                is_public
            )
            VALUES (
                %s, %s, %s, %s, 'COMPLETED',
                %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s
            )
            RETURNING id, user_id;
            """,
            (
                generation_request_id,
                f"Piesa Demo {index:03d}",
                f"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-{(index % 16) + 1}.mp3",
                duration,
                owner["id"],
                prompt,
                f"Artist Demo {(index % 30) + 1}",
                "Colectia Demo BeatsLuv",
                f"2026-{((index - 1) % 12) + 1:02d}-{((index - 1) % 28) + 1:02d}",
                SEED_SOURCE,
                f"seed-track-{index:03d}",
                "https://www.soundhelix.com/audio-examples",
                genre,
                mood,
                tempo,
                0.7,
                key_signature,
                index % 3 != 0,
            ),
        )
        track = cur.fetchone()
        tracks.append(track)

        cur.execute(
            """
            INSERT INTO prompt_versions (
                user_id, track_id, parent_track_id, version_number, prompt,
                genre, mood, tempo, duration_seconds, ai_temperature,
                key_signature, predicted_rating
            )
            VALUES (%s, %s, NULL, 1, %s, %s, %s, %s, %s, %s, %s, %s);
            """,
            (owner["id"], track["id"], prompt, genre, mood, tempo, duration, 0.7, key_signature, 3.5 + (index % 15) / 10),
        )

    return tracks


def create_feedback(cur, users, tracks, feedback_count):
    for index in range(1, feedback_count + 1):
        user = random.choice(users)
        track = random.choice(tracks)
        if user["id"] == track["user_id"]:
            user = users[(users.index(user) + 1) % len(users)]

        rating = random.randint(3, 5)
        cur.execute(
            """
            INSERT INTO feedback (
                track_id, user_id, rating, melody_rating, originality_rating,
                emotional_impact_rating, commercial_potential_rating,
                production_quality_rating, comment, liked, downloaded,
                shared, listen_count, sentiment_score
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """,
            (
                track["id"],
                user["id"],
                rating,
                random.randint(3, 5),
                random.randint(3, 5),
                random.randint(3, 5),
                random.randint(2, 5),
                random.randint(3, 5),
                f"[{SEED_SOURCE}] {random.choice(COMMENTS)}",
                rating >= 4,
                random.random() < 0.2,
                random.random() < 0.12,
                random.randint(1, 80),
                round(random.uniform(0.35, 0.98), 2),
            ),
        )


def create_playlists(cur, users, tracks, playlists_count):
    for index in range(1, playlists_count + 1):
        owner = users[(index * 3) % len(users)]
        cur.execute(
            """
            INSERT INTO playlists (user_id, name, description, is_public)
            VALUES (%s, %s, %s, %s)
            RETURNING id;
            """,
            (
                owner["id"],
                f"Playlist Demo {index:03d}",
                f"[{SEED_SOURCE}] Playlist generat pentru datele de prezentare.",
                index % 4 != 0,
            ),
        )
        playlist_id = cur.fetchone()["id"]

        playlist_tracks = random.sample(tracks, k=min(8, len(tracks)))
        for position, track in enumerate(playlist_tracks, start=1):
            cur.execute(
                """
                INSERT INTO playlist_tracks (playlist_id, track_id, position)
                VALUES (%s, %s, %s)
                ON CONFLICT (playlist_id, track_id) DO NOTHING;
                """,
                (playlist_id, track["id"], position),
            )


def main():
    args = parse_args()
    random.seed(args.seed)

    password_hash = get_password_hash(args.password)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cleanup_seed_data(cur)
            admin, users = upsert_users(cur, args.users, password_hash)
            tracks = create_tracks(cur, users, args.tracks)
            create_feedback(cur, users, tracks, args.feedback)
            create_playlists(cur, users, tracks, args.playlists)
        conn.commit()

    print("Datele demo au fost adaugate cu succes.")
    print(f"Admin: {admin['email']} / {args.password}")
    print(f"Utilizatori: user001@gmail.com .. user{args.users:03d}@gmail.com / {args.password}")
    print(f"Piese: {args.tracks}")
    print(f"Feedback-uri: {args.feedback}")
    print(f"Playlist-uri: {args.playlists}")


if __name__ == "__main__":
    main()
