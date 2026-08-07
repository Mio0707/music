"""Create a child-like solfege set and rebuild ``si`` from source phonemes.

Requires ``praat-parselmouth``. The transformation raises vocal formants while
leaving the sung fundamental pitch and clip duration unchanged.
"""

from __future__ import annotations

import argparse
import sys
import wave
from pathlib import Path

# Allow the optional audio tool to live outside the application's dependencies.
LOCAL_TOOL_DIR = Path(__file__).resolve().parents[1] / ".audio-tools"
if LOCAL_TOOL_DIR.exists():
    sys.path.insert(0, str(LOCAL_TOOL_DIR))

import numpy as np

try:
    import parselmouth
    from parselmouth.praat import call
except ImportError as exc:  # pragma: no cover - command-line guidance
    raise SystemExit("Install praat-parselmouth before running this script") from exc


SAMPLE_RATE = 48_000
SYLLABLES = ("do", "re", "mi", "fa", "sol", "la", "si")


def read_mono_wav(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as wav_file:
        if wav_file.getnchannels() != 1 or wav_file.getsampwidth() != 2:
            raise ValueError(f"Expected mono 16-bit WAV: {path}")
        if wav_file.getframerate() != SAMPLE_RATE:
            raise ValueError(f"Expected {SAMPLE_RATE} Hz WAV: {path}")
        samples = np.frombuffer(wav_file.readframes(wav_file.getnframes()), dtype="<i2")
    return samples.astype(np.float64) / 32768.0


def write_mono_wav(path: Path, samples: np.ndarray) -> None:
    peak = float(np.max(np.abs(samples))) if samples.size else 0.0
    target_peak = 10 ** (-3.0 / 20.0)
    if peak > 0:
        samples = samples * (target_peak / peak)
    pcm = np.clip(samples, -1.0, 1.0 - 1 / 32768.0)
    pcm = (pcm * 32768.0).astype("<i2")
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(pcm.tobytes())


def rebuild_si(sol: np.ndarray, ti: np.ndarray) -> np.ndarray:
    """Join the /s/ from ``sol`` to the /i/ vowel from the source ``ti``."""
    s_start = round(0.035 * SAMPLE_RATE)
    s_end = round(0.285 * SAMPLE_RATE)
    i_start = round(0.105 * SAMPLE_RATE)
    overlap = round(0.020 * SAMPLE_RATE)

    consonant = sol[s_start:s_end].copy()
    vowel = ti[i_start:].copy()
    fade_out = np.linspace(1.0, 0.0, overlap, endpoint=False)
    fade_in = 1.0 - fade_out
    join = consonant[-overlap:] * fade_out + vowel[:overlap] * fade_in
    return np.concatenate((consonant[:-overlap], join, vowel[overlap:]))


def child_formants(samples: np.ndarray, ratio: float) -> np.ndarray:
    sound = parselmouth.Sound(samples, sampling_frequency=SAMPLE_RATE)
    changed = call(
        sound,
        "Change gender",
        75.0,
        600.0,
        ratio,
        0.0,  # Keep the existing median pitch.
        1.0,
        1.0,  # Keep duration.
    )
    return np.asarray(changed.values[0], dtype=np.float64)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--formant-ratio", type=float, default=1.12)
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    source_audio = {name: read_mono_wav(args.source / f"{name}.wav") for name in SYLLABLES}
    source_audio["si"] = rebuild_si(source_audio["sol"], source_audio["si"])

    for name in SYLLABLES:
        transformed = child_formants(source_audio[name], args.formant_ratio)
        write_mono_wav(args.output / f"{name}.wav", transformed)
        print(f"created {name}.wav ({len(transformed) / SAMPLE_RATE:.3f}s)")


if __name__ == "__main__":
    main()
