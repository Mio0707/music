const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const BEATS_PER_BAR = 4;
const RECORD_BARS = 2;
const MAX_VOICE_STICKERS = 6;
const MUSIC_ROOT = "assets/music";
const TEACHER_MUSIC_ROOT = "/children-music-studio/frontend-music";
const SOLFEGE_ROOT = "assets/solfege/voice-katy";
const SOLFEGE_SI_ROOT = "assets/solfege/voice-katy-child-clean-v2";
const SOLFEGE_NATURAL_LOW_ROOT = "assets/solfege/voice-katy-natural-low-f";
const SOLFEGE_NATURAL_LOW_FREQUENCIES = {
  "sol-60": 261.6256,
  "la-62": 293.6648,
  "si-64": 329.6276
};
const PHONK_BPM = 125;
const PHONK_BEATS_PER_BAR = 4;
const PHONK_DEFAULT_PATTERN = {
  kick: [1, 0, 1, 0, 1, 0, 1, 0],
  snare: [0, 0, 1, 0, 0, 0, 1, 0]
};
const PHONK_DEFAULT_SECTIONS = [
  { id: "intro", label: "开场", bars: 4, layers: { kick: false, clap: false, hihat: true, bass808: false, cowbell: true } },
  { id: "enter", label: "节奏进入", bars: 4, layers: { kick: true, clap: true, hihat: true, bass808: false, cowbell: true } },
  { id: "drop", label: "第一次爆发", bars: 8, layers: { kick: true, clap: true, hihat: true, bass808: true, cowbell: true } },
  { id: "break", label: "留白变化", bars: 4, layers: { kick: false, clap: false, hihat: false, bass808: false, cowbell: true } },
  { id: "final", label: "最后爆发", bars: 4, layers: { kick: true, clap: true, hihat: true, bass808: true, cowbell: true } }
];
const PHONK_TRACKS = [
  { id: "kick", label: "Kick", cn: "底鼓", sound: "咚", image: "assets/stickers/phonk-lion-pat-thighs.png", action: "拍腿或轻跺脚", description: "像“咚”的低鼓声，负责稳住节拍。" },
  { id: "clap", label: "Clap", cn: "拍手音", sound: "啪", image: "assets/stickers/phonk-lion-clap.png", action: "拍手或轻拍纸袋", description: "像“啪”的短声音，常让第 2、4 拍更醒目。" },
  { id: "hihat", label: "Hi-Hat", cn: "踩镲", sound: "呲", image: "assets/stickers/phonk-lion-shaker.png", action: "摇密封米粒瓶", description: "像“呲呲”的细碎声音，填满节拍之间的空隙。" }
];
const SOLFEGE_SOURCE_FREQUENCIES = {
  do: 261.6256,
  re: 293.6648,
  mi: 329.6276,
  fa: 349.2282,
  sol: 391.9954,
  la: 440,
  si: 493.8833
};
const SOLFEGE_MIN_VOICE_SECONDS = 0.8;
const SOLFEGE_RECOMMENDED_VOICE_SECONDS = "1.2–1.8";
const CHILDREN_MUSIC_STUDIO_URL = "children-music-studio/?demo=1";
const grooveAudio = {
  steady: { bpm: 88, duration: 5.454542 },
  bounce: { bpm: 96, duration: 5 },
  sway: { bpm: 84, duration: 5.714292 },
  forward: { bpm: 108, duration: 4.444438 }
};
const BODY_ACTION_GUIDE = "assets/stickers/body-rhythm/dog-table-actions.png?v=2";
const BODY_MOOD_ORDER = ["happy", "calm", "brave", "miss"];
const BODY_GROOVE_ORDER = ["steady", "bounce", "sway", "forward"];
const BODY_ACTIONS = {
  dong: { syllable: "动", label: "敲桌面" },
  ci: { syllable: "次", label: "敲桌沿" },
  da: { syllable: "打", label: "拍手" }
};
const BODY_GROOVE_PATTERNS = {
  steady: [
    { beat: 0, action: "dong" }, { beat: 1, action: "da" },
    { beat: 2, action: "dong" }, { beat: 3, action: "da" }
  ],
  bounce: [
    { beat: 0, action: "dong" }, { beat: .5, action: "ci" },
    { beat: 1, action: "dong" }, { beat: 1.5, action: "ci" },
    { beat: 2, action: "dong" }, { beat: 2.5, action: "ci" },
    { beat: 3, action: "dong" }, { beat: 3.5, action: "ci" }
  ],
  sway: [
    { beat: 0, action: "dong" }, { beat: .667, action: "ci" },
    { beat: 1, action: "da" }, { beat: 1.667, action: "ci" },
    { beat: 2, action: "dong" }, { beat: 2.667, action: "ci" },
    { beat: 3, action: "da" }, { beat: 3.667, action: "ci" }
  ],
  forward: [
    { beat: 0, action: "dong" }, { beat: .5, action: "ci" },
    { beat: 1, action: "da" }, { beat: 1.5, action: "dong" },
    { beat: 2, action: "dong" }, { beat: 2.5, action: "ci" },
    { beat: 3, action: "da" }, { beat: 3.5, action: "dong" }
  ]
};
const bodyPackId = (mood, groove) => `${mood === "miss" ? "longing" : mood}_${groove}`;
const BODY_LESSONS = BODY_GROOVE_ORDER.flatMap(groove => BODY_MOOD_ORDER.map(mood => ({
  id: bodyPackId(mood, groove), mood, groove, bpm: grooveAudio[groove].bpm,
  pattern: BODY_GROOVE_PATTERNS[groove]
})));
const bodyScoreCache = new Map();
const bodyScoreLoading = new Set();

function bodyScorePath(lesson) {
  return `${MUSIC_ROOT}/${lesson.id}/v01/score.json`;
}

function bodyPatternFromScore(score) {
  const priority = { kick: 3, snare: 2, hihat: 1 };
  const actionByInstrument = { kick: "dong", snare: "da", hihat: "ci" };
  const events = new Map();
  const teachingEvents = (score.drumGrid || []).filter(event => score.groove !== "steady" || event.instrument !== "hihat");
  teachingEvents.forEach(event => {
    const beat = Number(Number(event.beat).toFixed(3));
    const current = events.get(beat);
    if (!current || (priority[event.instrument] || 0) > (priority[current.instrument] || 0)) events.set(beat, event);
  });
  return [...events.entries()].sort((a, b) => a[0] - b[0]).map(([beat, event]) => ({ beat, action: actionByInstrument[event.instrument] || "ci" }));
}

function bodyLessonPattern(lesson) {
  return bodyScoreCache.get(lesson.id)?.bodyPattern || lesson.pattern;
}

function bodyDisplayPattern(lesson) {
  return bodyLessonPattern(lesson).filter(step => step.beat < BEATS_PER_BAR);
}

function bodyLessonBpm(lesson) {
  return bodyScoreCache.get(lesson.id)?.bpm || lesson.bpm;
}

function loadBodyScore(lesson) {
  if (typeof fetch !== "function" || bodyScoreCache.has(lesson.id) || bodyScoreLoading.has(lesson.id)) return;
  bodyScoreLoading.add(lesson.id);
  fetch(bodyScorePath(lesson)).then(response => response.ok ? response.json() : null).then(score => {
    if (!score) return;
    bodyScoreCache.set(lesson.id, { ...score, bodyPattern: bodyPatternFromScore(score) });
    if (["feel-body", "collab-body"].includes(state.screen)) render();
  }).catch(() => {}).finally(() => bodyScoreLoading.delete(lesson.id));
}
const arrangementAnimals = ["dog", "bear", "cat", "lion"];
const stemAnimals = arrangementAnimals;
const CARMEN_AUDIO = "assets/music/carmen/source.mp3";
const CARMEN_GESTURE_PLAN = "assets/music/carmen/gesture-plan.json";
const CARMEN_TITLE = "《卡门》序曲";
const CARMEN_EXCERPT_SECONDS = 130.44;
const POEM_VOICE_AUDIO = "assets/music/poetry/jingyesi/rabbit-vocal.wav";
const FIXED_DEMO_MANIFEST = "assets/demo/fixed-demo.json";
const FIXED_DEMO_SCORE = "assets/demo/dongfanghong.json";
let fixedDemoManifest = null;
const DEFAULT_SOLFEGE_LESSON = {
  title: "《小星星》",
  tonic: "C",
  meter: { beats: 4, unit: 4 },
  bpm: 84,
  confidence: 1,
  measures: [
    { number: 1, notes: [
      { degree: 1, octave: 0, beat: 0, duration: 1, startBeat: 0, solfege: "do", frequency: 261.626, confidence: 1 },
      { degree: 1, octave: 0, beat: 1, duration: 1, startBeat: 1, solfege: "do", frequency: 261.626, confidence: 1 },
      { degree: 5, octave: 0, beat: 2, duration: 1, startBeat: 2, solfege: "sol", frequency: 391.995, confidence: 1 },
      { degree: 5, octave: 0, beat: 3, duration: 1, startBeat: 3, solfege: "sol", frequency: 391.995, confidence: 1 }
    ] },
    { number: 2, notes: [
      { degree: 6, octave: 0, beat: 0, duration: 1, startBeat: 4, solfege: "la", frequency: 440, confidence: 1 },
      { degree: 6, octave: 0, beat: 1, duration: 1, startBeat: 5, solfege: "la", frequency: 440, confidence: 1 },
      { degree: 5, octave: 0, beat: 2, duration: 2, startBeat: 6, solfege: "sol", frequency: 391.995, confidence: 1 }
    ] }
  ],
  notes: [],
  totalBeats: 8,
  warnings: [],
  source: "built-in"
};
DEFAULT_SOLFEGE_LESSON.notes = DEFAULT_SOLFEGE_LESSON.measures.flatMap(measure => measure.notes);
function lessonMeasure(number, phraseIds, specs, options = {}) {
  let beat = 0;
  const notes = specs.map((spec, index) => {
    const [degree, octave, duration, lyric = ""] = spec;
    const phraseId = Array.isArray(phraseIds) ? phraseIds[index] : phraseIds;
    const note = { degree, octave, beat, duration, lyric, phraseId, confidence: 1 };
    beat += duration;
    return note;
  });
  return { number, pickup: Boolean(options.pickup), beats: options.beats || beat, meter: options.meter || "4/4", notes };
}

const JINGYESI_SCORE = {
  title: "《静夜思》",
  author: "李白",
  tonic: "C",
  mode: "major-pentatonic",
  meter: { beats: 4, unit: 4 },
  bpm: 88,
  measures: [
    lessonMeasure(1, "line1", [[5, 0, .5, "床"], [2, 0, .75, "前"], [3, 0, .5, "明"], [5, 0, .75, "月"], [6, 0, 1, "光"]], { beats: 4 }),
    lessonMeasure(2, "line2", [[6, 0, .5, "疑"], [5, 0, .75, "是"], [3, 0, .5, "地"], [2, 0, .75, "上"], [3, 0, 1, "霜"]], { beats: 4 }),
    lessonMeasure(3, "line3", [[3, 0, .5, "举"], [5, 0, .75, "头"], [6, 0, .5, "望"], [5, 0, .75, "明"], [6, 0, 1, "月"]], { beats: 4 }),
    lessonMeasure(4, "line4", [[6, 0, .5, "低"], [5, 0, .75, "头"], [3, 0, .5, "思"], [2, 0, .75, "故"], [1, 0, 1, "乡"]], { beats: 4 })
  ],
  phrases: [
    { id: "line1", label: "第 1 句", lyrics: "床前／明月光" },
    { id: "line2", label: "第 2 句", lyrics: "疑是／地上霜" },
    { id: "line3", label: "第 3 句", lyrics: "举头／望明月" },
    { id: "line4", label: "第 4 句", lyrics: "低头／思故乡" }
  ],
  notes: [],
  totalBeats: 16,
  source: "human-curated-poem"
};
refreshScoreDerivedData(JINGYESI_SCORE);
const JINGYESI_GESTURE_IDS = ["hold", "rise", "valley", "fall", "arch", "fall", "hold", "rest_line"];

function loadSavedCollaborationGestures() {
  try {
    const saved = JSON.parse(localStorage.getItem("animal-music-collaboration-gestures") || "null");
    const valid = Array.isArray(saved)
      && saved.length === JINGYESI_GESTURE_IDS.length
      && saved.every(id => gestureById(id));
    return valid ? saved : [...JINGYESI_GESTURE_IDS];
  } catch {
    return [...JINGYESI_GESTURE_IDS];
  }
}

const DONGFANGHONG_SCORE = {
  title: "《东方红》",
  tonic: "F",
  mode: "major",
  meter: { beats: 2, unit: 4 },
  bpm: 64,
  confidence: 1,
  measures: [
    lessonMeasure(1, "page1", [[5, 0, 1, "东"], [5, 0, .5, "方"], [6, 0, .5]], { beats: 2, meter: "2/4" }),
    lessonMeasure(2, "page1", [[2, 0, 2, "红"]], { beats: 2, meter: "2/4" }),
    lessonMeasure(3, "page1", [[1, 0, 1, "太"], [1, 0, .5, "阳"], [6, -1, .5]], { beats: 2, meter: "2/4" }),
    lessonMeasure(4, "page1", [[2, 0, 2, "升"]], { beats: 2, meter: "2/4" }),
    lessonMeasure(5, "page2", [[5, 0, 1, "中"], [5, 0, 1, "国"]], { beats: 2, meter: "2/4" }),
    lessonMeasure(6, "page2", [[6, 0, .5, "出"], [1, 1, .5], [6, 0, .5, "了"], [5, 0, .5, "个"]], { beats: 2, meter: "2/4" }),
    lessonMeasure(7, "page2", [[1, 0, 1, "毛"], [1, 0, .5, "泽"], [6, -1, .5]], { beats: 2, meter: "2/4" }),
    lessonMeasure(8, "page2", [[2, 0, 2, "东"]], { beats: 2, meter: "2/4" }),
    lessonMeasure(9, "page3", [[5, 0, 1, "他"], [2, 0, 1, "为"]], { beats: 2, meter: "2/4" }),
    lessonMeasure(10, "page3", [[1, 0, 1, "人"], [7, -1, .5, "民"], [6, -1, .5]], { beats: 2, meter: "2/4" }),
    lessonMeasure(11, "page3", [[5, -1, 1, "谋"], [5, 0, 1, "幸"]], { beats: 2, meter: "2/4" }),
    lessonMeasure(12, "page3", [[2, 0, 1, "福"], [3, 0, .5, "呼"], [2, 0, .5, "儿"]], { beats: 2, meter: "2/4" }),
    lessonMeasure(13, "page4", [[1, 0, 1, "嗨"], [1, 0, .5, "哟"], [6, -1, .5]], { beats: 2, meter: "2/4" }),
    lessonMeasure(14, "page4", [[2, 0, .5, "他"], [3, 0, .5, "是"], [2, 0, .5, "人"], [1, 0, .5, "民"]], { beats: 2, meter: "2/4" }),
    lessonMeasure(15, "page4", [[2, 0, .5, "大"], [1, 0, .5], [7, -1, .5, "救"], [6, -1, .5]], { beats: 2, meter: "2/4" }),
    lessonMeasure(16, "page4", [[5, -1, 2, "星"]], { beats: 2, meter: "2/4" })
  ],
  phrases: [
    { id: "page1", label: "第 1 页", lyrics: "东方红，太阳升" },
    { id: "page2", label: "第 2 页", lyrics: "中国出了个毛泽东" },
    { id: "page3", label: "第 3 页", lyrics: "他为人民谋幸福，呼儿" },
    { id: "page4", label: "第 4 页", lyrics: "嗨哟，他是人民大救星" }
  ],
  notes: [],
  totalBeats: 34,
  warnings: ["课堂按原谱四行旋律拆成 4 页，每页显示 4 个小节。"],
  source: "human-curated"
};
refreshScoreDerivedData(DONGFANGHONG_SCORE);
const gestureLibrary = [
  { id: "rest_line", image: "assets/gestures/library/gesture-rest-line.svg", name: "休止横线", label: "双手画一条水平线，然后停住", scope: "universal", kind: "rest" },
  { id: "arch", image: "assets/gestures/library/gesture-arch.png", name: "大拱形", label: "手臂举高，再轻轻落下", scope: "universal" },
  { id: "valley", image: "assets/gestures/library/gesture-valley.png", name: "大山谷", label: "手臂落下，再慢慢举高", scope: "universal" },
  { id: "accent_hold", image: "assets/gestures/library/gesture-accent-hold.png", name: "转折后保持", label: "抬高、落下，然后向前伸展", scope: "universal" },
  { id: "circle", image: "assets/gestures/library/gesture-circle.png", name: "大圆圈", label: "用整条手臂画一个大圆圈", scope: "universal" },
  { id: "wave", image: "assets/gestures/library/gesture-wave.png", name: "大波浪", label: "手臂连续画两个大波浪", scope: "universal" },
  { id: "infinity", image: "assets/gestures/library/gesture-infinity.png", name: "无穷形", label: "从左侧开口出发，穿过中间画完两边", scope: "universal" },
  { id: "hold", image: "assets/gestures/library/gesture-hold.png", name: "平稳延伸", label: "手臂平稳向旁边移动", scope: "universal", difficulty: "support" },
  { id: "rise", image: "assets/gestures/library/gesture-rise.png", name: "慢慢升高", label: "手臂从低处慢慢举高", scope: "universal", difficulty: "support" },
  { id: "fall", image: "assets/gestures/library/gesture-fall.png", name: "慢慢落下", label: "手臂从高处慢慢放低", scope: "universal", difficulty: "support" },
  { id: "climb_arcs_three", image: "assets/gestures/library/gesture-climb-arcs-three.svg?v=3", name: "三拍上行拱线", label: "一拍一个，连续画三个向上走的小拱线", scope: "3/4" },
  { id: "descend_arcs_three", image: "assets/gestures/library/gesture-descend-arcs-three.svg?v=3", name: "三拍下行拱线", label: "一拍一个，连续画三个向下走的小拱线", scope: "3/4" },
  { id: "waltz_sway", image: "assets/gestures/library/gesture-waltz-sway.png", name: "三拍摇摆", label: "第一拍落下，第二拍展开，第三拍轻轻回来", scope: "3/4" },
  { id: "three_beat_sweep", image: "assets/gestures/library/gesture-three-beat-sweep.png", name: "三拍大回旋", label: "向下、向外，再向上收回", scope: "3/4" },
  { id: "three_petal", image: "assets/gestures/library/gesture-three-petal.png", name: "三叶花", label: "从下方开口出发，连续画出三片大花瓣", scope: "3/4" },
  { id: "spiral", image: "assets/gestures/library/gesture-spiral.png", name: "大螺旋", label: "从大圆慢慢收到中心", scope: "3/4" },
  { id: "three_peaks", image: "assets/gestures/library/gesture-three-peaks.png", name: "三峰皇冠", label: "每一拍向上伸展一次，共做三次", scope: "3/4" },
  { id: "triangle", image: "assets/gestures/library/gesture-triangle.png", name: "三角形", label: "跟着三拍向上、转弯，再回到起点", scope: "3/4" },
  { id: "climb_arcs", image: "assets/gestures/library/gesture-climb-arcs.png", name: "四拍上行拱线", label: "一拍一个，连续画四个向上走的小拱线", scope: "4/4" },
  { id: "descend_arcs", image: "assets/gestures/library/gesture-descend-arcs.png", name: "四拍下行拱线", label: "一拍一个，连续画四个向下走的小拱线", scope: "4/4" },
  { id: "bounces", image: "assets/gestures/library/gesture-bounces.png", name: "四个弹跳", label: "跟着四拍画四个大拱线", scope: "4/4" },
  { id: "square", image: "assets/gestures/library/gesture-square.png", name: "正方形", label: "跟着四拍画一个大方框", scope: "4/4" },
  { id: "pulses", image: "assets/gestures/library/gesture-pulses.png", name: "四个短点", label: "跟着四拍轻轻点四下", scope: "4/4", difficulty: "support" }
];
const defaultCarmenAnalysis = [
  { bars: [1, 2], mode: "merged", gestureIds: ["climb_arcs_three"], reason: "固定演示正在载入卡门手势方案。", start: 2.089, end: 4.944, beatTimes: [2.089, 3.041, 3.992], gestureTimings: [{ start: 2.089, end: 4.944, beatTimes: [2.089, 3.041, 3.992] }], curated: true }
];

function gestureById(id) {
  return gestureLibrary.find(gesture => gesture.id === id) || gestureLibrary[0];
}

const GESTURE_MOTION_PATHS = {
  rest_line: { d: "M116 180 H524", landmarks: [0, .25, .5, .75, 1] },
  hold: { d: "M52 180 H588", landmarks: [0, .25, .5, .75, 1] },
  rise: { d: "M134 323 L503 37", landmarks: [0, .25, .5, .75, 1] },
  fall: { d: "M134 37 L503 323", landmarks: [0, .25, .5, .75, 1] },
  arch: { d: "M94 298 C190 54 450 54 545 298", points: [[94,298],[320,65],[545,298]] },
  valley: { d: "M86 82 C205 302 430 302 554 82", points: [[86,82],[320,246],[554,82]] },
  climb_arcs: { d: "M54 286 C82 212 118 190 150 248 C184 164 222 140 258 210 C296 118 340 96 382 174 C426 76 490 54 558 144", points: [[54,286],[102,207],[150,248],[210,158],[258,210],[331,111],[382,174],[468,71],[558,144]] },
  descend_arcs: { d: "M58 132 C102 54 164 78 202 170 C240 96 284 118 318 206 C354 142 396 160 428 240 C466 184 510 204 558 286", points: [[58,132],[126,75],[202,170],[264,116],[318,206],[377,155],[428,240],[489,198],[558,286]] },
  climb_arcs_three: { d: "M55 276 C91 196 132 171 171 235 C211 142 258 115 300 205 C348 98 418 65 486 181", points: [[55,276],[113,195],[171,235],[238,139],[300,205],[397,91],[486,181]] },
  descend_arcs_three: { d: "M55 126 C99 82 151 91 198 162 C244 101 299 111 350 218 C402 157 474 173 553 279", points: [[55,126],[126,100],[198,162],[272,117],[350,218],[438,166],[553,279]] },
  accent_hold: { d: "M55 251 L105 146 L144 205 L200 205 L246 175 H585", points: [[55,251],[105,146],[144,205],[200,205],[246,175],[585,175]] },
  bounces: { d: "M55 262 C82 174 126 174 154 262 C184 174 228 174 258 262 C290 174 334 174 364 262 C398 174 446 174 482 262 C512 220 538 220 558 262", points: [[55,262],[104,196],[154,262],[208,196],[258,262],[312,196],[364,262],[437,196],[482,262],[532,230],[558,262]] },
  circle: { d: "M320 28 C403 28 470 96 470 180 C470 264 403 332 320 332 C237 332 170 264 170 180 C170 96 237 28 320 28 Z", landmarks: [0, .25, .5, .75, 1] },
  triangle: { d: "M171 302 L320 42 L470 302 Z", landmarks: [0, .333, .667, 1] },
  square: { d: "M120 74 L520 74 L520 286 L120 286 Z", landmarks: [0, .25, .5, .75, 1] },
  wave: { d: "M62 184 C126 72 194 72 258 184 C322 296 390 296 454 184 C500 104 532 116 572 184", points: [[62,184],[160,100],[258,184],[356,268],[454,184],[520,124],[572,184]] },
  waltz_sway: { d: "M48 187 C100 202 106 278 164 278 C248 278 253 85 399 86 C523 87 481 244 591 250", points: [[48,187],[164,278],[399,86],[591,250]] },
  three_beat_sweep: { d: "M50 75 C98 127 111 284 210 291 C304 297 428 120 522 123 C577 124 599 155 577 197", points: [[50,75],[210,291],[522,123],[577,197]] },
  three_petal: { d: "M292 282 C245 324 170 286 153 238 C135 187 175 141 235 154 C260 160 270 146 258 126 C225 63 270 26 320 28 C371 27 415 65 382 127 C370 148 381 162 405 155 C466 140 506 187 489 238 C472 291 394 320 347 283", points: [[292,282],[153,238],[235,154],[320,28],[405,155],[489,238],[347,283]] },
  infinity: { d: "M89 164 C107 80 208 53 320 180 C432 53 533 80 551 164 C573 270 446 324 320 180 C208 324 106 278 89 207", landmarks: [0, .167, .333, .5, .667, .833, 1] },
  spiral: { d: "M208 314 C116 228 155 79 278 47 C412 12 521 105 469 229 C430 320 300 331 256 250 C220 184 271 122 335 130 C391 138 409 192 378 225 C357 247 328 224 329 204", landmarks: [0, .167, .333, .5, .667, .833, 1] },
  three_peaks: { d: "M72 276 L158 102 L238 276 L320 82 L402 276 L486 112 L566 276", points: [[72,276],[158,102],[238,276],[320,82],[402,276],[486,112],[566,276]] },
  pulses: { d: "M70 210 C96 160 128 160 154 210 C180 160 212 160 238 210 C264 160 296 160 322 210 C348 160 380 160 406 210 C438 160 480 160 514 210", points: [[70,210],[112,173],[154,210],[196,173],[238,210],[280,173],[322,210],[364,173],[406,210],[460,173],[514,210]] }
};

function gestureMotionMarkup(gestureId, className = "swan-main-gesture") {
  const motion = GESTURE_MOTION_PATHS[gestureId] || GESTURE_MOTION_PATHS.hold;
  const gesture = gestureById(gestureId);
  return `<div class="gesture-motion-frame">
    <img class="${className}" src="${gesture.image}" alt="${escapeHtml(gesture.label)}">
    <svg class="gesture-motion-overlay gesture-motion ${gesture.kind === "rest" ? "rest-motion" : ""}" data-gesture-motion="${gestureId}" viewBox="0 0 640 360" aria-hidden="true">
      <path class="gesture-motion-line" data-gesture-motion-path d="${motion.d}"></path>
      <circle class="gesture-motion-halo" data-gesture-motion-dot r="19" cx="0" cy="0"></circle>
      <circle class="gesture-motion-dot" data-gesture-motion-dot r="9" cx="0" cy="0"></circle>
    </svg>
  </div>`;
}

function gestureScopeLabel(scope) {
  return scope === "3/4" ? "3/4 专用" : scope === "4/4" ? "4/4 专用" : "所有拍号通用";
}

const dogStateAssets = {
  ready: "assets/stickers/states/performer-dog-ready.png",
  clap: "assets/stickers/states/performer-dog-clap.png",
  patThighs: "assets/stickers/states/performer-dog-pat-thighs.png",
  stop: "assets/stickers/states/performer-dog-stop.png",
  highFive: "assets/stickers/states/performer-dog-high-five.png"
};

const animals = {
  dog: { emoji: "🐶", name: "小狗", role: "鼓" },
  rabbit: { emoji: "🐰", name: "小兔", role: "唱名" },
  bear: { emoji: "🐻", name: "小熊", role: "键盘" },
  cat: { emoji: "🐱", name: "小猫", role: "贝斯" },
  lion: { emoji: "🦁", name: "小狮子", role: "萨克斯" }
};

const grooves = {
  steady: { name: "稳稳走", emoji: "👣", hint: "一步一步，稳稳地走", bpmOffset: 0 },
  bounce: { name: "蹦蹦跳", emoji: "🟠", hint: "轻轻弹起来", bpmOffset: 12 },
  sway: { name: "摇一摇", emoji: "🌿", hint: "像风一样左右摇", bpmOffset: -8 },
  forward: { name: "向前冲", emoji: "🚲", hint: "带着力量向前走", bpmOffset: 8 }
};

const moods = {
  happy: { name: "开心", emoji: "☀️", hint: "像阳光跳进窗户", postcardLine: "我的音乐像阳光跳进窗户。", className: "mood-happy", bpm: 96, notes: [261.6, 329.6, 392, 523.3] },
  calm: { name: "放松", emoji: "🌙", hint: "留一点呼吸和空白", postcardLine: "我的音乐想慢慢走一会儿。", className: "mood-calm", bpm: 76, notes: [220, 261.6, 329.6, 392] },
  brave: { name: "勇敢", emoji: "🔥", hint: "让每一下都站得稳", postcardLine: "我的音乐准备好向前走啦！", className: "mood-brave", bpm: 88, notes: [196, 246.9, 293.7, 392] },
  miss: { name: "想念", emoji: "⭐", hint: "把远方放进旋律里", postcardLine: "我的音乐想飞去远方看一看。", className: "mood-miss", bpm: 72, notes: [220, 293.7, 329.6, 440] }
};

const POEM_LIBRARY = {
  happy: [
    { id: "cunju", title: "《村居》", author: "清 · 高鼎", lines: ["草长莺飞二月天", "拂堤杨柳醉春烟", "儿童散学归来早", "忙趁东风放纸鸢"] },
    { id: "yonge", title: "《咏鹅》", author: "唐 · 骆宾王", lines: ["鹅鹅鹅", "曲项向天歌", "白毛浮绿水", "红掌拨清波"] },
    { id: "chunxiao", title: "《春晓》", author: "唐 · 孟浩然", lines: ["春眠不觉晓", "处处闻啼鸟", "夜来风雨声", "花落知多少"] }
  ],
  calm: [
    { id: "luzhai", title: "《鹿柴》", author: "唐 · 王维", lines: ["空山不见人", "但闻人语响", "返景入深林", "复照青苔上"] },
    { id: "niaomingjian", title: "《鸟鸣涧》", author: "唐 · 王维", lines: ["人闲桂花落", "夜静春山空", "月出惊山鸟", "时鸣春涧中"] },
    { id: "jiangxue", title: "《江雪》", author: "唐 · 柳宗元", lines: ["千山鸟飞绝", "万径人踪灭", "孤舟蓑笠翁", "独钓寒江雪"] }
  ],
  brave: [
    { id: "dengguanquelou", title: "《登鹳雀楼》", author: "唐 · 王之涣", lines: ["白日依山尽", "黄河入海流", "欲穷千里目", "更上一层楼"] },
    { id: "zhushi", title: "《竹石》", author: "清 · 郑燮", lines: ["咬定青山不放松", "立根原在破岩中", "千磨万击还坚劲", "任尔东西南北风"] },
    { id: "xiari-jueju", title: "《夏日绝句》", author: "宋 · 李清照", lines: ["生当作人杰", "死亦为鬼雄", "至今思项羽", "不肯过江东"] }
  ],
  miss: [
    { id: "jingyesi", title: "《静夜思》", author: "唐 · 李白", lines: ["床前明月光", "疑是地上霜", "举头望明月", "低头思故乡"], audioUrl: POEM_VOICE_AUDIO, lineAudioUrls: ["assets/music/poetry/jingyesi/lines/line-1.wav", "assets/music/poetry/jingyesi/lines/line-2.wav", "assets/music/poetry/jingyesi/lines/line-3.wav", "assets/music/poetry/jingyesi/lines/line-4.wav"] },
    { id: "jiuyuejiuri", title: "《九月九日忆山东兄弟》", author: "唐 · 王维", lines: ["独在异乡为异客", "每逢佳节倍思亲", "遥知兄弟登高处", "遍插茱萸少一人"] },
    { id: "bochuanguazhou", title: "《泊船瓜洲》", author: "宋 · 王安石", lines: ["京口瓜洲一水间", "钟山只隔数重山", "春风又绿江南岸", "明月何时照我还"] }
  ]
};

function poemsForCurrentMood() {
  return POEM_LIBRARY[state.mood || "miss"] || POEM_LIBRARY.miss;
}

function selectedPoem() {
  const poems = poemsForCurrentMood();
  return poems.find(poem => poem.id === state.selectedPoemId) || poems.find(poem => poem.audioUrl) || poems[0];
}

function poemVoiceAudioUrl() {
  return selectedPoem()?.audioUrl || null;
}

function poemLineAudioUrl(lineIndex) {
  return selectedPoem()?.lineAudioUrls?.[lineIndex] || null;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function loadSavedPostcard() {
  try {
    const saved = JSON.parse(localStorage.getItem("animal-music-postcard") || "null");
    return saved && typeof saved === "object" ? saved : null;
  } catch {
    return null;
  }
}

function loadSavedScoreSession() {
  try {
    const saved = JSON.parse(localStorage.getItem("animal-music-score-session") || "null");
    return saved && saved.draft && Array.isArray(saved.draft.measures) ? saved : null;
  } catch {
    return null;
  }
}

const savedPostcard = loadSavedPostcard();
const savedScoreSession = loadSavedScoreSession();
const savedHasVoice = typeof savedPostcard?.voiceDataUrl === "string" && savedPostcard.voiceDataUrl.startsWith("data:audio/");
const savedVoiceStickers = Array.isArray(savedPostcard?.voiceStickers)
  ? savedPostcard.voiceStickers.filter(item => item && typeof item.audioUrl === "string" && item.audioUrl.startsWith("data:audio/")).slice(0, MAX_VOICE_STICKERS)
  : savedHasVoice
    ? [{ id: "voice-1", name: "我的声音 1", audioUrl: savedPostcard.voiceDataUrl, blob: null, bpm: Number(savedPostcard?.voiceBpm) || null }]
    : [];
const savedVoiceKeys = new Set(savedVoiceStickers.map(item => `voice:${item.id}`));
const savedSections = Array.isArray(savedPostcard?.sections) && savedPostcard.sections.length === 4
  ? savedPostcard.sections.map(section => Array.isArray(section)
    ? section.map(sticker => sticker === "voice" && savedVoiceStickers[0] ? `voice:${savedVoiceStickers[0].id}` : sticker)
      .filter(sticker => arrangementAnimals.includes(sticker) || savedVoiceKeys.has(sticker))
    : ["dog"])
  : [["dog"], ["dog"], ["dog"], ["dog"]];

const state = {
  screen: "home",
  phonkStep: 0,
  phonkPracticePart: 0,
  phonkPattern: structuredClone(PHONK_DEFAULT_PATTERN),
  phonkSections: structuredClone(PHONK_DEFAULT_SECTIONS),
  phonkSelectedSection: 0,
  phonkRecordIndex: 0,
  phonkRecordStatus: "idle",
  phonkCountdown: 4,
  phonkRecordings: { kick: null, clap: null, hihat: null },
  phonkPerformanceMode: "practice",
  phonkActiveSection: 0,
  phonkPlaying: false,
  phonkEnsembleStatus: "idle",
  phonkEnsembleCountdown: 4,
  phonkCompleted: false,
  mood: Object.hasOwn(moods, savedPostcard?.mood) ? savedPostcard.mood : null,
  groove: Object.hasOwn(grooves, savedPostcard?.groove) ? savedPostcard.groove : null,
  feelMode: "melody",
  solfegeMode: "listen",
  solfegePhraseIndex: 0,
  solfegeActiveNoteIndex: null,
  solfegePlayingFull: false,
  solfegeRecordingOpen: false,
  solfegeRecordTargetIndex: 0,
  solfegeRecordStatus: "idle",
  solfegeRecordings: {},
  solfegeRecordingsReady: false,
  lessonMeasure: 0,
  classPlaying: false,
  swanSection: 0,
  swanProgress: 0,
  swanPausedAt: null,
  teacherStep: "input",
  teacherMode: "hub",
  scoreStep: savedScoreSession?.draft ? (savedScoreSession.scorePublished ? "published" : "review") : "input",
  scoreFileName: savedScoreSession?.fileName || "",
  scoreImageUrl: savedScoreSession?.imageUrl || "",
  scoreImageDataUrl: savedScoreSession?.imageDataUrl || "",
  scoreDraft: savedScoreSession?.draft || null,
  scoreError: "",
  scoreReviewMeasureIndex: Number(savedScoreSession?.reviewMeasureIndex) || 0,
  scoreConfirmedMeasures: savedScoreSession?.confirmedMeasures || {},
  publishedSolfegeLesson: savedScoreSession?.publishedLesson || structuredClone(DONGFANGHONG_SCORE),
  scorePublished: Boolean(savedScoreSession?.scorePublished),
  teacherAnalysisProgress: { percent: 0, label: "准备读取音频", detail: "" },
  teacherFileName: "",
  teacherAnalysisMeta: { meter: "3/4", bpm: 123, measureCount: 92, method: "固定演示课程", confidence: 1, secondsPerMeasure: 2.85, barsPerGesture: 2, gesturePacing: "快速 · 2 小节完成 1 个手势" },
  teacherAnalysis: defaultCarmenAnalysis.map(group => ({ ...group, gestureIds: [...group.gestureIds] })),
  publishedTeacherAnalysis: defaultCarmenAnalysis.map(group => ({ ...group, gestureIds: [...group.gestureIds] })),
  publishedLessonTitle: CARMEN_TITLE,
  publishedLessonAudioUrl: CARMEN_AUDIO,
  publishedLessonMeter: "3/4",
  publishedLessonStart: 2.089,
  publishedLessonEnd: 130.44,
  teacherEditing: null,
  teacherPublished: false,
  musicSource: savedPostcard?.musicSource === "teacher" ? "teacher" : "system",
  teacherMusicPacks: [],
  teacherMusicLoading: true,
  teacherMusicOpen: false,
  selectedTeacherPack: savedPostcard?.teacherPack || null,
  packPreviewing: false,
  playbackRate: 1,
  bodyLessonIndex: 0,
  bodyPlaybackMode: null,
  bodyRecording: { status: "empty", audioUrl: null, blob: null },
  bodyRecordings: {},
  bodyRecordingsReady: false,
  dogRhythmSource: savedPostcard?.dogRhythmSource === "custom" ? "custom" : "system",
  voice: { status: "empty", audioUrl: null, blob: null },
  voiceRecorderOpen: false,
  voiceStickers: savedVoiceStickers,
  selectedAnimal: null,
  sections: savedSections,
  playingSection: null,
  stageOpen: false,
  stageSection: 0,
  stageCompleted: false,
  stageEntering: [],
  stageLeaving: [],
  performancePreparing: false,
  collaborationPractice: { sing: false, body: false, melody: false },
  collaborationLineIndex: 0,
  collaborationGestureIndex: 0,
  collaborationGestureIds: loadSavedCollaborationGestures(),
  collaborationGesturePickerOpen: false,
  collaborationBar: 0,
  collaborationActionIndex: 0,
  collaborationCountdown: null,
  collaborationDone: false,
  collaborationExchangeRound: 0,
  selectedPoemId: "jingyesi",
  poetryPreviewMode: null,
  version: "ai",
  title: typeof savedPostcard?.title === "string" ? savedPostcard.title : "写给远方的星星",
  message: typeof savedPostcard?.message === "string" ? savedPostcard.message : "想把今天做的音乐送给你。",
  saved: Boolean(savedPostcard),
  modal: null
};

let audioContext;
let timers = [];
let micStream;
let mediaRecorder;
let stageMotionTimer;
let activeVoiceAudios = [];
let activeStemAudios = [];
let activeCompositionSources = [];
let compositionPlaybackToken = 0;
const compositionBufferCache = new Map();
let activeSolfegeAudios = [];
let activeSolfegeNodes = [];
let activePreviewAudio;
let activeSwanAudio;
let activeSwanFrame;
const swanGestureImageCache = new Map();
let activeBodyAudio;
let activeBodyFrame;
let activePoemAudio;
let phonkPlaybackToken = 0;
let phonkRecordingCancelled = false;
let activePhonkAudios = [];
let teacherAudioFile;
let teacherAudioPreviewUrl = CARMEN_AUDIO;
let teacherPreviewMarkedGroup = -1;
let teacherScoreFile;
let shouldAnimateScreen = true;

function currentPackId() {
  if (state.musicSource === "teacher" && state.selectedTeacherPack?.packId) return state.selectedTeacherPack.packId;
  const feeling = state.mood === "miss" ? "longing" : (state.mood || "happy");
  return `${feeling}_${state.groove || "steady"}`;
}

function currentMusicTitle() {
  return state.musicSource === "teacher"
    ? state.selectedTeacherPack?.title || "老师准备的音乐"
    : `${moods[state.mood || "happy"].name} · ${grooves[state.groove || "steady"].name}`;
}

function currentGrooveLabel() {
  return state.musicSource === "teacher"
    ? state.selectedTeacherPack?.grooveSummary || "老师已经配好律动"
    : grooves[state.groove || "steady"].name;
}

function bodyLesson() {
  return BODY_LESSONS[Math.max(0, Math.min(BODY_LESSONS.length - 1, state.bodyLessonIndex))];
}

function musicPath(relativePath) {
  if (state.musicSource === "teacher" && state.selectedTeacherPack) {
    const pack = state.selectedTeacherPack;
    return `${TEACHER_MUSIC_ROOT}/${pack.packId}/${pack.version}/${relativePath}`;
  }
  return `${MUSIC_ROOT}/${currentPackId()}/v01/${relativePath}`;
}

async function loadTeacherMusicPacks() {
  if (typeof fetch !== "function") return;
  try {
    const response = await fetch(`${TEACHER_MUSIC_ROOT}/catalog.json`, { cache: "no-store" });
    if (!response.ok) throw new Error("暂无老师音乐");
    const catalog = await response.json();
    const entries = Object.values(catalog.packs || {}).slice(-12).reverse();
    const packs = await Promise.all(entries.map(async entry => {
      try {
        const manifestResponse = await fetch(`${TEACHER_MUSIC_ROOT}/${entry.manifest}`, { cache: "no-store" });
        if (!manifestResponse.ok) return null;
        const manifest = await manifestResponse.json();
        return {
          packId: manifest.packId || entry.packId,
          version: manifest.version || entry.latestVersion,
          title: manifest.title || entry.title || "老师准备的音乐",
          moodSummary: manifest.moodSummary || entry.moodSummary || "老师设计的感觉",
          grooveSummary: manifest.grooveSummary || entry.grooveSummary || "已经配好律动",
          bpm: Number(manifest.bpm || entry.bpm) || 88,
          durationSeconds: Number(manifest.durationSeconds) || null
        };
      } catch {
        return null;
      }
    }));
    state.teacherMusicPacks = packs.filter(Boolean);
    if (state.selectedTeacherPack) {
      state.selectedTeacherPack = state.teacherMusicPacks.find(pack => pack.packId === state.selectedTeacherPack.packId) || state.selectedTeacherPack;
    }
  } catch {
    state.teacherMusicPacks = [];
  } finally {
    state.teacherMusicLoading = false;
    if (state.screen === "mood") render();
  }
}

function bodyMusicPath(lesson, relativePath) {
  return `${MUSIC_ROOT}/${lesson.id}/v01/${relativePath}`;
}

function stopMusicAudio() {
  stopCompositionSources();
  activeStemAudios.forEach(audio => {
    audio.pause();
    audio.currentTime = 0;
  });
  activeStemAudios = [];
  activePreviewAudio?.pause();
  activePreviewAudio = null;
  activeSolfegeAudios.forEach(audio => {
    audio.pause();
    audio.currentTime = 0;
  });
  activeSolfegeAudios = [];
  state.packPreviewing = false;
}

function stopCompositionSources() {
  compositionPlaybackToken += 1;
  activeCompositionSources.forEach(source => {
    try { source.stop(); } catch {}
    try { source.disconnect(); } catch {}
  });
  activeCompositionSources = [];
}

function stopBodyPlayback() {
  cancelAnimationFrame(activeBodyFrame);
  activeBodyFrame = 0;
  activeBodyAudio?.pause();
  if (activeBodyAudio) activeBodyAudio.currentTime = 0;
  activeBodyAudio = null;
  state.bodyPlaybackMode = null;
  if (["feel-body", "collab-body"].includes(state.screen)) {
    document.querySelectorAll("[data-body-step]").forEach(step => step.classList.remove("active"));
  }
}

function stopPoemAudio() {
  activePoemAudio?.pause();
  if (activePoemAudio) activePoemAudio.currentTime = 0;
  activePoemAudio = null;
}

function stopSwanMelody({ reset = false } = {}) {
  cancelAnimationFrame(activeSwanFrame);
  activeSwanFrame = null;
  activeSwanAudio?.pause();
  activeSwanAudio = null;
  state.classPlaying = false;
  state.swanPausedAt = null;
  if (reset) state.swanProgress = 0;
}

function warmMusicPack() {
  if (state.musicSource === "system" && (!state.mood || !state.groove)) return;
  if (state.musicSource === "teacher" && !state.selectedTeacherPack) return;
  ["preview/mix.wav", ...stemAnimals.map(animal => `stems/${animal}.wav`)].forEach(relativePath => {
    const audio = new Audio(musicPath(relativePath));
    audio.preload = "auto";
    audio.load();
  });
}

function getAudioContext() {
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

function later(fn, delay) {
  const id = setTimeout(fn, delay);
  timers.push(id);
  return id;
}

function drum(strength = 1) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(150, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(48, ctx.currentTime + 0.09);
  gain.gain.setValueAtTime(0.5 * strength, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.13);
}

function tone(frequency, duration = 0.18, volume = 0.12, type = "sine") {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

function phonkKick() {
  drum(0.9);
}

function phonkClap() {
  const ctx = getAudioContext();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.18));
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  filter.type = "highpass"; filter.frequency.value = 900;
  gain.gain.value = 0.22;
  source.buffer = buffer;
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
}

function phonkHat() { tone(5200, 0.055, 0.045, "square"); }
function phonkBass() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const output = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const sub = ctx.createOscillator();
  const body = ctx.createOscillator();
  const bodyGain = ctx.createGain();

  output.gain.setValueAtTime(0.34, now);
  output.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(620, now);
  filter.frequency.exponentialRampToValueAtTime(170, now + 0.58);
  sub.type = "sine";
  sub.frequency.setValueAtTime(82, now);
  sub.frequency.exponentialRampToValueAtTime(49, now + 0.55);
  body.type = "triangle";
  body.frequency.setValueAtTime(164, now);
  body.frequency.exponentialRampToValueAtTime(98, now + 0.5);
  bodyGain.gain.value = 0.24;

  sub.connect(filter);
  body.connect(bodyGain).connect(filter);
  filter.connect(output).connect(ctx.destination);
  sub.start(now);
  body.start(now);
  sub.stop(now + 0.7);
  body.stop(now + 0.7);
}
function phonkCowbell() { tone(740, 0.11, 0.08, "square"); tone(1040, 0.08, 0.04, "square"); }

