"""使用百炼 OpenAI 兼容接口的 JSON Mode 生成音乐骨架。"""

from __future__ import annotations

import argparse
from datetime import datetime
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
REQUIRED_FIELDS = {"kitId", "feeling", "groove", "bpm", "timeSignature", "key", "bars", "melody", "chords", "bassRoots", "drumGrid", "lionAllowedBeats"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    api_key = os.environ.get("DASHSCOPE_API_KEY")
    if not api_key:
        print("未检测到 DASHSCOPE_API_KEY。请在本机环境变量中配置后重试。")
        return 3

    task = json.loads(args.task.read_text(encoding="utf-8"))
    prompt_path = ROOT / "prompts" / "bailian" / f"{task['kitId']}.txt"
    prompt = prompt_path.read_text(encoding="utf-8")
    payload = {
        "model": task["model"],
        "messages": [
            {"role": "system", "content": "你是儿童音乐骨架生成器。必须只返回符合用户要求的 JSON 对象。"},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "stream": False,
        "response_format": {"type": "json_object"}
    }

    request = Request(
        API_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with urlopen(request, timeout=300) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        print(f"百炼 API 返回 HTTP {error.code}：{details}")
        return 4
    except URLError as error:
        print(f"无法连接百炼 API：{error.reason}")
        return 5

    raw_directory = ROOT / "source" / "bailian"
    raw_directory.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    raw_path = raw_directory / f"{task['kitId']}_{timestamp}.json-mode.raw.json"
    raw_path.write_text(raw, encoding="utf-8")

    try:
        response_data = json.loads(raw)
        content = response_data["choices"][0]["message"]["content"]
        skeleton = json.loads(content)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as error:
        print(f"百炼返回不是可解析的 JSON 骨架，原始返回已保存：{raw_path}\n{error}")
        return 2

    missing_fields = REQUIRED_FIELDS.difference(skeleton)
    if missing_fields:
        missing = "、".join(sorted(missing_fields))
        print(f"百炼返回缺少总谱字段：{missing}。原始返回已保存：{raw_path}")
        return 2

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(skeleton, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已保存 JSON Mode 骨架：{args.output}；原始返回：{raw_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
