"""用 FluidSynth 和固定 SoundFont 把 MIDI 渲染为 48 kHz WAV。"""

from __future__ import annotations

import argparse
import array
import subprocess
import sys
import tempfile
import wave
from pathlib import Path


SAMPLE_RATE = 48_000
CHANNELS = 2
SAMPLE_WIDTH = 2  # 16-bit PCM


def wrap_loop_tail(pcm: bytes, target_frames: int, crossfade_frames: int) -> bytes:
    """把循环终点之后的自然尾音，短暂叠回循环开头以减小接缝。"""
    samples = array.array("h")
    samples.frombytes(pcm)
    if sys.byteorder != "little":
        samples.byteswap()

    available_tail_frames = len(samples) // CHANNELS - target_frames
    blend_frames = min(crossfade_frames, target_frames, available_tail_frames)
    for frame in range(max(0, blend_frames)):
        start_weight = frame / max(1, blend_frames - 1)
        tail_weight = 1.0 - start_weight
        for channel in range(CHANNELS):
            start_index = frame * CHANNELS + channel
            tail_index = (target_frames + frame) * CHANNELS + channel
            mixed = round(samples[start_index] * start_weight + samples[tail_index] * tail_weight)
            samples[start_index] = max(-32768, min(32767, mixed))

    if sys.byteorder != "little":
        samples.byteswap()
    return samples.tobytes()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fluidsynth", required=True, type=Path)
    parser.add_argument("--soundfont", required=True, type=Path)
    parser.add_argument("--midi", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument(
        "--gain",
        type=float,
        default=0.45,
        help="FluidSynth 渲染增益，默认 0.45。调整单条分轨音量时使用。",
    )
    parser.add_argument(
        "--duration-seconds",
        type=float,
        help="可选：把输出严格裁剪或补静音到指定秒数，便于制作循环。",
    )
    parser.add_argument(
        "--loop-crossfade-ms",
        type=float,
        default=0,
        help="把终点之后的自然尾音交叉叠回开头；制作循环时建议 10–20 毫秒。",
    )
    args = parser.parse_args()

    if args.gain <= 0:
        parser.error("--gain 必须大于 0")

    for path in (args.fluidsynth, args.soundfont, args.midi):
        if not path.is_file():
            parser.error(f"找不到文件：{path}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".pcm", delete=False) as temporary:
        pcm_path = Path(temporary.name)

    command = [
        str(args.fluidsynth),
        "-ni",
        "-F", str(pcm_path),
        "-O", "s16",
        "-r", str(SAMPLE_RATE),
        "-g", str(args.gain),
        "-R", "0",
        "-C", "0",
        str(args.soundfont),
        str(args.midi),
    ]
    try:
        result = subprocess.run(command, text=True, capture_output=True, encoding="utf-8")
        if result.returncode != 0:
            raise RuntimeError(result.stderr or result.stdout)
        pcm = pcm_path.read_bytes()
        if args.duration_seconds is not None:
            if args.duration_seconds <= 0:
                parser.error("--duration-seconds 必须大于 0")
            frame_size = CHANNELS * SAMPLE_WIDTH
            target_frames = round(args.duration_seconds * SAMPLE_RATE)
            target_bytes = target_frames * frame_size
            if args.loop_crossfade_ms < 0:
                parser.error("--loop-crossfade-ms 不能小于 0")
            if args.loop_crossfade_ms:
                crossfade_frames = round(args.loop_crossfade_ms / 1000 * SAMPLE_RATE)
                pcm = wrap_loop_tail(pcm, target_frames, crossfade_frames)
            pcm = pcm[:target_bytes].ljust(target_bytes, b"\x00")
        elif args.loop_crossfade_ms:
            parser.error("使用 --loop-crossfade-ms 时必须同时指定 --duration-seconds")
        with wave.open(str(args.output), "wb") as wav_file:
            wav_file.setnchannels(CHANNELS)
            wav_file.setsampwidth(SAMPLE_WIDTH)
            wav_file.setframerate(SAMPLE_RATE)
            wav_file.writeframes(pcm)
    finally:
        pcm_path.unlink(missing_ok=True)

    seconds = len(pcm) / (SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH)
    print(f"已导出 WAV：{args.output}（{seconds:.3f} 秒，48 kHz，16-bit stereo）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
