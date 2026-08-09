const fs = require("fs");
const path = require("path");
const vm = require("vm");

const prototypeRoot = path.join(__dirname, "..");
const musicRoot = path.join(prototypeRoot, "assets", "music");
const moods = ["happy", "calm", "brave", "longing"];
const grooves = ["steady", "bounce", "sway", "forward"];
const expectedPatterns = {
  steady: [[0, "dong"], [1, "da"], [2, "dong"], [3, "da"]],
  bounce: [[0, "dong"], [.5, "ci"], [1, "dong"], [1.5, "ci"], [2, "dong"], [2.5, "ci"], [3, "dong"], [3.5, "ci"]],
  sway: [[0, "dong"], [.667, "ci"], [1, "da"], [1.667, "ci"], [2, "dong"], [2.667, "ci"], [3, "da"], [3.667, "ci"]],
  forward: [[0, "dong"], [.5, "ci"], [1, "da"], [1.5, "dong"], [2, "dong"], [2.5, "ci"], [3, "da"], [3.5, "dong"]]
};

function wavWindowRms(filePath, seconds) {
  const data = fs.readFileSync(filePath);
  const channels = data.readUInt16LE(22);
  const sampleRate = data.readUInt32LE(24);
  let offset = 12;
  let pcmStart = -1;
  let pcmBytes = 0;
  while (offset + 8 <= data.length) {
    const id = data.toString("ascii", offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    if (id === "data") { pcmStart = offset + 8; pcmBytes = size; break; }
    offset += 8 + size + (size % 2);
  }
  if (pcmStart < 0) throw new Error(`WAV 缺少 data 区块：${filePath}`);
  const firstFrame = Math.round((seconds + 0.005) * sampleRate);
  const frameCount = Math.round(0.115 * sampleRate);
  let sum = 0;
  let count = 0;
  for (let frame = firstFrame; frame < firstFrame + frameCount; frame += 1) {
    const frameOffset = pcmStart + frame * channels * 2;
    if (frameOffset + channels * 2 > pcmStart + pcmBytes) break;
    let sample = 0;
    for (let channel = 0; channel < channels; channel += 1) sample += data.readInt16LE(frameOffset + channel * 2) / 32768;
    sample /= channels;
    sum += sample * sample;
    count += 1;
  }
  return Math.sqrt(sum / Math.max(1, count));
}

function actionAt(events, groove) {
  const instruments = new Set(events.filter(event => groove !== "steady" || event.instrument !== "hihat").map(event => event.instrument));
  if (instruments.has("kick")) return "dong";
  if (instruments.has("snare")) return "da";
  return instruments.has("hihat") ? "ci" : null;
}

for (const groove of grooves) {
  for (const mood of moods) {
    const scorePath = path.join(musicRoot, `${mood}_${groove}`, "v01", "score.json");
    const score = JSON.parse(fs.readFileSync(scorePath, "utf8"));
    const firstBar = new Map();
    score.drumGrid.filter(event => event.beat < 4).forEach(event => {
      const events = firstBar.get(event.beat) || [];
      events.push(event);
      firstBar.set(event.beat, events);
    });
    const actual = [...firstBar.entries()].sort((a, b) => a[0] - b[0]).map(([beat, events]) => [beat, actionAt(events, groove)]).filter(([, action]) => action);
    if (JSON.stringify(actual) !== JSON.stringify(expectedPatterns[groove])) {
      throw new Error(`${mood}_${groove} 的动作教学没有对应 score.json 节奏`);
    }
  }
}

const played = [];
class FakeAudio {
  constructor(src) { this.src = src; this.currentTime = 0; this.volume = 1; played.push(this); }
  play() { this.didPlay = true; return Promise.resolve(); }
  pause() {}
  load() {}
  addEventListener() {}
}
const appElement = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
const toastElement = { textContent: "", classList: { add() {}, remove() {} } };
const scheduled = [];
const context = {
  console, Math, Float32Array, Array, Object, Number, String, JSON, structuredClone,
  document: { querySelector: selector => selector === "#app" ? appElement : toastElement, querySelectorAll: () => [] },
  window: { scrollTo() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame() {},
  setTimeout(callback, delay) { if (delay === 0) callback(); else scheduled.push(callback); return scheduled.length; },
  clearTimeout() {},
  Audio: FakeAudio
};
vm.createContext(context);
const appSource = fs.readFileSync(path.join(prototypeRoot, "app.js"), "utf8");
vm.runInContext(`${appSource}\nglobalThis.__state = state; globalThis.__render = render; globalThis.__selectBodyGroove = selectBodyGroove; globalThis.__previewPack = previewPack; globalThis.__playSection = playSection; globalThis.__lessons = BODY_LESSONS; globalThis.__patterns = BODY_GROOVE_PATTERNS; globalThis.__bodyActions = BODY_ACTIONS; globalThis.__bodyPatternFromScore = bodyPatternFromScore;`, context);

if (context.__lessons.length !== 16) throw new Error("身体节奏课程不是 16 课");
const expectedOrder = grooves.flatMap(groove => moods.map(mood => `${mood}_${groove}`));
if (JSON.stringify(context.__lessons.map(lesson => lesson.id)) !== JSON.stringify(expectedOrder)) throw new Error("16 课的律动与心情顺序不正确");
for (const groove of grooves) {
  const actual = context.__patterns[groove].map(step => [step.beat, step.action]);
  if (JSON.stringify(actual) !== JSON.stringify(expectedPatterns[groove])) throw new Error(`${groove} 的页面动作序列不正确`);
}
const jsonPattern = context.__bodyPatternFromScore({ drumGrid: [
  { instrument: "kick", beat: 0 }, { instrument: "hihat", beat: 0 },
  { instrument: "hihat", beat: 0.5 }, { instrument: "snare", beat: 1 },
  { instrument: "hihat", beat: 1 }
] });
if (JSON.stringify(jsonPattern.map(step => [step.beat, step.action])) !== JSON.stringify([[0, "dong"], [.5, "ci"], [1, "da"]])) throw new Error("JSON 鼓点没有正确转换为身体动作");

context.__state.screen = "feel-body";
context.__state.bodyLessonIndex = 0;
context.__render();
for (const requiredText of ["桌面节奏课 · 1 / 16", "敲桌面", "拍手", "开始录制"]) {
  if (!appElement.innerHTML.includes(requiredText)) throw new Error(`身体节奏课程页面缺少：${requiredText}`);
}
if (!appElement.innerHTML.includes("assets/stickers/body-rhythm/dog-table-actions.png")) throw new Error("最终小狗动作图没有接入课程页面");
if (!appElement.innerHTML.includes('data-body-guide="dong"')) throw new Error("课程没有以单动作图片开始");
if ((appElement.innerHTML.match(/data-body-step=/g) || []).length !== 4) throw new Error("稳稳走没有只显示一小节四个主节拍动作");
if (context.__bodyActions.ci.label !== "敲桌沿") throw new Error("桌沿动作映射丢失");
for (const grooveName of ["稳稳走", "蹦蹦跳", "摇一摇", "向前冲"]) {
  if (!appElement.innerHTML.includes(grooveName)) throw new Error(`身体节奏页缺少律动切换按钮：${grooveName}`);
}

for (const mood of moods) {
  const dogPath = path.join(musicRoot, `${mood}_steady`, "v01", "stems", "dog.wav");
  const secondsPerBeat = 60 / 88;
  const mainHits = [0, 1, 2, 3].map(beat => wavWindowRms(dogPath, beat * secondsPerBeat));
  const offbeats = [0.5, 1.5, 2.5, 3.5].map(beat => wavWindowRms(dogPath, beat * secondsPerBeat));
  if (Math.min(...mainHits) < 0.005 || Math.max(...offbeats) > 0.002) {
    throw new Error(`${mood}_steady 的小狗音频不符合四个整数拍主节奏`);
  }
}
if (!appElement.innerHTML.includes("动 · 打 · 动 · 打")) throw new Error("稳稳走没有显示动打动打主节奏型");
context.__selectBodyGroove("bounce");
if (context.__state.bodyLessonIndex !== 4 || !appElement.innerHTML.includes("蹦蹦跳 · 开心")) throw new Error("切换蹦蹦跳时课程索引错误");
if (!appElement.innerHTML.includes("动 · 次 · 动 · 次 · 动 · 次 · 动 · 次")) throw new Error("蹦蹦跳没有显示每拍弹跳重拍节奏型");
context.__state.bodyLessonIndex = 2;
context.__selectBodyGroove("forward");
if (context.__state.bodyLessonIndex !== 14 || !appElement.innerHTML.includes("向前冲 · 勇敢")) throw new Error("切换律动时没有保留当前心情");

context.__state.screen = "arrange";
context.__state.mood = "happy";
context.__state.groove = "bounce";
context.__state.dogRhythmSource = "custom";
context.__state.bodyRecordings.happy_bounce = { audioUrl: "blob:my-dog-rhythm" };
context.__state.voiceStickers = [{ id: "clip-1", name: "我的声音 1", audioUrl: "blob:child-recording", blob: {}, bpm: 96 }];
context.__state.sections = [["dog", "bear", "cat", "lion", "voice:clip-1"], [], [], []];
played.length = 0;
context.__playSection(0);

if (!played.some(audio => audio.src === "blob:my-dog-rhythm" && audio.didPlay)) throw new Error("我的小狗节奏没有接入单段试听");
if (played.some(audio => audio.src.endsWith("/stems/dog.wav") && audio.didPlay)) throw new Error("选择我的录制后仍播放系统小狗分轨");
for (const animal of ["bear", "cat", "lion"]) {
  if (!played.some(audio => audio.src.endsWith(`/stems/${animal}.wav`) && audio.didPlay)) throw new Error(`我的节奏混音缺少 ${animal} 分轨`);
}
if (!played.some(audio => audio.src === "blob:child-recording" && audio.didPlay)) throw new Error("接入小狗录音后破坏了原有儿童录音贴纸");

played.length = 0;
context.__state.packPreviewing = false;
context.__previewPack();
if (!played.some(audio => audio.src === "blob:my-dog-rhythm" && audio.didPlay)) throw new Error("创作页完整乐队试听没有使用我的小狗节奏");
for (const animal of ["bear", "cat", "lion"]) {
  if (!played.some(audio => audio.src.endsWith(`/stems/${animal}.wav`) && audio.didPlay)) throw new Error(`完整乐队试听缺少 ${animal} 分轨`);
}

console.log(JSON.stringify({ lessons: 16, scorePacksChecked: 16, customDogMixed: true, childRecordingPreserved: true }, null, 2));
