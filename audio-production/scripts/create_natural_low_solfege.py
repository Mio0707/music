"""Create natural low-register solfege samples from the existing Katy pack.

The browser previously lowered these notes by changing playback speed. That
also lowered the singer's vocal colour. This script uses a small TD-PSOLA
overlap/add pass so the fundamental pitch moves down while the recorded vocal
shape is retained more faithfully.
"""

from __future__ import annotations

import sys
import wave
from pathlib import Path

LOCAL_TOOL_DIR = Path(__file__).resolve().parents[1] / ".audio-tools"
if LOCAL_TOOL_DIR.exists():
    sys.path.insert(0, str(LOCAL_TOOL_DIR))

import numpy as np


SAMPLE_RATE = 48_000
PROJECT_ROOT = Path(__file__).resolve().parents[2]
SOLFEGE_ROOT = PROJECT_ROOT / "prototype" / "assets" / "solfege"
OUTPUT_ROOT = SOLFEGE_ROOT / "voice-katy-natural-low-f"

SAMPLES = {
    "sol": {
        "source": SOLFEGE_ROOT / "voice-katy" / "sol.wav",
        "source_hz": 391.9954,
        "target_hz": 261.6256,
        "voiced_start": 0.115,
    },
    "la": {
        "source": SOLFEGE_ROOT / "voice-katy" / "la.wav",
        "source_hz": 440.0,
        "target_hz": 293.6648,
        "voiced_start": 0.080,
    },
    "si": {
        "source": SOLFEGE_ROOT / "voice-katy-child-clean-v2" / "si.wav",
        "source_hz": 493.8833,
        "target_hz": 329.6276,
        "voiced_start": 0.145,
    },
}


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as wav_file:
        if wav_file.getnchannels() != 1 or wav_file.getsampwidth() != 2:
            raise ValueError(f"Expected mono PCM 16-bit WAV: {path}")
        if wav_file.getframerate() != SAMPLE_RATE:
            raise ValueError(f"Expected {SAMPLE_RATE} Hz WAV: {path}")
        data = wav_file.readframes(wav_file.getnframes())
    return np.frombuffer(data, dtype="<i2").astype(np.float64) / 32768.0


def write_wav(path: Path, samples: np.ndarray) -> None:
    peak = float(np.max(np.abs(samples))) if samples.size else 0.0
    target_peak = 10 ** (-3.0 / 20.0)
    if peak > 0:
        samples = samples * target_peak / peak
    samples = np.clip(samples, -1.0, 1.0 - 1 / 32768.0)
    pcm = (samples * 32768.0).astype("<i2")
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(pcm.tobytes())


def active_end(samples: np.ndarray) -> int:
    window = max(1, round(0.012 * SAMPLE_RATE))
    energy = np.convolve(samples * samples, np.ones(window) / window, mode="same")
    threshold = max(float(np.max(energy)) * 0.0015, 1e-8)
    active = np.flatnonzero(energy >= threshold)
    return min(len(samples), int(active[-1] + round(0.035 * SAMPLE_RATE))) if active.size else len(samples)


def natural_pitch_shift(
    samples: np.ndarray,
    source_hz: float,
    target_hz: float,
    voiced_start: float,
    window_periods: float = 2.15,
    phase_align: bool = False,
) -> np.ndarray:
    start = round(voiced_start * SAMPLE_RATE)
    end = active_end(samples)
    source_period = SAMPLE_RATE / source_hz
    target_period = SAMPLE_RATE / target_hz
    half_window = max(24, round(source_period * window_periods))
    frame_size = half_window * 2 + 1
    window = np.hanning(frame_size)
    synthesis = np.zeros_like(samples)
    weights = np.zeros_like(samples)

    first_mark = start + half_window
    if phase_align:
        search_left = max(start, round(first_mark - source_period * 0.5))
        search_right = min(end, round(first_mark + source_period * 0.5))
        if search_right > search_left:
            first_mark = search_left + int(np.argmax(np.abs(samples[search_left:search_right])))

    output_marks = np.arange(first_mark, end - half_window, target_period)
    for output_mark in output_marks:
        expected_source = first_mark + (output_mark - first_mark)
        source_mark = first_mark + round((expected_source - first_mark) / source_period) * source_period
        source_center = int(round(source_mark))
        output_center = int(round(output_mark))
        source_left = source_center - half_window
        output_left = output_center - half_window
        if source_left < 0 or source_left + frame_size > len(samples):
            continue
        if output_left < 0 or output_left + frame_size > len(samples):
            continue
        frame = samples[source_left:source_left + frame_size] * window
        synthesis[output_left:output_left + frame_size] += frame
        weights[output_left:output_left + frame_size] += window

    processed = samples.copy()
    usable = weights > 1e-4
    processed[usable] = synthesis[usable] / weights[usable]

    fade = round(0.028 * SAMPLE_RATE)
    for boundary, reverse in ((start, False), (end, True)):
        left = max(0, boundary - fade)
        right = min(len(samples), boundary + fade)
        if right <= left:
            continue
        mix = np.linspace(0.0, 1.0, right - left)
        if reverse:
            mix = 1.0 - mix
        processed[left:right] = samples[left:right] * (1.0 - mix) + processed[left:right] * mix

    tail_fade = min(round(0.03 * SAMPLE_RATE), len(processed))
    processed[-tail_fade:] *= np.linspace(1.0, 0.0, tail_fade)
    return processed


