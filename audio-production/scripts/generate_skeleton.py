"""通过已登录的百炼 CLI 生成一份音乐骨架 JSON。"""

from __future__ import annotations

import argparse
from datetime import datetime
import json
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REQUIRED_FIELDS = {"kitId", "bpm", "timeSignature", "key", "bars", "melody", "chords", "bassRoots", "drumGrid", "lionAllowedBeats"}


def parse_model_response(raw: str) -> dict:
    """兼容 CLI 的常见 JSON 外壳，并取出模型实际写出的 JSON。"""
    response = json.loads(raw)
    content = response
    if isinstance(response, dict) and response.get("tool_calls"):
        content = response["tool_calls"][0]["function"]["arguments"]
    elif isinstance(response, dict) and response.get("choices"):
        message = response["choices"][0]["message"]
        if message.get("tool_calls"):
            content = message["tool_calls"][0]["function"]["arguments"]
        else:
            content = message["content"]
    elif isinstance(response, dict) and "output_text" in response:
        content = response["output_text"]

    if isinstance(content, dict):
        return content
    if not isinstance(content, str):
        raise ValueError("百炼返回内容不是可解析的文本 JSON。")

    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(cleaned)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    task = json.loads(args.task.read_text(encoding="utf-8"))
    prompt_path = ROOT / "prompts" / "bailian" / f"{task['kitId']}.txt"
    prompt = prompt_path.read_text(encoding="utf-8")

    if args.dry_run:
        print(prompt)
        return 0
    if args.output is None:
        parser.error("正式调用时必须提供 --output。")

    # Windows 全局 npm 命令会同时提供 bl.ps1 和 bl.cmd。
    # Python 直接启动时使用 .cmd，避免找不到 PowerShell 包装命令。
    cli_command = "bl.cmd" if os.name == "nt" else "bl"
    command = [
        cli_command, "text", "chat",
        "--model", task["model"],
        "--system", "只输出合法 JSON，不要 Markdown。使用简体中文音乐术语。",
        "--message", prompt,
        "--tool", str(ROOT / "schemas" / "music_skeleton.tool.json"),
        "--temperature", "0.2",
        "--output", "json",
        "--no-color",
    ]
    result = subprocess.run(command, text=True, capture_output=True, encoding="utf-8")
    if result.returncode != 0:
        sys.stderr.write("百炼 CLI 调用失败：\n" + result.stderr)
        return result.returncode

    raw_directory = ROOT / "source" / "bailian"
    raw_directory.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    raw_path = raw_directory / f"{task['kitId']}_{timestamp}.raw.json"
    raw_path.write_text(result.stdout, encoding="utf-8")

    try:
        skeleton = parse_model_response(result.stdout)
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
        sys.stderr.write(f"百炼返回无法解析为骨架 JSON，原始返回已保存：{raw_path}\n{error}\n")
        return 2

    missing_fields = REQUIRED_FIELDS.difference(skeleton)
    if missing_fields:
        missing = "、".join(sorted(missing_fields))
        sys.stderr.write(f"百炼返回缺少总谱字段：{missing}。原始返回已保存：{raw_path}\n")
        return 2

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(skeleton, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已保存骨架：{args.output}；原始返回：{raw_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
