const animalInfo = {
  bear: { name: "小熊", role: "钢琴主旋律与和声", icon: "🐻", color: "#d59047", soft: "#fff0d8" },
  cat: { name: "小猫", role: "贝斯与低音", icon: "🐱", color: "#756cc8", soft: "#eceaff" },
  dog: { name: "小狗", role: "鼓与稳定律动", icon: "🐶", color: "#e46d66", soft: "#ffe8e5" },
};

const fileInput = document.querySelector("#json-file");
const dropZone = document.querySelector("#drop-zone");
const fileTitle = document.querySelector("#file-title");
const fileSubtitle = document.querySelector("#file-subtitle");
const processButton = document.querySelector("#process-button");
const exampleButton = document.querySelector("#example-button");
const statusBox = document.querySelector("#status");
const mixerPanel = document.querySelector("#mixer-panel");
const libraryList = document.querySelector("#library-list");
const refreshLibraryButton = document.querySelector("#refresh-library");
const tracksBox = document.querySelector("#tracks");
const playButton = document.querySelector("#play-button");
const stopButton = document.querySelector("#stop-button");
const transportLabel = document.querySelector("#transport-label");
const exportButton = document.querySelector("#export-button");
const downloadBox = document.querySelector("#download-box");
const downloadLink = document.querySelector("#download-link");

let skeleton = null;
let currentJob = null;
let audioContext = null;
let buffers = {};
let sources = {};
let gainNodes = {};
let playing = false;
let muted = new Set();
let soloed = new Set();

function setStatus(message, kind = "") {
  statusBox.textContent = message;
  statusBox.className = `status ${kind ? `is-${kind}` : ""}`;
}

function acceptSkeleton(data, filename) {
  if (!data || Array.isArray(data) || typeof data !== "object") throw new Error("JSON 最外层需要是一个对象");
  skeleton = data;
  fileTitle.textContent = filename;
  fileSubtitle.textContent = `${data.kitId || "未填写编号"} · ${data.bpm || "?"} BPM · ${data.bars || "?"} 小节`;
  processButton.disabled = false;
  setStatus("JSON 已就绪，可以生成分轨", "success");
}

async function readFile(file) {
  try {
    acceptSkeleton(JSON.parse(await file.text()), file.name);
  } catch (error) {
    skeleton = null;
    processButton.disabled = true;
    setStatus(`无法读取：${error.message}`, "error");
  }
}

fileInput.addEventListener("change", () => fileInput.files[0] && readFile(fileInput.files[0]));
["dragenter", "dragover"].forEach(type => dropZone.addEventListener(type, event => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
}));
["dragleave", "drop"].forEach(type => dropZone.addEventListener(type, event => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
}));
dropZone.addEventListener("drop", event => event.dataTransfer.files[0] && readFile(event.dataTransfer.files[0]));

exampleButton.addEventListener("click", async () => {
  try {
    const response = await fetch("/api/example");
    const data = await response.json();
    acceptSkeleton(data.skeleton, "happy_bounce_v01 示例.json");
  } catch (error) {
    setStatus(`示例载入失败：${error.message}`, "error");
  }
});

processButton.addEventListener("click", async () => {
  processButton.disabled = true;
  exampleButton.disabled = true;
  mixerPanel.classList.add("is-hidden");
  setStatus("正在检查 JSON、生成 MIDI 并渲染三条分轨，请稍候……");
  stopPlayback();
  try {
    const response = await fetch("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skeleton }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "生成失败");
    currentJob = data;
    await prepareMixer(data);
    await loadLibrary();
    setStatus("分轨生成成功，可以开始调音", "success");
    mixerPanel.classList.remove("is-hidden");
    mixerPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    processButton.disabled = false;
    exampleButton.disabled = false;
  }
});

function formatDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadLibrary() {
  refreshLibraryButton.disabled = true;
  try {
    const response = await fetch("/api/jobs");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "读取失败");
    renderLibrary(data.jobs);
  } catch (error) {
    libraryList.innerHTML = `<div class="empty-library">读取失败：${error.message}</div>`;
  } finally {
    refreshLibraryButton.disabled = false;
  }
}

