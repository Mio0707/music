"""儿童音乐分轨平台：本地上传 JSON、生成分轨并导出混音。"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import traceback
import uuid
import wave
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock, Timer
from urllib.parse import unquote, urlparse


STUDIO_DIR = Path(__file__).resolve().parent
AUDIO_DIR = STUDIO_DIR.parent
PROJECT_DIR = AUDIO_DIR.parent
ENV_FILE = PROJECT_DIR / ".env"
FRONTEND_MUSIC_DIR = PROJECT_DIR / "prototype" / "assets" / "music"
DEMO_DIR = PROJECT_DIR / "prototype"
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
AUTO_REPAIR_LIMIT = 2
ANIMALS = ("bear", "cat", "dog", "lion")
ANIMAL_ROLES = {
    "bear": "keyboard_and_melody",
    "cat": "bass",
    "dog": "drums",
    "lion": "alto_sax_response",
}
PUBLISH_LOCK = Lock()
RENDER_GAINS = {"bear": 0.52, "cat": 0.82, "dog": 0.55, "lion": 0.52}
FEELINGS = (
    ("happy", "开心"),
    ("calm", "放松"),
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

DRUM_MOOD_GUIDANCE = {
    "happy": "力度明亮、有弹性；可以加入极少量轻巧双跳或句尾回应，但不要变得拥挤。",
    "calm": "整体力度更轻、减少非核心装饰；核心鼓点必须完整保留，不能因为放松而失去律动身份。",
    "brave": "底鼓和主要军鼓更坚定、重心清楚；装饰保持简单，不用密集鼓花制造勇敢感。",
    "longing": "力度柔和、踩镲不过亮，第二小节可略微收弱或留出呼吸；核心鼓点仍必须完整。",
}

GROOVE_IDENTITY_GATES = {
    "steady": "稳稳走的最低身份：melody 至少70%的音从整数拍开始；bassRoots 使用3—5个音、全部从整数拍开始且每音至少1拍；hihat只保留整数拍核心脚步，不加入弱拍踩镲。整体必须听成均匀、可预测的步行，不能出现Shuffle式延后推动。",
    "bounce": "蹦蹦跳的最低身份：保留四踩底鼓与反拍踩镲，通过短音、休止或轻重形成清楚的弹起—落下；不得退化成均匀长音步行。",
    "sway": "摇一摇的最低身份：melody 至少有2个音从三连音弱拍 n+0.333 或 n+0.667 开始；bassRoots 至少6个音，并至少有2个音从三连音弱拍开始。弱拍推动应安排在主旋律留白或长音处，形成持续可听见的长短摆动，不能只在一个局部象征性使用Shuffle，也不能变成慢版稳稳走。",
    "forward": "向前冲的最低身份：保留连续八分推进核心，至少一个主要运动声部持续给出向前方向；不得留下类似稳稳走的大段均匀长音空白。",
}

DEGREE_TO_PITCH = {1: "C4", 2: "D4", 3: "E4", 4: "F4", 5: "G4", 6: "A4", 7: "B4"}

ENSEMBLE_COORDINATION_RULES = """声部协作与整洁度规则：
- 小熊键盘的 melody 是唯一前景主旋律。贝斯负责稳定和声与律动；萨克斯只能选择“完整回应乐句”或“柔和背景长音”一种角色，不能再形成第二条前景旋律。
- 同一拍最多让一个有音高声部进行明显的短音、切分或方向变化；其他有音高声部应使用长音、简单支撑或休止。避免主旋律转折、贝斯经过音、萨克斯进入和鼓组装饰同时发生。
- 贝斯只允许使用 C2、D2、E2、F2、G2、A2、B2、C3；D3及更高音、降号和升号均禁止。重拍与持续1拍以上的音必须使用当前和弦根音或五度音；经过音只能短暂出现在弱拍并尽快解决。主旋律活跃时，贝斯与萨克斯至少有一个保持长音或休止。
- 主旋律与萨克斯同时持续发声时，萨克斯优先使用当前和弦音，并优先形成三度、六度或较开阔的协和音程；重叠达到0.5拍时，禁止形成半音或全音相邻关系。找不到协和音时，优先延后进入、提前结束或留白，不要强行填音。
- 每个换和弦位置都必须检查正在持续的主旋律与萨克斯音：该音应属于新和弦；否则必须在换和弦后1拍内级进解决到新和弦音。和弦换拍也必须落在当前律动的时间网格上，但不要求等长分配。
- 萨克斯必须形成完整演奏意图，不能每隔一两拍机械地吹一个孤立音。回应乐句全曲1—2句，每句2—4个连贯音、约1.5—3拍，相邻音间隔不超过0.5拍；背景长音全曲1—2个音，每音至少1.5拍且力度低于前景。短于1.5拍的单音必须与前后音连接成句。
- 第7—8拍进入收束区，不新增萨克斯回应、贝斯经过音或鼓组填充；主旋律负责完成结尾，其他声部使用稳定长音、根音或休止。
- 输出前按0—8拍检查完整时间线。若出现两套弱拍网格混用、两个旋律声部同时密集运动、持续相邻音摩擦，或三个有音高声部在同一位置同时做短音变化，必须先简化再输出。"""


def read_json(path: Path) -> dict | list:
    return json.loads(path.read_text(encoding="utf-8"))


def load_local_env(path: Path = ENV_FILE) -> None:
    """Load simple KEY=VALUE settings from the project .env file.

    Existing system environment variables take precedence, so a developer can
    still override a local setting for a single run without editing the file.
    """
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ.setdefault(key, value)


def theme_path(emotion_id: str) -> Path:
    return THEMES_DIR / f"{safe_id(emotion_id)}.json"


def theme_prompt_path(emotion_id: str) -> Path:
    return THEMES_DIR / f"{safe_id(emotion_id)}.prompt.txt"


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
- referenceDurations 是母版的呼吸参考，不是后续四种律动必须逐音照搬的硬性时值；后续改编可以重新分配各音时值，但必须保留核心音高顺序并严格覆盖8拍。
- 母版唯一硬性时间要求：核心动机必须严格覆盖两小节共 8 拍，referenceDurations 总和必须等于 8；结尾音高、音数、长短和收束方式由心情表达决定。
- 请为这个心情原创一段核心动机：使用 1—7 的音级数字，长度 2—16 个音；referenceDurations 与音级一一对应，所有时值相加必须严格等于 8 拍。
- 不得复用其他心情已经锁定的核心动机。现有记录：{locked_motif_text}。
- 和弦只使用 C、Dm、Em、F、G、Am；primaryPlan 给出 1—4 个和弦，作为四种律动共同继承的和声身份。
- primaryPlan 只规定和弦顺序，不代表等长分配；不要固定每个和弦占几拍。设计核心动机时，必须在内部为这组和弦找到一套覆盖 8 拍、符合乐句呼吸的自然换位方案，但不要为此新增输出字段。
- 允许切分、跨拍长音和弱拍换和弦。每次预想换和弦时，如果旋律正在发声，该音必须是新和弦的和弦音，或是能够在 1 拍内级进解决到和弦音的延留音。
- 重拍音以及持续 1 拍以上的长音优先使用当前和弦音；短促弱拍音可以作为经过音或邻音。避免同一和弦上连续出现两个没有解决的非和弦音。
- 核心动机的节奏允许自由变化，但每次和声变化后要尽快建立稳定落点；不要为了对齐而把旋律机械地切成等长音符。
- 核心动机必须单独演奏时就清楚、易记、适合儿童跟唱；避免连续大跳、连续未解决非和弦音或整段没有呼吸重心。需要至少形成一个清楚的乐句转折，并在第7—8拍为后续编曲留下稳定、易收束的结尾空间。
- 母版之后会加入贝斯、鼓与萨克斯，因此不要依靠高密度音符维持情绪；优先用轮廓、重复、长短对比和稳定落点建立身份，使四种律动都能在不堆叠声部的情况下完成改编。
- 输出前必须检查所有预想的换和弦位置、重拍音和长音。若出现未经准备或解决的非和弦音，优先调整和弦选择或内部换位，其次才调整单个音级，同时保留当前心情要求的旋律轮廓与呼吸感；如果仍找不到协调的 8 拍方案，必须重新创作，不要输出存在冲突的方案。
- 母版要定义共同的力度、触感和乐句呼吸，但不要在这里单独定义任何一种乐器。

只返回JSON对象，不要返回Markdown。必须严格包含以下字段：
- emotionId：固定为 "{emotion_id}"。
- label：固定为 "{labels[emotion_id]}"。
- version：固定为 "{emotion_id}-theme-v1"。
- designIntent：一句话定义这个心情的音乐身份。
- coreMotif.scaleDegrees：你原创的2—16个音级整数数组，每个值只能是1—7。
- coreMotif.referenceDurations：与scaleDegrees等长的正数数组；所有数值相加必须严格等于 8。
- coreMotif.requiredAppearances：固定为1。
- melodyGrammar：包含contour、preferredIntervals、phraseEnding、noteDensity。
- harmonyLanguage：包含primaryPlan、allowedChords、cadence；其中primaryPlan包含1—4个和弦。
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
    if not isinstance(degrees, list) or not 2 <= len(degrees) <= 16 or any(not isinstance(value, int) or not 1 <= value <= 7 for value in degrees):
        raise ValueError("coreMotif.scaleDegrees 必须包含2—16个1—7音级。")
    if not isinstance(durations, list) or len(durations) != len(degrees) or any(not isinstance(value, (int, float)) or value <= 0 for value in durations):
        raise ValueError("核心动机的参考时值必须与音级一一对应。")
    if abs(sum(float(value) for value in durations) - 8.0) > 0.001:
        raise ValueError("核心动机的参考时值总和必须严格等于两小节的 8 拍。")
    for other_id, other_label in FEELINGS:
        path = theme_path(other_id)
        if other_id == emotion_id or not path.is_file():
            continue
        other_degrees = read_json(path).get("coreMotif", {}).get("scaleDegrees")
        if other_degrees == degrees:
            raise ValueError(f"核心动机与已锁定的“{other_label}”完全相同，请重新生成不同旋律。")
    harmony = theme.get("harmonyLanguage")
    allowed_chords = {"C", "Dm", "Em", "F", "G", "Am"}
    if not isinstance(harmony, dict) or not isinstance(harmony.get("primaryPlan"), list) or not 1 <= len(harmony["primaryPlan"]) <= 4:
        raise ValueError("harmonyLanguage.primaryPlan 必须包含1—4个和弦。")
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
    source_prompt_path = path.parent / "source-prompt.txt"
    legacy_prompt_path = path.parent / "prompt.txt"
    source_prompt = (
        source_prompt_path.read_text(encoding="utf-8").strip()
        if source_prompt_path.is_file()
        else legacy_prompt_path.read_text(encoding="utf-8").strip()
        if legacy_prompt_path.is_file()
        else None
    )
    return {
        "draftId": path.parent.name,
        "theme": read_json(path),
        "sourcePrompt": source_prompt,
        "createdAt": datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="seconds"),
        "modifiedAtNs": path.stat().st_mtime_ns,
    }


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
    source_prompt_path = draft_dir / "source-prompt.txt"
    output_path = draft_dir / "theme.json"
    raw_path = draft_dir / "qwen.raw.json"
    prompt_path.write_text(prompt.strip() + "\n", encoding="utf-8")
    source_prompt_path.write_text(prompt.strip() + "\n", encoding="utf-8")
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
    (draft_dir / "source-prompt.txt").write_text(prompt.strip() + "\n", encoding="utf-8")
    revision_prompt = f"""{prompt.strip()}

