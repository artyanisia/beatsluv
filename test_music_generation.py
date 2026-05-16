#!/usr/bin/env python3
"""Manual test for local ACE-Step music generation."""

import sys
from pathlib import Path


backend_path = Path(__file__).parent / "beatsluv_backend"
sys.path.insert(0, str(backend_path))

from app.services.music_generator import MusicGeneratorService  # noqa: E402


def test_music_generation():
    print("Starting music generation test...")
    print("=" * 60)

    service = MusicGeneratorService()

    try:
        result = service.generate_track(
            prompt="upbeat electronic dance music",
            genre="electronic",
            mood="energetic",
            tempo=128,
            duration_seconds=10,
        )

        print("=" * 60)
        print("TEST COMPLETED")
        print(f"Generated track: {result}")
        print("\nReal music generation was successful.")
    except Exception as exc:
        print("=" * 60)
        print(f"TEST FAILED: {exc}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    test_music_generation()