function renderLibrary(jobs) {
  libraryList.innerHTML = "";
  if (!jobs.length) {
    libraryList.innerHTML = '<div class="empty-library">还没有处理结果，先上传一个 JSON 吧。</div>';
    return;
  }
  jobs.forEach(job => {
    const item = document.createElement("article");
    item.className = "library-item";
    item.innerHTML = `
      <div class="library-name">
        <div class="library-note">♫</div>
        <div><strong>${escapeHtml(job.kitId)}</strong><span>${escapeHtml(formatDate(job.createdAt))}</span></div>
      </div>
      <div class="library-meta">${escapeHtml(job.bpm)} BPM · ${escapeHtml(job.bars)} 小节<br>3 条可调分轨</div>
      <div class="library-actions">
        ${job.latestMixUrl ? `<a class="mix-link" href="${job.latestMixUrl}" target="_blank">最近混音</a>` : '<span class="library-meta">尚未导出</span>'}
        <button class="button secondary compact open-job" type="button">打开调音</button>
      </div>`;
    item.querySelector(".open-job").addEventListener("click", async () => {
      const button = item.querySelector(".open-job");
      button.disabled = true;
      button.textContent = "载入中……";
      stopPlayback();
      try {
        currentJob = job;
        await prepareMixer(job);
        mixerPanel.classList.remove("is-hidden");
        setStatus(`已打开历史任务 ${job.kitId}`, "success");
        mixerPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) {
        setStatus(`历史任务打开失败：${error.message}`, "error");
      } finally {
        button.disabled = false;
        button.textContent = "打开调音";
      }
    });
    libraryList.appendChild(item);
  });
}

refreshLibraryButton.addEventListener("click", loadLibrary);

async function prepareMixer(job) {
  tracksBox.innerHTML = "";
  buffers = {};
  gainNodes = {};
  muted.clear();
  soloed.clear();
  downloadBox.classList.add("is-hidden");
  audioContext ||= new AudioContext();

  await Promise.all(job.stems.map(async stem => {
    const response = await fetch(stem.url);
    buffers[stem.animal] = await audioContext.decodeAudioData(await response.arrayBuffer());
  }));

  job.stems.forEach(stem => tracksBox.appendChild(createTrack(stem)));
  document.querySelector("#kit-summary").textContent = `${job.kitId} · 5 秒循环 · 三条轨道同步`;
}

function createTrack(stem) {
  const animal = stem.animal;
  const info = animalInfo[animal];
  const toneOptions = animal === "bear"
    ? (currentJob.bearTones || []).map(tone => `<option value="${escapeHtml(tone.id)}" ${tone.id === (currentJob.bearTone || "grand_piano") ? "selected" : ""}>${escapeHtml(tone.label)}</option>`).join("")
    : "";
  const row = document.createElement("article");
  row.className = "track";
  row.dataset.animal = animal;
  row.style.setProperty("--track-color", info.color);
  row.style.setProperty("--track-soft", info.soft);
  row.innerHTML = `
    <div class="animal-icon">${info.icon}</div>
    <div class="track-name"><strong>${info.name}</strong><span>${info.role}</span></div>
    <label class="volume-wrap">
      <input type="range" min="0" max="150" value="100" aria-label="${info.name}音量">
      <span class="volume-value">100%</span>
    </label>
    <div class="track-buttons">
      <button class="tiny-button mute" type="button">静音</button>
      <button class="tiny-button solo" type="button">独奏</button>
      <button class="tiny-button export-stem" type="button">导出单轨</button>
    </div>
    ${animal === "bear" ? `
      <div class="tone-controls">
        <label>备用主旋律音色
          <select class="tone-select">${toneOptions}</select>
        </label>
        <button class="tiny-button apply-tone" type="button">应用音色</button>
        <span>钢琴和声保持不变</span>
      </div>` : ""}`;

  const slider = row.querySelector("input");
  slider.addEventListener("input", () => {
    row.querySelector(".volume-value").textContent = `${slider.value}%`;
    updateGains();
  });
  row.querySelector(".mute").addEventListener("click", event => {
    muted.has(animal) ? muted.delete(animal) : muted.add(animal);
    event.currentTarget.classList.toggle("is-active", muted.has(animal));
    row.classList.toggle("is-muted", muted.has(animal));
    updateGains();
  });
  row.querySelector(".solo").addEventListener("click", event => {
    soloed.has(animal) ? soloed.delete(animal) : soloed.add(animal);
    event.currentTarget.classList.toggle("is-active", soloed.has(animal));
    updateGains();
  });
  row.querySelector(".export-stem").addEventListener("click", event => {
    exportSingleStem(animal, Number(slider.value) / 100, event.currentTarget);
  });
  if (animal === "bear") {
    row.querySelector(".apply-tone").addEventListener("click", event => {
      applyBearTone(row.querySelector(".tone-select").value, event.currentTarget);
    });
  }
  return row;
}

