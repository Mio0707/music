"""调用百炼 OpenAI 兼容接口生成一份通用 JSON 文档。"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt-file", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--raw-output", required=True, type=Path)
    parser.add_argument("--system", default="你是儿童音乐体系设计师。必须只返回符合要求的 JSON 对象。")
    parser.add_argument("--model", default="qwen3.7-max")
    args = parser.parse_args()

    api_key = os.environ.get("DASHSCOPE_API_KEY")
    if not api_key:
        print("未检测到 DASHSCOPE_API_KEY。请在本机环境变量中配置后重试。")
        return 3

    payload = {
        "model": args.model,
        "messages": [
            {"role": "system", "content": args.system},
            {"role": "user", "content": args.prompt_file.read_text(encoding="utf-8")},
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
            raw = response.read().decode("utf-8")
    except HTTPError as error:
        print(f"百炼 API 返回 HTTP {error.code}：{error.read().decode('utf-8', errors='replace')}")
        return 4
    except URLError as error:
        print(f"无法连接百炼 API：{error.reason}")
        return 5

    args.raw_output.parent.mkdir(parents=True, exist_ok=True)
    args.raw_output.write_text(raw, encoding="utf-8")
    try:
        response_data = json.loads(raw)
        document = json.loads(response_data["choices"][0]["message"]["content"])
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as error:
        print(f"百炼返回不是可解析的 JSON：{error}")
        return 2
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(document, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
