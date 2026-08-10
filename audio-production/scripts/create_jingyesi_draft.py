from __future__ import annotations

import json
import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "prototype" / "assets" / "music" / "longing_steady" / "v01"
VOICE = ROOT / "prototype" / "assets" / "solfege" / "voice-katy-child-clean-v2"
OUT = ROOT / "output" / "jingyesi-draft"

SAMPLE_RATE = 48_000
BPM = 88
BEAT_SECONDS = 60 / BPM
COUNT_IN_BEATS = 4

POEM_LINES = [
    "床前明月光",
    "疑是地上霜",
    "举头望明月",
    "低头思故乡",
]

# 先用现有唱名音频代替真正古诗歌声，验证旋律与伴奏是否相配。
SOLFEGE_LINES = [
    ["mi", "sol", "la", "sol", "mi"],
    ["mi", "sol", "la", "sol", "mi"],
    ["mi", "sol", "la", "sol", "la"],
    ["mi", "sol", "la", "sol", "do"],
]

# 根据用户清唱录音提取的四句旋律轮廓。音高已吸附到 C 大调，并把第二句
# 开头的强张力音下调一级，使它能与 longing_steady 的 F 和弦稳定叠加。
RECORDED_SOLFEGE_LINES = [
    ["la", "do", "mi", "sol", "la"],
    ["la", "sol", "mi", "do", "re"],
    ["re", "la", "sol", "la", "do"],
    ["la", "fa", "mi", "do", "re"],
]

RECORDED_NOTE_BEATS = [
    [0, 1.5, 3, 4, 5],
    [0, 1.5, 2.5, 4, 5],
    [0, 2, 3.5, 4, 5],
    [0, 1, 2.5, 3.5, 5],
]


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as handle:
        if handle.getframerate() != SAMPLE_RATE or handle.getsampwidth() != 2:
            raise ValueError(f"Unexpected WAV format: {path}")
        channels = handle.getnchannels()
        samples = np.frombuffer(handle.readframes(handle.getnframes()), dtype="<i2").astype(np.float32)
    samples = samples.reshape(-1, channels) / 32768.0
    if channels == 1:
        samples = np.repeat(samples, 2, axis=1)
    return samples


def fade(audio: np.ndarray, fade_in_ms: int = 18, fade_out_ms: int = 60) -> np.ndarray:
    result = audio.copy()
    fade_in = min(len(result), int(SAMPLE_RATE * fade_in_ms / 1000))
    fade_out = min(len(result), int(SAMPLE_RATE * fade_out_ms / 1000))
    if fade_in:
        result[:fade_in] *= np.linspace(0, 1, fade_in, dtype=np.float32)[:, None]
    if fade_out:
        result[-fade_out:] *= np.linspace(1, 0, fade_out, dtype=np.float32)[:, None]
    return result


def add_at(target: np.ndarray, source: np.ndarray, start_seconds: float, gain: float = 1.0) -> None:
    start = round(start_seconds * SAMPLE_RATE)
    end = min(len(target), start + len(source))
    if end > start:
        target[start:end] += source[: end - start] * gain


def count_in_click(strength: float) -> np.ndarray:
    length = int(SAMPLE_RATE * 0.12)
    time = np.arange(length, dtype=np.float32) / SAMPLE_RATE
    tone = np.sin(2 * np.pi * (880 if strength > 0.8 else 660) * time)
    envelope = np.exp(-time * 34)
    mono = tone * envelope * 0.25 * strength
    return np.column_stack([mono, mono]).astype(np.float32)


