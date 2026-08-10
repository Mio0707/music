from __future__ import annotations

import struct
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "prototype" / "assets" / "music" / "longing_steady" / "v01"
OUT = ROOT / "output" / "jingyesi-piano-rule-v6-88bpm-compact"
FFMPEG = Path(r"C:\Users\Administrator\AppData\Local\JianyingPro\Apps\11.1.0.14287\ffmpeg.exe")
FLUIDSYNTH = Path(
    r"C:\Users\Administrator\AppData\Local\music-audio-tools\fluidsynth-v2.5.7"
    r"\fluidsynth-v2.5.7-win10-x64-cpp11\bin\fluidsynth.exe"
)
SOUNDFONT = Path(r"C:\Users\Administrator\AppData\Local\music-audio-tools\sounds\MuseScore_General.sf3")

SAMPLE_RATE = 48_000
BPM = 88
SOURCE_BPM = 88
TICKS_PER_BEAT = 480

NOTE_NUMBERS = {
    "C4": 60,
    "D4": 62,
    "E4": 64,
    "F4": 65,
    "G4": 67,
    "A4": 69,
}
NOTE_LINES = [
    ["G4", "D4", "E4", "G4", "A4"],
    ["A4", "G4", "E4", "D4", "E4"],
    ["E4", "G4", "A4", "G4", "A4"],
    ["A4", "G4", "E4", "D4", "C4"],
]
NOTE_BEATS = [
    [0, 0.75, 1.75, 2.5, 3.0],
    [0, 0.75, 1.75, 2.5, 3.0],
    [0, 0.75, 1.75, 2.25, 2.75],
    [0, 0.75, 1.75, 2.5, 3.0],
]
NOTE_DURATIONS = [
    [0.55, 0.78, 0.55, 0.42, 0.95],
    [0.55, 0.78, 0.55, 0.42, 0.95],
    [0.55, 0.78, 0.38, 0.45, 1.18],
    [0.55, 0.78, 0.55, 0.42, 0.95],
]


def variable_length(value: int) -> bytes:
    buffer = value & 0x7F
    encoded = bytearray()
    while value >> 7:
        value >>= 7
        buffer <<= 8
        buffer |= (value & 0x7F) | 0x80
    while True:
        encoded.append(buffer & 0xFF)
        if buffer & 0x80:
            buffer >>= 8
        else:
            return bytes(encoded)


def write_midi(path: Path) -> None:
    events: list[tuple[int, int, bytes]] = []
    tempo = round(60_000_000 / BPM)
    events.append((0, 0, b"\xff\x51\x03" + tempo.to_bytes(3, "big")))
    events.append((0, 0, b"\xff\x58\x04\x04\x02\x18\x08"))
    events.append((0, 0, bytes([0xC0, 0])))  # Acoustic grand piano.

    for line_index, (notes, starts, durations) in enumerate(zip(NOTE_LINES, NOTE_BEATS, NOTE_DURATIONS)):
        # Two-bar intro, then four consecutive one-bar poem lines.
        line_start = 8 + line_index * 4
        for note_index, (note_name, local_start, duration) in enumerate(zip(notes, starts, durations)):
            start_tick = round((line_start + local_start) * TICKS_PER_BEAT)
            end_tick = round((line_start + local_start + duration) * TICKS_PER_BEAT)
            note = NOTE_NUMBERS[note_name]
            velocity = 82 if note_index in (0, 4) else 74
            events.append((start_tick, 2, bytes([0x90, note, velocity])))
            events.append((end_tick, 1, bytes([0x80, note, 0])))

    events.sort(key=lambda item: (item[0], item[1]))
    track = bytearray()
    previous_tick = 0
    for tick, _, data in events:
        track.extend(variable_length(tick - previous_tick))
        track.extend(data)
        previous_tick = tick
    track.extend(b"\x00\xff\x2f\x00")
    header = b"MThd" + struct.pack(">IHHH", 6, 0, 1, TICKS_PER_BEAT)
    path.write_bytes(header + b"MTrk" + struct.pack(">I", len(track)) + track)


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as handle:
        if handle.getframerate() != SAMPLE_RATE or handle.getsampwidth() != 2:
            raise ValueError(f"Unexpected WAV format: {path}")
        channels = handle.getnchannels()
        audio = np.frombuffer(handle.readframes(handle.getnframes()), dtype="<i2").astype(np.float32)
    audio = audio.reshape(-1, channels) / 32768.0
    if channels == 1:
        audio = np.repeat(audio, 2, axis=1)
    return audio


