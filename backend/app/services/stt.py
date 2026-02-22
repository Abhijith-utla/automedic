"""
Speech-to-Text placeholder (Whisper integration point).

Replace with real Whisper (or other STT) when available.
Input: audio stream from Arduino/hardware or file.
Output: transcript segments with optional key_terms from NER.
"""

from typing import AsyncIterator
from app.schemas.encounter import TranscriptSegment


async def transcribe_stream(audio_stream: AsyncIterator[bytes]) -> AsyncIterator[TranscriptSegment]:
    """
    Consume audio stream and yield transcript segments.
    TODO: Wire to OpenAI Whisper or local Whisper model.
    """
    # Placeholder: no real audio processing
    yield TranscriptSegment(text="[STT placeholder] ", key_terms=[])
    return
