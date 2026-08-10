"""Serve the classroom prototype and analyze numbered scores with Qwen vision."""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import mimetypes
import os
import re
import sys
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
ENV_FILE = PROJECT_ROOT / ".env"
API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
MAX_BODY_BYTES = 14 * 1024 * 1024
SOLFEGE = ("rest", "do", "re", "mi", "fa", "sol", "la", "si")
MAJOR_INTERVALS = (0, 0, 2, 4, 5, 7, 9, 11)
TONIC_MIDI = {
    "C": 60, "C#": 61, "DB": 61, "D": 62, "D#": 63, "EB": 63,
    "E": 64, "F": 65, "F#": 66, "GB": 66, "G": 67, "G#": 68,
    "AB": 68, "A": 69, "A#": 70, "BB": 70, "B": 71,
}

CHILDREN_STUDIO_PREFIX = "/children-music-studio"
CHILDREN_STUDIO_SERVER = PROJECT_ROOT / "children-music-studio" / "studio" / "server.py"


def load_children_studio_module():
    """Load the children music studio so both tools can share this web server."""
    spec = importlib.util.spec_from_file_location("children_music_studio_server", CHILDREN_STUDIO_SERVER)
    if spec is None or spec.loader is None:
        raise RuntimeError("无法加载儿童音乐设计台。")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


CHILDREN_STUDIO = load_children_studio_module()


def load_local_env() -> None:
    if not ENV_FILE.is_file():
        return
    for raw_line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def score_prompt() -> str:
    return """你是专业简谱录入员。请逐小节读取图片里的单声部主旋律，只输出 JSON 对象，不要解释。

目标：为 6—12 岁儿童生成首调唱名教学。必须保留音高、上下八度、休止和时值；歌词、伴奏声部、装饰文字不录入。若图片有多个声部，只录入最上方的主旋律。

JSON 格式：
{
  "title": "曲名",
  "tonic": "F",
  "mode": "major",
  "meter": {"beats": 4, "unit": 4},
  "bpm": 72,
  "confidence": 0.0,
  "measures": [
    {
      "number": 1,
      "pickup": false,
      "notes": [
        {"degree": 1, "octave": 0, "beat": 0.0, "duration": 1.0, "confidence": 0.0}
      ]
    }
  ],
  "warnings": ["需要老师核对的位置"]
}

规则：degree 取 1—7，休止符取 0；octave 中音为 0、数字下方一点为 -1、上方一点为 1；beat 和 duration 都以四分音符为 1 拍；延音线或横线合并到前一个音的 duration；附点加入一半时值；小节内 beat 从 0 开始；不确定也必须给出最佳判断，并降低该音 confidence、写入 warnings。调号“1=F”应输出 tonic F。"""


def request_score_analysis(image_data_url: str) -> dict:
    api_key = os.environ.get("DASHSCOPE_API_KEY")
    if not api_key:
        raise ValueError("没有找到 AI 密钥，请先在 music/.env 中配置 DASHSCOPE_API_KEY。")
    if not re.match(r"^data:image/(png|jpeg|jpg|webp|bmp);base64,", image_data_url, re.I):
        raise ValueError("第一版支持 PNG、JPG、WEBP 或 BMP 乐谱图片。")

    payload = {
        "model": os.environ.get("SCORE_VISION_MODEL", "qwen3.7-plus"),
        "messages": [
            {"role": "system", "content": "你只返回严格符合要求的 JSON 对象。"},
            {"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": image_data_url}},
                {"type": "text", "text": score_prompt()},
            ]},
        ],
        "temperature": 0.1,
        "stream": False,
        "response_format": {"type": "json_object"},
    }
    request = Request(
        API_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=300) as response:
            raw = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise ValueError(f"AI 服务返回错误（{error.code}）：{detail[:240]}") from error
    except URLError as error:
        raise ValueError(f"暂时无法连接 AI 服务：{error.reason}") from error

    try:
        content = raw["choices"][0]["message"]["content"]
        return json.loads(content) if isinstance(content, str) else content
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as error:
        raise ValueError("AI 返回的乐谱草稿无法读取，请重新分析。") from error


def as_number(value: object, fallback: float) -> float:
    try:
        number = float(value)
        return number if math.isfinite(number) else fallback
    except (TypeError, ValueError):
        return fallback


