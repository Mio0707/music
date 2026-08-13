const fs = require("fs");
const path = require("path");
const vm = require("vm");

const appElement = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
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
  location: { protocol: "http:" },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  requestAnimationFrame: callback => { callback(); return 0; },
  cancelAnimationFrame() {},
  setTimeout,
  clearTimeout,
  Audio: function Audio() {}
};
vm.createContext(context);
const appPath = path.join(__dirname, "..", "app.js");
const source = `${fs.readFileSync(appPath, "utf8")}
globalThis.__dongfanghong = DONGFANGHONG_SCORE;
globalThis.__state = state;
globalThis.__renderFeelSing = renderFeelSing;
globalThis.__renderTeacherHub = renderTeacherHub;
globalThis.__renderTeacherScore = renderTeacherScore;
globalThis.__renderTeacherVoiceBank = renderTeacherVoiceBank;
globalThis.__loadScoreDemo = loadScoreDemo;
globalThis.__scoreReviewGroups = scoreReviewGroups;
globalThis.__solfegePlaybackNotes = solfegePlaybackNotes;
globalThis.__solfegeSourceFrequencies = SOLFEGE_SOURCE_FREQUENCIES;
globalThis.__solfegeRecordingTargets = solfegeRecordingTargets;
globalThis.__teacherVoiceSampleForNote = teacherVoiceSampleForNote;
globalThis.__findSolfegeVoiceRange = findSolfegeVoiceRange;`;
vm.runInContext(source, context);

const score = context.__dongfanghong;
if (score.title !== "《东方红》" || score.tonic !== "F") throw new Error("课程曲名或调号错误");
if (score.source !== "human-curated") throw new Error("《东方红》没有标记为人工校准课程");
if (score.meter.beats !== 2 || score.meter.unit !== 4) throw new Error("《东方红》没有使用 2/4 拍");
if (score.phrases.length !== 4) throw new Error("课程没有按原谱四行拆成 4 页");
for (const phrase of score.phrases) {
  const pageMeasures = score.measures.filter(measure => !measure.pickup && measure.notes.some(note => note.phraseId === phrase.id));
  if (pageMeasures.length !== 4) throw new Error(`${phrase.label} 不是 4 个完整小节`);
}

for (const measure of score.measures) {
  const duration = measure.notes.reduce((sum, note) => sum + note.duration, 0);
  if (Math.abs(duration - measure.beats) > 1e-9) throw new Error(`第 ${measure.number} 段时值不完整`);
}

const lyrics = score.notes.map(note => note.lyric || "").join("");
if (lyrics !== "东方红太阳升中国出了个毛泽东他为人民谋幸福呼儿嗨哟他是人民大救星") {
  throw new Error(`歌词与主旋律没有逐音对齐：${lyrics}`);
}
const firstDo = score.notes.find(note => note.degree === 1 && note.octave === 0);
if (Math.abs(firstDo.frequency - 349.228) > 0.01) throw new Error("F 调 do 的实际音高错误");
const taiYangSheng = score.measures.find(measure => measure.number === 3)?.notes;
if (!taiYangSheng || taiYangSheng.map(note => note.duration).join(",") !== "1,0.5,0.5" || taiYangSheng[2]?.degree !== 6 || taiYangSheng[2]?.octave !== -1) {
  throw new Error("“太阳升”的 1 1 低音6 没有按一拍、半拍、半拍播放");
}
for (const measureNumber of [3, 7, 13]) {
  const finalSix = score.measures.find(measure => measure.number === measureNumber)?.notes?.at(-1);
  if (!finalSix || finalSix.degree !== 6 || finalSix.octave !== -1) throw new Error(`第 ${measureNumber} 小节末尾没有保存为低音 6`);
}
const expectedOctaves = new Map([
  [1, [0, 0, 0]], [2, [0]], [3, [0, 0, -1]], [4, [0]],
  [5, [0, 0]], [6, [0, 1, 0, 0]], [7, [0, 0, -1]], [8, [0]],
  [9, [0, 0]], [10, [0, -1, -1]], [11, [-1, 0]], [12, [0, 0, 0]],
  [13, [0, 0, -1]], [14, [0, 0, 0, 0]], [15, [0, 0, -1, -1]], [16, [-1]]
]);
for (const [measureNumber, expected] of expectedOctaves) {
  const actual = score.measures.find(measure => measure.number === measureNumber)?.notes.map(note => note.octave);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`第 ${measureNumber} 小节的高低音位置与校对版不一致`);
}
const mouXing = score.measures.find(measure => measure.number === 11)?.notes;
if (!mouXing || mouXing[0]?.degree !== 5 || mouXing[0]?.octave !== -1 || mouXing[1]?.degree !== 5 || mouXing[1]?.octave !== 0) {
  throw new Error("第 11 小节“谋幸”没有保存为低音 5、中央音 5");
}
const finalNote = score.measures.find(measure => measure.number === 16)?.notes?.[0];
if (!finalNote || finalNote.degree !== 5 || finalNote.octave !== -1 || finalNote.duration !== 2) {
  throw new Error("最后一小节“大救星”的“星”没有保存为二拍低音 5");
}
const expectedMeasureRhythms = new Map([
  [1, "1,0.5,0.5"], [3, "1,0.5,0.5"], [7, "1,0.5,0.5"], [10, "1,0.5,0.5"], [13, "1,0.5,0.5"]
]);
for (const [measureNumber, expectedRhythm] of expectedMeasureRhythms) {
  const rhythm = score.measures.find(measure => measure.number === measureNumber)?.notes.map(note => note.duration).join(",");
  if (rhythm !== expectedRhythm) throw new Error(`第 ${measureNumber} 小节的拍子与原谱不一致：${rhythm}`);
}

