(() => {
  const enabled = location.hostname.endsWith(".github.io") || new URLSearchParams(location.search).has("demo");
  const assetRoot = "../assets/music/child_20260811_135323_a2048e_bounce/v01";
  const cache = new Map();
  const clone = value => structuredClone(value);
  const wait = (value, milliseconds = 320) => new Promise(resolve => setTimeout(() => resolve(clone(value)), milliseconds));

  async function loadStatic(file, format = "json") {
    const key = `${format}:${file}`;
    if (!cache.has(key)) {
      cache.set(key, fetch(`${assetRoot}/${file}`).then(response => {
        if (!response.ok) throw new Error(`演示资源加载失败：${file}`);
        return format === "text" ? response.text() : response.json();
      }));
    }
    return clone(await cache.get(key));
  }

  async function demoRecord(status, editedSkeleton) {
    const skeleton = editedSkeleton || await loadStatic("score.json");
    const card = await loadStatic("design-card.json");
    return {
      recordId: "demo_record_01",
      kitId: skeleton.kitId,
      feeling: card.title,
      groove: card.grooveSummary,
      model: card.model,
      status,
      skeleton,
      previewUrl: `${assetRoot}/preview/mix.wav`
    };
  }

  async function demoJob() {
    const skeleton = await loadStatic("score.json");
    return {
      jobId: "demo_job_01",
      kitId: skeleton.kitId,
      bearTone: "grand_piano",
      bearTones: [
        { id: "grand_piano", label: "明亮钢琴" },
        { id: "music_box", label: "音乐盒（演示）" }
      ],
      stems: ["bear", "cat", "dog", "lion"].map(animal => ({ animal, url: `${assetRoot}/stems/${animal}.wav` }))
    };
  }

  async function request(path, payload = {}) {
    if (path === "/api/designer/design-card") return wait({ card: await loadStatic("design-card.json") }, 520);
    if (path === "/api/designer/prepare") {
      const [card, skeleton, prompt] = await Promise.all([
        loadStatic("design-card.json"),
        loadStatic("score.json"),
        loadStatic("production-prompt.txt", "text")
      ]);
      return wait({ designId: card.designId, kitId: skeleton.kitId, prompt });
    }
    if (path === "/api/records") return wait(await demoRecord("prompt_approved"));
    if (path === "/api/records/generate") return wait(await demoRecord("json_ready"), 620);
    if (path === "/api/records/save-json") return wait(await demoRecord("json_ready", payload.skeleton));
    if (path === "/api/records/preview") return wait(await demoRecord("preview_ready"), 500);
    if (path === "/api/records/approve") return wait(await demoRecord("preview_approved"));
    if (path === "/api/records/stems") return wait({ job: await demoJob() }, 650);
    if (path === "/api/tone") return wait({ url: `${assetRoot}/stems/bear.wav`, tone: payload.tone, label: payload.tone === "music_box" ? "音乐盒（演示）" : "明亮钢琴" });
    if (path === "/api/stem") {
      const skeleton = await loadStatic("score.json");
      return wait({ url: `${assetRoot}/stems/${payload.animal}.wav`, filename: `${skeleton.kitId}_${payload.animal}.wav` });
    }
    if (path === "/api/mix") return wait({ url: `${assetRoot}/preview/mix.wav` });
    if (path === "/api/publish") {
      const manifest = await loadStatic("manifest.json");
      return wait({ packId: manifest.packId, version: manifest.version, manifestUrl: `${assetRoot}/manifest.json` });
    }
    throw new Error("该操作需要连接正式音乐服务。");
  }

  window.ChildrenMusicDemo = { enabled, request };
})();
