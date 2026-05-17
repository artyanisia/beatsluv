import hashlib
import os
from dataclasses import dataclass

import httpx
from dotenv import load_dotenv


load_dotenv()

DEFAULT_JAMENDO_API_URL = "https://api.jamendo.com/v3.0"


class JamendoImportError(RuntimeError):
    pass


@dataclass
class JamendoTrack:
    title: str
    artist: str | None
    album: str | None
    release_date: str | None
    duration_seconds: int
    genre: str | None
    mood: str | None
    tempo: int | None
    external_id: str
    external_url: str
    audio_url: str


class JamendoImporter:
    def search_tracks(self, tag: str, limit: int = 50, offset: int = 0):
        clean_tag = (tag or "").strip()
        if not clean_tag:
            raise JamendoImportError("Jamendo tag cannot be empty.")

        client_id = os.getenv("JAMENDO_CLIENT_ID")
        if not client_id:
            raise JamendoImportError("JAMENDO_CLIENT_ID is not set in .env.")

        safe_limit = max(1, min(int(limit or 50), 200))
        safe_offset = max(0, int(offset or 0))
        payload = self._fetch_tracks(
            client_id=client_id,
            tag=clean_tag,
            limit=safe_limit,
            offset=safe_offset,
        )

        headers = payload.get("headers") or {}
        if headers.get("status") != "success":
            raise JamendoImportError(headers.get("error_message") or "Jamendo request failed.")

        tracks = []
        for item in payload.get("results") or []:
            track_id = str(item.get("id") or "").strip()
            title = (item.get("name") or "").strip()
            audio_url = (item.get("audio") or item.get("audiodownload") or "").strip()
            if not track_id or not title or not audio_url:
                continue

            musicinfo = item.get("musicinfo") or {}
            tags = (musicinfo.get("tags") or {}).get("genres") or []
            genre = tags[0] if tags else clean_tag
            duration_seconds = self._duration_seconds(item.get("duration"))

            tracks.append(
                JamendoTrack(
                    title=title,
                    artist=item.get("artist_name"),
                    album=item.get("album_name"),
                    release_date=item.get("releasedate"),
                    duration_seconds=duration_seconds,
                    genre=genre,
                    mood=self._infer_mood(track_id=track_id, genre=genre, speed=musicinfo.get("speed")),
                    tempo=self._infer_tempo(track_id=track_id, genre=genre, speed=musicinfo.get("speed")),
                    external_id=track_id,
                    external_url=item.get("shareurl") or f"https://www.jamendo.com/track/{track_id}",
                    audio_url=audio_url,
                )
            )

        if not tracks:
            raise JamendoImportError("Jamendo did not return usable tracks.")

        return tracks

    def _fetch_tracks(self, client_id: str, tag: str, limit: int, offset: int):
        base_url = os.getenv("JAMENDO_API_URL", DEFAULT_JAMENDO_API_URL).rstrip("/")
        params = {
            "client_id": client_id,
            "format": "json",
            "limit": limit,
            "offset": offset,
            "include": "musicinfo",
            "audioformat": "mp31",
            "tags": tag,
        }

        try:
            with httpx.Client(timeout=httpx.Timeout(30.0)) as client:
                response = client.get(f"{base_url}/tracks/", params=params)
                response.raise_for_status()
                return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise JamendoImportError(f"Jamendo request failed: {exc}") from exc

    def _duration_seconds(self, duration):
        try:
            seconds = int(duration or 0)
        except (TypeError, ValueError):
            seconds = 0
        return max(1, seconds)

    def _infer_tempo(self, track_id: str, genre: str | None, speed: str | None):
        speed_ranges = {
            "verylow": (55, 80),
            "low": (65, 95),
            "medium": (90, 125),
            "high": (120, 155),
            "veryhigh": (145, 190),
        }
        genre_ranges = {
            "ambient": (60, 105),
            "classical": (60, 118),
            "jazz": (80, 150),
            "hiphop": (75, 115),
            "hip-hop": (75, 115),
            "pop": (95, 135),
            "rock": (105, 165),
            "metal": (120, 190),
            "electronic": (115, 150),
            "dance": (118, 140),
        }
        normalized_speed = (speed or "").lower().replace(" ", "")
        normalized_genre = (genre or "").lower()
        low, high = speed_ranges.get(
            normalized_speed,
            genre_ranges.get(normalized_genre, (75, 160)),
        )
        seed = int(hashlib.sha256(track_id.encode("utf-8")).hexdigest()[:8], 16)
        return low + (seed % (high - low + 1))

    def _infer_mood(self, track_id: str, genre: str | None, speed: str | None):
        normalized_genre = (genre or "").lower()
        normalized_speed = (speed or "").lower().replace(" ", "")
        if normalized_speed in {"high", "veryhigh"}:
            choices = ["energetic", "party", "upbeat", "happy"]
        elif normalized_speed in {"low", "verylow"}:
            choices = ["calm", "sad", "relaxed", "dreamy"]
        else:
            choices_by_genre = {
                "ambient": ["calm", "dreamy", "relaxed", "atmospheric"],
                "classical": ["calm", "dramatic", "focused", "melancholic"],
                "jazz": ["smooth", "relaxed", "sophisticated", "upbeat"],
                "hiphop": ["confident", "energetic", "dark", "upbeat"],
                "hip-hop": ["confident", "energetic", "dark", "upbeat"],
                "pop": ["happy", "upbeat", "dreamy", "romantic"],
                "rock": ["energetic", "angry", "upset", "anthemic"],
                "metal": ["aggressive", "dark", "intense", "angry"],
                "electronic": ["energetic", "focused", "party", "dreamy"],
                "dance": ["party", "energetic", "happy", "upbeat"],
            }
            choices = choices_by_genre.get(normalized_genre, ["upbeat", "calm", "sad", "energetic"])

        seed = int(hashlib.sha256(track_id.encode("utf-8")).hexdigest()[:8], 16)
        return choices[seed % len(choices)]