现在需要按照用户意见修改已经生成的心情主题母版。只返回完整 JSON 对象，不要输出解释或 Markdown。除非用户明确要求，请保留 emotionId、label、version 和核心音乐身份；不要加入具体律动或乐器安排。唯一硬性时间要求是 coreMotif.referenceDurations 与音级一一对应，时值总和严格等于两小节的 8 拍。结尾音高、音数、长短和收束方式可按用户意见自由调整。

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


def lock_theme(emotion_id: str, theme: object, prompt: object) -> dict:
    validated = validate_theme(theme, emotion_id)
    if not isinstance(prompt, str) or len(prompt.strip()) < 200:
        raise ValueError("找不到生成这份母版所用的完整提示词，请先重新生成 JSON。")
    THEMES_DIR.mkdir(parents=True, exist_ok=True)
    path = theme_path(emotion_id)
    path.write_text(json.dumps(validated, ensure_ascii=False, indent=2), encoding="utf-8")
    theme_prompt_path(emotion_id).write_text(prompt.strip() + "\n", encoding="utf-8")
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
        "feelingId": emotion_id,
        "grooveId": groove_id,
        "feeling": labels[emotion_id],
        "groove": groove["label"],
        "bpm": groove["bpm"],
        "timeSignature": "4/4",
        "key": "C major",
        "bars": 2,
        "totalBeats": 8,
        "targetAge": "6-12",
        "melodyRange": ["C4", "C5"],
        "bassAllowedPitches": ["C2", "D2", "E2", "F2", "G2", "A2", "B2", "C3"],
        "model": "qwen3.7-max",
        "emotionThemeVersion": theme["version"],
        "coreMotif": theme["coreMotif"],
        "harmonyPlan": theme["harmonyLanguage"]["primaryPlan"],
        "grooveTemplate": groove,
        "grooveIdentityGate": GROOVE_IDENTITY_GATES[groove_id],
        "drumMoodGuidance": DRUM_MOOD_GUIDANCE[emotion_id],
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

