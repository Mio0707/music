const animalInfo = {
  bear: { name: "小熊", role: "键盘与主旋律", color: "#ef9a62", soft: "#fff3e9", image: "/assets/performer-bear.png" },
  cat: { name: "小猫", role: "贝斯", color: "#d883b2", soft: "#fbeef6", image: "/assets/performer-cat.png" },
  dog: { name: "小狗", role: "鼓组", color: "#6aa7d9", soft: "#edf6fd", image: "/assets/performer-dog.png" },
  lion: { name: "小狮子", role: "中音萨克斯回应", color: "#d5a53e", soft: "#fff7df", image: "/assets/performer-lion.png" },
};

const emotionTabs = document.querySelector("#emotion-tabs");
const themeName = document.querySelector("#theme-name");
const themeBrief = document.querySelector("#theme-brief");
const themeStatusPill = document.querySelector("#theme-status-pill");
const themePromptEditor = document.querySelector("#theme-prompt-editor");
const themeJsonWrap = document.querySelector("#theme-json-wrap");
const themeJsonEditor = document.querySelector("#theme-json-editor");
const generateThemeButton = document.querySelector("#generate-theme-button");
const lockThemeButton = document.querySelector("#lock-theme-button");
const themeStatus = document.querySelector("#theme-status");
const grooveGrid = document.querySelector("#groove-grid");
const familyBadge = document.querySelector("#family-badge");
const combinationWorkspace = document.querySelector("#combination-workspace");
const combinationTitle = document.querySelector("#combination-title");
const combinationInheritance = document.querySelector("#combination-inheritance");
const motifProof = document.querySelector("#motif-proof");
const progressTitle = document.querySelector("#progress-title");
const progressDetail = document.querySelector("#progress-detail");
const progressNumber = document.querySelector("#progress-number");
const progressBar = document.querySelector("#progress-bar");

const promptEditor = document.querySelector("#prompt-editor");
const approvePromptButton = document.querySelector("#approve-prompt-button");
const generateJsonButton = document.querySelector("#generate-json-button");
const jsonPreview = document.querySelector("#json-preview");
const previewButton = document.querySelector("#preview-button");
const previewBox = document.querySelector("#preview-box");
const previewAudio = document.querySelector("#preview-audio");
const approvePreviewButton = document.querySelector("#approve-preview-button");
const generateStemsButton = document.querySelector("#generate-stems-button");
const workflowStatus = document.querySelector("#workflow-status");

const recordsList = document.querySelector("#records-list");
const refreshRecordsButton = document.querySelector("#refresh-records");
const dropZone = document.querySelector("#drop-zone");
const fileInput = document.querySelector("#json-file");
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

let blueprintData = null;
let recipes = [];
let selectedEmotionId = "happy";
let selectedGrooveId = "steady";
let themeDraft = null;
let productionRecord = null;
let skeleton = null;
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

function formatDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

async function request(path, payload) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "处理失败");
  return data;
}

function currentTheme() {
  return blueprintData?.themes.find(theme => theme.id === selectedEmotionId);
}

function currentGroove() {
  return blueprintData?.grooves.find(groove => groove.id === selectedGrooveId);
}

function selectedRecipe() {
  return recipes.find(recipe => recipe.feelingId === selectedEmotionId && recipe.grooveId === selectedGrooveId);
}

function statusLabel(status) {
  return ({ empty: "待生成", draft: "有草案", locked: "已锁定" })[status] || status;
}

function recordStatus(status) {
  return ({ prompt_approved: "提示词已确认", json_ready: "JSON 已就绪", preview_ready: "等待试听确认", preview_approved: "试听已确认", stems_ready: "分轨已完成", generation_failed: "生成失败", ready: "可以制作", blocked: "等待母版" })[status] || status;
}

function updateProgress() {
  const themes = blueprintData?.themes || [];
  const lockedCount = themes.filter(theme => theme.status === "locked").length;
  const finishedCount = themes.flatMap(theme => theme.combinations).filter(item => item.status === "stems_ready").length;
  const completedUnits = lockedCount + finishedCount;
  const percent = Math.round(completedUnits / 20 * 100);
  progressTitle.textContent = lockedCount ? `${lockedCount} 个心情母版已锁定` : "从第一份心情母版开始";
  progressDetail.textContent = `${lockedCount}/4 个心情母版 · ${finishedCount}/16 个律动改编完成`;
  progressNumber.textContent = `${percent}%`;
  progressBar.style.width = `${percent}%`;
}

