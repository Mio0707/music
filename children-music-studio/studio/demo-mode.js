(() => {
  const enabled = location.hostname.endsWith(".github.io") || new URLSearchParams(location.search).has("demo");
  const assetRoot = "../assets/music/happy_bounce/v01";
  const wait = (value, milliseconds = 320) => new Promise(resolve => setTimeout(() => resolve(structuredClone(value)), milliseconds));

  const skeleton = {
    kitId: "demo_happy_bounce_v01",
    feeling: "放学后的开心时光",
    groove: "bounce",
    bpm: 96,
    timeSignature: "4/4",
    key: "C major",
    bars: 2,
    melody: [
      { pitch: "C4", beat: 0, duration: 1, solfege: "do" },
      { pitch: "E4", beat: 1, duration: 1, solfege: "mi" },
      { pitch: "G4", beat: 2, duration: 1, solfege: "sol" },
      { pitch: "A4", beat: 3, duration: 1, solfege: "la" },
      { pitch: "G4", beat: 4, duration: 1, solfege: "sol" },
      { pitch: "E4", beat: 5, duration: 1, solfege: "mi" },
      { pitch: "D4", beat: 6, duration: 1, solfege: "re" },
      { pitch: "C4", beat: 7, duration: 1, solfege: "do" }
    ],
    chords: [
      { beat: 0, symbol: "C" },
      { beat: 2, symbol: "G" },
      { beat: 4, symbol: "Am" },
      { beat: 6, symbol: "C" }
    ],
    bassRoots: [
      { pitch: "C2", beat: 0, duration: 2 },
      { pitch: "G2", beat: 2, duration: 2 },
      { pitch: "A2", beat: 4, duration: 2 },
      { pitch: "C2", beat: 6, duration: 2 }
    ],
    drumGrid: [0, 1, 2, 3, 4, 5, 6, 7].map(beat => ({ instrument: beat % 2 ? "snare" : "kick", beat, duration: 0.5, velocity: 90 })),
    lionAllowedBeats: [0, 1, 2, 3, 4, 5, 6, 7],
    lionNotes: [{ pitch: "E5", beat: 2, duration: 2, velocity: 55 }]
  };

  const makeCard = payload => ({
    title: "放学蹦蹦跳",
    designIntent: `用明亮短促的动机和弹跳律动表现“${payload.mood || "放学后的开心时光"}”。`,
    moodSummary: payload.mood || "放学后，和朋友一起玩，开心。",
    grooveSummary: payload.groove || "蹦蹦跳跳",
    grooveFamily: "bounce",
    bpm: 96,
    coreMotif: { scaleDegrees: [1, 3, 5, 6, 5, 3, 2, 1], referenceDurations: [1, 1, 1, 1, 1, 1, 1, 1], identityNote: 5 },
    harmonyPlan: ["C", "G", "Am", "C"],
    melodyProfile: { contour: "上行后回落", range: "C4—A4", density: "每拍一音", phraseBreath: "第四拍后换气", ending: "回到主音" },
    arrangement: { keyboardRole: "主旋律", bassRole: "根音支撑", drumRole: "弹跳律动", saxRole: "背景长音", saxPhrasePlan: "第二小节轻柔进入" },
    safetyReview: { likelyConflicts: [], resolutions: ["保持主旋律清楚，其他声部使用长音或休止"] },
    designId: "demo_design_01",
    moodInput: payload.mood || "",
    grooveInput: payload.groove || "",
    model: "演示数据",
    version: "static-demo-v1"
  });

  const record = status => ({
    recordId: "demo_record_01",
    kitId: skeleton.kitId,
    feeling: "放学蹦蹦跳",
    groove: "蹦蹦跳跳",
    model: "演示数据",
    status,
    skeleton,
    previewUrl: `${assetRoot}/preview/mix.wav`
  });

  const job = {
    jobId: "demo_job_01",
    kitId: skeleton.kitId,
    bearTone: "grand_piano",
    bearTones: [
      { id: "grand_piano", label: "明亮钢琴" },
      { id: "music_box", label: "音乐盒（演示）" }
    ],
    stems: ["bear", "cat", "dog", "lion"].map(animal => ({ animal, url: `${assetRoot}/stems/${animal}.wav` }))
  };

  async function request(path, payload = {}) {
    if (path === "/api/designer/design-card") return wait({ card: makeCard(payload) }, 520);
    if (path === "/api/designer/prepare") return wait({ designId: "demo_design_01", kitId: skeleton.kitId, prompt: `演示生产提示词\n\n主题：${payload.card?.title || "放学蹦蹦跳"}\n结构：C 大调、4/4 拍、两小节。\n要求：小熊演奏主旋律，小猫负责贝斯，小狗负责鼓组，小狮子使用柔和长音。` });
    if (path === "/api/records") return wait(record("prompt_approved"));
    if (path === "/api/records/generate") return wait(record("json_ready"), 620);
    if (path === "/api/records/save-json") return wait({ ...record("json_ready"), skeleton: payload.skeleton });
    if (path === "/api/records/preview") return wait(record("preview_ready"), 500);
    if (path === "/api/records/approve") return wait(record("preview_approved"));
    if (path === "/api/records/stems") return wait({ job }, 650);
    if (path === "/api/tone") return wait({ url: `${assetRoot}/stems/bear.wav`, tone: payload.tone, label: payload.tone === "music_box" ? "音乐盒（演示）" : "明亮钢琴" });
    if (path === "/api/stem") return wait({ url: `${assetRoot}/stems/${payload.animal}.wav`, filename: `${skeleton.kitId}_${payload.animal}.wav` });
    if (path === "/api/mix") return wait({ url: `${assetRoot}/preview/mix.wav` });
    if (path === "/api/publish") return wait({ packId: skeleton.kitId, version: "demo", manifestUrl: `${assetRoot}/manifest.json` });
    throw new Error("该操作需要连接正式音乐服务。");
  }

  window.ChildrenMusicDemo = { enabled, request };
})();