const sourceFrequencies = context.__solfegeSourceFrequencies;
const fMajorTargets = { do: 349.2282, re: 391.9954, mi: 440, fa: 466.1638, sol: 523.2511, la: 587.3295, si: 659.2551 };
const expectedFTransposition = 2 ** (5 / 12);
for (const [syllable, target] of Object.entries(fMajorTargets)) {
  const playbackRate = target / sourceFrequencies[syllable];
  if (Math.abs(playbackRate - expectedFTransposition) > 0.0001) {
    throw new Error(`${syllable} 仍然按错误的统一 do 基准变调：${playbackRate}`);
  }
}

const fullPlayback = context.__solfegePlaybackNotes(score, true);
if (fullPlayback.length !== score.notes.length) throw new Error("完整旋律的音符数量错误");
context.__state.solfegePhraseIndex = 2;
const remainingPlayback = context.__solfegePlaybackNotes(score, true);
if (!remainingPlayback.length || remainingPlayback.length >= fullPlayback.length || remainingPlayback[0].phraseId !== score.phrases[2].id || remainingPlayback[0].playBeat !== 0) {
  throw new Error("听全曲没有从当前页开始并重新对齐播放时间");
}
context.__state.solfegePhraseIndex = 0;

context.__state.screen = "feel-sing";
const lessonHtml = context.__renderFeelSing();
for (const text of ["《东方红》", "第 1 页", "东方红，太阳升", "本页四小节简谱", "唱唱名", "听小节", "听全曲", "播放速度", `${score.bpm} BPM`, "听钢琴演奏唱名旋律"]) {
  if (!lessonHtml.includes(text)) throw new Error(`唱名课堂缺少：${text}`);
}
context.__state.solfegeActiveNoteIndex = score.notes.indexOf(score.phrases.length && score.notes.find(note => note.phraseId === score.phrases[0].id));
const activeLessonHtml = context.__renderFeelSing();
if (!/class="jianpu-note [^"]* active"/.test(activeLessonHtml)) throw new Error("当前播放音符在重新渲染后没有保持红底选中");
context.__state.solfegeActiveNoteIndex = null;
for (const hiddenText of ["老师唱名", "录制我的唱名", "选择演唱声音", "选择示范声音", "Diff 人声", "演唱歌词"]) {
  if (lessonHtml.includes(hiddenText)) throw new Error(`唱名课堂仍显示已隐藏功能：${hiddenText}`);
}
context.__state.publishedSolfegeLesson = JSON.parse(JSON.stringify(score));
const restoredLessonHtml = context.__renderFeelSing();
if (restoredLessonHtml.includes('data-solfege-note="-1"')) throw new Error("本地恢复后的简谱音符仍然无法匹配播放索引");
if (!restoredLessonHtml.includes('role="button"') || !restoredLessonHtml.includes("试听sol")) throw new Error("简谱音符没有提供点击试听交互");
context.__state.publishedSolfegeLesson = score;
const teacherHubHtml = context.__renderTeacherHub();
if (teacherHubHtml.includes("标准唱名音色库") || teacherHubHtml.includes("open-teacher-voicebank")) throw new Error("备课首页仍显示唱名录制入口");
if (!teacherHubHtml.includes("乐谱唱名制作")) throw new Error("备课首页误删了唱唱名课程模块");
if ((lessonHtml.match(/class="jianpu-measure"/g) || []).length !== 4) throw new Error("页面没有恰好显示 4 个完整小节");
const voiceTargets = context.__solfegeRecordingTargets();
if (voiceTargets.length !== 21) throw new Error(`标准唱名音色库应有 21 个音，当前为 ${voiceTargets.length}`);
if (new Set(voiceTargets.map(target => target.key)).size !== 21) throw new Error("标准唱名音色库存在重复音");
if (voiceTargets[0].key !== "do-48" || voiceTargets.at(-1).key !== "si-83") throw new Error("标准唱名音色库没有覆盖低、中、高三个八度");
for (const target of voiceTargets.filter(target => target.solfege === "do")) {
  context.__state.solfegeRecordings[target.key] = { frequency: target.frequency, audioBuffer: {} };
}
const fMajorDoSample = context.__teacherVoiceSampleForNote({ solfege: "do", frequency: 349.228 });
if (fMajorDoSample?.target.key !== "do-60") throw new Error("F 调 do 没有选择最近的中八度 do 录音");
if (Math.abs(fMajorDoSample.playbackRate - 349.228 / 261.625565) > 0.001) throw new Error("录音没有按简谱实际音高进行轻微调整");
context.__state.solfegeRecordings = {};
context.__state.solfegeRecordingOpen = true;
const recorderHtml = context.__renderTeacherVoiceBank();
for (const text of ["标准唱名音色库", "独立资源", "低八度", "中八度", "高八度", "已完成 0 / 21", "标准音", "开始录音", "至少保持 0.8 秒", "自动剪掉前后空白", "不会绑定某一首简谱"]) {
  if (!recorderHtml.includes(text)) throw new Error(`录音流程缺少：${text}`);
}
const syntheticSamples = new Float32Array(2000);
for (let index = 500; index < 1600; index += 1) syntheticSamples[index] = Math.sin(index * 0.17) * 0.3;
const detectedRange = context.__findSolfegeVoiceRange({
  sampleRate: 1000,
  length: syntheticSamples.length,
  numberOfChannels: 1,
  getChannelData: () => syntheticSamples
});
if (!detectedRange || detectedRange.validDuration < 1 || detectedRange.startFrame >= 500 || detectedRange.endFrame <= 1600) {
  throw new Error("自动剪切没有正确识别有效发音和保留自然边缘");
}
context.__state.solfegeRecordings[voiceTargets[0].key] = { validDuration: 1.05, audioBuffer: { duration: 1.17 } };
const savedRecorderHtml = context.__renderTeacherVoiceBank();
for (const text of ["试听录音", "有效发音 1.05 秒", "已自动剪切"]) {
  if (!savedRecorderHtml.includes(text)) throw new Error(`已保存录音缺少：${text}`);
}
context.__state.solfegeRecordings = {};
for (const unwanted of ["听小兔唱", "一起唱", "轮到我唱", "这一句听什么", "完整演唱"]) {
  if (lessonHtml.includes(unwanted)) throw new Error(`简化页面仍显示多余内容：${unwanted}`);
}

