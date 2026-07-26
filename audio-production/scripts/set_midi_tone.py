"""替换指定 MIDI 轨的音色，保留音符、速度和时间位置。"""

from __future__ import annotations

import argparse
from pathlib import Path

from mido import Message, MidiFile, MidiTrack


def get_track_name(track: MidiTrack) -> str | None:
    for message in track:
        if message.type == "track_name":
            return message.name
    return None


def replace_program(track: MidiTrack, bank: int, program: int) -> MidiTrack:
    output = MidiTrack()
    replaced = False
    for message in track:
        if message.type == "program_change":
            output.append(Message("control_change", channel=message.channel, control=0, value=bank, time=message.time))
            output.append(Message("control_change", channel=message.channel, control=32, value=0, time=0))
            output.append(message.copy(program=program, time=0))
            replaced = True
        else:
            output.append(message.copy())
    if not replaced:
        raise ValueError("目标 MIDI 轨缺少 program_change 事件")
    return output


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--midi", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--track-name", required=True)
    parser.add_argument("--bank", required=True, type=int)
    parser.add_argument("--program", required=True, type=int)
    args = parser.parse_args()

    if not 0 <= args.bank <= 127 or not 0 <= args.program <= 127:
        parser.error("bank 和 program 必须在 0—127 之间")

    source = MidiFile(args.midi)
    found = False
    output = MidiFile(type=source.type, ticks_per_beat=source.ticks_per_beat)
    for track in source.tracks:
        if get_track_name(track) == args.track_name:
            output.tracks.append(replace_program(track, args.bank, args.program))
            found = True
        else:
            copied = MidiTrack()
            copied.extend(message.copy() for message in track)
            output.tracks.append(copied)
    if not found:
        parser.error(f"找不到 MIDI 轨：{args.track_name}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    output.save(args.output)
    print(f"已替换音色：bank {args.bank}, program {args.program} -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
