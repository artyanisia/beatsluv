import logging
import math
import os
import struct
import time
import wave
from pathlib import Path
from uuid import uuid4

import httpx
from dotenv import load_dotenv


load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
GENERATED_AUDIO_DIR = PROJECT_ROOT / "generated_audio"
DEFAULT_GENERATION_PROVIDER = "demo"
MAX_DEMO_DURATION_SECONDS = 30
SAMPLE_RATE = 44100


class MusicGeneratorService:
    def generate_track(self, prompt, genre=None, mood=None, tempo=None, duration_seconds=30):
        """
        Generate a track using the configured provider.

        The "replicate" provider uses a real MusicGen cloud model. The "demo"
        provider creates a local WAV without heavy ML dependencies so the app
        can still run when no AI API key is configured.
        """
        logger.info("=== STARTING MUSIC GENERATION ===")
        logger.info("Prompt: %s", prompt)
        logger.info("Genre: %s, Mood: %s, Tempo: %s, Duration: %ss", genre, mood, tempo, duration_seconds)

        provider = os.getenv("MUSIC_GENERATION_PROVIDER", DEFAULT_GENERATION_PROVIDER).lower()
        logger.info("Using provider: %s", provider)

        try:
            if provider == "replicate":
                return self._generate_with_replicate(
                    prompt=prompt,
                    genre=genre,
                    mood=mood,
                    tempo=tempo,
                    duration_seconds=duration_seconds,
                )

            if provider == "huggingface":
                return self._generate_with_huggingface(
                    prompt=prompt,
                    genre=genre,
                    mood=mood,
                    tempo=tempo,
                    duration_seconds=duration_seconds,
                )

            return self._generate_demo_track(
                prompt=prompt,
                genre=genre,
                mood=mood,
                tempo=tempo,
                duration_seconds=duration_seconds,
            )
        except Exception:
            logger.exception("Music generation failed. Falling back to local demo WAV.")
            return self._generate_demo_track(
                prompt=prompt,
                genre=genre,
                mood=mood,
                tempo=tempo,
                duration_seconds=duration_seconds,
                is_fallback=True,
            )

    def _generate_with_replicate(self, prompt, genre=None, mood=None, tempo=None, duration_seconds=30):
        api_token = os.getenv("REPLICATE_API_TOKEN")
        if not api_token or api_token == "your_replicate_token_here":
            raise RuntimeError("REPLICATE_API_TOKEN is not set.")

        duration = self._clamp_duration(duration_seconds)
        full_prompt = self._build_prompt(prompt=prompt, genre=genre, mood=mood, tempo=tempo)
        model_version = os.getenv("REPLICATE_MUSICGEN_MODEL_VERSION", "stereo-melody-large")

        logger.info("Sending Replicate MusicGen request")
        prediction = httpx.post(
            "https://api.replicate.com/v1/models/meta/musicgen/predictions",
            headers={
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json",
                "Prefer": "wait=60",
            },
            json={
                "input": {
                    "prompt": full_prompt,
                    "duration": duration,
                    "model_version": model_version,
                    "output_format": "wav",
                }
            },
            timeout=90,
        )
        logger.info("Replicate response status: %s", prediction.status_code)
        prediction.raise_for_status()
        prediction_data = prediction.json()

        prediction_data = self._wait_for_replicate_prediction(prediction_data, api_token)
        if prediction_data.get("status") != "succeeded":
            raise RuntimeError(f"Replicate generation failed: {prediction_data.get('error')}")

        output_url = prediction_data.get("output")
        if isinstance(output_url, list):
            output_url = output_url[0] if output_url else None

        if not output_url:
            raise RuntimeError("Replicate did not return an audio URL.")

        audio_response = httpx.get(
            output_url,
            headers={"Authorization": f"Bearer {api_token}"},
            timeout=120,
        )
        audio_response.raise_for_status()

        GENERATED_AUDIO_DIR.mkdir(exist_ok=True)
        file_name = f"generated_{uuid4().hex}.wav"
        file_path = GENERATED_AUDIO_DIR / file_name
        file_path.write_bytes(audio_response.content)

        logger.info("Saved Replicate MusicGen output: %s", file_path)
        return {
            "title": self._build_title(genre=genre, mood=mood),
            "audio_url": f"/generated-audio/{file_name}",
            "duration_seconds": duration,
            "predicted_success_score": None,
            "is_mock": False,
        }

    def _wait_for_replicate_prediction(self, prediction_data, api_token):
        terminal_statuses = {"succeeded", "failed", "canceled"}
        status = prediction_data.get("status")
        get_url = prediction_data.get("urls", {}).get("get")
        deadline = time.monotonic() + 240

        while status not in terminal_statuses and get_url and time.monotonic() < deadline:
            time.sleep(3)
            response = httpx.get(
                get_url,
                headers={"Authorization": f"Bearer {api_token}"},
                timeout=30,
            )
            response.raise_for_status()
            prediction_data = response.json()
            status = prediction_data.get("status")
            logger.info("Replicate prediction status: %s", status)

        return prediction_data

    def _generate_with_huggingface(self, prompt, genre=None, mood=None, tempo=None, duration_seconds=30):
        api_token = os.getenv("HUGGINGFACE_API_TOKEN") or os.getenv("HF_TOKEN")
        if not api_token or api_token == "your_huggingface_token_here":
            raise RuntimeError("HUGGINGFACE_API_TOKEN is not set.")

        model_id = os.getenv("HUGGINGFACE_MODEL_ID", "facebook/musicgen-small")
        endpoint_url = os.getenv("HUGGINGFACE_ENDPOINT_URL")
        url = endpoint_url or f"https://api-inference.huggingface.co/models/{model_id}"

        full_prompt = self._build_prompt(prompt=prompt, genre=genre, mood=mood, tempo=tempo)
        logger.info("Sending Hugging Face request to %s", url)

        response = httpx.post(
            url,
            headers={
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json",
                "Accept": "audio/wav",
            },
            json={
                "inputs": full_prompt,
                "parameters": {
                    "do_sample": True,
                    "max_new_tokens": max(50, int(duration_seconds) * 50),
                },
                "options": {
                    "wait_for_model": True,
                },
            },
            timeout=180,
        )
        logger.info("Hugging Face response status: %s", response.status_code)
        response.raise_for_status()

        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            raise RuntimeError(f"Hugging Face returned JSON instead of audio: {response.text}")

        GENERATED_AUDIO_DIR.mkdir(exist_ok=True)
        file_extension = self._get_audio_extension(content_type)
        file_name = f"generated_{uuid4().hex}{file_extension}"
        file_path = GENERATED_AUDIO_DIR / file_name
        file_path.write_bytes(response.content)

        return {
            "title": self._build_title(genre=genre, mood=mood),
            "audio_url": f"/generated-audio/{file_name}",
            "duration_seconds": duration_seconds,
            "predicted_success_score": None,
            "is_mock": False,
        }

    def _generate_demo_track(self, prompt, genre=None, mood=None, tempo=None, duration_seconds=30, is_fallback=False):
        duration = self._clamp_duration(duration_seconds)
        bpm = self._safe_tempo(tempo)
        root_frequency = self._choose_root_frequency(prompt=prompt, genre=genre, mood=mood)

        GENERATED_AUDIO_DIR.mkdir(exist_ok=True)
        file_name = f"generated_{uuid4().hex}.wav"
        file_path = GENERATED_AUDIO_DIR / file_name

        beat_interval = 60.0 / bpm
        total_samples = duration * SAMPLE_RATE
        chord = [root_frequency, root_frequency * 1.25, root_frequency * 1.5]

        with wave.open(str(file_path), "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(SAMPLE_RATE)

            for sample_index in range(total_samples):
                t = sample_index / SAMPLE_RATE
                beat_phase = t % beat_interval
                beat = math.exp(-beat_phase * 28.0) * math.sin(2 * math.pi * 80 * t)

                pad = 0.0
                for freq in chord:
                    pad += math.sin(2 * math.pi * freq * t) * 0.10

                melody_freq = root_frequency * (2 if int(t / beat_interval) % 4 in (0, 3) else 1.5)
                melody = math.sin(2 * math.pi * melody_freq * t) * 0.08

                fade_in = min(1.0, t / 0.4)
                fade_out = min(1.0, (duration - t) / 0.7)
                envelope = max(0.0, min(fade_in, fade_out))
                sample = (beat * 0.45 + pad + melody) * envelope
                sample = max(-1.0, min(1.0, sample))
                wav_file.writeframes(struct.pack("<h", int(sample * 32767)))

        logger.info("Generated local demo WAV: %s", file_path)
        return {
            "title": self._build_title(genre=genre, mood=mood),
            "audio_url": f"/generated-audio/{file_name}",
            "duration_seconds": duration,
            "predicted_success_score": 0.6 if is_fallback else 0.75,
            "is_mock": is_fallback,
        }

    def _safe_tempo(self, tempo):
        try:
            bpm = int(tempo)
        except (TypeError, ValueError):
            bpm = 100

        return max(60, min(bpm, 180))

    def _clamp_duration(self, duration_seconds):
        try:
            duration = int(duration_seconds)
        except (TypeError, ValueError):
            duration = 10

        return max(1, min(duration, MAX_DEMO_DURATION_SECONDS))

    def _choose_root_frequency(self, prompt, genre=None, mood=None):
        text = " ".join(part for part in [prompt, genre, mood] if part).lower()

        if "dark" in text or "sad" in text or "melanch" in text:
            return 196.00

        if "dream" in text or "soft" in text or "ambient" in text:
            return 261.63

        if "dance" in text or "pop" in text or "happy" in text:
            return 293.66

        return 220.00

    def _get_audio_extension(self, content_type):
        if "mpeg" in content_type or "mp3" in content_type:
            return ".mp3"

        return ".wav"

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