function phonkStepSounds(step, layers, pattern = state.phonkPattern) {
  if (layers.kick && !state.phonkRecordings.kick?.audioUrl && pattern.kick[step]) phonkKick();
  if (layers.clap && !state.phonkRecordings.clap?.audioUrl && pattern.snare[step]) phonkClap();
  if (layers.hihat && !state.phonkRecordings.hihat?.audioUrl) phonkHat();
  if (layers.bass808 && step % 4 === 0) phonkBass();
  if (layers.cowbell && (step === 1 || step === 5)) phonkCowbell();
}

function stopPhonkRecordedAudio() {
  activePhonkAudios.forEach(audio => {
    audio.pause();
    audio.currentTime = 0;
  });
  activePhonkAudios = [];
}

function playPhonkRecordedTrack(trackId) {
  const recording = state.phonkRecordings[trackId];
  if (!recording?.audioUrl) return;
  const audio = new Audio(recording.audioUrl);
  audio.volume = trackId === "hihat" ? 0.7 : 0.9;
  activePhonkAudios.push(audio);
  const release = () => { activePhonkAudios = activePhonkAudios.filter(item => item !== audio); };
  audio.addEventListener("ended", release, { once: true });
  audio.play().catch(release);
}

function playPhonkSection(sectionIndex, onDone) {
  const section = state.phonkSections[sectionIndex];
  const token = phonkPlaybackToken;
  if (!section) return onDone?.();
  const stepMs = 60000 / PHONK_BPM / 2;
  const totalSteps = section.bars * 8;
  state.phonkPlaying = true;
  state.phonkActiveSection = sectionIndex;
  render();
  for (let index = 0; index < totalSteps; index += 1) {
    later(() => {
      if (!state.phonkPlaying || token !== phonkPlaybackToken) return;
      if (index % 16 === 0) {
        ["kick", "clap", "hihat"].forEach(trackId => {
          if (section.layers[trackId]) playPhonkRecordedTrack(trackId);
        });
      }
      document.querySelectorAll("[data-phonk-play-step]").forEach(dot => dot.classList.toggle("active", Number(dot.dataset.phonkPlayStep) === index % 8));
      phonkStepSounds(index % 8, section.layers);
    }, index * stepMs);
  }
  later(() => {
    if (!state.phonkPlaying || token !== phonkPlaybackToken) return;
    if (onDone) onDone();
    else { state.phonkPlaying = false; render(); }
  }, totalSteps * stepMs + 30);
}

function previewPhonkSection(sectionIndex = state.phonkSelectedSection) {
  if (state.phonkPlaying) return stopPhonkPlayback();
  clearTimers();
  stopPhonkRecordedAudio();
  phonkPlaybackToken += 1;
  playPhonkSection(sectionIndex);
}

function playPhonkWork() {
  clearTimers();
  stopPhonkRecordedAudio();
  phonkPlaybackToken += 1;
  const token = phonkPlaybackToken;
  state.phonkPlaying = true;
  state.phonkCompleted = false;
  render();
  let index = 0;
  const next = () => {
    if (!state.phonkPlaying || token !== phonkPlaybackToken) return;
    if (index >= state.phonkSections.length) {
      state.phonkPlaying = false;
      state.phonkCompleted = true;
      render();
      showToast("完成了，这是你的第一首 Phonk Beat");
      return;
    }
    playPhonkSection(index, () => { index += 1; next(); });
  };
  next();
}

function stopPhonkPlayback() {
  phonkPlaybackToken += 1;
  state.phonkPlaying = false;
  state.phonkEnsembleStatus = "idle";
  state.phonkEnsembleCountdown = 4;
  clearTimers();
  stopPhonkRecordedAudio();
  render();
}

function previewPhonkCharacteristic(kind) {
  if (kind === "cowbell") {
    phonkCowbell();
    later(phonkCowbell, 480);
    later(phonkCowbell, 960);
    return;
  }
  phonkBass();
  later(phonkBass, 680);
  later(phonkBass, 1360);
}

function previewPhonkPractice() {
  const track = PHONK_TRACKS[state.phonkPracticePart];
  if (!track) return;
  const sounds = { kick: phonkKick, clap: phonkClap, hihat: phonkHat };
  const play = sounds[track.id];
  const interval = 60000 / PHONK_BPM;
  clearTimers();
  for (let beat = 0; beat < 8; beat += 1) {
    later(() => {
      document.querySelectorAll("[data-phonk-practice-beat]").forEach((element, index) => element.classList.toggle("active", index === beat));
    }, beat * interval);
    const shouldPlay = track.id !== "clap" || beat % 4 === 1 || beat % 4 === 3;
    if (shouldPlay) {
      const repeats = track.id === "hihat" ? [0, interval / 2] : [0];
      repeats.forEach(offset => later(play, beat * interval + offset));
    }
  }
  later(() => document.querySelectorAll("[data-phonk-practice-beat]").forEach(element => element.classList.remove("active")), 8 * interval);
}

function previewPhonkEnsemble() {
  if (state.phonkPlaying) return stopPhonkPlayback();
  clearTimers();
  phonkPlaybackToken += 1;
  state.phonkPlaying = true;
  state.phonkEnsembleStatus = "countdown";
  state.phonkEnsembleCountdown = 4;
  render();
  const token = phonkPlaybackToken;
  const stepMs = 60000 / PHONK_BPM / 2;
  const beatMs = stepMs * 2;
  for (let count = 4; count >= 1; count -= 1) {
    later(() => {
      if (!state.phonkPlaying || token !== phonkPlaybackToken) return;
      state.phonkEnsembleCountdown = count;
      drum(count === 1 ? 1.25 : 0.75);
      render();
    }, (4 - count) * beatMs);
  }
  for (let step = 0; step < 32; step += 1) {
    later(() => {
      if (!state.phonkPlaying || token !== phonkPlaybackToken) return;
      state.phonkEnsembleStatus = "playing";
      const cycle = Math.floor(step / 8);
      phonkStepSounds(step % 8, {
        kick: true,
        clap: cycle >= 1,
        hihat: cycle >= 2,
        cowbell: false,
        bass808: false
      });
      updatePhonkEnsembleCue(cycle, step % 8);
    }, 4 * beatMs + step * stepMs);
  }
  later(() => {
    if (token !== phonkPlaybackToken) return;
    state.phonkPlaying = false;
    state.phonkEnsembleStatus = "idle";
    state.phonkEnsembleCountdown = 4;
    render();
  }, 4 * beatMs + 32 * stepMs + 30);
}

function updatePhonkEnsembleCue(cycle, step) {
  const entering = Math.min(cycle, 2);
  const beat = Math.floor(step / 2);
  const fullEnsemble = cycle === 3;
  const guide = document.querySelector("[data-phonk-ensemble-guide]");
  if (guide) guide.textContent = fullEnsemble ? "全体合奏" : `第 ${cycle + 1} 小节 · ${["Kick 进入", "Clap 进入", "Hi-Hat 进入"][cycle]}`;
  document.querySelectorAll("[data-phonk-ensemble-row]").forEach((row, index) => {
    const active = index <= entering;
    row.classList.toggle("active", active);
    row.classList.toggle("entering", !fullEnsemble && index === entering);
    const status = row.querySelector("[data-phonk-ensemble-status]");
    if (status) status.textContent = !active ? "准备" : fullEnsemble ? "一起演奏" : index === entering ? "现在进入" : "继续演奏";
    row.querySelectorAll("[data-phonk-ensemble-beat]").forEach((cell, cellIndex) => {
      cell.classList.toggle("current", active && cellIndex === beat);
    });
  });
}

function releasePhonkRecording(trackId) {
  const recording = state.phonkRecordings[trackId];
  if (recording?.audioUrl?.startsWith("blob:")) URL.revokeObjectURL(recording.audioUrl);
  state.phonkRecordings[trackId] = null;
}

async function recordPhonkTrack() {
  if (["countdown", "recording"].includes(state.phonkRecordStatus)) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    showToast("当前浏览器不支持录音，可以使用示范声音继续。");
    return;
  }
  stopPhonkPlayback();
  const track = PHONK_TRACKS[state.phonkRecordIndex];
  if (!track) return;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    state.phonkRecordStatus = "countdown";
    state.phonkCountdown = 4;
    render();
    const interval = 60000 / PHONK_BPM;
    for (let beat = 0; beat < 4; beat += 1) {
      later(() => {
        state.phonkCountdown = 4 - beat;
        drum(beat === 0 ? 0.75 : 0.4);
        render();
      }, beat * interval);
    }
    later(() => beginPhonkCapture(track.id), 4 * interval);
  } catch {
    stopMicrophone();
    state.phonkRecordStatus = "idle";
    render();
    showToast("没有获得麦克风权限，可以使用示范声音继续。");
  }
}

function beginPhonkCapture(trackId) {
  if (!micStream) return;
  releasePhonkRecording(trackId);
  phonkRecordingCancelled = false;
  const chunks = [];
  mediaRecorder = new MediaRecorder(micStream);
  mediaRecorder.addEventListener("dataavailable", event => { if (event.data.size) chunks.push(event.data); });
  mediaRecorder.addEventListener("stop", () => {
    if (phonkRecordingCancelled) {
      phonkRecordingCancelled = false;
      stopMicrophone();
      return;
    }
    const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
    state.phonkRecordings[trackId] = { blob, audioUrl: URL.createObjectURL(blob) };
    state.phonkRecordStatus = "ready";
    stopMicrophone();
    render();
    showToast("录好了，可以先试听。 ");
  }, { once: true });
  mediaRecorder.start();
  state.phonkRecordStatus = "recording";
  render();
  const duration = 2 * PHONK_BEATS_PER_BAR * 60000 / PHONK_BPM;
  later(() => mediaRecorder?.state === "recording" && mediaRecorder.stop(), duration);
}

function previewPhonkRecording() {
  const track = PHONK_TRACKS[state.phonkRecordIndex];
  const recording = track && state.phonkRecordings[track.id];
  if (!recording?.audioUrl) return;
  stopPhonkRecordedAudio();
  playPhonkRecordedTrack(track.id);
}

function acceptPhonkRecording() {
  const track = PHONK_TRACKS[state.phonkRecordIndex];
  if (!track || !state.phonkRecordings[track.id]) return;
  if (state.phonkRecordIndex < PHONK_TRACKS.length - 1) {
    state.phonkRecordIndex += 1;
    state.phonkRecordStatus = state.phonkRecordings[PHONK_TRACKS[state.phonkRecordIndex].id] ? "ready" : "idle";
    render();
    return;
  }
  state.phonkRecordStatus = "idle";
  state.phonkStep = 5;
  render();
}

function resetPhonkLab() {
  Object.keys(state.phonkRecordings).forEach(releasePhonkRecording);
  state.phonkStep = 0;
  state.phonkPracticePart = 0;
  state.phonkPattern = structuredClone(PHONK_DEFAULT_PATTERN);
  state.phonkSections = structuredClone(PHONK_DEFAULT_SECTIONS);
  state.phonkSelectedSection = 0;
  state.phonkRecordIndex = 0;
  state.phonkRecordStatus = "idle";
  state.phonkCountdown = 4;
  state.phonkPerformanceMode = "practice";
  state.phonkActiveSection = 0;
  state.phonkCompleted = false;
  stopPhonkPlayback();
}

function goBackPhonkLevel() {
  clearTimers();
  phonkPlaybackToken += 1;
  state.phonkPlaying = false;
  stopPhonkRecordedAudio();
  if (mediaRecorder?.state === "recording" && state.phonkRecordStatus === "recording") {
    phonkRecordingCancelled = true;
    mediaRecorder.stop();
  }
  if (["countdown", "recording"].includes(state.phonkRecordStatus)) {
    state.phonkRecordStatus = "idle";
    stopMicrophone();
  }
  if (state.phonkStep === 1 && state.phonkPracticePart > 0) {
    state.phonkPracticePart -= 1;
    return render();
  }
  if (state.phonkStep > 0) {
    state.phonkStep -= 1;
    return render();
  }
  return setScreen("home");
}

function stopSolfegeNodes() {
  activeSolfegeNodes.forEach(node => {
    try { node.stop(); } catch {}
  });
  activeSolfegeNodes = [];
}

function schedulePianoNote(frequency, when, duration, volume = 0.16) {
  const ctx = getAudioContext();
  const gain = ctx.createGain();
  const body = ctx.createOscillator();
  const shimmer = ctx.createOscillator();
  body.type = "triangle";
  shimmer.type = "sine";
  body.frequency.setValueAtTime(frequency, when);
  shimmer.frequency.setValueAtTime(frequency * 2, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(volume, when + 0.012);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.045, volume * 0.58), when + Math.min(0.14, duration * 0.3));
  gain.gain.setValueAtTime(Math.max(0.04, volume * 0.5), when + Math.max(0.16, duration * 0.78));
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  body.connect(gain);
  shimmer.connect(gain);
  gain.connect(ctx.destination);
  body.start(when);
  shimmer.start(when);
  body.stop(when + duration + 0.02);
  shimmer.stop(when + duration + 0.02);
  activeSolfegeNodes.push(body, shimmer);
}

function playSolfegeSample(syllable, frequency, duration = 0.34, volume = 0.18) {
  const voiceRoot = fixedDemoAsset("solfegeLesson", "voiceRoot", SOLFEGE_ROOT);
  // Use the natural Katy voice for the scale. Only "si" keeps the carefully
  // spliced version, because the original source says "ti" for that degree.
  const midi = frequency > 0 ? Math.round(69 + 12 * Math.log2(frequency / 440)) : 0;
  const naturalLowFrequency = SOLFEGE_NATURAL_LOW_FREQUENCIES[`${syllable}-${midi}`];
  const sampleRoot = naturalLowFrequency ? SOLFEGE_NATURAL_LOW_ROOT : syllable === "si" ? SOLFEGE_SI_ROOT : voiceRoot;
  const audio = new Audio(`${sampleRoot}/${syllable}.wav`);
  const sourceFrequency = naturalLowFrequency || SOLFEGE_SOURCE_FREQUENCIES[syllable] || SOLFEGE_SOURCE_FREQUENCIES.do;
  audio.preload = "auto";
  audio.volume = volume;
  audio.playbackRate = Math.max(0.25, Math.min(4, frequency / sourceFrequency));
  audio.preservesPitch = false;
  audio.webkitPreservesPitch = false;
  activeSolfegeAudios.push(audio);
  const release = () => {
    activeSolfegeAudios = activeSolfegeAudios.filter(item => item !== audio);
  };
  audio.addEventListener?.("ended", release, { once: true });
  audio.play().catch(() => showToast("小兔唱名没有成功播放，请再试一次。"));
  later(() => {
    audio.pause();
    audio.currentTime = 0;
    release();
  }, duration * 1000);
  return audio;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  later(() => toast.classList.remove("show"), 2200);
}

function setScreen(screen) {
  clearTimers();
  phonkPlaybackToken += 1;
  state.phonkPlaying = false;
  stopPhonkRecordedAudio();
  if (screen !== "mood") state.teacherMusicOpen = false;
  stopMusicAudio();
  stopSwanMelody({ reset: true });
  stopBodyPlayback();
  stopPoemAudio();
  activeVoiceAudios.forEach(audio => audio.pause());
  activeVoiceAudios = [];
  clearTimeout(stageMotionTimer);
  state.classPlaying = false;
  if (!["perform", "ensemble"].includes(screen)) state.performancePreparing = false;
  if (!["arrange", "feel-body"].includes(screen) && micStream) stopMicrophone();
  state.playingSection = null;
  state.stageOpen = false;
  state.stageCompleted = false;
  state.stageEntering = [];
  state.stageLeaving = [];
  if (screen === "teacher" && state.screen !== "teacher") state.teacherMode = "hub";
  state.screen = screen;
  shouldAnimateScreen = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
}

function topbar(step = "") {
  if (state.screen === "home") return "";
  const recordingBusy = (state.screen === "arrange" && ["countdown", "recording"].includes(state.voice.status))
    || (state.screen === "feel-body" && ["countdown", "recording"].includes(state.bodyRecording.status));
  return `
    <header class="topbar">
      <div class="topbar-side"><button class="button ghost" data-action="back" aria-label="返回上一步" ${recordingBusy ? "disabled" : ""}>← 返回</button></div>
      <div class="brand-mini">动物乐队</div>
      <div class="topbar-side"><span class="step-label">${step}</span></div>
    </header>`;
}

function band(className = "") {
  const members = arrangementAnimals.map(key => performerMarkup(key, `band-member band-${key}`)).join("");
  return `<div class="band ${className}" aria-label="动物乐队">${members}</div>`;
}

function avatarMarkup(key, extraClass = "") {
  return `<span class="animal-avatar avatar-${key} ${extraClass}" aria-hidden="true"></span>`;
}

function performerMarkup(key, extraClass = "") {
  return `<span class="performer-art performer-${key} ${extraClass}" aria-hidden="true"></span>`;
}

function dogStateMarkup(stateName, extraClass = "", alt = "") {
  return `<img class="dog-state ${extraClass}" src="${dogStateAssets[stateName]}" data-dog-state="${stateName}" alt="${alt}">`;
}

function render() {
  persistScoreSession();
  const views = {
    home: renderHome,
    "phonk-lab": renderPhonkLab,
    teacher: renderTeacher,
    feel: renderFeelMenu,
    "feel-melody": renderFeelMelody,
    "feel-body": renderFeelBody,
    "feel-sing": renderFeelSing,
    library: renderLibrary,
    mood: renderMood,
    groove: renderGroove,
    arrange: renderArrange,
    processing: renderProcessing,
    refine: renderRefine,
    poetry: renderPoetryChoose,
    postcard: renderPostcard,
    perform: renderPerform,
    collaboration: renderCollaboration,
    "collab-sing": renderCollaborationSing,
    "collab-body": renderCollaborationBody,
    "collab-melody": renderCollaborationMelody,
    ensemble: renderEnsemble
  };
  app.innerHTML = views[state.screen]();
  if (state.screen === "teacher" && state.teacherMode === "hub") {
    app.querySelector(".teacher-platform-hero h2")?.remove();
    app.querySelector(".teacher-platform-hero .lead")?.remove();
    app.querySelectorAll(".teacher-platform-card .teacher-platform-target, .teacher-platform-card small, .teacher-platform-flow").forEach((element) => element.remove());
  }
  app.querySelector(".screen")?.classList.toggle("screen-arrive", shouldAnimateScreen);
  shouldAnimateScreen = false;
  bindEvents();
  initializeGestureMotionDots();
}

function persistScoreSession() {
  try {
    if (!state.scoreDraft) {
      localStorage.removeItem("animal-music-score-session");
      return;
    }
    const session = {
      draft: state.scoreDraft,
      fileName: state.scoreFileName,
      imageUrl: state.scoreImageUrl?.startsWith("blob:") ? "" : state.scoreImageUrl,
      imageDataUrl: state.scoreImageDataUrl || "",
      scorePublished: state.scorePublished,
      publishedLesson: state.scorePublished ? state.publishedSolfegeLesson : null,
      reviewMeasureIndex: state.scoreReviewMeasureIndex,
      confirmedMeasures: state.scoreConfirmedMeasures
    };
    try {
      localStorage.setItem("animal-music-score-session", JSON.stringify(session));
    } catch {
      session.imageDataUrl = "";
      localStorage.setItem("animal-music-score-session", JSON.stringify(session));
    }
  } catch {}
}

function renderHome() {
  return `
    <section class="screen">
      <button class="teacher-corner" data-go="teacher">教师备课</button>
      <div class="hero"><h1>动物乐队</h1><p class="lead">和音乐一起感受，也把你的声音放进作品里。</p></div>
      <div class="home-entry-grid">
        <button class="home-entry feel-entry" data-go="feel"><img class="entry-art" src="assets/stickers/home-feel.png" alt=""><strong>感受</strong><small>画旋律 · 身体演奏 · 唱唱名</small></button>
        <button class="home-entry create-entry" data-go="mood"><img class="entry-art" src="assets/stickers/home-create.png" alt=""><strong>创作</strong><small>贴纸编排我的音乐</small></button>
        <button class="home-entry lab-entry" data-go="phonk-lab"><img class="entry-art" src="assets/stickers/home-lab.png" alt="小狮子在音乐制作台上创作节拍"><strong>音乐实验室</strong><small>玩节拍 · 做音乐 · 编排作品</small></button>
      </div>
    </section>`;
}

function phonkPageHeading(page, title) {
  return `<div class="lab-page-heading"><span>${String(page).padStart(2, "0")} / 07</span><h2>${title}</h2></div>`;
}

function renderPhonkIntro() {
  return `${topbar("Phonk Lab")}<section class="screen phonk-screen phonk-intro-screen">
    <div class="phonk-hero-panel">
      <img class="phonk-hero-lion" src="assets/stickers/home-lab.png" alt="穿着长裤的小狮子在音乐制作台前">
      <div class="phonk-hero-copy">${phonkPageHeading(1, "PHONK")}
        <div class="phonk-style-intro"><strong>PHONK 是什么？</strong><p>PHONK 是一种节拍很有力量的电子音乐。它常把鼓点、低沉的 808 和清亮的 Cowbell 放在一起，听起来有点神秘，也很有冲劲。</p></div>
        <div class="lab-listen-cues" aria-label="音乐中的三种声音"><span><b>节拍</b>稳定向前</span><span><b>当当声</b>Cowbell</span><span><b>低沉重音</b>808</span></div>
        <div class="phonk-actions"><button class="button ghost" data-action="phonk-page-back">返回上一级</button><button class="button secondary" data-action="phonk-listen-intro">${state.phonkPlaying ? "Ⅱ 停止" : "▶ 听一段 PHONK"}</button><button class="button primary" data-action="phonk-start">开始学习</button></div>
      </div>
    </div>
  </section>`;
}

function renderPhonkBody() {
  const track = PHONK_TRACKS[state.phonkPracticePart];
  const isLast = state.phonkPracticePart === PHONK_TRACKS.length - 1;
  const rhythmBeats = track.id === "clap"
    ? ["空", "啪", "空", "啪", "空", "啪", "空", "啪"]
    : Array.from({ length: 8 }, () => track.id === "hihat" ? "呲呲" : "咚");
  return `${topbar("身体里的鼓")}<section class="screen phonk-screen">
    ${phonkPageHeading(2, "身体里的鼓")}
    <div class="lab-practice-card">
      <img src="${track.image}" alt="穿着长裤的小狮子示范${track.action}">
      <div><span class="lab-mini-progress">${state.phonkPracticePart + 1} / 3</span><h3>${track.label}（${track.cn}）</h3><p>${track.description}</p><strong>${track.sound} · ${track.action}</strong>${track.id === "hihat" ? "<small>使用密封塑料容器，请由老师确认瓶盖已经盖紧。</small>" : ""}</div>
    </div>
    <div class="lab-rhythm-line" aria-label="两小节练习节奏">${rhythmBeats.map((beat, index) => `${index === 4 ? "<i aria-hidden=\"true\"></i>" : ""}<span data-phonk-practice-beat="${index}">${beat}</span>`).join("")}</div>
    <div class="phonk-actions"><button class="button ghost" data-action="phonk-page-back">返回上一级</button><button class="button secondary" data-action="phonk-practice-demo">▶ 播放示范</button><button class="button primary" data-action="${isLast ? "phonk-practice-finish" : "phonk-practice-next"}">${isLast ? "开始合奏" : "下一组"}</button></div>
  </section>`;
}

function renderPhonkEnsemble() {
  const ensembleTracks = [
    { label: "Kick（底鼓）组", beats: ["咚", "咚", "咚", "咚"] },
    { label: "Clap（拍手音）组", beats: ["空", "啪", "空", "啪"] },
    { label: "Hi-Hat（踩镲）组", beats: ["呲呲", "呲呲", "呲呲", "呲呲"] }
  ];
  const countdown = [4, 3, 2, 1];
  return `${topbar("节奏合奏")}<section class="screen phonk-screen">
    ${phonkPageHeading(3, "节奏合奏")}
    <div class="lab-ensemble-countdown ${state.phonkEnsembleStatus === "countdown" ? "counting" : ""}">
      <strong data-phonk-ensemble-guide>${state.phonkEnsembleStatus === "countdown" ? "准备" : state.phonkEnsembleStatus === "playing" ? "跟着提示演奏" : "分组进入，最后合奏"}</strong>
      <span>${countdown.map(number => `<i class="${state.phonkEnsembleStatus === "countdown" && state.phonkEnsembleCountdown === number ? "active" : ""}">${number}</i>`).join("<em>·</em>")}</span>
    </div>
    <div class="lab-ensemble-layout"><img src="assets/stickers/phonk-lion-arrange.png" alt="穿着长裤的小狮子指挥合奏"><div class="lab-ensemble-tracks">
      ${ensembleTracks.map((track, rowIndex) => `<div data-phonk-ensemble-row="${rowIndex}"><div class="lab-ensemble-track-head"><b>${track.label}</b><small data-phonk-ensemble-status>准备</small></div><div class="lab-ensemble-beats">${track.beats.map((beat, beatIndex) => `<span data-phonk-ensemble-beat="${beatIndex}">${beat}</span>`).join("")}</div></div>`).join("")}
    </div></div>
    <div class="phonk-actions"><button class="button ghost" data-action="phonk-page-back">返回上一级</button><button class="button secondary" data-action="phonk-ensemble-demo">${state.phonkPlaying ? "Ⅱ 停止示范" : "▶ 播放分层示范"}</button><button class="button primary" data-action="phonk-ensemble-next">认识特征声音</button></div>
  </section>`;
}

function renderPhonkSounds() {
  return `${topbar("特征声音")}<section class="screen phonk-screen">
    ${phonkPageHeading(4, "Cowbell 与 808")}
    <div class="lab-sound-cards">
      <button data-action="phonk-cowbell"><img src="assets/stickers/phonk-cowbell-instrument.png" alt="Cowbell 牛铃乐器和敲棒"><span><b>Cowbell（牛铃音色）</b>明亮的“当当声”，经常重复一小段旋律，是 PHONK 很容易被认出的声音。<strong>▶ 播放 Cowbell</strong></span></button>
      <button data-action="phonk-808"><img src="assets/stickers/phonk-808-instrument.png" alt="产生 808 低音的电子鼓机和低音音箱"><span><b>808（电子低音）</b>来自鼓机的低音鼓，拉长以后像贝斯一样很低、很重，让音乐像在地面上震动。<strong>▶ 播放 808</strong></span></button>
    </div>
    <p class="lab-safety-note">Cowbell 可以用安全金属物轻轻探索；808 由浏览器播放。</p>
    <div class="phonk-actions"><button class="button ghost" data-action="phonk-page-back">返回上一级</button><button class="button primary" data-action="phonk-sounds-next">进入录音工坊</button></div>
  </section>`;
}

function renderPhonkRecorder() {
  const track = PHONK_TRACKS[state.phonkRecordIndex];
  const recording = state.phonkRecordings[track.id];
  const status = state.phonkRecordStatus;
  const statusText = status === "countdown" ? state.phonkCountdown : status === "recording" ? "录音中" : recording ? "录好了" : track.sound;
  return `${topbar("录音工坊")}<section class="screen phonk-screen">
    ${phonkPageHeading(5, "录音工坊")}
    <div class="lab-recorder-layout"><img src="${track.image}" alt="穿着长裤的小狮子示范${track.action}"><div class="lab-recorder-main">
      <div class="lab-record-progress">${PHONK_TRACKS.map((item, index) => `<span class="${state.phonkRecordings[item.id] ? "done" : index === state.phonkRecordIndex ? "current" : ""}">${index + 1}　${item.label}</span>`).join("")}</div>
      <h3>录制 ${track.label}（${track.cn}）组</h3><p>倒数 4 拍后，跟随无声拍点演奏两小节。</p>
      <div class="lab-record-orb ${status}">${statusText}</div>
      <div class="phonk-actions">${status === "idle" ? `<button class="button primary" data-action="phonk-record-start">开始录音</button>` : ""}${status === "ready" ? `<button class="button secondary" data-action="phonk-record-preview">▶ 试听</button><button class="button secondary" data-action="phonk-record-retake">重新录制</button><button class="button primary" data-action="phonk-record-accept">${state.phonkRecordIndex === 2 ? "进入编排" : "保留并录下一组"}</button>` : ""}</div>
    </div></div>
    <div class="phonk-actions"><button class="button ghost" data-action="phonk-page-back" ${["countdown", "recording"].includes(status) ? "disabled" : ""}>返回上一级</button>${status === "idle" && !recording ? `<button class="button ghost lab-skip-record" data-action="phonk-record-skip">使用示范声音继续</button>` : ""}</div>
  </section>`;
}

function renderPhonkArrangement() {
  const section = state.phonkSections[state.phonkSelectedSection];
  const ranges = ["第 1–4 小节", "第 5–8 小节", "第 9–16 小节", "第 17–20 小节", "第 21–24 小节"];
  const tracks = [["kick", "Kick"], ["clap", "Clap"], ["hihat", "Hi-Hat"], ["cowbell", "Cowbell"], ["bass808", "808"]];
  return `${topbar("编排歌曲")}<section class="screen phonk-screen">
    ${phonkPageHeading(6, "编排一首 PHONK")}
    <div class="lab-arrange-top"><img src="assets/stickers/phonk-lion-arrange.png" alt="穿着长裤的小狮子在制作台上编排歌曲"><div><strong>24 小节 · 约 46 秒</strong><p>选择段落，再决定这一段出现哪些声音。</p></div></div>
    <div class="lab-section-tabs">${state.phonkSections.map((item, index) => `<button class="${index === state.phonkSelectedSection ? "active" : ""}" data-phonk-section="${index}"><b>${item.label}</b><span>${item.bars} 小节</span></button>`).join("")}</div>
    <div class="lab-track-picker"><div><h3>${section.label}</h3><span>${ranges[state.phonkSelectedSection]}</span></div><p><b>声音轨道</b>就是一条独立的声音。</p><div>${tracks.map(([key, label]) => `<button class="${section.layers[key] ? "active" : ""}" data-phonk-track="${state.phonkSelectedSection}:${key}">${section.layers[key] ? "✓" : "○"} ${label}</button>`).join("")}</div></div>
    <div class="phonk-actions"><button class="button ghost" data-action="phonk-page-back">返回上一级</button><button class="button secondary" data-action="phonk-arrangement-preview">${state.phonkPlaying ? "Ⅱ 停止试听" : "▶ 试听这一段"}</button><button class="button primary" data-action="phonk-arrangement-next">保存并进入演出</button></div>
  </section>`;
}

function renderPhonkPerformance() {
  const section = state.phonkSections[state.phonkActiveSection] || state.phonkSections[0];
  return `${topbar("全班演出")}<section class="screen phonk-screen phonk-performance-screen">
    ${phonkPageHeading(7, "全班演出")}
    <div class="lab-performance-layout"><img src="assets/stickers/phonk-lion-celebrate.png" alt="穿着长裤的小狮子指挥全班演出"><div>
      <div class="lab-mode-switch"><button class="${state.phonkPerformanceMode === "practice" ? "active" : ""}" data-phonk-mode="practice">练习模式</button><button class="${state.phonkPerformanceMode === "show" ? "active" : ""}" data-phonk-mode="show">演出模式</button></div>
      <div class="lab-now-playing"><span>${state.phonkCompleted ? "演出完成" : state.phonkPlaying ? "正在播放" : "准备开始"}</span><h3>${section.label}</h3><p>${state.phonkPerformanceMode === "practice" ? "选择一个段落反复练习，老师可以随时暂停或重来。" : "歌曲将从头到尾连续播放。"}</p></div>
      <div class="lab-work-progress">${state.phonkSections.map((item, index) => state.phonkPerformanceMode === "practice" ? `<button class="${index === state.phonkActiveSection ? "active" : ""}" data-phonk-performance-section="${index}">${item.label}</button>` : `<span class="${index === state.phonkActiveSection ? "active" : ""}">${item.label}</span>`).join("")}</div>
      <div class="phonk-actions"><button class="button primary" data-action="phonk-performance-play">${state.phonkPlaying ? "Ⅱ 暂停" : "▶ 开始"}</button><button class="button secondary" data-action="phonk-performance-restart">重新开始</button></div>
    </div></div>
    <button class="button ghost" data-action="phonk-page-back">返回上一级</button>
  </section>`;
}

function renderPhonkLab() {
  if (state.phonkStep === 0) return renderPhonkIntro();
  if (state.phonkStep === 1) return renderPhonkBody();
  if (state.phonkStep === 2) return renderPhonkEnsemble();
  if (state.phonkStep === 3) return renderPhonkSounds();
  if (state.phonkStep === 4) return renderPhonkRecorder();
  if (state.phonkStep === 5) return renderPhonkArrangement();
  return renderPhonkPerformance();
}

