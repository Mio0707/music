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
const themeJsonFreshness = document.querySelector("#theme-json-freshness");
const generateThemeButton = document.querySelector("#generate-theme-button");
const lockThemeButton = document.querySelector("#lock-theme-button");
const themePreviewButton = document.querySelector("#theme-preview-button");
const themePreviewBox = document.querySelector("#theme-preview-box");
const themePreviewAudio = document.querySelector("#theme-preview-audio");
const themeRevisionFeedback = document.querySelector("#theme-revision-feedback");
const reviseThemeButton = document.querySelector("#revise-theme-button");
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
const jsonEditorWrap = document.querySelector("#json-editor-wrap");
const jsonEditor = document.querySelector("#json-editor");
const jsonEditStatus = document.querySelector("#json-edit-status");
const formatJsonButton = document.querySelector("#format-json-button");
const restoreJsonButton = document.querySelector("#restore-json-button");
const saveJsonButton = document.querySelector("#save-json-button");
const previewButton = document.querySelector("#preview-button");
const previewBox = document.querySelector("#preview-box");
const previewAudio = document.querySelector("#preview-audio");
const approvePreviewButton = document.querySelector("#approve-preview-button");
const revisionBox = document.querySelector("#revision-box");
const revisionFeedback = document.querySelector("#revision-feedback");
const reviseJsonButton = document.querySelector("#revise-json-button");
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
const publishButton = document.querySelector("#publish-button");
const publishBox = document.querySelector("#publish-box");
const publishResult = document.querySelector("#publish-result");
const manifestLink = document.querySelector("#manifest-link");
const mixerStatus = document.querySelector("#mixer-status");

let blueprintData = null;
let recipes = [];
let selectedEmotionId = "happy";
let selectedGrooveId = "steady";
let themeDraft = null;
let themeJsonSourcePrompt = null;
let themeJsonDirty = false;
let productionRecord = null;
let lastSavedProductionJson = "";
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
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await response.json() : { error: "平台后台没有识别这个请求。请在 PowerShell 中停止并重新启动平台后再试。" };
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
  return ({ prompt_approved: "提示词已确认", json_ready: "JSON 已就绪", preview_ready: "等待试听确认", preview_approved: "试听已确认", stems_ready: "分轨已完成", published: "已保存到前端", generation_failed: "生成失败", ready: "可以制作", blocked: "等待母版" })[status] || status;
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
  const activeDraft = theme.pendingDraft || (theme.status !== "locked" ? theme.draft : null);
  themeName.textContent = `${theme.label}主题`;
  themeBrief.textContent = theme.brief;
  themePromptEditor.value = theme.prompt;
  themeDraft = activeDraft?.theme || theme.theme || null;
  themeJsonSourcePrompt = activeDraft?.sourcePrompt || (theme.theme ? theme.lockedPrompt : null);
  themeJsonDirty = false;
  if (themeDraft) {
    themeJsonEditor.value = JSON.stringify(themeDraft, null, 2);
    themeJsonWrap.classList.remove("is-hidden");
  } else {
    themeJsonEditor.value = "";
    themeJsonWrap.classList.add("is-hidden");
  }
  updateThemeDraftControls();
}

function normalizedPrompt(value) {
  return String(value || "").trim();
}

function isThemeJsonStale() {
  return Boolean(themeDraft) && normalizedPrompt(themeJsonSourcePrompt) !== normalizedPrompt(themePromptEditor.value);
}