律动创作方向（鼓组 drumCore 是锁定内容，其他描述用于形成可辨认的不同演绎）：
{json.dumps(groove, ensure_ascii=False, indent=2)}

当前心情对鼓组的演绎要求：
{DRUM_MOOD_GUIDANCE[emotion_id]}

当前律动必须达到的最低身份：
{GROOVE_IDENTITY_GATES[groove_id]}

动物乐器创作参考（只规定角色和数据接口，不规定固定句型）：
{json.dumps(instruments, ensure_ascii=False, indent=2)}

本组合适配规则：
{json.dumps(override, ensure_ascii=False, indent=2)}

继承要求：
- melody 中必须按顺序完整出现一次核心动机音高：{', '.join(motif_pitches)}；不能改变音高顺序。coreMotif.referenceDurations 只是母版呼吸参考，不是逐音硬性时值；可以重新分配各音时值，必要时应缩短与和弦冲突的长音，同时保证 melody 从第0拍开始并在第8拍结束。
- chords 必须使用主题母版 harmonyLanguage.primaryPlan 中的全部和弦并保持顺序；第一个和弦从第0拍开始，其余换和弦拍点可在8拍内自由安排且严格递增。
- 律动模板描述整体听感方向。四种律动必须听起来是同一母版的不同演绎，不能只改 BPM；模型可在下方声部协作、时间网格与和声规则范围内决定旋律时值、留白和伴奏写法。
- 鼓组采用“核心鼓型＋心情微调”：drumGrid 必须完整包含 grooveTemplate.drumCore.lockedEvents 中每件鼓的全部核心拍点，不得移动、删除或替换；可以根据当前心情调整力度、加入少量可选装饰和设计第二小节细节，但不能改变核心律动身份。同一种律动跨不同心情必须能听出相同鼓型。
- 四件乐器都必须提供可渲染的数据。不机械固定每个声部的音数与拍点，但必须先分配唯一前景、陪衬角色和活动位置，并严格遵守下方协作规则。
- lionAllowedBeats 只为兼容旧数据保留，可以为空；lionNotes 直接写出萨克斯音高、拍点、时值和力度即可。

