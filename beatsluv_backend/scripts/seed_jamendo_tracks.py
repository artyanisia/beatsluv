#!/usr/bin/env python3
"""Seed BeatsLuv with Jamendo tracks that include playable audio URLs."""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.database import get_connection  # noqa: E402
from app.services.jamendo_importer import JamendoImporter, JamendoImportError  # noqa: E402


DEFAULT_TAGS = ["rock", "pop", "jazz", "hiphop", "electronic", "classical", "metal", "folk", "dance"]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Import Jamendo tracks with real playable audio URLs into BeatsLuv.",
    )
    parser.add_argument("--count", type=int, default=300, help="Number of tracks to insert.")
    parser.add_argument("--limit-per-tag", type=int, default=50, help="Jamendo page size.")
    parser.add_argument("--request-delay", type=float, default=0.25, help="Delay between Jamendo API calls.")
    parser.add_argument("--user-email", default="seed@beatsluv.local")
    parser.add_argument("--tag", action="append", default=[], help="Extra Jamendo tag, for example --tag reggae.")
    parser.add_argument("--dry-run", action="store_true")
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


def fetch_existing_jamendo_ids(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT external_id
            FROM tracks
            WHERE source = 'Jamendo' AND external_id IS NOT NULL;
            """
        )
        return {row["external_id"] for row in cur.fetchall()}


def insert_jamendo_track(conn, user_id: int, track):
    prompt = build_generated_prompt(track)

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
                "COMPLETED",
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
                track.audio_url,
                track.duration_seconds,
                "COMPLETED",
                user_id,
                prompt,
                track.artist,
                track.album,
                track.release_date,
                "Jamendo",
                track.external_id,
                track.external_url,
                track.genre,
                track.mood,
                track.tempo,
            ),
        )
        return cur.fetchone()["id"]


def build_generated_prompt(track):
    parts = ["Create"]
    if track.mood:
        parts.append(f"a {track.mood}")
    else:
        parts.append("a")
    if track.genre:
        parts.append(f"{track.genre} track")
    else:
        parts.append("music track")
    if track.tempo:
        parts.append(f"around {track.tempo} BPM")
    parts.append(f"for {track.duration_seconds} seconds")
    return " ".join(parts)


def main():
    args = parse_args()
    target_count = max(1, args.count)
    page_size = max(1, min(args.limit_per_tag, 200))
    tags = DEFAULT_TAGS + [tag.strip() for tag in args.tag if tag.strip()]
    importer = JamendoImporter()

    inserted = 0
    fetched = 0
    existing_ids = set()
    conn = None
    user_id = None

    if not args.dry_run:
        conn = get_connection()
        ensure_track_columns(conn)
        user_id = ensure_seed_user(conn, args.user_email)
        existing_ids = fetch_existing_jamendo_ids(conn)

    offsets = {tag: 0 for tag in tags}
    tag_index = 0
    empty_rounds = 0

    try:
        while inserted < target_count and empty_rounds < len(tags) * 3:
            tag = tags[tag_index % len(tags)]
            offset = offsets[tag]
            tag_index += 1

            print(f"Fetching Jamendo tag='{tag}' offset={offset}")
            try:
                tracks = importer.search_tracks(tag=tag, limit=page_size, offset=offset)
            except JamendoImportError as exc:
                print(f"Skipped tag '{tag}': {exc}")
                tracks = []

            offsets[tag] = offset + page_size
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
                    insert_jamendo_track(conn, user_id, track)
                    inserted += 1

                if inserted >= target_count:
                    break

            if conn is not None:
                conn.commit()

            empty_rounds = empty_rounds + 1 if new_in_this_page == 0 else 0
            print(f"Progress: {inserted}/{target_count} tracks ready")

            if inserted < target_count:
                time.sleep(max(0.0, args.request_delay))
    finally:
        if conn is not None:
            conn.close()

    mode = "would insert" if args.dry_run else "inserted"
    print(f"Done: {mode} {inserted} tracks from {fetched} fetched Jamendo tracks.")


if __name__ == "__main__":
    main()
