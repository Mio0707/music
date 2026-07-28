"""检查音乐骨架是否符合当前组合任务卡和心情主题继承规则。"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path


SOLFEGE = {"C": "do", "D": "re", "E": "mi", "F": "fa", "G": "sol", "A": "la", "B": "si"}
PITCH_RE = re.compile(r"^([A-G])([#b]?)(-?\d+)$")
DEGREE_TO_LETTER = {1: "C", 2: "D", 3: "E", 4: "F", 5: "G", 6: "A", 7: "B"}
SEMITONES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
SUPPORTED_CHORDS = {"C", "Dm", "Em", "F", "G", "Am"}
SUPPORTED_DRUMS = {"kick", "snare", "hihat"}


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def midi_number(pitch: object) -> int | None:
    if not isinstance(pitch, str):
        return None
    match = PITCH_RE.match(pitch)
    if not match:
        return None
    letter, accidental, octave_text = match.groups()
    value = 12 * (int(octave_text) + 1) + SEMITONES[letter] + {"": 0, "#": 1, "b": -1}[accidental]
    return value if 0 <= value <= 127 else None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", required=True, type=Path)
    parser.add_argument("--skeleton", required=True, type=Path)
    args = parser.parse_args()

    task = json.loads(args.task.read_text(encoding="utf-8"))
    skeleton = json.loads(args.skeleton.read_text(encoding="utf-8"))
    errors: list[str] = []

    if task.get("bars") != 2 or task.get("totalBeats") != 8:
        fail(errors, "当前产品任务必须定义为两小节、共 8 拍。")

    for field in ("kitId", "bpm", "timeSignature", "key", "bars"):
        if skeleton.get(field) != task.get(field):
            fail(errors, f"{field} 应为 {task.get(field)!r}，实际为 {skeleton.get(field)!r}。")

    if task.get("feelingId") and skeleton.get("feeling") != task["feelingId"]:
        fail(errors, f"feeling 必须保持当前母版编号 {task['feelingId']!r}。")
    if task.get("grooveId") and skeleton.get("groove") != task["grooveId"]:
        fail(errors, f"groove 必须保持当前律动编号 {task['grooveId']!r}。")

    melody = skeleton.get("melody")
    if not isinstance(melody, list) or not 1 <= len(melody) <= 64:
        fail(errors, "melody 必须包含 1—64 个旋律音。")
        melody = []

    for index, note in enumerate(melody, start=1):
        try:
            pitch = note["pitch"]
            beat = float(note["beat"])
            duration = float(note["duration"])
            solfege = note["solfege"]
        except (KeyError, TypeError, ValueError):
            fail(errors, f"第 {index} 个旋律音缺少 pitch、beat、duration 或 solfege。")
            continue

        match = PITCH_RE.match(pitch) if isinstance(pitch, str) else None
        if not match:
            fail(errors, f"第 {index} 个旋律音的 pitch 无法识别：{pitch}。")
            continue
        letter, accidental, octave_text = match.groups()
        octave = int(octave_text)
        if accidental:
            fail(errors, f"第 {index} 个旋律音 {pitch} 不属于严格的 C 大调音级。")
        if not all(math.isfinite(value) for value in (beat, duration)) or not (0 <= beat < task["totalBeats"]) or duration <= 0 or beat + duration > task["totalBeats"]:
            fail(errors, f"第 {index} 个旋律音超出两小节的 0—8 拍范围。")
        if not (letter in SOLFEGE and solfege == SOLFEGE[letter]):
            fail(errors, f"第 {index} 个旋律音 {pitch} 的唱名应为 {SOLFEGE.get(letter)!r}，实际为 {solfege!r}。")
        in_target_range = (octave == 4 and letter in SOLFEGE) or (octave == 5 and letter == "C")
        if not in_target_range:
            fail(errors, f"第 {index} 个旋律音 {pitch} 超出 C4—C5 的儿童测试音域。")

    try:
        melody_start = min(float(note["beat"]) for note in melody)
        melody_end = max(float(note["beat"]) + float(note["duration"]) for note in melody)
        if abs(melody_start) > 0.001 or abs(melody_end - task["totalBeats"]) > 0.001:
            fail(errors, f"主旋律必须从第 0 拍开始并在第 {task['totalBeats']} 拍结束，当前为第 {melody_start:g} 到第 {melody_end:g} 拍。")
    except (KeyError, TypeError, ValueError):
        pass

    core_motif = task.get("coreMotif", {}).get("scaleDegrees")
    if isinstance(core_motif, list) and core_motif:
        melody_letters = []
        for note in melody:
            match = PITCH_RE.match(str(note.get("pitch", "")))
            if match:
                melody_letters.append(match.group(1))
        motif_letters = [DEGREE_TO_LETTER.get(value, "?") for value in core_motif]
        inherited = any(
            melody_letters[index:index + len(motif_letters)] == motif_letters
            for index in range(max(0, len(melody_letters) - len(motif_letters) + 1))
        )
        if not inherited:
            fail(errors, f"主旋律没有完整继承心情核心动机：{'-'.join(motif_letters)}。")

    chords = skeleton.get("chords")
    if not isinstance(chords, list) or not 1 <= len(chords) <= 4:
        fail(errors, "chords 必须包含 1—4 个可渲染和弦。")
    else:
        chord_symbols: list[str] = []
        chord_beats: list[float] = []
        for index, chord in enumerate(chords, start=1):
            try:
                symbol = chord["symbol"]
                beat = float(chord["beat"])
            except (KeyError, TypeError, ValueError):
                fail(errors, f"第 {index} 个和弦缺少 symbol 或 beat。")
                continue
            if symbol not in SUPPORTED_CHORDS:
                fail(errors, f"第 {index} 个和弦 {symbol!r} 不属于当前 C 大调可用和弦。")
            if not math.isfinite(beat) or not (0 <= beat < task["totalBeats"]):
                fail(errors, f"第 {index} 个和弦开始拍超出 0—8 拍范围。")
            chord_symbols.append(symbol)
            chord_beats.append(beat)

        expected_symbols = task.get("harmonyPlan")
        if expected_symbols and chord_symbols != expected_symbols:
            fail(errors, "和弦必须完整继承心情母版并保持原顺序。")
        if len(chord_beats) == len(chords):
            if abs(chord_beats[0]) > 0.001:
                fail(errors, "第一个和弦必须从第 0 拍开始，保证两小节完整覆盖。")
            if any(current <= previous for previous, current in zip(chord_beats, chord_beats[1:])):
                fail(errors, "和弦开始拍必须严格递增；具体换和弦位置不作固定限制。")

    bass_roots = skeleton.get("bassRoots")
    if not isinstance(bass_roots, list) or not 1 <= len(bass_roots) <= 64:
        fail(errors, "bassRoots 必须包含 1—64 个可渲染贝斯音。")
    else:
        for index, note in enumerate(bass_roots, start=1):
            try:
                pitch = note["pitch"]
                beat = float(note["beat"])
                duration = float(note["duration"])
            except (KeyError, TypeError, ValueError):
                fail(errors, f"第 {index} 个贝斯音缺少 pitch、beat 或 duration。")
                continue
            if midi_number(pitch) is None:
                fail(errors, f"第 {index} 个贝斯音无法转换为有效 MIDI 音高：{pitch!r}。")
            if not all(math.isfinite(value) for value in (beat, duration)) or not (0 <= beat < task["totalBeats"]) or duration <= 0 or beat + duration > task["totalBeats"]:
                fail(errors, f"第 {index} 个贝斯音超出两小节的 0—8 拍范围。")

    drum_grid = skeleton.get("drumGrid")
    if not isinstance(drum_grid, list) or not 1 <= len(drum_grid) <= 128:
        fail(errors, "drumGrid 必须包含 1—128 个可渲染鼓事件。")
    else:
        for index, event in enumerate(drum_grid, start=1):
            try:
                instrument = event["instrument"]
                beat = float(event["beat"])
                duration = float(event["duration"])
            except (KeyError, TypeError, ValueError):
                fail(errors, f"第 {index} 个鼓事件缺少 instrument、beat 或 duration。")
                continue
            if instrument not in SUPPORTED_DRUMS:
                fail(errors, f"第 {index} 个鼓事件使用了无法渲染的乐器：{instrument!r}。")
            if not all(math.isfinite(value) for value in (beat, duration)) or not (0 <= beat < task["totalBeats"]) or duration <= 0 or beat + duration > task["totalBeats"]:
                fail(errors, f"第 {index} 个鼓事件超出两小节的 0—8 拍范围。")

    lion_allowed_beats = skeleton.get("lionAllowedBeats")
    if not isinstance(lion_allowed_beats, list) or len(lion_allowed_beats) > 64:
        fail(errors, "lionAllowedBeats 必须是最多64项的数组；该字段仅兼容旧数据，可以为空。")
    else:
        for index, beat in enumerate(lion_allowed_beats, start=1):
            try:
                position = float(beat)
            except (TypeError, ValueError):
                fail(errors, f"lionAllowedBeats 第 {index} 项不是数字。")
                continue
            if not math.isfinite(position) or not (0 <= position < task["totalBeats"]):
                fail(errors, f"lionAllowedBeats 第 {index} 项超出 0—8 拍范围。")

    lion_notes = skeleton.get("lionNotes")
    if not isinstance(lion_notes, list) or not 1 <= len(lion_notes) <= 64:
        fail(errors, "lionNotes 必须包含 1—64 个可渲染萨克斯音。")
    else:
        for index, note in enumerate(lion_notes, start=1):
            try:
                pitch = note["pitch"]
                beat = float(note["beat"])
                duration = float(note["duration"])
                velocity = int(note["velocity"])
            except (KeyError, TypeError, ValueError):
                fail(errors, f"第 {index} 个萨克斯音缺少 pitch、beat、duration 或 velocity。")
                continue
            match = PITCH_RE.match(pitch) if isinstance(pitch, str) else None
            if not match:
                fail(errors, f"第 {index} 个萨克斯音的 pitch 无法识别：{pitch!r}。")
                continue
            letter, accidental, octave_text = match.groups()
            octave = int(octave_text)
            if accidental or not (octave == 4 or (octave == 5 and letter in {"C", "D", "E", "F", "G"})):
                fail(errors, f"第 {index} 个萨克斯音 {pitch} 必须在 C 大调 C4—G5 可用音域内。")
            if not all(math.isfinite(value) for value in (beat, duration)) or not (0 <= beat < task["totalBeats"]) or duration <= 0 or beat + duration > task["totalBeats"]:
                fail(errors, f"第 {index} 个萨克斯音超出两小节的 0—8 拍范围。")
            if not (1 <= velocity <= 127):
                fail(errors, f"第 {index} 个萨克斯音力度必须在 MIDI 的 1—127 范围内。")

    if errors:
        print("检查未通过：")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"检查通过：两小节8拍、{task['bpm']} BPM、母版动机与和声继承、所有分轨数据可渲染且未越界。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
