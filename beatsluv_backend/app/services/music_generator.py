import base64
import logging
import math
import os
import wave
from pathlib import Path
from uuid import uuid4

import httpx
from dotenv import load_dotenv


load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT
GENERATED_AUDIO_DIR = PROJECT_ROOT / "generated_audio"

load_dotenv(BACKEND_ROOT / ".env", encoding="utf-8-sig")

DEFAULT_STABILITY_API_URL = "https://api.stability.ai"
DEFAULT_STABILITY_AUDIO_ENDPOINT = "/v2beta/audio/stable-audio-2/text-to-audio"
DEFAULT_STABILITY_AUDIO_MODEL = "stable-audio-2"
MIN_DURATION_SECONDS = 10
MAX_DURATION_SECONDS = 600


class MusicGenerationError(RuntimeError):
    pass


class MusicGeneratorService:
    def generate_track(self, prompt, genre=None, mood=None, tempo=None, duration_seconds=30):
        provider = os.getenv("MUSIC_PROVIDER", "stability").strip().lower()
        logger.info("Music provider selected: %s", provider)
        try:
            if provider == "stability":
                return self._stability_generate_track(prompt, genre, mood, tempo, duration_seconds)
            if provider == "demo":
                return self._demo_generate_track(prompt, genre, mood, tempo, duration_seconds)

            raise MusicGenerationError(f"Unknown music provider: {provider}")
        except MusicGenerationError as exc:
            if os.getenv("BEATSLUV_DEMO_AUDIO_FALLBACK", "true").lower() not in {"1", "true", "yes"}:
                raise

            logger.warning("%s provider unavailable. Falling back to local demo audio. Reason: %s", provider, exc)
            return self._demo_generate_track(prompt, genre, mood, tempo, duration_seconds)

    def _stability_generate_track(self, prompt, genre=None, mood=None, tempo=None, duration_seconds=30):
        logger.info("=== STARTING STABILITY AUDIO GENERATION ===")
        logger.info("Prompt: %s", prompt)
        logger.info("Genre: %s, Mood: %s, Tempo: %s, Duration: %ss", genre, mood, tempo, duration_seconds)

        api_key = os.getenv("STABILITY_API_KEY")
        if not api_key:
            raise MusicGenerationError("STABILITY_API_KEY is not set.")

        duration = self._clamp_stability_duration(duration_seconds)
        output_format = os.getenv("STABILITY_AUDIO_FORMAT", "mp3").lower()
        full_prompt = self._build_prompt(prompt=prompt, genre=genre, mood=mood, tempo=tempo)
        base_url = os.getenv("STABILITY_API_URL", DEFAULT_STABILITY_API_URL).rstrip("/")
        endpoint = os.getenv("STABILITY_AUDIO_ENDPOINT", DEFAULT_STABILITY_AUDIO_ENDPOINT)
        request_url = f"{base_url}{endpoint}"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
        }
        files = {
            "prompt": (None, full_prompt),
            "duration": (None, str(duration)),
            "cfg_scale": (None, os.getenv("STABILITY_CFG_SCALE", "7")),
            "steps": (None, os.getenv("STABILITY_STEPS", "30")),
            "output_format": (None, output_format),
        }

        seed = os.getenv("STABILITY_SEED")
        if seed:
            files["seed"] = (None, seed)

        try:
            with httpx.Client(timeout=httpx.Timeout(connect=20.0, read=900.0, write=60.0, pool=20.0)) as client:
                response = client.post(request_url, headers=headers, files=files)
                if response.status_code >= 400:
                    raise MusicGenerationError(
                        f"Stability API returned {response.status_code}: {self._safe_error_message(response)}"
                    )
                audio_url = self._save_stability_audio(response, output_format)
        except httpx.HTTPError as exc:
            raise MusicGenerationError(f"Stability API request failed: {exc}") from exc

        return {
            "title": f"Stable Audio {self._build_title(genre=genre, mood=mood)}",
            "audio_url": audio_url,
            "duration_seconds": duration,
        }

    def _safe_tempo(self, tempo):
        try:
            bpm = int(tempo)
        except (TypeError, ValueError):
            bpm = 100

        return max(30, min(bpm, 300))

    def _clamp_duration(self, duration_seconds):
        try:
            duration = int(duration_seconds)
        except (TypeError, ValueError):
            duration = 30

        return max(MIN_DURATION_SECONDS, min(duration, MAX_DURATION_SECONDS))

    def _get_audio_extension(self, content_type="", source=""):
        source_suffix = Path(source.split("?", 1)[0]).suffix.lower()
        if source_suffix in {".mp3", ".wav", ".flac", ".opus", ".aac", ".ogg"}:
            return source_suffix

        if "flac" in content_type:
            return ".flac"
        if "mpeg" in content_type or "mp3" in content_type:
            return ".mp3"
        if "aac" in content_type:
            return ".aac"
        if "opus" in content_type or "ogg" in content_type:
            return ".opus"

        return ".wav"

    def _save_stability_audio(self, response, output_format):
        GENERATED_AUDIO_DIR.mkdir(exist_ok=True)
        content_type = response.headers.get("content-type", "")
        payload = response.content

        if "application/json" in content_type:
            data = response.json()
            encoded_audio = data.get("audio")
            if not encoded_audio:
                raise MusicGenerationError("Stability API response did not include an audio field.")
            payload = base64.b64decode(encoded_audio)
            file_extension = f".{output_format}"
        else:
            file_extension = self._get_audio_extension(content_type=content_type, source=f"audio.{output_format}")

        file_name = f"stability_{uuid4().hex}{file_extension}"
        file_path = GENERATED_AUDIO_DIR / file_name
        file_path.write_bytes(payload)
        logger.info("Saved Stability Audio output: %s", file_path)
        return f"/generated-audio/{file_name}"

    def _safe_error_message(self, response):
        try:
            data = response.json()
            return data.get("message") or data.get("error") or data.get("errors") or response.text[:500]
        except ValueError:
            return response.text[:500]

    def _clamp_stability_duration(self, duration_seconds):
        try:
            duration = int(duration_seconds)
        except (TypeError, ValueError):
            duration = 30

        max_duration = int(os.getenv("STABILITY_MAX_DURATION_SECONDS", "190"))
        min_duration = int(os.getenv("STABILITY_MIN_DURATION_SECONDS", "1"))
        return max(min_duration, min(duration, max_duration))

    def _build_prompt(self, prompt, genre=None, mood=None, tempo=None):
        prompt_parts = [prompt]

        if genre:
            prompt_parts.append(f"Genre: {genre}.")
        if mood:
            prompt_parts.append(f"Mood: {mood}.")
        if tempo:
            prompt_parts.append(f"Tempo: around {tempo} BPM.")

        return " ".join(prompt_parts)

    def _build_title(self, genre=None, mood=None):
        if genre and mood:
            return f"{mood.title()} {genre.title()} Track"
        if genre:
            return f"{genre.title()} Track"
        return "Generated Track"

    def _demo_generate_track(self, prompt, genre=None, mood=None, tempo=None, duration_seconds=30):
        logger.info("Generating local demo audio.")
        duration = min(self._clamp_duration(duration_seconds), 45)
        tempo_bpm = self._safe_tempo(tempo or 100)
        file_name = f"demo_{uuid4().hex}.wav"
        file_path = GENERATED_AUDIO_DIR / file_name

        GENERATED_AUDIO_DIR.mkdir(exist_ok=True)
        self._write_demo_wav(file_path, duration, tempo_bpm, genre, mood)

        return {
            "title": f"Demo {self._build_title(genre=genre, mood=mood)}",
            "audio_url": f"/generated-audio/{file_name}",
            "duration_seconds": duration,
        }

    def _write_demo_wav(self, file_path, duration_seconds, tempo, genre=None, mood=None):
        sample_rate = 44100
        total_samples = int(sample_rate * duration_seconds)
        beat_interval = max(1, int(sample_rate * 60 / tempo))
        root_frequency = self._root_frequency(genre, mood)
        chord = [root_frequency, root_frequency * 1.25, root_frequency * 1.5]

        with wave.open(str(file_path), "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)

            frames = bytearray()
            for index in range(total_samples):
                t = index / sample_rate
                beat_phase = index % beat_interval
                beat_env = max(0.0, 1.0 - beat_phase / (beat_interval * 0.16)) if beat_phase < beat_interval * 0.16 else 0

                pad = sum(math.sin(2 * math.pi * freq * t) for freq in chord) / len(chord)
                melody = math.sin(2 * math.pi * (root_frequency * (2 if int(t * 2) % 4 else 1.5)) * t)
                kick = math.sin(2 * math.pi * 58 * t) * beat_env
                amplitude = 0.22 * pad + 0.12 * melody + 0.5 * kick
                sample = int(max(-1.0, min(1.0, amplitude)) * 32767)
                frames.extend(sample.to_bytes(2, byteorder="little", signed=True))

            wav_file.writeframes(bytes(frames))

    def _root_frequency(self, genre=None, mood=None):
        text = f"{genre or ''} {mood or ''}".lower()
        if "sad" in text or "dark" in text:
            return 220.0
        if "dream" in text or "chill" in text:
            return 261.63
        if "rock" in text:
            return 196.0
        if "elect" in text or "dance" in text:
            return 130.81
        return 246.94