function renderEmotionTabs() {
  emotionTabs.innerHTML = blueprintData.themes.map(theme => `
    <button class="emotion-card ${theme.id === selectedEmotionId ? "is-selected" : ""}" type="button" role="tab" aria-selected="${theme.id === selectedEmotionId}" data-emotion="${escapeHtml(theme.id)}">
      <span class="emotion-card-top"><strong>${escapeHtml(theme.label)}</strong><span class="small-status ${theme.status === "locked" ? "is-locked" : theme.status === "draft" ? "is-draft" : ""}">${escapeHtml(statusLabel(theme.status))}</span></span>
      <p>${escapeHtml(theme.brief)}</p>
    </button>`).join("");
  emotionTabs.querySelectorAll(".emotion-card").forEach(button => button.addEventListener("click", () => {
    selectedEmotionId = button.dataset.emotion;
    selectedGrooveId = "steady";
    productionRecord = null;
    renderBlueprint();
  }));
}

function renderThemeWorkspace() {
  const theme = currentTheme();
  themeName.textContent = `${theme.label}主题`;
  themeBrief.textContent = theme.brief;
  themeStatusPill.textContent = statusLabel(theme.status);
  themeStatusPill.className = `status-pill ${theme.status === "locked" ? "is-locked" : theme.status === "draft" ? "is-draft" : ""}`;
  themePromptEditor.value = theme.prompt;
  themeDraft = theme.theme || theme.draft?.theme || null;
  if (themeDraft) {
    themeJsonEditor.value = JSON.stringify(themeDraft, null, 2);
    themeJsonWrap.classList.remove("is-hidden");
  } else {
    themeJsonEditor.value = "";
    themeJsonWrap.classList.add("is-hidden");
  }
  lockThemeButton.disabled = theme.status === "locked" || !themeDraft;
  lockThemeButton.textContent = theme.status === "locked" ? "主题母版已锁定" : "锁定为心情母版";
  generateThemeButton.textContent = theme.status === "locked" ? "重新生成草案" : "AI 生成主题 JSON";
  setStatus(themeStatus, theme.status === "locked" ? "这份心情母版已进入知识库，四个律动版本将强制继承它。" : theme.status === "draft" ? "已有一份AI草案，请检查JSON后锁定。" : "审核提示词后，让AI生成这份心情的共同音乐身份。", theme.status === "locked" ? "success" : "");
}

function renderGrooves() {
  const theme = currentTheme();
  const ready = theme.status === "locked";
  familyBadge.textContent = ready ? `继承：${theme.label}主题 ${theme.theme.version}` : `先锁定“${theme.label}”主题`;
  familyBadge.className = `family-badge ${ready ? "is-ready" : ""}`;
  const softColors = ["#edf4ea", "#fff0dc", "#efeafd", "#e6f1fa"];
  grooveGrid.innerHTML = blueprintData.grooves.map((groove, index) => {
    const combination = theme.combinations.find(item => item.grooveId === groove.id);
    return `<button class="groove-card ${groove.id === selectedGrooveId && ready ? "is-selected" : ""}" style="--groove-soft:${softColors[index]}" type="button" data-groove="${escapeHtml(groove.id)}" ${ready ? "" : "disabled"}><span>${escapeHtml(recordStatus(combination.status))}</span><strong>${escapeHtml(groove.label)}</strong><p>${escapeHtml(groove.melodyRhythm)} · ${escapeHtml(groove.bpm)} BPM</p></button>`;
  }).join("");
  grooveGrid.querySelectorAll(".groove-card").forEach(button => button.addEventListener("click", () => {
    selectedGrooveId = button.dataset.groove;
    renderGrooves();
    renderCombination();
  }));
  combinationWorkspace.classList.toggle("is-hidden", !ready);
  if (ready) renderCombination();
}

function resetWorkflow() {
  productionRecord = null;
  jsonPreview.classList.add("is-hidden");
  jsonPreview.textContent = "";
  previewBox.classList.add("is-hidden");
  previewAudio.pause();
  previewAudio.removeAttribute("src");
  generateJsonButton.disabled = true;
  previewButton.disabled = true;
  generateStemsButton.disabled = true;
}