约束优先级与合法调整范围：
- 不可修改：kitId、心情、律动、速度、拍号、小节数、核心动机音高顺序、母版和弦符号及顺序、grooveTemplate.drumCore.lockedEvents。
- 可以调整：核心动机及其他旋律音的时值、休止与八度内位置，和弦进入拍点，贝斯节奏，萨克斯音高、时值和进入位置，以及非锁定鼓组装饰。
- 若旋律长音与和弦冲突，依次尝试缩短该音、移动后续换和弦拍点、让该音在1拍内级进解决；不得替换、删除或重排母版和弦。
- 若萨克斯与主旋律冲突，依次尝试改为当前和弦内的协和音、错开进入、缩短或留白；不得修改核心动机音高来迁就萨克斯。

{ENSEMBLE_COORDINATION_RULES}

当前律动的节奏网格：
- 如果 grooveTemplate.id 为 sway，所有有音高声部的开始与结束位置统一使用三连音式网格（整数拍、约 n+0.333 或 n+0.667），不得混入 n+0.5 的直八分弱拍；JSON拍点已经是最终摇摆位置，不能假设播放器再次施加 swing。
- steady、bounce、forward 使用直拍网格，主要使用整数拍与 n+0.5；不要混入 n+0.333 或 n+0.667 的摇摆弱拍。
- 节奏网格只统一时间基准，不要求各声部使用相同节奏，也不固定和弦每几拍切换；chords 的换拍位置同样必须落在当前网格上。

