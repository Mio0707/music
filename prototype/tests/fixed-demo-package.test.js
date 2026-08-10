import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const prototypeRoot = path.resolve(here, "..");
const manifestPath = path.join(prototypeRoot, "assets", "demo", "fixed-demo.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function assertFile(relativePath, label) {
  const fullPath = path.join(prototypeRoot, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`${label}不存在：${relativePath}`);
}

assertFile(manifest.gestureLesson.audio.replace(/^assets[\\/]/, "assets/"), "卡门音频");
assertFile(manifest.gestureLesson.plan.replace(/^assets[\\/]/, "assets/"), "卡门手势数据");
assertFile(manifest.solfegeLesson.score.replace(/^assets[\\/]/, "assets/"), "东方红乐谱数据");
assertFile(`${manifest.solfegeLesson.voiceRoot.replace(/^assets[\\/]/, "assets/")}/do.wav`, "唱名录音");
if (manifest.solfegeLesson.voiceRoot !== "assets/solfege/voice-katy") throw new Error("唱名示范没有切回原始 Katy 音色");
for (const syllable of ["sol", "la", "si"]) assertFile(`assets/solfege/voice-katy-natural-low-f/${syllable}.wav`, `自然低音 ${syllable}`);

const score = JSON.parse(fs.readFileSync(path.join(prototypeRoot, "assets", "demo", "dongfanghong.json"), "utf8"));
if (score.source !== "human-curated" || score.measures.length !== 16) throw new Error("东方红固定演示数据不是16小节人工校对版本");
if (score.meter.beats !== 2 || score.meter.unit !== 4) throw new Error("东方红固定演示数据不是2/4拍");
if (!score.measures.every(measure => measure.notes.reduce((sum, note) => sum + note.duration, 0) === 2)) throw new Error("东方红存在不满2拍的小节");
if (manifest.piano.engine !== "browser-web-audio" || !manifest.rendering.longNotes) throw new Error("钢琴或简谱渲染规则没有进入固定演示清单");

console.log(JSON.stringify({ fixedDemo: true, gesture: manifest.gestureLesson.title, solfege: manifest.solfegeLesson.title, measures: score.measures.length }, null, 2));
