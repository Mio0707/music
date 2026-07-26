"""把已通过检查的音乐骨架导出为标准 MIDI。"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from mido import Message, MetaMessage, MidiFile, MidiTrack, bpm2tempo


TICKS_PER_BEAT = 480
PITCH_RE = re.compile(r"^([A-G])([#b]?)(-?\d+)$")
SEMITONES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
DRUMS = {"kick": 36, "snare": 38, "hihat": 42}


def midi_note(pitch: str) -> int:
    match = PITCH_RE.match(pitch)
    if not match:
        raise ValueError(f"无法转换音高：{pitch}")
    letter, accidental, octave_text = match.groups()
    accidental_offset = {"": 0, "#": 1, "b": -1}[accidental]
    return 12 * (int(octave_text) + 1) + SEMITONES[letter] + accidental_offset


def add_notes(track: MidiTrack, notes: list[dict], channel: int, velocity: int) -> None:
    events: list[tuple[int, int, bool, int]] = []
    for note in notes:
        start = round(float(note["beat"]) * TICKS_PER_BEAT)
        end = round((float(note["beat"]) + float(note["duration"])) * TICKS_PER_BEAT)
        value = midi_note(note["pitch"])
        events.append((start, value, True, velocity))
        events.append((end, value, False, 0))
    events.sort(key=lambda item: (item[0], item[2]))
    last_tick = 0
    for tick, value, is_on, event_velocity in events:
        track.append(Message("note_on" if is_on else "note_off", note=value, velocity=event_velocity, channel=channel, time=tick - last_tick))
        last_tick = tick


def add_chords(track: MidiTrack, chords: list[dict], total_beats: int) -> None:
    """把简单大三和弦或小三和弦写入独立的和声参考轨。"""
    events: list[tuple[int, int, bool, int]] = []
    for index, chord in enumerate(chords):
        symbol = chord["symbol"]
        match = re.match(r"^([A-G])([#b]?)(m?)$", symbol)
        if not match:
            raise ValueError(f"暂不支持的和弦：{symbol}")
        letter, accidental, minor = match.groups()
        root = 12 * (3 + 1) + SEMITONES[letter] + {"": 0, "#": 1, "b": -1}[accidental]
        intervals = (0, 3, 7) if minor else (0, 4, 7)
        start_beat = float(chord["beat"])
        end_beat = float(chords[index + 1]["beat"]) if index + 1 < len(chords) else total_beats
        start = round(start_beat * TICKS_PER_BEAT)
        end = round(end_beat * TICKS_PER_BEAT)
        for interval in intervals:
            events.append((start, root + interval, True, 58))
            events.append((end, root + interval, False, 0))
    events.sort(key=lambda item: (item[0], item[2]))
    last_tick = 0
    for tick, value, is_on, velocity in events:
        track.append(Message("note_on" if is_on else "note_off", note=value, velocity=velocity, channel=2, time=tick - last_tick))
        last_tick = tick


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skeleton", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    data = json.loads(args.skeleton.read_text(encoding="utf-8"))

    midi = MidiFile(ticks_per_beat=TICKS_PER_BEAT)
    conductor = MidiTrack()
    midi.tracks.append(conductor)
    conductor.append(MetaMessage("track_name", name="Conductor", time=0))
    conductor.append(MetaMessage("time_signature", numerator=4, denominator=4, time=0))
    conductor.append(MetaMessage("set_tempo", tempo=bpm2tempo(int(data["bpm"])), time=0))
    conductor.append(MetaMessage("marker", text=data["kitId"], time=0))

    melody_track = MidiTrack()
    midi.tracks.append(melody_track)
    melody_track.append(MetaMessage("track_name", name="Bear and Rabbit shared melody", time=0))
    melody_track.append(Message("program_change", program=0, channel=0, time=0))
    add_notes(melody_track, data["melody"], channel=0, velocity=92)

    chord_track = MidiTrack()
    midi.tracks.append(chord_track)
    chord_track.append(MetaMessage("track_name", name="Bear keyboard harmony", time=0))
    chord_track.append(Message("program_change", program=0, channel=2, time=0))
    add_chords(chord_track, data.get("chords", []), total_beats=int(data["bars"]) * 4)

    bass_track = MidiTrack()
    midi.tracks.append(bass_track)
    bass_track.append(MetaMessage("track_name", name="Cat bass roots", time=0))
    bass_track.append(Message("program_change", program=32, channel=1, time=0))
    add_notes(bass_track, data.get("bassRoots", []), channel=1, velocity=76)

    drum_track = MidiTrack()
    midi.tracks.append(drum_track)
    drum_track.append(MetaMessage("track_name", name="Dog drum grid", time=0))
    drum_notes = [
        {"pitch": "C2", "beat": item["beat"], "duration": item.get("duration", 0.25), "drum": item["instrument"]}
        for item in data.get("drumGrid", [])
    ]
    events = []
    for note in drum_notes:
        if note["drum"] not in DRUMS:
            continue
        start = round(float(note["beat"]) * TICKS_PER_BEAT)
        end = round((float(note["beat"]) + float(note["duration"])) * TICKS_PER_BEAT)
        events.extend([(start, DRUMS[note["drum"]], True), (end, DRUMS[note["drum"]], False)])
    events.sort(key=lambda item: (item[0], item[2]))
    last_tick = 0
    for tick, value, is_on in events:
        drum_track.append(Message("note_on" if is_on else "note_off", note=value, velocity=92 if is_on else 0, channel=9, time=tick - last_tick))
        last_tick = tick

    args.output.parent.mkdir(parents=True, exist_ok=True)
    midi.save(args.output)
    print(f"已导出标准 MIDI：{args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