function updateThemeDraftControls({ updateStatus = true } = {}) {
  const theme = currentTheme();
  if (!theme) return;
  const hasPendingDraft = Boolean(theme.pendingDraft) || themeJsonDirty;
  const stale = isThemeJsonStale();

  generateThemeButton.textContent = themeDraft ? "用当前提示词重新生成 JSON" : "用当前提示词生成 JSON";
  themePreviewButton.disabled = !themeDraft || stale;
  reviseThemeButton.disabled = !themeDraft || stale;
  lockThemeButton.disabled = !themeDraft || stale || (theme.status === "locked" && !hasPendingDraft);
  lockThemeButton.textContent = stale
    ? "请先重新生成 JSON"
    : hasPendingDraft && theme.status === "locked"
      ? "保存最新母版"
      : theme.status === "locked"
        ? "主题母版已锁定"
        : "锁定为心情母版";

  if (stale) {
    themeStatusPill.textContent = "提示词已更新";
    themeStatusPill.className = "status-pill is-draft";
    themeJsonFreshness.textContent = "当前 JSON 基于旧提示词";
    themeJsonFreshness.className = "json-freshness is-stale";
    if (updateStatus) setStatus(themeStatus, "提示词已更新，当前 JSON 基于旧提示词。请先重新生成 JSON，之后才能试听或保存。", "error");
    return;
  }

  themeStatusPill.textContent = hasPendingDraft && theme.status === "locked" ? "新版待保存" : statusLabel(theme.status);
  themeStatusPill.className = `status-pill ${hasPendingDraft ? "is-draft" : theme.status === "locked" ? "is-locked" : theme.status === "draft" ? "is-draft" : ""}`;
  themeJsonFreshness.textContent = themeDraft ? hasPendingDraft ? "新 JSON 待保存" : "与当前提示词一致" : "";
  themeJsonFreshness.className = `json-freshness ${hasPendingDraft ? "is-pending" : "is-current"}`;
  if (!updateStatus) return;
  setStatus(
    themeStatus,
    hasPendingDraft
      ? "新 JSON 已生成。请试听确认后点击“保存最新母版”。"
      : theme.status === "locked"
        ? "这份心情母版已进入知识库，四个律动版本将强制继承它。"
        : theme.status === "draft"
          ? "已有一份 AI 草案，请检查 JSON 后锁定。"
          : "审核提示词后，让 AI 生成这份心情的共同音乐身份。",
    theme.status === "locked" && !hasPendingDraft ? "success" : "",
  );
}

function markThemeDraftPending() {
  themeJsonDirty = true;
  updateThemeDraftControls();
}

themePromptEditor.addEventListener("input", () => {
  resetThemePreview();
  updateThemeDraftControls();
});

themeJsonEditor.addEventListener("input", markThemeDraftPending);

function resetThemePreview() {
  themePreviewAudio.pause();
  themePreviewAudio.removeAttribute("src");
  themePreviewAudio.load();
  themePreviewBox.classList.add("is-hidden");
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
  lastSavedProductionJson = "";
  jsonEditorWrap.classList.add("is-hidden");
  jsonEditor.value = "";
  jsonEditStatus.textContent = "已通过检查";
  jsonEditStatus.className = "json-edit-status is-saved";
  formatJsonButton.disabled = false;
  restoreJsonButton.disabled = true;
  saveJsonButton.disabled = true;
  previewBox.classList.add("is-hidden");
  previewAudio.pause();
  previewAudio.removeAttribute("src");
  revisionBox.classList.add("is-hidden");
  revisionFeedback.value = "";
  reviseJsonButton.disabled = false;
  reviseJsonButton.textContent = "按意见重新生成";
  generateJsonButton.disabled = true;
  previewButton.disabled = true;
  generateStemsButton.disabled = true;
}

function resetProductionPreview() {
  previewAudio.pause();
  previewAudio.removeAttribute("src");
  previewAudio.load();
  previewBox.classList.add("is-hidden");
  revisionBox.classList.add("is-hidden");
  revisionFeedback.value = "";
}

function showProductionJson(value) {
  lastSavedProductionJson = JSON.stringify(value, null, 2);
  jsonEditor.value = lastSavedProductionJson;
  jsonEditorWrap.classList.remove("is-hidden");
  jsonEditStatus.textContent = "已通过检查";
  jsonEditStatus.className = "json-edit-status is-saved";
  restoreJsonButton.disabled = true;
  saveJsonButton.disabled = true;
  previewButton.disabled = false;
}

function updateProductionJsonDirtyState() {
  const isDirty = jsonEditor.value !== lastSavedProductionJson;
  jsonEditStatus.textContent = isDirty ? "有未保存修改" : "已通过检查";
  jsonEditStatus.className = `json-edit-status ${isDirty ? "is-dirty" : "is-saved"}`;
  restoreJsonButton.disabled = !isDirty;
  saveJsonButton.disabled = !isDirty;
  previewButton.disabled = isDirty || !productionRecord;
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
    themeJsonSourcePrompt = normalizedPrompt(themePromptEditor.value);
    themeJsonDirty = true;
    themeJsonEditor.value = JSON.stringify(themeDraft, null, 2);
    themeJsonWrap.classList.remove("is-hidden");
    resetThemePreview();
    updateThemeDraftControls({ updateStatus: false });
    setStatus(themeStatus, "已用当前提示词生成新 JSON。请先试听，确认后再保存母版。", "success");
  } catch (error) {
    setStatus(themeStatus, error.message, "error");
  } finally {
    generateThemeButton.disabled = false;
    updateThemeDraftControls({ updateStatus: false });
  }
});