function renderCombination() {
  const theme = currentTheme();
  const groove = currentGroove();
  const recipe = selectedRecipe();
  if (!theme || !groove || theme.status !== "locked") return;
  combinationWorkspace.classList.remove("is-hidden");
  combinationTitle.textContent = `${theme.label} × ${groove.label}`;
  combinationInheritance.textContent = `继承“${theme.label}”核心旋律与和声，应用“${groove.label}”的速度、重音和伴奏方式。`;
  motifProof.textContent = theme.theme.coreMotif.scaleDegrees.join(" — ");
  resetWorkflow();
  if (!recipe) {
    promptEditor.value = "正在组合项目规范、心情母版和律动模板…";
    promptEditor.disabled = true;
    approvePromptButton.disabled = true;
    setStatus(workflowStatus, "正在准备组合提示词。", "");
    return;
  }
  promptEditor.value = recipe.prompt;
  promptEditor.disabled = false;
  approvePromptButton.disabled = false;
  setStatus(workflowStatus, "提示词已由三层规则自动组合，请审核后开始生成。", "success");
}

function renderBlueprint() {
  updateProgress();
  renderEmotionTabs();
  renderThemeWorkspace();
  renderGrooves();
}

async function loadBlueprint() {
  try {
    const response = await fetch("/api/blueprint");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "读取音乐体系失败");
    blueprintData = data;
    renderBlueprint();
  } catch (error) {
    setStatus(themeStatus, error.message, "error");
  }
}

async function loadRecipes() {
  try {
    const response = await fetch("/api/recipes");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "读取组合失败");
    recipes = data.recipes;
    if (blueprintData) renderCombination();
  } catch (error) {
    setStatus(workflowStatus, error.message, "error");
  }
}

generateThemeButton.addEventListener("click", async () => {
  generateThemeButton.disabled = true;
  generateThemeButton.textContent = "AI 正在设计…";
  setStatus(themeStatus, "Qwen3.7-Max 正在设计核心旋律、和声家族、力度和乐句表达。", "");
  try {
    const data = await request("/api/themes/generate", { emotionId: selectedEmotionId, prompt: themePromptEditor.value });
    themeDraft = data.theme;
    themeJsonEditor.value = JSON.stringify(themeDraft, null, 2);
    themeJsonWrap.classList.remove("is-hidden");
    lockThemeButton.disabled = false;
    setStatus(themeStatus, "主题JSON已生成。请检查后锁定，锁定后才开放四个律动改编。", "success");
  } catch (error) {
    setStatus(themeStatus, error.message, "error");
  } finally {
    generateThemeButton.disabled = false;
    generateThemeButton.textContent = currentTheme()?.status === "locked" ? "重新生成草案" : "AI 生成主题 JSON";
  }
});

lockThemeButton.addEventListener("click", async () => {
  lockThemeButton.disabled = true;
  lockThemeButton.textContent = "正在锁定…";
  try {
    const theme = JSON.parse(themeJsonEditor.value);
    await request("/api/themes/lock", { emotionId: selectedEmotionId, theme });
    setStatus(themeStatus, "主题母版已锁定，四个律动改编已经开放。", "success");
    await Promise.all([loadBlueprint(), loadRecipes()]);
  } catch (error) {
    setStatus(themeStatus, error instanceof SyntaxError ? "主题JSON格式不完整，请检查括号和逗号。" : error.message, "error");
    lockThemeButton.disabled = false;
    lockThemeButton.textContent = "锁定为心情母版";
  }
});

approvePromptButton.addEventListener("click", async () => {
  const recipe = selectedRecipe();
  if (!recipe) return;
  approvePromptButton.disabled = true;
  approvePromptButton.textContent = "保存中…";
  resetWorkflow();
  try {
    productionRecord = await request("/api/records", { kitId: recipe.kitId, prompt: promptEditor.value });
    generateJsonButton.disabled = false;
    setStatus(workflowStatus, "组合提示词已保存。现在可以让AI写出完整音乐JSON。", "success");
    await loadRecords();
  } catch (error) {
    setStatus(workflowStatus, error.message, "error");
  } finally {
    approvePromptButton.disabled = false;
    approvePromptButton.textContent = "确认提示词";
  }
});

generateJsonButton.addEventListener("click", async () => {
  if (!productionRecord) return;
  generateJsonButton.disabled = true;
  generateJsonButton.textContent = "生成中…";
  try {
    productionRecord = await request("/api/records/generate", { recordId: productionRecord.recordId });
    jsonPreview.textContent = JSON.stringify(productionRecord.skeleton, null, 2);
    jsonPreview.classList.remove("is-hidden");
    previewButton.disabled = false;
    setStatus(workflowStatus, "JSON已通过主题继承、节拍、音域和乐器规则检查。", "success");
    await loadRecords();
  } catch (error) {
    setStatus(workflowStatus, error.message, "error");
  } finally {
    generateJsonButton.disabled = false;
    generateJsonButton.textContent = "生成 JSON";
  }
});

