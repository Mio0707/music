from __future__ import annotations

import json
import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "prototype" / "assets" / "music" / "longing_steady" / "v01"
OUT = ROOT / "output" / "jingyesi-rabbit-rule-v1"
SYLLABLES = OUT / "syllables"
SAMPLE_RATE = 48_000
BPM = 88
BEAT_SECONDS = 60 / BPM

POEM_LINES = ["床前明月光", "疑是地上霜", "举头望明月", "低头思故乡"]
NOTE_NAMES = [
    ["A4", "C4", "E4", "G4", "A4"],
    ["A4", "G4", "E4", "C4", "D4"],
    ["D4", "A4", "G4", "A4", "A4"],
    ["A4", "F4", "E4", "C4", "C4"],
]
NOTE_BEATS = [
    [0, 1.5, 3, 4, 5],
    [0, 1.5, 2.5, 4, 5],
    [0, 2, 3.5, 4, 5],
    [0, 1, 2.5, 3.5, 5],
]


def read_wav(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as handle:
        rate = handle.getframerate()
        channels = handle.getnchannels()
        width = handle.getsampwidth()
        if width != 2:
            raise ValueError(f"Expected 16-bit PCM: {path}")
        audio = np.frombuffer(handle.readframes(handle.getnframes()), dtype="<i2").astype(np.float32)
    audio = audio.reshape(-1, channels) / 32768.0
    return audio, rate


def resample(audio: np.ndarray, source_rate: int) -> np.ndarray:
    if source_rate == SAMPLE_RATE:
        return audio
    target_length = round(len(audio) * SAMPLE_RATE / source_rate)
    source_positions = np.linspace(0, len(audio) - 1, target_length)
    left = np.floor(source_positions).astype(int)
    right = np.minimum(left + 1, len(audio) - 1)
    fraction = (source_positions - left)[:, None]
    return audio[left] * (1 - fraction) + audio[right] * fraction


def trim_voice(audio: np.ndarray) -> np.ndarray:
    mono = np.mean(np.abs(audio), axis=1)
    threshold = max(float(np.max(mono)) * 0.018, 0.001)
    active = np.flatnonzero(mono >= threshold)
    if not len(active):
        return audio
    margin = round(0.025 * SAMPLE_RATE)
    start = max(0, int(active[0]) - margin)
    end = min(len(audio), int(active[-1]) + margin)
    return audio[start:end]


def fade(audio: np.ndarray, fade_in_ms: int = 12, fade_out_ms: int = 80) -> np.ndarray:
    result = audio.copy()
    fade_in = min(len(result), round(fade_in_ms / 1000 * SAMPLE_RATE))
    fade_out = min(len(result), round(fade_out_ms / 1000 * SAMPLE_RATE))
    if fade_in:
        result[:fade_in] *= np.linspace(0, 1, fade_in, dtype=np.float32)[:, None]
    if fade_out:
        result[-fade_out:] *= np.linspace(1, 0, fade_out, dtype=np.float32)[:, None]
    return result


def add_at(target: np.ndarray, source: np.ndarray, start_seconds: float, gain: float) -> None:
    start = round(start_seconds * SAMPLE_RATE)
    end = min(len(target), start + len(source))
    if end > start:
        target[start:end] += source[: end - start] * gain


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
    OUT.mkdir(parents=True, exist_ok=True)
    stems = {}
    for animal in ("dog", "cat", "bear", "lion"):
        audio, rate = read_wav(PACK / "stems" / f"{animal}.wav")
        if rate != SAMPLE_RATE or audio.shape[1] != 2:
            raise ValueError(f"Unexpected stem format: {animal}")
        stems[animal] = fade(audio, 10, 30)

    section_seconds = len(stems["dog"]) / SAMPLE_RATE
    total_seconds = section_seconds * 4 + 0.8
    accompaniment = np.zeros((round(total_seconds * SAMPLE_RATE), 2), dtype=np.float32)
    vocal = np.zeros_like(accompaniment)

    arrangements = [
        (("dog", 0.46), ("cat", 0.34)),
        (("dog", 0.46), ("cat", 0.34), ("bear", 0.20)),
        (("dog", 0.46), ("cat", 0.34), ("bear", 0.20)),
        (("dog", 0.46), ("cat", 0.34), ("bear", 0.20), ("lion", 0.10)),
    ]
    for section_index, tracks in enumerate(arrangements):
        section_start = section_index * section_seconds
        for animal, gain in tracks:
            add_at(accompaniment, stems[animal], section_start, gain)

    timing = []
    syllable_index = 0
    for line_index, (line, notes, starts) in enumerate(zip(POEM_LINES, NOTE_NAMES, NOTE_BEATS)):
        section_start = line_index * section_seconds
        for char_index, (character, note, beat) in enumerate(zip(line, notes, starts)):
            syllable_index += 1
            source, source_rate = read_wav(SYLLABLES / f"{syllable_index:02d}.wav")
            source = trim_voice(resample(source, source_rate))
            if source.shape[1] == 1:
                source = np.repeat(source, 2, axis=1)
            next_beat = starts[char_index + 1] if char_index + 1 < len(starts) else 6.8
            available_seconds = max(0.42, (next_beat - beat) * BEAT_SECONDS - 0.10)
            if char_index == 4:
                available_seconds = min(1.20, available_seconds)
            else:
                available_seconds = min(0.82, available_seconds)
            source = fade(source[: round(available_seconds * SAMPLE_RATE)])
            start_seconds = section_start + beat * BEAT_SECONDS
            add_at(vocal, source, start_seconds, 0.88)
            timing.append({
                "line": line_index + 1,
                "character": character,
                "note": note,
                "beat": beat,
                "startSeconds": round(start_seconds, 3),
                "durationSeconds": round(len(source) / SAMPLE_RATE, 3),
            })

    tail = round(0.75 * SAMPLE_RATE)
    accompaniment[-tail:] *= np.linspace(1, 0, tail, dtype=np.float32)[:, None]
    vocal[-tail:] *= np.linspace(1, 0, tail, dtype=np.float32)[:, None]
    full_mix = accompaniment + vocal

    mix_path = OUT / "静夜思-小兔规则版-v1.wav"
    vocal_path = OUT / "静夜思-小兔人声-v1.wav"
    write_wav(mix_path, full_mix)
    write_wav(vocal_path, vocal)
    (OUT / "静夜思-规则版-v1.json").write_text(json.dumps({
        "poem": "静夜思",
        "author": "李白",
        "pack": "longing_steady/v01",
        "bpm": BPM,
        "design": "rule-based rabbit guide vocal; approximate contour inspired by the user's humming",
        "lines": POEM_LINES,
        "notes": NOTE_NAMES,
        "noteBeats": NOTE_BEATS,
        "timing": timing,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(mix_path)
    print(vocal_path)


if __name__ == "__main__":
    main()
