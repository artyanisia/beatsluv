#!/usr/bin/env python3
"""Create deterministic demo feedback so analytics and ML have training data."""

from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.database import get_connection  # noqa: E402


def parse_args():
    parser = argparse.ArgumentParser(description="Seed demo feedback ratings for existing tracks.")
    parser.add_argument("--per-track", type=int, default=3, help="Feedback rows per track.")
    parser.add_argument("--user-email", default="seed@beatsluv.local")
    return parser.parse_args()


def ensure_seed_user(conn, email):
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM users WHERE email = %s;", (email,))
        row = cur.fetchone()
        if row:
            return row["id"]
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


def rating_for(track, index):
    seed = int(hashlib.sha256(f"{track['id']}:{index}".encode("utf-8")).hexdigest()[:8], 16)
    score = 3.0
    if track["genre"] in {"pop", "rock", "electronic"}:
        score += 0.45
    if track["mood"] in {"happy", "energetic", "upbeat", "party"}:
        score += 0.35
    if track["tempo"] and 90 <= track["tempo"] <= 145:
        score += 0.25
    if track["ai_temperature"] is not None:
        temp = float(track["ai_temperature"])
        score += 0.35 - abs(temp - 0.65)
    score += ((seed % 100) / 100 - 0.5) * 0.9
    return max(1, min(5, round(score)))


def main():
    args = parse_args()
    per_track = max(1, args.per_track)
    with get_connection() as conn:
        user_id = ensure_seed_user(conn, args.user_email)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, genre, mood, tempo, ai_temperature
                FROM tracks
                WHERE audio_url IS NOT NULL;
                """
            )
            tracks = cur.fetchall()
            inserted = 0
            for track in tracks:
                cur.execute("SELECT COUNT(*) AS count FROM feedback WHERE track_id = %s;", (track["id"],))
                existing = cur.fetchone()["count"]
                for index in range(existing, per_track):
                    rating = rating_for(track, index)
                    liked = rating >= 4
                    downloaded = rating >= 5
                    listen_count = rating + (index % 4)
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
                            sentiment_score
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
                        """,
                        (
                            track["id"],
                            user_id,
                            rating,
                            "Demo analytics feedback",
                            liked,
                            downloaded,
                            rating >= 4 and index % 2 == 0,
                            listen_count,
                            round((rating - 3) / 2, 2),
                        ),
                    )
                    inserted += 1
            conn.commit()
    print(f"Inserted {inserted} feedback rows.")


if __name__ == "__main__":
    main()