previewButton.addEventListener("click", async () => {
  if (!productionRecord) return;
  previewButton.disabled = true;
  previewButton.textContent = "渲染中…";
  try {
    productionRecord = await request("/api/records/preview", { recordId: productionRecord.recordId });
    previewAudio.src = productionRecord.previewUrl;
    previewBox.classList.remove("is-hidden");
    setStatus(workflowStatus, "试听已生成。确认它既像这个心情，也有选定的律动感。", "success");
    await loadRecords();
  } catch (error) {
    setStatus(workflowStatus, error.message, "error");
  } finally {
    previewButton.disabled = false;
    previewButton.textContent = "重新生成试听";
  }
});

approvePreviewButton.addEventListener("click", async () => {
  if (!productionRecord) return;
  approvePreviewButton.disabled = true;
  try {
    productionRecord = await request("/api/records/approve", { recordId: productionRecord.recordId });
    generateStemsButton.disabled = false;
    setStatus(workflowStatus, "这份改编已确认，可以生成正式分轨。", "success");
    await loadRecords();
  } catch (error) {
    setStatus(workflowStatus, error.message, "error");
  } finally {
    approvePreviewButton.disabled = false;
  }
});

generateStemsButton.addEventListener("click", async () => {
  if (!productionRecord) return;
  generateStemsButton.disabled = true;
  generateStemsButton.textContent = "生成中…";
  stopPlayback();
  try {
    const data = await request("/api/records/stems", { recordId: productionRecord.recordId });
    productionRecord = data.record;
    currentJob = data.job;
    await prepareMixer(data.job);
    mixerPanel.classList.remove("is-hidden");
    mixerPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    setStatus(workflowStatus, "正式分轨已生成，可以调音和导出。", "success");
    await Promise.all([loadBlueprint(), loadRecords(), loadLibrary()]);
  } catch (error) {
    setStatus(workflowStatus, error.message, "error");
  } finally {
    generateStemsButton.disabled = false;
    generateStemsButton.textContent = "生成正式分轨";
  }
});

async function loadRecords() {
  refreshRecordsButton.disabled = true;
  try {
    const response = await fetch("/api/records");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "读取失败");
    recordsList.innerHTML = data.records.length ? data.records.map(record => `<article class="library-item"><div class="library-name"><strong>${escapeHtml(record.feeling)} × ${escapeHtml(record.groove)}</strong><span>${escapeHtml(formatDate(record.createdAt))} · ${escapeHtml(record.model)}</span></div><div class="library-meta">${escapeHtml(recordStatus(record.status))}<br>${escapeHtml(record.kitId)}</div><div class="library-actions">${record.previewUrl ? `<a class="mix-link" href="${escapeHtml(record.previewUrl)}" target="_blank">打开试听</a>` : ""}</div></article>`).join("") : '<div class="empty-library">还没有音乐制作记录。</div>';
  } catch (error) {
    recordsList.innerHTML = `<div class="empty-library">读取失败：${escapeHtml(error.message)}</div>`;
  } finally {
    refreshRecordsButton.disabled = false;
  }
}

refreshRecordsButton.addEventListener("click", loadRecords);

function acceptSkeleton(data, filename) {
  if (!data || Array.isArray(data) || typeof data !== "object") throw new Error("JSON最外层需要是一个对象");
  skeleton = data;
  fileTitle.textContent = filename;
  fileSubtitle.textContent = `${data.kitId || "未填写编号"} · ${data.bpm || "?"} BPM · ${data.bars || "?"} 小节`;
  processButton.disabled = false;
  setStatus(statusBox, "JSON已就绪，可以直接生成分轨", "success");
}

async function readFile(file) {
  try { acceptSkeleton(JSON.parse(await file.text()), file.name); }
  catch (error) { skeleton = null; processButton.disabled = true; setStatus(statusBox, `无法读取：${error.message}`, "error"); }
}

fileInput.addEventListener("change", () => fileInput.files[0] && readFile(fileInput.files[0]));
["dragenter", "dragover"].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.add("is-dragging"); }));
["dragleave", "drop"].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.remove("is-dragging"); }));
dropZone.addEventListener("drop", event => event.dataTransfer.files[0] && readFile(event.dataTransfer.files[0]));

