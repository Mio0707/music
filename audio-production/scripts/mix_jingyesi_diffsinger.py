from __future__ import annotations

import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "prototype" / "assets" / "music" / "longing_steady" / "v01"
OUT = ROOT / "output" / "jingyesi-diffsinger-v1"
VOICE_PATH = OUT / "静夜思-DiffSinger中文人声.wav"
MIX_PATH = OUT / "静夜思-DiffSinger演唱-带伴奏.wav"
ACCOMPANIMENT_PATH = OUT / "静夜思-88BPM伴奏.wav"

SAMPLE_RATE = 48_000
BPM = 88


def read_wav(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as handle:
        rate = handle.getframerate()
        channels = handle.getnchannels()
        width = handle.getsampwidth()
        if width != 2:
            raise ValueError(f"Expected 16-bit PCM: {path}")
        audio = np.frombuffer(handle.readframes(handle.getnframes()), dtype="<i2").astype(np.float32)
    return audio.reshape(-1, channels) / 32768.0, rate


def resample(audio: np.ndarray, source_rate: int) -> np.ndarray:
    if source_rate == SAMPLE_RATE:
        return audio
    target_length = round(len(audio) * SAMPLE_RATE / source_rate)
    source_positions = np.linspace(0, len(audio) - 1, target_length)
    left = np.floor(source_positions).astype(int)
    right = np.minimum(left + 1, len(audio) - 1)
    fraction = (source_positions - left)[:, None]
    return audio[left] * (1 - fraction) + audio[right] * fraction


def add_at(target: np.ndarray, source: np.ndarray, start_seconds: float, gain: float) -> None:
    start = round(start_seconds * SAMPLE_RATE)
    end = min(len(target), start + len(source))
    if end > start:
        target[start:end] += source[: end - start] * gain


def fade(audio: np.ndarray, seconds: float) -> None:
    frames = min(len(audio), round(seconds * SAMPLE_RATE))
    if frames:
        audio[-frames:] *= np.linspace(1, 0, frames, dtype=np.float32)[:, None]


def write_wav(path: Path, audio: np.ndarray) -> None:
    peak = float(np.max(np.abs(audio))) or 1.0
    if peak > 0.96:
        audio = audio * (0.96 / peak)
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2")
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(pcm.tobytes())


def main() -> None:
    stems: dict[str, np.ndarray] = {}
    for animal in ("dog", "cat", "bear", "lion"):
        audio, rate = read_wav(PACK / "stems" / f"{animal}.wav")
        if rate != SAMPLE_RATE or audio.shape[1] != 2:
            raise ValueError(f"Unexpected stem format: {animal}")
        stems[animal] = audio

    section_seconds = len(stems["dog"]) / SAMPLE_RATE  # Two bars at 88 BPM.
    total_seconds = section_seconds * 4 + 0.8
    accompaniment = np.zeros((round(total_seconds * SAMPLE_RATE), 2), dtype=np.float32)
    vocal_track = np.zeros_like(accompaniment)

    arrangements = [
        (("dog", 0.50), ("cat", 0.37)),
        (("dog", 0.50), ("cat", 0.37), ("bear", 0.20)),
        (("dog", 0.50), ("cat", 0.37), ("bear", 0.20)),
        (("dog", 0.50), ("cat", 0.37), ("bear", 0.20), ("lion", 0.11)),
    ]
    for section_index, tracks in enumerate(arrangements):
        for animal, gain in tracks:
            add_at(accompaniment, stems[animal], section_index * section_seconds, gain)

    voice, voice_rate = read_wav(VOICE_PATH)
    voice = resample(voice, voice_rate)
    if voice.shape[1] == 1:
        voice = np.repeat(voice, 2, axis=1)

    # Section 1 is the two-bar intro. The four sung bars start at section 2.
    add_at(vocal_track, voice, section_seconds, 0.90)
    fade(accompaniment, 0.7)
    fade(vocal_track, 0.08)

    # Keep the accompaniment present, while the vocal stays clearly intelligible.
    full_mix = accompaniment * 1.70 + vocal_track
    write_wav(ACCOMPANIMENT_PATH, accompaniment * 1.70)
    write_wav(MIX_PATH, full_mix)
    print(ACCOMPANIMENT_PATH)
    print(MIX_PATH)


if __name__ == "__main__":
    main()