def stft(samples: np.ndarray, fft_size: int = 2048, hop: int = 256) -> np.ndarray:
    padded = np.pad(samples, (fft_size // 2, fft_size // 2))
    frame_count = 1 + max(0, (len(padded) - fft_size) // hop)
    window = np.hanning(fft_size)
    frames = np.stack([padded[index * hop:index * hop + fft_size] * window for index in range(frame_count)], axis=1)
    return np.fft.rfft(frames, axis=0)


def istft(spectrum: np.ndarray, length: int, fft_size: int = 2048, hop: int = 256) -> np.ndarray:
    window = np.hanning(fft_size)
    output_length = max(fft_size, hop * (spectrum.shape[1] - 1) + fft_size)
    output = np.zeros(output_length)
    weights = np.zeros(output_length)
    for frame_index in range(spectrum.shape[1]):
        frame = np.fft.irfft(spectrum[:, frame_index], n=fft_size) * window
        left = frame_index * hop
        output[left:left + fft_size] += frame
        weights[left:left + fft_size] += window * window
    valid = weights > 1e-8
    output[valid] /= weights[valid]
    output = output[fft_size // 2:]
    if len(output) < length:
        output = np.pad(output, (0, length - len(output)))
    return output[:length]


def phase_vocoder(spectrum: np.ndarray, rate: float, fft_size: int = 2048, hop: int = 256) -> np.ndarray:
    time_steps = np.arange(0, spectrum.shape[1] - 1, rate)
    output = np.empty((spectrum.shape[0], len(time_steps)), dtype=np.complex128)
    phase_advance = 2 * np.pi * hop * np.arange(spectrum.shape[0]) / fft_size
    phase = np.angle(spectrum[:, 0])
    for output_index, step in enumerate(time_steps):
        left = int(np.floor(step))
        fraction = step - left
        first = spectrum[:, left]
        second = spectrum[:, min(left + 1, spectrum.shape[1] - 1)]
        magnitude = (1.0 - fraction) * np.abs(first) + fraction * np.abs(second)
        output[:, output_index] = magnitude * np.exp(1j * phase)
        delta = np.angle(second) - np.angle(first) - phase_advance
        delta -= 2 * np.pi * np.round(delta / (2 * np.pi))
        phase += phase_advance + delta
    return output


def smooth_log_envelope(magnitude: np.ndarray, width: int = 41) -> np.ndarray:
    kernel = np.ones(width) / width
    log_magnitude = np.log(np.maximum(magnitude, 1e-7))
    return np.apply_along_axis(lambda column: np.convolve(column, kernel, mode="same"), 0, log_magnitude)


def spectral_pitch_shift(samples: np.ndarray, ratio: float, voiced_start: float, formant_strength: float = 0.72) -> np.ndarray:
    """Pitch-shift the voiced body clearly, then restore much of its spectral envelope."""
    start = round(voiced_start * SAMPLE_RATE)
    end = active_end(samples)
    segment = samples[start:end]
    source_spectrum = stft(segment)
    stretched_spectrum = phase_vocoder(source_spectrum, 1.0 / ratio)
    stretched_length = max(1, round(len(segment) * ratio))
    stretched = istft(stretched_spectrum, stretched_length)
    positions = np.linspace(0, max(0, len(stretched) - 1), len(segment))
    shifted = np.interp(positions, np.arange(len(stretched)), stretched)

    shifted_spectrum = stft(shifted)
    source_envelope = smooth_log_envelope(np.abs(source_spectrum))
    shifted_envelope = smooth_log_envelope(np.abs(shifted_spectrum))
    frame_count = min(source_envelope.shape[1], shifted_envelope.shape[1])
    correction = np.clip(source_envelope[:, :frame_count] - shifted_envelope[:, :frame_count], -1.15, 1.15)
    corrected = shifted_spectrum.copy()
    corrected[:, :frame_count] *= np.exp(formant_strength * correction)
    shifted = istft(corrected, len(segment))

    output = samples.copy()
    fade = min(round(0.025 * SAMPLE_RATE), len(segment) // 3)
    mix = np.ones(len(segment))
    mix[:fade] = np.linspace(0.0, 1.0, fade)
    mix[-fade:] = np.linspace(1.0, 0.0, fade)
    output[start:end] = samples[start:end] * (1.0 - mix) + shifted * mix
    tail_fade = min(round(0.03 * SAMPLE_RATE), len(output))
    output[-tail_fade:] *= np.linspace(1.0, 0.0, tail_fade)
    return output


def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    for syllable, config in SAMPLES.items():
        source = read_wav(config["source"])
        result = natural_pitch_shift(source, config["source_hz"], config["target_hz"], config["voiced_start"])
        output = OUTPUT_ROOT / f"{syllable}.wav"
        write_wav(output, result)
        print(f"created {output.relative_to(PROJECT_ROOT)} at {config['target_hz']:.3f} Hz")


if __name__ == "__main__":
    main()