exampleButton.addEventListener("click", async () => {
  try { const response = await fetch("/api/example"); const data = await response.json(); acceptSkeleton(data.skeleton, "happy_bounce_v01 示例.json"); }
  catch (error) { setStatus(statusBox, `示例载入失败：${error.message}`, "error"); }
});

processButton.addEventListener("click", async () => {
  processButton.disabled = true; exampleButton.disabled = true; mixerPanel.classList.add("is-hidden"); stopPlayback(); setStatus(statusBox, "正在检查JSON并渲染分轨，请稍候…");
  try { currentJob = await request("/api/process", { skeleton }); await prepareMixer(currentJob); mixerPanel.classList.remove("is-hidden"); mixerPanel.scrollIntoView({ behavior: "smooth", block: "start" }); setStatus(statusBox, "分轨生成成功，可以开始调音", "success"); await loadLibrary(); }
  catch (error) { setStatus(statusBox, error.message, "error"); }
  finally { processButton.disabled = false; exampleButton.disabled = false; }
});

async function loadLibrary() {
  refreshLibraryButton.disabled = true;
  try {
    const response = await fetch("/api/jobs"); const data = await response.json(); if (!response.ok) throw new Error(data.error || "读取失败");
    libraryList.innerHTML = data.jobs.length ? "" : '<div class="empty-library">还没有完成分轨。</div>';
    data.jobs.forEach(job => {
      const item = document.createElement("article"); item.className = "library-item";
      item.innerHTML = `<div class="library-name"><strong>${escapeHtml(job.kitId)}</strong><span>${escapeHtml(formatDate(job.createdAt))}</span></div><div class="library-meta">${escapeHtml(job.bpm)} BPM · ${escapeHtml(job.bars)} 小节<br>${escapeHtml(job.stems.length)} 条可调分轨</div><div class="library-actions">${job.latestMixUrl ? `<a class="mix-link" href="${job.latestMixUrl}" target="_blank">最近混音</a>` : ""}<button class="button secondary compact open-job" type="button">打开调音</button></div>`;
      item.querySelector(".open-job").addEventListener("click", async event => { const button = event.currentTarget; button.disabled = true; stopPlayback(); try { currentJob = job; await prepareMixer(job); mixerPanel.classList.remove("is-hidden"); mixerPanel.scrollIntoView({ behavior: "smooth", block: "start" }); setStatus(statusBox, `已打开 ${job.kitId}`, "success"); } catch (error) { setStatus(statusBox, error.message, "error"); } finally { button.disabled = false; } });
      libraryList.appendChild(item);
    });
  } catch (error) { libraryList.innerHTML = `<div class="empty-library">读取失败：${escapeHtml(error.message)}</div>`; }
  finally { refreshLibraryButton.disabled = false; }
}

refreshLibraryButton.addEventListener("click", loadLibrary);

async function prepareMixer(job) {
  tracksBox.innerHTML = ""; buffers = {}; gainNodes = {}; muted.clear(); soloed.clear(); downloadBox.classList.add("is-hidden"); audioContext ||= new AudioContext();
  await Promise.all(job.stems.map(async stem => { const response = await fetch(stem.url); buffers[stem.animal] = await audioContext.decodeAudioData(await response.arrayBuffer()); }));
  job.stems.forEach(stem => tracksBox.appendChild(createTrack(stem)));
  document.querySelector("#kit-summary").textContent = `${job.kitId} · 5秒循环 · ${job.stems.length}条轨道同步`;
}

