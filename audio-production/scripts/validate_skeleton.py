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
CHORD_TONES = {
    "C": {"C", "E", "G"}, "Dm": {"D", "F", "A"}, "Em": {"E", "G", "B"},
    "F": {"F", "A", "C"}, "G": {"G", "B", "D"}, "Am": {"A", "C", "E"},
}
CHORD_ROOT_FIFTH = {
    "C": {"C", "G"}, "Dm": {"D", "A"}, "Em": {"E", "B"},
    "F": {"F", "C"}, "G": {"G", "D"}, "Am": {"A", "E"},
}
TIMING_TOLERANCE = 0.02


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


def parsed_note(note: object) -> tuple[float, float, str, int] | None:
    if not isinstance(note, dict):
        return None
    try:
        beat = float(note["beat"])
        duration = float(note["duration"])
        pitch = str(note["pitch"])
    except (KeyError, TypeError, ValueError):
        return None
    match = PITCH_RE.match(pitch)
    midi = midi_number(pitch)
    if not match or midi is None or not math.isfinite(beat) or not math.isfinite(duration):
        return None
    return beat, duration, match.group(1), midi


def is_integer_beat(beat: float) -> bool:
    return abs(beat - round(beat)) <= TIMING_TOLERANCE


def is_triplet_offbeat(beat: float) -> bool:
    fraction = beat - math.floor(beat)
    return abs(fraction - 0.333) <= TIMING_TOLERANCE or abs(fraction - 0.667) <= TIMING_TOLERANCE


def active_chord(chord_timeline: list[tuple[float, str]], beat: float) -> str | None:
    current = None
    for chord_beat, symbol in chord_timeline:
        if chord_beat <= beat + TIMING_TOLERANCE:
            current = symbol
        else:
            break
    return current


def matches_timing_grid(value: float, groove_id: str) -> bool:
    fraction = value - math.floor(value)
    allowed = (0.0, 1 / 3, 2 / 3, 1.0) if groove_id == "sway" else (0.0, 0.25, 0.5, 0.75, 1.0)
    return min(abs(fraction - candidate) for candidate in allowed) <= TIMING_TOLERANCE