def normalize_score(candidate: dict, file_name: str) -> dict:
    if not isinstance(candidate, dict):
        raise ValueError("AI 没有返回有效的乐谱对象。")
    raw_meter = candidate.get("meter") if isinstance(candidate.get("meter"), dict) else {}
    beats = max(1, min(12, int(as_number(raw_meter.get("beats"), 4))))
    unit = int(as_number(raw_meter.get("unit"), 4))
    unit = unit if unit in (2, 4, 8, 16) else 4
    beats_per_measure = beats * 4 / unit
    tonic = str(candidate.get("tonic") or "C").strip().upper().replace("♭", "B").replace("♯", "#")
    if tonic not in TONIC_MIDI:
        tonic = "C"
    warnings = [str(item) for item in candidate.get("warnings", []) if str(item).strip()][:20]
    measures = []
    absolute_offset = 0.0
    all_notes = []

    raw_measures = candidate.get("measures")
    if not isinstance(raw_measures, list) or not raw_measures:
        raise ValueError("没有识别到可用的主旋律音符。")
    for measure_index, raw_measure in enumerate(raw_measures[:128]):
        if not isinstance(raw_measure, dict):
            continue
        notes = []
        for note_index, raw_note in enumerate(raw_measure.get("notes", [])[:128]):
            if not isinstance(raw_note, dict):
                continue
            degree = max(0, min(7, int(as_number(raw_note.get("degree"), 0))))
            octave = max(-2, min(2, int(as_number(raw_note.get("octave"), 0))))
            beat = max(0.0, as_number(raw_note.get("beat"), note_index))
            duration = max(0.125, min(16.0, as_number(raw_note.get("duration"), 1.0)))
            confidence = max(0.0, min(1.0, as_number(raw_note.get("confidence"), 0.5)))
            frequency = 0.0
            if degree:
                midi = TONIC_MIDI[tonic] + MAJOR_INTERVALS[degree] + octave * 12
                frequency = round(440 * (2 ** ((midi - 69) / 12)), 3)
            note = {
                "degree": degree,
                "octave": octave,
                "beat": round(beat, 3),
                "duration": round(duration, 3),
                "confidence": round(confidence, 3),
                "solfege": SOLFEGE[degree],
                "frequency": frequency,
            }
            notes.append(note)
        notes.sort(key=lambda item: item["beat"])
        if not notes:
            continue
        content_duration = max(note["beat"] + note["duration"] for note in notes)
        pickup = bool(raw_measure.get("pickup"))
        measure_duration = content_duration if pickup else max(beats_per_measure, content_duration)
        number = int(as_number(raw_measure.get("number"), measure_index + 1))
        normalized_measure = {"number": number, "pickup": pickup, "notes": notes}
        measures.append(normalized_measure)
        for note in notes:
            note["startBeat"] = round(absolute_offset + note["beat"], 3)
            all_notes.append(note)
            if note["confidence"] < 0.72:
                warnings.append(f"第 {number} 小节有一个音符需要重点核对。")
        if not pickup and abs(content_duration - beats_per_measure) > 0.126:
            warnings.append(f"第 {number} 小节的识别时值与拍号不完全一致。")
        absolute_offset += measure_duration

    if not all_notes:
        raise ValueError("没有识别到可播放的主旋律。")
    return {
        "title": str(candidate.get("title") or Path(file_name).stem or "未命名乐谱")[:100],
        "tonic": tonic,
        "mode": "major",
        "meter": {"beats": beats, "unit": unit},
        "bpm": max(36, min(180, int(as_number(candidate.get("bpm"), 72)))),
        "confidence": round(max(0.0, min(1.0, as_number(candidate.get("confidence"), 0.5))), 3),
        "measures": measures,
        "notes": all_notes,
        "totalBeats": round(max(note["startBeat"] + note["duration"] for note in all_notes), 3),
        "warnings": list(dict.fromkeys(warnings))[:30],
        "source": "ai-draft",
    }


class Handler(CHILDREN_STUDIO.Handler):
    server_version = "AnimalBandPrototype/0.2"

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        request_path = urlparse(self.path).path
        if request_path.startswith(f"{CHILDREN_STUDIO_PREFIX}/"):
            original_path = self.path
            self.path = request_path.removeprefix(CHILDREN_STUDIO_PREFIX) or "/"
            try:
                CHILDREN_STUDIO.Handler.do_POST(self)
            finally:
                self.path = original_path
            return
        try:
            if request_path != "/api/score/analyze":
                self.send_error(404)
                return
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY_BYTES:
                raise ValueError("乐谱图片为空或文件过大（上限约 10 MB）。")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            file_name = str(payload.get("fileName") or "未命名乐谱")
            candidate = request_score_analysis(str(payload.get("imageDataUrl") or ""))
            score = normalize_score(candidate, file_name)
            self.send_json(200, {"score": score})
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})
        except Exception:
            self.send_json(500, {"error": "乐谱分析发生意外错误，请查看启动窗口。"})

    def do_GET(self) -> None:
        request_path = unquote(urlparse(self.path).path)
        if request_path == CHILDREN_STUDIO_PREFIX:
            self.send_response(308)
            self.send_header("Location", f"{CHILDREN_STUDIO_PREFIX}/")
            self.end_headers()
            return
        if request_path.startswith(f"{CHILDREN_STUDIO_PREFIX}/"):
            original_path = self.path
            self.path = request_path.removeprefix(CHILDREN_STUDIO_PREFIX) or "/"
            try:
                CHILDREN_STUDIO.Handler.do_GET(self)
            finally:
                self.path = original_path
            return
        name = "index.html" if request_path in ("", "/") else request_path.lstrip("/")
        candidate = (ROOT / name).resolve()
        if candidate != ROOT.resolve() and ROOT.resolve() not in candidate.parents:
            self.send_error(403)
            return
        if not candidate.is_file():
            self.send_error(404)
            return
        content = candidate.read_bytes()
        mime_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        if mime_type.startswith("text/") or mime_type in ("application/javascript", "application/json"):
            mime_type += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)


def main() -> int:
    load_local_env()
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args()
    CHILDREN_STUDIO.JOBS_DIR.mkdir(parents=True, exist_ok=True)
    CHILDREN_STUDIO.RECORDS_DIR.mkdir(parents=True, exist_ok=True)
    CHILDREN_STUDIO.FRONTEND_MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"教师备课平台已启动：http://{args.host}:{args.port}/")
    print("儿童音乐设计台已合并，无需单独启动。")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
