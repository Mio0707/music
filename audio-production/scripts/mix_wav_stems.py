"""把格式一致的 WAV 分轨按原音量相加，生成本地混音检查文件。"""

from __future__ import annotations

import argparse
import array
import sys
import wave
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inputs", required=True, nargs="+", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--gains", nargs="+", type=float)
    args = parser.parse_args()

    gains = args.gains or [1.0] * len(args.inputs)
    if len(gains) != len(args.inputs):
        parser.error("--gains 的数量必须与 --inputs 一致")
    if any(gain < 0 for gain in gains):
        parser.error("--gains 不能小于 0")

    tracks: list[array.array[int]] = []
    expected_format: tuple[int, int, int, int] | None = None
    for path in args.inputs:
        with wave.open(str(path), "rb") as wav_file:
            wav_format = (
                wav_file.getnchannels(),
                wav_file.getsampwidth(),
                wav_file.getframerate(),
                wav_file.getnframes(),
            )
            if expected_format is None:
                expected_format = wav_format
            elif wav_format != expected_format:
                parser.error(f"分轨格式或长度不一致：{path}")
            samples = array.array("h")
            samples.frombytes(wav_file.readframes(wav_file.getnframes()))
            if sys.byteorder != "little":
                samples.byteswap()
            tracks.append(samples)

    assert expected_format is not None
    mixed = array.array("h")
    clipped = 0
    for values in zip(*tracks):
        value = round(sum(value * gain for value, gain in zip(values, gains)))
        if value < -32768 or value > 32767:
            clipped += 1
        mixed.append(max(-32768, min(32767, value)))
    if sys.byteorder != "little":
        mixed.byteswap()

    channels, sample_width, sample_rate, _ = expected_format
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(args.output), "wb") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(mixed.tobytes())

    print(f"已导出混音检查文件：{args.output}；削波样本：{clipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
