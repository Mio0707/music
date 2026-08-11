const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = path.resolve(__dirname, "..", "..");
const source = fs.readFileSync(path.join(projectRoot, "children-music-studio", "studio", "demo-mode.js"), "utf8");
const sandbox = {
  location: { hostname: "mio0707.github.io", search: "" },
  URLSearchParams,
  structuredClone,
  setTimeout,
  window: {}
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

(async () => {
  const demo = sandbox.window.ChildrenMusicDemo;
  assert.equal(demo.enabled, true, "GitHub Pages 没有自动进入演示模式");

  const card = await demo.request("/api/designer/design-card", { mood: "开心", groove: "蹦蹦跳跳" });
  assert.equal(card.card.moodSummary, "开心");

  const prepared = await demo.request("/api/designer/prepare", { card: card.card });
  assert.ok(prepared.prompt.includes("放学蹦蹦跳"));

  const record = await demo.request("/api/records/generate", {});
  assert.equal(record.skeleton.bars, 2);

  const preview = await demo.request("/api/records/preview", {});
  assert.ok(preview.previewUrl.endsWith("preview/mix.wav"));

  const stems = await demo.request("/api/records/stems", {});
  assert.equal(stems.job.stems.length, 4);
  for (const stem of stems.job.stems) {
    const localAsset = stem.url.replace("../assets/", "prototype/assets/");
    assert.ok(fs.existsSync(path.join(projectRoot, ...localAsset.split("/"))), `缺少演示分轨：${stem.animal}`);
  }

  const resolvedStudio = new URL("children-music-studio/", "https://mio0707.github.io/music/").href;
  assert.equal(resolvedStudio, "https://mio0707.github.io/music/children-music-studio/");

  console.log(JSON.stringify({ demoMode: true, workflow: "design-to-stems", stems: 4, studioUrl: resolvedStudio }, null, 2));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