function renderTeacherHub() {
  const analysisStatus = state.teacherPublished
    ? "已有课堂方案，可继续查看或修改"
    : state.teacherFileName
      ? `已选择：${escapeHtml(state.teacherFileName)}`
      : "上传音乐，自动分析节拍、小节与旋律";
  const scoreStatus = state.scorePublished
    ? `已发布：${escapeHtml(state.publishedSolfegeLesson.title)}`
    : state.scoreFileName
      ? `待确认：${escapeHtml(state.scoreFileName)}`
      : "上传简谱图片，生成首调唱名教学";
  return `${topbar("教师备课平台")}<section class="screen classroom-screen teacher-platform-screen">
    <div class="teacher-platform-hero">
      <p class="eyebrow">统一备课工作台</p>
      <h2>一处准备“感受”和“创作”的音乐内容</h2>
      <p class="lead">选择要准备的课堂模块。各项工作彼此独立，完成的内容会分别进入对应的儿童端功能。</p>
    </div>
    <div class="teacher-platform-grid">
      <button class="teacher-platform-card analysis-card" data-action="open-teacher-analysis">
        <span class="teacher-platform-icon" aria-hidden="true">♫</span>
        <span class="teacher-platform-target">支持儿童端 · 感受</span>
        <strong>旋律手势分析</strong>
        <p>上传一首音乐，自动识别节拍、小节和旋律轮廓，并匹配画旋律手势。</p>
        <small>${analysisStatus}</small>
        <b>${state.teacherPublished ? "查看手势方案" : "进入旋律手势分析"} →</b>
      </button>
      <button class="teacher-platform-card creation-card" data-action="open-teacher-creation">
        <span class="teacher-platform-icon" aria-hidden="true">✦</span>
        <span class="teacher-platform-target">支持儿童端 · 创作</span>
        <strong>贴纸旋律创作</strong>
        <p>进入儿童音乐设计台，为动物贴纸制作旋律、试听编配，并保存正式音乐资源。</p>
        <small>儿童音乐设计台已接入</small>
        <b>进入旋律创作 →</b>
      </button>
      <button class="teacher-platform-card solfege-analysis-card" data-action="open-teacher-solfege">
        <span class="teacher-platform-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M13 7.5h22a4 4 0 0 1 4 4v25a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4v-25a4 4 0 0 1 4-4Z"/><path d="M16 16h16M16 22h16M16 28h9"/><path d="M29 19v12.5a4 4 0 1 1-2-3.46V19h7"/></svg></span>
        <span class="teacher-platform-target">支持儿童端 · 感受 · 唱唱名</span>
        <strong>乐谱唱名制作</strong>
        <p>上传简谱后由模型预生成草稿，再逐小节人工校对，最终生成钢琴唱名课堂。</p>
        <small>${scoreStatus}</small>
        <b>${state.scorePublished ? "查看唱名作品" : "进入唱名制作"} →</b>
      </button>
    </div>
    <div class="teacher-platform-flow"><span>旋律手势分析 <b>→ 画旋律</b></span><i></i><span>乐谱唱名制作 <b>→ 唱唱名</b></span><i></i><span>贴纸旋律创作 <b>→ 创作</b></span></div>
  </section>`;
}

function renderTeacherCreation() {
  return `${topbar("教师备课 · 贴纸旋律创作")}<section class="screen classroom-screen teacher-studio-screen">
    <div class="teacher-studio-head">
      <div><p class="eyebrow">支持儿童端 · 创作</p><h2>贴纸旋律创作</h2><p class="lead">使用儿童音乐设计台完成旋律设计、试听、分轨和保存。保存后的资源用于儿童端贴纸创作。</p></div>
    </div>
    <iframe class="teacher-studio-frame" src="${CHILDREN_MUSIC_STUDIO_URL}" title="儿童音乐设计台" loading="lazy"></iframe>
  </section>`;
}

function scoreDurationLabel(duration) {
  if (duration === 0.125) return "⅛拍";
  if (duration === 0.25) return "¼拍";
  if (duration === 0.375) return "⅜拍";
  if (duration === 0.5) return "½拍";
  if (duration === 0.75) return "¾拍";
  if (duration === 1) return "1拍";
  if (duration === 1.5) return "1½拍";
  if (duration === 2) return "2拍";
  if (duration === 3) return "3拍";
  if (duration === 4) return "4拍";
  return `${duration}拍`;
}

function scoreReviewGroups(score) {
  const groups = [];
  let pickup = null;
  score.measures.forEach((measure, measureIndex) => {
    if (measure.pickup) {
      pickup = { measure, measureIndex };
      return;
    }
    groups.push({
      number: measure.number,
      pickup,
      main: { measure, measureIndex },
      measureIndexes: pickup ? [pickup.measureIndex, measureIndex] : [measureIndex]
    });
    pickup = null;
  });
  return groups;
}

function scoreReviewGroupIndexForMeasure(score, measureIndex) {
  return scoreReviewGroups(score).findIndex(group => group.measureIndexes.includes(measureIndex));
}

function invalidateScoreReviewGroup(measureIndex) {
  if (!state.scoreDraft) return;
  const groupIndex = scoreReviewGroupIndexForMeasure(state.scoreDraft, measureIndex);
  if (groupIndex >= 0) delete state.scoreConfirmedMeasures[groupIndex];
}

function scoreMeasureBeatTotal(measure) {
  return Number(measure.notes.reduce((sum, note) => sum + Number(note.duration || 0), 0).toFixed(3));
}

function scoreExpectedMeasureBeats(score, measure) {
  if (measure.pickup) return Number(measure.beats) || scoreMeasureBeatTotal(measure);
  return score.meter.beats * 4 / score.meter.unit;
}

function scoreReviewGroupMeasures(group) {
  return [group.pickup, group.main].filter(Boolean);
}

function scoreReviewGroupNotes(group) {
  return scoreReviewGroupMeasures(group).flatMap(item => item.measure.notes.map((note, noteIndex) => ({ ...item, note, noteIndex })));
}

function scoreReviewGroupBeatTotal(group) {
  return Number(scoreReviewGroupMeasures(group).reduce((sum, item) => sum + scoreMeasureBeatTotal(item.measure), 0).toFixed(3));
}

function scoreReviewGroupExpectedBeats(score, group) {
  return Number(scoreReviewGroupMeasures(group).reduce((sum, item) => sum + scoreExpectedMeasureBeats(score, item.measure), 0).toFixed(3));
}

function scoreReviewGroupRhythmPatterns(score, group) {
  const notes = scoreReviewGroupNotes(group);
  const count = notes.length;
  const expected = scoreReviewGroupExpectedBeats(score, group);
  const current = notes.map(item => item.note.duration);
  const byCount = expected === 3 ? {
    1: [[3]],
    2: [[1.5, 1.5], [2, 1], [1, 2]],
    3: [[1, 1, 1], [1, 1.5, .5], [1, .5, 1.5]],
    4: [[1, .5, .5, 1], [.5, .5, 1, 1]]
  } : {
    1: [[2]],
    2: [[1, 1], [1.5, .5], [.5, 1.5]],
    3: [[1, .5, .5], [.5, .5, 1], [.5, 1, .5]],
    4: [[.5, .5, .5, .5]]
  };
  const options = byCount[count] || (count ? [Array(count).fill(Number((expected / count).toFixed(3)))] : []);
  if (current.length && !options.some(pattern => pattern.join(",") === current.join(","))) options.unshift(current);
  return options;
}

function scoreRhythmPatterns(measure) {
  if (measure.pickup) return [measure.notes.map(note => note.duration)];
  const patterns = {
    1: [[2]],
    2: [[1, 1], [1.5, .5], [.5, 1.5]],
    3: [[1, .5, .5], [.5, .5, 1], [.5, 1, .5]],
    4: [[.5, .5, .5, .5]]
  };
  const options = patterns[measure.notes.length] || [];
  const current = measure.notes.map(note => note.duration);
  if (!options.some(pattern => pattern.join(",") === current.join(","))) options.unshift(current);
  return options;
}

function renderScoreRhythmPreview(measure, pattern) {
  return pattern.map((duration, index) => {
    const note = measure.notes[index];
    const degree = note?.degree || 0;
    const dotted = duration === .75 || duration === 1.5;
    return `<span class="score-rhythm-symbol ${jianpuDurationClass(duration)}"><b>${degree}${dotted ? "·" : ""}</b>${duration >= 2 ? "—" : ""}</span>`;
  }).join("");
}

function renderScorePitchOptions(note) {
  const groups = [
    { octave: -1, label: "低音（数字下方有点）", prefix: "低音" },
    { octave: 0, label: "中音", prefix: "中音" },
    { octave: 1, label: "高音（数字上方有点）", prefix: "高音" }
  ];
  const restSelected = note.degree === 0 ? "selected" : "";
  return `<option value="0:0" ${restSelected}>休止</option>${groups.map(group => `<optgroup label="${group.label}">${Array.from({ length: 7 }, (_, index) => {
    const degree = index + 1;
    const selected = note.degree === degree && note.octave === group.octave ? "selected" : "";
    return `<option value="${degree}:${group.octave}" ${selected}>${group.prefix} ${degree}</option>`;
  }).join("")}</optgroup>`).join("")}`;
}

function renderScoreDurationOptions(note) {
  const options = [
    [.25, "¼拍"], [.5, "½拍"], [.75, "¾拍"],
    [1, "1拍"], [1.5, "1½拍"], [2, "2拍"], [3, "3拍"], [4, "4拍"]
  ];
  return options.map(([duration, label]) => `<option value="${duration}" ${Number(note.duration) === duration ? "selected" : ""}>${label}</option>`).join("");
}

function renderScoreDurationHelp() {
  return `<details class="score-duration-help">
    <summary>怎么看音符长度？</summary>
    <div class="score-duration-guide">
      <span><b class="duration-demo quarter">5</b><small>¼拍<br>数字下两横</small></span>
      <span><b class="duration-demo eighth">5</b><small>½拍<br>数字下一横</small></span>
      <span><b class="duration-demo dotted-eighth">5·</b><small>¾拍<br>下一横＋右侧点</small></span>
      <span><b class="duration-demo">5</b><small>1拍<br>普通数字</small></span>
      <span><b class="duration-demo">5·</b><small>1½拍<br>数字右侧点</small></span>
      <span><b class="duration-demo">5 —</b><small>2拍<br>后面一横</small></span>
    </div>
  </details>`;
}

function renderScoreNotes(measure, measureIndex) {
  return measure.notes.map((note, noteIndex) => {
    const confidence = Math.round((note.confidence || 0) * 100);
    return `<div class="score-note ${confidence < 72 ? "needs-check" : ""}" data-score-note="${measureIndex}-${noteIndex}">
      <select class="score-pitch-select" data-score-pitch data-measure="${measureIndex}" data-note="${noteIndex}" aria-label="第 ${measure.number} 小节第 ${noteIndex + 1} 个音的音高">${renderScorePitchOptions(note)}</select>
      <label class="score-duration-field"><span>长度</span><select data-score-duration data-measure="${measureIndex}" data-note="${noteIndex}" aria-label="这个音符的长度">${renderScoreDurationOptions(note)}</select></label>
      <input class="score-note-lyric" data-score-lyric data-measure="${measureIndex}" data-note="${noteIndex}" value="${escapeHtml(note.lyric || "")}" placeholder="歌词" aria-label="这个音对应的歌词">
      <button type="button" class="score-note-delete" data-score-delete-note data-measure="${measureIndex}" data-note="${noteIndex}" aria-label="删除这个音符">删除</button>
      ${confidence < 72 ? `<i title="模型把握度较低">请核对</i>` : ""}
    </div>`;
  }).join("");
}

function renderScoreReviewGroup(score, group, groupIndex) {
  const measure = group.main.measure;
  const measureIndex = group.main.measureIndex;
  return `<article class="score-measure-card">
    <div class="score-measure-head"><strong>第 ${group.number} 小节</strong><span class="score-review-state ${state.scoreConfirmedMeasures[groupIndex] ? "done" : ""}">${state.scoreConfirmedMeasures[groupIndex] ? "已确认" : "待确认"}</span></div>
    <div class="score-note-row score-grouped-notes">${group.pickup ? renderScoreNotes(group.pickup.measure, group.pickup.measureIndex) : ""}${renderScoreNotes(measure, measureIndex)}<button type="button" class="score-add-note" data-score-add-note data-measure="${measureIndex}">＋ 添加音符</button></div>
    ${renderScoreDurationHelp()}
  </article>`;
}

function renderScoreLivePreview(score, groups) {
  const measures = groups.map((group, groupIndex) => {
    const notes = scoreReviewGroupNotes(group).map(item => renderJianpuNote(item.note, score)).join("");
    return `<button type="button" class="score-preview-measure ${groupIndex === state.scoreReviewMeasureIndex ? "active" : ""}" data-score-preview-measure="${groupIndex}" aria-label="编辑第 ${group.number} 小节">
      <small>${group.number}</small><div>${notes || `<span class="score-empty-measure">暂无音符</span>`}</div>
    </button>`;
  }).join("");
  return `<section class="score-live-preview" aria-label="实时简谱预览">
    <div class="score-live-preview-head"><div><strong>当前简谱</strong><small>修改音高、长度或歌词后会立即更新</small></div><span>点击小节可编辑</span></div>
    <div class="score-preview-grid">${measures}</div>
  </section>`;
}

function renderTeacherScore() {
  if (state.scoreStep === "analyzing") {
    return `${topbar("教师备课 · 唱名教学")}<section class="screen classroom-screen">
      <div class="teacher-analysis-loading">${avatarMarkup("rabbit", "analysis-rabbit")}<p class="eyebrow">模型正在读取 ${escapeHtml(state.scoreFileName)}</p><h2>生成可核对的乐谱草稿</h2><div class="teacher-progress" role="progressbar" aria-valuenow="62"><i style="width:62%"></i></div><strong class="teacher-progress-number">识别中</strong><div class="analysis-checks"><span class="done">划分乐谱行和小节</span><span class="done">识别数字与歌词</span><span>标记需要人工核对的位置</span></div><p class="helper">模型只负责预填，不会直接生成课堂内容。</p></div>
    </section>`;
  }

  if ((state.scoreStep === "review" || state.scoreStep === "published") && state.scoreDraft) {
    const score = state.scoreDraft;
    const meter = `${score.meter.beats}/${score.meter.unit}`;
    const groups = scoreReviewGroups(score);
    state.scoreReviewMeasureIndex = Math.max(0, Math.min(groups.length - 1, state.scoreReviewMeasureIndex));
    const currentGroup = groups[state.scoreReviewMeasureIndex];
    const groupBeatTotal = scoreReviewGroupBeatTotal(currentGroup);
    const groupExpectedBeats = scoreReviewGroupExpectedBeats(score, currentGroup);
    const measureValid = Math.abs(groupBeatTotal - groupExpectedBeats) < .001;
    const confirmedCount = groups.filter((_, index) => state.scoreConfirmedMeasures[index]).length;
    const allConfirmed = confirmedCount === groups.length;
    const measureNav = groups.map((group, index) => `<button class="${index === state.scoreReviewMeasureIndex ? "active" : ""} ${state.scoreConfirmedMeasures[index] ? "done" : ""}" data-score-review-measure="${index}" aria-label="第 ${group.number} 小节">${state.scoreConfirmedMeasures[index] ? "✓" : group.number}</button>`).join("");
    return `${topbar("教师备课 · 唱名教学")}<section class="screen classroom-screen teacher-score-review">
      <div class="teacher-review-head score-simple-head"><div><p class="eyebrow">校对第 ${state.scoreReviewMeasureIndex + 1} / ${groups.length} 小节</p><h2>${escapeHtml(score.title)}</h2></div><button class="button ghost" data-action="reset-score">换乐谱</button></div>
      ${renderScoreLivePreview(score, groups)}
      <div class="score-review-layout">
        <aside class="score-source-panel">${(state.scoreImageUrl || state.scoreImageDataUrl) ? `<img src="${state.scoreImageUrl || state.scoreImageDataUrl}" alt="上传的简谱原图">` : ""}<div><strong>原始乐谱</strong><small>${escapeHtml(state.scoreFileName)}</small></div></aside>
        <div class="score-review-main">
          <div class="score-compact-meta"><span>1 = ${escapeHtml(score.tonic)}</span><span>${meter} 拍</span><label>速度 <input data-score-bpm type="number" min="36" max="180" value="${score.bpm}"> BPM</label></div>
          <div class="score-measure-navigator"><button class="button ghost" data-action="previous-score-measure" ${state.scoreReviewMeasureIndex === 0 ? "disabled" : ""}>←</button><div>${measureNav}</div><button class="button ghost" data-action="next-score-measure" ${state.scoreReviewMeasureIndex === groups.length - 1 ? "disabled" : ""}>→</button></div>
          ${measureValid ? "" : `<div class="score-warning"><strong>长度需要调整</strong><p>当前合计 ${groupBeatTotal} 拍，应为 ${groupExpectedBeats} 拍。请修改音符长度。</p></div>`}
          <div class="score-measure-list">${renderScoreReviewGroup(score, currentGroup, state.scoreReviewMeasureIndex)}</div>
          <div class="score-review-actions"><button class="button secondary" data-action="preview-score-measure">▶ 试听这个小节</button><button class="button primary" data-action="confirm-score-measure" ${measureValid ? "" : "disabled"}>${state.scoreConfirmedMeasures[state.scoreReviewMeasureIndex] ? "已确认，继续下一节" : "确认这个小节"}</button></div>
          <div class="score-publish-row"><span>${state.scorePublished ? "已生成唱名" : `已完成 ${confirmedCount}/${groups.length}`}</span><button class="button primary" data-action="publish-score" ${allConfirmed ? "" : "disabled"}>生成钢琴与唱名</button>${state.scorePublished ? `<button class="button secondary" data-go="feel-sing">打开唱名课堂</button>` : ""}</div>
        </div>
      </div>
    </section>`;
  }

  return `${topbar("教师备课 · 唱名教学")}<section class="screen classroom-screen">
    <div class="hero score-upload-hero"><p class="eyebrow">乐谱生成唱名</p><h2>上传乐谱，逐小节确认</h2><p class="lead">系统先预填，您只需对照原图修改。</p></div>
    <div class="teacher-upload-shell score-upload-shell">
      <div class="teacher-demo-song"><div><span class="lesson-tag">体验完整流程</span><strong>用《东方红》模拟模型预生成</strong><small>系统会故意标出几处需要人工确认的位置</small></div><button class="button primary" data-action="load-score-demo">生成识别草稿</button></div>
      <label class="teacher-upload-zone" for="teacher-score-input"><span class="upload-mark">上传简谱</span><strong>${state.scoreFileName ? escapeHtml(state.scoreFileName) : "选择一张清晰的简谱图片"}</strong><small>${state.scoreFileName ? "图片已准备好，可以开始识别" : "第一版支持 PNG、JPG、WEBP、BMP；建议一张图只放一个主旋律声部"}</small><input id="teacher-score-input" data-score-file type="file" accept="image/png,image/jpeg,image/webp,image/bmp"></label>
      ${(state.scoreImageUrl || state.scoreImageDataUrl) ? `<img class="score-upload-preview" src="${state.scoreImageUrl || state.scoreImageDataUrl}" alt="待分析的简谱">` : ""}
      ${state.scoreError ? `<div class="score-error">${escapeHtml(state.scoreError)}</div>` : ""}
      <button class="button secondary teacher-analyze-button" data-action="analyze-score" ${teacherScoreFile ? "" : "disabled"}>模型预生成</button>
    </div>
  </section>`;
}

function renderTeacher() {
  if (state.teacherMode === "hub") return renderTeacherHub();
  if (state.teacherMode === "creation") return renderTeacherCreation();
  if (state.teacherMode === "solfege") return renderTeacherScore();
  if (state.teacherMode === "voicebank") return renderTeacherVoiceBank();
  const fileName = state.teacherFileName || CARMEN_TITLE;
  if (state.teacherStep === "analyzing") {
    const progress = state.teacherAnalysisProgress;
    return `${topbar("教师备课")}<section class="screen classroom-screen">
    <div class="teacher-analysis-loading">${avatarMarkup("rabbit", "analysis-rabbit")}<p class="eyebrow">正在分析 ${escapeHtml(fileName)}</p><h2>${escapeHtml(progress.label)}</h2><div class="teacher-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}"><i style="width:${progress.percent}%"></i></div><strong class="teacher-progress-number">${progress.percent}%</strong><p class="teacher-progress-detail">${escapeHtml(progress.detail)}</p><div class="analysis-checks"><span class="${progress.percent >= 30 ? "done" : ""}">识别节拍与小节</span><span class="${progress.percent >= 46 ? "done" : ""}">读取旋律走向</span><span class="${progress.percent >= 90 ? "done" : ""}">匹配手势图库</span></div><p class="helper">正在根据这次上传的音频逐小节生成；完成后仍需老师确认。</p></div>
  </section>`;
  }

  if (state.teacherStep === "review" || state.teacherStep === "published") {
    const meta = state.teacherAnalysisMeta;
    const cards = state.teacherAnalysis.map((group, groupIndex) => teacherAnalysisCard(group, groupIndex)).join("");
    return `${topbar("教师备课")}<section class="screen classroom-screen teacher-review-screen">
      <div class="teacher-review-head"><div><p class="eyebrow">${state.teacherPublished ? "已确认的课堂方案" : meta.curated ? "内置课程方案 · 等待老师确认" : "音频分析完成 · 等待老师确认"}</p><h2>${escapeHtml(fileName)}</h2><p class="lead">已读取完整音频，并为 ${meta.measureCount} 个有音乐内容的小节生成手势。没有声音的小节不会匹配手势。</p></div><span class="lesson-tag">${meta.curated ? "老师编排 · " : "估算 "}${meta.meter} · ${Math.round(meta.bpm)} BPM</span></div>
      ${teacherAudioPreviewUrl ? `<div class="teacher-audio-dock"><strong>试听并核对手势</strong><small>播放或拖动进度，下面会标出当前对应手势</small><audio class="teacher-audio-preview" data-teacher-preview controls src="${teacherAudioPreviewUrl}"></audio></div>` : ""}
      ${renderMeterDecision(meta)}
      <div class="teacher-review-list">${cards}</div>
      ${state.teacherEditing ? renderTeacherGesturePicker() : ""}
      <div class="teacher-publish-bar"><p>${state.teacherPublished ? "这份手势方案已经同步到感受课堂。" : "确认后，儿童端才会使用这份手势方案。"}</p><div class="button-row">${state.teacherPublished ? `<button class="button secondary" data-action="reopen-teacher-review">继续修改</button><button class="button primary" data-go="feel-melody">打开课堂预览</button>` : `<button class="button secondary" data-action="reset-teacher-song">换一首音乐</button><button class="button primary" data-action="publish-teacher-lesson">确认并用于课堂</button>`}</div></div>
    </section>`;
  }

  return `${topbar("教师备课")}<section class="screen classroom-screen">
    <div class="hero"><p class="eyebrow">教师备课工具</p><h2>上传一首音乐，建立课堂时间轴</h2><p class="lead">系统先分析节拍、小节和旋律轮廓，为画旋律、身体演奏和唱唱名准备共同的音乐基础。</p></div>
    <div class="teacher-upload-shell">
      <div class="teacher-demo-song"><div><span class="lesson-tag">内置课程演示</span><strong>${CARMEN_TITLE}</strong><small>音频已保存在 Demo 中，可直接生成 3/4 拍手势方案</small></div><button class="button primary" data-action="load-carmen-demo">直接分析《卡门》</button></div>
      <label class="teacher-upload-zone" for="teacher-audio-input"><span class="upload-mark">上传音乐</span><strong>${state.teacherFileName ? escapeHtml(state.teacherFileName) : "选择一首音乐"}</strong><small>${state.teacherFileName ? "已经准备好，可以开始分析" : "支持 MP3、WAV、M4A 等常见音频；仅用于本次备课"}</small><input id="teacher-audio-input" data-teacher-file type="file" accept="audio/*"></label>
      <button class="button primary teacher-analyze-button" data-action="analyze-teacher-song" ${state.teacherFileName ? "" : "disabled"}>开始音频分析</button>
    </div>
    <p class="teacher-safety-note">当前版本不调用 AI。系统自动确定节拍和小节，老师只需确认最终教学动作。</p>
  </section>`;
}

function renderMeterDecision(meta) {
  const confidence = Math.round((meta.meterConfidence || 0) * 100);
  return `<div class="teacher-meter-decision"><div><strong>已自动识别：${escapeHtml(meta.meter)}</strong><small>系统根据全曲重拍结构自动决定 · 内部把握度 ${confidence}%</small></div><b>无需老师判断</b></div>`;
}

function pulseCountForMeter(meter = state.teacherAnalysisMeta?.meter) {
  if (meter === "3/4") return 3;
  if (meter === "6/8") return 2;
  return 4;
}

function gestureTiming(group, slotIndex = 0) {
  if (group.gestureTimings?.[slotIndex]) return group.gestureTimings[slotIndex];
  const slotCount = group.mode === "merged" ? 1 : Math.max(1, group.gestureIds.length);
  const duration = (group.end - group.start) / slotCount;
  const start = group.start + duration * slotIndex;
  const end = slotIndex === slotCount - 1 ? group.end : start + duration;
  const measuresInSlot = group.mode === "merged" ? Math.max(1, group.bars[1] - group.bars[0] + 1) : 1;
  const pulseCount = pulseCountForMeter() * measuresInSlot;
  return {
    start,
    end,
    beatTimes: Array.from({ length: pulseCount }, (_, index) => start + index * (end - start) / pulseCount)
  };
}

function gestureBeatGuide(group, slotIndex = 0, meter = state.teacherAnalysisMeta?.meter) {
  const timing = gestureTiming(group, slotIndex);
  const pulsesPerMeasure = pulseCountForMeter(meter);
  const dots = timing.beatTimes.map((_, beatIndex) => `<i data-gesture-beat="${beatIndex}" class="${beatIndex % pulsesPerMeasure === 0 ? "strong" : ""}"></i>`).join("");
  return `<div class="gesture-beat-guide" aria-label="动作节拍点">${dots}</div>`;
}

function teacherAnalysisCard(group, groupIndex) {
  const modeName = group.mode === "rest" ? "休止 · 水平线" : group.mode === "split" ? "分别呈现" : group.mode === "repeat" ? "相似小节 · 重复" : "连续旋律 · 合并";
  const gestures = group.gestureIds.map((gestureId, slotIndex) => {
    const barLabel = group.mode === "merged" ? formatBarRange(group.bars) : `第 ${group.bars[slotIndex]} 小节`;
    const gesture = gestureById(gestureId);
    if (gesture.kind === "rest") return `<div class="teacher-gesture-choice rest-gesture"><span>${barLabel}</span><img src="${gesture.image}" alt="${gesture.label}"><small>${gesture.label}</small>${gestureBeatGuide(group, slotIndex)}</div>`;
    return `<button class="teacher-gesture-choice" data-edit-gesture data-group="${groupIndex}" data-slot="${slotIndex}"><span>${barLabel}</span><img src="${gesture.image}" alt="${gesture.label}"><small>${gesture.label}</small>${gestureBeatGuide(group, slotIndex)}<b>修改</b></button>`;
  }).join("");
  return `<article class="teacher-analysis-card" data-analysis-group="${groupIndex}"><div class="teacher-card-playback-track"><i></i></div><div class="teacher-analysis-card-head"><div><strong>${formatBarRange(group.bars)}</strong><p>${group.reason}</p></div><div class="teacher-card-actions"><span>${modeName}</span><button type="button" class="teacher-locate-button" data-action="locate-teacher-group" data-group="${groupIndex}">⌖ 定位试听</button></div></div><div class="teacher-playback-badge">▶ 音乐播放到这里</div><div class="teacher-gesture-pair mode-${group.mode}">${gestures}</div></article>`;
}

function formatBarRange(bars) {
  return bars[0] === bars[1] ? `第 ${bars[0]} 小节` : `第 ${bars[0]}—${bars[1]} 小节`;
}

function renderTeacherGesturePicker() {
  const meter = state.teacherAnalysisMeta?.meter || "4/4";
  const scopes = ["universal", meter].filter((scope, index, list) => list.indexOf(scope) === index);
  const sections = scopes.map(scope => {
    const choices = gestureLibrary
      .filter(gesture => gesture.scope === scope && gesture.kind !== "rest")
      .map(gesture => `<button class="gesture-library-item" data-choose-gesture="${gesture.id}"><img src="${gesture.image}" alt="${gesture.label}"><span><strong>${gesture.name}${gesture.difficulty === "support" ? " · 辅助" : ""}</strong><small>${gesture.label}</small></span></button>`).join("");
    return choices ? `<section class="gesture-library-section"><h4>${gestureScopeLabel(scope)}</h4><div class="gesture-library-grid">${choices}</div></section>` : "";
  }).join("");
  return `<div class="gesture-picker-backdrop" data-action="close-gesture-picker"><div class="gesture-picker" role="dialog" aria-modal="true" aria-labelledby="gesture-picker-title" onclick="event.stopPropagation()"><div class="gesture-picker-head"><div><p class="eyebrow">${escapeHtml(meter)} 手势图库</p><h3 id="gesture-picker-title">选择替换手势</h3></div><button class="button ghost" data-action="close-gesture-picker">关闭</button></div>${sections}</div></div>`;
}

function renderFeelMenu() {
  return `${topbar("感受")}<section class="screen feel-menu-screen">
    <div class="hero"><p class="eyebrow">选择一种方式</p><h2>你想怎么感受音乐？</h2></div>
    <div class="feel-choice-grid">
      <button class="feel-choice feel-choice-melody" data-go="feel-melody">
        ${avatarMarkup("cat", "feel-choice-animal")}
        <strong>画旋律</strong><small>跟着小猫画出声音的高低</small>
      </button>
      <button class="feel-choice feel-choice-body" data-go="feel-body">
        ${avatarMarkup("dog", "feel-choice-animal")}
        <strong>身体演奏</strong><small>跟着小狗用身体打节拍</small>
      </button>
      <button class="feel-choice feel-choice-sing" data-go="feel-sing">
        ${avatarMarkup("rabbit", "feel-choice-animal")}
        <strong>唱唱名</strong><small>跟着钢琴唱出旋律</small>
      </button>
    </div>
  </section>`;
}

function feelPlayerButton() {
  return `<button class="button primary feel-play-button" data-action="toggle-class-play">${state.classPlaying ? "Ⅱ 暂停" : "▶ 开始"}</button>`;
}

function renderSwanWindowProgress(analysis, currentIndex) {
  const radius = 2;
  const start = Math.max(0, Math.min(currentIndex - radius, analysis.length - (radius * 2 + 1)));
  const visible = analysis.slice(start, start + radius * 2 + 1);
  const items = visible.map((item, offset) => {
    const index = start + offset;
    const label = item.bars[0] === item.bars[1] ? item.bars[0] : `${item.bars[0]}—${item.bars[1]}`;
    return `<span class="${index === currentIndex ? "active" : ""} ${index < currentIndex ? "done" : ""}">${label}</span>`;
  }).join("");
  return `<div class="swan-progress-count">第 ${currentIndex + 1} / ${analysis.length} 组</div><div class="swan-window-progress" aria-label="小节进度">${items}</div>`;
}

function swanGroupModeLabel(group) {
  return group.mode === "merged" ? "一个连续动作" : group.mode === "repeat" ? "重复同一个动作" : "两个小节分别动作";
}

function swanGestureCardsMarkup(group) {
  return group.gestureIds.map((gestureId, index) => {
    const barLabel = group.mode === "merged" ? formatBarRange(group.bars) : `第 ${group.bars[index]} 小节`;
    const gesture = gestureById(gestureId);
    const restClass = gesture.kind === "rest" ? " rest-gesture" : "";
    return `<div class="swan-measure-gesture${restClass}" data-class-gesture="${index}"><span>${barLabel}</span>${gestureMotionMarkup(gestureId, `swan-main-gesture ${state.classPlaying ? "playing" : ""}`)}<p>${gesture.label}</p>${gestureBeatGuide(group, index, state.publishedLessonMeter)}<div class="swan-gesture-time"><i></i></div></div>`;
  }).join("");
}

async function preloadSwanGestureImages() {
  const urls = new Set(state.publishedTeacherAnalysis.flatMap(group => group.gestureIds.map(id => gestureById(id).image)));
  await Promise.all([...urls].map(url => new Promise(resolve => {
    const cachedImage = swanGestureImageCache.get(url);
    if (cachedImage?.complete) {
      Promise.resolve(cachedImage.decode?.()).catch(() => {}).finally(resolve);
      return;
    }
    const image = cachedImage || new Image();
    swanGestureImageCache.set(url, image);
    const decode = () => Promise.resolve(image.decode?.()).catch(() => {}).finally(resolve);
    image.addEventListener("load", decode, { once: true });
    image.addEventListener("error", resolve, { once: true });
    image.src = url;
    if (image.complete) decode();
  })));
}

function updateSwanSectionView(sectionIndex) {
  const analysis = state.publishedTeacherAnalysis;
  const group = analysis[sectionIndex] || defaultCarmenAnalysis[sectionIndex];
  if (!group) return;
  const range = app.querySelector(".swan-current-label span");
  const mode = app.querySelector(".swan-current-label strong");
  const grid = app.querySelector(".swan-measure-grid.is-active") || app.querySelector(".swan-measure-grid");
  const nextGrid = [...app.querySelectorAll(".swan-measure-grid")].find(item => item !== grid);
  const progressCount = app.querySelector(".swan-progress-count");
  const windowProgress = app.querySelector(".swan-window-progress");
  if (!range || !mode || !grid || !nextGrid || !progressCount || !windowProgress) return;
  range.textContent = formatBarRange(group.bars);
  mode.textContent = swanGroupModeLabel(group);
  nextGrid.className = `swan-measure-grid mode-${group.mode} is-active`;
  nextGrid.innerHTML = swanGestureCardsMarkup(group);
  nextGrid.setAttribute("aria-hidden", "false");
  grid.classList.remove("is-active");
  grid.setAttribute("aria-hidden", "true");
  const progressFrame = document.createElement("div");
  progressFrame.innerHTML = renderSwanWindowProgress(analysis, sectionIndex);
  progressCount.replaceWith(progressFrame.children[0]);
  windowProgress.replaceWith(progressFrame.children[0]);
}

function renderFeelMelody() {
  state.feelMode = "melody";
  const analysis = state.publishedTeacherAnalysis;
  const group = analysis[state.swanSection] || defaultCarmenAnalysis[state.swanSection];
  const gestureCards = group.gestureIds.map((gestureId, index) => {
    const barLabel = group.mode === "merged" ? formatBarRange(group.bars) : `第 ${group.bars[index]} 小节`;
    const gesture = gestureById(gestureId);
    if (gesture.kind === "rest") return `<div class="swan-measure-gesture rest-gesture" data-class-gesture="${index}"><span>${barLabel}</span>${gestureMotionMarkup(gestureId, `swan-main-gesture ${state.classPlaying ? "playing" : ""}`)}<p>${gesture.label}</p>${gestureBeatGuide(group, index, state.publishedLessonMeter)}<div class="swan-gesture-time"><i></i></div></div>`;
    return `<div class="swan-measure-gesture" data-class-gesture="${index}"><span>${barLabel}</span>${gestureMotionMarkup(gestureId, `swan-main-gesture ${state.classPlaying ? "playing" : ""}`)}<p>${gesture.label}</p>${gestureBeatGuide(group, index, state.publishedLessonMeter)}<div class="swan-gesture-time"><i></i></div></div>`;
  }).join("");
  return `${topbar("画旋律")}<section class="screen feel-feature-screen">
    <div class="feel-feature-heading">${avatarMarkup("cat", "feel-feature-animal melody-gesture-cat")}<div><p class="eyebrow">${escapeHtml(state.publishedLessonTitle)}</p><h2>跟着手势感受旋律</h2></div></div>
    <div class="feel-core-card swan-gesture-core">
      <div class="swan-current-label"><span>${formatBarRange(group.bars)}</span><strong>${group.mode === "merged" ? "一个连续动作" : group.mode === "repeat" ? "重复同一动作" : "两个小节分别动作"}</strong></div>
      <div class="swan-measure-stage"><div class="swan-measure-grid mode-${group.mode} is-active" aria-hidden="false">${gestureCards}</div><div class="swan-measure-grid" aria-hidden="true"></div></div>
      ${renderSwanWindowProgress(analysis, state.swanSection)}
    </div>
    <button class="button primary feel-play-button" data-action="play-swan-melody">${state.classPlaying ? "Ⅱ 暂停" : state.swanPausedAt !== null ? "▶ 继续跟着演" : state.swanProgress >= 1 ? "↻ 再演一次" : "▶ 开始跟着演"}</button>
  </section>`;
}

function renderFeelBody() {
  state.feelMode = "body";
  const lesson = bodyLesson();
  loadBodyScore(lesson);
  const pattern = bodyDisplayPattern(lesson);
  const bpm = bodyLessonBpm(lesson);
  const completed = Boolean(state.bodyRecordings[lesson.id]);
  const completedCount = BODY_LESSONS.filter(item => state.bodyRecordings[item.id]).length;
  const recording = state.bodyRecording.status === "recording";
  const countdown = state.bodyRecording.status === "countdown";
  const ready = state.bodyRecording.status === "ready";
  const sequence = pattern.map((step, index) => {
    const action = BODY_ACTIONS[step.action];
    return `<div class="body-step action-${step.action}" data-body-step="${index}"><strong>${action.syllable}</strong><small>${action.label}</small></div>`;
  }).join("");
  const grooveSwitcher = BODY_GROOVE_ORDER.map(groove => `<button class="${lesson.groove === groove ? "active" : ""}" data-body-groove="${groove}" aria-pressed="${lesson.groove === groove}" ${recording || countdown ? "disabled" : ""}>${grooves[groove].name}</button>`).join("");
  return `${topbar("身体演奏")}<section class="screen feel-feature-screen">
    <div class="feel-feature-heading">${avatarMarkup("dog", "feel-feature-animal")}<div><p class="eyebrow">桌面节奏课 · ${state.bodyLessonIndex + 1} / 16</p><h2>${grooves[lesson.groove].name} · ${moods[lesson.mood].name}</h2></div></div>
    <div class="body-groove-switcher" aria-label="切换律动">${grooveSwitcher}</div>
    <div class="body-course-progress"><span style="width:${completedCount / 16 * 100}%"></span></div>
    <p class="body-progress-copy">已完成 ${completedCount} 份节奏录音。每个律动依次练习四种心情。</p>
    <div class="feel-core-card body-lesson-shell">
      <div class="body-lesson-meta"><span>${bpm} BPM</span><strong>${pattern.map(step => BODY_ACTIONS[step.action].syllable).join(" · ")}</strong><em>${completed ? "✓ 这一课已保存" : "听一听，再录下两个小节"}</em></div>
      <div class="body-action-guide-frame" data-body-guide="dong" role="img" aria-label="小狗示范敲桌面">
        <img class="body-action-guide body-guide-dong" src="${BODY_ACTION_GUIDE}" alt="">
        <img class="body-action-guide body-guide-ci" src="${BODY_ACTION_GUIDE}" alt="">
        <img class="body-action-guide body-guide-da" src="${BODY_ACTION_GUIDE}" alt="">
      </div>
      <div class="body-sequence" aria-label="本课动作顺序">${sequence}</div>
      <p class="body-record-hint">${recording ? "正在录制：跟着亮起的动作做，音乐此时不会播放。" : countdown ? "先听四拍准备，准备拍不会录进去。" : "先听小狗的节奏。正式录制时只有画面提示，背景音乐不会录进去。"}</p>
      <div class="body-lesson-controls">
        <button class="button secondary" data-action="body-listen" ${recording || countdown ? "disabled" : ""}>▶ 只听小狗</button>
        <button class="button secondary" data-action="body-slow" ${recording || countdown ? "disabled" : ""}>慢速练习</button>
        <button class="button secondary" data-action="body-practice" ${recording || countdown ? "disabled" : ""}>跟音乐练习</button>
      </div>
      <div class="body-recorder ${recording ? "is-recording" : ""}">
        <div class="record-light">${recording ? "● 正在录制" : countdown ? "四拍准备" : ready ? "录制完成，先试听" : completed ? "可以重新录制" : "准备录制"}</div>
        ${ready ? `<audio class="voice-preview" controls src="${state.bodyRecording.audioUrl}"></audio>` : ""}
        <div class="button-row">${ready
          ? `<button class="button primary" data-action="save-body-recording">保存并完成</button><button class="button ghost" data-action="record-body">重新录制</button>`
          : `<button class="button primary" data-action="record-body" ${recording || countdown ? "disabled" : ""}>${completed ? "重新录这一课" : "开始录制"}</button>`}</div>
      </div>
      <div class="body-lesson-nav"><button class="button ghost" data-action="previous-body-lesson" ${state.bodyLessonIndex === 0 || recording || countdown ? "disabled" : ""}>← 上一课</button><button class="button ghost" data-action="next-body-lesson" ${state.bodyLessonIndex === 15 || !completed || recording || countdown ? "disabled" : ""}>下一课 →</button></div>
    </div>
  </section>`;
}

