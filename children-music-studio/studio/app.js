const animalInfo = {
  bear: { name: "小熊", role: "键盘与主旋律", color: "#ef9a62", soft: "#fff3e9", image: "assets/performer-bear.png" },
  cat: { name: "小猫", role: "贝斯", color: "#d883b2", soft: "#fbeef6", image: "assets/performer-cat.png" },
  dog: { name: "小狗", role: "鼓组", color: "#6aa7d9", soft: "#edf6fd", image: "assets/performer-dog.png" },
  lion: { name: "小狮子", role: "中音萨克斯", color: "#d5a53e", soft: "#fff7df", image: "assets/performer-lion.png" },
};

const studioBaseUrl = new URL(".", window.location.href);

function studioUrl(path) {
  return new URL(String(path || "").replace(/^\/+/, ""), studioBaseUrl).href;
}

const $ = selector => document.querySelector(selector);
const moodInput = $("#mood-input");
const grooveInput = $("#groove-input");
const designButton = $("#design-button");
const designStatus = $("#design-status");
const designCardWrap = $("#design-card-wrap");
const cardEditor = $("#card-editor");
const prepareButton = $("#prepare-button");
const productionPanel = $("#production-panel");
const promptEditor = $("#prompt-editor");
const approvePromptButton = $("#approve-prompt-button");
const generateJsonButton = $("#generate-json-button");
const jsonEditorWrap = $("#json-editor-wrap");
const jsonEditor = $("#json-editor");
const jsonEditStatus = $("#json-edit-status");
const formatJsonButton = $("#format-json-button");
const saveJsonButton = $("#save-json-button");
const previewButton = $("#preview-button");
const previewBox = $("#preview-box");
const previewAudio = $("#preview-audio");
const approvePreviewButton = $("#approve-preview-button");
const generateStemsButton = $("#generate-stems-button");
const workflowStatus = $("#workflow-status");
const mixerPanel = $("#mixer-panel");
const tracksBox = $("#tracks");
const mixerStatus = $("#mixer-status");
const playButton = $("#play-button");
const stopButton = $("#stop-button");
const transportLabel = $("#transport-label");
const exportButton = $("#export-button");
const publishButton = $("#publish-button");
const downloadBox = $("#download-box");
const downloadLink = $("#download-link");
const publishBox = $("#publish-box");
const publishResult = $("#publish-result");
const manifestLink = $("#manifest-link");

let designCard = null;
let prepared = null;
let productionRecord = null;
let currentJob = null;
let audioContext = null;
let buffers = {};
let sources = {};
let gainNodes = {};
let playing = false;
let muted = new Set();
let soloed = new Set();

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function setStatus(element, message, kind = "") {
  element.textContent = message;
  element.className = `status ${kind ? `is-${kind}` : ""}`;
}

function setProgress(percent, title, copy) {
  $("#progress-fill").style.width = `${percent}%`;
  $("#progress-percent").textContent = `${percent}%`;
  $("#progress-title").textContent = title;
  $("#progress-copy").textContent = copy;
}

async function request(path, payload) {
  const response = await fetch(studioUrl(path), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({ error: "平台没有返回可读取的数据。" }));
  if (!response.ok) throw new Error(data.error || "处理失败");
  return data;
}

function renderCard(card) {
  designCard = card;
  cardEditor.value = JSON.stringify(card, null, 2);
  $("#card-title").textContent = card.title;
  $("#card-intent").textContent = card.designIntent;
  $("#card-mood").textContent = card.moodSummary;
  $("#card-groove").textContent = card.grooveSummary;
  $("#card-motif").textContent = card.coreMotif.scaleDegrees.join("—");
  $("#card-harmony").textContent = `${card.bpm} BPM · ${card.harmonyPlan.join(" → ")}`;
  designCardWrap.classList.remove("is-hidden");
  setProgress(30, "AI 音乐设计卡已生成", "请检查动机、速度、和声与四个角色，再确认进入生产。");
}

designButton.addEventListener("click", async () => {
  designButton.disabled = true;
  designButton.textContent = "千问正在设计…";
  setStatus(designStatus, "正在把自然语言整理成旋律、和声、律动和声部方案。");
  try {
    const data = await request("/api/designer/design-card", { mood: moodInput.value, groove: grooveInput.value });
    renderCard(data.card);
    setStatus(designStatus, "设计卡已生成。平台尚未生成音乐，你可以先调整这张卡。", "success");
    designCardWrap.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setStatus(designStatus, error.message, "error");
  } finally {
    designButton.disabled = false;
    designButton.textContent = "重新生成 AI 音乐设计卡";
  }
});