只返回JSON对象，顶层字段必须为：kitId、feeling、groove、bpm、timeSignature、key、bars、melody、chords、bassRoots、drumGrid、lionAllowedBeats、lionNotes。
字段格式：melody 每项包含 pitch、beat、duration、solfege；chords 每项包含 beat、symbol；bassRoots 每项包含 pitch、beat、duration；drumGrid 每项包含 instrument、beat、duration、velocity；lionNotes 每项包含 pitch、beat、duration、velocity。不要为了模仿示例而生成孤立音，所有数组都要根据当前母版与律动完整创作。
技术安全线：所有音符开始拍不得小于0，时值必须大于0，结束时间不得超过第8拍；melody 必须从第0拍开始并恰好在第8拍结束；旋律限C4—C5；贝斯只允许C2、D2、E2、F2、G2、A2、B2、C3，禁止D3及以上音；萨克斯允许A3—G5、常规推荐C4—G5，需要温暖低沉或回望感时可使用A3与B3；鼓和音符力度使用1—127。不要歌词、人声或临时变速。
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
        locked_prompt_file = theme_prompt_path(emotion_id)
        locked_prompt = locked_prompt_file.read_text(encoding="utf-8").strip() if locked_prompt_file.is_file() else None
        latest_draft = latest_theme_draft(emotion_id)
        pending_draft = latest_draft if latest_draft and (not locked or latest_draft["modifiedAtNs"] > path.stat().st_mtime_ns) else None
        if latest_draft:
            latest_draft.pop("modifiedAtNs", None)
        themes.append({
            "id": emotion_id,
            "label": label,
            "brief": EMOTION_BRIEFS[emotion_id],
            "status": "locked" if locked else "draft" if latest_draft else "empty",
            "theme": locked,
            "lockedPrompt": locked_prompt,
            "draft": latest_draft,
            "pendingDraft": pending_draft,
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


def auto_repair_skeleton(
    *,
    task_path: Path,
    output_path: Path,
    context_prompt_path: Path,
    repair_root: Path,
    initial_error: ValueError,
) -> tuple[int, str]:
    """Ask the model to fix validation errors, with a small bounded retry loop."""
    if not output_path.is_file():
        raise initial_error

    original_context = context_prompt_path.read_text(encoding="utf-8").strip()
    latest_error = str(initial_error)
    first_error = latest_error
    repair_root.mkdir(parents=True, exist_ok=True)

    for attempt in range(1, AUTO_REPAIR_LIMIT + 1):
        attempt_dir = repair_root / f"attempt-{attempt}"
        if attempt_dir.exists():
            attempt_dir = repair_root / f"attempt-{attempt}-{uuid.uuid4().hex[:6]}"
        attempt_dir.mkdir(parents=True, exist_ok=False)
        previous_path = attempt_dir / "previous.json"
        shutil.copy2(output_path, previous_path)
        current_json = output_path.read_text(encoding="utf-8")
        (attempt_dir / "validation-error.txt").write_text(latest_error + "\n", encoding="utf-8")

        repair_prompt = f"""{original_context}

这份音乐 JSON 没有通过系统的技术检查。请根据检查结果自动修正。
只修正检查指出的问题以及为保持音乐连贯所必需的相关内容；保留同一心情母版、律动方向和其他已经有效的创作内容。
必须返回完整 JSON 对象，不要输出解释、Markdown 或代码围栏。

自动修复时必须遵守以下边界：
- 不可修改：kitId、心情、律动、速度、拍号、小节数、核心动机音高顺序、母版和弦符号及顺序、锁定鼓点。
- 可以调整：旋律时值与休止、和弦进入拍点、贝斯节奏、萨克斯音高与进入位置，以及非锁定装饰。
- referenceDurations 只是母版参考，可以重新分配；长音与和弦冲突时优先缩短长音或移动换和弦拍点，不得替换母版和弦。
- 贝斯只能使用 C2、D2、E2、F2、G2、A2、B2、C3。萨克斯与主旋律重叠达到0.5拍时不得形成半音或全音相邻关系；无法协和时优先错开或留白。
- 修复后逐拍复查0—8拍的旋律、和弦、贝斯和萨克斯，不要在解决一个错误时制造新的继承、音域或声部冲突。

自动检查结果：
{latest_error}

当前待修正 JSON：
{current_json}
"""
        repair_prompt_path = attempt_dir / "repair-prompt.txt"
        repair_prompt_path.write_text(repair_prompt, encoding="utf-8")
        candidate_path = attempt_dir / "candidate.json"
        raw_path = attempt_dir / "qwen.raw.json"

        try:
            run_script(
                SCRIPTS_DIR / "generate_skeleton_json_mode.py",
                "--task", task_path,
                "--prompt-file", repair_prompt_path,
                "--output", candidate_path,
                "--raw-output", raw_path,
            )
        except ValueError as error:
            raise ValueError(f"自动修改第 {attempt} 次时调用模型失败：{error}") from error

        try:
            run_script(SCRIPTS_DIR / "validate_skeleton.py", "--task", task_path, "--skeleton", candidate_path)
        except ValueError as error:
            latest_error = str(error)
            shutil.copy2(candidate_path, output_path)
            continue

        shutil.copy2(candidate_path, output_path)
        return attempt, first_error

    raise ValueError(f"自动修改 {AUTO_REPAIR_LIMIT} 次后仍未通过检查：{latest_error}")


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
    except ValueError as error:
        record["status"] = "generation_failed"
        production_event(record, "JSON 生成失败", str(error))
        save_record(record_dir, record)
        raise

    repair_attempts = 0
    try:
        run_script(SCRIPTS_DIR / "validate_skeleton.py", "--task", task_path, "--skeleton", output_path)
    except ValueError as validation_error:
        try:
            repair_attempts, first_error = auto_repair_skeleton(
                task_path=task_path,
                output_path=output_path,
                context_prompt_path=record_dir / "prompt.txt",
                repair_root=record_dir / "auto-repairs",
                initial_error=validation_error,
            )
            production_event(record, "JSON 自动修改后通过检查", f"第 {repair_attempts} 次修改通过；原错误：{first_error}")
        except ValueError as error:
            record["status"] = "generation_failed"
            production_event(record, "JSON 自动修改后仍未通过", str(error))
            save_record(record_dir, record)
            raise
    skeleton = json.loads(output_path.read_text(encoding="utf-8"))
    record["status"] = "json_ready"
    record["jsonUrl"] = record_url(record_dir, output_path)
    record["rawUrl"] = record_url(record_dir, raw_path)
    record["lastAutoRepairAttempts"] = repair_attempts
    record["autoRepairCount"] = int(record.get("autoRepairCount", 0)) + repair_attempts
    production_event(record, "JSON 已通过自动检查", "可以生成整段试听")
    save_record(record_dir, record)
    return {**record, "skeleton": skeleton}


def save_record_json(record_id: str, skeleton: object) -> dict:
    record_dir, record = read_record(record_id)
    if record.get("status") not in {"json_ready", "preview_ready"}:
        raise ValueError("请先生成一份通过检查的 JSON，再手动修改。")
    if not isinstance(skeleton, dict):
        raise ValueError("JSON 顶层必须是一个完整对象。")

    output_path = record_dir / "generated.json"
    if not output_path.is_file():
        raise ValueError("找不到当前已保存的 JSON。")

    revision_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    revision_dir = record_dir / "manual-revisions" / revision_id
    revision_dir.mkdir(parents=True, exist_ok=False)
    previous_skeleton = read_json(output_path)
    previous_text = json.dumps(previous_skeleton, ensure_ascii=False, indent=2)
    candidate_text = json.dumps(skeleton, ensure_ascii=False, indent=2)
    (revision_dir / "previous.json").write_text(previous_text, encoding="utf-8")
    candidate_path = revision_dir / "candidate.json"
    candidate_path.write_text(candidate_text, encoding="utf-8")

    task_path = task_path_for_kit(record["kitId"])
    try:
        run_script(SCRIPTS_DIR / "validate_skeleton.py", "--task", task_path, "--skeleton", candidate_path)
    except ValueError:
        candidate_path.replace(revision_dir / "failed.json")
        raise

    output_path.write_text(candidate_text, encoding="utf-8")
    record["status"] = "json_ready"
    record.pop("previewUrl", None)
    record["manualRevisionCount"] = int(record.get("manualRevisionCount", 0)) + 1
    record["lastAutoRepairAttempts"] = 0
    production_event(record, "JSON 已手动修改并通过检查", f"手动修改第 {record['manualRevisionCount']} 次")
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
保留心情母版的核心动机与和弦顺序，以及歌曲的 kitId、feeling、groove、速度、拍号和小节数。
原提示词中如果存在与当前公共规则无关的旧版固定音数、固定和弦换拍或机械等分要求，这些旧约束作废；但 grooveTemplate.drumCore.lockedEvents、统一节奏网格、唯一前景主旋律、声部避让和萨克斯成句规则是当前有效要求，必须保留。
歌曲必须严格两小节共 8 拍：melody 从第 0 拍开始，最后一个旋律音必须在第 8 拍结束，不能提前结束或超出。
新版规则保留母版继承、鼓组核心身份与技术安全线：主旋律必须包含母版核心动机音高顺序；referenceDurations 只是母版参考，可以重新分配旋律时值；和弦必须完整继承母版和弦并保持顺序，但换和弦拍点可自由安排；所有音乐严格两小节共8拍，事件不得越界；四件乐器都提供可渲染数据。鼓组必须完整保留原提示词 grooveTemplate.drumCore.lockedEvents 中的全部核心事件，只能按心情调整力度、少量装饰和第二小节细节；不得移动或删除核心鼓点。贝斯只允许 C2、D2、E2、F2、G2、A2、B2、C3。lionAllowedBeats 仅兼容旧数据，可以为空。用户提出修改意见时，可以重写旋律节奏、和弦换拍、贝斯和萨克斯，但仍须遵守下列公共协作规则。

{ENSEMBLE_COORDINATION_RULES}

节奏网格继续使用原任务的律动规则：sway 只使用三连音式 n、n+0.333、n+0.667 网格；steady、bounce、forward 主要使用直拍 n、n+0.5 网格。不得在同一版本中混用直八分弱拍与摇摆弱拍。

当前 JSON：
{json.dumps(current_skeleton, ensure_ascii=False, indent=2)}

用户修改意见：
{feedback.strip()}
"""
    revision_prompt_path = revision_dir / "revision-prompt.txt"
    revision_prompt_path.write_text(revision_prompt, encoding="utf-8")
    output_path = record_dir / "generated.json"
    raw_path = revision_dir / "qwen.raw.json"
    task_path = task_path_for_kit(record["kitId"])
    repair_attempts = 0
    try:
        run_script(
            SCRIPTS_DIR / "generate_skeleton_json_mode.py",
            "--task", task_path,
            "--prompt-file", revision_prompt_path,
            "--output", output_path,
            "--raw-output", raw_path,
        )
        try:
            run_script(SCRIPTS_DIR / "validate_skeleton.py", "--task", task_path, "--skeleton", output_path)
        except ValueError as validation_error:
            repair_attempts, first_error = auto_repair_skeleton(
                task_path=task_path,
                output_path=output_path,
                context_prompt_path=revision_prompt_path,
                repair_root=revision_dir / "auto-repairs",
                initial_error=validation_error,
            )
            production_event(record, "修改版 JSON 自动修正后通过检查", f"第 {repair_attempts} 次修正通过；原错误：{first_error}")
    except ValueError:
        (revision_dir / "failed.json").write_text(output_path.read_text(encoding="utf-8"), encoding="utf-8") if output_path.is_file() else None
        (revision_dir / "previous.json").replace(output_path)
        raise

    skeleton = read_json(output_path)
    record["status"] = "json_ready"
    record.pop("previewUrl", None)
    record["revisionCount"] = int(record.get("revisionCount", 0)) + 1
    record["lastAutoRepairAttempts"] = repair_attempts
    record["autoRepairCount"] = int(record.get("autoRepairCount", 0)) + repair_attempts
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


def delete_record(record_id: str) -> dict:
    """删除一条制作记录及其专属试听、JSON、提示词和正式分轨文件。"""
    record_dir, record = read_record(record_id)
    deleted_job_id = None
    job_id = record.get("jobId")
    if isinstance(job_id, str) and job_id:
        job_dir = (JOBS_DIR / safe_id(job_id)).resolve()
        if job_dir.parent == JOBS_DIR.resolve() and job_dir.is_dir():
            shutil.rmtree(job_dir)
            deleted_job_id = job_dir.name

    shutil.rmtree(record_dir)
    return {
        "recordId": record.get("recordId", record_id),
        "deletedJobId": deleted_job_id,
        "message": "制作记录及其关联文件已删除。",
    }


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


def wav_metadata(path: Path) -> dict:
    if not path.is_file():
        raise ValueError(f"缺少正式分轨：{path.name}")
    try:
        with wave.open(str(path), "rb") as wav_file:
            if wav_file.getcomptype() != "NONE":
                raise ValueError(f"分轨必须是未压缩 WAV：{path.name}")
            return {
                "channels": wav_file.getnchannels(),
                "sampleWidth": wav_file.getsampwidth(),
                "sampleRate": wav_file.getframerate(),
                "frames": wav_file.getnframes(),
            }
    except wave.Error as error:
        raise ValueError(f"无法读取 WAV 分轨 {path.name}：{error}") from error


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file_handle:
        for block in iter(lambda: file_handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def split_pack_id(kit_id: str) -> str:
    match = re.fullmatch(r"(.+)_v\d+", kit_id)
    return safe_id(match.group(1) if match else kit_id)


def next_frontend_version(pack_dir: Path) -> str:
    versions = []
    if pack_dir.is_dir():
        for child in pack_dir.iterdir():
            match = re.fullmatch(r"v(\d+)", child.name) if child.is_dir() else None
            if match:
                versions.append(int(match.group(1)))
    return f"v{max(versions, default=0) + 1:02d}"


def update_frontend_catalog(pack_id: str, version: str, skeleton: dict, manifest_relative: str) -> None:
    catalog_path = FRONTEND_MUSIC_DIR / "catalog.json"
    if catalog_path.is_file():
        try:
            catalog = read_json(catalog_path)
        except (OSError, ValueError, json.JSONDecodeError):
            catalog = {}
    else:
        catalog = {}
    if not isinstance(catalog, dict):
        catalog = {}
    packs = catalog.setdefault("packs", {})
    if not isinstance(packs, dict):
        packs = {}
        catalog["packs"] = packs
    previous = packs.get(pack_id, {}) if isinstance(packs.get(pack_id), dict) else {}
    versions = previous.get("versions", []) if isinstance(previous.get("versions"), list) else []
    if version not in versions:
        versions.append(version)
    versions.sort(key=lambda value: int(value[1:]) if re.fullmatch(r"v\d+", value) else -1)
    packs[pack_id] = {
        "packId": pack_id,
        "feeling": skeleton.get("feeling"),
        "groove": skeleton.get("groove"),
        "latestVersion": version,
        "manifest": manifest_relative,
        "versions": versions,
    }
    catalog["schemaVersion"] = 1
    catalog["updatedAt"] = datetime.now().isoformat(timespec="seconds")
    temp_path = FRONTEND_MUSIC_DIR / f".catalog-{uuid.uuid4().hex}.tmp"
    temp_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    temp_path.replace(catalog_path)


def mark_job_published(job_id: str, publication: dict) -> None:
    for record_path in RECORDS_DIR.glob("*/record.json"):
        try:
            record = read_json(record_path)
        except (OSError, ValueError, json.JSONDecodeError):
            continue
        if not isinstance(record, dict) or record.get("jobId") != job_id:
            continue
        record["status"] = "published"
        record["publication"] = publication
        production_event(record, "正式分轨已保存到前端", publication["manifest"])
        save_record(record_path.parent, record)


def publish_frontend_pack(job_id: str, gains: dict) -> dict:
    safe_job_id = safe_id(job_id)
    job_dir = (JOBS_DIR / safe_job_id).resolve()
    if job_dir.parent != JOBS_DIR.resolve() or not job_dir.is_dir():
        raise ValueError("找不到这次分轨任务，请重新打开历史分轨。")
    skeleton_path = job_dir / "skeleton.json"
    if not skeleton_path.is_file():
        raise ValueError("找不到这次分轨对应的音乐 JSON。")
    skeleton = read_json(skeleton_path)
    if not isinstance(skeleton, dict):
        raise ValueError("音乐 JSON 内容不完整。")
    kit_id = safe_id(skeleton.get("kitId"))
    task_path = task_path_for_kit(kit_id)
    run_script(SCRIPTS_DIR / "validate_skeleton.py", "--task", task_path, "--skeleton", skeleton_path)

    gain_values = {
        animal: max(0.0, min(1.5, float(gains.get(animal, 1.0))))
        for animal in ANIMALS
    }
    muted = [animal for animal, value in gain_values.items() if value <= 0]
    if muted:
        raise ValueError(f"正式资源不能包含音量为 0 的分轨：{'、'.join(muted)}。请调高后再保存。")

    source_paths = {animal: active_stem_path(job_dir, kit_id, animal) for animal in ANIMALS}
    source_formats = {animal: wav_metadata(path) for animal, path in source_paths.items()}
    expected_format = source_formats[ANIMALS[0]]
    for animal in ANIMALS[1:]:
        if source_formats[animal] != expected_format:
            raise ValueError(f"{animal} 分轨的长度或音频格式与其他分轨不一致，不能发布。")
    if expected_format["sampleWidth"] != 2:
        raise ValueError("正式分轨目前必须使用 16 位 PCM WAV。")

    pack_id = split_pack_id(kit_id)
    FRONTEND_MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    with PUBLISH_LOCK:
        pack_dir = FRONTEND_MUSIC_DIR / pack_id
        version = next_frontend_version(pack_dir)
        target_dir = pack_dir / version
        staging_dir = FRONTEND_MUSIC_DIR / f".publishing-{pack_id}-{uuid.uuid4().hex}"
        stems_dir = staging_dir / "stems"
        preview_dir = staging_dir / "preview"
        try:
            stems_dir.mkdir(parents=True, exist_ok=False)
            preview_dir.mkdir(parents=True, exist_ok=False)
            published_paths = {}
            for animal in ANIMALS:
                output_path = stems_dir / f"{animal}.wav"
                run_script(
                    SCRIPTS_DIR / "mix_wav_stems.py",
                    "--inputs", source_paths[animal],
                    "--output", output_path,
                    "--gains", str(gain_values[animal]),
                )
                published_paths[animal] = output_path

            published_formats = {animal: wav_metadata(path) for animal, path in published_paths.items()}
            published_expected = published_formats[ANIMALS[0]]
            for animal in ANIMALS[1:]:
                if published_formats[animal] != published_expected:
                    raise ValueError(f"发布后的 {animal} 分轨长度或格式不一致。")

            mix_path = preview_dir / "mix.wav"
            run_script(
                SCRIPTS_DIR / "mix_wav_stems.py",
                "--inputs", *(published_paths[animal] for animal in ANIMALS),
                "--output", mix_path,
                "--gains", *("1.0" for _ in ANIMALS),
            )
            if wav_metadata(mix_path) != published_expected:
                raise ValueError("试听混音与正式分轨的长度或格式不一致。")

            shutil.copy2(skeleton_path, staging_dir / "score.json")
            duration_seconds = published_expected["frames"] / published_expected["sampleRate"]
            published_at = datetime.now().isoformat(timespec="seconds")
            manifest = {
                "schemaVersion": 1,
                "packId": pack_id,
                "sourceKitId": kit_id,
                "version": version,
                "feeling": skeleton.get("feeling"),
                "groove": skeleton.get("groove"),
                "bpm": skeleton.get("bpm"),
                "timeSignature": skeleton.get("timeSignature"),
                "bars": skeleton.get("bars"),
                "durationSeconds": round(duration_seconds, 6),
                "loop": {"enabled": True, "startFrame": 0, "endFrame": published_expected["frames"]},
                "audio": {
                    "format": "wav",
                    "encoding": "pcm_s16le",
                    "sampleRate": published_expected["sampleRate"],
                    "channels": published_expected["channels"],
                    "bitDepth": published_expected["sampleWidth"] * 8,
                    "frames": published_expected["frames"],
                },
                "stems": {animal: f"stems/{animal}.wav" for animal in ANIMALS},
                "stemRoles": ANIMAL_ROLES,
                "stemGains": gain_values,
                "checksums": {animal: file_sha256(published_paths[animal]) for animal in ANIMALS},
                "mixPreview": "preview/mix.wav",
                "score": "score.json",
                "publishedAt": published_at,
            }
            (staging_dir / "manifest.json").write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            target_dir.parent.mkdir(parents=True, exist_ok=True)
            staging_dir.replace(target_dir)
            manifest_relative = f"{pack_id}/{version}/manifest.json"
            update_frontend_catalog(pack_id, version, skeleton, manifest_relative)
        except Exception:
            if staging_dir.is_dir():
                shutil.rmtree(staging_dir)
            raise

    publication = {
        "packId": pack_id,
        "version": version,
        "manifest": manifest_relative,
        "frontendPath": f"prototype/assets/music/{pack_id}/{version}",
        "publishedAt": manifest["publishedAt"],
    }
    (job_dir / "publication.json").write_text(json.dumps(publication, ensure_ascii=False, indent=2), encoding="utf-8")
    mark_job_published(safe_job_id, publication)
    return {
        **publication,
        "manifestUrl": f"/frontend-music/{manifest_relative}",
        "catalogUrl": "/frontend-music/catalog.json",
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
        if request_path == "/demo":
            self.send_response(302)
            self.send_header("Location", "/demo/")
            self.end_headers()
            return
        if request_path.startswith("/demo/"):
            relative = Path(request_path.removeprefix("/demo/"))
            candidate = (DEMO_DIR / (relative if str(relative) != "." else "index.html")).resolve()
            if candidate != DEMO_DIR.resolve() and DEMO_DIR.resolve() not in candidate.parents:
                self.send_error(403)
                return
            self.serve_file(candidate)
            return
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
        if request_path.startswith("/frontend-music/"):
            relative = Path(request_path.removeprefix("/frontend-music/"))
            candidate = (FRONTEND_MUSIC_DIR / relative).resolve()
            if FRONTEND_MUSIC_DIR.resolve() not in candidate.parents:
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
                self.send_json(200, lock_theme(payload.get("emotionId", ""), payload.get("theme"), payload.get("prompt")))
                return
            if self.path == "/api/records/generate":
                self.send_json(200, generate_record_json(payload.get("recordId", "")))
                return
            if self.path == "/api/records/save-json":
                self.send_json(200, save_record_json(payload.get("recordId", ""), payload.get("skeleton")))
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
            if self.path == "/api/records/delete":
                self.send_json(200, delete_record(payload.get("recordId", "")))
                return
            if self.path == "/api/mix":
                self.send_json(200, export_mix(payload.get("jobId", ""), payload.get("gains", {})))
                return
            if self.path == "/api/stem":
                self.send_json(200, export_stem(payload.get("jobId", ""), payload.get("animal", ""), payload.get("gain", 1.0)))
                return
            if self.path == "/api/publish":
                self.send_json(200, publish_frontend_pack(payload.get("jobId", ""), payload.get("gains", {})))
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
    load_local_env()
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.environ.get("MUSIC_STUDIO_PORT", "8765")))
    parser.add_argument("--host", default=os.environ.get("MUSIC_STUDIO_HOST", "127.0.0.1"))
    parser.add_argument("--open", action="store_true", help="启动后自动打开浏览器")
    args = parser.parse_args()

    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    RECORDS_DIR.mkdir(parents=True, exist_ok=True)
    FRONTEND_MUSIC_DIR.mkdir(parents=True, exist_ok=True)
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
