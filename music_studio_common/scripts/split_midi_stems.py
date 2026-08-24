"""把总 MIDI 拆成按动物命名的独立 MIDI 分轨。"""

from __future__ import annotations

import argparse
from pathlib import Path

from mido import MidiFile, MidiTrack


STEM_TRACKS = {
    "bear": {"Bear and Rabbit shared melody", "Bear keyboard harmony"},
    "cat": {"Cat bass roots"},
    "dog": {"Dog drum grid"},
    "lion": {"Lion alto sax responses"},
}


def track_name(track: MidiTrack) -> str | None:
    for message in track:
        if message.type == "track_name":
            return message.name
    return None


def copy_track(track: MidiTrack) -> MidiTrack:
    copied = MidiTrack()
    copied.extend(message.copy() for message in track)
    return copied


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--midi", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--prefix", required=True)
    args = parser.parse_args()

    source = MidiFile(args.midi)
    named_tracks = {track_name(track): track for track in source.tracks}
    conductor = named_tracks.get("Conductor")
    if conductor is None:
        parser.error("输入 MIDI 缺少 Conductor 轨")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    for animal, required_names in STEM_TRACKS.items():
        missing = required_names - named_tracks.keys()
        if missing:
            parser.error(f"{animal} 缺少 MIDI 轨：{', '.join(sorted(missing))}")

        stem = MidiFile(type=source.type, ticks_per_beat=source.ticks_per_beat)
        stem.tracks.append(copy_track(conductor))
        for track in source.tracks:
            if track_name(track) in required_names:
                stem.tracks.append(copy_track(track))

        output = args.output_dir / f"{args.prefix}_{animal}.mid"
        stem.save(output)
        print(f"已导出 {animal} MIDI：{output}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
