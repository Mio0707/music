const fs = require("fs");
const path = require("path");
const vm = require("vm");

const appElement = {
  innerHTML: "",
  querySelector: () => null,
  querySelectorAll: () => []
};
const toastElement = { textContent: "", classList: { add() {}, remove() {} } };
const context = {
  console,
  Math,
  Float32Array,
  Array,
  Object,
  Number,
  String,
  JSON,
  structuredClone,
  document: {
    querySelector: selector => selector === "#app" ? appElement : toastElement,
    querySelectorAll: () => []
  },
  window: { scrollTo() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  requestAnimationFrame: callback => { callback(); return 0; },
  cancelAnimationFrame() {},
  setTimeout,
  clearTimeout,
  Audio: function Audio() {}
};
vm.createContext(context);
const appPath = path.join(__dirname, "..", "app.js");
const source = `${fs.readFileSync(appPath, "utf8")}\nglobalThis.__analyzeAudioBuffer = analyzeAudioBuffer;\nglobalThis.__analyzeAudioBufferWithProgress = analyzeAudioBufferWithProgress;\nglobalThis.__gesturePacingForMeasures = gesturePacingForMeasures;\nglobalThis.__buildAdaptiveMeasures = buildAdaptiveMeasures;\nglobalThis.__render = render;\nglobalThis.__saveVoiceSticker = saveVoiceSticker;\nglobalThis.__musicPath = musicPath;\nglobalThis.__analysisState = state;`;
vm.runInContext(source, context);

context.__analysisState.screen = "teacher";
context.__analysisState.teacherMode = "hub";
context.__render();
if (!appElement.innerHTML.includes("旋律手势分析") || !appElement.innerHTML.includes("贴纸旋律创作")) throw new Error("教师备课首页没有同时显示两大功能");
context.__analysisState.teacherMode = "creation";
context.__render();
if (!appElement.innerHTML.includes("children-music-studio/")) throw new Error("儿童音乐设计台没有接入教师备课平台");
if (appElement.innerHTML.includes("独立窗口打开")) throw new Error("儿童音乐设计台仍要求从独立窗口打开");
if (appElement.innerHTML.includes("返回备课首页")) throw new Error("贴纸旋律创作页仍显示重复的返回按钮");
if (appElement.innerHTML.includes("工作台已经整合到备课平台")) throw new Error("贴纸旋律创作页仍显示重复的整合说明");
context.__analysisState.teacherMode = "analysis";
context.__analysisState.screen = "mood";
context.__analysisState.teacherMusicLoading = false;
context.__analysisState.teacherMusicOpen = true;
context.__analysisState.teacherMusicPacks = [{ packId: "teacher-rain", version: "v01", title: "雨后晴天蹦蹦跳", moodSummary: "夏天，下完雨后天晴了我很高兴", grooveSummary: "蹦蹦跳跳回家", bpm: 112 }];
context.__render();
if (!appElement.innerHTML.includes("自定义旋律") || !appElement.innerHTML.includes("雨后晴天蹦蹦跳") || !appElement.innerHTML.includes("直接创作")) throw new Error("老师自定义音乐没有出现在选择感觉页");
context.__analysisState.screen = "arrange";
context.__analysisState.musicSource = "teacher";
context.__analysisState.selectedTeacherPack = context.__analysisState.teacherMusicPacks[0];
context.__render();
if (!appElement.innerHTML.includes("声音贴纸盒") || !appElement.innerHTML.includes("录制声音贴纸") || !appElement.innerHTML.includes("112 BPM")) throw new Error("编排页没有接入按当前速度录制声音贴纸的入口");
if (context.__musicPath("stems/dog.wav") !== "/children-music-studio/frontend-music/teacher-rain/v01/stems/dog.wav") throw new Error("老师音乐没有读取已发布的正式分轨");
context.__analysisState.voice = { status: "ready", audioUrl: "blob:voice-one", blob: {} };
context.__saveVoiceSticker();
context.__analysisState.voiceRecorderOpen = true;
context.__analysisState.voice = { status: "ready", audioUrl: "blob:voice-two", blob: {} };
context.__saveVoiceSticker();
if (context.__analysisState.voiceStickers.length !== 2 || !appElement.innerHTML.includes("我的声音 1") || !appElement.innerHTML.includes("我的声音 2")) throw new Error("编排页不能连续创建多张声音贴纸");

const sampleRate = 4000;
const duration = 40;
const samples = new Float32Array(sampleRate * duration);
for (let index = 0; index < samples.length; index += 1) {
  const time = index / sampleRate;
  const phrasePosition = (time % 4) / 4;
  const frequency = 180 + 90 * (phrasePosition < 0.5 ? phrasePosition * 2 : (1 - phrasePosition) * 2);
  let value = Math.sin(2 * Math.PI * frequency * time) * 0.18;
  const beatPosition = time % 0.5;
  if (beatPosition < 0.035) value += (1 - beatPosition / 0.035) * 0.55;
  samples[index] = Math.max(-1, Math.min(1, value));
}

const result = context.__analyzeAudioBuffer({
  duration,
  sampleRate,
  length: samples.length,
  numberOfChannels: 1,
  getChannelData: () => samples
});
if (result.meta.meter !== "4/4") throw new Error(`四拍基准测试被错误识别为 ${result.meta.meter}`);

const paddedDuration = 48;
const paddedSamples = new Float32Array(sampleRate * paddedDuration);
for (let index = 0; index < paddedSamples.length; index += 1) {
  const time = index / sampleRate;
  const musicalTime = time - 6;
  if (musicalTime < 0 || musicalTime >= 32) continue;
  const phrasePosition = (musicalTime % 4) / 4;
  const frequency = 180 + 90 * (phrasePosition < 0.5 ? phrasePosition * 2 : (1 - phrasePosition) * 2);
  let value = Math.sin(2 * Math.PI * frequency * musicalTime) * 0.18;
  const beatPosition = musicalTime % 0.5;
  if (beatPosition < 0.035) value += (1 - beatPosition / 0.035) * 0.55;
  paddedSamples[index] = Math.max(-1, Math.min(1, value));
}
const paddedResult = context.__analyzeAudioBuffer({
  duration: paddedDuration,
  sampleRate,
  length: paddedSamples.length,
  numberOfChannels: 1,
  getChannelData: () => paddedSamples
});
if (paddedResult.meta.firstDownbeat < 5.5) throw new Error("文件开头的空白被错误计算成音乐小节");
if (paddedResult.meta.trailingSilentMeasureCount < 2) throw new Error("文件结尾的静音小节没有被排除");
if (paddedResult.groups[paddedResult.groups.length - 1].end > 39.5) throw new Error("手势时间线延伸到了结尾静音区");

const internalRestSamples = samples.slice();
for (let index = Math.floor(16.5 * sampleRate); index < Math.floor(18.5 * sampleRate); index += 1) internalRestSamples[index] = 0;
const internalRestResult = context.__analyzeAudioBuffer({
  duration,
  sampleRate,
  length: internalRestSamples.length,
  numberOfChannels: 1,
  getChannelData: () => internalRestSamples
});
if (!internalRestResult.groups.some(group => group.gestureIds.includes("rest_line"))) throw new Error("歌曲中间的完整休止没有匹配到水平线手势");

const threeBeatSamples = new Float32Array(sampleRate * duration);
for (let index = 0; index < threeBeatSamples.length; index += 1) {
  const time = index / sampleRate;
  let value = Math.sin(2 * Math.PI * 220 * time) * 0.08;
  const beatPosition = time % 0.5;
  const beatIndex = Math.floor(time / 0.5);
  if (beatPosition < 0.035) {
    const accent = beatIndex % 3 === 0 ? 0.8 : 0.24;
    value += (1 - beatPosition / 0.035) * accent;
  }
  threeBeatSamples[index] = Math.max(-1, Math.min(1, value));
}
const threeBeatResult = context.__analyzeAudioBuffer({
  duration,
  sampleRate,
  length: threeBeatSamples.length,
  numberOfChannels: 1,
  getChannelData: () => threeBeatSamples
});
if (threeBeatResult.meta.meter !== "3/4") throw new Error(`三拍重音测试被错误识别为 ${threeBeatResult.meta.meter}`);

const slowPacing = context.__gesturePacingForMeasures([{ start: 0, end: 4.2 }, { start: 4.2, end: 8.4 }]);
if (slowPacing.barsPerGesture !== 1) throw new Error("慢节奏音乐没有保留一小节一个手势");

const driftFramesPerSecond = 50;
const driftOnset = new Float32Array(driftFramesPerSecond * 30);
const expectedDriftBeats = [];
let driftTime = 0.5;
for (let beat = 0; beat < 48; beat += 1) {
  expectedDriftBeats.push(driftTime);
  driftOnset[Math.round(driftTime * driftFramesPerSecond)] = beat % 4 === 0 ? 1 : 0.55;
  driftTime += 0.5 + beat * 0.0012;
}
const driftTimeline = context.__buildAdaptiveMeasures(
  { onset: driftOnset, framesPerSecond: driftFramesPerSecond },
  { beatDuration: 0.5, firstDownbeat: 0.5, beatsPerMeasure: 4 },
  29
);
const trackedBeat = driftTimeline.beatTimes[40];
if (Math.abs(trackedBeat - expectedDriftBeats[40]) > 0.045) throw new Error("速度变化后节拍线出现明显累计偏移");

const sixEightSamples = new Float32Array(sampleRate * duration);
for (let index = 0; index < sixEightSamples.length; index += 1) {
  const time = index / sampleRate;
  let value = Math.sin(2 * Math.PI * 196 * time) * 0.05;
  const beatPosition = time % 0.3;
  const beatIndex = Math.floor(time / 0.3);
  if (beatPosition < 0.03) {
    const position = beatIndex % 6;
    const accent = position === 0 ? 0.9 : position === 3 ? 0.48 : 0.18;
    value += (1 - beatPosition / 0.03) * accent;
  }
  sixEightSamples[index] = Math.max(-1, Math.min(1, value));
}
const sixEightResult = context.__analyzeAudioBuffer({
  duration,
  sampleRate,
  length: sixEightSamples.length,
  numberOfChannels: 1,
  getChannelData: () => sixEightSamples
});
if (sixEightResult.meta.meter !== "6/8") throw new Error(`六八拍复合重音测试被错误识别为 ${sixEightResult.meta.meter}`);

if (!result.groups.length) throw new Error("没有生成小节分组");
if (result.meta.measureCount < 2) throw new Error("没有识别到足够的小节");
if (result.meta.measureCount <= 16) throw new Error("分析仍被错误地限制在前 16 小节");
if (result.meta.barsPerGesture !== 2) throw new Error("快节奏音乐没有采用两小节一个手势");
if (!result.groups.every(group => group.start < group.end && group.gestureIds.length >= 1)) throw new Error("分组或手势结果无效");
if (!result.groups.slice(0, -1).every(group => group.mode === "merged" && group.gestureIds.length === 1)) throw new Error("快节奏分组仍出现了过快的逐小节手势");
let identicalRun = 1;
for (let index = 1; index < result.groups.length; index += 1) {
  identicalRun = result.groups[index].gestureIds[0] === result.groups[index - 1].gestureIds[0] ? identicalRun + 1 : 1;
  if (identicalRun > 2) throw new Error("同一手势连续出现超过两组");
}
const finalGroup = result.groups[result.groups.length - 1];
if (result.meta.measureCount % 2 && finalGroup.bars[0] !== finalGroup.bars[1]) throw new Error("最后一个单独小节没有被保留");

const gestureLibrary = JSON.parse(fs.readFileSync(path.join(__dirname, "../assets/gestures/gesture-library.json"), "utf8"));
const carmenPlan = JSON.parse(fs.readFileSync(path.join(__dirname, "../assets/music/carmen/gesture-plan.json"), "utf8"));
const gestureIds = new Set(gestureLibrary.gestures.map(gesture => gesture.id));
if (carmenPlan.groups.length !== 46) throw new Error("《卡门》课程手势方案不是完整的 46 组");
if (carmenPlan.groupStartSeconds.length !== carmenPlan.groups.length) throw new Error("《卡门》课程时间轴与手势组数量不一致");
if (!carmenPlan.groupStartSeconds.every((start, index, starts) => index === 0 || start > starts[index - 1])) throw new Error("《卡门》课程时间轴没有按顺序递增");
if (carmenPlan.lessonEndSec <= carmenPlan.groupStartSeconds.at(-1)) throw new Error("《卡门》课程结束时间无效");
carmenPlan.groups.forEach((group, index) => {
  const expectedStart = index * 2 + 1;
  if (group.bars[0] !== expectedStart || group.bars[1] !== expectedStart + 1) throw new Error("《卡门》课程手势方案的小节编号不连续");
  if (!group.gestureIds.every(id => gestureIds.has(id))) throw new Error("《卡门》课程手势方案包含不存在的手势");
});
console.log(JSON.stringify({ meta: result.meta, firstGroup: result.groups[0], groupCount: result.groups.length }, null, 2));

(async () => {
  const progressiveResult = await context.__analyzeAudioBufferWithProgress({
    duration,
    sampleRate,
    length: samples.length,
    numberOfChannels: 1,
    getChannelData: () => samples
  });
  if (progressiveResult.meta.measureCount !== result.meta.measureCount) throw new Error("分阶段分析与直接分析结果不一致");
  if (context.__analysisState.teacherAnalysisProgress.percent !== 100) throw new Error("分析进度没有走到完成");
  console.log(JSON.stringify({ progressive: true, finalProgress: context.__analysisState.teacherAnalysisProgress }, null, 2));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
