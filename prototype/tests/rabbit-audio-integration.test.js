const fs = require("fs");
const path = require("path");
const vm = require("vm");

const prototypeRoot = path.join(__dirname, "..");
const musicRoot = path.join(prototypeRoot, "assets", "music");
const solfegeRoot = path.join(prototypeRoot, "assets", "solfege", "voice-katy");
const splicedSiPath = path.join(prototypeRoot, "assets", "solfege", "voice-katy-child-clean-v2", "si.wav");
const publishedStemAnimals = ["dog", "rabbit", "bear", "cat", "lion"];
const arrangementAnimals = ["dog", "bear", "cat", "lion"];
const syllables = ["do", "re", "mi", "fa", "sol", "la", "si"];

function parsePcm16Wav(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.toString("ascii", 0, 4) !== "RIFF" || data.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`不是有效 WAV：${filePath}`);
  }
  let offset = 12;
  let format;
  let pcm;
  while (offset + 8 <= data.length) {
    const id = data.toString("ascii", offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === "fmt ") {
      format = {
        encoding: data.readUInt16LE(start),
        channels: data.readUInt16LE(start + 2),
        sampleRate: data.readUInt32LE(start + 4),
        bits: data.readUInt16LE(start + 14)
      };
    }
    if (id === "data") pcm = data.subarray(start, start + size);
    offset = start + size + (size % 2);
  }
  if (!format || !pcm || format.encoding !== 1 || format.bits !== 16) {
    throw new Error(`不是 PCM 16-bit WAV：${filePath}`);
  }
  let squareSum = 0;
  let peak = 0;
  for (let index = 0; index + 1 < pcm.length; index += 2) {
    const sample = pcm.readInt16LE(index) / 32768;
    squareSum += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  return {
    ...format,
    frames: pcm.length / (format.channels * 2),
    rms: Math.sqrt(squareSum / (pcm.length / 2)),
    peak
  };
}

for (const syllable of syllables) {
  const samplePath = syllable === "si" ? splicedSiPath : path.join(solfegeRoot, `${syllable}.wav`);
  const audio = parsePcm16Wav(samplePath);
  if (audio.sampleRate !== 48000 || audio.channels !== 1 || audio.rms < 0.01) {
    throw new Error(`${syllable} 基础唱名素材规格或响度异常`);
  }
}

const manifests = [];
const catalog = JSON.parse(fs.readFileSync(path.join(musicRoot, "catalog.json"), "utf8"));
for (const packName of Object.keys(catalog.packs || {})) {
  const packDir = path.join(musicRoot, packName, "v01");
  const manifestPath = path.join(packDir, "manifest.json");
  const scorePath = path.join(packDir, "score.json");
  if (!fs.existsSync(manifestPath) || !fs.existsSync(scorePath)) continue;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const score = JSON.parse(fs.readFileSync(scorePath, "utf8"));
  manifests.push(manifest);
  for (const animal of publishedStemAnimals) {
    const relativeStem = manifest.stems[animal];
    if (!relativeStem) throw new Error(`${packName} 缺少 ${animal} 分轨声明`);
    const audio = parsePcm16Wav(path.join(packDir, relativeStem));
    if (audio.sampleRate !== 48000 || audio.channels !== 2 || audio.rms < 0.001) {
      throw new Error(`${packName} 的 ${animal} 分轨不可听或规格异常`);
    }
    const expectedFrames = Math.round(manifest.durationSeconds * audio.sampleRate);
    if (Math.abs(audio.frames - expectedFrames) > 2) {
      throw new Error(`${packName} 的 ${animal} 分轨长度没有对齐乐段`);
    }
  }
  for (const note of score.melody) {
    if (!syllables.includes(note.solfege)) throw new Error(`${packName} 使用了未知唱名 ${note.solfege}`);
  }
}
if (manifests.length !== 16) throw new Error(`预期验证 16 套音乐包，实际 ${manifests.length} 套`);

const played = [];
class FakeAudio {
  constructor(src) {
    this.src = src;
    this.currentTime = 0;
    this.volume = 1;
    played.push(this);
  }
  play() { this.didPlay = true; return Promise.resolve(); }
  pause() { this.didPause = true; }
  load() {}
  addEventListener() {}
}
const appElement = {
  innerHTML: "",
  querySelector: () => null,
  querySelectorAll: () => []
};
const toastElement = { textContent: "", classList: { add() {}, remove() {} } };
const scheduled = [];
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
  requestAnimationFrame: () => 0,
  cancelAnimationFrame() {},
  setTimeout(callback, delay) {
    if (delay === 0) callback();
    else scheduled.push(callback);
    return scheduled.length;
  },
  clearTimeout() {},
  Audio: FakeAudio
};
vm.createContext(context);
const appSource = fs.readFileSync(path.join(prototypeRoot, "app.js"), "utf8");
vm.runInContext(`${appSource}\nglobalThis.__state = state; globalThis.__playSection = playSection; globalThis.__playSolfegeSample = playSolfegeSample;`, context);
context.__state.screen = "arrange";
context.__state.mood = "happy";
context.__state.groove = "bounce";
context.__state.voiceStickers = [{ id: "clip-1", name: "我的声音 1", audioUrl: "blob:child-recording", blob: {}, bpm: 96 }];
context.__state.sections = [[...arrangementAnimals, "voice:clip-1"], [], [], []];
played.length = 0;
context.__playSection(0);

for (const animal of arrangementAnimals) {
  const expected = `assets/music/happy_bounce/v01/stems/${animal}.wav`;
  if (!played.some(audio => audio.src === expected && audio.didPlay)) {
    throw new Error(`单段试听没有启动 ${animal} 分轨`);
  }
}
if (played.some(audio => audio.src.endsWith("/stems/rabbit.wav") && audio.didPlay)) {
  throw new Error("隐藏的小兔唱名分轨仍在创作乐段中播放");
}
if (appElement.innerHTML.includes("小兔 · 唱名")) {
  throw new Error("创作贴纸盒仍显示小兔唱名贴纸");
}
if (!played.some(audio => audio.src === "blob:child-recording" && audio.didPlay)) {
  throw new Error("儿童录音贴纸没有保留原有叠加播放行为");
}

played.length = 0;
context.__playSolfegeSample("do", 261.6256);
context.__playSolfegeSample("si", 493.8833);
context.__playSolfegeSample("sol", 261.6256);
context.__playSolfegeSample("la", 293.6648);
context.__playSolfegeSample("si", 329.6276);
if (!played.some(audio => audio.src === "assets/solfege/voice-katy/do.wav")) {
  throw new Error("唱名示范没有使用原始音色 do");
}
if (!played.some(audio => audio.src === "assets/solfege/voice-katy-child-clean-v2/si.wav")) {
  throw new Error("唱名示范没有保留拼接处理后的 si");
}
for (const syllable of ["sol", "la", "si"]) {
  if (!played.some(audio => audio.src === `assets/solfege/voice-katy-natural-low-f/${syllable}.wav` && audio.playbackRate === 1)) {
    throw new Error(`低音 ${syllable} 没有使用自然低音专用样本`);
  }
}

console.log(JSON.stringify({
  packs: manifests.length,
  verifiedPublishedStems: publishedStemAnimals,
  verifiedArrangementStems: arrangementAnimals,
  rabbitStickerHidden: true,
  verifiedSolfegeSources: syllables,
  childRecordingPreserved: true
}, null, 2));