def write_wav(path: Path, audio: np.ndarray) -> None:
    peak = float(np.max(np.abs(audio))) or 1.0
    if peak > 0.96:
        audio = audio * (0.96 / peak)
    pcm = np.clip(audio, -1, 1)
    pcm = (pcm * 32767).astype("<i2")
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(pcm.tobytes())


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    dog = read_wav(PACK / "stems" / "dog.wav")
    cat = read_wav(PACK / "stems" / "cat.wav")
    bear = read_wav(PACK / "stems" / "bear.wav")
    lion = read_wav(PACK / "stems" / "lion.wav")
    section_seconds = len(dog) / SAMPLE_RATE
    intro_seconds = COUNT_IN_BEATS * BEAT_SECONDS
    total_seconds = intro_seconds + section_seconds * 4 + 0.8
    accompaniment = np.zeros((round(total_seconds * SAMPLE_RATE), 2), dtype=np.float32)
    mix = np.zeros_like(accompaniment)

    # 用一个简单的儿童编排作试听：小狗和小猫贯穿，小熊从第二段加入，小狮子只在结尾段出现。
    arrangements = [
        ((dog, 0.58), (cat, 0.42)),
        ((dog, 0.58), (cat, 0.42), (bear, 0.28)),
        ((dog, 0.58), (cat, 0.42), (bear, 0.28)),
        ((dog, 0.58), (cat, 0.42), (bear, 0.28), (lion, 0.16)),
    ]
    for section_index, tracks in enumerate(arrangements):
        section_start = intro_seconds + section_index * section_seconds
        for track, gain in tracks:
            add_at(accompaniment, fade(track), section_start, gain)

    mix += accompaniment

    for beat in range(COUNT_IN_BEATS):
        add_at(mix, count_in_click(1.0 if beat == 0 else 0.65), beat * BEAT_SECONDS)

    voice_names = {name for lines in (SOLFEGE_LINES, RECORDED_SOLFEGE_LINES) for line in lines for name in line}
    voice_cache = {name: fade(read_wav(VOICE / f"{name}.wav"), 12, 90) for name in voice_names}
    lyric_timing = []
    for line_index, (text, notes) in enumerate(zip(POEM_LINES, SOLFEGE_LINES)):
        section_start = intro_seconds + line_index * section_seconds
        for char_index, (character, note) in enumerate(zip(text, notes)):
            note_start = section_start + char_index * BEAT_SECONDS
            sample = voice_cache[note]
            max_note_seconds = 0.62 if char_index < 4 else 1.02
            sample = sample[: round(max_note_seconds * SAMPLE_RATE)]
            add_at(mix, sample, note_start, 0.88)
            lyric_timing.append({
                "line": line_index + 1,
                "character": character,
                "solfege": note,
                "startSeconds": round(note_start, 3),
                "durationSeconds": round(len(sample) / SAMPLE_RATE, 3),
            })

    final_fade = int(SAMPLE_RATE * 0.7)
    accompaniment[-final_fade:] *= np.linspace(1, 0, final_fade, dtype=np.float32)[:, None]
    mix[-final_fade:] *= np.linspace(1, 0, final_fade, dtype=np.float32)[:, None]

    accompaniment_path = OUT / "jingyesi-longing-steady-accompaniment.wav"
    draft_path = OUT / "jingyesi-longing-steady-solfege-draft.wav"
    recorded_draft_path = OUT / "jingyesi-longing-steady-recorded-melody-draft.wav"
    timing_path = OUT / "jingyesi-draft-timing.json"
    write_wav(accompaniment_path, accompaniment)
    write_wav(draft_path, mix)

    recorded_mix = accompaniment.copy()
    for beat in range(COUNT_IN_BEATS):
        add_at(recorded_mix, count_in_click(1.0 if beat == 0 else 0.65), beat * BEAT_SECONDS)
    for line_index, (notes, note_beats) in enumerate(zip(RECORDED_SOLFEGE_LINES, RECORDED_NOTE_BEATS)):
        section_start = intro_seconds + line_index * section_seconds
        for note_index, (note, note_beat) in enumerate(zip(notes, note_beats)):
            sample = voice_cache[note]
            next_beat = note_beats[note_index + 1] if note_index + 1 < len(note_beats) else 6.5
            note_seconds = max(0.38, (next_beat - note_beat) * BEAT_SECONDS - 0.08)
            sample = sample[: round(min(note_seconds, 1.02) * SAMPLE_RATE)]
            add_at(recorded_mix, sample, section_start + note_beat * BEAT_SECONDS, 0.88)
    recorded_mix[-final_fade:] *= np.linspace(1, 0, final_fade, dtype=np.float32)[:, None]
    write_wav(recorded_draft_path, recorded_mix)
    timing_path.write_text(json.dumps({
        "poem": "静夜思",
        "author": "李白",
        "pack": "longing_steady/v01",
        "bpm": BPM,
        "note": "当前用唱名代替古诗发音，只验证旋律、节奏、换气和伴奏关系。",
        "lines": POEM_LINES,
        "timing": lyric_timing,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(draft_path)
    print(recorded_draft_path)
    print(accompaniment_path)
    print(timing_path)


if __name__ == "__main__":
    main()