function jianpuDurationClass(duration) {
  if (duration <= .25) return "sixteenth";
  if (duration <= .5) return "eighth";
  if (duration < 1) return "dotted-eighth";
  if (duration > 1 && duration < 2) return "dotted-quarter";
  if (duration >= 2) return "half";
  return "quarter";
}

function renderJianpuNote(note, lesson) {
  const index = lesson.notes.indexOf(note);
  const octaveClass = note.octave < 0 ? "low" : note.octave > 0 ? "high" : "middle";
  const dotted = note.duration === .75 || note.duration === 1.5;
  const holdCount = note.duration >= 2 ? Math.max(1, Math.round(note.duration) - 1) : 0;
  const holdMarkup = holdCount ? `<span class="jianpu-hold">${Array(holdCount).fill("—").join(" ")}</span>` : "";
  return `<span class="jianpu-note ${octaveClass} ${jianpuDurationClass(note.duration)} ${index === state.solfegeActiveNoteIndex ? "active" : ""}" data-solfege-note="${index}" role="button" tabindex="0" aria-label="试听${note.solfege || "这个音"}" style="--note-grow:${Math.max(.5, note.duration)}"><span class="jianpu-sign"><span class="jianpu-number">${note.degree}${dotted ? `<i>·</i>` : ""}</span>${holdMarkup}</span><em>${escapeHtml(note.lyric || "　")}</em></span>`;
}

function solfegeRecordingKey(note) {
  const midi = note.frequency > 0 ? Math.round(69 + 12 * Math.log2(note.frequency / 440)) : 0;
  return `${note.solfege}-${midi}`;
}

function solfegeRecordingTargets() {
  const syllables = ["do", "re", "mi", "fa", "sol", "la", "si"];
  const semitones = [0, 2, 4, 5, 7, 9, 11];
  return [-1, 0, 1].flatMap(octave => syllables.map((solfege, index) => {
    const midi = 60 + octave * 12 + semitones[index];
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    return { key: `${solfege}-${midi}`, solfege, degree: index + 1, octave, midi, frequency };
  }));
}

function solfegePitchLabel(target) {
  const octaveText = target.octave < 0 ? "低八度" : target.octave > 0 ? "高八度" : "中八度";
  return `${octaveText} ${target.solfege}`;
}

function renderSolfegeRecorder() {
  const targets = solfegeRecordingTargets();
  const completed = targets.filter(target => state.solfegeRecordings[target.key]).length;
  const selected = targets[Math.max(0, Math.min(targets.length - 1, state.solfegeRecordTargetIndex))] || targets[0];
  const recording = state.solfegeRecordStatus === "recording";
  const countdown = state.solfegeRecordStatus === "countdown";
  const busy = state.solfegeRecordStatus !== "idle";
  const saved = selected && Boolean(state.solfegeRecordings[selected.key]);
  const savedRecording = saved ? state.solfegeRecordings[selected.key] : null;
  const validDuration = savedRecording ? Number(savedRecording.validDuration || savedRecording.audioBuffer?.duration || 0) : 0;
  const targetButtons = [-1, 0, 1].map(octave => {
    const label = octave < 0 ? "低八度" : octave > 0 ? "高八度" : "中八度";
    const buttons = targets.map((target, index) => ({ target, index })).filter(item => item.target.octave === octave).map(({ target, index }) => `<button class="voice-target ${index === state.solfegeRecordTargetIndex ? "active" : ""} ${state.solfegeRecordings[target.key] ? "done" : ""}" data-record-target="${index}" aria-label="${solfegePitchLabel(target)}${state.solfegeRecordings[target.key] ? "已录制" : "未录制"}" ${busy ? "disabled" : ""}><span>${target.degree}</span><small>${target.solfege}</small></button>`).join("");
    return `<div class="voice-register-group"><strong>${label}</strong><div class="voice-register-targets">${buttons}</div></div>`;
  }).join("");
  return `<section class="solfege-recorder" aria-label="录制标准唱名">
    <div class="recorder-head"><div><strong>录制标准唱名</strong><span>至少保持 ${SOLFEGE_MIN_VOICE_SECONDS} 秒，建议稳定发音 ${SOLFEGE_RECOMMENDED_VOICE_SECONDS} 秒；录完会自动剪掉前后空白</span></div><button class="recorder-close" data-action="close-solfege-recorder" aria-label="收起录音区" ${busy ? "disabled" : ""}>×</button></div>
    <div class="voice-progress"><i style="--voice-progress:${targets.length ? completed / targets.length : 0}"></i><span>已完成 ${completed} / ${targets.length}</span></div>
    <div class="voice-targets">${targetButtons}</div>
    <div class="voice-record-stage ${recording ? "is-recording" : ""}">
      <div><small>现在录</small><strong>${selected ? solfegePitchLabel(selected) : "暂无目标音"}</strong><span>${saved ? `有效发音 ${validDuration.toFixed(2)} 秒 · 已自动剪切` : countdown ? "先听标准音，准备开口" : recording ? "正在录音，请稳定保持声音" : `有效发音至少需要 ${SOLFEGE_MIN_VOICE_SECONDS} 秒`}</span></div>
      <div class="voice-record-actions">
        <button class="button secondary" data-action="play-solfege-guide" ${recording || countdown ? "disabled" : ""}>♪ 标准音</button>
        ${saved ? `<button class="button secondary" data-action="preview-solfege-recording" ${busy ? "disabled" : ""}>▶ 试听录音</button>` : ""}
        <button class="button primary" data-action="record-solfege-target" ${recording || countdown ? "disabled" : ""}>${recording ? "正在录音…" : countdown ? "准备…" : saved ? "重新录制" : "开始录音"}</button>
      </div>
    </div>
    <p class="voice-local-note">绿色对勾表示已保存。这是独立音色库，全部简谱都会自动使用。</p>
  </section>`;
}

function renderTeacherVoiceBank() {
  const targets = solfegeRecordingTargets();
  const completed = targets.filter(target => state.solfegeRecordings[target.key]).length;
  const complete = completed === targets.length;
  return `${topbar("教师备课 · 标准唱名音色库")}<section class="screen classroom-screen teacher-voice-bank-screen">
    <div class="teacher-studio-head teacher-voice-bank-head">
      <div><p class="eyebrow">独立资源 · 所有简谱通用</p><h2>录制一套标准唱名</h2><p class="lead">这套录音不属于任何一首乐谱。以后每次生成简谱，儿童端都会自动调用它。</p></div>
      <button class="button secondary" data-action="teacher-hub">返回备课首页</button>
    </div>
    <section class="teacher-voice-bank-summary">
      <div><strong>${complete ? "音色库已准备好" : "完成 21 个音，就能用于所有简谱"}</strong><p>依次录制低八度、中八度和高八度。播放时会按唱名选择最接近音区的录音，再轻微调整到乐谱需要的音高。</p></div>
      <span class="teacher-voice-status ${complete ? "done" : ""}">${complete ? "已完成" : `${completed} / ${targets.length}`}</span>
    </section>
    <div class="teacher-voice-bank-actions"><button class="button ${complete ? "secondary" : "primary"}" data-action="open-solfege-recorder">${complete ? "检查或重新录制" : completed ? "继续录制" : "开始录制"}</button><button class="button secondary" data-go="feel-sing" ${completed ? "" : "disabled"}>打开儿童端试听</button></div>
    <p class="voice-local-note">录音保存在当前浏览器和设备中，不会绑定某一首简谱。</p>
    ${state.solfegeRecordingOpen ? renderSolfegeRecorder() : ""}
  </section>`;
}

function renderFeelSing() {
  state.feelMode = "sing";
  const lesson = state.publishedSolfegeLesson || DEFAULT_SOLFEGE_LESSON;
  // JSON storage duplicates the note objects in `notes` and `measures`.
  // Rebuilding the derived list keeps every visible note linked to its stable index.
  refreshScoreDerivedData(lesson);
  const phrases = lesson.phrases?.length ? lesson.phrases : [{ id: "all", label: "第 1 页", lyrics: "" }];
  state.solfegePhraseIndex = Math.max(0, Math.min(state.solfegePhraseIndex, phrases.length - 1));
  const phrase = phrases[state.solfegePhraseIndex];
  const pageMeasures = lesson.measures.filter(measure => measure.notes.some(note => note.phraseId === phrase.id));
  const pickup = pageMeasures.find(measure => measure.pickup);
  const fullMeasures = pageMeasures.filter(measure => !measure.pickup).slice(0, 4);
  const pickupMarkup = pickup ? `<div class="jianpu-pickup"><span>弱起</span>${pickup.notes.map(note => renderJianpuNote(note, lesson)).join("")}</div>` : "";
  const measuresMarkup = fullMeasures.map(measure => `<div class="jianpu-measure"><div>${measure.notes.map(note => renderJianpuNote(note, lesson)).join("")}</div></div>`).join("");
  const pageDots = phrases.map((item, index) => `<button class="${index === state.solfegePhraseIndex ? "active" : ""}" data-solfege-phrase="${index}" aria-label="第 ${index + 1} 页">${index + 1}</button>`).join("");
  return `${topbar("唱唱名")}<section class="screen feel-feature-screen">
    <div class="simple-sing-heading">${avatarMarkup("rabbit", "simple-sing-rabbit")}<div><p>${escapeHtml(lesson.title)} · 1 = ${escapeHtml(lesson.tonic)} · 2/4</p><h2>唱唱名</h2></div></div>
    <div class="simple-jianpu-card">
      <div class="simple-score-meta"><span>${escapeHtml(phrase.label)}</span><strong>${escapeHtml(phrase.lyrics)}</strong></div>
      <div class="simple-score-line" aria-label="本页四小节简谱">${pickupMarkup}<div class="four-measure-grid">${measuresMarkup}</div></div>
      <div class="simple-page-dots" aria-label="切换简谱页">${pageDots}</div>
    </div>
    <div class="solfege-play-panel">
      <div class="solfege-speed-control"><label for="solfege-speed">播放速度 <output data-solfege-speed-output>${Math.round((lesson.bpm || 72) * state.playbackRate)} BPM</output></label><input id="solfege-speed" data-solfege-speed data-base-bpm="${lesson.bpm || 72}" type="range" min="0.5" max="1.5" step="0.05" value="${state.playbackRate}" aria-label="调节播放速度"><div><span>慢</span><span>正常</span><span>快</span></div></div>
      <div class="solfege-play-actions">
        <button class="button ${state.classPlaying && !state.solfegePlayingFull ? "primary" : "secondary"}" data-action="play-solfege-section">${state.classPlaying && !state.solfegePlayingFull ? "Ⅱ 停止" : "▶ 听小节"}</button>
        <button class="button ${state.classPlaying && state.solfegePlayingFull ? "primary" : "secondary"}" data-action="play-full-solfege">${state.classPlaying && state.solfegePlayingFull ? "Ⅱ 停止" : "▶ 听全曲"}</button>
      </div>
      <p class="student-voice-source-note">看着简谱，听钢琴演奏唱名旋律。</p>
    </div>
  </section>`;
}

function melodyContour(measure = state.lessonMeasure) {
  const descriptions = ["平稳 → 向上走", "向下走 → 回到中间"];
  const paths = [
    "40,132 170,132 300,96 430,54 600,54",
    "40,54 190,96 330,132 470,96 600,96"
  ];
  return `<div class="melody-card" aria-label="第 ${measure + 1} 小节旋律曲线">
    <div class="measure-card-label">第 ${measure + 1} 小节 · 独立旋律卡</div>
    <div class="melody-labels"><span>高</span><span>低</span></div>
    <svg class="melody-svg" viewBox="0 0 640 180" role="img" aria-label="${descriptions[measure]}">
      <polyline points="${paths[measure]}" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>
    <div class="melody-caption">${descriptions[measure]} · 跟着小兔画</div>
  </div>`;
}

function bodyPattern() {
  return `<div class="body-demo">
    <div class="dog-demo-leader" aria-live="polite">
      ${dogStateMarkup("ready", "dog-demo-state", "小狗准备领演")}
      <span>小狗领演</span>
    </div>
    <div class="body-pattern" aria-label="身体演奏动作">
      <div data-action-step="0"><strong>1</strong>${dogStateMarkup("clap", "dog-action-thumbnail", "小狗拍手") }<small>拍手</small></div>
      <div data-action-step="1"><strong>2</strong>${dogStateMarkup("patThighs", "dog-action-thumbnail", "小狗拍腿") }<small>拍腿</small></div>
      <div data-action-step="2"><strong>3</strong>${dogStateMarkup("clap", "dog-action-thumbnail", "小狗拍手") }<small>拍手</small></div>
      <div data-action-step="3"><strong>4</strong>${dogStateMarkup("stop", "dog-action-thumbnail", "小狗停住") }<small>停住</small></div>
    </div>
  </div>`;
}

function renderLibrary() {
  return `${topbar("审核歌曲页")}<section class="screen classroom-screen">
    <div class="hero"><p class="eyebrow">音乐库</p><h2>选择一首已经审核的音乐</h2><p class="lead">这里的音乐已经准备好画旋律、身体演奏和唱唱名。</p></div>
    <div class="library-grid">
      <article class="library-song selected"><div class="song-cover">♪</div><div><span class="lesson-tag">人工校准课程</span><h3>《东方红》</h3><p>F 调 · 2/4 拍 · 每页 4 小节</p><button class="button primary" data-go="feel">选择这首歌</button></div></article>
      <article class="library-song"><div class="song-cover child-work-cover">★</div><div><span class="lesson-tag">我的作品</span><h3>${state.saved ? escapeHtml(state.title) : "还没有保存的作品"}</h3><p>${state.saved ? "可再次画旋律、做身体演奏" : "完成一件作品后，它会保存在这台设备。"}</p>${state.saved ? `<div class="button-row library-actions"><button class="button secondary" data-go="refine">打开我的作品</button><button class="button ghost danger-text" data-action="delete-work">删除本机作品</button></div>` : ""}</div></article>
    </div>
  </section>`;
}

function renderMood() {
  const cards = Object.entries(moods).map(([key, mood]) => `
    <button class="mood-card ${mood.className} ${state.mood === key ? "selected" : ""}" data-mood="${key}" aria-pressed="${state.mood === key}">
      <span class="emoji">${mood.emoji}</span><strong>${mood.name}</strong><small>${mood.hint}</small>
    </button>`).join("");
  const customPack = state.teacherMusicPacks.find(pack => pack.title === "雨后晴天蹦蹦跳") || state.teacherMusicPacks[0];
  const teacherCard = customPack ? `<button class="teacher-music-card" data-teacher-pack="${escapeHtml(customPack.packId)}">
    <span class="teacher-music-icon" aria-hidden="true">✦</span>
    <span><strong>雨后晴天蹦蹦跳</strong><b>${escapeHtml(customPack.moodSummary)} · ${escapeHtml(customPack.grooveSummary)} · ${customPack.bpm} BPM</b></span>
    <i>直接创作 →</i>
  </button>` : "";
  const teacherSection = `<section class="teacher-music-section ${state.teacherMusicOpen ? "is-open" : ""}">
    <button class="teacher-music-toggle" data-action="toggle-teacher-music" aria-expanded="${state.teacherMusicOpen}"><span>自定义旋律</span><b>${state.teacherMusicOpen ? "收起" : "展开"}⌄</b></button>
    ${state.teacherMusicOpen ? `<div class="teacher-music-dropdown">${state.teacherMusicLoading ? `<p class="teacher-music-loading">正在读取旋律……</p>` : teacherCard || `<p class="teacher-music-loading">暂时没有可用旋律。</p>`}</div>` : ""}
  </section>`;
  return `${topbar("创作 · 选择感觉")}<section class="screen">
    <div class="hero"><p class="eyebrow">第一张贴纸</p><h2>选择一种感觉</h2><p class="lead">它会决定音乐的旋律材料和画面氛围。</p></div>
    <div class="mood-grid">${cards}</div>
    <div class="actions"><button class="button primary" data-go="groove" ${state.mood ? "" : "disabled"}>选择律动贴纸</button></div>
    ${teacherSection}
  </section>`;
}

function renderGroove() {
  const cards = Object.entries(grooves).map(([key, groove]) => `<button class="groove-card ${state.groove === key ? "selected" : ""}" data-groove="${key}" aria-pressed="${state.groove === key}"><span>${groove.emoji}</span><strong>${groove.name}</strong><small>${groove.hint}</small></button>`).join("");
  const customReady = Boolean(state.groove && state.bodyRecordings[currentPackId()]);
  return `${topbar("创作 · 选择律动")}<section class="screen"><div class="hero"><p class="eyebrow">第二张贴纸</p><h2>音乐想怎么动？</h2><p class="lead">先选律动，再决定让小狗播放系统节奏，还是你在课程里录好的节奏。</p></div><div class="mood-grid">${cards}</div>${state.groove ? `<div class="music-ready"><span>✓ 真实分轨已就绪</span><small>${moods[state.mood].name} × ${grooves[state.groove].name} · ${grooveAudio[state.groove].bpm} BPM</small><button class="button secondary" data-action="preview-pack">${state.packPreviewing ? "Ⅱ 停止试听" : "▶ 试听完整乐队"}</button></div><div class="rhythm-source-chooser"><div><strong>小狗用哪一种节奏？</strong><small>这个选择会用于作品的全部四段。</small></div><button class="${state.dogRhythmSource === "system" ? "active" : ""}" data-rhythm-source="system"><b>系统节奏</b><small>使用已有的小狗分轨</small></button><button class="${state.dogRhythmSource === "custom" ? "active" : ""}" data-rhythm-source="custom" ${customReady ? "" : "disabled"}><b>我的录制</b><small>${customReady ? "使用这组心情与律动的录音" : "还没有完成对应课程"}</small></button>${customReady ? "" : `<button class="button ghost rhythm-course-link" data-go="feel-body">去身体节奏课录制 →</button>`}</div>` : ""}<div class="actions"><button class="button primary" data-go="arrange" ${state.groove ? "" : "disabled"}>开始歌曲编排</button></div></section>`;
}

function isVoiceStickerKey(key) {
  return key === "voice" || (typeof key === "string" && key.startsWith("voice:"));
}

function voiceStickerForKey(key) {
  if (key === "voice") return state.voice.status === "ready" ? { id: "legacy", name: "我的声音", role: "录音", audioUrl: state.voice.audioUrl, blob: state.voice.blob } : null;
  const id = isVoiceStickerKey(key) ? key.slice(6) : key;
  return state.voiceStickers.find(item => item.id === id) || null;
}

function renderArrangementVoiceRecorder() {
  if (!state.voiceRecorderOpen) return "";
  const ready = state.voice.status === "ready";
  const recording = state.voice.status === "recording";
  const preparing = state.voice.status === "countdown";
  const busy = recording || preparing;
  const duration = twoBarDuration();
  return `<section class="arrange-voice-recorder voice-recorder ${recording ? "is-recording" : ""}">
    <div class="arrange-voice-head"><div><p class="eyebrow">录制新的声音贴纸</p><h3>${preparing ? "听四拍，准备开始" : recording ? "正在录制两个小节" : ready ? "试听这张声音贴纸" : "录下生活声音、哼唱或拟声"}</h3></div><button class="recorder-close" data-action="cancel-voice-recorder" ${busy ? "disabled" : ""} aria-label="关闭录音">×</button></div>
    <div class="recording-tempo"><b>${currentBpm()} BPM</b><span>${escapeHtml(currentGrooveLabel())}</span><span>固定两小节 · 约 ${duration.toFixed(1)} 秒</span></div>
    <div class="record-light">${recording ? "● 正在录制" : preparing ? "四拍准备" : ready ? "录制完成" : "准备录制"}</div>
    <div class="beat-row">${Array.from({ length: 8 }, (_, index) => `<span class="beat-dot" data-record-beat="${index}">${index + 1}</span>`).join("")}</div>
    ${ready ? `<audio class="voice-preview" controls src="${state.voice.audioUrl}"></audio>` : `<div class="voice-icon">🎙️</div>`}
    <p class="helper">${ready ? "满意后保存，它会成为一张新的声音贴纸。" : "录音只保存在当前设备；系统按这首歌的速度自动开始和停止。"}</p>
    <div class="button-row">${ready ? `<button class="button primary" data-action="save-voice-sticker">保存为声音贴纸</button><button class="button secondary" data-action="record-voice">重新录制</button>` : `<button class="button primary" data-action="record-voice" ${busy ? "disabled" : ""}>开始录制</button>`}</div>
  </section>`;
}

function renderArrange() {
  const questions = ["谁先开始？", "要加入新的声音吗？", "这里想怎么变化？", "谁来完成最后一段？"];
  const sections = state.sections.map((section, sectionIndex) => {
    const chips = section.length ? section.map(key => `<button class="animal-chip ${isVoiceStickerKey(key) ? "voice-chip" : ""} ${state.playingSection === sectionIndex ? "playing" : ""}" draggable="true" data-chip="${key}" data-from="${sectionIndex}" title="点击让${stickerInfo(key).name}休息">${stickerMarkup(key)}</button>`).join("") : `<div class="empty-section">点一下这里，邀请选中的贴纸</div>`;
    return `<article class="section-card ${state.playingSection === sectionIndex ? "current" : ""}" data-section="${sectionIndex}">
      <span class="section-number">${sectionIndex + 1}</span><p>${questions[sectionIndex]}</p><div class="section-animals">${chips}</div>
      <button class="button ghost" data-action="play-section" data-index="${sectionIndex}">▶ 试听</button>
    </article>`;
  }).join("");
  const animalStickers = arrangementAnimals.map(key => { const sticker = stickerInfo(key); return `<button class="sticker ${state.selectedAnimal === key ? "selected" : ""}" draggable="true" data-sticker="${key}" aria-pressed="${state.selectedAnimal === key}">${stickerMarkup(key)}<span>${sticker.name} · ${sticker.role}</span></button>`; }).join("");
  const voiceStickers = state.voiceStickers.map(item => { const key = `voice:${item.id}`; return `<div class="voice-sticker-item"><button class="sticker voice-sticker ${state.selectedAnimal === key ? "selected" : ""}" draggable="true" data-sticker="${key}" aria-pressed="${state.selectedAnimal === key}">${stickerMarkup(key)}<span>${escapeHtml(item.name)} · 录音</span></button><button class="voice-sticker-delete" data-delete-voice-id="${escapeHtml(item.id)}" aria-label="删除${escapeHtml(item.name)}">×</button></div>`; }).join("");
  const canRecord = state.voiceStickers.length < MAX_VOICE_STICKERS;
  return `${topbar("创作 · 四段编排")}<section class="screen arrange-screen">
    <div class="hero"><p class="eyebrow">${state.musicSource === "teacher" ? "老师制作 · 律动已经配好" : "叫上动物乐队"}</p><h2>${escapeHtml(currentMusicTitle())}</h2><p class="lead">${escapeHtml(currentGrooveLabel())} · ${currentBpm()} BPM。拖动贴纸，或先点贴纸、再点乐段。</p></div>
    ${renderStage()}
    <div class="timeline">${sections}</div>
    <div class="sticker-tray sound-sticker-tray" data-tray><div class="sticker-tray-heading"><div><h3>声音贴纸盒</h3><p>动物分轨和你录制的声音，都可以放进四段编排。</p></div><button class="button secondary" data-action="open-voice-recorder" ${canRecord ? "" : "disabled"}>＋ 录制声音贴纸</button></div><div class="stickers">${animalStickers}${voiceStickers}</div><p class="audio-note">录音固定使用当前音乐的 ${currentBpm()} BPM，每张录制两个小节；最多保存 ${MAX_VOICE_STICKERS} 张。</p></div>
    ${renderArrangementVoiceRecorder()}
    <div class="button-row"><button class="button secondary" data-action="${state.playingSection !== null ? "stop-composition" : "play-all"}">${state.playingSection !== null ? "Ⅱ 暂停试听" : "▶ 听我的作品"}</button><button class="button primary" data-action="begin-refine">看看它能怎么玩 →</button></div>
  </section>`;
}

function renderProcessing() {
  return `${topbar("正在完成")}<section class="screen">
    <div class="stage-card">
      ${band("playing")}
      <p class="eyebrow">正在整理你的四段编排</p>
      <h2>实时混音已经完成，正在优化衔接…</h2>
      <p class="lead">不会重新作曲，也不会改变动物出场。</p>
    </div>
  </section>`;
}

function stickerInfo(key) {
  if (isVoiceStickerKey(key)) return voiceStickerForKey(key) || { name: "我的声音", role: "录音" };
  return animals[key];
}

function stickerMarkup(key) {
  if (isVoiceStickerKey(key)) {
    const sticker = voiceStickerForKey(key);
    const number = Math.max(1, state.voiceStickers.findIndex(item => item.id === sticker?.id) + 1);
    return `<span class="voice-sticker-icon" aria-hidden="true">🎙️<small>${number}</small></span>`;
  }
  return avatarMarkup(key);
}

function renderRefine() {
  const mood = moods[state.mood || "miss"];
  return `${topbar("创作第 3 步 / 3")}<section class="screen finish-path-screen">
    <div class="hero finish-path-hero"><p class="eyebrow">音乐做好啦！</p><h2>接下来想怎么玩？</h2><p class="lead">选一个你喜欢的玩法吧。</p></div>
    <div class="finish-path-grid">
      <button class="finish-path-card singing-path" data-action="open-poetry-path">
        <span class="finish-path-art">${performerMarkup("rabbit")}</span>
        <span class="finish-path-copy"><strong>唱古诗</strong><small>选一首“${mood.name}”的诗，让小兔唱进音乐里</small><b>去选古诗 →</b></span>
      </button>
      <button class="finish-path-card postcard-path" data-go="postcard">
        <span class="finish-path-art">${band("still")}</span>
        <span class="finish-path-copy"><strong>做成明信片</strong><small>把现在的音乐送给家人朋友</small><b>做明信片 →</b></span>
      </button>
    </div>
    <button class="button ghost" data-go="arrange">回去改音乐</button>
  </section>`;
}

function renderPoemChoiceCard(poem, mood, selectedId) {
  const ready = Boolean(poem.audioUrl);
  const selected = poem.id === selectedId && ready;
  return `<article class="poem-choice-card ${ready ? "ready" : "coming"} ${selected ? "selected" : ""}">
    <div class="poem-choice-top"><span class="child-mood-tag">${mood.name}</span><b>${ready ? "小兔会唱" : "人声准备中"}</b></div>
    <h3>${poem.title}</h3><small>${poem.author}</small>
    <div class="poem-choice-lines" aria-label="${poem.title}全文">${poem.lines.map(line => `<span>${line}</span>`).join("")}</div>
    ${ready
      ? `<button class="button ${selected ? "primary" : "secondary"}" data-action="select-poem" data-poem="${poem.id}">${selected ? "✓ 已选中" : "选这首"}</button>`
      : `<span class="poem-coming-label">以后就能唱啦</span>`}
  </article>`;
}

function renderPoetryChoose() {
  const mood = moods[state.mood || "miss"];
  const poems = poemsForCurrentMood();
  const poem = selectedPoem();
  const selectedReady = Boolean(poem?.audioUrl);
  const mixing = state.playingSection !== null || state.poetryPreviewMode === "mix";
  const vocalPlaying = state.poetryPreviewMode === "vocal";
  return `${topbar("唱古诗 · 选一首")}<section class="screen child-poetry-screen">
    <div class="hero child-poetry-hero"><p class="eyebrow">${mood.name}的诗</p><h2>选一首古诗来唱吧</h2><p class="lead">有“小兔会唱”标记的诗，现在就能试听。</p></div>
    <div class="poem-choice-grid">${poems.map(item => renderPoemChoiceCard(item, mood, poem?.id)).join("")}</div>
    ${selectedReady ? `<section class="poem-ready-actions"><div class="poem-ready-rabbit">${performerMarkup("rabbit")}</div><div><small>现在选择</small><strong>${poem.title}</strong></div><div class="child-listen-actions"><button class="button secondary" data-action="${vocalPlaying ? "stop-poetry-preview" : "preview-poem-vocal"}">${vocalPlaying ? "Ⅱ 暂停" : "▶ 听小兔唱"}</button><button class="button secondary" data-action="${mixing ? "stop-poetry-preview" : "preview-poem-mix"}">${mixing ? "Ⅱ 暂停" : "▶ 听完整作品"}</button></div><button class="button primary child-choose-poem" data-go="collaboration">合作表演 →</button></section>`
      : `<section class="poem-none-ready"><strong>这些古诗的人声还在准备</strong><span>准备好后，就可以让小兔唱进你的音乐里。</span></section>`}
    <button class="button ghost" data-go="refine">换一种玩法</button>
  </section>`;
}

function collaborationAllDone() {
  return Object.values(state.collaborationPractice).every(Boolean);
}

function collaborationBodyLesson() {
  return BODY_LESSONS.find(lesson => lesson.id === currentPackId()) || BODY_LESSONS[0];
}

function collaborationRoleCard({ role, screen, color, title, task, animal, artClass }) {
  const done = state.collaborationPractice[role];
  return `<button class="collaboration-role role-${color} ${done ? "done" : ""}" data-go="${screen}">
    <span class="role-status">${done ? "✓ 已练习" : "待练习"}</span>
    ${artClass ? `<img class="role-animal-art ${artClass}" src="${animal}" alt="">` : performerMarkup(animal, "role-animal-art")}
    <strong>${title}</strong>
    <small>${task}</small>
    <b>进入练习 →</b>
  </button>`;
}

function renderCollaboration() {
  const allDone = collaborationAllDone();
  const poem = selectedPoem();
  return `${topbar("合作表演")}<section class="screen collaboration-screen">
    <div class="hero"><p class="eyebrow">${poem.title} · 我的${moods[state.mood || "miss"].name}音乐</p><h2>一起把作品演出来吧</h2><p class="lead">每个人都有自己的音乐任务。点击一个角色，先完成对应练习。</p></div>
    <div class="collaboration-role-grid">
      ${collaborationRoleCard({ role: "sing", screen: "collab-sing", color: "sing", title: "古诗演唱家", task: "跟着小兔唱古诗", animal: "rabbit" })}
      ${collaborationRoleCard({ role: "body", screen: "collab-body", color: "body", title: "身体节奏家", task: "跟着小狗打节奏", animal: "assets/stickers/states/performer-dog-clap.png", artClass: "dog-role-art" })}
      ${collaborationRoleCard({ role: "melody", screen: "collab-melody", color: "melody", title: "旋律指挥家", task: "跟着小猫画旋律", animal: "assets/stickers/performer-cat-gesture.png", artClass: "cat-role-art" })}
    </div>
    <div class="collaboration-unlock ${allDone ? "ready" : ""}">
      <p>${allDone ? "三个角色都准备好了！" : "三个练习完成后，一起合作演奏"}</p>
      <button class="button primary" data-go="ensemble" ${allDone ? "" : "disabled"}>开始合作演奏</button>
      <button class="button ghost" data-action="preview-collaboration-work">先听完整作品</button>
    </div>
  </section>`;
}

function renderPoemScoreNote(note) {
  const octaveClass = note.octave < 0 ? "low" : note.octave > 0 ? "high" : "middle";
  return `<span class="poem-score-note ${octaveClass} ${jianpuDurationClass(note.duration)}"><span>${note.degree}</span></span>`;
}

function renderCollaborationSing() {
  const index = Math.max(0, Math.min(3, state.collaborationLineIndex));
  const measure = JINGYESI_SCORE.measures[index];
  const phrase = JINGYESI_SCORE.phrases[index];
  return `${topbar("合作表演 · 古诗演唱家")}<section class="screen collab-practice-screen role-sing-theme">
    <div class="collab-practice-heading"><img src="assets/stickers/performer-rabbit.png" alt="小兔"><div><p class="eyebrow">古诗演唱家练习</p><h2>看简谱，跟着小兔唱一句</h2><p>《静夜思》· 李白</p></div></div>
    <div class="collab-practice-card singing-practice-card">
      <div class="poem-score-meta"><span>${phrase.label} / 共 4 句</span><strong>1 = C · 4/4</strong></div>
      <div class="poem-score-row" aria-label="${phrase.label}简谱">${measure.notes.map(renderPoemScoreNote).join("")}<i class="poem-score-rest">停半拍</i></div>
      <div class="poem-lyric-row">${measure.notes.map(note => `<span>${escapeHtml(note.lyric)}</span>`).join("")}</div>
      <p class="poem-breath-cue">唱完这一句，轻轻换气</p>
      <div class="collab-practice-actions"><button class="button secondary" data-action="play-poem-line">听小兔唱一句</button><button class="button primary" data-action="play-poem-piano">跟着钢琴唱一句</button></div>
    </div>
    <div class="practice-navigation"><button class="button ghost" data-action="previous-poem-line" ${index === 0 ? "disabled" : ""}>← 上一句</button><div>${index + 1} / 4</div><button class="button ghost" data-action="next-poem-line" ${index === 3 ? "disabled" : ""}>下一句 →</button></div>
    <button class="button primary complete-role-button" data-action="complete-collab-role" data-role="sing">完成演唱练习，返回角色选择</button>
  </section>`;
}

function renderCollaborationBody() {
  const lesson = collaborationBodyLesson();
  loadBodyScore(lesson);
  const pattern = bodyDisplayPattern(lesson);
  const fullMixPlaying = state.playingSection !== null && state.poetryPreviewMode === "mix";
  const sequence = pattern.map((step, index) => {
    const action = BODY_ACTIONS[step.action];
    return `<div class="body-step ${index === state.collaborationActionIndex ? "active" : ""}" data-body-step="${index}"><strong>${action.syllable}</strong><small>${action.label}</small></div>`;
  }).join("");
  return `${topbar("合作表演 · 身体节奏家")}<section class="screen collab-practice-screen role-body-theme">
    <div class="collab-practice-heading"><img src="assets/stickers/states/performer-dog-clap.png" alt="小狗"><div><h2>用身体打节奏</h2><p>${grooves[lesson.groove].name} · ${moods[lesson.mood].name}</p></div></div>
    <div class="collab-practice-card body-collab-card">
      <div class="body-action-guide-frame" data-body-guide="${pattern[state.collaborationActionIndex]?.action || "dong"}" role="img" aria-label="小狗示范动作">
        <img class="body-action-guide body-guide-dong" src="${BODY_ACTION_GUIDE}" alt=""><img class="body-action-guide body-guide-ci" src="${BODY_ACTION_GUIDE}" alt=""><img class="body-action-guide body-guide-da" src="${BODY_ACTION_GUIDE}" alt="">
      </div>
      <div class="body-collab-content"><p class="body-syllable-line">${pattern.map(step => BODY_ACTIONS[step.action].syllable).join(" · ")}</p><div class="body-sequence">${sequence}</div></div>
      <div class="collab-practice-actions"><button class="button secondary" data-action="play-collab-body-slow">慢速看动作</button><button class="button primary" data-action="${fullMixPlaying ? "stop-poetry-preview" : "preview-poem-mix"}">${fullMixPlaying ? "暂停完整作品" : "跟音乐练习"}</button></div>
    </div>
    <button class="button primary complete-role-button" data-action="complete-collab-role" data-role="body">完成节奏练习，返回角色选择</button>
  </section>`;
}

function renderCollaborationMelody() {
  const gestureIds = state.collaborationGestureIds || JINGYESI_GESTURE_IDS;
  const index = Math.max(0, Math.min(gestureIds.length - 1, state.collaborationGestureIndex));
  const gesture = gestureById(gestureIds[index]);
  const fullMixPlaying = state.playingSection !== null && state.poetryPreviewMode === "mix";
  const thumbnails = gestureIds.map((id, gestureIndex) => {
    const item = gestureById(id);
    return `<button class="collab-gesture-thumb ${gestureIndex === index ? "active" : ""}" data-collab-gesture="${gestureIndex}"><span>第 ${gestureIndex + 1} 小节</span><img src="${item.image}" alt="${item.name}"></button>`;
  }).join("");
  const gestureChoices = gestureLibrary
    .filter(item => item.scope === "universal" || item.scope === "4/4")
    .map(item => `<button class="collab-gesture-choice ${item.id === gesture.id ? "active" : ""}" data-collab-gesture-choice="${item.id}" data-collab-gesture-index="${index}"><img src="${item.image}" alt="${item.name}"><span>${item.name}</span></button>`)
    .join("");
  return `${topbar("合作表演 · 旋律指挥家")}<section class="screen collab-practice-screen role-melody-theme">
    <div class="collab-practice-heading"><img src="assets/stickers/performer-cat-gesture.png" alt="小猫"><div><h2>跟着小猫画旋律</h2></div></div>
    <div class="collab-practice-card melody-collab-card">
      <div class="active-gesture-card"><span>第 ${index + 1} 小节 · ${gesture.name}</span><img src="${gesture.image}" alt="${gesture.label}"><p>${gesture.label}</p><button class="button ghost gesture-change-button" data-action="toggle-collab-gesture-picker">${state.collaborationGesturePickerOpen ? "收起手势" : fullMixPlaying ? "停止播放并更换手势" : "换一个手势"}</button></div>
      ${state.collaborationGesturePickerOpen ? `<div class="collab-gesture-picker"><strong>为第 ${index + 1} 小节选择手势</strong><div>${gestureChoices}</div><p>点一下就会自动保存</p></div>` : ""}
      <div class="collab-gesture-strip">${thumbnails}</div>
      <div class="collab-practice-actions"><button class="button secondary" data-action="previous-collab-gesture" ${index === 0 ? "disabled" : ""}>← 上一小节</button><button class="button primary" data-action="${fullMixPlaying ? "stop-poetry-preview" : "preview-collab-full-mix"}">${fullMixPlaying ? "暂停完整作品" : "跟音乐画一遍"}</button><button class="button secondary" data-action="next-collab-gesture" ${index === gestureIds.length - 1 ? "disabled" : ""}>下一小节 →</button></div>
    </div>
    <button class="button primary complete-role-button" data-action="complete-collab-role" data-role="melody">完成旋律练习，返回角色选择</button>
  </section>`;
}

function collaborationLyricForBar(bar) {
  if (bar < 2) return { label: "两小节前奏", lyric: "准备开口" };
  if (bar < 6) return { label: `第 ${bar - 1} 句`, lyric: JINGYESI_SCORE.phrases[bar - 2].lyrics };
  return { label: "两小节尾奏", lyric: "听音乐，保持结束动作" };
}