prepareButton.addEventListener("click", async () => {
  prepareButton.disabled = true;
  prepareButton.textContent = "正在组合规则…";
  try {
    const edited = JSON.parse(cardEditor.value);
    const data = await request("/api/designer/prepare", { card: edited });
    designCard = edited;
    prepared = data;
    promptEditor.value = data.prompt;
    productionPanel.classList.remove("is-hidden");
    generateJsonButton.disabled = true;
    setStatus(workflowStatus, "请先检查并确认生产提示词。");
    setProgress(48, "音乐设计已确认", "生产提示词已经组合完成，下一步调用千问生成完整音乐 JSON。");
    productionPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setStatus(designStatus, error instanceof SyntaxError ? "设计卡 JSON 格式有误，请检查逗号和引号。" : error.message, "error");
  } finally {
    prepareButton.disabled = false;
    prepareButton.textContent = "确认设计并生成提示词";
  }
});

approvePromptButton.addEventListener("click", async () => {
  if (!prepared) return;
  approvePromptButton.disabled = true;
  try {
    productionRecord = await request("/api/records", { kitId: prepared.kitId, prompt: promptEditor.value });
    generateJsonButton.disabled = false;
    setStatus(workflowStatus, "提示词已确认，可以调用千问生成 JSON。", "success");
    setProgress(58, "生产提示词已确认", "接下来会生成完整编配，并自动检查时间、音域、和声与声部冲突。");
  } catch (error) { setStatus(workflowStatus, error.message, "error"); }
  finally { approvePromptButton.disabled = false; }
});

generateJsonButton.addEventListener("click", async () => {
  if (!productionRecord) return;
  generateJsonButton.disabled = true;
  generateJsonButton.textContent = "千问生成并检查中…";
  setStatus(workflowStatus, "正在生成两小节音乐；如有规则冲突，平台会尝试自动修改。");
  try {
    productionRecord = await request("/api/records/generate", { recordId: productionRecord.recordId });
    jsonEditor.value = JSON.stringify(productionRecord.skeleton, null, 2);
    jsonEditorWrap.classList.remove("is-hidden");
    previewButton.disabled = false;
    jsonEditStatus.textContent = "已通过检查";
    jsonEditStatus.className = "json-edit-status is-saved";
    setStatus(workflowStatus, "JSON 已通过检查。可以直接试听，也可以调整后再次检查。", "success");
    setProgress(72, "音乐 JSON 已通过检查", "旋律、和声、律动与四个声部已经形成完整的两小节方案。");
  } catch (error) { setStatus(workflowStatus, error.message, "error"); }
  finally { generateJsonButton.disabled = false; generateJsonButton.textContent = "重新调用千问生成 JSON"; }
});

jsonEditor.addEventListener("input", () => {
  jsonEditStatus.textContent = "有未保存修改";
  jsonEditStatus.className = "json-edit-status is-dirty";
  previewButton.disabled = true;
});

formatJsonButton.addEventListener("click", () => {
  try { jsonEditor.value = JSON.stringify(JSON.parse(jsonEditor.value), null, 2); }
  catch (_) { setStatus(workflowStatus, "JSON 格式有误，请先检查逗号和引号。", "error"); }
});

saveJsonButton.addEventListener("click", async () => {
  if (!productionRecord) return;
  saveJsonButton.disabled = true;
  try {
    const skeleton = JSON.parse(jsonEditor.value);
    productionRecord = await request("/api/records/save-json", { recordId: productionRecord.recordId, skeleton });
    jsonEditor.value = JSON.stringify(productionRecord.skeleton, null, 2);
    jsonEditStatus.textContent = "已通过检查";
    jsonEditStatus.className = "json-edit-status is-saved";
    previewButton.disabled = false;
    setStatus(workflowStatus, "修改后的 JSON 已通过检查。", "success");
  } catch (error) {
    jsonEditStatus.textContent = "未通过检查";
    jsonEditStatus.className = "json-edit-status is-error";
    setStatus(workflowStatus, error instanceof SyntaxError ? "JSON 格式有误。" : error.message, "error");
  } finally { saveJsonButton.disabled = false; }
});

