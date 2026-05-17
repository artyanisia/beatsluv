#!/usr/bin/env python3
"""Seed BeatsLuv with real MusicBrainz metadata for analytics demos."""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.database import get_connection  # noqa: E402
from app.services.musicbrainz_importer import MusicBrainzImporter, MusicBrainzImportError  # noqa: E402


DEFAULT_QUERIES = [
    ("rock", "rock"),
    ("pop", "pop"),
    ("jazz", "jazz"),
    ("hip hop", "hip-hop"),
    ("electronic", "electronic"),
    ("classical", "classical"),
    ("metal", "metal"),
    ("country", "country"),
    ("folk", "folk"),
    ("r&b", "r&b"),
]

def parse_args():
    parser = argparse.ArgumentParser(
        description="Import MusicBrainz recording metadata into the local BeatsLuv database.",
    )
    parser.add_argument("--count", type=int, default=500, help="Number of tracks to insert.")
    parser.add_argument(
        "--limit-per-query",
        type=int,
        default=50,
        help="MusicBrainz page size. Keep at or below 50 for predictable responses.",
    )
    parser.add_argument(
        "--request-delay",
        type=float,
        default=1.1,
        help="Delay between MusicBrainz API calls. MusicBrainz asks clients to stay at 1 req/sec.",
    )
    parser.add_argument(
        "--user-email",
        default="seed@beatsluv.local",
        help="User email used for imported generation_requests.",
    )
    parser.add_argument(
        "--query",
        action="append",
        default=[],
        help="Extra query in query=genre form, for example --query blues=blues.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Fetch metadata but do not insert rows.")
    return parser.parse_args()


def ensure_track_columns(conn):
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
            ADD COLUMN IF NOT EXISTS tempo INT;
            """
        )
        conn.commit()


def ensure_seed_user(conn, email: str):
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM users WHERE email = %s;", (email,))
        existing = cur.fetchone()
        if existing:
            return existing["id"]

        cur.execute(
            """
            INSERT INTO users (email, password_hash, role)
            VALUES (%s, %s, %s)
            RETURNING id;
            """,
            (email, "seeded-user-no-login", "USER"),
        )
        user_id = cur.fetchone()["id"]
        conn.commit()
        return user_id


def fetch_existing_musicbrainz_ids(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT external_id
            FROM tracks
            WHERE source = 'MusicBrainz' AND external_id IS NOT NULL;
            """
        )
        return {row["external_id"] for row in cur.fetchall()}


def insert_imported_track(conn, user_id: int, track):
    prompt = f"Imported MusicBrainz recording: {track.title}"
    if track.artist:
        prompt += f" by {track.artist}"
    if track.album:
        prompt += f" from {track.album}"

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO generation_requests (
                user_id,
                prompt,
                genre,
                mood,
                tempo,
                duration_seconds,
                status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (
                user_id,
                prompt,
                track.genre,
                track.mood,
                track.tempo,
                track.duration_seconds,
                "IMPORTED",
            ),
        )
        generation_request_id = cur.fetchone()["id"]

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
                tempo
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (
                generation_request_id,
                track.title,
                None,
                track.duration_seconds,
                "IMPORTED",
                user_id,
                prompt,
                track.artist,
                track.album,
                track.release_date,
                "MusicBrainz",
                track.external_id,
                track.external_url,
                track.genre,
                track.mood,
                track.tempo,
            ),
        )
        return cur.fetchone()["id"]


def parse_queries(extra_queries):
    queries = list(DEFAULT_QUERIES)
    for item in extra_queries:
        if "=" not in item:
            raise ValueError(f"Invalid --query value '{item}'. Use query=genre.")
        query, genre = item.split("=", 1)
        queries.append((query.strip(), genre.strip()))
    return queries


def main():
    args = parse_args()
    target_count = max(1, args.count)
    page_size = max(1, min(args.limit_per_query, 50))
    queries = parse_queries(args.query)
    importer = MusicBrainzImporter()

    inserted = 0
    fetched = 0
    existing_ids = set()
    conn = None
    user_id = None

    if not args.dry_run:
        conn = get_connection()
        ensure_track_columns(conn)
        user_id = ensure_seed_user(conn, args.user_email)
        existing_ids = fetch_existing_musicbrainz_ids(conn)

    offsets = {query: 0 for query, _genre in queries}
    query_index = 0
    empty_rounds = 0

    try:
        while inserted < target_count and empty_rounds < len(queries) * 3:
            query, genre = queries[query_index % len(queries)]
            offset = offsets[query]
            query_index += 1

            print(f"Fetching MusicBrainz query='{query}' genre='{genre}' offset={offset}")
            try:
                tracks = importer.search_tracks(
                    query=query,
                    limit=page_size,
                    genre=genre,
                    offset=offset,
                    create_audio_preview=False,
                )
            except MusicBrainzImportError as exc:
                print(f"Skipped query '{query}': {exc}")
                tracks = []

            offsets[query] = offset + page_size
            fetched += len(tracks)
            new_in_this_page = 0

            for track in tracks:
                if track.external_id in existing_ids:
                    continue

                existing_ids.add(track.external_id)
                new_in_this_page += 1

                if args.dry_run:
                    inserted += 1
                else:
                    insert_imported_track(conn, user_id, track)
                    inserted += 1

                if inserted >= target_count:
                    break

            if conn is not None:
                conn.commit()

            empty_rounds = empty_rounds + 1 if new_in_this_page == 0 else 0
            print(f"Progress: {inserted}/{target_count} tracks ready")

            if inserted < target_count:
                time.sleep(max(1.0, args.request_delay))
    finally:
        if conn is not None:
            conn.close()

    mode = "would insert" if args.dry_run else "inserted"
    print(f"Done: {mode} {inserted} tracks from {fetched} fetched MusicBrainz recordings.")


if __name__ == "__main__":
    main()