def add_at(target: np.ndarray, source: np.ndarray, start: int, gain: float) -> None:
    end = min(len(target), start + len(source))
    if end > start:
        target[start:end] += source[: end - start] * gain


def write_wav(path: Path, audio: np.ndarray) -> None:
    peak = float(np.max(np.abs(audio))) or 1.0
    if peak > 0.96:
        audio *= 0.96 / peak
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(pcm.tobytes())


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    midi_path = OUT / "静夜思-旋律示范.mid"
    piano_path = OUT / "静夜思-纯钢琴旋律.wav"
    mix_path = OUT / "静夜思-钢琴示范-带伴奏.wav"
    write_midi(midi_path)

    duration_seconds = 4 * 8 * 60 / BPM + 0.8
    subprocess.run([
        str(FLUIDSYNTH), "-ni", "-F", str(piano_path), "-O", "s16", "-r", str(SAMPLE_RATE),
        "-g", "0.55", "-R", "0", "-C", "0", str(SOUNDFONT), str(midi_path),
    ], check=True, capture_output=True)

    piano = read_wav(piano_path)
    total_frames = round(duration_seconds * SAMPLE_RATE)
    piano = piano[:total_frames]
    if len(piano) < total_frames:
        piano = np.pad(piano, ((0, total_frames - len(piano)), (0, 0)))
    write_wav(piano_path, piano)

    stems = {}
    with tempfile.TemporaryDirectory(prefix="jingyesi-piano-") as temporary_directory:
        temporary_root = Path(temporary_directory)
        for name in ("dog", "cat", "bear", "lion"):
            stretched_path = temporary_root / f"{name}.wav"
            subprocess.run([
                str(FFMPEG), "-loglevel", "error", "-y",
                "-i", str(PACK / "stems" / f"{name}.wav"),
                "-filter:a", f"atempo={BPM / SOURCE_BPM:.8f}",
                "-ar", str(SAMPLE_RATE), "-ac", "2", str(stretched_path),
            ], check=True)
            stretched = read_wav(stretched_path)
            target_section_frames = round(8 * 60 / BPM * SAMPLE_RATE)
            stretched = stretched[:target_section_frames]
            if len(stretched) < target_section_frames:
                stretched = np.pad(stretched, ((0, target_section_frames - len(stretched)), (0, 0)))
            stems[name] = stretched
    section_frames = len(stems["dog"])
    accompaniment = np.zeros_like(piano)
    arrangements = [
        (("dog", 0.50), ("cat", 0.37)),
        (("dog", 0.50), ("cat", 0.37), ("bear", 0.20)),
        (("dog", 0.50), ("cat", 0.37), ("bear", 0.20)),
        (("dog", 0.50), ("cat", 0.37), ("bear", 0.20), ("lion", 0.11)),
    ]
    for section_index, tracks in enumerate(arrangements):
        for name, gain in tracks:
            add_at(accompaniment, stems[name], section_index * section_frames, gain)

    tail = round(0.7 * SAMPLE_RATE)
    piano[-tail:] *= np.linspace(1, 0, tail, dtype=np.float32)[:, None]
    accompaniment[-tail:] *= np.linspace(1, 0, tail, dtype=np.float32)[:, None]
    write_wav(mix_path, accompaniment + piano * 0.92)
    print(piano_path)
    print(mix_path)
    print(midi_path)


if __name__ == "__main__":
    main()
