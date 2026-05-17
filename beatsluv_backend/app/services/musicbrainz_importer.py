import hashlib
import math
import os
import struct
import wave
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4

import httpx
from dotenv import load_dotenv


load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parents[2]
GENERATED_AUDIO_DIR = PROJECT_ROOT / "generated_audio"

DEFAULT_MUSICBRAINZ_API_URL = "https://musicbrainz.org/ws/2"
DEFAULT_MUSICBRAINZ_USER_AGENT = "BeatsLuv/1.0 (local-development)"
DEFAULT_PREVIEW_SECONDS = 10


class MusicBrainzImportError(RuntimeError):
    pass


@dataclass
class MusicBrainzTrack:
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
    audio_url: str | None


class MusicBrainzImporter:
    def search_tracks(
        self,
        query: str,
        limit: int = 10,
        genre: str | None = None,
        offset: int = 0,
        create_audio_preview: bool = True,
    ):
        clean_query = (query or "").strip()
        if not clean_query:
            raise MusicBrainzImportError("MusicBrainz query cannot be empty.")

        safe_limit = max(1, min(int(limit or 10), 50))
        safe_offset = max(0, int(offset or 0))
        payload = self._search_recordings(query=clean_query, limit=safe_limit, offset=safe_offset)
        recordings = payload.get("recordings") or []

        tracks = []
        seen_ids = set()
        for recording in recordings:
            recording_id = recording.get("id")
            title = (recording.get("title") or "").strip()
            if not recording_id or not title or recording_id in seen_ids:
                continue

            seen_ids.add(recording_id)
            artist = self._extract_artist(recording)
            release = self._extract_release(recording)
            duration_seconds = self._extract_duration_seconds(recording)
            track_genre = genre or self._extract_tag(recording)
            tempo = self._infer_tempo(recording_id=recording_id, genre=track_genre)
            mood = self._infer_mood(recording_id=recording_id, genre=track_genre)
            if create_audio_preview:
                audio_url = self._write_fake_preview(
                    title=title,
                    artist=artist or "Unknown Artist",
                    seconds=self._preview_seconds(),
                )
            else:
                audio_url = None

            tracks.append(
                MusicBrainzTrack(
                    title=title,
                    artist=artist,
                    album=release.get("album"),
                    release_date=release.get("release_date"),
                    duration_seconds=duration_seconds,
                    genre=track_genre,
                    mood=mood,
                    tempo=tempo,
                    external_id=recording_id,
                    external_url=f"https://musicbrainz.org/recording/{recording_id}",
                    audio_url=audio_url,
                )
            )

        if not tracks:
            raise MusicBrainzImportError("MusicBrainz did not return usable recordings.")

        return tracks

    def _search_recordings(self, query: str, limit: int, offset: int = 0):
        base_url = os.getenv("MUSICBRAINZ_API_URL", DEFAULT_MUSICBRAINZ_API_URL).rstrip("/")
        user_agent = os.getenv("MUSICBRAINZ_USER_AGENT", DEFAULT_MUSICBRAINZ_USER_AGENT)

        headers = {
            "Accept": "application/json",
            "User-Agent": user_agent,
        }
        params = {
            "query": query,
            "limit": limit,
            "offset": offset,
            "inc": "artist-credits+releases+tags",
            "fmt": "json",
        }

        try:
            with httpx.Client(timeout=httpx.Timeout(20.0)) as client:
                response = client.get(f"{base_url}/recording", headers=headers, params=params)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 503:
                raise MusicBrainzImportError(
                    "MusicBrainz rate-limited the request. Try again in a few seconds."
                ) from exc
            raise MusicBrainzImportError(f"MusicBrainz request failed: {exc}") from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise MusicBrainzImportError(f"MusicBrainz request failed: {exc}") from exc

    def _extract_artist(self, recording):
        artist_credit = recording.get("artist-credit") or []
        names = []
        for credit in artist_credit:
            artist = credit.get("artist") or {}
            name = artist.get("name") or credit.get("name")
            if name:
                names.append(name)
        return ", ".join(names) if names else None

    def _extract_release(self, recording):
        releases = recording.get("releases") or []
        if not releases:
            return {"album": None, "release_date": None}

        release = releases[0]
        return {
            "album": release.get("title"),
            "release_date": release.get("date"),
        }

    def _extract_duration_seconds(self, recording):
        try:
            milliseconds = int(recording.get("length") or 0)
        except (TypeError, ValueError):
            milliseconds = 0

        if milliseconds > 0:
            return max(1, round(milliseconds / 1000))

        return self._preview_seconds()

    def _extract_tag(self, recording):
        tags = recording.get("tags") or []
        if not tags:
            return None
        return tags[0].get("name")

    def _infer_tempo(self, recording_id: str, genre: str | None):
        normalized_genre = (genre or "").lower()
        tempo_ranges = {
            "classical": (60, 118),
            "ambient": (60, 105),
            "jazz": (80, 150),
            "hip-hop": (75, 115),
            "hip hop": (75, 115),
            "r&b": (70, 115),
            "country": (85, 140),
            "folk": (75, 130),
            "pop": (95, 135),
            "rock": (105, 165),
            "metal": (120, 190),
            "electronic": (115, 150),
            "dance": (118, 140),
        }
        low, high = tempo_ranges.get(normalized_genre, (75, 160))
        seed = int(hashlib.sha256(recording_id.encode("utf-8")).hexdigest()[:8], 16)
        return low + (seed % (high - low + 1))

    def _infer_mood(self, recording_id: str, genre: str | None):
        normalized_genre = (genre or "").lower()
        mood_choices = {
            "classical": ["calm", "dramatic", "focused", "melancholic"],
            "ambient": ["calm", "dreamy", "relaxed", "atmospheric"],
            "jazz": ["smooth", "relaxed", "sophisticated", "upbeat"],
            "hip-hop": ["confident", "energetic", "dark", "upbeat"],
            "hip hop": ["confident", "energetic", "dark", "upbeat"],
            "r&b": ["romantic", "smooth", "sad", "chill"],
            "country": ["nostalgic", "warm", "upbeat", "sad"],
            "folk": ["warm", "calm", "nostalgic", "hopeful"],
            "pop": ["happy", "upbeat", "dreamy", "romantic"],
            "rock": ["energetic", "angry", "upset", "anthemic"],
            "metal": ["aggressive", "dark", "intense", "angry"],
            "electronic": ["energetic", "focused", "party", "dreamy"],
            "dance": ["party", "energetic", "happy", "upbeat"],
        }
        choices = mood_choices.get(normalized_genre, ["upbeat", "calm", "sad", "energetic"])
        seed = int(hashlib.sha256(recording_id.encode("utf-8")).hexdigest()[:8], 16)
        return choices[seed % len(choices)]

    def _preview_seconds(self):
        try:
            seconds = int(os.getenv("MUSICBRAINZ_FAKE_PREVIEW_SECONDS", DEFAULT_PREVIEW_SECONDS))
        except (TypeError, ValueError):
            seconds = DEFAULT_PREVIEW_SECONDS
        return max(2, min(seconds, 20))

    def _write_fake_preview(self, title: str, artist: str, seconds: int):
        GENERATED_AUDIO_DIR.mkdir(exist_ok=True)

        seed = hashlib.sha256(f"{artist}:{title}".encode("utf-8")).digest()
        base_frequency = 180 + seed[0]
        harmony_frequency = base_frequency * (1.25 + (seed[1] % 5) / 20)
        file_name = f"musicbrainz_{uuid4().hex}.wav"
        file_path = GENERATED_AUDIO_DIR / file_name

        sample_rate = 22050
        amplitude = 0.22
        fade_samples = int(sample_rate * 0.15)
        total_samples = sample_rate * seconds

        with wave.open(str(file_path), "w") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)

            for index in range(total_samples):
                envelope = self._envelope(index, total_samples, fade_samples)
                beat_gate = 0.65 + 0.35 * ((index // (sample_rate // 2)) % 2)
                sample = (
                    math.sin(2 * math.pi * base_frequency * index / sample_rate)
                    + 0.45 * math.sin(2 * math.pi * harmony_frequency * index / sample_rate)
                )
                value = int(32767 * amplitude * envelope * beat_gate * sample)
                wav_file.writeframesraw(struct.pack("<h", value))

        return f"/generated-audio/{quote(file_name)}"

    def _envelope(self, index: int, total_samples: int, fade_samples: int):
        if fade_samples <= 0:
            return 1.0
        if index < fade_samples:
            return index / fade_samples
        if index > total_samples - fade_samples:
            return max(0.0, (total_samples - index) / fade_samples)
        return 1.0