function renderEnsemble() {
  const bar = Math.max(0, Math.min(7, state.collaborationBar));
  const lyric = collaborationLyricForBar(bar);
  const lesson = collaborationBodyLesson();
  const pattern = bodyDisplayPattern(lesson);
  const gestureIds = state.collaborationGestureIds || JINGYESI_GESTURE_IDS;
  const gesture = gestureById(gestureIds[bar]);
  const windowStart = Math.floor(bar / 4) * 4;
  const gestureStrip = gestureIds.slice(windowStart, windowStart + 4).map((id, index) => {
    const measureIndex = windowStart + index;
    const item = gestureById(id);
    return `<div class="ensemble-gesture-thumb ${measureIndex === bar ? "active" : ""}"><img src="${item.image}" alt=""><span>第 ${measureIndex + 1} 小节</span></div>`;
  }).join("");
  const playing = state.playingSection !== null;
  return `${topbar("合作表演 · 集体演奏")}<section class="screen ensemble-screen">
    <div class="ensemble-heading"><div><p class="eyebrow">三个角色已经准备好</p><h2>一起合作演奏吧</h2><p>《静夜思》· 我的想念音乐</p></div><div class="ensemble-countdown">${state.collaborationCountdown ? `准备 ${state.collaborationCountdown}` : playing ? `第 ${bar + 1} 小节` : state.collaborationDone ? "演奏完成" : "准备 4 · 3 · 2 · 1"}</div></div>
    <div class="ensemble-score">
      <section class="ensemble-lane ensemble-sing-lane"><img src="assets/stickers/performer-rabbit.png" alt="小兔"><div class="ensemble-role-label"><strong>古诗演唱家</strong><span>${lyric.label}</span></div><p>${lyric.lyric}</p><small>${bar >= 2 && bar < 6 ? "句尾轻轻换气" : "跟着提示准备"}</small></section>
      <section class="ensemble-lane ensemble-body-lane"><img src="${dogStateAssets[pattern[state.collaborationActionIndex]?.action === "da" ? "clap" : pattern[state.collaborationActionIndex]?.action === "ci" ? "highFive" : "patThighs"]}" alt="小狗"><div class="ensemble-role-label"><strong>身体节奏家</strong><span>${grooves[lesson.groove].name}</span></div><div class="ensemble-body-actions">${pattern.map((step, index) => `<div class="${index === state.collaborationActionIndex && playing ? "active" : ""}"><b>${BODY_ACTIONS[step.action].syllable}</b><span>${BODY_ACTIONS[step.action].label}</span></div>`).join("")}</div></section>
      <section class="ensemble-lane ensemble-melody-lane"><img src="assets/stickers/performer-cat-gesture.png" alt="小猫"><div class="ensemble-role-label"><strong>旋律指挥家</strong><span>第 ${bar + 1} 小节</span></div><div class="ensemble-current-gesture"><img src="${gesture.image}" alt="${gesture.label}"><span>${gesture.label}</span></div></section>
      <div class="ensemble-gesture-window">${gestureStrip}</div>
    </div>
    <p class="ensemble-resource-note">旋律动作来自“感受 → 画旋律”的同一套逐小节手势资源。</p>
    <div class="button-row">${state.collaborationDone
      ? `<button class="button primary" data-action="start-collaboration-performance">再演一次</button><button class="button secondary" data-action="exchange-collaboration-roles">交换角色</button>`
      : `<button class="button primary" data-action="${playing || state.performancePreparing ? "stop-collaboration" : "start-collaboration-performance"}" ${state.performancePreparing ? "disabled" : ""}>${state.performancePreparing ? "准备中…" : playing ? "暂停演奏" : "开始合作演奏"}</button><button class="button secondary" data-go="collaboration">返回练习</button>`}</div>
  </section>`;
}

function renderPostcard() {
  const mood = moods[state.mood] || moods.miss;
  const titles = ["写给远方的星星", `${mood.name}的小乐队`, "五个朋友的歌"];
  const messages = [mood.postcardLine, "我最喜欢大家一起演奏的那一段。", "我想把这首音乐送给你。"];
  const safeTitle = escapeHtml(state.title);
  const safeMessage = escapeHtml(state.message);
  return `${topbar("作品完成")}<section class="screen">
    <div class="postcard">
      <div class="eyebrow">${mood.emoji} ${mood.name}音乐明信片</div>
      <h2>${safeTitle}</h2>
      ${band(state.playingSection !== null ? "playing" : "")}
      <div class="postcard-message">“${safeMessage}”</div>
      <button class="button secondary" data-action="${state.playingSection !== null ? "stop-composition" : "play-all"}">${state.playingSection !== null ? "Ⅱ 暂停播放" : "▶ 播放我的音乐"}</button>
      <p class="authorship">${state.voiceStickers.length ? "由我录制、选择与编排 · AI 提供音乐素材和混音帮助" : "由我选择与编排 · AI 提供音乐素材和混音帮助"}</p>
    </div>
    <div class="stage-card">
      <h3>给作品选个名字</h3><div class="choice-chips">${titles.map(title => `<button class="choice-chip ${state.title === title ? "selected" : ""}" data-title="${title}">${title}</button>`).join("")}</div>
      <div class="expression-prompt">
        ${avatarMarkup("rabbit", "expression-rabbit")}
        <div><h3>如果音乐会说话，它想说什么？</h3><p>选一句，或者自己说。老师和家长可以帮忙记下来。</p></div>
      </div>
      <div class="choice-chips">${messages.map(message => `<button class="choice-chip ${state.message === message ? "selected" : ""}" data-message="${message}">${message}</button>`).join("")}</div>
      <label class="message-label" for="postcard-message-input">我想自己说</label>
      <input id="postcard-message-input" class="message-input" data-message-input maxlength="50" value="${safeMessage}" placeholder="说一个词或一句话都可以">
    </div>
    <div class="button-row"><button class="button primary" data-action="save">${state.saved ? "✓ 已保存到我的明信片" : "保存到我的明信片"}</button><button class="button secondary" data-action="share">分享给家人朋友</button></div>
  </section>${renderModal()}`;
}

function renderPerform() {
  return `${topbar("一起演")}<section class="screen">
    <div class="hero"><p class="eyebrow">这里不会拍摄你</p><h2>跟着动物一起动起来</h2><p class="lead">先做一次示范，再给 4 拍准备。小狗拍手、小兔画旋律、小熊按和弦、小猫轻跺脚、小狮子吹一下。没有评分。</p></div>
    ${band(state.playingSection !== null ? "playing" : "")}
    ${bodyPattern()}
    <div class="actions"><button class="button primary" data-action="${state.playingSection !== null ? "stop-composition" : "play-performance"}" ${state.performancePreparing ? "disabled" : ""}>${state.performancePreparing ? "4 拍准备中…" : state.playingSection !== null ? "Ⅱ 暂停一起演" : "▶ 开始一起演"}</button><button class="button secondary" data-go="feel">回到感受课堂</button></div>
  </section>`;
}

function renderStage() {
  const sectionIndex = state.playingSection ?? state.stageSection;
  const activeAnimals = state.stageCompleted
    ? arrangementAnimals.filter(key => state.sections.some(section => section.includes(key)))
    : state.sections[sectionIndex];
  const visibleAnimals = [...new Set([...activeAnimals, ...state.stageLeaving])];
  const visibleCast = arrangementAnimals.filter(key => visibleAnimals.includes(key));
  const performers = visibleCast
    .map(key => `
      <div class="stage-character stage-${key} ${state.stageEntering.includes(key) ? "stage-enter" : ""} ${state.stageLeaving.includes(key) ? "stage-leave" : ""}" title="${animals[key].name} · ${animals[key].role}">
        ${performerMarkup(key, "stage-art")}
        <span class="stage-name">${animals[key].name}</span>
      </div>`).join("");
  return `<section class="stage-panel" aria-label="动物乐队舞台">
    <p class="stage-panel-label">舞台正在演出 · 时间轴决定谁上场</p>
    <div class="paper-theater mood-stage-${state.mood || "miss"}">
      <div class="curtain curtain-left"></div><div class="curtain curtain-right"></div>
      <div class="stage-banner">${state.stageCompleted ? "演奏完成 · 乐队合照" : `第 ${sectionIndex + 1} 段 · 正在演奏`}</div>
      <div class="stage-stars">✦　·　♪　·　✦</div>
      <div class="stage-floor"></div>
      <div class="stage-cast cast-count-${visibleCast.length}">${performers || `<div class="empty-stage-message">这一段请动物们休息</div>`}</div>
    </div>
  </section>`;
}

function renderModal() {
  if (!state.modal) return "";
  return `<div class="modal-backdrop" data-action="close-modal"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onclick="event.stopPropagation()">
    <div class="icon">🛡️</div><h2 id="modal-title">请一位家长或老师来帮忙</h2><p class="lead">${state.voiceStickers.length ? "这件作品包含儿童录音。分享前，请确认录音内容不含真实姓名、学校、住址或其他隐私。" : "作品现在只保存在这台设备上。分享前，请确认作品里没有真实姓名、学校或住址。"}</p>
    <div class="actions" style="margin:22px auto 0"><button class="button primary" data-action="adult-confirm">我已确认，模拟生成私密链接</button>${state.voiceStickers.length ? `<button class="button secondary" data-action="remove-voice-share">移除录音后再分享</button>` : ""}<button class="button secondary" data-action="close-modal">暂不分享</button></div>
  </div></div>`;
}

function bindEvents() {
  app.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => setScreen(button.dataset.go)));
  app.querySelectorAll("[data-phonk-section]").forEach(button => button.addEventListener("click", () => {
    stopPhonkPlayback();
    state.phonkSelectedSection = Number(button.dataset.phonkSection);
    render();
  }));
  app.querySelectorAll("[data-phonk-track]").forEach(button => button.addEventListener("click", () => {
    const [sectionIndex, key] = button.dataset.phonkTrack.split(":");
    const layers = state.phonkSections[Number(sectionIndex)]?.layers;
    if (layers && Object.hasOwn(layers, key)) layers[key] = !layers[key];
    render();
  }));
  app.querySelectorAll("[data-phonk-mode]").forEach(button => button.addEventListener("click", () => {
    stopPhonkPlayback();
    state.phonkPerformanceMode = button.dataset.phonkMode;
    state.phonkActiveSection = 0;
    render();
  }));
  app.querySelectorAll("[data-phonk-performance-section]").forEach(button => button.addEventListener("click", () => {
    stopPhonkPlayback();
    state.phonkActiveSection = Number(button.dataset.phonkPerformanceSection);
    render();
  }));
  app.querySelectorAll("[data-mood]").forEach(button => button.addEventListener("click", () => selectMood(button.dataset.mood)));
  app.querySelectorAll("[data-teacher-pack]").forEach(button => button.addEventListener("click", () => selectTeacherMusicPack(button.dataset.teacherPack)));
  app.querySelectorAll("[data-groove]").forEach(button => button.addEventListener("click", () => selectGroove(button.dataset.groove)));
  app.querySelectorAll("[data-body-groove]").forEach(button => button.addEventListener("click", () => selectBodyGroove(button.dataset.bodyGroove)));
  app.querySelectorAll("[data-rhythm-source]").forEach(button => button.addEventListener("click", () => {
    if (button.dataset.rhythmSource === "custom" && !state.bodyRecordings[currentPackId()]) return;
    stopMusicAudio();
    state.dogRhythmSource = button.dataset.rhythmSource;
    render();
  }));
  app.querySelectorAll("[data-feel-mode]").forEach(button => button.addEventListener("click", () => { state.feelMode = button.dataset.feelMode; render(); }));
  app.querySelectorAll("[data-solfege-mode]").forEach(button => button.addEventListener("click", () => { state.solfegeMode = button.dataset.solfegeMode; render(); }));
  app.querySelectorAll("[data-record-target]").forEach(button => button.addEventListener("click", () => {
    state.solfegeRecordTargetIndex = Number(button.dataset.recordTarget);
    render();
  }));
  app.querySelectorAll("[data-solfege-phrase]").forEach(button => button.addEventListener("click", () => {
    if (state.classPlaying) toggleClassPlayback();
    state.solfegePhraseIndex = Number(button.dataset.solfegePhrase);
    state.solfegeActiveNoteIndex = null;
    render();
  }));
  app.querySelectorAll("[data-solfege-note]").forEach(noteElement => {
    const preview = () => previewSelectedSolfegeNote(Number(noteElement.dataset.solfegeNote));
    noteElement.addEventListener("click", preview);
    noteElement.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      preview();
    });
  });
  app.querySelectorAll("[data-collab-gesture]").forEach(button => button.addEventListener("click", () => {
    playCollaborationFromBar(Number(button.dataset.collabGesture));
  }));
  app.querySelectorAll("[data-collab-gesture-choice]").forEach(button => button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    saveCollaborationGesture(Number(button.dataset.collabGestureIndex), button.dataset.collabGestureChoice);
  }));
  app.querySelectorAll("[data-speed]").forEach(button => button.addEventListener("click", () => { state.playbackRate = Number(button.dataset.speed); if (state.classPlaying) playClassSong(); else render(); }));
  const solfegeSpeed = app.querySelector("[data-solfege-speed]");
  solfegeSpeed?.addEventListener("input", () => {
    state.playbackRate = Number(solfegeSpeed.value);
    const output = app.querySelector("[data-solfege-speed-output]");
    const baseBpm = Number(solfegeSpeed.dataset.baseBpm) || 72;
    if (output) output.textContent = `${Math.round(baseBpm * state.playbackRate)} BPM`;
  });
  solfegeSpeed?.addEventListener("change", () => {
    if (!state.classPlaying) return;
    const fullLesson = state.solfegePlayingFull;
    toggleClassPlayback();
    playPublishedSolfegeLesson(fullLesson);
  });
  app.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", event => handleAction(button.dataset.action, button, event)));
  app.querySelectorAll("[data-delete-voice-id]").forEach(button => button.addEventListener("click", event => {
    event.stopPropagation();
    deleteVoiceSticker(button.dataset.deleteVoiceId);
  }));
  app.querySelectorAll("[data-version]").forEach(button => button.addEventListener("click", () => { state.version = button.dataset.version; render(); }));
  app.querySelectorAll("[data-title]").forEach(button => button.addEventListener("click", () => { state.title = button.dataset.title; render(); }));
  app.querySelectorAll("[data-message]").forEach(button => button.addEventListener("click", () => { state.message = button.dataset.message; render(); }));
  app.querySelectorAll("[data-edit-gesture]").forEach(button => button.addEventListener("click", () => {
    state.teacherEditing = { group: Number(button.dataset.group), slot: Number(button.dataset.slot) };
    render();
  }));
  app.querySelectorAll("[data-choose-gesture]").forEach(button => button.addEventListener("click", () => chooseTeacherGesture(button.dataset.chooseGesture)));
  const teacherFileInput = app.querySelector("[data-teacher-file]");
  teacherFileInput?.addEventListener("change", () => {
    const file = teacherFileInput.files?.[0];
    if (!file) return;
    if (teacherAudioPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(teacherAudioPreviewUrl);
    teacherAudioFile = file;
    teacherPreviewMarkedGroup = -1;
    teacherAudioPreviewUrl = URL.createObjectURL(file);
    state.teacherFileName = file.name;
    state.teacherPublished = false;
    render();
  });
  const scoreFileInput = app.querySelector("[data-score-file]");
  scoreFileInput?.addEventListener("change", () => {
    const file = scoreFileInput.files?.[0];
    if (!file) return;
    if (state.scoreImageUrl?.startsWith("blob:")) URL.revokeObjectURL(state.scoreImageUrl);
    teacherScoreFile = file;
    state.scoreImageUrl = URL.createObjectURL(file);
    state.scoreImageDataUrl = "";
    state.scoreFileName = file.name;
    state.scoreDraft = null;
    state.scoreError = "";
    state.scoreReviewMeasureIndex = 0;
    state.scoreConfirmedMeasures = {};
    state.scorePublished = false;
    render();
    fileAsDataUrl(file).then(dataUrl => {
      if (teacherScoreFile !== file) return;
      state.scoreImageDataUrl = dataUrl;
      persistScoreSession();
    }).catch(() => {});
  });
  app.querySelector("[data-score-title]")?.addEventListener("change", event => {
    if (state.scoreDraft) {
      state.scoreDraft.title = event.target.value.trim() || "未命名乐谱";
      persistScoreSession();
    }
  });
  app.querySelector("[data-score-tonic]")?.addEventListener("change", event => {
    if (!state.scoreDraft) return;
    state.scoreDraft.tonic = event.target.value;
    refreshScoreDerivedData(state.scoreDraft);
    state.scorePublished = false;
    render();
  });
  app.querySelector("[data-score-bpm]")?.addEventListener("change", event => {
    if (state.scoreDraft) {
      state.scoreDraft.bpm = Math.max(36, Math.min(180, Number(event.target.value) || 72));
      persistScoreSession();
    }
  });
  app.querySelectorAll("[data-score-pitch]").forEach(select => select.addEventListener("change", () => {
    const measureIndex = Number(select.dataset.measure);
    const note = state.scoreDraft?.measures?.[measureIndex]?.notes?.[Number(select.dataset.note)];
    if (!note) return;
    const [degree, octave] = select.value.split(":").map(Number);
    note.degree = degree;
    note.octave = degree === 0 ? 0 : octave;
    note.confidence = 1;
    invalidateScoreReviewGroup(measureIndex);
    refreshScoreDerivedData(state.scoreDraft);
    state.scorePublished = false;
    render();
  }));
  app.querySelectorAll("[data-score-duration]").forEach(select => select.addEventListener("change", () => {
    const measureIndex = Number(select.dataset.measure);
    const measure = state.scoreDraft?.measures?.[measureIndex];
    const note = measure?.notes?.[Number(select.dataset.note)];
    if (!measure || !note) return;
    note.duration = Number(select.value);
    note.confidence = 1;
    let beat = 0;
    measure.notes.forEach(item => {
      item.beat = beat;
      beat += item.duration;
    });
    invalidateScoreReviewGroup(measureIndex);
    refreshScoreDerivedData(state.scoreDraft);
    state.scorePublished = false;
    render();
  }));
  app.querySelectorAll("[data-score-delete-note]").forEach(button => button.addEventListener("click", () => {
    const measureIndex = Number(button.dataset.measure);
    const measure = state.scoreDraft?.measures?.[measureIndex];
    const noteIndex = Number(button.dataset.note);
    if (!measure?.notes?.[noteIndex]) return;
    invalidateScoreReviewGroup(measureIndex);
    measure.notes.splice(noteIndex, 1);
    let beat = 0;
    measure.notes.forEach(note => {
      note.beat = beat;
      beat += note.duration;
    });
    refreshScoreDerivedData(state.scoreDraft);
    state.scorePublished = false;
    render();
  }));
  app.querySelectorAll("[data-score-add-note]").forEach(button => button.addEventListener("click", () => {
    const measureIndex = Number(button.dataset.measure);
    const measure = state.scoreDraft?.measures?.[measureIndex];
    if (!measure) return;
    const previous = measure.notes.at(-1);
    measure.notes.push({
      degree: previous?.degree || 1,
      octave: previous?.octave || 0,
      beat: scoreMeasureBeatTotal(measure),
      duration: .5,
      lyric: "",
      phraseId: previous?.phraseId || "",
      confidence: 1
    });
    invalidateScoreReviewGroup(measureIndex);
    refreshScoreDerivedData(state.scoreDraft);
    state.scorePublished = false;
    render();
  }));
  app.querySelectorAll("[data-score-group-rhythm]").forEach(button => button.addEventListener("click", () => {
    const groupIndex = Number(button.dataset.group);
    const group = scoreReviewGroups(state.scoreDraft)[groupIndex];
    const entries = group ? scoreReviewGroupNotes(group) : [];
    const durations = button.dataset.scoreGroupRhythm.split(",").map(Number);
    if (!group || durations.length !== entries.length) return;
    entries.forEach((entry, index) => { entry.note.duration = durations[index]; });
    scoreReviewGroupMeasures(group).forEach(item => {
      let beat = 0;
      item.measure.notes.forEach(note => {
        note.beat = beat;
        note.confidence = 1;
        beat += note.duration;
      });
    });
    delete state.scoreConfirmedMeasures[groupIndex];
    refreshScoreDerivedData(state.scoreDraft);
    state.scorePublished = false;
    render();
  }));
  app.querySelectorAll("[data-score-rhythm]").forEach(button => button.addEventListener("click", () => {
    const measureIndex = Number(button.dataset.measure);
    const measure = state.scoreDraft?.measures?.[measureIndex];
    const durations = button.dataset.scoreRhythm.split(",").map(Number);
    if (!measure || durations.length !== measure.notes.length) return;
    let beat = 0;
    measure.notes.forEach((note, index) => {
      note.duration = durations[index];
      note.beat = beat;
      note.confidence = 1;
      beat += durations[index];
    });
    invalidateScoreReviewGroup(measureIndex);
    refreshScoreDerivedData(state.scoreDraft);
    state.scorePublished = false;
    render();
  }));
  app.querySelectorAll("[data-score-review-measure]").forEach(button => button.addEventListener("click", () => {
    state.scoreReviewMeasureIndex = Number(button.dataset.scoreReviewMeasure);
    render();
  }));
  app.querySelectorAll("[data-score-preview-measure]").forEach(button => button.addEventListener("click", () => {
    state.scoreReviewMeasureIndex = Number(button.dataset.scorePreviewMeasure);
    render();
  }));
  app.querySelectorAll("[data-score-lyric]").forEach(input => input.addEventListener("change", () => {
    const measureIndex = Number(input.dataset.measure);
    const note = state.scoreDraft?.measures?.[measureIndex]?.notes?.[Number(input.dataset.note)];
    if (!note) return;
    note.lyric = input.value;
    invalidateScoreReviewGroup(measureIndex);
    state.scorePublished = false;
    render();
  }));
  const teacherPreview = app.querySelector("[data-teacher-preview]");
  if (teacherPreview) {
    const syncTeacherPreview = () => updateTeacherPlaybackMarker(teacherPreview.currentTime, !teacherPreview.paused);
    let previewFrame = 0;
    const animateTeacherPreview = () => {
      syncTeacherPreview();
      if (!teacherPreview.paused && teacherPreview.isConnected) previewFrame = requestAnimationFrame(animateTeacherPreview);
    };
    teacherPreview.addEventListener("timeupdate", syncTeacherPreview);
    teacherPreview.addEventListener("play", () => {
      cancelAnimationFrame(previewFrame);
      animateTeacherPreview();
    });
    teacherPreview.addEventListener("pause", () => {
      cancelAnimationFrame(previewFrame);
      syncTeacherPreview();
    });
    teacherPreview.addEventListener("seeked", syncTeacherPreview);
    teacherPreview.addEventListener("loadedmetadata", syncTeacherPreview);
    syncTeacherPreview();
  }
  const messageInput = app.querySelector("[data-message-input]");
  messageInput?.addEventListener("input", () => {
    state.message = messageInput.value;
    const postcardMessage = app.querySelector(".postcard-message");
    if (postcardMessage) postcardMessage.textContent = `“${state.message || "说一个词也可以"}”`;
  });
  bindArrangement();
}

function activeGestureSlot(group, currentTime) {
  const timings = group.gestureIds.map((_, slotIndex) => gestureTiming(group, slotIndex));
  const found = timings.findIndex(timing => currentTime >= timing.start && currentTime < timing.end);
  if (found >= 0) return found;
  return currentTime < timings[0].start ? 0 : timings.length - 1;
}

function updateGestureBeatGuide(container, timing, currentTime, isPlaying) {
  const beats = timing.beatTimes || [];
  let activeBeat = -1;
  beats.forEach((beatTime, beatIndex) => {
    if (currentTime >= beatTime) activeBeat = beatIndex;
  });
  if (currentTime >= timing.end) activeBeat = beats.length;
  container.querySelectorAll("[data-gesture-beat]").forEach((dot, beatIndex) => {
    dot.classList.toggle("current", beatIndex === activeBeat);
    dot.classList.toggle("done", beatIndex < activeBeat);
  });
  const beatTime = beats[Math.min(activeBeat, beats.length - 1)];
  container.classList.toggle("beat-hit", Boolean(isPlaying && Number.isFinite(beatTime) && currentTime - beatTime < 0.14));
}