def check_monophonic_track(errors: list[str], notes: list[object], label: str) -> None:
    parsed = sorted((item for note in notes if (item := parsed_note(note)) is not None), key=lambda item: item[0])
    for previous, current in zip(parsed, parsed[1:]):
        if current[0] < previous[0] + previous[1] - TIMING_TOLERANCE:
            fail(errors, f"{label}出现音符重叠；同一件单音乐器一次只能清楚演奏一个音。")
            return


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
    chord_timeline: list[tuple[float, str]] = []
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
            if symbol in SUPPORTED_CHORDS and math.isfinite(beat):
                chord_timeline.append((beat, symbol))

        expected_symbols = task.get("harmonyPlan")
        if expected_symbols and chord_symbols != expected_symbols:
            fail(errors, "和弦必须完整继承心情母版并保持原顺序。")
        if len(chord_beats) == len(chords):
            if abs(chord_beats[0]) > 0.001:
                fail(errors, "第一个和弦必须从第 0 拍开始，保证两小节完整覆盖。")
            if any(current <= previous for previous, current in zip(chord_beats, chord_beats[1:])):
                fail(errors, "和弦开始拍必须严格递增；具体换和弦位置不作固定限制。")
            groove_id_for_chords = str(task.get("grooveId", ""))
            for index, beat in enumerate(chord_beats, start=1):
                if not matches_timing_grid(beat, groove_id_for_chords):
                    grid_label = "三连音式整数拍、n+0.333或n+0.667" if groove_id_for_chords == "sway" else "直拍整数拍、八分或十六分位置"
                    fail(errors, f"第 {index} 个和弦换拍没有落在当前律动的{grid_label}时间网格上。")

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
            pitch_value = midi_number(pitch)
            if pitch_value is None:
                fail(errors, f"第 {index} 个贝斯音无法转换为有效 MIDI 音高：{pitch!r}。")
            match = PITCH_RE.match(pitch) if isinstance(pitch, str) else None
            if match:
                letter, accidental, octave_text = match.groups()
                octave = int(octave_text)
                in_bass_range = octave == 2 or (octave == 3 and letter == "C")
                if accidental or not in_bass_range:
                    fail(errors, f"第 {index} 个贝斯音 {pitch} 超出允许名单；只能使用 C2、D2、E2、F2、G2、A2、B2、C3，禁止 D3 及以上音。")
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
                velocity = int(event.get("velocity", 92))
            except (KeyError, TypeError, ValueError):
                fail(errors, f"第 {index} 个鼓事件缺少 instrument、beat 或 duration。")
                continue
            if instrument not in SUPPORTED_DRUMS:
                fail(errors, f"第 {index} 个鼓事件使用了无法渲染的乐器：{instrument!r}。")
            if not all(math.isfinite(value) for value in (beat, duration)) or not (0 <= beat < task["totalBeats"]) or duration <= 0 or beat + duration > task["totalBeats"]:
                fail(errors, f"第 {index} 个鼓事件超出两小节的 0—8 拍范围。")
            if not 1 <= velocity <= 127:
                fail(errors, f"第 {index} 个鼓事件的力度必须在 1—127 之间。")

        locked_events = task.get("grooveTemplate", {}).get("drumCore", {}).get("lockedEvents", {})
        for instrument, expected_beats in locked_events.items():
            actual_beats = []
            for event in drum_grid:
                if isinstance(event, dict) and event.get("instrument") == instrument:
                    try:
                        actual_beats.append(float(event["beat"]))
                    except (KeyError, TypeError, ValueError):
                        pass
            for expected in expected_beats:
                if not any(abs(actual - float(expected)) <= TIMING_TOLERANCE for actual in actual_beats):
                    fail(errors, f"鼓组缺少当前律动锁定的 {instrument} 核心拍点：第 {expected} 拍。")

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
            in_lion_range = (octave == 3 and letter in {"A", "B"}) or octave == 4 or (octave == 5 and letter in {"C", "D", "E", "F", "G"})
            if accidental or not in_lion_range:
                fail(errors, f"第 {index} 个萨克斯音 {pitch} 必须在 C 大调 A3—G5 可用音域内。")
            if not all(math.isfinite(value) for value in (beat, duration)) or not (0 <= beat < task["totalBeats"]) or duration <= 0 or beat + duration > task["totalBeats"]:
                fail(errors, f"第 {index} 个萨克斯音超出两小节的 0—8 拍范围。")
            if not (1 <= velocity <= 127):
                fail(errors, f"第 {index} 个萨克斯音力度必须在 MIDI 的 1—127 范围内。")

    pitched_tracks = (("主旋律", melody), ("贝斯", bass_roots), ("萨克斯", lion_notes))
    groove_id = str(task.get("grooveId", ""))
    for label, notes in pitched_tracks:
        if not isinstance(notes, list):
            continue
        check_monophonic_track(errors, notes, label)
        for index, note in enumerate(notes, start=1):
            parsed = parsed_note(note)
            if parsed is None:
                continue
            beat, duration, _, _ = parsed
            if not matches_timing_grid(beat, groove_id) or not matches_timing_grid(beat + duration, groove_id):
                grid_label = "三连音式整数拍、n+0.333或n+0.667" if groove_id == "sway" else "直拍整数拍、八分或十六分位置"
                fail(errors, f"第 {index} 个{label}音没有落在当前律动的{grid_label}时间网格上。")

    if groove_id == "steady" and isinstance(melody, list) and isinstance(bass_roots, list) and isinstance(drum_grid, list):
        melody_parsed = [parsed for note in melody if (parsed := parsed_note(note)) is not None]
        bass_parsed = [parsed for note in bass_roots if (parsed := parsed_note(note)) is not None]
        if melody_parsed and sum(is_integer_beat(item[0]) for item in melody_parsed) / len(melody_parsed) < 0.7:
            fail(errors, "稳稳走的旋律至少70%的音必须从整数拍开始；请把装饰性弱拍收回到稳定步伐，不要写成摇摆节奏。")
        if not 3 <= len(bass_parsed) <= 5:
            fail(errors, "稳稳走的贝斯应使用3—5个长音形成稳定脚步。")
        if any(not is_integer_beat(item[0]) or item[1] < 1 - TIMING_TOLERANCE for item in bass_parsed):
            fail(errors, "稳稳走的贝斯必须全部从整数拍开始且每音至少持续1拍。")
        for event in drum_grid:
            try:
                if event.get("instrument") == "hihat" and not is_integer_beat(float(event["beat"])):
                    fail(errors, "稳稳走的踩镲只保留整数拍核心脚步，不得加入弱拍踩镲，以免接近摇一摇。")
                    break
            except (KeyError, TypeError, ValueError):
                continue

    if groove_id == "sway" and isinstance(melody, list) and isinstance(bass_roots, list):
        melody_parsed = [parsed for note in melody if (parsed := parsed_note(note)) is not None]
        bass_parsed = [parsed for note in bass_roots if (parsed := parsed_note(note)) is not None]
        melody_pushes = sum(is_triplet_offbeat(item[0]) for item in melody_parsed)
        bass_pushes = sum(is_triplet_offbeat(item[0]) for item in bass_parsed)
        if melody_pushes < 2:
            fail(errors, "摇一摇的主旋律至少需要2个三连音弱拍进入，不能只在一个局部象征性使用Shuffle。")
        if len(bass_parsed) < 6 or bass_pushes < 2:
            fail(errors, "摇一摇的贝斯至少需要6个音，并包含至少2个三连音弱拍进入，以形成持续可听见的左右摆动。")

    if chord_timeline:
        for label, notes in (("主旋律", melody), ("萨克斯", lion_notes)):
            if not isinstance(notes, list):
                continue
            parsed_track = sorted(
                ((index, note, parsed) for index, note in enumerate(notes, start=1) if (parsed := parsed_note(note)) is not None),
                key=lambda item: item[2][0],
            )
            for index, note, parsed in parsed_track:
                beat, duration, letter, midi = parsed
                chord = active_chord(chord_timeline, beat)
                if duration >= 1.5 - TIMING_TOLERANCE and chord and letter not in CHORD_TONES[chord]:
                    fail(errors, f"第 {index} 个{label}长音 {note.get('pitch')} 在 {chord} 和弦上持续较久但不是和弦音；请优先缩短到1.5拍以下或移动后续换和弦拍点，不得替换母版和弦。")
                note_end = beat + duration
                for change_beat, new_chord in chord_timeline[1:]:
                    if not (beat + TIMING_TOLERANCE < change_beat < note_end - TIMING_TOLERANCE):
                        continue
                    if letter in CHORD_TONES[new_chord]:
                        continue
                    resolved = False
                    for _, _, next_parsed in parsed_track:
                        next_beat, _, next_letter, next_midi = next_parsed
                        if next_beat < change_beat - TIMING_TOLERANCE:
                            continue
                        if next_beat > change_beat + 1 + TIMING_TOLERANCE:
                            break
                        if next_letter in CHORD_TONES[new_chord] and abs(next_midi - midi) <= 2:
                            resolved = True
                            break
                    if not resolved:
                        fail(errors, f"第 {index} 个{label}音 {note.get('pitch')} 跨到第 {change_beat:g} 拍的 {new_chord} 和弦后不是和弦音，也没有在1拍内级进解决；请缩短该音、移动换和弦拍点或补充级进解决，不得替换母版和弦。")

        if isinstance(bass_roots, list):
            for index, note in enumerate(bass_roots, start=1):
                parsed = parsed_note(note)
                if parsed is None:
                    continue
                beat, duration, letter, _ = parsed
                chord = active_chord(chord_timeline, beat)
                strong_beat = abs(beat - round(beat)) <= TIMING_TOLERANCE
                if chord and (strong_beat or duration >= 1 - TIMING_TOLERANCE) and letter not in CHORD_ROOT_FIFTH[chord]:
                    fail(errors, f"第 {index} 个贝斯重拍或长音 {note.get('pitch')} 没有使用 {chord} 和弦的根音或五度音；请修改该贝斯音或将其移到弱拍，不得替换母版和弦。")

    if isinstance(melody, list) and isinstance(lion_notes, list):
        for melody_note in melody:
            melody_parsed = parsed_note(melody_note)
            if melody_parsed is None:
                continue
            melody_beat, melody_duration, _, melody_midi = melody_parsed
            for lion_note in lion_notes:
                lion_parsed = parsed_note(lion_note)
                if lion_parsed is None:
                    continue
                lion_beat, lion_duration, _, lion_midi = lion_parsed
                overlap = min(melody_beat + melody_duration, lion_beat + lion_duration) - max(melody_beat, lion_beat)
                if overlap >= 0.5 - TIMING_TOLERANCE and 0 < abs(melody_midi - lion_midi) <= 2:
                    fail(errors, f"主旋律 {melody_note.get('pitch')} 与萨克斯 {lion_note.get('pitch')} 持续相邻摩擦超过0.5拍，请改用协和音程或错开进入。")

    if isinstance(lion_notes, list):
        parsed_lion = sorted((item for note in lion_notes if (item := parsed_note(note)) is not None), key=lambda item: item[0])
        phrases: list[list[tuple[float, float, str, int]]] = []
        for note in parsed_lion:
            if not phrases or note[0] - (phrases[-1][-1][0] + phrases[-1][-1][1]) > 0.5 + TIMING_TOLERANCE:
                phrases.append([note])
            else:
                phrases[-1].append(note)
        if len(phrases) > 2:
            fail(errors, "萨克斯被切成超过2个彼此分离的片段，容易听成断续点缀；请合并为1—2个完整乐句或背景长音。")
        for phrase in phrases:
            if len(phrase) == 1 and phrase[0][1] < 1.5 - TIMING_TOLERANCE:
                fail(errors, "萨克斯存在短于1.5拍且没有与前后音连接的孤立单音，请延长为背景音或补成完整回应乐句。")
            if len(phrase) > 4:
                fail(errors, "单个萨克斯回应超过4个音，容易成为第二条主旋律；请简化为2—4个连贯音。")

    if all(isinstance(notes, list) for notes in (melody, bass_roots, lion_notes)):
        short_starts = []
        for notes in (melody, bass_roots, lion_notes):
            short_starts.append([
                parsed[0] for note in notes
                if (parsed := parsed_note(note)) is not None and parsed[1] < 0.75 - TIMING_TOLERANCE
            ])
        for beat in short_starts[0]:
            if any(abs(beat - other) <= TIMING_TOLERANCE for other in short_starts[1]) and any(abs(beat - other) <= TIMING_TOLERANCE for other in short_starts[2]):
                fail(errors, f"第 {beat:g} 拍主旋律、贝斯和萨克斯同时进行短音变化，容易互相争抢；请至少简化一个陪衬声部。")
                break

    if errors:
        print("检查未通过：")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"检查通过：两小节8拍、{task['bpm']} BPM、母版与鼓型继承、时间网格统一，未发现明显声部碰撞或孤立萨克斯音。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
