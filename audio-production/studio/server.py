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
RECORDS_DIR = AUDIO_DIR / "studio-data" / "records"
KNOWLEDGE_DIR = AUDIO_DIR / "knowledge"
THEMES_DIR = KNOWLEDGE_DIR / "themes"
THEME_DRAFTS_DIR = AUDIO_DIR / "studio-data" / "theme-drafts"
THEME_PREVIEWS_DIR = AUDIO_DIR / "studio-data" / "theme-previews"
GENERATED_TASKS_DIR = AUDIO_DIR / "studio-data" / "generated-tasks"
MAX_BODY_BYTES = 2 * 1024 * 1024
ANIMALS = ("bear", "cat", "dog", "lion")
RENDER_GAINS = {"bear": 0.52, "cat": 0.82, "dog": 0.55, "lion": 0.52}
FEELINGS = (
    ("happy", "开心"),
    ("calm", "安静"),
    ("brave", "勇敢"),
    ("longing", "想念"),
)
GROOVES = (
    ("steady", "稳稳走"),
    ("bounce", "蹦蹦跳"),
    ("sway", "摇一摇"),
    ("forward", "向前冲"),
)
BEAR_TONES = {
    "grand_piano": {"label": "大钢琴", "bank": 0, "program": 0},
    "violin": {"label": "小提琴", "bank": 0, "program": 40},
    "dulcimer": {"label": "扬琴（近似）", "bank": 0, "program": 15},
    "ukulele": {"label": "尤克里里", "bank": 8, "program": 24},
    "harp": {"label": "竖琴", "bank": 0, "program": 46},
    "flute": {"label": "长笛", "bank": 0, "program": 73},
}

EMOTION_BRIEFS = {
    "happy": "明亮、亲切、自然上行；像一步步跳向阳光，活泼但不过度兴奋。",
    "calm": "安稳、柔和、舒展留白；像慢慢展开的呼吸，平静但不困倦。",
    "brave": "坚定、清楚、持续向前；像跨过小障碍后站稳，有力量但不紧张。",
    "longing": "温柔、略带距离与回望；像回头看一眼再继续走，有想念感但不悲伤沉重。",
}

EMOTION_MOTIF_RULES = {
    "happy": "核心目标是向上：整体以上行和明亮跳进为主，抵达清楚高点后回到稳定音。",
    "calm": "核心目标是舒展：以级进和窄音域缓慢展开，句尾有充足停留与呼吸。",
    "brave": "核心目标是向前：使用清楚重复音和上行四度或五度，重心稳定、结尾坚定。",
    "longing": "核心目标是回望：使用拱形或缓慢下行轮廓，再以回望式重复留下未立即解决的距离感。",
}

DEGREE_TO_PITCH = {1: "C4", 2: "D4", 3: "E4", 4: "F4", 5: "G4", 6: "A4", 7: "B4"}


def read_json(path: Path) -> dict | list:
    return json.loads(path.read_text(encoding="utf-8"))


def theme_path(emotion_id: str) -> Path:
    return THEMES_DIR / f"{safe_id(emotion_id)}.json"


def generated_task_path(kit_id: str) -> Path:
    return GENERATED_TASKS_DIR / f"{safe_id(kit_id)}.json"


def task_path_for_kit(kit_id: str) -> Path:
    generated = generated_task_path(kit_id)
    return generated if generated.is_file() else TASKS_DIR / f"{safe_id(kit_id)}.json"


