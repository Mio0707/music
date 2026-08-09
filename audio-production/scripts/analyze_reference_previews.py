from __future__ import annotations

import json
import math
import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / "output" / "reference-analysis" / "decoded"
OUTPUT = ROOT / "output" / "reference-analysis" / "preview-analysis.json"


def read_mono(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as handle:
        rate = handle.getframerate()
        audio = np.frombuffer(handle.readframes(handle.getnframes()), dtype="<i2").astype(np.float64)
        channels = handle.getnchannels()
    audio = audio.reshape(-1, channels).mean(axis=1) / 32768.0
    return audio, rate


def normalize(values: np.ndarray) -> np.ndarray:
    values = values - np.median(values)
    scale = np.percentile(np.abs(values), 95) or 1.0
    return values / scale


def local_peaks(values: np.ndarray, minimum_distance: int, threshold: float) -> np.ndarray:
    candidates = np.flatnonzero(
        (values[1:-1] > values[:-2])
        & (values[1:-1] >= values[2:])
        & (values[1:-1] >= threshold)
    ) + 1
    selected: list[int] = []
    for index in candidates[np.argsort(values[candidates])[::-1]]:
        if all(abs(index - existing) >= minimum_distance for existing in selected):
            selected.append(int(index))
    return np.array(sorted(selected), dtype=int)


def analyze(path: Path) -> dict[str, object]:
    audio, rate = read_mono(path)
    frame_size = 1024
    hop = 256
    window = np.hanning(frame_size)
    spectra = []
    rms = []
    for start in range(0, len(audio) - frame_size, hop):
        frame = audio[start : start + frame_size]
        rms.append(float(np.sqrt(np.mean(frame * frame))))
        magnitude = np.abs(np.fft.rfft(frame * window))
        spectra.append(np.log1p(magnitude * 20))
    spectra = np.asarray(spectra)
    rms_values = np.asarray(rms)
    flux = np.maximum(0, np.diff(spectra, axis=0)).sum(axis=1)
    flux = normalize(flux)
    flux = np.maximum(0, flux)
    frame_rate = rate / hop

    # Autocorrelation provides tempo candidates; report ambiguity rather than hiding it.
    centered = flux - np.mean(flux)
    autocorr = np.correlate(centered, centered, mode="full")[len(centered) - 1 :]
    autocorr /= autocorr[0] if autocorr[0] else 1.0
    minimum_bpm, maximum_bpm = 55, 190
    min_lag = max(1, round(frame_rate * 60 / maximum_bpm))
    max_lag = round(frame_rate * 60 / minimum_bpm)
    region = autocorr[min_lag : max_lag + 1]
    candidate_lags = local_peaks(region, minimum_distance=2, threshold=float(np.percentile(region, 65))) + min_lag
    ranked = sorted(
        ((float(60 * frame_rate / lag), float(autocorr[lag])) for lag in candidate_lags),
        key=lambda pair: pair[1],
        reverse=True,
    )[:6]

    onset_threshold = float(np.percentile(flux, 82))
    onsets = local_peaks(flux, minimum_distance=round(frame_rate * 0.10), threshold=onset_threshold)
    onset_times = onsets / frame_rate
    intervals = np.diff(onset_times)
    active_threshold = float(np.percentile(rms_values, 18) * 1.25)
    return {
        "file": path.name,
        "durationSeconds": round(len(audio) / rate, 3),
        "tempoCandidates": [{"bpm": round(bpm, 1), "confidence": round(score, 3)} for bpm, score in ranked],
        "strongOnsetsPerSecond": round(len(onsets) / (len(audio) / rate), 2),
        "medianOnsetIntervalSeconds": round(float(np.median(intervals)), 3) if len(intervals) else None,
        "onsetIntervalP25": round(float(np.percentile(intervals, 25)), 3) if len(intervals) else None,
        "onsetIntervalP75": round(float(np.percentile(intervals, 75)), 3) if len(intervals) else None,
        "lowEnergyFraction": round(float(np.mean(rms_values < active_threshold)), 3),
        "rmsDynamicRangeDb": round(20 * math.log10((np.percentile(rms_values, 95) + 1e-8) / (np.percentile(rms_values, 10) + 1e-8)), 1),
    }


def main() -> None:
    results = [analyze(path) for path in sorted(INPUT.glob("*.wav"))]
    OUTPUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
