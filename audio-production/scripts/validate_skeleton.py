"""检查音乐骨架是否符合 happy_bounce_v01 的固定规则。"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


SOLFEGE = {"C": "do", "D": "re", "E": "mi", "F": "fa", "G": "sol", "A": "la", "B": "si"}
PITCH_RE = re.compile(r"^([A-G])([#b]?)(-?\d+)$")


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

    if errors:
        print("检查未通过：")
        for error in errors:
            print(f"- {error}")
        return 1

    print("检查通过：两小节、96 BPM、4/4、C 大调、首调唱名与儿童测试音域均符合任务卡。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