def theme_generation_prompt(emotion_id: str) -> str:
    labels = dict(FEELINGS)
    if emotion_id not in labels:
        raise ValueError("无法识别这个心情。")
    project = read_json(KNOWLEDGE_DIR / "project.json")
    locked_motifs = []
    for other_id, other_label in FEELINGS:
        path = theme_path(other_id)
        if other_id == emotion_id or not path.is_file():
            continue
        other_theme = read_json(path)
        degrees = other_theme.get("coreMotif", {}).get("scaleDegrees", [])
        if degrees:
            locked_motifs.append(f"{other_label}：{'-'.join(str(value) for value in degrees)}")
    locked_motif_text = "；".join(locked_motifs) if locked_motifs else "目前还没有其他已锁定主题"
    return f"""你是本项目的儿童音乐主题设计师。请只设计“{labels[emotion_id]}”的心情主题母版，不要加入稳稳走、蹦蹦跳、摇一摇或向前冲中的任何具体律动。

项目固定条件：
- 面向 {project['targetAge']} 岁儿童。
- 固定 C 大调、4/4 拍，严格两小节共 8 拍；主题动机必须从第 0 拍开始，并在第 8 拍完成收束。
- 心情目标：{EMOTION_BRIEFS[emotion_id]}
- 核心动机方向：{EMOTION_MOTIF_RULES[emotion_id]}
- 这份母版之后会被改编成四种不同律动，因此核心身份必须来自音高关系、旋律轮廓、和声语言和收束方式，不能依赖某一种节奏。
- 母版强制节拍与收束要求：核心动机必须严格为两小节共 8 拍；referenceDurations 总和必须等于 8；最后一个音必须是主音（1 / do），在第 8 拍结束，并使用较长时值形成稳定、明亮、不突兀的收束。
- 请为这个心情原创一段核心动机：使用 1—7 的音级数字，长度 4—8 个音；referenceDurations 与音级一一对应，所有时值相加必须严格等于 8 拍，最后一个音必须在第 8 拍结束。
- 不得复用其他心情已经锁定的核心动机。现有记录：{locked_motif_text}。
- 和弦只使用 C、Dm、Em、F、G、Am；primaryPlan 必须给出严格两小节可用的 4 个和弦符号。
- 母版要定义共同的力度、触感和乐句呼吸，但不要在这里单独定义任何一种乐器。

只返回JSON对象，不要返回Markdown。必须严格包含以下字段：
- emotionId：固定为 "{emotion_id}"。
- label：固定为 "{labels[emotion_id]}"。
- version：固定为 "{emotion_id}-theme-v1"。
- designIntent：一句话定义这个心情的音乐身份。
- coreMotif.scaleDegrees：你原创的4—8个音级整数数组，每个值只能是1—7。
- coreMotif.referenceDurations：与scaleDegrees等长的正数数组；所有数值相加必须严格等于 8。
- coreMotif.requiredAppearances：固定为1。
- melodyGrammar：包含contour、preferredIntervals、phraseEnding、noteDensity。
- harmonyLanguage：包含primaryPlan、allowedChords、cadence；其中primaryPlan严格为4个和弦。
- expression：包含dynamicRange、articulation、phraseBreath。

提示词没有提供任何示例旋律。你必须根据“{labels[emotion_id]}”的目标和核心动机方向自行创作，不能自行套用常见示例数组。
"""


def validate_theme(theme: object, emotion_id: str) -> dict:
    if not isinstance(theme, dict):
        raise ValueError("心情主题JSON最外层必须是对象。")
    if theme.get("emotionId") != emotion_id:
        raise ValueError("心情主题编号与当前选择不一致。")
    motif = theme.get("coreMotif")
    if not isinstance(motif, dict):
        raise ValueError("心情主题缺少 coreMotif。")
    degrees = motif.get("scaleDegrees")
    durations = motif.get("referenceDurations")
    if not isinstance(degrees, list) or not 4 <= len(degrees) <= 8 or any(not isinstance(value, int) or not 1 <= value <= 7 for value in degrees):
        raise ValueError("coreMotif.scaleDegrees 必须包含4—8个1—7音级。")
    if not isinstance(durations, list) or len(durations) != len(degrees) or any(not isinstance(value, (int, float)) or value <= 0 for value in durations):
        raise ValueError("核心动机的参考时值必须与音级一一对应。")
    if abs(sum(float(value) for value in durations) - 8.0) > 0.001:
        raise ValueError("核心动机的参考时值总和必须严格等于两小节的 8 拍。")
    if degrees[-1] != 1:
        raise ValueError("核心动机最后一个音必须是主音 1（do），形成稳定收束。")
    if float(durations[-1]) < 1.0:
        raise ValueError("核心动机最后一个主音必须至少保持 1 拍，避免突兀收尾。")
    for other_id, other_label in FEELINGS:
        path = theme_path(other_id)
        if other_id == emotion_id or not path.is_file():
            continue
        other_degrees = read_json(path).get("coreMotif", {}).get("scaleDegrees")
        if other_degrees == degrees:
            raise ValueError(f"核心动机与已锁定的“{other_label}”完全相同，请重新生成不同旋律。")
    harmony = theme.get("harmonyLanguage")
    allowed_chords = {"C", "Dm", "Em", "F", "G", "Am"}
    if not isinstance(harmony, dict) or not isinstance(harmony.get("primaryPlan"), list) or len(harmony["primaryPlan"]) != 4:
        raise ValueError("harmonyLanguage.primaryPlan 必须包含4个和弦。")
    if any(chord not in allowed_chords for chord in harmony["primaryPlan"]):
        raise ValueError("主题和弦超出当前C大调儿童音乐方案库。")
    for field in ("melodyGrammar", "expression"):
        if not isinstance(theme.get(field), dict):
            raise ValueError(f"心情主题缺少 {field}。")
    return theme


def latest_theme_draft(emotion_id: str) -> dict | None:
    root = THEME_DRAFTS_DIR / safe_id(emotion_id)
    candidates = sorted(root.glob("*/theme.json"), key=lambda path: path.stat().st_mtime, reverse=True) if root.is_dir() else []
    if not candidates:
        return None
    path = candidates[0]
    return {"draftId": path.parent.name, "theme": read_json(path), "createdAt": datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="seconds")}


