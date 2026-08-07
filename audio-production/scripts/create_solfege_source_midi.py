from __future__ import annotations

import argparse
from pathlib import Path

from mido import Message, MetaMessage, MidiFile, MidiTrack, bpm2tempo


TICKS_PER_BEAT = 480
SOLFEGE_NOTES = [
    (60, "do"),
    (62, "re"),
    (64, "mi"),
    (65, "fa"),
    (67, "sol"),
    (69, "la"),
    (71, "si"),
]


def create_midi(output_path: Path, monotone_note: int | None = None) -> None:
    midi = MidiFile(ticks_per_beat=TICKS_PER_BEAT)

    conductor = MidiTrack()
    conductor.append(MetaMessage("track_name", name="Rabbit Solfege Source", time=0))
    conductor.append(MetaMessage("set_tempo", tempo=bpm2tempo(60), time=0))
    conductor.append(
        MetaMessage(
            "time_signature",
            numerator=4,
            denominator=4,
            clocks_per_click=24,
            notated_32nd_notes_per_beat=8,
            time=0,
        )
    )
    midi.tracks.append(conductor)

    vocal = MidiTrack()
    vocal.append(MetaMessage("track_name", name="Rabbit Vocal", time=0))
    vocal.append(Message("program_change", program=53, channel=0, time=0))

    note_ticks = 2 * TICKS_PER_BEAT
    rest_ticks = TICKS_PER_BEAT
    pending_rest = 0
    for midi_note, syllable in SOLFEGE_NOTES:
        if monotone_note is not None:
            midi_note = monotone_note
        vocal.append(MetaMessage("lyrics", text=syllable, time=pending_rest))
        vocal.append(Message("note_on", note=midi_note, velocity=88, channel=0, time=0))
        vocal.append(Message("note_off", note=midi_note, velocity=0, channel=0, time=note_ticks))
        pending_rest = rest_ticks

    midi.tracks.append(vocal)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    midi.save(output_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a seven-syllable source MIDI for ACE Studio.")
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--monotone-note",
        type=int,
        help="Render every syllable on this MIDI note; 67 (G4) is recommended for child voices.",
    )
    args = parser.parse_args()
    create_midi(args.output, monotone_note=args.monotone_note)
    print(args.output.resolve())


if __name__ == "__main__":
    main()
