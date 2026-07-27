"""检查音乐骨架是否符合当前组合任务卡和心情主题继承规则。"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


SOLFEGE = {"C": "do", "D": "re", "E": "mi", "F": "fa", "G": "sol", "A": "la", "B": "si"}
PITCH_RE = re.compile(r"^([A-G])([#b]?)(-?\d+)$")
DEGREE_TO_LETTER = {1: "C", 2: "D", 3: "E", 4: "F", 5: "G", 6: "A", 7: "B"}


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", required=True, type=Path)
    parser.add_argument("--skeleton", required=True, type=Path)
    args = parser.parse_args()

    task = json.loads(args.task.read_text(encoding="utf-8"))
    skeleton = json.loads(args.skeleton.read_text(encoding="utf-8"))
    errors: list[str] = []

    for field in ("kitId", "bpm", "timeSignature", "key", "bars"):
        if skeleton.get(field) != task.get(field):
            fail(errors, f"{field} 应为 {task.get(field)!r}，实际为 {skeleton.get(field)!r}。")

    melody = skeleton.get("melody")
    if not isinstance(melody, list) or not melody:
        fail(errors, "melody 必须是非空数组。")
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

        match = PITCH_RE.match(pitch)
        if not match:
            fail(errors, f"第 {index} 个旋律音的 pitch 无法识别：{pitch}。")
            continue
        letter, accidental, octave_text = match.groups()
        octave = int(octave_text)
        if accidental:
            fail(errors, f"第 {index} 个旋律音 {pitch} 不属于严格的 C 大调音级。")
        if not (0 <= beat < task["totalBeats"]) or duration <= 0 or beat + duration > task["totalBeats"]:
            fail(errors, f"第 {index} 个旋律音超出两小节的 0—8 拍范围。")
        if not (letter in SOLFEGE and solfege == SOLFEGE[letter]):
            fail(errors, f"第 {index} 个旋律音 {pitch} 的唱名应为 {SOLFEGE.get(letter)!r}，实际为 {solfege!r}。")
        in_target_range = (octave == 4 and letter in SOLFEGE) or (octave == 5 and letter == "C")
        if not in_target_range:
            fail(errors, f"第 {index} 个旋律音 {pitch} 超出 C4—C5 的儿童测试音域。")

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

    primary_plan = task.get("coreMotif") and task.get("emotionThemeVersion")
    if primary_plan:
        chords = skeleton.get("chords")
        expected_symbols = task.get("harmonyPlan")
        if expected_symbols and (
            not isinstance(chords, list)
            or [item.get("symbol") for item in chords] != expected_symbols
            or [float(item.get("beat", -1)) for item in chords] != [0.0, 2.0, 4.0, 6.0]
        ):
            fail(errors, "和弦必须完整继承心情母版，并从第0、2、4、6拍开始。")

    lion_allowed_beats = skeleton.get("lionAllowedBeats")
    if not isinstance(lion_allowed_beats, list) or not lion_allowed_beats:
        fail(errors, "lionAllowedBeats 必须是非空数组。")
    else:
        for index, beat in enumerate(lion_allowed_beats, start=1):
            try:
                position = float(beat)
            except (TypeError, ValueError):
                fail(errors, f"第 {index} 个小狮子允许拍点不是数字。")
                continue
            if not (0 <= position < task["totalBeats"]):
                fail(errors, f"第 {index} 个小狮子允许拍点超出两小节的 0—8 拍范围。")

    lion_notes = skeleton.get("lionNotes")
    if not isinstance(lion_notes, list) or not 1 <= len(lion_notes) <= 4:
        fail(errors, "lionNotes 必须包含 1—4 个萨克斯音。")
    else:
        allowed_positions = {float(beat) for beat in lion_allowed_beats} if isinstance(lion_allowed_beats, list) else set()
        for index, note in enumerate(lion_notes, start=1):
            try:
                pitch = note["pitch"]
                beat = float(note["beat"])
                duration = float(note["duration"])
                velocity = int(note["velocity"])
            except (KeyError, TypeError, ValueError):
                fail(errors, f"第 {index} 个萨克斯音缺少 pitch、beat、duration 或 velocity。")
                continue
            match = PITCH_RE.match(pitch)
            if not match:
                fail(errors, f"第 {index} 个萨克斯音的 pitch 无法识别：{pitch}。")
                continue
            letter, accidental, octave_text = match.groups()
            octave = int(octave_text)
            if accidental or letter not in SOLFEGE or not (octave == 4 or (octave == 5 and letter in {"C", "D", "E", "F", "G"})):
                fail(errors, f"第 {index} 个萨克斯音 {pitch} 必须在 C 大调 C4—G5 音域内。")
            if beat not in allowed_positions:
                fail(errors, f"第 {index} 个萨克斯音必须从 lionAllowedBeats 中指定的拍点开始。")
            if not (0 < duration <= 0.5) or beat + duration > task["totalBeats"]:
                fail(errors, f"第 {index} 个萨克斯音时长必须在 0—0.5 拍内，且不能超出两小节。")
            if not (45 <= velocity <= 85):
                fail(errors, f"第 {index} 个萨克斯音力度必须在 45—85 之间。")

    if errors:
        print("检查未通过：")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"检查通过：两小节、{task['bpm']} BPM、4/4、C 大调、心情主题继承、首调唱名与儿童测试音域均符合任务卡。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