function createTrack(stem) {
  const animal = stem.animal; const info = animalInfo[animal];
  const toneOptions = animal === "bear" ? (currentJob.bearTones || []).map(tone => `<option value="${escapeHtml(tone.id)}" ${tone.id === (currentJob.bearTone || "grand_piano") ? "selected" : ""}>${escapeHtml(tone.label)}</option>`).join("") : "";
  const row = document.createElement("article"); row.className = "track"; row.dataset.animal = animal; row.style.setProperty("--track-color", info.color); row.style.setProperty("--track-soft", info.soft);
  row.innerHTML = `<div class="animal-icon"><img src="${info.image}" alt=""></div><div class="track-name"><strong>${info.name}</strong><span>${info.role}</span></div><label class="volume-wrap"><input type="range" min="0" max="150" value="100" aria-label="${info.name}音量"><span class="volume-value">100%</span></label><div class="track-buttons"><button class="tiny-button mute" type="button">静音</button><button class="tiny-button solo" type="button">独奏</button><button class="tiny-button export-stem" type="button">导出单轨</button></div>${animal === "bear" ? `<div class="tone-controls"><label>键盘音色<select class="tone-select">${toneOptions}</select></label><button class="tiny-button apply-tone" type="button">应用音色</button><span>和声保持不变</span></div>` : ""}`;
  const slider = row.querySelector("input"); slider.addEventListener("input", () => { row.querySelector(".volume-value").textContent = `${slider.value}%`; updateGains(); });
  row.querySelector(".mute").addEventListener("click", event => { muted.has(animal) ? muted.delete(animal) : muted.add(animal); event.currentTarget.classList.toggle("is-active", muted.has(animal)); updateGains(); });
  row.querySelector(".solo").addEventListener("click", event => { soloed.has(animal) ? soloed.delete(animal) : soloed.add(animal); event.currentTarget.classList.toggle("is-active", soloed.has(animal)); updateGains(); });
  row.querySelector(".export-stem").addEventListener("click", event => exportSingleStem(animal, Number(slider.value) / 100, event.currentTarget));
  if (animal === "bear") row.querySelector(".apply-tone").addEventListener("click", event => applyBearTone(row.querySelector(".tone-select").value, event.currentTarget));
  return row;
}

async function applyBearTone(tone, button) {
  if (!currentJob) return; button.disabled = true; stopPlayback();
  try { const data = await request("/api/tone", { jobId: currentJob.jobId, tone }); const response = await fetch(data.url); buffers.bear = await audioContext.decodeAudioData(await response.arrayBuffer()); currentJob.stems.find(stem => stem.animal === "bear").url = data.url; currentJob.bearTone = data.tone; setStatus(statusBox, `小熊键盘已切换为${data.label}`, "success"); await loadLibrary(); }
  catch (error) { setStatus(statusBox, error.message, "error"); }
  finally { button.disabled = false; }
}

async function exportSingleStem(animal, gain, button) {
  if (!currentJob) return; const original = button.textContent; button.disabled = true; button.textContent = "生成中…";
  try { const data = await request("/api/stem", { jobId: currentJob.jobId, animal, gain }); const link = document.createElement("a"); link.href = data.url; link.download = data.filename; document.body.appendChild(link); link.click(); link.remove(); setStatus(statusBox, `${animalInfo[animal].name}单轨已导出`, "success"); }
  catch (error) { setStatus(statusBox, error.message, "error"); }
  finally { button.disabled = false; button.textContent = original; }
}

function currentGains() { const values = {}; document.querySelectorAll(".track").forEach(row => { const animal = row.dataset.animal; const value = Number(row.querySelector("input").value) / 100; values[animal] = !muted.has(animal) && (soloed.size === 0 || soloed.has(animal)) ? value : 0; }); return values; }
function updateGains() { const values = currentGains(); Object.entries(gainNodes).forEach(([animal, node]) => node.gain.setTargetAtTime(values[animal], audioContext.currentTime, .015)); }
async function startPlayback() { if (!currentJob || playing) return; await audioContext.resume(); const startAt = audioContext.currentTime + .06; const values = currentGains(); Object.keys(buffers).forEach(animal => { const source = audioContext.createBufferSource(); const gain = audioContext.createGain(); source.buffer = buffers[animal]; source.loop = true; gain.gain.value = values[animal]; source.connect(gain).connect(audioContext.destination); source.start(startAt); sources[animal] = source; gainNodes[animal] = gain; }); playing = true; playButton.textContent = "Ⅱ"; transportLabel.textContent = "循环播放中"; }
function stopPlayback() { Object.values(sources).forEach(source => { try { source.stop(); } catch (_) { /* 已停止 */ } }); sources = {}; gainNodes = {}; playing = false; playButton.textContent = "▶"; transportLabel.textContent = "准备播放"; }
playButton.addEventListener("click", () => playing ? stopPlayback() : startPlayback());
stopButton.addEventListener("click", stopPlayback);
exportButton.addEventListener("click", async () => { if (!currentJob) return; exportButton.disabled = true; try { const data = await request("/api/mix", { jobId: currentJob.jobId, gains: currentGains() }); downloadLink.href = data.url; downloadLink.download = `${currentJob.kitId}_mix.wav`; downloadBox.classList.remove("is-hidden"); await loadLibrary(); } catch (error) { setStatus(statusBox, error.message, "error"); } finally { exportButton.disabled = false; } });

Promise.all([loadBlueprint(), loadRecipes(), loadRecords(), loadLibrary()]);