context.__state.scoreStep = "input";
context.__state.scoreDraft = null;
const scoreInputHtml = context.__renderTeacherScore();
for (const text of ["乐谱生成唱名", "上传乐谱", "模型预生成", "生成识别草稿"]) {
  if (!scoreInputHtml.includes(text)) throw new Error(`备课工作流缺少：${text}`);
}
context.__loadScoreDemo();
const scoreReviewHtml = context.__renderTeacherScore();
for (const text of ["校对第 1 / 16 小节", "当前简谱", "修改音高、长度或歌词后会立即更新", "点击小节可编辑", "低音（数字下方有点）", "高音（数字上方有点）", "长度", "½拍", "怎么看音符长度？", "数字下一横", "删除", "添加音符", "试听这个小节", "确认这个小节", "生成钢琴与唱名"]) {
  if (!scoreReviewHtml.includes(text)) throw new Error(`逐小节校对缺少：${text}`);
}
const reviewGroups = context.__scoreReviewGroups(context.__state.scoreDraft);
if (reviewGroups.length !== 16) throw new Error(`导航应只有 16 个完整小节，当前为 ${reviewGroups.length}`);
if (reviewGroups[0].pickup || reviewGroups[0].main.measure.number !== 1 || reviewGroups[0].main.measure.notes.length !== 3) throw new Error("第 1 小节没有直接包含原谱中的三个音符");
if (scoreReviewHtml.includes("小节前") || scoreReviewHtml.includes('aria-label="弱起"') || scoreReviewHtml.includes("生成 JSON 并发布")) throw new Error("校对页仍显示独立起音或技术发布文案");
if (scoreReviewHtml.includes("长度需要调整")) throw new Error("2/4 拍的第一小节被错误要求填写 3 拍");
if ((scoreReviewHtml.match(/class="score-preview-measure/g) || []).length !== 16) throw new Error("实时简谱没有完整显示 16 个小节");
if (!scoreReviewHtml.includes('<span class="jianpu-sign"><span class="jianpu-number">2</span><span class="jianpu-hold">—</span></span>')) throw new Error("2拍音符的延长线没有显示在数字右侧");
if (!scoreReviewHtml.includes('jianpu-note high')) throw new Error("高音符号没有进入实时简谱预览");
if (!scoreReviewHtml.includes('jianpu-note low')) throw new Error("低音符号没有进入实时简谱预览");
if ((scoreReviewHtml.match(/class="score-measure-card"/g) || []).length !== 1) throw new Error("人工校对没有一次只显示一个小节");

console.log(JSON.stringify({
  title: score.title,
  measures: score.measures.length,
  phrases: score.phrases.length,
  writtenNotes: score.notes.length,
  fullPlaybackNotes: fullPlayback.length,
  fMajorVoiceRate: Number(expectedFTransposition.toFixed(6)),
  meterChange: score.measures[2].meter,
  measuresPerPage: 4,
  voiceTargets: voiceTargets.length
}, null, 2));