lockThemeButton.addEventListener("click", async () => {
  if (isThemeJsonStale()) {
    updateThemeDraftControls();
    return;
  }
  const replacingLockedTheme = currentTheme()?.status === "locked";
  if (replacingLockedTheme && !window.confirm("保存后会替换当前已锁定母版，之后生成的四种律动都会继承这个新版本。确认保存吗？")) return;
  lockThemeButton.disabled = true;
  lockThemeButton.textContent = replacingLockedTheme ? "正在保存最新母版…" : "正在锁定…";
  try {
    const theme = JSON.parse(themeJsonEditor.value);
    await request("/api/themes/lock", { emotionId: selectedEmotionId, theme, prompt: themePromptEditor.value });
    setStatus(themeStatus, "最新主题母版已保存，四个律动改编会继承这个版本。", "success");
    await Promise.all([loadBlueprint(), loadRecipes()]);
  } catch (error) {
    setStatus(themeStatus, error instanceof SyntaxError ? "主题JSON格式不完整，请检查括号和逗号。" : error.message, "error");
    markThemeDraftPending();
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
  generateJsonButton.textContent = "生成并检查中…";
  try {
    productionRecord = await request("/api/records/generate", { recordId: productionRecord.recordId });
    showProductionJson(productionRecord.skeleton);
    const repairAttempts = Number(productionRecord.lastAutoRepairAttempts || 0);
    const resultMessage = repairAttempts > 0
      ? `初稿未通过检查，AI 已自动修改 ${repairAttempts} 次并通过。`
      : "JSON已通过主题继承、节拍、音域和乐器规则检查。";
    setStatus(workflowStatus, resultMessage, "success");
    await loadRecords();
  } catch (error) {
    setStatus(workflowStatus, error.message, "error");
  } finally {
    generateJsonButton.disabled = false;
    generateJsonButton.textContent = "生成 JSON";
  }
});

jsonEditor.addEventListener("input", updateProductionJsonDirtyState);

formatJsonButton.addEventListener("click", () => {
  try {
    jsonEditor.value = JSON.stringify(JSON.parse(jsonEditor.value), null, 2);
    updateProductionJsonDirtyState();
    setStatus(workflowStatus, "JSON 格式已整理；如有修改，请检查并保存。", "success");
  } catch (error) {
    jsonEditStatus.textContent = "JSON 格式有误";
    jsonEditStatus.className = "json-edit-status is-error";
    setStatus(workflowStatus, "JSON 格式不完整，请检查括号、引号和逗号。", "error");
  }
});

restoreJsonButton.addEventListener("click", () => {
  jsonEditor.value = lastSavedProductionJson;
  updateProductionJsonDirtyState();
  setStatus(workflowStatus, "已恢复到上次通过检查并保存的 JSON。", "success");
});

saveJsonButton.addEventListener("click", async () => {
  if (!productionRecord) return;
  let editedSkeleton;
  try {
    editedSkeleton = JSON.parse(jsonEditor.value);
  } catch (error) {
    jsonEditStatus.textContent = "JSON 格式有误";
    jsonEditStatus.className = "json-edit-status is-error";
    setStatus(workflowStatus, "JSON 格式不完整，请检查括号、引号和逗号。", "error");
    return;
  }
  saveJsonButton.disabled = true;
  restoreJsonButton.disabled = true;
  formatJsonButton.disabled = true;
  saveJsonButton.textContent = "检查中…";
  try {
    productionRecord = await request("/api/records/save-json", { recordId: productionRecord.recordId, skeleton: editedSkeleton });
    showProductionJson(productionRecord.skeleton);
    resetProductionPreview();
    setStatus(workflowStatus, "手动修改已通过音乐规则检查并保存，可以生成新的试听。", "success");
    await loadRecords();
  } catch (error) {
    jsonEditStatus.textContent = "检查未通过";
    jsonEditStatus.className = "json-edit-status is-error";
    restoreJsonButton.disabled = false;
    saveJsonButton.disabled = false;
    previewButton.disabled = true;
    setStatus(workflowStatus, `${error.message} 上次可用版本未被覆盖。`, "error");
  } finally {
    formatJsonButton.disabled = false;
    saveJsonButton.textContent = "检查并保存";
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
    revisionBox.classList.remove("is-hidden");
    setStatus(workflowStatus, "试听已生成。确认它既像这个心情，也有选定的律动感。", "success");
    await loadRecords();
  } catch (error) {
    setStatus(workflowStatus, error.message, "error");
  } finally {
    previewButton.disabled = false;
    previewButton.textContent = "重新生成试听";
  }
});

themePreviewButton.addEventListener("click", async () => {
  themePreviewButton.disabled = true;
  themePreviewButton.textContent = "渲染中…";
  try {
    const theme = JSON.parse(themeJsonEditor.value);
    const data = await request("/api/themes/preview", { emotionId: selectedEmotionId, theme });
    themePreviewAudio.src = data.previewUrl;
    themePreviewBox.classList.remove("is-hidden");
    setStatus(themeStatus, "母版试听已生成。请重点听旋律轮廓、和声色彩和整体情绪。", "success");
  } catch (error) {
    setStatus(themeStatus, error instanceof SyntaxError ? "主题 JSON 格式不完整，请检查括号和逗号。" : error.message, "error");
  } finally {
    themePreviewButton.disabled = isThemeJsonStale();
    themePreviewButton.textContent = "重新生成母版试听";
  }
});

reviseThemeButton.addEventListener("click", async () => {
  const feedback = themeRevisionFeedback.value.trim();
  if (feedback.length < 4) {
    setStatus(themeStatus, "请先写下具体修改意见，例如“整体更明亮活泼，和声更有阳光感”。", "error");
    themeRevisionFeedback.focus();
    return;
  }
  reviseThemeButton.disabled = true;
  reviseThemeButton.textContent = "正在按意见修改…";
  try {
    const theme = JSON.parse(themeJsonEditor.value);
    const data = await request("/api/themes/revise", { emotionId: selectedEmotionId, theme, prompt: themePromptEditor.value, feedback });
    themeDraft = data.theme;
    themeJsonSourcePrompt = normalizedPrompt(themePromptEditor.value);
    themeJsonDirty = true;
    themeJsonEditor.value = JSON.stringify(themeDraft, null, 2);
    themeRevisionFeedback.value = "";
    resetThemePreview();
    updateThemeDraftControls({ updateStatus: false });
    setStatus(themeStatus, "主题母版已按意见更新。请重新试听，满意后再锁定。", "success");
  } catch (error) {
    setStatus(themeStatus, error instanceof SyntaxError ? "主题 JSON 格式不完整，请检查括号和逗号。" : error.message, "error");
  } finally {
    reviseThemeButton.disabled = isThemeJsonStale();
    reviseThemeButton.textContent = "按意见修改母版";
  }
});

reviseJsonButton.addEventListener("click", async () => {
  if (!productionRecord) return;
  const feedback = revisionFeedback.value.trim();
  if (feedback.length < 4) {
    setStatus(workflowStatus, "请先写下具体的修改意见，例如“整体更明亮，键盘提高音区”。", "error");
    revisionFeedback.focus();
    return;
  }
  reviseJsonButton.disabled = true;
  reviseJsonButton.textContent = "正在按意见修改…";
  try {
    productionRecord = await request("/api/records/revise", { recordId: productionRecord.recordId, feedback });
    showProductionJson(productionRecord.skeleton);
    resetProductionPreview();
    const repairAttempts = Number(productionRecord.lastAutoRepairAttempts || 0);
    const resultMessage = repairAttempts > 0
      ? `已按意见修改；新版本未通过初次检查，AI 又自动修正 ${repairAttempts} 次并通过。请重新生成试听。`
      : "已按修改意见生成新的 JSON，并通过音乐规则检查。请重新生成试听。";
    setStatus(workflowStatus, resultMessage, "success");
    await loadRecords();
  } catch (error) {
    setStatus(workflowStatus, error.message, "error");
  } finally {
    reviseJsonButton.disabled = false;
    reviseJsonButton.textContent = "按意见重新生成";
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
    recordsList.innerHTML = data.records.length ? data.records.map(record => `<article class="library-item"><div class="library-name"><strong>${escapeHtml(record.feeling)} × ${escapeHtml(record.groove)}</strong><span>${escapeHtml(formatDate(record.createdAt))} · ${escapeHtml(record.model)}</span></div><div class="library-meta">${escapeHtml(recordStatus(record.status))}<br>${escapeHtml(record.kitId)}</div><div class="library-actions">${record.previewUrl ? `<a class="mix-link" href="${escapeHtml(record.previewUrl)}" target="_blank">打开试听</a>` : ""}<button class="button danger compact delete-record" type="button" data-record-id="${escapeHtml(record.recordId)}" data-record-name="${escapeHtml(`${record.feeling} × ${record.groove}`)}">删除</button></div></article>`).join("") : '<div class="empty-library">还没有音乐制作记录。</div>';
    recordsList.querySelectorAll(".delete-record").forEach(button => button.addEventListener("click", () => deleteRecord(button)));
  } catch (error) {
    recordsList.innerHTML = `<div class="empty-library">读取失败：${escapeHtml(error.message)}</div>`;
  } finally {
    refreshRecordsButton.disabled = false;
  }
}

async function deleteRecord(button) {
  const recordId = button.dataset.recordId;
  const recordName = button.dataset.recordName || "这条制作记录";
  if (!window.confirm(`确定删除“${recordName}”吗？\n\n这会删除该记录的提示词、模型输出、JSON、试听文件，以及工作区里的分轨和混音，无法恢复。已经发布到前端资源库的版本不会被删除。`)) return;

  button.disabled = true;
  button.textContent = "删除中…";
  try {
    const result = await request("/api/records/delete", { recordId });
    if (productionRecord?.recordId === recordId) resetWorkflow();
    if (currentJob?.jobId === result.deletedJobId) {
      stopPlayback();
      currentJob = null;
      mixerPanel.classList.add("is-hidden");
    }
    await Promise.all([loadRecords(), loadLibrary(), loadBlueprint()]);
    setStatus(workflowStatus, "制作记录及其关联文件已删除。", "success");
  } catch (error) {
    button.disabled = false;
    button.textContent = "删除";
    setStatus(workflowStatus, error.message, "error");
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
  tracksBox.innerHTML = ""; buffers = {}; gainNodes = {}; muted.clear(); soloed.clear(); downloadBox.classList.add("is-hidden"); publishBox.classList.add("is-hidden"); audioContext ||= new AudioContext();
  await Promise.all(job.stems.map(async stem => { const response = await fetch(stem.url); buffers[stem.animal] = await audioContext.decodeAudioData(await response.arrayBuffer()); }));
  job.stems.forEach(stem => tracksBox.appendChild(createTrack(stem)));
  document.querySelector("#kit-summary").textContent = `${job.kitId} · 5秒循环 · ${job.stems.length}条轨道同步`;
  setStatus(mixerStatus, "试听并调整各分轨音量，确认后保存到前端。");
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
function publishGains() { const values = {}; document.querySelectorAll(".track").forEach(row => { values[row.dataset.animal] = Number(row.querySelector("input").value) / 100; }); return values; }
function updateGains() { const values = currentGains(); Object.entries(gainNodes).forEach(([animal, node]) => node.gain.setTargetAtTime(values[animal], audioContext.currentTime, .015)); }
async function startPlayback() { if (!currentJob || playing) return; await audioContext.resume(); const startAt = audioContext.currentTime + .06; const values = currentGains(); Object.keys(buffers).forEach(animal => { const source = audioContext.createBufferSource(); const gain = audioContext.createGain(); source.buffer = buffers[animal]; source.loop = true; gain.gain.value = values[animal]; source.connect(gain).connect(audioContext.destination); source.start(startAt); sources[animal] = source; gainNodes[animal] = gain; }); playing = true; playButton.textContent = "Ⅱ"; transportLabel.textContent = "循环播放中"; }
function stopPlayback() { Object.values(sources).forEach(source => { try { source.stop(); } catch (_) { /* 已停止 */ } }); sources = {}; gainNodes = {}; playing = false; playButton.textContent = "▶"; transportLabel.textContent = "准备播放"; }
playButton.addEventListener("click", () => playing ? stopPlayback() : startPlayback());
stopButton.addEventListener("click", stopPlayback);
exportButton.addEventListener("click", async () => { if (!currentJob) return; exportButton.disabled = true; try { const data = await request("/api/mix", { jobId: currentJob.jobId, gains: currentGains() }); downloadLink.href = data.url; downloadLink.download = `${currentJob.kitId}_mix.wav`; downloadBox.classList.remove("is-hidden"); await loadLibrary(); } catch (error) { setStatus(statusBox, error.message, "error"); } finally { exportButton.disabled = false; } });

publishButton.addEventListener("click", async () => {
  if (!currentJob) return;
  publishButton.disabled = true;
  publishButton.textContent = "检查并保存中…";
  stopPlayback();
  try {
    const data = await request("/api/publish", { jobId: currentJob.jobId, gains: publishGains() });
    publishResult.textContent = `已保存 ${data.packId} ${data.version}：${data.frontendPath}`;
    manifestLink.href = data.manifestUrl;
    publishBox.classList.remove("is-hidden");
    setStatus(mixerStatus, "四条正式分轨已检查并保存到前端资源库。", "success");
    await Promise.all([loadRecords(), loadLibrary()]);
  } catch (error) {
    setStatus(mixerStatus, error.message, "error");
  } finally {
    publishButton.disabled = false;
    publishButton.textContent = "保存正式分轨到前端";
  }
});

Promise.all([loadBlueprint(), loadRecipes(), loadRecords(), loadLibrary()]);