async function applyBearTone(tone, button) {
  if (!currentJob) return;
  button.disabled = true;
  button.textContent = "渲染中……";
  stopPlayback();
  try {
    const response = await fetch("/api/tone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: currentJob.jobId, tone }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "音色渲染失败");
    const audioResponse = await fetch(data.url);
    buffers.bear = await audioContext.decodeAudioData(await audioResponse.arrayBuffer());
    const bearStem = currentJob.stems.find(stem => stem.animal === "bear");
    bearStem.url = data.url;
    currentJob.bearTone = data.tone;
    setStatus(`小熊主旋律已切换为${data.label}`, "success");
    await loadLibrary();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "应用音色";
  }
}

async function exportSingleStem(animal, gain, button) {
  if (!currentJob) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "生成中……";
  try {
    const response = await fetch("/api/stem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: currentJob.jobId, animal, gain }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "单轨导出失败");
    const link = document.createElement("a");
    link.href = data.url;
    link.download = data.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStatus(`${animalInfo[animal].name}单轨已按 ${Math.round(gain * 100)}% 音量导出`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function currentGains() {
  const values = {};
  document.querySelectorAll(".track").forEach(row => {
    const animal = row.dataset.animal;
    const sliderValue = Number(row.querySelector("input").value) / 100;
    const audible = !muted.has(animal) && (soloed.size === 0 || soloed.has(animal));
    values[animal] = audible ? sliderValue : 0;
  });
  return values;
}

function updateGains() {
  const values = currentGains();
  Object.entries(gainNodes).forEach(([animal, node]) => {
    node.gain.setTargetAtTime(values[animal], audioContext.currentTime, 0.015);
  });
}

async function startPlayback() {
  if (!currentJob || playing) return;
  await audioContext.resume();
  const startAt = audioContext.currentTime + 0.06;
  const values = currentGains();
  Object.keys(buffers).forEach(animal => {
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = buffers[animal];
    source.loop = true;
    gain.gain.value = values[animal];
    source.connect(gain).connect(audioContext.destination);
    source.start(startAt);
    sources[animal] = source;
    gainNodes[animal] = gain;
  });
  playing = true;
  playButton.textContent = "❚❚";
  transportLabel.textContent = "循环播放中";
}

function stopPlayback() {
  Object.values(sources).forEach(source => {
    try { source.stop(); } catch (_) { /* 已停止 */ }
  });
  sources = {};
  gainNodes = {};
  playing = false;
  playButton.textContent = "▶";
  transportLabel.textContent = "准备播放";
}

playButton.addEventListener("click", () => playing ? stopPlayback() : startPlayback());
stopButton.addEventListener("click", stopPlayback);

exportButton.addEventListener("click", async () => {
  if (!currentJob) return;
  exportButton.disabled = true;
  exportButton.textContent = "正在导出……";
  try {
    const response = await fetch("/api/mix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: currentJob.jobId, gains: currentGains() }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "导出失败");
    downloadLink.href = data.url;
    downloadLink.download = `${currentJob.kitId}_mix.wav`;
    downloadBox.classList.remove("is-hidden");
    await loadLibrary();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    exportButton.disabled = false;
    exportButton.textContent = "导出当前混音";
  }
});

loadLibrary();
