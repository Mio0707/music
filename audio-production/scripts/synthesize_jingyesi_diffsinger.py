from __future__ import annotations

import os
import sys
import glob
from pathlib import Path

import numpy as np
import torch


WORKSPACE = Path(__file__).resolve().parents[2]
RUNTIME = Path(r"D:\DiffSinger\legacy-runtime")
OUT_DIR = WORKSPACE / "output" / "jingyesi-diffsinger-v1"

BPM = 88
SECONDS_PER_BEAT = 60.0 / BPM

POEM_LINES = ["床前明月光", "疑是地上霜", "举头望明月", "低头思故乡"]
# DiffSinger treats SP as silence. One SP is inserted after every poem line.
LYRICS = "SP".join(POEM_LINES) + "SP"

NOTE_LINES = [
    ["G4", "D4", "E4", "G4", "A4"],
    ["A4", "G4", "E4", "D4", "E4"],
    ["E4", "G4", "A4", "G4", "A4"],
    ["A4", "G4", "E4", "D4", "C4"],
]

# Durations follow the distance between note onsets. This keeps each five-character
# line inside one complete 4/4 bar and avoids the disconnected, stop-start feeling.
SUNG_DURATION_LINES_BEATS = [
    [0.65, 0.9, 0.65, 0.4, 0.9],
    [0.65, 0.9, 0.65, 0.4, 0.9],
    [0.65, 0.9, 0.4, 0.4, 1.15],
    [0.65, 0.9, 0.65, 0.4, 0.9],
]
LINE_PAUSE_BEATS = 0.5


def main() -> None:
    if not RUNTIME.exists():
        raise FileNotFoundError(f"DiffSinger runtime not found: {RUNTIME}")

    # Compatibility aliases required by the official 2022 inference runtime.
    for name, value in {
        "bool": bool,
        "int": int,
        "float": float,
        "complex": complex,
    }.items():
        if name not in np.__dict__:
            setattr(np, name, value)

    # PyTorch 2.6 changed the checkpoint loading default. These are the official
    # DiffSinger release checkpoints, which contain more than tensor weights.
    original_torch_load = torch.load

    def compatible_torch_load(*args, **kwargs):
        kwargs.setdefault("weights_only", False)
        return original_torch_load(*args, **kwargs)

    torch.load = compatible_torch_load

    # The 2022 runtime matches checkpoint names with POSIX-style slashes.
    # Normalize Windows glob results so the official regular expressions work.
    original_glob = glob.glob

    def compatible_glob(*args, **kwargs):
        return [path.replace("\\", "/") for path in original_glob(*args, **kwargs)]

    glob.glob = compatible_glob

    os.chdir(RUNTIME)
    sys.path.insert(0, str(RUNTIME))
    sys.argv = [
        str(Path(__file__)),
        "--config",
        "usr/configs/midi/e2e/opencpop/ds1000.yaml",
        "--exp_name",
        "0831_opencpop_ds1000",
    ]

    from inference.svs.ds_e2e import DiffSingerE2EInfer
    from utils.audio import save_wav
    from utils.hparams import hparams, set_hparams

    notes: list[str] = []
    durations: list[float] = []
    for line_notes, line_durations in zip(NOTE_LINES, SUNG_DURATION_LINES_BEATS):
        notes.extend(line_notes)
        durations.extend(beats * SECONDS_PER_BEAT for beats in line_durations)
        notes.append("rest")
        durations.append(LINE_PAUSE_BEATS * SECONDS_PER_BEAT)
    if not (len(notes) == len(durations) == 24):
        raise ValueError("The score must contain 20 lyric notes and 4 line pauses.")

    inp = {
        "text": LYRICS,
        "notes": " | ".join(notes),
        "notes_duration": " | ".join(f"{duration:.6f}" for duration in durations),
        "input_type": "word",
        "item_name": "jingyesi",
        "spk_name": "opencpop",
    }

    set_hparams(print_hparams=False)
    singer = DiffSingerE2EInfer(hparams)
    audio = singer.infer_once(inp)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUT_DIR / "静夜思-DiffSinger中文人声.wav"
    save_wav(audio, str(output_path), hparams["audio_sample_rate"])
    print(output_path)


if __name__ == "__main__":
    main()