function updateTeacherPlaybackMarker(currentTime, isPlaying) {
  const groups = state.teacherAnalysis;
  if (!groups.length) return;
  let currentIndex = groups.findIndex(group => currentTime >= group.start && currentTime < group.end);
  groups.forEach((group, groupIndex) => {
    const card = app.querySelector(`[data-analysis-group="${groupIndex}"]`);
    if (!card) return;
    const progress = clamp((currentTime - group.start) / Math.max(0.01, group.end - group.start));
    const isCurrent = groupIndex === currentIndex;
    card.classList.toggle("playback-current", isCurrent);
    card.classList.toggle("playback-active", isCurrent && isPlaying);
    card.classList.toggle("playback-past", currentTime >= group.end);
    card.style.setProperty("--teacher-group-progress", `${progress * 100}%`);
    const activeSlot = activeGestureSlot(group, currentTime);
    card.querySelectorAll(".teacher-gesture-choice").forEach((choice, slotIndex) => {
      choice.classList.toggle("playback-current-gesture", isCurrent && slotIndex === activeSlot);
      updateGestureBeatGuide(choice, gestureTiming(group, slotIndex), currentTime, isCurrent && isPlaying && slotIndex === activeSlot);
    });
  });
  if (isPlaying && currentIndex >= 0 && currentIndex !== teacherPreviewMarkedGroup) {
    teacherPreviewMarkedGroup = currentIndex;
    app.querySelector(`[data-analysis-group="${currentIndex}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  } else if (currentIndex < 0) {
    teacherPreviewMarkedGroup = -1;
  }
}

function locateTeacherGroup(groupIndex) {
  const group = state.teacherAnalysis[groupIndex];
  const preview = app.querySelector("[data-teacher-preview]");
  if (!group || !preview) return;
  preview.currentTime = Math.max(0, group.start);
  updateTeacherPlaybackMarker(preview.currentTime, true);
  const playback = preview.play();
  playback?.catch(() => showToast(`已定位到${formatBarRange(group.bars)}，点击播放器开始试听。`));
}

async function playSwanMelody() {
  if (state.classPlaying) {
    const pausedAt = activeSwanAudio?.currentTime;
    cancelAnimationFrame(activeSwanFrame);
    activeSwanFrame = null;
    activeSwanAudio?.pause();
    activeSwanAudio = null;
    state.swanPausedAt = Number.isFinite(pausedAt) ? pausedAt : null;
    state.classPlaying = false;
    render();
    if (state.swanPausedAt !== null) updateClassGestureMarker(state.swanPausedAt);
    return;
  }
  await preloadSwanGestureImages();
  const lessonStart = state.publishedLessonStart || 0;
  const lessonEnd = state.publishedLessonEnd || CARMEN_EXCERPT_SECONDS;
  const lessonDuration = Math.max(0.1, lessonEnd - lessonStart);
  const resumeAt = state.swanPausedAt !== null ? clamp(state.swanPausedAt, lessonStart, lessonEnd) : lessonStart;
  // The audio element reports 0 briefly before it has sought to lessonStart.
  // Keep the first gesture visible during that short setup period.
  state.swanSection = Math.max(0, state.publishedTeacherAnalysis.findIndex(group => resumeAt >= group.start && resumeAt < group.end));
  state.swanProgress = clamp((resumeAt - lessonStart) / lessonDuration);
  state.swanPausedAt = null;
  state.classPlaying = true;
  render();
  updateClassGestureMarker(resumeAt);

  activeSwanAudio = new Audio(state.publishedLessonAudioUrl || CARMEN_AUDIO);
  activeSwanAudio.preload = "auto";
  activeSwanAudio.volume = 0.9;
  const animate = () => {
    if (!state.classPlaying || !activeSwanAudio) return;
    state.swanProgress = Math.min(1, Math.max(0, (activeSwanAudio.currentTime - lessonStart) / lessonDuration));
    const foundSection = state.publishedTeacherAnalysis.findIndex(group => activeSwanAudio.currentTime >= group.start && activeSwanAudio.currentTime < group.end);
    const nextSection = foundSection < 0
      ? (activeSwanAudio.currentTime < lessonStart ? 0 : state.publishedTeacherAnalysis.length - 1)
      : foundSection;
    if (nextSection !== state.swanSection) {
      state.swanSection = nextSection;
      updateSwanSectionView(nextSection);
    }
    updateClassGestureMarker(activeSwanAudio.currentTime);
    if (state.swanProgress >= 1) {
      stopSwanMelody();
      state.swanProgress = 1;
      state.swanSection = state.publishedTeacherAnalysis.length - 1;
      render();
      showToast("手势活动完成了，再跟着演一次吧。");
    } else {
      activeSwanFrame = requestAnimationFrame(animate);
    }
  };
  const begin = () => {
    if (!activeSwanAudio) return;
    activeSwanAudio.currentTime = resumeAt;
    activeSwanAudio.play().then(() => {
      activeSwanFrame = requestAnimationFrame(animate);
    }).catch(() => {
      stopSwanMelody({ reset: true });
      render();
      showToast("音乐没有成功播放，请再点一次开始。");
    });
  };
  if (activeSwanAudio.readyState >= 1) begin();
  else activeSwanAudio.addEventListener("loadedmetadata", begin, { once: true });
}

function updateClassGestureMarker(currentTime) {
  const group = state.publishedTeacherAnalysis[state.swanSection];
  if (!group) return;
  const progress = clamp((currentTime - group.start) / Math.max(0.01, group.end - group.start));
  const activeSlot = activeGestureSlot(group, currentTime);
  app.querySelectorAll(".swan-measure-grid.is-active [data-class-gesture]").forEach((card, slotIndex) => {
    const isCurrent = slotIndex === activeSlot;
    const timing = gestureTiming(group, slotIndex);
    card.classList.toggle("current-gesture", isCurrent);
    const localProgress = clamp((currentTime - timing.start) / Math.max(0.01, timing.end - timing.start));
    card.style.setProperty("--swan-gesture-progress", isCurrent ? `${localProgress * 100}%` : activeSlot > slotIndex ? "100%" : "0%");
    updateGestureMotion(card, timing, currentTime, isCurrent && state.classPlaying);
    updateGestureBeatGuide(card, timing, currentTime, isCurrent && state.classPlaying);
  });
}

function gesturePathLandmarks(gestureId, path) {
  const motion = GESTURE_MOTION_PATHS[gestureId] || GESTURE_MOTION_PATHS.hold;
  if (!motion.points?.length || !path || typeof path.getTotalLength !== "function") {
    return motion.landmarks || [0, 1];
  }
  if (path._gestureLandmarkFractions) return path._gestureLandmarkFractions;
  const totalLength = path.getTotalLength();
  const sampleCount = 720;
  const fractions = motion.points.map(([targetX, targetY]) => {
    let nearestLength = 0;
    let nearestDistance = Infinity;
    for (let sample = 0; sample <= sampleCount; sample += 1) {
      const length = totalLength * sample / sampleCount;
      const point = path.getPointAtLength(length);
      const distance = (point.x - targetX) ** 2 + (point.y - targetY) ** 2;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestLength = length;
      }
    }
    return nearestLength / Math.max(1, totalLength);
  });
  fractions[0] = 0;
  fractions[fractions.length - 1] = 1;
  for (let index = 1; index < fractions.length; index += 1) {
    fractions[index] = Math.max(fractions[index - 1], fractions[index]);
  }
  path._gestureLandmarkFractions = fractions;
  return fractions;
}

function gestureMotionStops(gestureId, beatCount, path) {
  const landmarks = gesturePathLandmarks(gestureId, path);
  const count = Math.max(1, beatCount);
  return Array.from({ length: count + 1 }, (_, index) => {
    const position = index * (landmarks.length - 1) / count;
    const lower = Math.floor(position);
    const upper = Math.min(landmarks.length - 1, Math.ceil(position));
    const fraction = position - lower;
    return landmarks[lower] + (landmarks[upper] - landmarks[lower]) * fraction;
  });
}

function gestureMotionProgress(gestureId, timing, currentTime, path) {
  const beatStarts = (timing.beatTimes || []).filter(time => time > timing.start && time < timing.end);
  const boundaries = [timing.start, ...beatStarts, timing.end];
  const stops = gestureMotionStops(gestureId, boundaries.length - 1, path);
  const time = clamp(currentTime, timing.start, timing.end);
  let segment = boundaries.length - 2;
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    if (time <= boundaries[index + 1]) { segment = index; break; }
  }
  const duration = Math.max(.001, boundaries[segment + 1] - boundaries[segment]);
  const local = clamp((time - boundaries[segment]) / duration);
  return stops[segment] + (stops[segment + 1] - stops[segment]) * local;
}

function setGestureMotionDot(svg, progress, visible) {
  const path = svg?.querySelector("[data-gesture-motion-path]");
  if (!path || typeof path.getTotalLength !== "function") return;
  const point = path.getPointAtLength(path.getTotalLength() * clamp(progress));
  svg.querySelectorAll("[data-gesture-motion-dot]").forEach(dot => {
    dot.setAttribute("cx", point.x);
    dot.setAttribute("cy", point.y);
  });
  svg.classList.toggle("motion-active", visible);
  svg.classList.add("motion-ready");
}

function initializeGestureMotionDots() {
  app.querySelectorAll("[data-gesture-motion]").forEach(svg => setGestureMotionDot(svg, 0, false));
}

function updateGestureMotion(card, timing, currentTime, visible) {
  const svg = card.querySelector("[data-gesture-motion]");
  if (!svg) return;
  const path = svg.querySelector("[data-gesture-motion-path]");
  const gestureId = svg.dataset.gestureMotion;
  const progress = gestureMotionProgress(gestureId, timing, currentTime, path);
  setGestureMotionDot(svg, progress, visible);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function deviation(values) {
  const center = average(values);
  return Math.sqrt(average(values.map(value => (value - center) ** 2)));
}

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function buildEnergyEnvelope(audioBuffer, framesPerSecond = 50) {
  const frameSize = Math.max(1, Math.floor(audioBuffer.sampleRate / framesPerSecond));
  const frameCount = Math.floor(audioBuffer.length / frameSize);
  const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) => audioBuffer.getChannelData(index));
  const rms = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * frameSize;
    const end = Math.min(audioBuffer.length, start + frameSize);
    let sum = 0;
    let samples = 0;
    for (let sample = start; sample < end; sample += 4) {
      let mono = 0;
      channels.forEach(channel => { mono += channel[sample] || 0; });
      mono /= channels.length;
      sum += mono * mono;
      samples += 1;
    }
    rms[frame] = Math.sqrt(sum / Math.max(1, samples));
  }
  const onset = new Float32Array(frameCount);
  for (let index = 1; index < frameCount; index += 1) onset[index] = Math.max(0, rms[index] - rms[index - 1] * 0.96);
  let scale = 0.000001;
  for (let index = 0; index < onset.length; index += 1) scale = Math.max(scale, onset[index]);
  for (let index = 0; index < onset.length; index += 1) onset[index] /= scale;
  const sortedRms = Array.from(rms).sort((left, right) => left - right);
  const strongLevel = sortedRms[Math.floor(sortedRms.length * 0.95)] || 0;
  const quietLevel = sortedRms[Math.floor(sortedRms.length * 0.2)] || 0;
  // 只有远低于全曲强奏的底部能量才视为环境底噪，避免把管弦乐弱奏误判成静音。
  const noiseThreshold = quietLevel < strongLevel * 0.12 ? quietLevel * 2.4 : 0;
  const activityThreshold = Math.max(0.00008, strongLevel * 0.018, noiseThreshold);
  let firstActiveFrame = 0;
  let lastActiveFrame = rms.length - 1;
  while (firstActiveFrame < rms.length && rms[firstActiveFrame] < activityThreshold) firstActiveFrame += 1;
  while (lastActiveFrame >= firstActiveFrame && rms[lastActiveFrame] < activityThreshold) lastActiveFrame -= 1;
  const contentStart = firstActiveFrame < rms.length ? firstActiveFrame / framesPerSecond : 0;
  const contentEnd = lastActiveFrame >= firstActiveFrame ? (lastActiveFrame + 1) / framesPerSecond : 0;
  return { rms, onset, framesPerSecond, activityThreshold, contentStart, contentEnd };
}

function estimateTempo(onset, framesPerSecond) {
  let best = { bpm: 90, score: -Infinity, lag: Math.round(framesPerSecond * 60 / 90) };
  let secondScore = -Infinity;
  for (let bpm = 54; bpm <= 176; bpm += 1) {
    const lag = Math.round(framesPerSecond * 60 / bpm);
    let dot = 0;
    let left = 0;
    let right = 0;
    for (let index = lag; index < onset.length; index += 1) {
      dot += onset[index] * onset[index - lag];
      left += onset[index] ** 2;
      right += onset[index - lag] ** 2;
    }
    const normalized = dot / Math.sqrt(Math.max(0.000001, left * right));
    const tempoPrior = 1 - Math.min(0.12, Math.abs(bpm - 96) / 900);
    const score = normalized * tempoPrior;
    if (score > best.score) {
      secondScore = best.score;
      best = { bpm, score, lag };
    } else if (score > secondScore) secondScore = score;
  }
  const confidence = clamp(0.45 + Math.max(0, best.score - secondScore) * 3 + best.score * 0.25, 0.35, 0.94);
  return { ...best, confidence };
}

function estimateBeatGrid(onset, framesPerSecond, tempo, contentStart = 0) {
  const lag = tempo.lag;
  let bestPhase = 0;
  let bestPhaseScore = -Infinity;
  for (let phase = 0; phase < lag; phase += 1) {
    let score = 0;
    let count = 0;
    for (let index = phase; index < onset.length; index += lag) {
      score += onset[index];
      count += 1;
    }
    score /= Math.max(1, count);
    if (score > bestPhaseScore) {
      bestPhaseScore = score;
      bestPhase = phase;
    }
  }
  const strengths = [];
  for (let index = bestPhase; index < onset.length; index += lag) strengths.push(onset[index]);
  const spread = deviation(strengths) || 0.001;
  const normalizedAutocorrelation = correlationLag => {
    let dot = 0;
    let left = 0;
    let right = 0;
    for (let index = correlationLag; index < onset.length; index += 1) {
      dot += onset[index] * onset[index - correlationLag];
      left += onset[index] ** 2;
      right += onset[index - correlationLag] ** 2;
    }
    return dot / Math.sqrt(Math.max(0.000001, left * right));
  };
  const meterCandidates = [];
  [{ beats: 3, pulses: 3 }, { beats: 4, pulses: 4 }, { beats: 6, pulses: 2 }].forEach(({ beats, pulses }) => {
    let bestForMeter = { beats, pulses, offset: 0, score: -Infinity };
    for (let offset = 0; offset < pulses; offset += 1) {
      const down = strengths.filter((_, index) => index % pulses === offset);
      const others = strengths.filter((_, index) => index % pulses !== offset);
      const contrast = (average(down) - average(others)) / spread;
      let repeat = 0;
      for (let index = pulses; index < strengths.length; index += 1) repeat += strengths[index] * strengths[index - pulses];
      repeat /= Math.max(1, strengths.length - pulses);
      const downRegularity = clamp(1 - deviation(down) / Math.max(0.05, average(down)));
      const barPeriodicity = normalizedAutocorrelation(lag * pulses);
      const profile = Array.from({ length: pulses }, (_, position) => average(strengths.filter((_, index) => index % pulses === position)));
      const secondaryPosition = (offset + (beats === 6 ? 1 : 2)) % pulses;
      const secondaryWeak = profile.filter((_, position) => position !== offset && position !== secondaryPosition);
      const secondaryBaseline = secondaryWeak.length ? average(secondaryWeak) : average(strengths);
      const secondaryAccent = (profile[secondaryPosition] - secondaryBaseline) / spread;
      const primaryDominance = (profile[offset] - profile[secondaryPosition]) / spread;
      const windowContrasts = [];
      const windowSize = pulses * 4;
      const windowStep = pulses * 2;
      for (let start = 0; start + pulses * 2 <= strengths.length; start += windowStep) {
        const slice = strengths.slice(start, Math.min(strengths.length, start + windowSize));
        const localSpread = deviation(slice) || 0.001;
        const localDown = slice.filter((_, localIndex) => (start + localIndex) % pulses === offset);
        const localOthers = slice.filter((_, localIndex) => (start + localIndex) % pulses !== offset);
        windowContrasts.push((average(localDown) - average(localOthers)) / localSpread);
      }
      const windowAgreement = median(windowContrasts);
      const enoughBars = Math.min(1, strengths.length / Math.max(1, pulses * 4));
      const prior = beats === 4 ? 0.025 : beats === 3 ? 0.018 : -0.09;
      const compoundAccent = beats === 6
        ? Math.max(0, secondaryAccent) * 0.07 + Math.max(-0.2, primaryDominance) * 0.16
        : beats === 4 ? secondaryAccent * 0.05 : 0;
      const score = (contrast * 0.44 + windowAgreement * 0.26 + repeat * 0.25 + barPeriodicity * 0.42 + downRegularity * 0.1 + compoundAccent + prior) * enoughBars;
      if (score > bestForMeter.score) bestForMeter = { beats, pulses, offset, score, contrast, windowAgreement, repeat, barPeriodicity, downRegularity, secondaryAccent, primaryDominance };
    }
    meterCandidates.push(bestForMeter);
  });
  meterCandidates.sort((left, right) => right.score - left.score);
  const bestMeter = meterCandidates[0];
  const scale = Math.max(0.25, deviation(meterCandidates.map(candidate => candidate.score)));
  const weights = meterCandidates.map(candidate => Math.exp((candidate.score - bestMeter.score) / scale));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const alternatives = meterCandidates.map((candidate, index) => ({ meter: candidate.beats, confidence: weights[index] / totalWeight, score: candidate.score }));
  const meterConfidence = alternatives[0].confidence;
  const beatDuration = 60 / tempo.bpm;
  const firstBeat = bestPhase / framesPerSecond;
  const measureDuration = bestMeter.pulses * beatDuration;
  let firstDownbeat = firstBeat + bestMeter.offset * beatDuration;
  if (contentStart > firstDownbeat) {
    firstDownbeat += Math.floor((contentStart - firstDownbeat) / measureDuration) * measureDuration;
  }
  while (firstDownbeat < contentStart - beatDuration * 0.35) firstDownbeat += measureDuration;
  return {
    meter: bestMeter.beats,
    beatsPerMeasure: bestMeter.pulses,
    firstDownbeat,
    beatDuration,
    meterConfidence,
    meterAlternatives: alternatives,
    confidence: clamp(tempo.confidence * 0.58 + meterConfidence * 0.42, 0.28, 0.96)
  };
}

function resolveTempoAndGrid(energy) {
  const tempo = estimateTempo(energy.onset, energy.framesPerSecond);
  return { tempo, grid: estimateBeatGrid(energy.onset, energy.framesPerSecond, tempo, energy.contentStart) };
}

function snapToNearbyOnset(onset, framesPerSecond, predictedTime, searchRadius) {
  const center = Math.round(predictedTime * framesPerSecond);
  const radius = Math.max(1, Math.round(searchRadius * framesPerSecond));
  const from = Math.max(1, center - radius);
  const to = Math.min(onset.length - 2, center + radius);
  let bestIndex = center;
  let bestStrength = 0;
  let bestScore = -Infinity;
  for (let index = from; index <= to; index += 1) {
    if (onset[index] < onset[index - 1] || onset[index] < onset[index + 1]) continue;
    const proximity = 1 - Math.abs(index - center) / Math.max(1, radius);
    const score = onset[index] * 0.78 + proximity * 0.22;
    if (score > bestScore) {
      bestScore = score;
      bestStrength = onset[index];
      bestIndex = index;
    }
  }
  return bestStrength >= 0.08 ? bestIndex / framesPerSecond : predictedTime;
}

function buildAdaptiveBeatTimeline(energy, grid, duration) {
  const baseDuration = grid.beatDuration;
  let beatDuration = baseDuration;
  let current = snapToNearbyOnset(energy.onset, energy.framesPerSecond, grid.firstDownbeat, baseDuration * 0.24);
  const beatTimes = [];
  while (current <= duration + baseDuration && beatTimes.length < 4096) {
    beatTimes.push(current);
    const predicted = current + beatDuration;
    const snapped = snapToNearbyOnset(energy.onset, energy.framesPerSecond, predicted, beatDuration * 0.2);
    const observedDuration = snapped - current;
    const usable = observedDuration >= baseDuration * 0.78 && observedDuration <= baseDuration * 1.22;
    current = usable ? snapped : predicted;
    if (usable) beatDuration = clamp(beatDuration * 0.82 + observedDuration * 0.18, baseDuration * 0.86, baseDuration * 1.14);
  }
  return beatTimes;
}

function buildAdaptiveMeasures(energy, grid, duration) {
  const beatTimes = buildAdaptiveBeatTimeline(energy, grid, duration);
  const measures = [];
  for (let beatIndex = 0; beatIndex + grid.beatsPerMeasure < beatTimes.length; beatIndex += grid.beatsPerMeasure) {
    const start = beatTimes[beatIndex];
    const end = beatTimes[beatIndex + grid.beatsPerMeasure];
    if (end > duration + 0.04) break;
    measures.push({
      start,
      end,
      beatTimes: beatTimes.slice(beatIndex, beatIndex + grid.beatsPerMeasure)
    });
  }
  return { beatTimes, measures };
}

function meterLabel(beats) {
  return beats === 6 ? "6/8" : `${beats}/4`;
}

function downsampleAudio(audioBuffer, targetRate = 4000) {
  const length = Math.floor(audioBuffer.duration * targetRate);
  const mono = new Float32Array(length);
  const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) => audioBuffer.getChannelData(index));
  const ratio = audioBuffer.sampleRate / targetRate;
  for (let index = 0; index < length; index += 1) {
    const sourceIndex = Math.min(audioBuffer.length - 1, Math.floor(index * ratio));
    let value = 0;
    channels.forEach(channel => { value += channel[sourceIndex] || 0; });
    mono[index] = value / channels.length;
  }
  return { mono, sampleRate: targetRate };
}

function estimatePitchAt(mono, sampleRate, time) {
  const size = Math.floor(sampleRate * 0.11);
  const center = Math.floor(time * sampleRate);
  const start = Math.max(0, Math.min(mono.length - size, center - Math.floor(size / 2)));
  if (start < 0 || start + size > mono.length) return null;
  let mean = 0;
  for (let index = 0; index < size; index += 1) mean += mono[start + index];
  mean /= size;
  let energy = 0;
  for (let index = 0; index < size; index += 1) energy += (mono[start + index] - mean) ** 2;
  if (energy / size < 0.000002) return null;
  let bestLag = 0;
  let bestCorrelation = 0;
  const minimumLag = Math.floor(sampleRate / 500);
  const maximumLag = Math.floor(sampleRate / 55);
  for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
    let dot = 0;
    let left = 0;
    let right = 0;
    for (let index = 0; index < size - lag; index += 2) {
      const a = mono[start + index] - mean;
      const b = mono[start + index + lag] - mean;
      dot += a * b;
      left += a * a;
      right += b * b;
    }
    const correlation = dot / Math.sqrt(Math.max(0.000001, left * right));
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }
  if (bestCorrelation < 0.28 || !bestLag) return null;
  const frequency = sampleRate / bestLag;
  return 69 + 12 * Math.log2(frequency / 440);
}

function smoothSeries(values) {
  return values.map((value, index) => {
    const neighbors = values.slice(Math.max(0, index - 1), Math.min(values.length, index + 2)).filter(Number.isFinite);
    return neighbors.length ? average(neighbors) : value;
  });
}

function onsetPeaks(onset, framesPerSecond, start, end) {
  const from = Math.max(1, Math.floor(start * framesPerSecond));
  const to = Math.min(onset.length - 1, Math.ceil(end * framesPerSecond));
  const slice = Array.from(onset.slice(from, to));
  const threshold = average(slice) + deviation(slice) * 0.55;
  const peaks = [];
  for (let index = from + 1; index < to - 1; index += 1) {
    if (onset[index] > threshold && onset[index] >= onset[index - 1] && onset[index] > onset[index + 1]) peaks.push(index / framesPerSecond);
  }
  return peaks;
}

function analyzeMeasure(index, start, end, pitchData, energyData, meter, beatTimes = []) {
  const sampleTimes = Array.from({ length: 12 }, (_, sample) => start + (sample + 0.5) * (end - start) / 12);
  const rawPitch = sampleTimes.map(time => estimatePitchAt(pitchData.mono, pitchData.sampleRate, time));
  const valid = rawPitch.filter(Number.isFinite);
  const fallback = valid.length ? average(valid) : 60;
  const pitch = smoothSeries(rawPitch.map(value => Number.isFinite(value) ? value : fallback));
  const differences = pitch.slice(1).map((value, pitchIndex) => value - pitch[pitchIndex]);
  const netPitchChange = pitch[pitch.length - 1] - pitch[0];
  let previousDirection = 0;
  let turningPoints = 0;
  differences.forEach(change => {
    const direction = Math.abs(change) < 0.45 ? 0 : Math.sign(change);
    if (direction && previousDirection && direction !== previousDirection) turningPoints += 1;
    if (direction) previousDirection = direction;
  });
  const firstDirection = differences.find(change => Math.abs(change) >= 0.45) || 0;
  const stableChanges = differences.filter(change => Math.abs(change) < 0.5).length;
  const sustainRatio = stableChanges / Math.max(1, differences.length);
  const endingChanges = differences.slice(-4);
  const endingSustainRatio = endingChanges.filter(change => Math.abs(change) < 0.45).length / Math.max(1, endingChanges.length);
  const peaks = onsetPeaks(energyData.onset, energyData.framesPerSecond, start, end);
  const energyFrom = Math.max(0, Math.floor(start * energyData.framesPerSecond));
  const energyTo = Math.min(energyData.rms.length, Math.ceil(end * energyData.framesPerSecond));
  const measureEnergy = Array.from(energyData.rms.slice(energyFrom, energyTo));
  const peakEnergy = measureEnergy.length ? Math.max(...measureEnergy) : 0;
  const activeFrameRatio = measureEnergy.filter(value => value >= energyData.activityThreshold).length / Math.max(1, measureEnergy.length);
  const isSilent = peakEnergy < energyData.activityThreshold * 1.15 && activeFrameRatio < 0.08;
  const intervals = peaks.slice(1).map((time, peakIndex) => time - peaks[peakIndex]);
  const rhythmRegularity = intervals.length >= 2 ? clamp(1 - deviation(intervals) / Math.max(0.05, average(intervals))) : 0.5;
  let contour = "flat";
  let pitchDirection = "steady";
  if (turningPoints >= 3) {
    contour = "wave";
    pitchDirection = "mixed";
  } else if (turningPoints >= 1 && firstDirection > 0 && Math.abs(netPitchChange) < 4) {
    contour = "arch";
    pitchDirection = "up_down";
  } else if (turningPoints >= 1 && firstDirection < 0 && Math.abs(netPitchChange) < 4) {
    contour = "valley";
    pitchDirection = "down_up";
  } else if (netPitchChange >= 2) {
    contour = "rise";
    pitchDirection = "up";
  } else if (netPitchChange <= -2) {
    contour = "fall";
    pitchDirection = "down";
  } else if (peaks.length >= Math.max(3, meter - 1)) contour = "pulse";
  const noteDensity = peaks.length <= 2 ? "sparse" : peaks.length >= meter + 2 ? "dense" : "medium";
  return {
    measureNumber: index + 1,
    start,
    end,
    beatTimes,
    isSilent,
    peakEnergy,
    activeFrameRatio,
    pitch,
    contour,
    pitchDirection,
    turningPoints,
    netPitchChange,
    sustainRatio,
    endingSustainRatio,
    accentCount: peaks.length,
    noteDensity,
    rhythmRegularity,
    endingPitchNearStartingPitch: Math.abs(netPitchChange) < 1.2,
    validPitchRatio: valid.length / rawPitch.length
  };
}

function contourSimilarity(left, right) {
  const leftCenter = average(left.pitch);
  const rightCenter = average(right.pitch);
  const difference = average(left.pitch.map((value, index) => Math.abs((value - leftCenter) - (right.pitch[index] - rightCenter))));
  const contourBonus = left.contour === right.contour ? 0.18 : 0;
  return clamp(Math.exp(-difference / 3.2) + contourBonus, 0, 1);
}

function boundaryContinuity(left, right, energyData) {
  const boundaryFrame = Math.round(left.end * energyData.framesPerSecond);
  const around = Array.from(energyData.rms.slice(Math.max(0, boundaryFrame - 3), Math.min(energyData.rms.length, boundaryFrame + 4)));
  const localEnergy = average(around);
  const overallEnergy = average(Array.from(energyData.rms)) || 0.001;
  const energyContinuity = clamp(localEnergy / overallEnergy, 0, 1);
  const pitchContinuity = clamp(1 - Math.abs(left.pitch[left.pitch.length - 1] - right.pitch[0]) / 8);
  return energyContinuity * 0.45 + pitchContinuity * 0.55;
}

function gestureForMeasure(measure, meter) {
  if (measure.isSilent) return "rest_line";
  if (measure.endingSustainRatio >= 0.6 && measure.accentCount >= 1) return "accent_hold";
  if (meter === 3) {
    const pitchRange = Math.max(...measure.pitch) - Math.min(...measure.pitch);
    if (measure.accentCount >= 3 && measure.rhythmRegularity >= 0.58) return "three_peaks";
    if (measure.endingPitchNearStartingPitch && measure.turningPoints >= 4) return "three_petal";
    if (measure.endingPitchNearStartingPitch && measure.turningPoints >= 2) return pitchRange >= 6 ? "spiral" : "infinity";
    if (measure.contour === "arch" || measure.contour === "valley") return "three_beat_sweep";
    if (measure.contour === "wave") return "waltz_sway";
  }
  if (measure.contour === "arch") return "arch";
  if (measure.contour === "valley") return "valley";
  if (measure.contour === "wave") return "wave";
  if (measure.contour === "rise") return measure.noteDensity === "sparse" && measure.turningPoints === 0 ? "rise" : meter === 3 ? "climb_arcs_three" : meter === 4 ? "climb_arcs" : "rise";
  if (measure.contour === "fall") return measure.noteDensity === "sparse" && measure.turningPoints === 0 ? "fall" : meter === 3 ? "descend_arcs_three" : meter === 4 ? "descend_arcs" : "fall";
  if (measure.contour === "pulse") return meter === 3 ? "three_peaks" : meter === 4 ? (measure.rhythmRegularity >= 0.62 ? "bounces" : "pulses") : "wave";
  if (measure.endingPitchNearStartingPitch && measure.turningPoints >= 2) return "circle";
  if (measure.accentCount >= Math.max(3, meter - 1) && measure.rhythmRegularity >= 0.65) return meter === 4 ? "square" : "triangle";
  return measure.sustainRatio >= 0.58 ? "hold" : meter === 3 ? "waltz_sway" : meter === 4 ? "bounces" : "wave";
}

function trimTrailingSilentMeasures(measures) {
  let end = measures.length;
  while (end > 0 && measures[end - 1].isSilent) end -= 1;
  return {
    measures: measures.slice(0, end),
    removedCount: measures.length - end
  };
}

function gesturePacingForMeasures(measures) {
  const secondsPerMeasure = average(measures.map(measure => measure.end - measure.start));
  const barsPerGesture = secondsPerMeasure < 3.2 ? 2 : 1;
  return {
    secondsPerMeasure,
    barsPerGesture,
    label: barsPerGesture === 2 ? "快速 · 2 小节完成 1 个手势" : "舒缓 · 1 小节完成 1 个手势"
  };
}

function gestureForFastPair(current, next, meter) {
  const currentGesture = gestureForMeasure(current, meter);
  const nextGesture = gestureForMeasure(next, meter);
  const combinedPitch = [...current.pitch, ...next.pitch];
  const phraseStart = average(combinedPitch.slice(0, 4));
  const phraseMiddle = average(combinedPitch.slice(9, 15));
  const phraseEnd = average(combinedPitch.slice(-4));
  const totalChange = phraseEnd - phraseStart;
  const returnDistance = Math.abs(totalChange);
  const pitchRange = Math.max(...combinedPitch) - Math.min(...combinedPitch);
  const turningPoints = current.turningPoints + next.turningPoints;
  const accentCount = current.accentCount + next.accentCount;
  const averageSustain = (current.sustainRatio + next.sustainRatio) / 2;
  const averageRegularity = (current.rhythmRegularity + next.rhythmRegularity) / 2;
  const roundedReturn = returnDistance <= 1.8 && turningPoints >= 2;

  if (averageSustain >= 0.7) return accentCount >= 2 ? "accent_hold" : "hold";
  if (next.endingSustainRatio >= 0.58) return accentCount >= 2 ? "accent_hold" : "hold";
  if (meter === 3) {
    // 三拍子先判断两小节是否形成完整乐句，再判断局部上行或下行。
    if (roundedReturn && turningPoints >= 5) return pitchRange >= 6 ? "spiral" : "three_petal";
    if (roundedReturn && pitchRange >= 5) return "circle";
    if (roundedReturn) return "infinity";
    if (phraseMiddle - Math.max(phraseStart, phraseEnd) >= 1.8) return "arch";
    if (Math.min(phraseStart, phraseEnd) - phraseMiddle >= 1.8) return "three_beat_sweep";
    if (accentCount >= 6 && averageRegularity >= 0.58) return "three_peaks";
    if (totalChange >= 4) return "climb_arcs_three";
    if (totalChange <= -4) return "descend_arcs_three";
    if (totalChange >= 2.2) return current.noteDensity === "sparse" && next.noteDensity === "sparse" ? "rise" : "climb_arcs_three";
    if (totalChange <= -2.2) return current.noteDensity === "sparse" && next.noteDensity === "sparse" ? "fall" : "descend_arcs_three";
    if (currentGesture === nextGesture) return currentGesture;
    if (turningPoints >= 6) return "three_petal";
    return "waltz_sway";
  }
  if (roundedReturn && pitchRange >= 5) return "circle";
  if (phraseMiddle - Math.max(phraseStart, phraseEnd) >= 1.5) return "arch";
  if (Math.min(phraseStart, phraseEnd) - phraseMiddle >= 1.5) return "valley";
  if (totalChange >= 3) return meter === 4 ? "climb_arcs" : "rise";
  if (totalChange <= -3) return meter === 4 ? "descend_arcs" : "fall";
  if (currentGesture === nextGesture) return currentGesture;
  if (turningPoints >= 4) return "wave";
  return current.accentCount + current.turningPoints >= next.accentCount + next.turningPoints ? currentGesture : nextGesture;
}

const gestureVariationFamilies = {
  wave: ["wave", "arch", "valley", "circle"],
  circle: ["circle", "infinity", "arch", "wave"],
  arch: ["arch", "wave", "circle"],
  valley: ["valley", "wave", "circle"],
  climb_arcs: ["climb_arcs", "rise", "arch"],
  rise: ["rise", "climb_arcs", "arch"],
  descend_arcs: ["descend_arcs", "fall", "valley"],
  fall: ["fall", "descend_arcs", "valley"],
  climb_arcs_three: ["climb_arcs_three", "rise", "waltz_sway"],
  descend_arcs_three: ["descend_arcs_three", "fall", "three_beat_sweep"],
  hold: ["hold", "accent_hold", "wave"],
  accent_hold: ["accent_hold", "hold", "arch"],
  bounces: ["bounces", "pulses", "square", "triangle"],
  pulses: ["pulses", "bounces", "triangle", "square"],
  waltz_sway: ["waltz_sway", "three_beat_sweep", "infinity", "three_petal"],
  three_beat_sweep: ["three_beat_sweep", "waltz_sway", "spiral", "infinity"],
  three_petal: ["three_petal", "infinity", "spiral", "three_peaks"],
  infinity: ["infinity", "spiral", "three_petal", "waltz_sway"],
  spiral: ["spiral", "infinity", "three_petal", "three_beat_sweep"],
  three_peaks: ["three_peaks", "triangle", "three_petal", "waltz_sway"]
};

function diversifyGestureSequence(groups) {
  let previousGesture = null;
  let sameGestureRun = 0;
  const recentlyUsed = [];
  groups.forEach((group, groupIndex) => {
    const primary = group.gestureIds[0];
    sameGestureRun = primary === previousGesture ? sameGestureRun + 1 : 1;
    if (sameGestureRun > 2 && gestureVariationFamilies[primary]) {
      const candidates = gestureVariationFamilies[primary];
      const alternate = candidates.find(candidate => candidate !== primary && !recentlyUsed.slice(-5).includes(candidate))
        || candidates[(groupIndex + 1) % candidates.length];
      group.gestureIds = group.gestureIds.map(gestureId => gestureId === primary ? alternate : gestureId);
      group.reason += ` 连续动作已达到两组，改用同类变化“${gestureById(alternate).name}”，避免重复疲劳。`;
      group.diversified = true;
      previousGesture = alternate;
      sameGestureRun = 1;
      recentlyUsed.push(alternate);
    } else {
      previousGesture = primary;
      recentlyUsed.push(primary);
    }
  });
  return groups;
}

function groupAnalyzedMeasures(measures, energyData, meter) {
  const groups = [];
  const pacing = gesturePacingForMeasures(measures);
  for (let index = 0; index < measures.length; index += 2) {
    const current = measures[index];
    const next = measures[index + 1];
    if (!next) {
      const gesture = gestureForMeasure(current, meter);
      groups.push({
        bars: [current.measureNumber, current.measureNumber],
        mode: current.isSilent ? "rest" : "merged",
        gestureIds: [gesture],
        reason: current.isSilent ? "这一小节是休止，用水平线表示声音停住。" : `最后一个完整小节单独呈现，匹配为${gestureById(gesture).name}。`,
        start: current.start,
        end: current.end,
        beatTimes: [...current.beatTimes],
        gestureTimings: [{ start: current.start, end: current.end, beatTimes: [...current.beatTimes] }],
        confidence: clamp(current.validPitchRatio * 0.65 + 0.25, 0.35, 0.93)
      });
      continue;
    }
    const currentGesture = gestureForMeasure(current, meter);
    const nextGesture = gestureForMeasure(next, meter);
    if (current.isSilent || next.isSilent) {
      groups.push({
        bars: [current.measureNumber, next.measureNumber],
        mode: "split",
        gestureIds: [currentGesture, nextGesture],
        reason: "有声音的小节根据旋律匹配手势；休止小节用水平线表示停住。",
        start: current.start,
        end: next.end,
        beatTimes: [...current.beatTimes, ...next.beatTimes],
        gestureTimings: [
          { start: current.start, end: current.end, beatTimes: [...current.beatTimes] },
          { start: next.start, end: next.end, beatTimes: [...next.beatTimes] }
        ],
        confidence: clamp((current.validPitchRatio + next.validPitchRatio) / 2 * 0.6 + 0.22, 0.35, 0.86)
      });
      continue;
    }
    const similarity = contourSimilarity(current, next);
    const continuity = boundaryContinuity(current, next, energyData);
    if (pacing.barsPerGesture === 2) {
      const gesture = gestureForFastPair(current, next, meter);
      groups.push({
        bars: [current.measureNumber, next.measureNumber],
        mode: "merged",
        gestureIds: [gesture],
        reason: `每小节约 ${pacing.secondsPerMeasure.toFixed(1)} 秒，两个小节合成一个完整动作，让儿童有足够时间做完。`,
        start: current.start,
        end: next.end,
        beatTimes: [...current.beatTimes, ...next.beatTimes],
        gestureTimings: [{ start: current.start, end: next.end, beatTimes: [...current.beatTimes, ...next.beatTimes] }],
        confidence: clamp((current.validPitchRatio + next.validPitchRatio) / 2 * 0.6 + 0.28, 0.42, 0.92)
      });
      continue;
    }
    let mode = "split";
    let gestureIds = [currentGesture, nextGesture];
    let reason = `第 ${current.measureNumber} 小节是${gestureById(currentGesture).name}，第 ${next.measureNumber} 小节是${gestureById(nextGesture).name}。`;
    let confidence = clamp((current.validPitchRatio + next.validPitchRatio) / 2 * 0.65 + 0.25, 0.35, 0.93);
    if (continuity >= 0.74 || (next.sustainRatio >= 0.67 && continuity >= 0.56)) {
      mode = "merged";
      const mergedGesture = next.sustainRatio >= 0.67 ? (current.accentCount ? "accent_hold" : "hold") : currentGesture;
      gestureIds = [mergedGesture];
      reason = next.sustainRatio >= 0.67 ? "第二小节以持续音为主，延续前一动作并保持。" : "小节线前后旋律连续，合并为一个完整动作。";
      confidence = clamp(continuity, 0.45, 0.94);
    } else if (similarity >= 0.78 || currentGesture === nextGesture) {
      mode = "repeat";
      gestureIds = [currentGesture, currentGesture];
      reason = similarity >= 0.78 ? "两个小节的旋律轮廓高度相似，重复同一个动作。" : "两个小节属于同一种主要运动方向，重复同一个动作。";
      confidence = clamp(similarity, 0.5, 0.96);
    }
    groups.push({
      bars: [current.measureNumber, next.measureNumber],
      mode,
      gestureIds,
      reason,
      start: current.start,
      end: next.end,
      beatTimes: [...current.beatTimes, ...next.beatTimes],
      gestureTimings: mode === "merged"
        ? [{ start: current.start, end: next.end, beatTimes: [...current.beatTimes, ...next.beatTimes] }]
        : [
          { start: current.start, end: current.end, beatTimes: [...current.beatTimes] },
          { start: next.start, end: next.end, beatTimes: [...next.beatTimes] }
        ],
      confidence
    });
  }
  return diversifyGestureSequence(groups);
}

function analyzeAudioBuffer(audioBuffer) {
  if (audioBuffer.duration < 4) throw new Error("音乐太短，至少需要 4 秒。");
  const energy = buildEnergyEnvelope(audioBuffer);
  const { tempo, grid } = resolveTempoAndGrid(energy);
  const adaptiveTimeline = buildAdaptiveMeasures(energy, grid, audioBuffer.duration);
  const candidateMeasureCount = adaptiveTimeline.measures.length;
  if (candidateMeasureCount < 2) throw new Error("没有识别到两个完整小节，请换一段节拍更清楚的音乐。");
  const pitchData = downsampleAudio(audioBuffer);
  const analyzedMeasures = adaptiveTimeline.measures.map((window, index) => {
    return analyzeMeasure(index, window.start, window.end, pitchData, energy, grid.meter, window.beatTimes);
  });
  const trimmed = trimTrailingSilentMeasures(analyzedMeasures);
  const measures = trimmed.measures;
  const measureCount = measures.length;
  if (measureCount < 2) throw new Error("有效音乐不足两个小节，请检查音频内容。");
  const groups = groupAnalyzedMeasures(measures, energy, grid.meter);
  const pacing = gesturePacingForMeasures(measures);
  return {
    groups,
    meta: {
      meter: meterLabel(grid.meter),
      bpm: tempo.bpm,
      measureCount,
      method: "本地有效音乐区间、节拍结构与音高轮廓分析",
      confidence: grid.confidence,
      meterConfidence: grid.meterConfidence,
      meterAlternatives: grid.meterAlternatives,
      duration: audioBuffer.duration,
      contentStart: energy.contentStart,
      contentEnd: energy.contentEnd,
      trailingSilentMeasureCount: trimmed.removedCount,
      firstDownbeat: adaptiveTimeline.measures[0]?.start ?? grid.firstDownbeat,
      beatTimes: adaptiveTimeline.beatTimes.filter(time => time <= measures[measures.length - 1].end),
      secondsPerMeasure: pacing.secondsPerMeasure,
      barsPerGesture: pacing.barsPerGesture,
      gesturePacing: pacing.label
    }
  };
}

function waitForAnalysisPaint() {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => requestAnimationFrame(resolve));
    else setTimeout(resolve, 0);
  });
}

async function reportTeacherAnalysisProgress(percent, label, detail = "") {
  state.teacherAnalysisProgress = { percent: Math.round(percent), label, detail };
  render();
  await waitForAnalysisPaint();
}

async function analyzeAudioBufferWithProgress(audioBuffer) {
  if (audioBuffer.duration < 4) throw new Error("音乐太短，至少需要 4 秒。");
  await reportTeacherAnalysisProgress(24, "正在读取声音强弱变化", "从音频波形中寻找节拍落点");
  const energy = buildEnergyEnvelope(audioBuffer);
  await reportTeacherAnalysisProgress(32, "正在估算节拍速度", "比较整首音乐中的重复节奏");
  const { tempo, grid } = resolveTempoAndGrid(energy);
  await reportTeacherAnalysisProgress(40, "正在划分小节", `全曲综合识别 ${Math.round(tempo.bpm)} BPM · ${meterLabel(grid.meter)}`);
  const adaptiveTimeline = buildAdaptiveMeasures(energy, grid, audioBuffer.duration);
  const candidateMeasureCount = adaptiveTimeline.measures.length;
  if (candidateMeasureCount < 2) throw new Error("没有识别到两个完整小节，请换一段节拍更清楚的音乐。");
  await reportTeacherAnalysisProgress(46, "正在读取旋律轮廓", `识别到 ${candidateMeasureCount} 个候选小节，准备检查声音与旋律`);
  const pitchData = downsampleAudio(audioBuffer);
  const measures = [];
  for (let index = 0; index < candidateMeasureCount; index += 1) {
    const window = adaptiveTimeline.measures[index];
    measures.push(analyzeMeasure(index, window.start, window.end, pitchData, energy, grid.meter, window.beatTimes));
    if ((index + 1) % 2 === 0 || index === candidateMeasureCount - 1) {
      const percent = 46 + (index + 1) / candidateMeasureCount * 42;
      await reportTeacherAnalysisProgress(percent, "正在逐小节分析旋律", `已分析 ${index + 1} / ${candidateMeasureCount} 个候选小节`);
    }
  }
  const trimmed = trimTrailingSilentMeasures(measures);
  measures.splice(0, measures.length, ...trimmed.measures);
  const measureCount = measures.length;
  if (measureCount < 2) throw new Error("有效音乐不足两个小节，请检查音频内容。");
  await reportTeacherAnalysisProgress(92, "正在匹配手势图", "比较相邻小节，判断分别呈现、重复或合并");
  const groups = groupAnalyzedMeasures(measures, energy, grid.meter);
  const pacing = gesturePacingForMeasures(measures);
  await reportTeacherAnalysisProgress(100, "分析完成", `已为 ${measureCount} 个小节生成 ${groups.length} 组手势`);
  return {
    groups,
    meta: {
      meter: meterLabel(grid.meter),
      bpm: tempo.bpm,
      measureCount,
      method: "本地有效音乐区间、节拍结构与音高轮廓分析",
      confidence: grid.confidence,
      meterConfidence: grid.meterConfidence,
      meterAlternatives: grid.meterAlternatives,
      duration: audioBuffer.duration,
      contentStart: energy.contentStart,
      contentEnd: energy.contentEnd,
      trailingSilentMeasureCount: trimmed.removedCount,
      firstDownbeat: adaptiveTimeline.measures[0]?.start ?? grid.firstDownbeat,
      beatTimes: adaptiveTimeline.beatTimes.filter(time => time <= measures[measures.length - 1].end),
      secondsPerMeasure: pacing.secondsPerMeasure,
      barsPerGesture: pacing.barsPerGesture,
      gesturePacing: pacing.label
    }
  };
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("无法读取这张乐谱图片。")));
    reader.readAsDataURL(file);
  });
}

function refreshScoreDerivedData(score) {
  const tonicMidi = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 }[score.tonic] || 60;
  const intervals = [0, 0, 2, 4, 5, 7, 9, 11];
  const syllables = ["rest", "do", "re", "mi", "fa", "sol", "la", "si"];
  const beatsPerMeasure = score.meter.beats * 4 / score.meter.unit;
  let offset = 0;
  score.notes = [];
  score.measures.forEach(measure => {
    let contentDuration = 0;
    measure.notes.forEach(note => {
      note.solfege = syllables[note.degree];
      note.startBeat = Number((offset + note.beat).toFixed(3));
      note.frequency = note.degree === 0 ? 0 : Number((440 * 2 ** ((tonicMidi + intervals[note.degree] + note.octave * 12 - 69) / 12)).toFixed(3));
      contentDuration = Math.max(contentDuration, note.beat + note.duration);
      score.notes.push(note);
    });
    const writtenMeasureBeats = Number(measure.beats) || beatsPerMeasure;
    offset += measure.pickup ? contentDuration : Math.max(writtenMeasureBeats, contentDuration);
  });
  score.totalBeats = Math.max(...score.notes.map(note => note.startBeat + note.duration), 0);
}

function changeScoreReviewMeasure(direction) {
  const count = state.scoreDraft ? scoreReviewGroups(state.scoreDraft).length : 1;
  state.scoreReviewMeasureIndex = Math.max(0, Math.min(count - 1, state.scoreReviewMeasureIndex + direction));
  render();
}

function previewScoreMeasure() {
  const score = state.scoreDraft;
  const group = score ? scoreReviewGroups(score)[state.scoreReviewMeasureIndex] : null;
  if (!score || !group) return;
  clearTimers();
  stopSolfegeNodes();
  refreshScoreDerivedData(score);
  const ctx = getAudioContext();
  const beatSeconds = 60 / Math.max(36, score.bpm || 72);
  const start = ctx.currentTime + .08;
  let groupBeatOffset = 0;
  [group.pickup?.measure, group.main.measure].filter(Boolean).forEach(measure => {
    measure.notes.forEach(note => {
      if (note.degree === 0) return;
      schedulePianoNote(note.frequency, start + (groupBeatOffset + note.beat) * beatSeconds, Math.max(.18, note.duration * beatSeconds * .98), .15);
    });
    groupBeatOffset += scoreMeasureBeatTotal(measure);
  });
}

function confirmScoreMeasure() {
  const score = state.scoreDraft;
  const groups = score ? scoreReviewGroups(score) : [];
  const group = groups[state.scoreReviewMeasureIndex];
  if (!score || !group) return;
  const invalidMeasure = [group.pickup?.measure, group.main.measure].filter(Boolean).find(measure => {
    const expected = scoreExpectedMeasureBeats(score, measure);
    return Math.abs(scoreMeasureBeatTotal(measure) - expected) >= .001;
  });
  if (invalidMeasure) return showToast("这个小节的长度还不正确，请先修改音符长度。");
  state.scoreConfirmedMeasures[state.scoreReviewMeasureIndex] = true;
  [group.pickup?.measure, group.main.measure].filter(Boolean).forEach(measure => measure.notes.forEach(note => { note.confidence = 1; }));
  const nextUnconfirmed = groups.findIndex((_, index) => index > state.scoreReviewMeasureIndex && !state.scoreConfirmedMeasures[index]);
  if (nextUnconfirmed >= 0) state.scoreReviewMeasureIndex = nextUnconfirmed;
  render();
}

async function analyzeScore() {
  if (!teacherScoreFile) return;
  state.scoreStep = "analyzing";
  state.scoreError = "";
  render();
  try {
    const imageDataUrl = await fileAsDataUrl(teacherScoreFile);
    const response = await fetch("/api/score/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: teacherScoreFile.name, imageDataUrl })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "AI 没有成功读取这张乐谱。");
    state.scoreDraft = result.score;
    refreshScoreDerivedData(state.scoreDraft);
    state.scoreReviewMeasureIndex = 0;
    state.scoreConfirmedMeasures = {};
    state.scoreStep = "review";
    state.scorePublished = false;
  } catch (error) {
    state.scoreStep = "input";
    state.scoreError = location.protocol === "file:"
      ? "乐谱识别需要通过“启动唱名教学原型.cmd”打开，不能直接双击网页。"
      : (error.message || "乐谱分析失败，请重试。");
  }
  render();
}

function loadScoreDemo() {
  state.scoreDraft = structuredClone(DONGFANGHONG_SCORE);
  state.scoreDraft.source = "model-draft";
  state.scoreDraft.confidence = .87;
  state.scoreDraft.warnings = ["模型已预填数字和小节，请重点确认黄色音符与节奏模板。"];
  [[1, 1], [3, 2], [10, 1]].forEach(([measureIndex, noteIndex]) => {
    const note = state.scoreDraft.measures[measureIndex]?.notes?.[noteIndex];
    if (note) note.confidence = .62;
  });
  refreshScoreDerivedData(state.scoreDraft);
  state.scoreFileName = "东方红·模型预生成草稿.jpg";
  state.scoreImageUrl = "assets/music/dongfanghong/score.jpg";
  state.scoreError = "";
  state.scoreReviewMeasureIndex = 0;
  state.scoreConfirmedMeasures = {};
  state.scoreStep = "review";
  state.scorePublished = false;
  render();
}

function publishScore() {
  if (!state.scoreDraft) return;
  if (scoreReviewGroups(state.scoreDraft).some((_, index) => !state.scoreConfirmedMeasures[index])) return showToast("请先确认全部小节，再生成钢琴与唱名。");
  refreshScoreDerivedData(state.scoreDraft);
  state.scoreDraft.source = "human-verified";
  state.publishedSolfegeLesson = structuredClone(state.scoreDraft);
  state.scorePublished = true;
  state.scoreStep = "published";
  render();
  showToast("简谱已确认。儿童端将使用钢琴示范唱名旋律。");
}

function resetScore() {
  if (state.scoreImageUrl?.startsWith("blob:")) URL.revokeObjectURL(state.scoreImageUrl);
  teacherScoreFile = null;
  state.scoreFileName = "";
  state.scoreImageUrl = "";
  state.scoreImageDataUrl = "";
  state.scoreDraft = null;
  state.scoreError = "";
  state.scoreReviewMeasureIndex = 0;
  state.scoreConfirmedMeasures = {};
  state.scoreStep = "input";
  state.scorePublished = false;
  render();
}

async function analyzeTeacherSong() {
  if (!teacherAudioFile) return;
  clearTimers();
  state.teacherStep = "analyzing";
  state.teacherAnalysisProgress = { percent: 2, label: "正在准备音频", detail: "确认文件并建立本次分析任务" };
  state.teacherPublished = false;
  state.teacherEditing = null;
  render();
  await waitForAnalysisPaint();
  try {
    await reportTeacherAnalysisProgress(8, "正在读取上传文件", `${teacherAudioFile.name} · ${(teacherAudioFile.size / 1024 / 1024).toFixed(1)} MB`);
    const context = getAudioContext();
    const arrayBuffer = await teacherAudioFile.arrayBuffer();
    await reportTeacherAnalysisProgress(16, "正在解码音频", "转换为可分析的声音数据");
    const decodedAudio = await context.decodeAudioData(arrayBuffer.slice(0));
    const result = await analyzeAudioBufferWithProgress(decodedAudio);
    state.teacherAnalysis = result.groups;
    state.teacherAnalysisMeta = result.meta;
    state.teacherStep = "review";
    render();
    showToast("音频分析完成，请老师确认每组小节。" );
    return true;
  } catch (error) {
    state.teacherStep = "input";
    render();
    showToast(error?.message || "没有成功分析这首音乐，请换一个音频文件再试。" );
    return false;
  }
}

function applyCuratedCarmenPlan(plan) {
  const planByBars = new Map(plan.groups.map(group => [`${group.bars[0]}-${group.bars[1]}`, group]));
  state.teacherAnalysis = state.teacherAnalysis.map(group => {
    const curated = planByBars.get(`${group.bars[0]}-${group.bars[1]}`);
    if (!curated || !curated.gestureIds.every(id => gestureLibrary.some(gesture => gesture.id === id))) return group;
    return {
      ...group,
      mode: curated.gestureIds.length > 1 ? "split" : "merged",
      gestureIds: [...curated.gestureIds],
      reason: "已套用老师确认的《卡门》课程手势。"
    };
  });
  state.teacherAnalysisMeta = { ...state.teacherAnalysisMeta, curated: true };
  render();
  showToast("已载入老师确认的《卡门》课程手势方案。" );
}

function buildCarmenLessonGroups(plan) {
  if (!Array.isArray(plan.groups) || plan.groups.length !== plan.groupStartSeconds?.length) return [];
  return plan.groups.map((group, index) => {
    const start = plan.groupStartSeconds[index];
    const end = plan.groupStartSeconds[index + 1] ?? plan.lessonEndSec;
    const beatCount = Math.max(1, (group.bars[1] - group.bars[0] + 1) * 3);
    const beatTimes = Array.from({ length: beatCount }, (_, beatIndex) => start + beatIndex * (end - start) / beatCount);
    return {
      bars: [...group.bars],
      mode: group.gestureIds.length > 1 ? "split" : "merged",
      gestureIds: [...group.gestureIds],
      reason: "老师确认的《卡门》课程手势。",
      start,
      end,
      beatTimes,
      gestureTimings: [{ start, end, beatTimes }],
      confidence: 1,
      curated: true
    };
  });
}

function fixedDemoAsset(section, key, fallback) {
  return fixedDemoManifest?.[section]?.[key] || fallback;
}

function normalizeFixedDemoScore(score) {
  if (!score || !Array.isArray(score.measures) || score.measures.length !== 16) return null;
  const normalized = structuredClone(score);
  normalized.measures.forEach(measure => {
    const phraseId = `page${Math.ceil(Number(measure.number) / 4)}`;
    measure.notes = (measure.notes || []).map(note => ({ ...note, phraseId }));
  });
  refreshScoreDerivedData(normalized);
  normalized.source = "human-curated-fixed-demo";
  return normalized;
}

async function hydrateBuiltInCarmenLesson(planOverride = null) {
  try {
    const plan = planOverride || await fetch(fixedDemoAsset("gestureLesson", "plan", CARMEN_GESTURE_PLAN), { cache: "no-store" }).then(response => response.ok ? response.json() : null);
    if (!plan) return;
    const lessonGroups = buildCarmenLessonGroups(plan);
    if (!lessonGroups.length) return;
    state.publishedTeacherAnalysis = lessonGroups;
    state.publishedLessonTitle = CARMEN_TITLE;
    state.publishedLessonAudioUrl = fixedDemoAsset("gestureLesson", "audio", CARMEN_AUDIO);
    state.publishedLessonMeter = plan.meter;
    state.publishedLessonStart = lessonGroups[0].start;
    state.publishedLessonEnd = lessonGroups[lessonGroups.length - 1].end;
    state.swanSection = Math.min(state.swanSection, lessonGroups.length - 1);
    if (state.screen === "feel-melody" || state.screen === "feel") render();
  } catch {
    // 内置方案读取失败时保留原有示例，避免阻塞其他功能。
  }
}

async function hydrateFixedDemoPack() {
  try {
    const manifestResponse = await fetch(FIXED_DEMO_MANIFEST, { cache: "no-store" });
    if (!manifestResponse.ok) throw new Error("固定演示清单不可用");
    fixedDemoManifest = await manifestResponse.json();
    const planPath = fixedDemoAsset("gestureLesson", "plan", CARMEN_GESTURE_PLAN);
    const scorePath = fixedDemoAsset("solfegeLesson", "score", FIXED_DEMO_SCORE);
    const [planResponse, scoreResponse] = await Promise.all([
      fetch(planPath, { cache: "no-store" }),
      fetch(scorePath, { cache: "no-store" })
    ]);
    if (planResponse.ok) await hydrateBuiltInCarmenLesson(await planResponse.json());
    if (scoreResponse.ok && !savedScoreSession) {
      const score = normalizeFixedDemoScore(await scoreResponse.json());
      if (score) {
        state.publishedSolfegeLesson = score;
        if (state.screen === "feel-sing") render();
      }
    }
  } catch {
    // 固定清单读取失败时，保留内置回退数据，不能阻塞课堂演示。
    hydrateBuiltInCarmenLesson();
  }
}

async function loadCarmenDemo() {
  clearTimers();
  try {
    const [audioResponse, planResponse] = await Promise.all([
      fetch(fixedDemoAsset("gestureLesson", "audio", CARMEN_AUDIO), { cache: "no-store" }),
      fetch(fixedDemoAsset("gestureLesson", "plan", CARMEN_GESTURE_PLAN), { cache: "no-store" })
    ]);
    if (!audioResponse.ok) throw new Error("没有读取到内置《卡门》音频。");
    if (!planResponse.ok) throw new Error("没有读取到《卡门》课程手势方案。");
    const [blob, curatedPlan] = await Promise.all([audioResponse.blob(), planResponse.json()]);
    teacherAudioFile = new File([blob], `${CARMEN_TITLE}.mp3`, { type: blob.type || "audio/mpeg" });
    teacherAudioPreviewUrl = CARMEN_AUDIO;
    teacherPreviewMarkedGroup = -1;
    state.teacherFileName = CARMEN_TITLE;
    state.teacherPublished = false;
    const analyzed = await analyzeTeacherSong();
    if (analyzed) applyCuratedCarmenPlan(curatedPlan);
  } catch (error) {
    state.teacherStep = "input";
    render();
    showToast(error?.message || "没有成功载入《卡门》演示音频。" );
  }
}

function chooseTeacherGesture(gestureId) {
  if (!state.teacherEditing || !gestureLibrary.some(gesture => gesture.id === gestureId)) return;
  const group = state.teacherAnalysis[state.teacherEditing.group];
  group.gestureIds[state.teacherEditing.slot] = gestureId;
  if (group.mode === "repeat" && group.gestureIds[0] !== group.gestureIds[1]) {
    group.mode = "split";
    group.reason = "老师调整后，两个小节分别使用不同手势。";
  }
  state.teacherEditing = null;
  state.teacherPublished = false;
  render();
  showToast("手势已经替换。" );
}

function publishTeacherLesson() {
  state.publishedTeacherAnalysis = state.teacherAnalysis.map(group => ({ ...group, gestureIds: [...group.gestureIds] }));
  state.publishedLessonTitle = state.teacherFileName || CARMEN_TITLE;
  state.publishedLessonAudioUrl = teacherAudioPreviewUrl || CARMEN_AUDIO;
  state.publishedLessonMeter = state.teacherAnalysisMeta.meter;
  state.publishedLessonStart = state.teacherAnalysis[0]?.start || 0;
  state.publishedLessonEnd = state.teacherAnalysis[state.teacherAnalysis.length - 1]?.end || CARMEN_EXCERPT_SECONDS;
  state.teacherPublished = true;
  state.teacherStep = "published";
  state.teacherEditing = null;
  render();
  showToast("已确认，课堂端会使用这份手势方案。" );
}

function resetTeacherSong() {
  teacherAudioFile = null;
  teacherAudioPreviewUrl = null;
  teacherPreviewMarkedGroup = -1;
  state.teacherStep = "input";
  state.teacherFileName = "";
  state.teacherPublished = false;
  state.teacherEditing = null;
  state.teacherAnalysis = defaultCarmenAnalysis.map(group => ({ ...group, gestureIds: [...group.gestureIds] }));
  render();
}

function selectMood(key) {
  stopMusicAudio();
  state.musicSource = "system";
  state.selectedTeacherPack = null;
  state.mood = key;
  state.dogRhythmSource = "system";
  state.message = moods[key].postcardLine;
  const notes = moods[key].notes;
  notes.slice(0, 3).forEach((note, index) => later(() => tone(note, 0.25, 0.09, "triangle"), index * 130));
  render();
}

function selectTeacherMusicPack(packId) {
  const pack = state.teacherMusicPacks.find(item => item.packId === packId);
  if (!pack) return showToast("这套老师音乐暂时无法读取，请刷新后重试。");
  const speedChanged = currentBpm() !== pack.bpm;
  stopMusicAudio();
  state.musicSource = "teacher";
  state.selectedTeacherPack = pack;
  state.dogRhythmSource = "system";
  state.title = pack.title;
  state.message = pack.moodSummary;
  if (speedChanged && state.voiceStickers.length) {
    clearVoiceStickers();
    showToast("音乐速度已经改变，请按新速度重新录制声音贴纸。");
  }
  setScreen("arrange");
  warmMusicPack();
}

function selectGroove(key) {
  stopMusicAudio();
  const previousBpm = currentBpm();
  state.musicSource = "system";
  state.selectedTeacherPack = null;
  if (previousBpm !== grooveAudio[key].bpm && state.voiceStickers.length) {
    clearVoiceStickers();
    showToast("律动速度变了，请重新录制我的声音贴纸。");
  }
  state.groove = key;
  state.dogRhythmSource = "system";
  render();
  warmMusicPack();
}

function previewPack() {
  if (state.packPreviewing) {
    stopMusicAudio();
    render();
    return;
  }
  stopMusicAudio();
  const customDog = state.dogRhythmSource === "custom" ? state.bodyRecordings[currentPackId()] : null;
  if (customDog?.audioUrl) {
    activeStemAudios = stemAnimals.map(animal => {
      const audio = new Audio(animal === "dog" ? customDog.audioUrl : musicPath(`stems/${animal}.wav`));
      audio.preload = "auto";
      audio.volume = animal === "dog" ? 1 : .9;
      audio.play().catch(() => showToast("音乐没有成功播放，请再试一次。"));
      return audio;
    });
    state.packPreviewing = true;
    render();
    later(() => {
      stopMusicAudio();
      render();
    }, (state.musicSource === "teacher" && state.selectedTeacherPack?.durationSeconds ? state.selectedTeacherPack.durationSeconds : twoBarDuration()) * 1000 + 80);
    return;
  }
  activePreviewAudio = new Audio(musicPath("preview/mix.wav"));
  activePreviewAudio.preload = "auto";
  state.packPreviewing = true;
  activePreviewAudio.addEventListener("ended", () => {
    activePreviewAudio = null;
    state.packPreviewing = false;
    render();
  }, { once: true });
  activePreviewAudio.addEventListener("error", () => {
    activePreviewAudio = null;
    state.packPreviewing = false;
    render();
    showToast("音乐资源暂时无法读取，请从启动入口打开 demo。");
  }, { once: true });
  activePreviewAudio.play().catch(() => {
    stopMusicAudio();
    state.packPreviewing = false;
    render();
    showToast("请再点一次试听，允许浏览器播放声音。");
  });
  render();
}

function releaseVoiceUrl(voice = state.voice) {
  if (voice?.audioUrl?.startsWith("blob:")) URL.revokeObjectURL(voice.audioUrl);
}

function clearVoiceStickers() {
  state.voiceStickers.forEach(releaseVoiceUrl);
  state.voiceStickers = [];
  state.sections = state.sections.map(section => section.filter(sticker => !isVoiceStickerKey(sticker)));
  state.selectedAnimal = isVoiceStickerKey(state.selectedAnimal) ? null : state.selectedAnimal;
}

async function removeVoiceBeforeShare() {
  releaseVoiceUrl(state.voice);
  state.voice = { status: "empty", audioUrl: null, blob: null };
  clearVoiceStickers();
  if (state.saved) await persistCurrentWork();
  state.modal = "share";
  render();
  showToast("已从作品中移除我的声音录音。");
}

async function deleteVoiceSticker(id) {
  const voice = state.voiceStickers.find(item => item.id === id);
  if (!voice) return;
  if (!window.confirm("删除后，原始录音和作品中的声音贴纸都会从当前设备移除。确认删除吗？")) return;
  releaseVoiceUrl(voice);
  const key = `voice:${id}`;
  state.voiceStickers = state.voiceStickers.filter(item => item.id !== id);
  state.sections = state.sections.map(section => section.filter(sticker => sticker !== key));
  if (state.selectedAnimal === key) state.selectedAnimal = null;
  if (state.saved) await persistCurrentWork();
  render();
  showToast(`${voice.name}和录音已删除。`);
}

function deleteSavedWork() {
  if (!window.confirm("确认删除保存在这台设备上的作品和录音吗？")) return;
  try {
    localStorage.removeItem("animal-music-postcard");
  } catch {
    showToast("当前浏览器无法删除本机保存记录。");
    return;
  }
  releaseVoiceUrl(state.voice);
  clearVoiceStickers();
  state.voice = { status: "empty", audioUrl: null, blob: null };
  state.sections = [["dog"], ["dog"], ["dog"], ["dog"]];
  state.mood = null;
  state.groove = null;
  state.musicSource = "system";
  state.selectedTeacherPack = null;
  state.dogRhythmSource = "system";
  state.saved = false;
  state.title = "写给远方的星星";
  state.message = "想把今天做的音乐送给你。";
  render();
  showToast("本机作品和录音已删除。");
}

function changeSolfegePhrase(direction) {
  if (state.classPlaying) toggleClassPlayback();
  const phraseCount = state.publishedSolfegeLesson?.phrases?.length || 1;
  state.solfegePhraseIndex = Math.max(0, Math.min(phraseCount - 1, state.solfegePhraseIndex + direction));
  state.solfegeActiveNoteIndex = null;
  render();
}

function chooseSolfegePlayback(fullLesson) {
  const sameModePlaying = state.classPlaying && state.solfegePlayingFull === fullLesson;
  if (state.classPlaying) toggleClassPlayback();
  if (!sameModePlaying) playPublishedSolfegeLesson(fullLesson);
}

function previewSelectedSolfegeNote(noteIndex) {
  if (state.classPlaying) toggleClassPlayback();
  clearTimers();
  stopSolfegeNodes();
  const lesson = state.publishedSolfegeLesson || DEFAULT_SOLFEGE_LESSON;
  refreshScoreDerivedData(lesson);
  const note = lesson.notes[noteIndex];
  if (!note || note.degree <= 0 || !note.frequency) return;
  state.solfegeActiveNoteIndex = noteIndex;
  render();
  const secondsPerBeat = 60 / Math.max(36, lesson.bpm || 72) / state.playbackRate;
  const durationSeconds = Math.max(0.3, Math.min(1.2, note.duration * secondsPerBeat * 0.92));
  const ctx = getAudioContext();
  schedulePianoNote(note.frequency, ctx.currentTime + 0.03, durationSeconds, 0.18);
  later(() => {
    if (state.solfegeActiveNoteIndex !== noteIndex || state.classPlaying) return;
    state.solfegeActiveNoteIndex = null;
    render();
  }, durationSeconds * 1000 + 80);
}

function changeCollaborationPoemLine(direction) {
  stopPoemAudio();
  stopSolfegeNodes();
  state.classPlaying = false;
  state.collaborationLineIndex = Math.max(0, Math.min(3, state.collaborationLineIndex + direction));
  render();
}

function playCollaborationPoemLine() {
  clearTimers();
  stopPoemAudio();
  stopSolfegeNodes();
  const lineIndex = Math.max(0, Math.min(3, state.collaborationLineIndex));
  const beatSeconds = 60 / JINGYESI_SCORE.bpm;
  const barSeconds = BEATS_PER_BAR * beatSeconds;
  const audioUrl = poemLineAudioUrl(lineIndex);
  if (!audioUrl) return showToast("这首诗的人声还在准备中。" );
  const audio = new Audio(audioUrl);
  activePoemAudio = audio;
  audio.preload = "auto";
  audio.volume = 1;
  state.classPlaying = true;
  render();
  audio.play().catch(() => showToast("小兔演唱没有成功播放，请再试一次。"));
  later(() => {
    if (activePoemAudio !== audio) return;
    stopPoemAudio();
    state.classPlaying = false;
    render();
  }, barSeconds * 1000);
}

function playCollaborationPoemPiano() {
  clearTimers();
  stopPoemAudio();
  stopSolfegeNodes();
  const measure = JINGYESI_SCORE.measures[state.collaborationLineIndex];
  const beatSeconds = 60 / JINGYESI_SCORE.bpm;
  const ctx = getAudioContext();
  const startTime = ctx.currentTime + .05;
  state.classPlaying = true;
  render();
  measure.notes.forEach(note => schedulePianoNote(note.frequency, startTime + note.beat * beatSeconds, Math.max(.22, note.duration * beatSeconds * .92), .18));
  later(() => {
    state.classPlaying = false;
    render();
  }, BEATS_PER_BAR * beatSeconds * 1000);
}

function playCollaborationBody(mode) {
  stopPoemAudio();
  state.poetryPreviewMode = null;
  const lessonIndex = BODY_LESSONS.findIndex(lesson => lesson.id === currentPackId());
  if (lessonIndex >= 0) state.bodyLessonIndex = lessonIndex;
  playBodyLesson(mode);
}

function stopCollaborationPlayback() {
  clearTimers();
  stopMusicAudio();
  stopPoemAudio();
  stopBodyPlayback();
  activeVoiceAudios.forEach(audio => audio.pause());
  activeVoiceAudios = [];
  state.playingSection = null;
  state.poetryPreviewMode = null;
  state.classPlaying = false;
  state.collaborationCountdown = null;
}

function changeCollaborationGesture(direction) {
  stopCollaborationPlayback();
  const gestureIds = state.collaborationGestureIds || JINGYESI_GESTURE_IDS;
  state.collaborationGestureIndex = Math.max(0, Math.min(gestureIds.length - 1, state.collaborationGestureIndex + direction));
  state.collaborationGesturePickerOpen = false;
  render();
}

function saveCollaborationGesture(index, gestureId) {
  if (!gestureById(gestureId)) return;
  stopCollaborationPlayback();
  const gestureIds = [...(state.collaborationGestureIds || JINGYESI_GESTURE_IDS)];
  gestureIds[index] = gestureId;
  state.collaborationGestureIds = gestureIds;
  state.collaborationGesturePickerOpen = false;
  localStorage.setItem("animal-music-collaboration-gestures", JSON.stringify(gestureIds));
  render();
  showToast(`第 ${index + 1} 小节的手势已保存`);
}

function completeCollaborationRole(role) {
  if (!Object.hasOwn(state.collaborationPractice, role)) return;
  state.collaborationPractice[role] = true;
  state.classPlaying = false;
  setScreen("collaboration");
  showToast("这个角色已经准备好了！" );
}

function scheduleCollaborationSectionCues(sectionIndex, startLocalBar = 0) {
  const lesson = collaborationBodyLesson();
  const pattern = bodyDisplayPattern(lesson);
  const beatDuration = 60000 / currentBpm();
  for (let localBar = startLocalBar; localBar < 2; localBar += 1) {
    pattern.forEach((step, actionIndex) => later(() => {
      if (state.playingSection !== sectionIndex) return;
      state.collaborationBar = sectionIndex * 2 + localBar;
      state.collaborationGestureIndex = state.collaborationBar;
      state.collaborationActionIndex = actionIndex;
      if (["ensemble", "collab-body", "collab-melody"].includes(state.screen)) render();
    }, ((localBar - startLocalBar) * BEATS_PER_BAR + step.beat) * beatDuration));
  }
}

function schedulePoemLineClips(startBar) {
  const barDuration = twoBarDuration() / 2;
  for (let bar = Math.max(2, startBar); bar < 6; bar += 1) {
    later(() => {
      stopPoemAudio();
      const audioUrl = poemLineAudioUrl(bar - 2);
      if (!audioUrl) return;
      const audio = new Audio(audioUrl);
      activePoemAudio = audio;
      audio.preload = "auto";
      audio.volume = .96;
      audio.play().catch(() => showToast("小兔演唱暂时没有播放，音乐仍会继续。"));
    }, (bar - startBar) * barDuration * 1000);
  }
  if (startBar < 6) later(stopPoemAudio, (6 - startBar) * barDuration * 1000);
}

async function playCollaborationOnce({ markComplete = false, startBar = 0 } = {}) {
  const playbackMode = state.poetryPreviewMode || "mix";
  stopCollaborationPlayback();
  state.poetryPreviewMode = playbackMode;
  startBar = Math.max(0, Math.min(7, Number(startBar) || 0));
  state.collaborationDone = false;
  state.collaborationBar = startBar;
  state.collaborationGestureIndex = startBar;
  state.collaborationActionIndex = 0;
  state.playingSection = Math.floor(startBar / 2);
  render();

  const token = compositionPlaybackToken;
  const ctx = getAudioContext();
  const unlockSource = ctx.createBufferSource();
  unlockSource.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  unlockSource.connect(ctx.destination);
  unlockSource.start();
  const barDuration = twoBarDuration() / 2;
  const audioEntries = new Map();

  for (let sectionIndex = Math.floor(startBar / 2); sectionIndex < 4; sectionIndex += 1) {
    state.sections[sectionIndex].forEach(key => {
      if (stemAnimals.includes(key)) {
        const customDog = key === "dog" && state.dogRhythmSource === "custom" ? state.bodyRecordings[currentPackId()] : null;
        const url = customDog?.audioUrl || musicPath(`stems/${key}.wav`);
        audioEntries.set(`stem:${key}:${url}`, { type: "stem", key, url });
      } else if (isVoiceStickerKey(key)) {
        const sticker = voiceStickerForKey(key);
        if (sticker?.audioUrl) audioEntries.set(`voice:${key}:${sticker.audioUrl}`, { type: "voice", key, url: sticker.audioUrl });
      }
    });
  }
  for (let bar = Math.max(2, startBar); bar < 6; bar += 1) {
    const url = poemLineAudioUrl(bar - 2);
    if (url) audioEntries.set(`poem:${bar}:${url}`, { type: "poem", key: String(bar), url });
  }

  const loaded = await Promise.all([...audioEntries.values()].map(async entry => {
    try {
      return { ...entry, buffer: await loadCompositionBuffer(entry.url, ctx) };
    } catch {
      return null;
    }
  }));
  if (token !== compositionPlaybackToken) return;
  const buffers = loaded.filter(Boolean);
  if (!buffers.length) {
    state.poetryPreviewMode = null;
    state.playingSection = null;
    render();
    showToast("完整作品没有成功加载，请再试一次。");
    return;
  }

  const byId = new Map(buffers.map(entry => [`${entry.type}:${entry.key}`, entry]));
  const startTime = ctx.currentTime + .08;
  for (let sectionIndex = Math.floor(startBar / 2); sectionIndex < 4; sectionIndex += 1) {
    const sectionStartBar = sectionIndex * 2;
    const segmentStartBar = Math.max(startBar, sectionStartBar);
    const startLocalBar = segmentStartBar - sectionStartBar;
    const playAt = startTime + (segmentStartBar - startBar) * barDuration;
    const offsetSeconds = startLocalBar * barDuration;
    const durationSeconds = (sectionStartBar + 2 - segmentStartBar) * barDuration;
    state.sections[sectionIndex].forEach(key => {
      const type = stemAnimals.includes(key) ? "stem" : "voice";
      const entry = byId.get(`${type}:${key}`);
      if (!entry || offsetSeconds >= entry.buffer.duration) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = entry.buffer;
      gain.gain.value = type === "voice" ? .82 : ({ dog: .92, bear: 1, cat: .88, lion: .94 }[key] || 1);
      source.connect(gain).connect(ctx.destination);
      source.start(playAt, offsetSeconds, Math.min(durationSeconds, entry.buffer.duration - offsetSeconds));
      activeCompositionSources.push(source);
    });
    later(() => {
      if (token !== compositionPlaybackToken) return;
      state.playingSection = sectionIndex;
      state.collaborationBar = segmentStartBar;
      state.collaborationGestureIndex = segmentStartBar;
      state.collaborationActionIndex = 0;
      render();
      scheduleCollaborationSectionCues(sectionIndex, startLocalBar);
    }, Math.max(0, (playAt - ctx.currentTime) * 1000));
  }
  for (let bar = Math.max(2, startBar); bar < 6; bar += 1) {
    const entry = byId.get(`poem:${bar}`);
    if (!entry) continue;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = entry.buffer;
    gain.gain.value = .96;
    source.connect(gain).connect(ctx.destination);
    source.start(startTime + (bar - startBar) * barDuration, 0, Math.min(barDuration, entry.buffer.duration));
    activeCompositionSources.push(source);
  }
  later(() => {
    if (token !== compositionPlaybackToken) return;
    activeCompositionSources = [];
    state.poetryPreviewMode = null;
    state.playingSection = null;
    state.collaborationBar = 7;
    state.collaborationDone = markComplete;
    render();
    showToast(markComplete ? "合作演奏完成！可以交换角色再来一次。" : "完整作品播放完成。" );
  }, Math.max(0, (startTime + (8 - startBar) * barDuration - ctx.currentTime) * 1000));
}

function previewPoemVocal() {
  clearTimers();
  stopMusicAudio();
  stopPoemAudio();
  state.poetryPreviewMode = "vocal";
  const audioUrl = poemVoiceAudioUrl();
  if (!audioUrl) {
    state.poetryPreviewMode = null;
    render();
    return showToast("这首诗的人声还在准备中。" );
  }
  activePoemAudio = new Audio(audioUrl);
  activePoemAudio.preload = "auto";
  activePoemAudio.volume = 1;
  const audio = activePoemAudio;
  audio.addEventListener("ended", () => {
    if (activePoemAudio !== audio) return;
    activePoemAudio = null;
    state.poetryPreviewMode = null;
    render();
  }, { once: true });
  render();
  audio.play().catch(() => {
    activePoemAudio = null;
    state.poetryPreviewMode = null;
    render();
    showToast("小兔演唱没有成功播放，请再试一次。" );
  });
}

function previewPoemMix() {
  state.poetryPreviewMode = "mix";
  playCollaborationOnce({ markComplete: false, startBar: 0 });
}

function playCollaborationFromBar(bar) {
  state.poetryPreviewMode = "mix";
  state.collaborationGesturePickerOpen = false;
  playCollaborationOnce({ markComplete: false, startBar: bar });
}

function toggleCollaborationGesturePicker() {
  if (state.playingSection !== null || state.poetryPreviewMode === "mix") stopCollaborationPlayback();
  state.collaborationGesturePickerOpen = !state.collaborationGesturePickerOpen;
  render();
}

function previewCollaborationFullMix() {
  playCollaborationFromBar(0);
}

function stopPoetryPreview() {
  stopComposition();
  stopPoemAudio();
  state.poetryPreviewMode = null;
  render();
}

function previewCollaborationWork() {
  playCollaborationOnce({ markComplete: false });
}

function startCollaborationPerformance() {
  clearTimers();
  stopMusicAudio();
  stopPoemAudio();
  state.performancePreparing = true;
  state.collaborationDone = false;
  const interval = 60000 / currentBpm();
  for (let beat = 0; beat < BEATS_PER_BAR; beat += 1) {
    later(() => {
      state.collaborationCountdown = BEATS_PER_BAR - beat;
      drum(beat === 0 ? .7 : .35);
      render();
    }, beat * interval);
  }
  later(() => {
    state.performancePreparing = false;
    state.collaborationCountdown = null;
    playCollaborationOnce({ markComplete: true });
  }, BEATS_PER_BAR * interval);
}

function stopCollaborationPerformance() {
  clearTimers();
  stopMusicAudio();
  stopPoemAudio();
  state.playingSection = null;
  state.performancePreparing = false;
  state.collaborationCountdown = null;
  state.collaborationDone = false;
  render();
  showToast("演奏已暂停，可以重新开始。" );
}

function exchangeCollaborationRoles() {
  state.collaborationExchangeRound += 1;
  state.collaborationPractice = { sing: false, body: false, melody: false };
  state.collaborationDone = false;
  setScreen("collaboration");
  showToast("请三组交换角色，再完成一次练习。" );
}

function openPoetryPath() {
  const poems = poemsForCurrentMood();
  const readyPoem = poems.find(poem => poem.audioUrl);
  state.selectedPoemId = readyPoem?.id || poems[0]?.id || null;
  state.poetryPreviewMode = null;
  setScreen("poetry");
}

function choosePoem(poemId) {
  const poem = poemsForCurrentMood().find(item => item.id === poemId);
  if (!poem?.audioUrl) return showToast("这首诗的人声还在准备中。" );
  stopPoetryPreview();
  state.selectedPoemId = poem.id;
  render();
}

function handleAction(action, button, event) {
  const actions = {
    back: goBack,
    library: () => setScreen("library"),
    "play-class-song": playClassSong,
    "phonk-listen-intro": () => previewPhonkSection(2),
    "phonk-start": () => { state.phonkStep = 1; render(); },
    "phonk-page-back": goBackPhonkLevel,
    "phonk-practice-demo": previewPhonkPractice,
    "phonk-practice-next": () => { state.phonkPracticePart = Math.min(PHONK_TRACKS.length - 1, state.phonkPracticePart + 1); render(); },
    "phonk-practice-finish": () => { state.phonkStep = 2; render(); },
    "phonk-ensemble-demo": previewPhonkEnsemble,
    "phonk-ensemble-next": () => { stopPhonkPlayback(); state.phonkStep = 3; render(); },
    "phonk-cowbell": () => previewPhonkCharacteristic("cowbell"),
    "phonk-808": () => previewPhonkCharacteristic("808"),
    "phonk-sounds-next": () => { state.phonkStep = 4; render(); },
    "phonk-record-start": recordPhonkTrack,
    "phonk-record-preview": previewPhonkRecording,
    "phonk-record-retake": () => { const track = PHONK_TRACKS[state.phonkRecordIndex]; if (track) releasePhonkRecording(track.id); state.phonkRecordStatus = "idle"; render(); },
    "phonk-record-accept": acceptPhonkRecording,
    "phonk-record-skip": () => { state.phonkRecordStatus = "idle"; state.phonkStep = 5; render(); },
    "phonk-arrangement-preview": () => previewPhonkSection(state.phonkSelectedSection),
    "phonk-arrangement-next": () => { stopPhonkPlayback(); state.phonkStep = 6; state.phonkActiveSection = 0; render(); },
    "phonk-performance-play": () => state.phonkPlaying ? stopPhonkPlayback() : state.phonkPerformanceMode === "practice" ? previewPhonkSection(state.phonkActiveSection) : playPhonkWork(),
    "phonk-performance-restart": () => { stopPhonkPlayback(); state.phonkActiveSection = 0; state.phonkCompleted = false; render(); },
    "previous-solfege-phrase": () => changeSolfegePhrase(-1),
    "next-solfege-phrase": () => changeSolfegePhrase(1),
    "play-solfege-section": () => chooseSolfegePlayback(false),
    "play-full-solfege": () => chooseSolfegePlayback(true),
    "open-solfege-recorder": () => {
      const targets = solfegeRecordingTargets();
      const firstMissing = targets.findIndex(target => !state.solfegeRecordings[target.key]);
      if (firstMissing >= 0) state.solfegeRecordTargetIndex = firstMissing;
      state.solfegeRecordingOpen = true;
      render();
    },
    "close-solfege-recorder": () => { state.solfegeRecordingOpen = false; render(); },
    "play-solfege-guide": playCurrentSolfegeGuide,
    "preview-solfege-recording": previewCurrentSolfegeRecording,
    "record-solfege-target": recordCurrentSolfegeTarget,
    "play-swan-melody": playSwanMelody,
    "body-listen": () => playBodyLesson("listen"),
    "body-slow": () => playBodyLesson("slow"),
    "body-practice": () => playBodyLesson("practice"),
    "record-body": recordBodyRhythm,
    "save-body-recording": saveBodyRecording,
    "previous-body-lesson": () => changeBodyLesson(-1),
    "next-body-lesson": () => changeBodyLesson(1),
    "open-teacher-analysis": () => { state.teacherMode = "analysis"; render(); },
    "open-teacher-creation": () => { state.teacherMode = "creation"; render(); },
    "open-teacher-solfege": () => { state.teacherMode = "solfege"; render(); },
    "open-teacher-voicebank": () => { state.teacherMode = "voicebank"; state.solfegeRecordingOpen = false; render(); },
    "teacher-hub": () => { state.teacherMode = "hub"; render(); },
    "analyze-score": analyzeScore,
    "load-score-demo": loadScoreDemo,
    "previous-score-measure": () => changeScoreReviewMeasure(-1),
    "next-score-measure": () => changeScoreReviewMeasure(1),
    "preview-score-measure": previewScoreMeasure,
    "confirm-score-measure": confirmScoreMeasure,
    "publish-score": publishScore,
    "reset-score": resetScore,
    "analyze-teacher-song": analyzeTeacherSong,
    "load-carmen-demo": loadCarmenDemo,
    "locate-teacher-group": () => locateTeacherGroup(Number(button.dataset.group)),
    "publish-teacher-lesson": publishTeacherLesson,
    "reset-teacher-song": resetTeacherSong,
    "reopen-teacher-review": () => { state.teacherStep = "review"; state.teacherPublished = false; render(); },
    "close-gesture-picker": () => { state.teacherEditing = null; render(); },
    "preview-pack": previewPack,
    "toggle-teacher-music": () => { state.teacherMusicOpen = !state.teacherMusicOpen; render(); },
    "toggle-class-play": toggleClassPlayback,
    "open-voice-recorder": () => {
      if (state.voiceStickers.length >= MAX_VOICE_STICKERS) return showToast(`每件作品最多录制 ${MAX_VOICE_STICKERS} 张声音贴纸。`);
      state.voiceRecorderOpen = true;
      state.voice = { status: "empty", audioUrl: null, blob: null };
      render();
      app.querySelector(".arrange-voice-recorder")?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    "record-voice": recordVoice,
    "save-voice-sticker": saveVoiceSticker,
    "cancel-voice-recorder": cancelVoiceRecorder,
    "play-section": () => playSection(Number(button.dataset.index)),
    "play-all": () => playAll(state.screen === "postcard"),
    "stop-composition": stopComposition,
    "preview-version": () => playAll(state.version === "ai"),
    "open-poetry-path": openPoetryPath,
    "select-poem": () => choosePoem(button.dataset.poem),
    "preview-poem-vocal": previewPoemVocal,
    "preview-poem-mix": previewPoemMix,
    "stop-poetry-preview": stopPoetryPreview,
    "play-performance": startPerformance,
    "preview-collaboration-work": previewCollaborationWork,
    "play-poem-line": playCollaborationPoemLine,
    "play-poem-piano": playCollaborationPoemPiano,
    "previous-poem-line": () => changeCollaborationPoemLine(-1),
    "next-poem-line": () => changeCollaborationPoemLine(1),
    "play-collab-body-slow": () => playCollaborationBody("slow"),
    "play-collab-body": () => playCollaborationBody("practice"),
    "previous-collab-gesture": () => changeCollaborationGesture(-1),
    "next-collab-gesture": () => changeCollaborationGesture(1),
    "preview-collab-full-mix": previewCollaborationFullMix,
    "toggle-collab-gesture-picker": toggleCollaborationGesturePicker,
    "complete-collab-role": () => completeCollaborationRole(button.dataset.role),
    "start-collaboration-performance": startCollaborationPerformance,
    "stop-collaboration": stopCollaborationPerformance,
    "exchange-collaboration-roles": exchangeCollaborationRoles,
    "begin-refine": beginRefine,
    save: savePostcard,
    share: () => { state.modal = "share"; render(); },
    "delete-work": deleteSavedWork,
    "remove-voice-share": removeVoiceBeforeShare,
    "close-modal": () => { state.modal = null; render(); },
    "adult-confirm": confirmShare
  };
  actions[action]?.(event);
}

function goBack() {
  if (state.screen === "phonk-lab") return goBackPhonkLevel();
  if (state.screen === "teacher" && state.teacherMode !== "hub") {
    state.teacherMode = "hub";
    shouldAnimateScreen = true;
    return render();
  }
  if (state.screen === "teacher") return setScreen("home");
  if (state.screen === "feel") return setScreen("home");
  if (["feel-melody", "feel-body", "feel-sing"].includes(state.screen)) return setScreen("feel");
  if (state.screen === "library") return setScreen("feel");
  if (state.screen === "arrange" && state.voiceRecorderOpen) return cancelVoiceRecorder();
  if (state.screen === "arrange") return setScreen(state.musicSource === "teacher" ? "mood" : "groove");
  if (state.screen === "perform") return setScreen("refine");
  if (state.screen === "poetry") return setScreen("refine");
  if (["collab-sing", "collab-body", "collab-melody", "ensemble"].includes(state.screen)) return setScreen("collaboration");
  if (state.screen === "collaboration") return setScreen("poetry");
  const order = ["home", "mood", "groove", "arrange", "refine", "postcard"];
  const index = order.indexOf(state.screen);
  setScreen(order[Math.max(0, index - 1)]);
}

function solfegePlaybackNotes(lesson, fullLesson = false) {
  const indexedNotes = lesson.notes.map((note, lessonIndex) => ({ ...note, lessonIndex }));
  if (!fullLesson && lesson.phrases?.length) {
    const phrase = lesson.phrases[state.solfegePhraseIndex] || lesson.phrases[0];
    const phraseNotes = indexedNotes.filter(note => note.phraseId === phrase.id);
    const firstBeat = phraseNotes.length ? Math.min(...phraseNotes.map(note => note.startBeat)) : 0;
    return phraseNotes.map(note => ({ ...note, playBeat: note.startBeat - firstBeat }));
  }
  let fullNotes = indexedNotes.map(note => ({ ...note, playBeat: note.startBeat }));
  if (lesson.repeat) {
    const repeatedMeasureNumbers = new Set(Array.from({ length: lesson.repeat.endMeasure - lesson.repeat.startMeasure + 1 }, (_, index) => lesson.repeat.startMeasure + index));
    const repeatedNoteIndexes = new Set();
    lesson.measures.forEach(measure => {
      if (!repeatedMeasureNumbers.has(measure.number)) return;
      measure.notes.forEach(note => repeatedNoteIndexes.add(lesson.notes.indexOf(note)));
    });
    const segment = indexedNotes.filter(note => repeatedNoteIndexes.has(note.lessonIndex));
    if (segment.length) {
      const segmentStart = Math.min(...segment.map(note => note.startBeat));
      const segmentEnd = Math.max(...segment.map(note => note.startBeat + note.duration));
      const segmentDuration = segmentEnd - segmentStart;
      const before = indexedNotes.filter(note => note.startBeat < segmentStart).map(note => ({ ...note, playBeat: note.startBeat }));
      const repeated = Array.from({ length: lesson.repeat.times }, (_, passIndex) => segment.map(note => ({ ...note, playBeat: segmentStart + (note.startBeat - segmentStart) + passIndex * segmentDuration, repeatPass: passIndex + 1 }))).flat();
      const after = indexedNotes.filter(note => note.startBeat >= segmentEnd).map(note => ({ ...note, playBeat: note.startBeat + (lesson.repeat.times - 1) * segmentDuration }));
      fullNotes = [...before, ...repeated, ...after];
    }
  }
  const currentPhrase = lesson.phrases?.[state.solfegePhraseIndex];
  const currentPhraseBeats = currentPhrase ? indexedNotes.filter(note => note.phraseId === currentPhrase.id).map(note => note.startBeat) : [];
  const phraseStartBeat = currentPhraseBeats.length ? Math.min(...currentPhraseBeats) : 0;
  const remaining = fullNotes.filter(note => note.startBeat >= phraseStartBeat);
  const firstPlayBeat = remaining.length ? Math.min(...remaining.map(note => note.playBeat)) : 0;
  return remaining.map(note => ({ ...note, playBeat: note.playBeat - firstPlayBeat }));
}

function teacherVoiceSampleForNote(note) {
  const candidates = solfegeRecordingTargets()
    .filter(target => target.solfege === note.solfege)
    .map(target => ({ target, recording: state.solfegeRecordings[target.key] }))
    .filter(item => item.recording?.audioBuffer)
    .sort((a, b) => Math.abs(Math.log2(note.frequency / a.target.frequency)) - Math.abs(Math.log2(note.frequency / b.target.frequency)));
  if (!candidates.length) return null;
  const best = candidates[0];
  return { ...best, playbackRate: note.frequency / best.target.frequency };
}

function playPublishedSolfegeLesson(fullLesson = false) {
  clearTimers();
  stopSolfegeNodes();
  activeSolfegeAudios.forEach(audio => audio.pause());
  activeSolfegeAudios = [];
  const lesson = state.publishedSolfegeLesson || DEFAULT_SOLFEGE_LESSON;
  const playbackNotes = solfegePlaybackNotes(lesson, fullLesson);
  const totalBeats = Math.max(...playbackNotes.map(note => note.playBeat + note.duration), 0);
  const beatDuration = 60000 / Math.max(36, lesson.bpm || 72) / state.playbackRate;
  const ctx = getAudioContext();
  const startTime = ctx.currentTime + 0.08;
  state.classPlaying = true;
  state.solfegePlayingFull = fullLesson;
  state.solfegeActiveNoteIndex = null;
  render();
  playbackNotes.forEach(note => {
    if (note.degree > 0) {
      const durationSeconds = Math.max(.18, note.duration * beatDuration / 1000 * .98);
      const when = startTime + note.playBeat * beatDuration / 1000;
      schedulePianoNote(note.frequency, when, durationSeconds);
    }
    later(() => {
      state.solfegeActiveNoteIndex = note.lessonIndex;
      const phraseIndex = lesson.phrases?.findIndex(phrase => phrase.id === note.phraseId) ?? -1;
      if (fullLesson && phraseIndex >= 0 && phraseIndex !== state.solfegePhraseIndex) {
        state.solfegePhraseIndex = phraseIndex;
        render();
      } else {
        document.querySelectorAll("[data-solfege-note]").forEach(element => element.classList.toggle("active", Number(element.dataset.solfegeNote) === note.lessonIndex));
      }
    }, note.playBeat * beatDuration);
  });
  later(() => {
    activeSolfegeAudios.forEach(audio => audio.pause());
    activeSolfegeAudios = [];
    state.classPlaying = false;
    state.solfegePlayingFull = false;
    state.solfegeActiveNoteIndex = null;
    render();
    showToast("钢琴示范播放完成。");
  }, totalBeats * beatDuration + 120);
}

function playClassSong() {
  if (state.feelMode === "sing") {
    playPublishedSolfegeLesson();
    return;
  }
  if (state.feelMode === "body") {
    playBodyLesson("listen");
    return;
  }
  clearTimers();
  state.classPlaying = true;
  state.lessonMeasure = 0;
  render();
  const beatDuration = 430 / state.playbackRate;
  const notes = [261.6, 261.6, 392, 392, 440, 440, 392, 349.2];
  const syllables = ["do", "do", "sol", "sol", "la", "la", "sol", "fa"];
  const demoDog = document.querySelector(".dog-demo-state");
  const actionStates = ["clap", "patThighs", "clap", "stop"];
  const actionLabels = ["拍手", "拍腿", "拍手", "停住"];
  const showDemoState = (stateName, alt) => {
    if (!demoDog) return;
    demoDog.src = dogStateAssets[stateName];
    demoDog.dataset.dogState = stateName;
    demoDog.alt = alt;
    demoDog.classList.remove("dog-beat-pulse");
    void demoDog.offsetWidth;
    demoDog.classList.add("dog-beat-pulse");
  };
  notes.forEach((note, index) => later(() => {
    if (index === 4 && state.feelMode === "melody") {
      state.lessonMeasure = 1;
      render();
    }
    const actionIndex = index % actionStates.length;
    document.querySelectorAll("[data-action-step]").forEach(card => card.classList.toggle("active", Number(card.dataset.actionStep) === actionIndex));
    showDemoState(actionStates[actionIndex], `小狗正在领演：${actionLabels[actionIndex]}`);
    if (state.feelMode === "sing") {
      tone(note, 0.36, 0.055, "triangle");
      if (state.solfegeMode !== "turn") playSolfegeSample(syllables[index], note, 0.34, state.solfegeMode === "together" ? 0.12 : 0.2);
    } else {
      tone(note, 0.36, 0.08, "triangle");
    }
    if (index % 2 === 0) drum(0.35);
  }, index * beatDuration));
  later(() => {
    document.querySelectorAll("[data-action-step]").forEach(card => card.classList.remove("active"));
    showDemoState("highFive", "小狗完成示范，邀请大家击掌");
    state.classPlaying = false;
    render();
    showToast("旋律向上走时举高手，最后一拍停住");
  }, notes.length * beatDuration);
  later(() => showDemoState("ready", "小狗准备领演"), notes.length * beatDuration + 1400);
}

function toggleClassPlayback() {
  if (state.classPlaying) {
    clearTimers();
    stopBodyPlayback();
    stopSolfegeNodes();
    activeSolfegeAudios.forEach(audio => audio.pause());
    activeSolfegeAudios = [];
    state.classPlaying = false;
    state.solfegePlayingFull = false;
    state.solfegeActiveNoteIndex = null;
    render();
    return;
  }
  playClassSong();
}

function stopMicrophone() {
  micStream?.getTracks().forEach(track => track.stop());
  micStream = null;
}

function currentSolfegeRecordTarget() {
  const targets = solfegeRecordingTargets();
  return targets[Math.max(0, Math.min(targets.length - 1, state.solfegeRecordTargetIndex))];
}

function playCurrentSolfegeGuide() {
  const target = currentSolfegeRecordTarget();
  if (!target) return;
  stopSolfegeNodes();
  const ctx = getAudioContext();
  schedulePianoNote(target.frequency, ctx.currentTime + 0.03, 1.15, 0.18);
}

function previewCurrentSolfegeRecording() {
  const target = currentSolfegeRecordTarget();
  const recording = target && state.solfegeRecordings[target.key];
  if (!recording?.audioBuffer) return showToast("这个唱名还没有可试听的录音。");
  stopSolfegeNodes();
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = recording.audioBuffer;
  gain.gain.setValueAtTime(0.82, ctx.currentTime);
  source.connect(gain).connect(ctx.destination);
  source.start(ctx.currentTime + 0.03);
  activeSolfegeNodes.push(source);
}

function findSolfegeVoiceRange(audioBuffer) {
  const sampleRate = audioBuffer.sampleRate;
  const frameCount = audioBuffer.length;
  const channelCount = audioBuffer.numberOfChannels;
  if (!sampleRate || !frameCount || !channelCount) return null;
  const channels = Array.from({ length: channelCount }, (_, index) => audioBuffer.getChannelData(index));
  let peak = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    let value = 0;
    for (const channel of channels) value += Math.abs(channel[frame] || 0);
    peak = Math.max(peak, value / channelCount);
  }
  if (peak < 0.02) return null;
  const windowFrames = Math.max(1, Math.round(sampleRate * 0.02));
  const windowCount = Math.ceil(frameCount / windowFrames);
  const windowRms = Array.from({ length: windowCount }, (_, windowIndex) => {
    const from = windowIndex * windowFrames;
    const to = Math.min(frameCount, from + windowFrames);
    let squareSum = 0;
    for (let frame = from; frame < to; frame += 1) {
      let value = 0;
      for (const channel of channels) value += channel[frame] || 0;
      value /= channelCount;
      squareSum += value * value;
    }
    return Math.sqrt(squareSum / Math.max(1, to - from));
  });
  const sortedRms = [...windowRms].sort((a, b) => a - b);
  const referenceRms = sortedRms[Math.floor((sortedRms.length - 1) * 0.85)] || 0;
  const threshold = Math.max(0.012, referenceRms * 0.22);
  const active = windowRms.map(rms => rms >= threshold);
  const maxSilentGapWindows = 6;
  let runStart = -1;
  let lastActive = -1;
  let best = null;
  const finishRun = () => {
    if (runStart < 0 || lastActive < runStart) return;
    const candidate = { startWindow: runStart, endWindow: lastActive };
    if (!best || candidate.endWindow - candidate.startWindow > best.endWindow - best.startWindow) best = candidate;
    runStart = -1;
    lastActive = -1;
  };
  active.forEach((isActive, index) => {
    if (isActive) {
      if (runStart < 0) runStart = index;
      lastActive = index;
    } else if (runStart >= 0 && index - lastActive > maxSilentGapWindows) {
      finishRun();
    }
  });
  finishRun();
  if (!best) return null;
  const voiceStartFrame = best.startWindow * windowFrames;
  const voiceEndFrame = Math.min(frameCount, (best.endWindow + 1) * windowFrames);
  const validDuration = (voiceEndFrame - voiceStartFrame) / sampleRate;
  const paddingFrames = Math.round(sampleRate * 0.06);
  return {
    startFrame: Math.max(0, voiceStartFrame - paddingFrames),
    endFrame: Math.min(frameCount, voiceEndFrame + paddingFrames),
    validDuration,
    threshold
  };
}

function trimSolfegeRecordingBuffer(audioBuffer) {
  const range = findSolfegeVoiceRange(audioBuffer);
  if (!range || range.validDuration < SOLFEGE_MIN_VOICE_SECONDS) {
    const error = new Error("voice-too-short");
    error.code = "voice-too-short";
    error.validDuration = range?.validDuration || 0;
    throw error;
  }
  const ctx = getAudioContext();
  const length = Math.max(1, range.endFrame - range.startFrame);
  const trimmed = ctx.createBuffer(1, length, audioBuffer.sampleRate);
  const output = trimmed.getChannelData(0);
  const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) => audioBuffer.getChannelData(index));
  const fadeFrames = Math.min(Math.round(audioBuffer.sampleRate * 0.02), Math.floor(length / 2));
  for (let index = 0; index < length; index += 1) {
    let value = 0;
    for (const channel of channels) value += channel[range.startFrame + index] || 0;
    value /= channels.length;
    if (index < fadeFrames) value *= index / Math.max(1, fadeFrames);
    if (index >= length - fadeFrames) value *= (length - 1 - index) / Math.max(1, fadeFrames);
    output[index] = value;
  }
  return { audioBuffer: trimmed, validDuration: range.validDuration, trimmedDuration: trimmed.duration };
}

function encodeSolfegeWav(audioBuffer) {
  const samples = audioBuffer.getChannelData(0);
  const data = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(data);
  const writeText = (offset, text) => [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => {
    const limited = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, limited < 0 ? limited * 32768 : limited * 32767, true);
  });
  return new Blob([data], { type: "audio/wav" });
}

function openSolfegeRecordingDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("animal-music-solfege-voice", 1);
    request.addEventListener("upgradeneeded", () => {
      if (!request.result.objectStoreNames.contains("recordings")) request.result.createObjectStore("recordings", { keyPath: "key" });
    });
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

async function decodeSolfegeBlob(blob) {
  const data = await blob.arrayBuffer();
  return getAudioContext().decodeAudioData(data.slice(0));
}

async function persistSolfegeRecording(record) {
  const db = await openSolfegeRecordingDb();
  if (!db) return;
  await new Promise((resolve, reject) => {
    const request = db.transaction("recordings", "readwrite").objectStore("recordings").put(record);
    request.addEventListener("success", resolve, { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

async function hydrateSolfegeRecordings() {
  try {
    const db = await openSolfegeRecordingDb();
    if (!db) return;
    const recordings = await new Promise((resolve, reject) => {
      const request = db.transaction("recordings", "readonly").objectStore("recordings").getAll();
      request.addEventListener("success", () => resolve(request.result || []), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
    await Promise.all(recordings.map(async record => {
      try {
        const decoded = await decodeSolfegeBlob(record.blob);
        if (record.autoTrimmed) {
          state.solfegeRecordings[record.key] = { ...record, audioBuffer: decoded };
          return;
        }
        const processed = trimSolfegeRecordingBuffer(decoded);
        const blob = encodeSolfegeWav(processed.audioBuffer);
        const migrated = {
          ...record,
          blob,
          mimeType: blob.type,
          validDuration: processed.validDuration,
          trimmedDuration: processed.trimmedDuration,
          autoTrimmed: true
        };
        state.solfegeRecordings[record.key] = { ...migrated, audioBuffer: processed.audioBuffer };
        try { await persistSolfegeRecording(migrated); } catch {}
      } catch {}
    }));
  } catch {
    showToast("唱名仍可录制和试听，但当前浏览器暂时不能长期保存录音。");
  } finally {
    state.solfegeRecordingsReady = true;
    if (state.screen === "feel-sing" || (state.screen === "teacher" && state.teacherMode === "voicebank")) render();
  }
}

async function recordCurrentSolfegeTarget() {
  if (state.solfegeRecordStatus !== "idle") return;
  const target = currentSolfegeRecordTarget();
  if (!target) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    showToast("当前浏览器不支持录音，请先使用钢琴示范。");
    return;
  }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    state.solfegeRecordStatus = "countdown";
    render();
    playCurrentSolfegeGuide();
    await new Promise(resolve => setTimeout(resolve, 1250));
    const chunks = [];
    mediaRecorder = new MediaRecorder(micStream);
    mediaRecorder.addEventListener("dataavailable", event => { if (event.data.size) chunks.push(event.data); });
    mediaRecorder.addEventListener("stop", async () => {
      state.solfegeRecordStatus = "saving";
      const rawBlob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
      stopMicrophone();
      try {
        const rawBuffer = await decodeSolfegeBlob(rawBlob);
        const processed = trimSolfegeRecordingBuffer(rawBuffer);
        const blob = encodeSolfegeWav(processed.audioBuffer);
        const audioBuffer = processed.audioBuffer;
        const record = {
          key: target.key,
          solfege: target.solfege,
          frequency: target.frequency,
          blob,
          mimeType: blob.type,
          validDuration: processed.validDuration,
          trimmedDuration: processed.trimmedDuration,
          autoTrimmed: true,
          createdAt: Date.now()
        };
        state.solfegeRecordings[target.key] = { ...record, audioBuffer };
        try { await persistSolfegeRecording(record); } catch {}
        const targets = solfegeRecordingTargets();
        const nextMissing = targets.findIndex(item => !state.solfegeRecordings[item.key]);
        if (nextMissing >= 0) {
          state.solfegeRecordTargetIndex = nextMissing;
          showToast(`已自动剪切并保存，有效发音 ${processed.validDuration.toFixed(2)} 秒。`);
        } else {
          showToast("标准唱名已经全部录完，儿童端会自动使用老师录音。");
        }
      } catch (error) {
        if (error?.code === "voice-too-short") {
          showToast(`有效发音只有 ${Number(error.validDuration || 0).toFixed(2)} 秒，至少需要 ${SOLFEGE_MIN_VOICE_SECONDS} 秒，请重录。`);
        } else {
          showToast("这次录音没有保存成功，请再试一次。");
        }
      } finally {
        state.solfegeRecordStatus = "idle";
        render();
      }
    }, { once: true });
    mediaRecorder.start();
    state.solfegeRecordStatus = "recording";
    render();
    later(() => mediaRecorder?.state === "recording" && mediaRecorder.stop(), 2500);
  } catch {
    stopMicrophone();
    state.solfegeRecordStatus = "idle";
    render();
    showToast("没有获得麦克风权限，仍可继续使用钢琴示范。");
  }
}

function highlightBodyPattern(lesson, rate = 1) {
  const pattern = bodyDisplayPattern(lesson);
  const millisecondsPerBeat = 60000 / bodyLessonBpm(lesson) / rate;
  for (let bar = 0; bar < RECORD_BARS; bar += 1) {
    pattern.forEach((step, index) => later(() => {
      document.querySelectorAll("[data-body-step]").forEach(element => element.classList.toggle("active", Number(element.dataset.bodyStep) === index));
      const guide = document.querySelector("[data-body-guide]");
      if (guide) {
        guide.dataset.bodyGuide = step.action;
        guide.setAttribute("aria-label", `小狗示范${BODY_ACTIONS[step.action].label}`);
      }
    }, (bar * BEATS_PER_BAR + step.beat) * millisecondsPerBeat));
  }
}

// Keep the visual guide on the audio element's own clock. Timers gradually
// drift when a track is still loading or the browser briefly pauses playback.
function syncBodyPatternToAudio(lesson, audio) {
  const pattern = bodyDisplayPattern(lesson);
  const beatsPerSecond = bodyLessonBpm(lesson) / 60;
  const update = () => {
    if (activeBodyAudio !== audio || !state.classPlaying) return;
    const beatInBar = (Math.max(0, audio.currentTime) * beatsPerSecond) % BEATS_PER_BAR;
    const stepIndex = pattern.reduce((current, step, index) => step.beat <= beatInBar ? index : current, 0);
    const step = pattern[stepIndex];
    document.querySelectorAll("[data-body-step]").forEach(element => element.classList.toggle("active", Number(element.dataset.bodyStep) === stepIndex));
    const guide = document.querySelector("[data-body-guide]");
    if (guide && step) {
      guide.dataset.bodyGuide = step.action;
      guide.setAttribute("aria-label", `小狗示范${BODY_ACTIONS[step.action].label}`);
    }
    activeBodyFrame = requestAnimationFrame(update);
  };
  cancelAnimationFrame(activeBodyFrame);
  update();
}

function playBodyLesson(mode = "listen") {
  clearTimers();
  stopMusicAudio();
  stopBodyPlayback();
  const lesson = bodyLesson();
  const rate = mode === "slow" ? .75 : 1;
  const relativePath = mode === "practice" ? "preview/mix.wav" : "stems/dog.wav";
  activeBodyAudio = new Audio(bodyMusicPath(lesson, relativePath));
  activeBodyAudio.preload = "auto";
  activeBodyAudio.playbackRate = rate;
  activeBodyAudio.preservesPitch = true;
  activeBodyAudio.volume = mode === "practice" ? .82 : 1;
  state.bodyPlaybackMode = mode;
  state.classPlaying = true;
  render();
  const audio = activeBodyAudio;
  audio.addEventListener("ended", () => {
    if (activeBodyAudio !== audio) return;
    stopBodyPlayback();
    state.classPlaying = false;
    render();
  }, { once: true });
  audio.play().then(() => {
    if (activeBodyAudio === audio) syncBodyPatternToAudio(lesson, audio);
  }).catch(() => {
    stopBodyPlayback();
    state.classPlaying = false;
    render();
    showToast("节奏没有成功播放，请再试一次。");
  });
}

function releaseBodyDraft() {
  if (state.bodyRecording.audioUrl?.startsWith("blob:")) URL.revokeObjectURL(state.bodyRecording.audioUrl);
  state.bodyRecording = { status: "empty", audioUrl: null, blob: null };
}

function setBodyLessonIndex(index) {
  if (["countdown", "recording"].includes(state.bodyRecording.status)) return;
  clearTimers();
  stopBodyPlayback();
  releaseBodyDraft();
  state.bodyLessonIndex = Math.max(0, Math.min(BODY_LESSONS.length - 1, index));
  try { localStorage.setItem("animal-music-body-lesson", String(state.bodyLessonIndex)); } catch {}
  render();
}

function changeBodyLesson(direction) {
  setBodyLessonIndex(state.bodyLessonIndex + direction);
}

function selectBodyGroove(groove) {
  const grooveIndex = BODY_GROOVE_ORDER.indexOf(groove);
  if (grooveIndex < 0) return;
  const moodIndex = Math.max(0, BODY_MOOD_ORDER.indexOf(bodyLesson().mood));
  setBodyLessonIndex(grooveIndex * BODY_MOOD_ORDER.length + moodIndex);
}

async function recordBodyRhythm() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    showToast("当前浏览器不能录音，请在支持麦克风的设备上体验。");
    return;
  }
  clearTimers();
  stopBodyPlayback();
  releaseBodyDraft();
  state.bodyRecording.status = "countdown";
  render();
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const lesson = bodyLesson();
    const interval = 60000 / bodyLessonBpm(lesson);
    for (let beat = 0; beat < BEATS_PER_BAR; beat += 1) {
      later(() => {
        drum(beat === 0 ? .75 : .4);
        showToast(`准备 ${beat + 1} / 4`);
      }, beat * interval);
    }
    later(beginBodyCapture, BEATS_PER_BAR * interval);
  } catch {
    state.bodyRecording = { status: "empty", audioUrl: null, blob: null };
    stopMicrophone();
    render();
    showToast("没有获得麦克风权限，需要允许后才能录下节奏。");
  }
}

function beginBodyCapture() {
  const lesson = bodyLesson();
  state.bodyRecording.status = "recording";
  render();
  const chunks = [];
  mediaRecorder = new MediaRecorder(micStream);
  mediaRecorder.addEventListener("dataavailable", event => { if (event.data.size) chunks.push(event.data); });
  mediaRecorder.addEventListener("stop", () => {
    const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
    state.bodyRecording = { status: "ready", audioUrl: URL.createObjectURL(blob), blob };
    stopMicrophone();
    render();
    showToast("录好了，先听一听；满意后再保存。");
  }, { once: true });
  mediaRecorder.start();
  highlightBodyPattern(lesson);
  later(() => mediaRecorder?.state === "recording" && mediaRecorder.stop(), RECORD_BARS * BEATS_PER_BAR * 60000 / bodyLessonBpm(lesson));
}

function openBodyRecordingDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("animal-music-body-rhythms", 1);
    request.addEventListener("upgradeneeded", () => {
      if (!request.result.objectStoreNames.contains("recordings")) request.result.createObjectStore("recordings", { keyPath: "id" });
    });
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

async function hydrateBodyRecordings() {
  try {
    const savedIndex = Number(localStorage.getItem("animal-music-body-lesson"));
    if (Number.isInteger(savedIndex)) state.bodyLessonIndex = Math.max(0, Math.min(15, savedIndex));
  } catch {}
  try {
    const db = await openBodyRecordingDb();
    if (!db) return;
    const recordings = await new Promise((resolve, reject) => {
      const request = db.transaction("recordings", "readonly").objectStore("recordings").getAll();
      request.addEventListener("success", () => resolve(request.result || []), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
    recordings.forEach(recording => {
      state.bodyRecordings[recording.id] = { ...recording, audioUrl: URL.createObjectURL(recording.blob) };
    });
  } catch {
    showToast("节奏课程可以使用，但这台设备暂时不能长期保存录音。");
  } finally {
    state.bodyRecordingsReady = true;
    if (state.screen === "feel-body" || state.screen === "groove") render();
  }
}

async function saveBodyRecording() {
  const lesson = bodyLesson();
  const blob = state.bodyRecording.blob;
  if (!blob) return;
  const record = { id: lesson.id, mode: "table", blob, mimeType: blob.type, createdAt: Date.now() };
  try {
    const db = await openBodyRecordingDb();
    if (db) await new Promise((resolve, reject) => {
      const request = db.transaction("recordings", "readwrite").objectStore("recordings").put(record);
      request.addEventListener("success", resolve, { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
  } catch {
    showToast("无法长期保存，但本次打开页面期间仍可使用这份节奏。");
  }
  const oldUrl = state.bodyRecordings[lesson.id]?.audioUrl;
  if (oldUrl?.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
  state.bodyRecordings[lesson.id] = { ...record, audioUrl: URL.createObjectURL(blob) };
  releaseBodyDraft();
  render();
  showToast(state.bodyLessonIndex === 15 ? "16 份节奏全部完成！" : "这一课已保存，可以进入下一课。");
}

function currentBpm() {
  if (state.musicSource === "teacher" && state.selectedTeacherPack?.bpm) return Number(state.selectedTeacherPack.bpm);
  return grooveAudio[state.groove || "steady"].bpm;
}

function twoBarDuration() {
  return RECORD_BARS * BEATS_PER_BAR * 60 / currentBpm();
}

async function recordVoice() {
  if (state.voiceStickers.length >= MAX_VOICE_STICKERS) return showToast(`每件作品最多录制 ${MAX_VOICE_STICKERS} 张声音贴纸。`);
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    showToast("当前浏览器不能录音；请在支持麦克风的设备上体验这一步。" );
    return;
  }
  clearTimers();
  state.voiceRecorderOpen = true;
  releaseVoiceUrl(state.voice);
  state.voice = { status: "countdown", audioUrl: null, blob: null };
  render();
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    let beat = 0;
    const prepare = () => {
      document.querySelectorAll("[data-record-beat]").forEach(dot => dot.classList.toggle("active", Number(dot.dataset.recordBeat) === beat));
      drum(beat === 0 ? 0.7 : 0.35);
      beat += 1;
      if (beat < BEATS_PER_BAR) later(prepare, 60000 / currentBpm());
      else later(beginVoiceCapture, 60000 / currentBpm());
    };
    prepare();
  } catch {
    state.voice = { status: "empty", audioUrl: null, blob: null };
    render();
    showToast("没有获得麦克风权限；需要主动允许后才能录下声音。" );
  }
}

function saveVoiceSticker() {
  if (state.voice.status !== "ready" || !state.voice.audioUrl) return;
  if (state.voiceStickers.length >= MAX_VOICE_STICKERS) return showToast(`每件作品最多保存 ${MAX_VOICE_STICKERS} 张声音贴纸。`);
  const number = state.voiceStickers.length + 1;
  const item = {
    id: `voice-${Date.now().toString(36)}-${number}`,
    name: `我的声音 ${number}`,
    audioUrl: state.voice.audioUrl,
    blob: state.voice.blob,
    bpm: currentBpm(),
    bars: RECORD_BARS,
    durationSeconds: twoBarDuration()
  };
  state.voiceStickers.push(item);
  state.voice = { status: "empty", audioUrl: null, blob: null };
  state.voiceRecorderOpen = false;
  render();
  showToast(`${item.name}已经放进声音贴纸盒。`);
}

function cancelVoiceRecorder() {
  if (["countdown", "recording"].includes(state.voice.status)) return;
  releaseVoiceUrl(state.voice);
  state.voice = { status: "empty", audioUrl: null, blob: null };
  state.voiceRecorderOpen = false;
  render();
}

function beginVoiceCapture() {
  state.voice.status = "recording";
  render();
  const chunks = [];
  mediaRecorder = new MediaRecorder(micStream);
  mediaRecorder.addEventListener("dataavailable", event => { if (event.data.size) chunks.push(event.data); });
  mediaRecorder.addEventListener("stop", () => {
    const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
    state.voice = { status: "ready", audioUrl: URL.createObjectURL(blob), blob };
    stopMicrophone();
    render();
    showToast("声音贴纸做好了，先听一听吧。" );
  }, { once: true });
  mediaRecorder.start();
  const interval = 60000 / currentBpm();
  for (let beat = 0; beat < RECORD_BARS * BEATS_PER_BAR; beat += 1) {
    later(() => {
      document.querySelectorAll("[data-record-beat]").forEach(dot => dot.classList.toggle("active", Number(dot.dataset.recordBeat) === beat));
      tone(beat % BEATS_PER_BAR === 0 ? 880 : 660, 0.035, 0.04, "square");
    }, beat * interval);
  }
  later(() => mediaRecorder?.state === "recording" && mediaRecorder.stop(), RECORD_BARS * BEATS_PER_BAR * interval);
}

function bindArrangement() {
  if (state.screen !== "arrange") return;
  app.querySelectorAll("[data-sticker]").forEach(sticker => {
    sticker.addEventListener("click", () => { state.selectedAnimal = state.selectedAnimal === sticker.dataset.sticker ? null : sticker.dataset.sticker; render(); });
    sticker.addEventListener("dragstart", event => event.dataTransfer.setData("text/plain", JSON.stringify({ animal: sticker.dataset.sticker, from: null })));
  });
  app.querySelectorAll("[data-chip]").forEach(chip => {
    chip.addEventListener("click", event => { event.stopPropagation(); removeAnimal(chip.dataset.chip, Number(chip.dataset.from)); });
    chip.addEventListener("dragstart", event => event.dataTransfer.setData("text/plain", JSON.stringify({ animal: chip.dataset.chip, from: Number(chip.dataset.from) })));
  });
  app.querySelectorAll("[data-section]").forEach(section => {
    section.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      if (state.selectedAnimal) addAnimal(state.selectedAnimal, Number(section.dataset.section));
    });
    section.addEventListener("dragover", event => { event.preventDefault(); section.classList.add("drag-over"); });
    section.addEventListener("dragleave", () => section.classList.remove("drag-over"));
    section.addEventListener("drop", event => {
      event.preventDefault();
      const payload = JSON.parse(event.dataTransfer.getData("text/plain"));
      moveAnimal(payload.animal, payload.from, Number(section.dataset.section));
    });
  });
  const tray = app.querySelector("[data-tray]");
  tray?.addEventListener("dragover", event => event.preventDefault());
  tray?.addEventListener("drop", event => {
    event.preventDefault();
    const payload = JSON.parse(event.dataTransfer.getData("text/plain"));
    if (payload.from !== null) removeAnimal(payload.animal, payload.from);
  });
}

function setStageMotion({ entering = [], leaving = [] } = {}) {
  state.stageEntering = entering;
  state.stageLeaving = leaving;
  clearTimeout(stageMotionTimer);
  stageMotionTimer = setTimeout(() => {
    state.stageEntering = [];
    state.stageLeaving = [];
    if (state.screen === "arrange") render();
  }, 680);
}

function addAnimal(animal, sectionIndex) {
  if (state.sections[sectionIndex].includes(animal)) return showToast(`${stickerInfo(animal).name}已经在第 ${sectionIndex + 1} 段啦`);
  const isVisibleSection = !state.stageCompleted && sectionIndex === (state.playingSection ?? state.stageSection);
  state.sections[sectionIndex].push(animal);
  state.selectedAnimal = null;
  setStageMotion({ entering: isVisibleSection ? [animal] : [] });
  showToast(`${stickerInfo(animal).name}加入第 ${sectionIndex + 1} 段啦`);
  render();
}

function moveAnimal(animal, from, to) {
  if (from === to) return;
  const visibleSection = state.playingSection ?? state.stageSection;
  const entering = !state.stageCompleted && to === visibleSection ? [animal] : [];
  const leaving = !state.stageCompleted && from === visibleSection ? [animal] : [];
  if (from !== null && from !== to) state.sections[from] = state.sections[from].filter(key => key !== animal);
  if (!state.sections[to].includes(animal)) state.sections[to].push(animal);
  state.stageCompleted = false;
  setStageMotion({ entering, leaving });
  render();
}

function removeAnimal(animal, sectionIndex) {
  const isVisibleSection = !state.stageCompleted && sectionIndex === (state.playingSection ?? state.stageSection);
  state.sections[sectionIndex] = state.sections[sectionIndex].filter(key => key !== animal);
  state.stageCompleted = false;
  setStageMotion({ leaving: isVisibleSection ? [animal] : [] });
  showToast(`${stickerInfo(animal).name}在第 ${sectionIndex + 1} 段休息`);
  render();
}

function startAudioAt(audio, offsetSeconds, onError = () => {}) {
  const start = () => {
    try { audio.currentTime = Math.max(0, offsetSeconds || 0); } catch {}
    audio.play().catch(onError);
  };
  if (offsetSeconds > 0 && audio.readyState < 1) audio.addEventListener("loadedmetadata", start, { once: true });
  else start();
}

function playSection(sectionIndex, embellished = false, onDone, options = {}) {
  const section = state.sections[sectionIndex];
  const sectionDurationSeconds = state.musicSource === "teacher" && state.selectedTeacherPack?.durationSeconds
    ? state.selectedTeacherPack.durationSeconds
    : twoBarDuration();
  const offsetSeconds = Math.max(0, Math.min(sectionDurationSeconds, Number(options.startOffsetSeconds) || 0));
  const duration = Math.max(0, sectionDurationSeconds - offsetSeconds) * 1000;
  state.stageCompleted = false;
  state.playingSection = sectionIndex;
  state.stageOpen = true;
  state.stageSection = sectionIndex;
  render();
  stopMusicAudio();
  activeVoiceAudios.forEach(audio => audio.pause());
  activeVoiceAudios = [];
  activeStemAudios = stemAnimals
    .filter(animal => section.includes(animal))
    .map(animal => {
      const customDog = animal === "dog" && state.dogRhythmSource === "custom" ? state.bodyRecordings[currentPackId()] : null;
      const audio = new Audio(customDog?.audioUrl || musicPath(`stems/${animal}.wav`));
      audio.preload = "auto";
      audio.volume = embellished
        ? ({ dog: 0.92, bear: 1, cat: 0.88, lion: 0.94 }[animal] || 1)
        : 0.9;
      startAudioAt(audio, offsetSeconds, () => showToast("音乐没有成功播放，请再试一次。"));
      return audio;
    });
  section.filter(isVoiceStickerKey).forEach(key => {
    const sticker = voiceStickerForKey(key);
    if (!sticker?.audioUrl) return;
    const audio = new Audio(sticker.audioUrl);
    audio.volume = embellished ? 0.82 : 0.94;
    activeVoiceAudios.push(audio);
    startAudioAt(audio, offsetSeconds);
  });
  later(() => {
    activeStemAudios = [];
    activeVoiceAudios.forEach(audio => audio.pause());
    activeVoiceAudios = [];
    if (onDone) {
      onDone();
      return;
    }
    state.playingSection = null;
    render();
  }, duration);
}

function stopComposition() {
  clearTimers();
  stopMusicAudio();
  stopPoemAudio();
  activeVoiceAudios.forEach(audio => audio.pause());
  activeVoiceAudios = [];
  state.playingSection = null;
  state.performancePreparing = false;
  state.stageCompleted = false;
  render();
  showToast("已暂停，可以继续修改或重新播放。");
}

async function loadCompositionBuffer(url, ctx) {
  if (!compositionBufferCache.has(url)) {
    compositionBufferCache.set(url, fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(data => ctx.decodeAudioData(data.slice(0)))
      .catch(error => {
        compositionBufferCache.delete(url);
        throw error;
      }));
  }
  return compositionBufferCache.get(url);
}

async function playAll(embellished = false) {
  clearTimers();
  stopMusicAudio();
  activeVoiceAudios.forEach(audio => audio.pause());
  activeVoiceAudios = [];
  const token = compositionPlaybackToken;
  const ctx = getAudioContext();
  const unlockSource = ctx.createBufferSource();
  unlockSource.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  unlockSource.connect(ctx.destination);
  unlockSource.start();

  state.stageOpen = true;
  state.stageCompleted = false;
  state.playingSection = 0;
  state.stageSection = 0;
  render();

  const sectionDuration = state.musicSource === "teacher" && state.selectedTeacherPack?.durationSeconds
    ? state.selectedTeacherPack.durationSeconds
    : twoBarDuration();
  const audioEntries = new Map();
  state.sections.forEach(section => {
    section.filter(animal => stemAnimals.includes(animal)).forEach(animal => {
      const customDog = animal === "dog" && state.dogRhythmSource === "custom" ? state.bodyRecordings[currentPackId()] : null;
      const url = customDog?.audioUrl || musicPath(`stems/${animal}.wav`);
      audioEntries.set(`stem:${animal}:${url}`, { type: "stem", animal, url });
    });
    section.filter(isVoiceStickerKey).forEach(key => {
      const sticker = voiceStickerForKey(key);
      if (sticker?.audioUrl) audioEntries.set(`voice:${key}:${sticker.audioUrl}`, { type: "voice", key, url: sticker.audioUrl });
    });
  });

  const loaded = await Promise.all([...audioEntries.values()].map(async entry => {
    try {
      return { ...entry, buffer: await loadCompositionBuffer(entry.url, ctx) };
    } catch {
      return null;
    }
  }));
  if (token !== compositionPlaybackToken) return;
  const buffers = loaded.filter(Boolean);
  if (!buffers.length) {
    state.playingSection = null;
    render();
    showToast("音乐没有成功加载，请再试一次。");
    return;
  }

  const entryByStem = new Map(buffers.filter(entry => entry.type === "stem").map(entry => [entry.animal, entry]));
  const entryByVoice = new Map(buffers.filter(entry => entry.type === "voice").map(entry => [entry.key, entry]));
  const startTime = ctx.currentTime + 0.08;
  for (let slot = 0; slot < 8; slot += 1) {
    const sectionIndex = slot % 4;
    const section = state.sections[sectionIndex];
    const playAt = startTime + slot * sectionDuration;
    section.forEach(key => {
      const entry = stemAnimals.includes(key) ? entryByStem.get(key) : entryByVoice.get(key);
      if (!entry) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = entry.buffer;
      gain.gain.value = entry.type === "voice"
        ? (embellished ? 0.82 : 0.94)
        : (embellished ? ({ dog: 0.92, bear: 1, cat: 0.88, lion: 0.94 }[key] || 1) : 0.9);
      source.connect(gain).connect(ctx.destination);
      source.start(playAt, 0, Math.min(sectionDuration, entry.buffer.duration));
      activeCompositionSources.push(source);
    });
    later(() => {
      if (token !== compositionPlaybackToken) return;
      state.playingSection = sectionIndex;
      state.stageSection = sectionIndex;
      state.stageOpen = true;
      render();
      if (slot === 4) showToast("第一遍听完了，第二遍可以一起跟着演。");
    }, Math.max(0, (playAt - ctx.currentTime) * 1000));
  }
  later(() => {
    if (token !== compositionPlaybackToken) return;
    activeCompositionSources = [];
    state.playingSection = null;
    state.stageCompleted = true;
    render();
    showToast("演奏完成，这是属于你的音乐");
  }, Math.max(0, (startTime + 8 * sectionDuration - ctx.currentTime) * 1000));
}

function beginRefine() {
  clearTimers();
  state.poetryPreviewMode = null;
  state.screen = "processing";
  render();
  later(() => setScreen("refine"), 1800);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result), { once: true });
    reader.addEventListener("error", () => reject(reader.error), { once: true });
    reader.readAsDataURL(blob);
  });
}

function startPerformance() {
  clearTimers();
  state.performancePreparing = true;
  render();
  const interval = 60000 / currentBpm();
  for (let beat = 0; beat < BEATS_PER_BAR; beat += 1) {
    later(() => {
      drum(beat === 0 ? 0.7 : 0.35);
      showToast(`准备拍 ${beat + 1} / ${BEATS_PER_BAR}`);
    }, beat * interval);
  }
  later(() => {
    state.performancePreparing = false;
    toast.classList.remove("show");
    render();
    playAll(true);
  }, BEATS_PER_BAR * interval);
}

async function persistCurrentWork() {
  const voiceStickers = await Promise.all(state.voiceStickers.map(async item => ({
    id: item.id,
    name: item.name,
    bpm: item.bpm,
    bars: item.bars,
    durationSeconds: item.durationSeconds,
    audioUrl: item.audioUrl?.startsWith("data:") ? item.audioUrl : item.blob ? await blobToDataUrl(item.blob) : null
  })));
  localStorage.setItem("animal-music-postcard", JSON.stringify({
    mood: state.mood,
    title: state.title,
    message: state.message,
    sections: state.sections,
    groove: state.groove,
    dogRhythmSource: state.dogRhythmSource,
    musicSource: state.musicSource,
    teacherPack: state.selectedTeacherPack,
    voiceStickers: voiceStickers.filter(item => item.audioUrl)
  }));
}

async function savePostcard() {
  try {
    await persistCurrentWork();
  } catch {
    showToast("当前浏览器不允许本地保存，但作品仍保留在本次体验中");
    render();
    return;
  }
  state.saved = true;
  render();
  showToast("已经保存在这台设备上了");
}

function confirmShare() {
  state.modal = null;
  render();
  showToast("演示：私密链接已生成，24 小时后失效");
}

render();
loadTeacherMusicPacks();
hydrateBodyRecordings();
hydrateSolfegeRecordings();
hydrateFixedDemoPack();
