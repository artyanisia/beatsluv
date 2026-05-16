import json
import logging
import os
import time
from pathlib import Path
from urllib.parse import urljoin
from uuid import uuid4

import httpx
from dotenv import load_dotenv


load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
GENERATED_AUDIO_DIR = PROJECT_ROOT / "generated_audio"

DEFAULT_ACE_STEP_API_URL = "http://127.0.0.1:7860"
DEFAULT_ACE_STEP_MODEL = "acestep-v15-turbo"
MIN_DURATION_SECONDS = 10
MAX_DURATION_SECONDS = 600


class MusicGenerationError(RuntimeError):
    pass


class MusicGeneratorService:
    def generate_track(self, prompt, genre=None, mood=None, tempo=None, duration_seconds=30):
        logger.info("=== STARTING MUSIC GENERATION ===")
        logger.info("Prompt: %s", prompt)
        logger.info("Genre: %s, Mood: %s, Tempo: %s, Duration: %ss", genre, mood, tempo, duration_seconds)

        base_url = os.getenv("ACESTEP_API_URL", DEFAULT_ACE_STEP_API_URL).rstrip("/")
        api_key = os.getenv("ACESTEP_API_KEY")
        duration = self._clamp_duration(duration_seconds)
        full_prompt = self._build_prompt(prompt=prompt, genre=genre, mood=mood, tempo=tempo)

        payload = {
            "sample_mode": False,
            "prompt": full_prompt,
            "lyrics": "",
            "thinking": False,
            "audio_duration": duration,
            "audio_format": os.getenv("ACESTEP_AUDIO_FORMAT", "wav"),
            "batch_size": int(os.getenv("ACESTEP_BATCH_SIZE", "1")),
            "inference_steps": int(os.getenv("ACESTEP_INFERENCE_STEPS", "8")),
            "model": os.getenv("ACESTEP_MODEL", DEFAULT_ACE_STEP_MODEL),
            "lm_model_path": os.getenv("ACESTEP_LM_MODEL_PATH", "acestep-5Hz-lm-0.6B"),
            "lm_backend": os.getenv("ACESTEP_LM_BACKEND", "pt"),
        }

        if tempo:
            payload["bpm"] = self._safe_tempo(tempo)

        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        timeout = httpx.Timeout(connect=10.0, read=3600.0, write=30.0, pool=10.0)
        try:
            with httpx.Client(timeout=timeout) as client:
                health_response = client.get(urljoin(base_url + "/", "health"), headers=headers)
                health_response.raise_for_status()

                release_response = client.post(
                    urljoin(base_url + "/", "release_task"),
                    headers=headers,
                    json=payload,
                )
                release_response.raise_for_status()
                release_data = self._unwrap_ace_step_response(release_response.json())
                task_id = release_data.get("task_id")
                if not task_id:
                    raise MusicGenerationError("ACE-Step did not return a task id.")

                result_item = self._wait_for_ace_step_result(
                    client=client,
                    base_url=base_url,
                    headers=headers,
                    task_id=task_id,
                )
                audio_url = self._save_ace_step_audio(client, base_url, headers, result_item)
        except httpx.HTTPError as exc:
            raise MusicGenerationError(f"ACE-Step request failed: {exc}") from exc

        return {
            "title": self._build_title(genre=genre, mood=mood),
            "audio_url": audio_url,
            "duration_seconds": duration,
        }

    def _wait_for_ace_step_result(self, client, base_url, headers, task_id):
        deadline = time.monotonic() + int(os.getenv("ACESTEP_RESULT_TIMEOUT_SECONDS", "3600"))

        while time.monotonic() < deadline:
            response = client.post(
                urljoin(base_url + "/", "query_result"),
                headers=headers,
                json={"task_id_list": [task_id]},
            )
            response.raise_for_status()
            data = self._unwrap_ace_step_response(response.json())
            if not data:
                time.sleep(2)
                continue

            task_result = data[0]
            status = task_result.get("status")
            if status == 1:
                result = json.loads(task_result.get("result") or "[]")
                if not result:
                    raise MusicGenerationError("ACE-Step returned an empty generation result.")
                return result[0]
            if status == 2:
                raise MusicGenerationError("ACE-Step generation failed.")

            time.sleep(2)

        raise MusicGenerationError("Timed out waiting for ACE-Step generation.")

    def _save_ace_step_audio(self, client, base_url, headers, result_item):
        audio_path_or_url = result_item.get("url") or result_item.get("file")
        if not audio_path_or_url:
            raise MusicGenerationError("ACE-Step result did not include an audio file.")

        if audio_path_or_url.startswith("http://") or audio_path_or_url.startswith("https://"):
            download_url = audio_path_or_url
        elif audio_path_or_url.startswith("/"):
            download_url = f"{base_url}{audio_path_or_url}"
        else:
            download_url = f"{base_url}/v1/audio?path={audio_path_or_url}"

        response = client.get(download_url, headers=headers)
        response.raise_for_status()

        GENERATED_AUDIO_DIR.mkdir(exist_ok=True)
        file_extension = self._get_audio_extension(
            content_type=response.headers.get("content-type", ""),
            source=audio_path_or_url,
        )
        file_name = f"generated_{uuid4().hex}{file_extension}"
        file_path = GENERATED_AUDIO_DIR / file_name
        file_path.write_bytes(response.content)

        logger.info("Saved ACE-Step output: %s", file_path)
        return f"/generated-audio/{file_name}"

    def _unwrap_ace_step_response(self, payload):
        if payload.get("code", 200) >= 400 or payload.get("error"):
            raise MusicGenerationError(payload.get("error") or "ACE-Step returned an error.")
        return payload.get("data") or {}

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