previewButton.addEventListener("click", async () => {
  previewButton.disabled = true;
  previewButton.textContent = "正在渲染…";
  try {
    productionRecord = await request("/api/records/preview", { recordId: productionRecord.recordId });
    previewAudio.src = studioUrl(productionRecord.previewUrl);
    previewBox.classList.remove("is-hidden");
    setStatus(workflowStatus, "试听已生成。请先听完整体与四个声部的关系。", "success");
    setProgress(82, "试听已经生成", "确认听感后，平台才会开放正式分轨。");
  } catch (error) { setStatus(workflowStatus, error.message, "error"); }
  finally { previewButton.disabled = false; previewButton.textContent = "重新生成试听"; }
});

approvePreviewButton.addEventListener("click", async () => {
  approvePreviewButton.disabled = true;
  try {
    productionRecord = await request("/api/records/approve", { recordId: productionRecord.recordId });
    generateStemsButton.disabled = false;
    setStatus(workflowStatus, "这版音乐已确认，可以生成四条正式分轨。", "success");
    setProgress(90, "试听已确认", "下一步生成四条同步分轨并进行最后音量调整。");
  } catch (error) { setStatus(workflowStatus, error.message, "error"); }
  finally { approvePreviewButton.disabled = false; }
});

generateStemsButton.addEventListener("click", async () => {
  generateStemsButton.disabled = true;
  generateStemsButton.textContent = "正在生成分轨…";
  try {
    const data = await request("/api/records/stems", { recordId: productionRecord.recordId });
    currentJob = data.job;
    await prepareMixer(currentJob);
    mixerPanel.classList.remove("is-hidden");
    setProgress(96, "四条分轨已生成", "试听、调整音量，然后保存到儿童音乐设计台资源库。");
    mixerPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { setStatus(workflowStatus, error.message, "error"); }
  finally { generateStemsButton.disabled = false; generateStemsButton.textContent = "重新生成正式分轨"; }
});

async function prepareMixer(job) {
  tracksBox.innerHTML = ""; buffers = {}; gainNodes = {}; muted.clear(); soloed.clear();
  downloadBox.classList.add("is-hidden"); publishBox.classList.add("is-hidden");
  audioContext ||= new AudioContext();
  await Promise.all(job.stems.map(async stem => {
    const response = await fetch(studioUrl(stem.url));
    buffers[stem.animal] = await audioContext.decodeAudioData(await response.arrayBuffer());
  }));
  job.stems.forEach(stem => tracksBox.appendChild(createTrack(stem)));
  $("#kit-summary").textContent = `${job.kitId} · ${job.stems.length} 条轨道同步`;
  setStatus(mixerStatus, "试听并调整各分轨音量，确认后保存。", "success");
}

function createTrack(stem) {
  const animal = stem.animal; const info = animalInfo[animal];
  const toneOptions = animal === "bear" ? (currentJob.bearTones || []).map(tone => `<option value="${escapeHtml(tone.id)}" ${tone.id === (currentJob.bearTone || "grand_piano") ? "selected" : ""}>${escapeHtml(tone.label)}</option>`).join("") : "";
  const row = document.createElement("article"); row.className = "track"; row.dataset.animal = animal; row.style.setProperty("--track-color", info.color); row.style.setProperty("--track-soft", info.soft);
  row.innerHTML = `<div class="animal-icon"><img src="${studioUrl(info.image)}" alt=""></div><div class="track-name"><strong>${info.name}</strong><span>${info.role}</span></div><label class="volume-wrap"><input type="range" min="0" max="150" value="100"><span class="volume-value">100%</span></label><div class="track-buttons"><button class="tiny-button mute">静音</button><button class="tiny-button solo">独奏</button><button class="tiny-button export-stem">导出单轨</button></div>${animal === "bear" ? `<div class="tone-controls"><label>键盘音色<select class="tone-select">${toneOptions}</select></label><button class="tiny-button apply-tone">应用音色</button><span>和声保持不变</span></div>` : ""}`;
  const slider = row.querySelector("input"); slider.addEventListener("input", () => { row.querySelector(".volume-value").textContent = `${slider.value}%`; updateGains(); });
  row.querySelector(".mute").addEventListener("click", event => { muted.has(animal) ? muted.delete(animal) : muted.add(animal); event.currentTarget.classList.toggle("is-active", muted.has(animal)); updateGains(); });
  row.querySelector(".solo").addEventListener("click", event => { soloed.has(animal) ? soloed.delete(animal) : soloed.add(animal); event.currentTarget.classList.toggle("is-active", soloed.has(animal)); updateGains(); });
  row.querySelector(".export-stem").addEventListener("click", event => exportSingleStem(animal, Number(slider.value) / 100, event.currentTarget));
  if (animal === "bear") row.querySelector(".apply-tone").addEventListener("click", event => applyBearTone(row.querySelector(".tone-select").value, event.currentTarget));
  return row;
}

async function applyBearTone(tone, button) {
  if (!currentJob) return; button.disabled = true; stopPlayback();
  try { const data = await request("/api/tone", { jobId: currentJob.jobId, tone }); const response = await fetch(studioUrl(data.url)); buffers.bear = await audioContext.decodeAudioData(await response.arrayBuffer()); currentJob.stems.find(stem => stem.animal === "bear").url = data.url; currentJob.bearTone = data.tone; setStatus(mixerStatus, `小熊键盘已切换为${data.label}`, "success"); }
  catch (error) { setStatus(mixerStatus, error.message, "error"); }
  finally { button.disabled = false; }
}

async function exportSingleStem(animal, gain, button) {
  const original = button.textContent; button.disabled = true; button.textContent = "生成中…";
  try { const data = await request("/api/stem", { jobId: currentJob.jobId, animal, gain }); const link = document.createElement("a"); link.href = studioUrl(data.url); link.download = data.filename; link.click(); setStatus(mixerStatus, `${animalInfo[animal].name}单轨已导出`, "success"); }
  catch (error) { setStatus(mixerStatus, error.message, "error"); }
  finally { button.disabled = false; button.textContent = original; }
}

function currentGains() { const values = {}; document.querySelectorAll(".track").forEach(row => { const animal = row.dataset.animal; const value = Number(row.querySelector("input").value) / 100; values[animal] = !muted.has(animal) && (soloed.size === 0 || soloed.has(animal)) ? value : 0; }); return values; }
function publishGains() { const values = {}; document.querySelectorAll(".track").forEach(row => { values[row.dataset.animal] = Number(row.querySelector("input").value) / 100; }); return values; }
function updateGains() { const values = currentGains(); Object.entries(gainNodes).forEach(([animal,node]) => node.gain.setTargetAtTime(values[animal], audioContext.currentTime, .015)); }
async function startPlayback() { if (!currentJob || playing) return; await audioContext.resume(); const startAt = audioContext.currentTime + .06; const values = currentGains(); Object.keys(buffers).forEach(animal => { const source = audioContext.createBufferSource(); const gain = audioContext.createGain(); source.buffer = buffers[animal]; source.loop = true; gain.gain.value = values[animal]; source.connect(gain).connect(audioContext.destination); source.start(startAt); sources[animal] = source; gainNodes[animal] = gain; }); playing = true; playButton.textContent = "Ⅱ"; transportLabel.textContent = "循环播放中"; }
function stopPlayback() { Object.values(sources).forEach(source => { try { source.stop(); } catch (_) {} }); sources = {}; gainNodes = {}; playing = false; playButton.textContent = "▶"; transportLabel.textContent = "准备播放"; }
playButton.addEventListener("click", () => playing ? stopPlayback() : startPlayback());
stopButton.addEventListener("click", stopPlayback);

exportButton.addEventListener("click", async () => {
  if (!currentJob) return; exportButton.disabled = true;
  try { const data = await request("/api/mix", { jobId: currentJob.jobId, gains: currentGains() }); downloadLink.href = studioUrl(data.url); downloadLink.download = `${currentJob.kitId}_mix.wav`; downloadBox.classList.remove("is-hidden"); setStatus(mixerStatus, "当前混音已生成。", "success"); }
  catch (error) { setStatus(mixerStatus, error.message, "error"); }
  finally { exportButton.disabled = false; }
});

publishButton.addEventListener("click", async () => {
  if (!currentJob) return; publishButton.disabled = true; publishButton.textContent = "检查并保存中…"; stopPlayback();
  try { const data = await request("/api/publish", { jobId: currentJob.jobId, gains: publishGains() }); publishResult.textContent = `已保存 ${data.packId} ${data.version}`; manifestLink.href = studioUrl(data.manifestUrl); publishBox.classList.remove("is-hidden"); setStatus(mixerStatus, "四条正式分轨已保存到儿童音乐设计台资源库。", "success"); setProgress(100, "这段儿童音乐已完成", "设计卡、JSON、试听、分轨和正式资源均已保存。"); }
  catch (error) { setStatus(mixerStatus, error.message, "error"); }
  finally { publishButton.disabled = false; publishButton.textContent = "保存正式分轨"; }
});
