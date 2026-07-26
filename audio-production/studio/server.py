"""儿童音乐分轨平台：本地上传 JSON、生成分轨并导出混音。"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import subprocess
import sys
import traceback
import uuid
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Timer
from urllib.parse import unquote, urlparse


STUDIO_DIR = Path(__file__).resolve().parent
AUDIO_DIR = STUDIO_DIR.parent
SCRIPTS_DIR = AUDIO_DIR / "scripts"
TASKS_DIR = AUDIO_DIR / "tasks"
JOBS_DIR = AUDIO_DIR / "studio-data" / "jobs"
MAX_BODY_BYTES = 2 * 1024 * 1024
ANIMALS = ("bear", "cat", "dog")
RENDER_GAINS = {"bear": 0.45, "cat": 0.75, "dog": 0.45}
BEAR_TONES = {
    "grand_piano": {"label": "大钢琴", "bank": 0, "program": 0},
    "violin": {"label": "小提琴", "bank": 0, "program": 40},
    "dulcimer": {"label": "扬琴（近似）", "bank": 0, "program": 15},
    "ukulele": {"label": "尤克里里", "bank": 8, "program": 24},
    "harp": {"label": "竖琴", "bank": 0, "program": 46},
    "flute": {"label": "长笛", "bank": 0, "program": 73},
}


def default_tools() -> tuple[Path, Path]:
    local_app_data = Path(os.environ.get("LOCALAPPDATA", ""))
    fluidsynth_setting = os.environ.get("MUSIC_FLUIDSYNTH")
    soundfont_setting = os.environ.get("MUSIC_SOUNDFONT")
    fluidsynth = Path(fluidsynth_setting) if fluidsynth_setting else local_app_data / "music-audio-tools" / "fluidsynth-v2.5.7" / "fluidsynth-v2.5.7-win10-x64-cpp11" / "bin" / "fluidsynth.exe"
    soundfont = Path(soundfont_setting) if soundfont_setting else local_app_data / "music-audio-tools" / "sounds" / "MuseScore_General.sf3"
    return fluidsynth, soundfont


def run_script(*arguments: str | Path) -> str:
    command = [sys.executable, *(str(argument) for argument in arguments)]
    child_environment = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    result = subprocess.run(
        command,
        text=True,
        capture_output=True,
        encoding="utf-8",
        env=child_environment,
    )
    if result.returncode:
        detail = (result.stdout + "\n" + result.stderr).strip()
        raise ValueError(detail or "音乐处理脚本执行失败")
    return result.stdout.strip()


def safe_id(value: object) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]", "_", str(value or "music"))
    return cleaned[:80] or "music"


def read_settings(job_dir: Path) -> dict:
    path = job_dir / "settings.json"
    if not path.is_file():
        return {"bearTone": "grand_piano"}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError):
        return {"bearTone": "grand_piano"}


def active_stem_path(job_dir: Path, kit_id: str, animal: str) -> Path:
    if animal == "bear":
        tone = read_settings(job_dir).get("bearTone", "grand_piano")
        variant = job_dir / "stems" / "variants" / f"{kit_id}_bear_{safe_id(tone)}.wav"
        if tone != "grand_piano" and variant.is_file():
            return variant
    return job_dir / "stems" / f"{kit_id}_{animal}.wav"


def job_url(job_dir: Path, path: Path) -> str:
    return f"/jobs/{job_dir.name}/{path.relative_to(job_dir).as_posix()}"


def process_skeleton(skeleton: dict) -> dict:
    kit_id = safe_id(skeleton.get("kitId"))
    task_path = TASKS_DIR / f"{kit_id}.json"
    if not task_path.is_file():
        raise ValueError(f"找不到编号 {kit_id} 对应的任务卡；第一版目前支持 happy_bounce_v01。")

    fluidsynth, soundfont = default_tools()
    if not fluidsynth.is_file() or not soundfont.is_file():
        raise ValueError("找不到本机 FluidSynth 或 MuseScore General 音色库，请先完成固定音源配置。")

    job_id = f"{kit_id}_{datetime.now():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:6]}"
    job_dir = JOBS_DIR / job_id
    midi_dir = job_dir / "midi"
    stems_dir = job_dir / "stems"
    job_dir.mkdir(parents=True, exist_ok=False)
    skeleton_path = job_dir / "skeleton.json"
    skeleton_path.write_text(json.dumps(skeleton, ensure_ascii=False, indent=2), encoding="utf-8")

    run_script(SCRIPTS_DIR / "validate_skeleton.py", "--task", task_path, "--skeleton", skeleton_path)
    numerator, denominator = (int(value) for value in str(skeleton["timeSignature"]).split("/", 1))
    beats_per_bar = numerator * 4 / denominator
    duration_seconds = float(skeleton["bars"]) * beats_per_bar * 60 / float(skeleton["bpm"])
    full_midi = midi_dir / f"{kit_id}.mid"
    run_script(SCRIPTS_DIR / "render_midi.py", "--skeleton", skeleton_path, "--output", full_midi)
    run_script(
        SCRIPTS_DIR / "split_midi_stems.py",
        "--midi", full_midi,
        "--output-dir", midi_dir,
        "--prefix", kit_id,
    )

    stems = []
    for animal in ANIMALS:
        wav_path = stems_dir / f"{kit_id}_{animal}.wav"
        run_script(
            SCRIPTS_DIR / "render_wav.py",
            "--fluidsynth", fluidsynth,
            "--soundfont", soundfont,
            "--midi", midi_dir / f"{kit_id}_{animal}.mid",
            "--output", wav_path,
            "--gain", str(RENDER_GAINS[animal]),
            "--duration-seconds", str(duration_seconds),
            "--loop-crossfade-ms", "20",
        )
        stems.append({"animal": animal, "url": f"/jobs/{job_id}/stems/{wav_path.name}"})

    return {
        "jobId": job_id,
        "kitId": kit_id,
        "stems": stems,
        "bearTone": "grand_piano",
        "bearTones": [{"id": tone_id, "label": tone["label"]} for tone_id, tone in BEAR_TONES.items()],
        "pending": [
            {"animal": "lion", "reason": "需要先确认萨克斯短句音符"},
            {"animal": "rabbit", "reason": "需要制作 do/re/mi 唱名人声"},
        ],
    }


def export_mix(job_id: str, gains: dict) -> dict:
    safe_job_id = safe_id(job_id)
    job_dir = (JOBS_DIR / safe_job_id).resolve()
    if job_dir.parent != JOBS_DIR.resolve() or not job_dir.is_dir():
        raise ValueError("找不到这次处理任务，请重新上传 JSON。")

    skeleton = json.loads((job_dir / "skeleton.json").read_text(encoding="utf-8"))
    kit_id = safe_id(skeleton.get("kitId"))
    inputs = [active_stem_path(job_dir, kit_id, animal) for animal in ANIMALS]
    gain_values = [max(0.0, min(1.5, float(gains.get(animal, 1.0)))) for animal in ANIMALS]
    output = job_dir / "mixes" / f"{kit_id}_mix_{datetime.now():%H%M%S}.wav"
    run_script(
        SCRIPTS_DIR / "mix_wav_stems.py",
        "--inputs", *inputs,
        "--output", output,
        "--gains", *(str(value) for value in gain_values),
    )
    return {"url": f"/jobs/{safe_job_id}/mixes/{output.name}", "gains": dict(zip(ANIMALS, gain_values))}


def export_stem(job_id: str, animal: str, gain: object) -> dict:
    """按滑杆当前音量导出一条独立动物 WAV。"""
    if animal not in ANIMALS:
        raise ValueError("无法识别需要导出的动物分轨。")
    safe_job_id = safe_id(job_id)
    job_dir = (JOBS_DIR / safe_job_id).resolve()
    if job_dir.parent != JOBS_DIR.resolve() or not job_dir.is_dir():
        raise ValueError("找不到这次处理任务，请重新打开历史任务。")

    skeleton = json.loads((job_dir / "skeleton.json").read_text(encoding="utf-8"))
    kit_id = safe_id(skeleton.get("kitId"))
    gain_value = max(0.0, min(1.5, float(gain)))
    input_path = active_stem_path(job_dir, kit_id, animal)
    if not input_path.is_file():
        raise ValueError("找不到这条动物分轨。")
    gain_percent = round(gain_value * 100)
    output = job_dir / "exports" / f"{kit_id}_{animal}_{gain_percent}pct.wav"
    run_script(
        SCRIPTS_DIR / "mix_wav_stems.py",
        "--inputs", input_path,
        "--output", output,
        "--gains", str(gain_value),
    )
    return {
        "url": f"/jobs/{safe_job_id}/exports/{output.name}",
        "filename": output.name,
        "animal": animal,
        "gain": gain_value,
    }


def apply_bear_tone(job_id: str, tone_id: str) -> dict:
    if tone_id not in BEAR_TONES:
        raise ValueError("无法识别这个备用音色。")
    safe_job_id = safe_id(job_id)
    job_dir = (JOBS_DIR / safe_job_id).resolve()
    if job_dir.parent != JOBS_DIR.resolve() or not job_dir.is_dir():
        raise ValueError("找不到这次处理任务，请重新打开历史任务。")

    skeleton = json.loads((job_dir / "skeleton.json").read_text(encoding="utf-8"))
    kit_id = safe_id(skeleton.get("kitId"))
    settings_path = job_dir / "settings.json"
    if tone_id == "grand_piano":
        settings_path.write_text(json.dumps({"bearTone": tone_id}, ensure_ascii=False, indent=2), encoding="utf-8")
        output = job_dir / "stems" / f"{kit_id}_bear.wav"
        return {"tone": tone_id, "label": BEAR_TONES[tone_id]["label"], "url": job_url(job_dir, output)}

    tone = BEAR_TONES[tone_id]
    source_midi = job_dir / "midi" / f"{kit_id}_bear.mid"
    variant_midi = job_dir / "midi" / "variants" / f"{kit_id}_bear_{tone_id}.mid"
    output = job_dir / "stems" / "variants" / f"{kit_id}_bear_{tone_id}.wav"
    run_script(
        SCRIPTS_DIR / "set_midi_tone.py",
        "--midi", source_midi,
        "--output", variant_midi,
        "--track-name", "Bear and Rabbit shared melody",
        "--bank", str(tone["bank"]),
        "--program", str(tone["program"]),
    )
    numerator, denominator = (int(value) for value in str(skeleton["timeSignature"]).split("/", 1))
    duration_seconds = float(skeleton["bars"]) * (numerator * 4 / denominator) * 60 / float(skeleton["bpm"])
    fluidsynth, soundfont = default_tools()
    run_script(
        SCRIPTS_DIR / "render_wav.py",
        "--fluidsynth", fluidsynth,
        "--soundfont", soundfont,
        "--midi", variant_midi,
        "--output", output,
        "--gain", str(RENDER_GAINS["bear"]),
        "--duration-seconds", str(duration_seconds),
        "--loop-crossfade-ms", "20",
    )
    settings_path.write_text(json.dumps({"bearTone": tone_id}, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"tone": tone_id, "label": tone["label"], "url": job_url(job_dir, output)}


def list_jobs() -> list[dict]:
    """列出本机已成功生成分轨的任务，供平台重新打开。"""
    jobs: list[dict] = []
    if not JOBS_DIR.is_dir():
        return jobs

    for job_dir in sorted(JOBS_DIR.iterdir(), key=lambda path: path.stat().st_mtime, reverse=True):
        skeleton_path = job_dir / "skeleton.json"
        if not job_dir.is_dir() or not skeleton_path.is_file():
            continue
        try:
            skeleton = json.loads(skeleton_path.read_text(encoding="utf-8"))
            kit_id = safe_id(skeleton.get("kitId"))
            settings = read_settings(job_dir)
            stems = []
            for animal in ANIMALS:
                stem_path = active_stem_path(job_dir, kit_id, animal)
                if stem_path.is_file():
                    stems.append({"animal": animal, "url": job_url(job_dir, stem_path)})
            if len(stems) != len(ANIMALS):
                continue

            mixes = sorted((job_dir / "mixes").glob("*.wav"), key=lambda path: path.stat().st_mtime, reverse=True) if (job_dir / "mixes").is_dir() else []
            latest_mix = f"/jobs/{job_dir.name}/mixes/{mixes[0].name}" if mixes else None
            jobs.append({
                "jobId": job_dir.name,
                "kitId": kit_id,
                "createdAt": datetime.fromtimestamp(skeleton_path.stat().st_mtime).isoformat(timespec="seconds"),
                "bpm": skeleton.get("bpm"),
                "bars": skeleton.get("bars"),
                "stems": stems,
                "bearTone": settings.get("bearTone", "grand_piano"),
                "bearTones": [{"id": tone_id, "label": tone["label"]} for tone_id, tone in BEAR_TONES.items()],
                "latestMixUrl": latest_mix,
                "pending": [
                    {"animal": "lion", "reason": "需要先确认萨克斯短句音符"},
                    {"animal": "rabbit", "reason": "需要制作 do/re/mi 唱名人声"},
                ],
            })
        except (OSError, ValueError, json.JSONDecodeError):
            continue
    return jobs[:30]


class Handler(BaseHTTPRequestHandler):
    server_version = "MusicStemStudio/0.1"

    def log_message(self, format_string: str, *args: object) -> None:
        print(f"[{self.log_date_time_string()}] {format_string % args}")

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BODY_BYTES:
            raise ValueError("请求内容为空或超过 2 MB。")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def serve_file(self, path: Path) -> None:
        if not path.is_file():
            self.send_error(404)
            return
        content = path.read_bytes()
        mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        if mime_type.startswith("text/") or mime_type in ("application/javascript", "application/json"):
            mime_type += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self) -> None:
        request_path = unquote(urlparse(self.path).path)
        if request_path == "/api/example":
            example = AUDIO_DIR / "manifests" / "happy_bounce_v01.bailian_manual_v01.json"
            self.send_json(200, {"skeleton": json.loads(example.read_text(encoding="utf-8"))})
            return
        if request_path == "/api/jobs":
            self.send_json(200, {"jobs": list_jobs()})
            return
        if request_path.startswith("/jobs/"):
            relative = Path(request_path.removeprefix("/jobs/"))
            candidate = (JOBS_DIR / relative).resolve()
            if JOBS_DIR.resolve() not in candidate.parents:
                self.send_error(403)
                return
            self.serve_file(candidate)
            return
        name = "index.html" if request_path in ("", "/") else request_path.lstrip("/")
        candidate = (STUDIO_DIR / name).resolve()
        if candidate != STUDIO_DIR.resolve() and STUDIO_DIR.resolve() not in candidate.parents:
            self.send_error(403)
            return
        self.serve_file(candidate)

    def do_POST(self) -> None:
        try:
            payload = self.read_json()
            if self.path == "/api/process":
                skeleton = payload.get("skeleton")
                if not isinstance(skeleton, dict):
                    raise ValueError("JSON 文件最外层必须是一个对象。")
                self.send_json(200, process_skeleton(skeleton))
                return
            if self.path == "/api/mix":
                self.send_json(200, export_mix(payload.get("jobId", ""), payload.get("gains", {})))
                return
            if self.path == "/api/stem":
                self.send_json(200, export_stem(payload.get("jobId", ""), payload.get("animal", ""), payload.get("gain", 1.0)))
                return
            if self.path == "/api/tone":
                self.send_json(200, apply_bear_tone(payload.get("jobId", ""), payload.get("tone", "")))
                return
            self.send_error(404)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})
        except Exception:
            traceback.print_exc()
            self.send_json(500, {"error": "本地处理发生意外错误，请查看启动窗口。"})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.environ.get("MUSIC_STUDIO_PORT", "8765")))
    parser.add_argument("--open", action="store_true", help="启动后自动打开浏览器")
    args = parser.parse_args()

    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    studio_url = f"http://127.0.0.1:{args.port}"
    if args.open:
        Timer(0.8, lambda: webbrowser.open(studio_url)).start()
    print(f"音乐分轨平台已启动：{studio_url}")
    print("按 Ctrl+C 可以停止。")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n平台已停止。")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