def generate_theme(emotion_id: str, prompt: str) -> dict:
    labels = dict(FEELINGS)
    if emotion_id not in labels:
        raise ValueError("无法识别这个心情。")
    if not isinstance(prompt, str) or len(prompt.strip()) < 200:
        raise ValueError("请保留完整的心情主题提示词。")
    draft_id = f"{emotion_id}_{datetime.now():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:6]}"
    draft_dir = THEME_DRAFTS_DIR / emotion_id / draft_id
    draft_dir.mkdir(parents=True, exist_ok=False)
    prompt_path = draft_dir / "prompt.txt"
    output_path = draft_dir / "theme.json"
    raw_path = draft_dir / "qwen.raw.json"
    prompt_path.write_text(prompt.strip() + "\n", encoding="utf-8")
    run_script(
        SCRIPTS_DIR / "generate_json_document.py",
        "--prompt-file", prompt_path,
        "--output", output_path,
        "--raw-output", raw_path,
    )
    theme = validate_theme(read_json(output_path), emotion_id)
    output_path.write_text(json.dumps(theme, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"draftId": draft_id, "emotionId": emotion_id, "theme": theme, "prompt": prompt.strip()}


def build_theme_preview_skeleton(emotion_id: str, theme: dict) -> dict:
    degrees = theme["coreMotif"]["scaleDegrees"]
    durations = theme["coreMotif"]["referenceDurations"]
    melody = []
    beat = 0.0
    index = 0
    while beat < 16:
        duration = min(float(durations[index % len(durations)]), 16 - beat)
        degree = degrees[index % len(degrees)]
        melody.append({"pitch": DEGREE_TO_PITCH[degree], "beat": round(beat, 3), "duration": round(duration, 3), "velocity": 90})
        beat += duration
        index += 1
    return {
        "kitId": f"theme_{emotion_id}_preview", "feeling": theme["label"], "groove": "中性试听",
        "bpm": 104, "timeSignature": "4/4", "key": "C", "bars": 4, "melody": melody,
        "chords": [{"symbol": chord, "beat": index * 4} for index, chord in enumerate(theme["harmonyLanguage"]["primaryPlan"])],
        "bassRoots": [], "drumGrid": [], "lionAllowedBeats": [], "lionNotes": [],
    }


def preview_theme(emotion_id: str, theme: object) -> dict:
    if emotion_id not in dict(FEELINGS):
        raise ValueError("无法识别这个心情。")
    validated = validate_theme(theme, emotion_id)
    fluidsynth, soundfont = default_tools()
    if not fluidsynth.is_file() or not soundfont.is_file():
        raise ValueError("找不到音频渲染工具，请联系平台管理员。")
    preview_id = f"{datetime.now():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:6]}"
    preview_dir = THEME_PREVIEWS_DIR / safe_id(emotion_id) / preview_id
    preview_dir.mkdir(parents=True, exist_ok=False)
    skeleton_path = preview_dir / "theme-preview.json"
    midi_path = preview_dir / "theme-preview.mid"
    wav_path = preview_dir / "theme-preview.wav"
    skeleton_path.write_text(json.dumps(build_theme_preview_skeleton(emotion_id, validated), ensure_ascii=False, indent=2), encoding="utf-8")
    run_script(SCRIPTS_DIR / "render_midi.py", "--skeleton", skeleton_path, "--output", midi_path)
    run_script(SCRIPTS_DIR / "render_wav.py", "--fluidsynth", fluidsynth, "--soundfont", soundfont, "--midi", midi_path, "--output", wav_path, "--gain", "0.38", "--duration-seconds", str(16 * 60 / 104), "--loop-crossfade-ms", "20")
    return {"previewUrl": f"/theme-previews/{safe_id(emotion_id)}/{preview_id}/theme-preview.wav"}


def revise_theme(emotion_id: str, theme: object, prompt: str, feedback: str) -> dict:
    if emotion_id not in dict(FEELINGS):
        raise ValueError("无法识别这个心情。")
    current_theme = validate_theme(theme, emotion_id)
    if not isinstance(prompt, str) or len(prompt.strip()) < 200:
        raise ValueError("找不到完整的主题提示词，请刷新页面后重试。")
    if not isinstance(feedback, str) or not 4 <= len(feedback.strip()) <= 1200:
        raise ValueError("修改意见请写 4 到 1200 个字符。")
    draft_id = f"{emotion_id}_{datetime.now():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:6]}"
    draft_dir = THEME_DRAFTS_DIR / safe_id(emotion_id) / draft_id
    draft_dir.mkdir(parents=True, exist_ok=False)
    (draft_dir / "previous.json").write_text(json.dumps(current_theme, ensure_ascii=False, indent=2), encoding="utf-8")
    (draft_dir / "feedback.txt").write_text(feedback.strip() + "\n", encoding="utf-8")
    revision_prompt = f"""{prompt.strip()}

现在需要按照用户意见修改已经生成的心情主题母版。只返回完整 JSON 对象，不要输出解释或 Markdown。除非用户明确要求，请保留 emotionId、label、version、核心音乐身份与原提示词的所有格式限制；不要加入具体律动或乐器安排。母版强制节拍与收束要求：coreMotif.referenceDurations 必须与音级一一对应，时值总和严格等于两小节的 8 拍；最后一个音必须是主音（1 / do），在第 8 拍结束，并使用较长时值形成稳定、明亮、不突兀的收束。

当前主题 JSON：
{json.dumps(current_theme, ensure_ascii=False, indent=2)}

用户修改意见：
{feedback.strip()}
"""
    prompt_path = draft_dir / "revision-prompt.txt"
    output_path = draft_dir / "theme.json"
    raw_path = draft_dir / "qwen.raw.json"
    prompt_path.write_text(revision_prompt, encoding="utf-8")
    run_script(SCRIPTS_DIR / "generate_json_document.py", "--prompt-file", prompt_path, "--output", output_path, "--raw-output", raw_path)
    revised = validate_theme(read_json(output_path), emotion_id)
    output_path.write_text(json.dumps(revised, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"draftId": draft_id, "emotionId": emotion_id, "theme": revised, "prompt": prompt.strip()}


def lock_theme(emotion_id: str, theme: object) -> dict:
    validated = validate_theme(theme, emotion_id)
    THEMES_DIR.mkdir(parents=True, exist_ok=True)
    path = theme_path(emotion_id)
    path.write_text(json.dumps(validated, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"emotionId": emotion_id, "status": "locked", "theme": validated}


def build_combination_assets(emotion_id: str, groove_id: str) -> tuple[dict, str]:
    labels = dict(FEELINGS)
    grooves = {item["id"]: item for item in read_json(KNOWLEDGE_DIR / "grooves.json")}
    if emotion_id not in labels or groove_id not in grooves:
        raise ValueError("无法识别这个心情与律动组合。")
    source_path = theme_path(emotion_id)
    if not source_path.is_file():
        raise ValueError(f"请先生成并锁定“{labels[emotion_id]}”心情主题。")
    theme = validate_theme(read_json(source_path), emotion_id)
    groove = grooves[groove_id]
    instruments = read_json(KNOWLEDGE_DIR / "instruments.json")
    combination_rules = read_json(KNOWLEDGE_DIR / "combinations.json")
    override = {**combination_rules["overrides"][f"{emotion_id}_{groove_id}"], "ensembleStyle": combination_rules["defaults"]["ensembleStyle"]}
    kit_id = f"{emotion_id}_{groove_id}_v01"
    task = {
        "kitId": kit_id,
        "feeling": labels[emotion_id],
        "groove": groove["label"],
        "bpm": groove["bpm"],
        "timeSignature": "4/4",
        "key": "C major",
        "bars": 2,
        "totalBeats": 8,
        "targetAge": "6-12",
        "melodyRange": ["C4", "C5"],
        "model": "qwen3.7-max",
        "emotionThemeVersion": theme["version"],
        "coreMotif": theme["coreMotif"],
        "harmonyPlan": theme["harmonyLanguage"]["primaryPlan"],
        "grooveTemplate": groove,
        "instrumentProfile": instruments["version"],
        "combinationOverride": override,
    }
    motif_pitches = [DEGREE_TO_PITCH[value] for value in theme["coreMotif"]["scaleDegrees"]]
    prompt = f"""你是儿童音乐编曲助手。请根据已经锁定的心情主题母版和律动模板，生成严格两小节的完整音乐骨架JSON。

组合编号：{kit_id}
心情：{labels[emotion_id]}
律动：{groove['label']}
固定速度：{groove['bpm']} BPM；固定4/4拍、C大调、两小节共8拍。

必须继承的心情主题母版：
{json.dumps(theme, ensure_ascii=False, indent=2)}

必须执行的律动模板：
{json.dumps(groove, ensure_ascii=False, indent=2)}

必须执行的动物乐器规则：
{json.dumps(instruments, ensure_ascii=False, indent=2)}

本组合适配规则：
{json.dumps(override, ensure_ascii=False, indent=2)}

继承要求：
- melody 中必须按顺序完整出现一次核心动机音高：{', '.join(motif_pitches)}；可以改变八度内位置和每个音的时值，但不能改变音高顺序。
- chords 必须使用主题母版 harmonyLanguage.primaryPlan 中的4个和弦，并分别从第0、2、4、6拍开始。
- 律动模板中的 identity、melodyRhythm、drumRule、bassRule、keyboardRule 都是强制执行规则。不同律动不能只改 BPM：必须明显改变旋律时值与留白、鼓点拍位、贝斯时值与进入位置，以及萨克斯的进入空隙。
- 这是纯编曲，不依赖视觉角色。四件乐器用错位的音区、强弱与留白形成短暂突出：键盘在开头清楚领奏核心动机；贝斯在旋律停顿处安排一次有方向的短句；鼓组在乐句交接处安排一次短鼓花；萨克斯在主旋律空隙写一小句回应。不要让所有乐器持续叠在同一拍。
- 小狮子萨克斯与其他乐器使用同一层级的动物乐器规则；在 lionNotes 中写出4—6个具体音符，组成一句回应；其进入拍点必须服从当前律动，不得沿用其他律动的固定位置。

只返回JSON对象，顶层字段必须为：kitId、feeling、groove、bpm、timeSignature、key、bars、melody、chords、bassRoots、drumGrid、lionAllowedBeats、lionNotes。
示例结构：
{{
  "kitId": "{kit_id}",
  "feeling": "{emotion_id}",
  "groove": "{groove_id}",
  "bpm": {groove['bpm']},
  "timeSignature": "4/4",
  "key": "C major",
  "bars": 2,
  "melody": [{{"pitch":"C4","beat":0,"duration":0.5,"solfege":"do"}}],
  "chords": [{{"beat":0,"symbol":"C"}}],
  "bassRoots": [{{"pitch":"C2","beat":0,"duration":1}}],
  "drumGrid": [{{"instrument":"kick","beat":0,"duration":0.25}}],
  "lionAllowedBeats": [2.5,3,3.5,6,6.5,7],
  "lionNotes": [{{"pitch":"E5","beat":2.5,"duration":0.5,"velocity":88}}, {{"pitch":"G5","beat":3,"duration":0.5,"velocity":90}}, {{"pitch":"E5","beat":3.5,"duration":0.5,"velocity":86}}, {{"pitch":"C5","beat":6,"duration":0.5,"velocity":88}}]
}}
所有音符结束时间不得超过第8拍；melody 必须从第0拍开始，最后一个旋律音必须在第8拍结束，完整占满两小节；旋律限C4—C5，萨克斯限C4—G5；不要歌词、人声、转调或复杂装饰。
"""
    GENERATED_TASKS_DIR.mkdir(parents=True, exist_ok=True)
    generated_task_path(kit_id).write_text(json.dumps(task, ensure_ascii=False, indent=2), encoding="utf-8")
    return task, prompt


def blueprint() -> dict:
    records = list_records()
    record_status = {}
    for record in records:
        record_status.setdefault(record.get("kitId"), record.get("status"))
    themes = []
    for emotion_id, label in FEELINGS:
        path = theme_path(emotion_id)
        locked = read_json(path) if path.is_file() else None
        themes.append({
            "id": emotion_id,
            "label": label,
            "brief": EMOTION_BRIEFS[emotion_id],
            "status": "locked" if locked else "draft" if latest_theme_draft(emotion_id) else "empty",
            "theme": locked,
            "draft": latest_theme_draft(emotion_id),
            "prompt": theme_generation_prompt(emotion_id),
            "combinations": [
                {
                    "grooveId": groove_id,
                    "groove": groove_label,
                    "kitId": f"{emotion_id}_{groove_id}_v01",
                    "status": record_status.get(f"{emotion_id}_{groove_id}_v01", "ready" if locked else "blocked"),
                }
                for groove_id, groove_label in GROOVES
            ],
        })
    return {
        "project": read_json(KNOWLEDGE_DIR / "project.json"),
        "grooves": read_json(KNOWLEDGE_DIR / "grooves.json"),
        "instruments": read_json(KNOWLEDGE_DIR / "instruments.json"),
        "themes": themes,
    }


def default_tools() -> tuple[Path, Path]:
    local_app_data = Path(os.environ.get("LOCALAPPDATA", ""))
    fluidsynth_setting = os.environ.get("MUSIC_FLUIDSYNTH")
    soundfont_setting = os.environ.get("MUSIC_SOUNDFONT")
    tools_root = local_app_data / "music-audio-tools"
    bundled_fluidsynth = sorted(tools_root.glob("fluidsynth-v*/**/bin/fluidsynth.exe"), reverse=True)
    fluidsynth = Path(fluidsynth_setting) if fluidsynth_setting else (
        bundled_fluidsynth[0]
        if bundled_fluidsynth
        else tools_root / "fluidsynth-v2.5.7" / "fluidsynth-v2.5.7-win10-x64-cpp11" / "bin" / "fluidsynth.exe"
    )
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


def record_url(record_dir: Path, path: Path) -> str:
    return f"/records/{record_dir.name}/{path.relative_to(record_dir).as_posix()}"


def production_event(record: dict, event: str, detail: str = "") -> None:
    record.setdefault("events", []).append({
        "at": datetime.now().isoformat(timespec="seconds"),
        "event": event,
        "detail": detail,
    })


def read_record(record_id: str) -> tuple[Path, dict]:
    record_dir = (RECORDS_DIR / safe_id(record_id)).resolve()
    if record_dir.parent != RECORDS_DIR.resolve() or not record_dir.is_dir():
        raise ValueError("找不到这份音乐生产记录。")
    record_path = record_dir / "record.json"
    if not record_path.is_file():
        raise ValueError("这份音乐生产记录不完整。")
    return record_dir, json.loads(record_path.read_text(encoding="utf-8"))


def save_record(record_dir: Path, record: dict) -> None:
    (record_dir / "record.json").write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")


def list_recipes() -> list[dict]:
    recipes = []
    for feeling_id, feeling in FEELINGS:
        for groove_id, groove in GROOVES:
            kit_id = f"{feeling_id}_{groove_id}_v01"
            ready = theme_path(feeling_id).is_file()
            prompt = ""
            theme_version = None
            if ready:
                task, prompt = build_combination_assets(feeling_id, groove_id)
                theme_version = task["emotionThemeVersion"]
            recipes.append({
                "kitId": kit_id,
                "feeling": feeling,
                "groove": groove,
                "feelingId": feeling_id,
                "grooveId": groove_id,
                "model": "qwen3.7-max",
                "ready": ready,
                "themeVersion": theme_version,
                "prompt": prompt,
            })
    return recipes


def create_record(kit_id: str, prompt: str) -> dict:
    parts = safe_id(kit_id).removesuffix("_v01").split("_", 1)
    if len(parts) == 2:
        build_combination_assets(parts[0], parts[1])
    task_path = task_path_for_kit(kit_id)
    if not task_path.is_file():
        raise ValueError("找不到这个心情与律动组合。")
    if not isinstance(prompt, str) or len(prompt.strip()) < 80:
        raise ValueError("请先检查并确认完整提示词。")
    task = json.loads(task_path.read_text(encoding="utf-8"))
    record_id = f"{task['kitId']}_{datetime.now():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:6]}"
    record_dir = RECORDS_DIR / record_id
    record_dir.mkdir(parents=True, exist_ok=False)
    (record_dir / "prompt.txt").write_text(prompt.strip() + "\n", encoding="utf-8")
    record = {
        "recordId": record_id,
        "kitId": task["kitId"],
        "feeling": task["feeling"],
        "groove": task["groove"],
        "model": "qwen3.7-max",
        "status": "prompt_approved",
        "createdAt": datetime.now().isoformat(timespec="seconds"),
        "events": [],
    }
    production_event(record, "提示词已确认", "等待调用 Qwen3.7-Max 生成 JSON")
    save_record(record_dir, record)
    return {**record, "prompt": prompt.strip()}


def generate_record_json(record_id: str) -> dict:
    record_dir, record = read_record(record_id)
    if record.get("status") not in {"prompt_approved", "generation_failed"}:
        raise ValueError("请从已确认提示词的记录开始生成 JSON。")
    task_path = task_path_for_kit(record["kitId"])
    output_path = record_dir / "generated.json"
    raw_path = record_dir / "qwen.raw.json"
    try:
        run_script(
            SCRIPTS_DIR / "generate_skeleton_json_mode.py",
            "--task", task_path,
            "--prompt-file", record_dir / "prompt.txt",
            "--output", output_path,
            "--raw-output", raw_path,
        )
        run_script(SCRIPTS_DIR / "validate_skeleton.py", "--task", task_path, "--skeleton", output_path)
    except ValueError as error:
        record["status"] = "generation_failed"
        production_event(record, "JSON 生成失败", str(error))
        save_record(record_dir, record)
        raise
    skeleton = json.loads(output_path.read_text(encoding="utf-8"))
    record["status"] = "json_ready"
    record["jsonUrl"] = record_url(record_dir, output_path)
    record["rawUrl"] = record_url(record_dir, raw_path)
    production_event(record, "JSON 已通过自动检查", "可以生成整段试听")
    save_record(record_dir, record)
    return {**record, "skeleton": skeleton}


def revise_record_json(record_id: str, feedback: str) -> dict:
    record_dir, record = read_record(record_id)
    if record.get("status") not in {"json_ready", "preview_ready"}:
        raise ValueError("请先生成并试听 JSON；确认正式分轨后不能再修改这一版。")
    if not isinstance(feedback, str) or not 4 <= len(feedback.strip()) <= 1200:
        raise ValueError("修改意见请写 4 到 1200 个字符。")

    skeleton_path = record_dir / "generated.json"
    prompt_path = record_dir / "prompt.txt"
    if not skeleton_path.is_file() or not prompt_path.is_file():
        raise ValueError("找不到当前 JSON 或原始提示词。")

    revision_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    revision_dir = record_dir / "revisions" / revision_id
    revision_dir.mkdir(parents=True, exist_ok=False)
    current_skeleton = read_json(skeleton_path)
    original_prompt = prompt_path.read_text(encoding="utf-8").strip()
    (revision_dir / "previous.json").write_text(json.dumps(current_skeleton, ensure_ascii=False, indent=2), encoding="utf-8")
    (revision_dir / "feedback.txt").write_text(feedback.strip() + "\n", encoding="utf-8")

    revision_prompt = f"""{original_prompt}

现在需要在不改变任务身份的前提下修改一份已经生成的音乐 JSON。
必须只返回完整 JSON 对象，字段、数据结构和音符格式必须与当前 JSON 保持兼容；不要输出解释或 Markdown。
保留心情母版的核心动机、歌曲的 kitId、feeling、groove、拍号、小节数和基本段落结构，除非用户明确要求修改。
修改后仍须符合原提示词中的所有乐器、音域、节拍和主题继承规则。
歌曲必须严格两小节共 8 拍：melody 从第 0 拍开始，最后一个旋律音必须在第 8 拍结束，不能提前结束或超出。
新版乐队规则：这是纯编曲，不依赖视觉角色。四件乐器用错位的音区、强弱与留白形成短暂突出：键盘领奏核心动机；贝斯在旋律停顿处安排一次有方向的短句；鼓组在乐句交接处安排一次短鼓花；萨克斯在主旋律空隙写4—6个音组成的一小句回应。不要让所有乐器持续叠在同一拍。

当前 JSON：
{json.dumps(current_skeleton, ensure_ascii=False, indent=2)}

用户修改意见：
{feedback.strip()}
"""
    revision_prompt_path = revision_dir / "revision-prompt.txt"
    revision_prompt_path.write_text(revision_prompt, encoding="utf-8")
    output_path = record_dir / "generated.json"
    raw_path = revision_dir / "qwen.raw.json"
    try:
        run_script(
            SCRIPTS_DIR / "generate_skeleton_json_mode.py",
            "--task", task_path_for_kit(record["kitId"]),
            "--prompt-file", revision_prompt_path,
            "--output", output_path,
            "--raw-output", raw_path,
        )
        run_script(SCRIPTS_DIR / "validate_skeleton.py", "--task", task_path_for_kit(record["kitId"]), "--skeleton", output_path)
    except ValueError:
        (revision_dir / "failed.json").write_text(output_path.read_text(encoding="utf-8"), encoding="utf-8") if output_path.is_file() else None
        (revision_dir / "previous.json").replace(output_path)
        raise

    skeleton = read_json(output_path)
    record["status"] = "json_ready"
    record.pop("previewUrl", None)
    record["revisionCount"] = int(record.get("revisionCount", 0)) + 1
    production_event(record, "JSON 已按修改意见更新", feedback.strip())
    save_record(record_dir, record)
    return {**record, "skeleton": skeleton}


def render_record_preview(record_id: str) -> dict:
    record_dir, record = read_record(record_id)
    if record.get("status") not in {"json_ready", "preview_ready"}:
        raise ValueError("请先生成并通过检查的 JSON。")
    skeleton_path = record_dir / "generated.json"
    if not skeleton_path.is_file():
        raise ValueError("找不到已生成的 JSON。")
    skeleton = json.loads(skeleton_path.read_text(encoding="utf-8"))
    fluidsynth, soundfont = default_tools()
    if not fluidsynth.is_file() or not soundfont.is_file():
        raise ValueError("找不到音频渲染工具，请联系平台管理员。")
    task_path = task_path_for_kit(record["kitId"])
    run_script(SCRIPTS_DIR / "validate_skeleton.py", "--task", task_path, "--skeleton", skeleton_path)
    midi_path = record_dir / "preview.mid"
    preview_path = record_dir / "preview.wav"
    run_script(SCRIPTS_DIR / "render_midi.py", "--skeleton", skeleton_path, "--output", midi_path)
    numerator, denominator = (int(value) for value in str(skeleton["timeSignature"]).split("/", 1))
    duration_seconds = float(skeleton["bars"]) * (numerator * 4 / denominator) * 60 / float(skeleton["bpm"])
    run_script(
        SCRIPTS_DIR / "render_wav.py",
        "--fluidsynth", fluidsynth,
        "--soundfont", soundfont,
        "--midi", midi_path,
        "--output", preview_path,
        "--gain", "0.38",
        "--duration-seconds", str(duration_seconds),
        "--loop-crossfade-ms", "20",
    )
    record["status"] = "preview_ready"
    record["previewUrl"] = record_url(record_dir, preview_path)
    production_event(record, "整段试听已生成", "等待人工试听确认")
    save_record(record_dir, record)
    return record


def approve_record_preview(record_id: str) -> dict:
    record_dir, record = read_record(record_id)
    if record.get("status") != "preview_ready":
        raise ValueError("请先生成整段试听后再确认。")
    record["status"] = "preview_approved"
    production_event(record, "试听已人工确认", "可以生成正式分轨")
    save_record(record_dir, record)
    return record


def create_record_stems(record_id: str) -> dict:
    record_dir, record = read_record(record_id)
    if record.get("status") not in {"preview_approved", "stems_ready"}:
        raise ValueError("请先试听并确认，再生成正式分轨。")
    skeleton_path = record_dir / "generated.json"
    if not skeleton_path.is_file():
        raise ValueError("找不到已确认的 JSON。")
    job = process_skeleton(json.loads(skeleton_path.read_text(encoding="utf-8")))
    record["status"] = "stems_ready"
    record["jobId"] = job["jobId"]
    production_event(record, "正式分轨已生成", "可进入调音与导出")
    save_record(record_dir, record)
    return {"record": record, "job": job}


def list_records() -> list[dict]:
    if not RECORDS_DIR.is_dir():
        return []
    records = []
    for record_path in sorted(RECORDS_DIR.glob("*/record.json"), key=lambda path: path.stat().st_mtime, reverse=True):
        try:
            records.append(json.loads(record_path.read_text(encoding="utf-8")))
        except (OSError, ValueError, json.JSONDecodeError):
            continue
    return records[:50]


def ensure_lion_stem(job_dir: Path, skeleton: dict) -> None:
    """为旧版三轨任务补齐小狮子萨克斯，保留其余既有分轨。"""
    kit_id = safe_id(skeleton.get("kitId"))
    midi_dir = job_dir / "midi"
    stems_dir = job_dir / "stems"
    lion_stem = stems_dir / f"{kit_id}_lion.wav"
    if lion_stem.is_file():
        return

    fluidsynth, soundfont = default_tools()
    if not fluidsynth.is_file() or not soundfont.is_file():
        raise ValueError("找不到本机 FluidSynth 或 MuseScore General 音色库，无法补生成小狮子分轨。")

    midi_dir.mkdir(parents=True, exist_ok=True)
    full_midi = midi_dir / f"{kit_id}.mid"
    run_script(SCRIPTS_DIR / "render_midi.py", "--skeleton", job_dir / "skeleton.json", "--output", full_midi)
    run_script(
        SCRIPTS_DIR / "split_midi_stems.py",
        "--midi", full_midi,
        "--output-dir", midi_dir,
        "--prefix", kit_id,
    )
    numerator, denominator = (int(value) for value in str(skeleton["timeSignature"]).split("/", 1))
    duration_seconds = float(skeleton["bars"]) * (numerator * 4 / denominator) * 60 / float(skeleton["bpm"])
    run_script(
        SCRIPTS_DIR / "render_wav.py",
        "--fluidsynth", fluidsynth,
        "--soundfont", soundfont,
        "--midi", midi_dir / f"{kit_id}_lion.mid",
        "--output", lion_stem,
        "--gain", str(RENDER_GAINS["lion"]),
        "--duration-seconds", str(duration_seconds),
        "--loop-crossfade-ms", "20",
    )


def process_skeleton(skeleton: dict) -> dict:
    kit_id = safe_id(skeleton.get("kitId"))
    task_path = task_path_for_kit(kit_id)
    if not task_path.is_file():
        raise ValueError(f"找不到编号 {kit_id} 对应的任务卡；请先在主题工作台完成对应心情母版。")

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
            ensure_lion_stem(job_dir, skeleton)
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
        if request_path == "/api/recipes":
            self.send_json(200, {"recipes": list_recipes()})
            return
        if request_path == "/api/blueprint":
            self.send_json(200, blueprint())
            return
        if request_path == "/api/records":
            self.send_json(200, {"records": list_records()})
            return
        if request_path == "/api/jobs":
            self.send_json(200, {"jobs": list_jobs()})
            return
        if request_path.startswith("/records/"):
            relative = Path(request_path.removeprefix("/records/"))
            candidate = (RECORDS_DIR / relative).resolve()
            if RECORDS_DIR.resolve() not in candidate.parents:
                self.send_error(403)
                return
            self.serve_file(candidate)
            return
        if request_path.startswith("/theme-previews/"):
            relative = Path(request_path.removeprefix("/theme-previews/"))
            candidate = (THEME_PREVIEWS_DIR / relative).resolve()
            if THEME_PREVIEWS_DIR.resolve() not in candidate.parents:
                self.send_error(403)
                return
            self.serve_file(candidate)
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
            if self.path == "/api/records":
                self.send_json(200, create_record(payload.get("kitId", ""), payload.get("prompt", "")))
                return
            if self.path == "/api/themes/generate":
                self.send_json(200, generate_theme(payload.get("emotionId", ""), payload.get("prompt", "")))
                return
            if self.path == "/api/themes/preview":
                self.send_json(200, preview_theme(payload.get("emotionId", ""), payload.get("theme")))
                return
            if self.path == "/api/themes/revise":
                self.send_json(200, revise_theme(payload.get("emotionId", ""), payload.get("theme"), payload.get("prompt", ""), payload.get("feedback", "")))
                return
            if self.path == "/api/themes/lock":
                self.send_json(200, lock_theme(payload.get("emotionId", ""), payload.get("theme")))
                return
            if self.path == "/api/records/generate":
                self.send_json(200, generate_record_json(payload.get("recordId", "")))
                return
            if self.path == "/api/records/revise":
                self.send_json(200, revise_record_json(payload.get("recordId", ""), payload.get("feedback", "")))
                return
            if self.path == "/api/records/preview":
                self.send_json(200, render_record_preview(payload.get("recordId", "")))
                return
            if self.path == "/api/records/approve":
                self.send_json(200, approve_record_preview(payload.get("recordId", "")))
                return
            if self.path == "/api/records/stems":
                self.send_json(200, create_record_stems(payload.get("recordId", "")))
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
    parser.add_argument("--host", default=os.environ.get("MUSIC_STUDIO_HOST", "127.0.0.1"))
    parser.add_argument("--open", action="store_true", help="启动后自动打开浏览器")
    args = parser.parse_args()

    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    RECORDS_DIR.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    studio_url = f"http://{args.host}:{args.port}"
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
