#!/usr/bin/env python3
"""
Test script to check music generation with detailed debug output.
This will help identify where the failure occurs.
"""

import sys
import os
from pathlib import Path

# Add the backend app to Python path
backend_path = Path(__file__).parent / "beatsluv_backend"
sys.path.insert(0, str(backend_path))

from app.services.music_generator import MusicGeneratorService

def test_music_generation():
    """Test music generation with comprehensive logging."""
    print("🧪 Starting music generation test...")
    print("=" * 60)
    
    # Create service instance
    service = MusicGeneratorService()
    
    # Test with simple parameters
    try:
        result = service.generate_track(
            prompt="upbeat electronic dance music",
            genre="electronic",
            mood="energetic", 
            tempo=128,
            duration_seconds=10  # Keep it short for testing
        )
        
        print("=" * 60)
        print("🎉 TEST COMPLETED!")
        print(f"Generated track: {result}")
        
        if result['is_mock']:
            print("\n⚠️  NOTE: This is a mock track - real generation failed")
            print("Check the logs above to see where the failure occurred.")
        else:
            print("\n✅ Real music generation was successful!")
            
    except Exception as e:
        print("=" * 60)
        print(f"❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_music_generation()