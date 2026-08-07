"""Render the rabbit solfege stem for every published music pack.

Each source syllable is a C4 recording. FFmpeg shifts it to the score pitch and
time-stretches it to the written note duration; NumPy then places the rendered
notes on the exact beat grid and writes a stereo 48 kHz stem.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np


SAMPLE_RATE = 48_000
SOURCE_MIDI = 60  # C4
NOTE_INDEX = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def midi_number(note_name: str) -> int:
    match = re.fullmatch(r"([A-G])([#b]?)(-?\d+)", note_name)
    if not match:
        raise ValueError(f"Unsupported pitch: {note_name}")
    letter, accidental, octave_text = match.groups()
    accidental_offset = 1 if accidental == "#" else -1 if accidental == "b" else 0
    return (int(octave_text) + 1) * 12 + NOTE_INDEX[letter] + accidental_offset


def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as wav_file:
        return wav_file.getnframes() / wav_file.getframerate()


def atempo_chain(value: float) -> str:
    factors: list[float] = []
    while value < 0.5:
        factors.append(0.5)
        value /= 0.5
    while value > 2.0:
        factors.append(2.0)
        value /= 2.0
    factors.append(value)
    return ",".join(f"atempo={factor:.8f}" for factor in factors)


def render_note(
    ffmpeg: Path,
    source: Path,
    output: Path,
    pitch: str,
    target_duration: float,
) -> None:
    pitch_ratio = 2 ** ((midi_number(pitch) - SOURCE_MIDI) / 12)
    shifted_duration = wav_duration(source) / pitch_ratio
    tempo = shifted_duration / target_duration
    fade = min(0.025, target_duration / 8)
    fade_out_start = max(0.0, target_duration - fade)
    filters = (
        f"asetrate={SAMPLE_RATE * pitch_ratio:.8f},aresample={SAMPLE_RATE},"
        f"{atempo_chain(tempo)},apad,atrim=duration={target_duration:.8f},"
        f"afade=t=in:st=0:d={fade:.8f},"
        f"afade=t=out:st={fade_out_start:.8f}:d={fade:.8f}"
    )
    subprocess.run(
        [
            str(ffmpeg), "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(source), "-af", filters,
            "-ac", "1", "-ar", str(SAMPLE_RATE), "-c:a", "pcm_s16le", str(output),
        ],
        check=True,
    )


def read_pcm16(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as wav_file:
        if wav_file.getnchannels() != 1 or wav_file.getframerate() != SAMPLE_RATE:
            raise ValueError(f"Unexpected rendered note format: {path}")
        return np.frombuffer(wav_file.readframes(wav_file.getnframes()), dtype="<i2").astype(np.float64) / 32768.0


def write_stereo_pcm16(path: Path, mono: np.ndarray) -> None:
    peak = float(np.max(np.abs(mono))) if mono.size else 0.0
    # Keep the vocal clear without masking the quieter keyboard and sax stems.
    target_peak = 10 ** (-12.0 / 20.0)
    if peak > 0:
        mono *= target_peak / peak
    stereo = np.column_stack((mono, mono))
    pcm = (np.clip(stereo, -1.0, 1.0 - 1 / 32768.0) * 32768.0).astype("<i2")
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(2)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(pcm.tobytes())


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source_file:
        for chunk in iter(lambda: source_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def render_pack(ffmpeg: Path, source_dir: Path, score_path: Path) -> Path:
    pack_dir = score_path.parent
    score = json.loads(score_path.read_text(encoding="utf-8"))
    manifest_path = pack_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    duration_seconds = float(manifest["durationSeconds"])
    mix = np.zeros(round(duration_seconds * SAMPLE_RATE), dtype=np.float64)
    seconds_per_beat = 60.0 / float(score["bpm"])

    with tempfile.TemporaryDirectory(prefix="rabbit-stem-") as temporary:
        temporary_dir = Path(temporary)
        for index, note in enumerate(score["melody"]):
            syllable = note["solfege"]
            source = source_dir / f"{syllable}.wav"
            if not source.exists():
                raise FileNotFoundError(f"Missing solfege source: {source}")
            target_duration = float(note["duration"]) * seconds_per_beat
            rendered = temporary_dir / f"{index:02d}-{syllable}.wav"
            render_note(ffmpeg, source, rendered, note["pitch"], target_duration)
            samples = read_pcm16(rendered)
            start = round(float(note["beat"]) * seconds_per_beat * SAMPLE_RATE)
            end = min(len(mix), start + len(samples))
            mix[start:end] += samples[: end - start]

    stem_path = pack_dir / "stems" / "rabbit.wav"
    write_stereo_pcm16(stem_path, mix)
    manifest["stems"]["rabbit"] = "stems/rabbit.wav"
    manifest["stemRoles"]["rabbit"] = "solfege_vocal_melody"
    manifest["stemGains"]["rabbit"] = 1.0
    manifest["checksums"]["rabbit"] = sha256(stem_path)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return stem_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prototype", type=Path, required=True)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--ffmpeg", type=Path, required=True)
    args = parser.parse_args()

    score_paths = sorted((args.prototype / "assets" / "music").glob("*/v01/score.json"))
    if not score_paths:
        raise SystemExit("No published score files found")
    for score_path in score_paths:
        stem = render_pack(args.ffmpeg, args.source, score_path)
        print(stem.relative_to(args.prototype))
    print(f"rendered {len(score_paths)} rabbit stems")


if __name__ == "__main__":
    main()
