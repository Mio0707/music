const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const CREATION_BEATS = 4;

const animals = {
  dog: { emoji: "🐶", name: "小狗", role: "鼓" },
  rabbit: { emoji: "🐰", name: "小兔", role: "唱名" },
  bear: { emoji: "🐻", name: "小熊", role: "键盘" },
  cat: { emoji: "🐱", name: "小猫", role: "贝斯" },
  lion: { emoji: "🦁", name: "小狮子", role: "小号" }
};

const moods = {
  happy: { name: "开心", emoji: "☀️", hint: "像阳光跳进窗户", className: "mood-happy", bpm: 96, notes: [261.6, 329.6, 392, 523.3] },
  calm: { name: "安静", emoji: "🌙", hint: "留一点呼吸和空白", className: "mood-calm", bpm: 76, notes: [220, 261.6, 329.6, 392] },
  brave: { name: "勇敢", emoji: "🔥", hint: "让每一下都站得稳", className: "mood-brave", bpm: 88, notes: [196, 246.9, 293.7, 392] },
  miss: { name: "想念", emoji: "⭐", hint: "把远方放进旋律里", className: "mood-miss", bpm: 72, notes: [220, 293.7, 329.6, 440] }
};

function hasSavedPostcard() {
  try {
    return Boolean(localStorage.getItem("animal-music-postcard"));
  } catch {
    return false;
  }
}

const state = {
  screen: "home",
  mood: null,
  warmPattern: [0, 1, 2, 3],
  recordHits: [0, 2],
  isRecording: false,
  selectedAnimal: null,
  sections: [
    ["dog"], ["dog"], ["dog"], ["dog"]
  ],
  playingSection: null,
  stageOpen: false,
  stageSection: 0,
  stageCompleted: false,
  stageEntering: [],
  stageLeaving: [],
  version: "ai",
  title: "写给远方的星星",
  message: "想把今天做的音乐送给你。",
  saved: hasSavedPostcard(),
  modal: null
};

let audioContext;
let timers = [];
let micStream;
let analyser;
let micFrame;
let recordStartedAt = 0;
let lastMicHit = 0;
let stageMotionTimer;

function getAudioContext() {
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

function later(fn, delay) {
  const id = setTimeout(fn, delay);
  timers.push(id);
  return id;
}

function drum(strength = 1) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(150, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(48, ctx.currentTime + 0.09);
  gain.gain.setValueAtTime(0.5 * strength, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.13);
}

function tone(frequency, duration = 0.18, volume = 0.12, type = "sine") {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  later(() => toast.classList.remove("show"), 2200);
}

function setScreen(screen) {
  clearTimers();
  clearTimeout(stageMotionTimer);
  if (screen !== "record" && micStream) stopMicrophone();
  state.playingSection = null;
  state.stageOpen = false;
  state.stageCompleted = false;
  state.stageEntering = [];
  state.stageLeaving = [];
  state.screen = screen;
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
}

function topbar(step = "") {
  if (state.screen === "home") return "";
  return `
    <header class="topbar">
      <div class="topbar-side"><button class="button ghost" data-action="back" aria-label="返回上一步">← 返回</button></div>
      <div class="brand-mini">动物音乐</div>
      <div class="topbar-side"><span class="step-label">${step}</span></div>
    </header>`;
}

function band(className = "") {
  const members = Object.entries(animals).map(([key]) => performerMarkup(key, `band-member band-${key}`)).join("");
  return `<div class="band ${className}" aria-label="动物乐队">${members}</div>`;
}

function avatarMarkup(key, extraClass = "") {
  return `<span class="animal-avatar avatar-${key} ${extraClass}" aria-hidden="true"></span>`;
}

function performerMarkup(key, extraClass = "") {
  return `<span class="performer-art performer-${key} ${extraClass}" aria-hidden="true"></span>`;
}

function render() {
  const views = {
    home: renderHome,
    classroom: renderClassroom,
    classroomLesson: renderClassroomLesson,
    mood: renderMood,
    warmup: renderWarmup,
    record: renderRecord,
    arrange: renderArrange,
    processing: renderProcessing,
    refine: renderRefine,
    postcard: renderPostcard,
    perform: renderPerform
  };
  app.innerHTML = views[state.screen]();
  bindEvents();
}

function renderHome() {
  return `
    <section class="screen">
      <div class="hero">
        <p class="eyebrow">每一次创造，都值得被回应</p>
        <h1>拍一拍，做一首<br>你的音乐</h1>
        <p class="lead">叫上动物朋友，把今天的感觉变成一张音乐明信片。</p>
      </div>
      ${band()}
      <div class="actions"><button class="button primary" data-go="mood">开始创作</button></div>
      <div class="home-links">
        <button class="small-card" data-go="classroom"><span>🥁</span>教师音乐课堂</button>
        <button class="small-card" data-action="library"><span>💌</span>我的音乐明信片</button>
      </div>
    </section>`;
}

function melodyContour() {
  return `<div class="melody-card" aria-label="旋律高低线条">
    <div class="melody-labels"><span>高</span><span>低</span></div>
    <svg class="melody-svg" viewBox="0 0 640 180" role="img" aria-label="旋律先保持平稳，再逐渐升高，最后回到中间">
      <polyline points="40,132 120,132 200,96 280,96 360,54 440,54 520,96 600,96" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"></polyline>
      ${[[40,132],[120,132],[200,96],[280,96],[360,54],[440,54],[520,96],[600,96]].map(([x,y], index) => `<circle cx="${x}" cy="${y}" r="15"><title>第 ${index + 1} 个声音</title></circle>`).join("")}
    </svg>
    <div class="melody-caption">平稳 → 向上走 → 回到中间</div>
  </div>`;
}

function bodyPattern() {
  return `<div class="body-pattern" aria-label="身体演奏动作">
    <div><strong>1</strong><span>👏</span><small>拍手</small></div>
    <div><strong>2</strong><span>🤲</span><small>拍腿</small></div>
    <div><strong>3</strong><span>👏</span><small>拍手</small></div>
    <div><strong>4</strong><span>✨</span><small>停住</small></div>
  </div>`;
}

function renderClassroom() {
  return `${topbar("教师模式")}<section class="screen classroom-screen">
    <div class="hero"><p class="eyebrow">AI 音乐课堂</p><h2>把一首歌，变成全班都能参与的音乐活动</h2><p class="lead">首版使用经过审核的内置歌曲，保证课堂内容稳定、清楚、适龄。</p></div>
    <div class="lesson-shell">
      <div class="lesson-summary">
        <div class="song-cover">♪</div>
        <div><span class="lesson-tag">内置示范歌曲</span><h3>《小星星》</h3><p>6–8 岁 · 约 8 分钟 · 学习旋律高低与稳定拍</p></div>
      </div>
      <div class="ai-result-title"><span>AI 已完成分析</span><small>教师审核版</small></div>
      ${melodyContour()}
      <h3 class="section-heading">全班身体演奏</h3>
      ${bodyPattern()}
      <div class="teacher-notes"><strong>教师引导语</strong><p>“用手指跟着线条走一走。声音变高时，手也慢慢举高。”</p></div>
    </div>
    <div class="button-row"><button class="button secondary" data-action="play-class-song">▶ 听旋律片段</button><button class="button primary" data-go="classroomLesson">进入投屏课堂 →</button></div>
  </section>`;
}

function renderClassroomLesson() {
  return `${topbar("投屏课堂")}<section class="screen">
    <div class="hero"><p class="eyebrow">先看见，再用身体感受</p><h2>跟着旋律线，一起完成 4 拍</h2><p class="lead">屏幕负责提示什么时候开始、什么时候停；老师负责观察孩子并调整节奏。</p></div>
    <div class="lesson-shell lesson-live">
      ${melodyContour()}
      ${bodyPattern()}
      <div class="teacher-notes"><strong>这一轮只学一个特点</strong><p>听见旋律向上时举高手，最后一拍一起停住。</p></div>
    </div>
    <div class="button-row"><button class="button secondary" data-action="play-class-song">▶ 示范一次</button><button class="button primary" data-go="mood">现在轮到孩子创作 →</button></div>
  </section>`;
}

function renderMood() {
  const cards = Object.entries(moods).map(([key, mood]) => `
    <button class="mood-card ${mood.className} ${state.mood === key ? "selected" : ""}" data-mood="${key}" aria-pressed="${state.mood === key}">
      <span class="emoji">${mood.emoji}</span><strong>${mood.name}</strong><small>${mood.hint}</small>
    </button>`).join("");
  return `${topbar("创作第 1 步 / 3")}<section class="screen">
    <div class="hero"><p class="eyebrow">选择音乐的起点</p><h2>今天想从哪一种感觉开始？</h2><p class="lead">它只是一个开始，你可以把音乐改成任何样子。</p></div>
    <div class="mood-grid">${cards}</div>
    <div class="actions"><button class="button primary" data-go="arrange" ${state.mood ? "" : "disabled"}>用这张贴纸开始</button></div>
  </section>`;
}

function renderWarmup() {
  const dots = Array.from({ length: CREATION_BEATS }, (_, index) => {
    const hasNote = state.warmPattern.includes(index);
    return `<span class="beat-dot ${hasNote ? "hit" : ""}" data-beat="${index}" aria-label="第 ${index + 1} 拍${hasNote ? "有声音" : "休息"}">${hasNote ? "♩" : "—"}</span>`;
  }).join("");
  return `${topbar("第 2 步 / 5")}<section class="screen">
    <div class="hero"><p class="eyebrow">先和小狗热热身</p><h2>听一遍，再跟着拍 4 拍</h2><p class="lead">每一格是一拍；“♩”拍一下，“—”休息一下。没有分数。</p></div>
    <div class="stage-card">
      <div id="warm-dog" class="animal-hero">${avatarMarkup("dog", "warm-avatar")}</div>
      <div class="beat-row">${dots}</div>
      <div class="button-row">
        <button class="button primary" data-action="play-warm">▶ 听小狗示范</button>
        <button class="button secondary" data-action="new-pattern">换一个</button>
      </div>
    </div>
    <button class="button ghost" data-go="record">跳过热身，直接创作 →</button>
  </section>`;
}

function renderRecord() {
  const hits = state.recordHits.slice(0, CREATION_BEATS);
  const dots = Array.from({ length: CREATION_BEATS }, (_, index) => `<span class="beat-dot ${hits.includes(index) ? "hit" : ""}" data-record-beat="${index}">${hits.includes(index) ? "🐾" : index + 1}</span>`).join("");
  const hasRecording = state.recordHits.length > 0 && !state.isRecording;
  return `${topbar("第 3 步 / 5")}<section class="screen">
    <div class="hero"><p class="eyebrow">录下我的拍手</p><h2>${state.isRecording ? "现在，拍出你的 4 拍！" : hasRecording ? "小狗记住你的节奏了" : "准备好，就拍 4 拍"}</h2><p class="lead">前期每拍最多记一次拍手，也可以让某一拍安静。你还可以轻拍中间的大按钮。</p></div>
    <div class="stage-card">
      <div class="beat-row">${dots}</div>
      <button class="clap-pad" data-action="clap" aria-label="轻拍这里模拟拍手">👏</button>
      <p id="record-status" class="helper">${state.isRecording ? "正在录制 · 拍手或轻拍按钮" : hasRecording ? `捕捉到 ${state.recordHits.length} 次拍手` : "原型支持屏幕轻拍；允许麦克风后也能直接拍手"}</p>
      <div class="button-row">
        <button class="button ${hasRecording ? "secondary" : "primary"}" data-action="start-record">${hasRecording ? "再拍一次" : "开始录制"}</button>
        <button class="button secondary" data-action="enable-mic">允许麦克风</button>
      </div>
    </div>
    <div class="actions"><button class="button primary" data-go="arrange" ${hasRecording ? "" : "disabled"}>就用这个节奏</button></div>
  </section>`;
}

function renderArrange() {
  const questions = ["谁先开始？", "要加入新的声音吗？", "这里想怎么变化？", "谁来完成最后一段？"];
  const sections = state.sections.map((section, sectionIndex) => {
    const chips = section.length ? section.map(key => `<button class="animal-chip ${state.playingSection === sectionIndex ? "playing" : ""}" draggable="true" data-chip="${key}" data-from="${sectionIndex}" title="点击让${animals[key].name}休息">${avatarMarkup(key)}</button>`).join("") : `<div class="empty-section">点一下这里，邀请选中的动物</div>`;
    return `<article class="section-card ${state.playingSection === sectionIndex ? "current" : ""}" data-section="${sectionIndex}">
      <span class="section-number">${sectionIndex + 1}</span><p>${questions[sectionIndex]}</p><div class="section-animals">${chips}</div>
      <button class="button ghost" data-action="play-section" data-index="${sectionIndex}">▶ 试听</button>
    </article>`;
  }).join("");
  const stickers = Object.entries(animals).map(([key, animal]) => `<button class="sticker ${state.selectedAnimal === key ? "selected" : ""}" draggable="true" data-sticker="${key}" aria-pressed="${state.selectedAnimal === key}">${avatarMarkup(key)}<span>${animal.name} · ${animal.role}</span></button>`).join("");
  return `${topbar("创作第 2 步 / 3")}<section class="screen arrange-screen">
    <div class="hero"><p class="eyebrow">叫上动物乐队</p><h2>谁在哪一段演奏？</h2><p class="lead">拖动贴纸，或先点动物、再点乐段。点时间轴里的动物可以让它休息。</p></div>
    ${renderStage()}
    <div class="timeline">${sections}</div>
    <div class="sticker-tray" data-tray><h3>动物贴纸盒</h3><div class="stickers">${stickers}</div></div>
    <div class="button-row"><button class="button secondary" data-action="play-all">▶ 听我的作品</button><button class="button primary" data-action="begin-refine">看看它能怎么玩 →</button></div>
  </section>`;
}

function renderProcessing() {
  return `${topbar("正在完成")}<section class="screen">
    <div class="stage-card">
      ${band("playing")}
      <p class="eyebrow">正在整理你的四段编排</p>
      <h2>实时混音已经完成，正在优化衔接…</h2>
      <p class="lead">不会重新作曲，也不会改变动物出场。</p>
    </div>
  </section>`;
}

function renderRefine() {
  return `${topbar("创作第 3 步 / 3")}<section class="screen">
    <div class="hero"><p class="eyebrow">作品已经准备好</p><h2>先听作品，再一起演出来</h2><p class="lead">AI只优化音量、衔接和结尾，不重新作曲，也不替你改变动物出场。</p></div>
    <div class="lesson-shell">
      <div class="version-toggle">
        <button class="${state.version === "original" ? "active" : ""}" data-version="original">我的实时混音</button>
        <button class="${state.version === "ai" ? "active" : ""}" data-version="ai">✨ AI轻量优化</button>
      </div>
      <div class="promise-list">
        <div>✓ 保留动物出场时间</div>
        <div>✓ 不增加没有选择的乐器</div>
        <div>✓ ${state.version === "ai" ? "只优化音量、衔接和结尾" : "这是系统按四段编排完成的原始混音"}</div>
      </div>
      <div class="button-row"><button class="button secondary" data-action="preview-version">▶ 听这个版本</button><button class="button ghost" data-go="arrange">回去改一改</button></div>
      <h3 class="section-heading">把我的作品变成课堂玩法</h3>
      ${melodyContour()}
      <h3 class="section-heading">AI生成的身体演奏</h3>
      ${bodyPattern()}
    </div>
    <div class="button-row"><button class="button primary" data-go="perform">一起演我的音乐 →</button><button class="button secondary" data-go="postcard">做成音乐明信片</button></div>
  </section>`;
}

function renderPostcard() {
  const mood = moods[state.mood] || moods.miss;
  const titles = ["写给远方的星星", `${mood.name}的小乐队`, "五个朋友的歌"];
  const messages = ["想把今天做的音乐送给你。", "你听见小狗的鼓点了吗？", "这是我和动物朋友一起完成的！"];
  return `${topbar("作品完成")}<section class="screen">
    <div class="postcard">
      <div class="eyebrow">${mood.emoji} ${mood.name}音乐明信片</div>
      <h2>${state.title}</h2>
      ${band(state.playingSection !== null ? "playing" : "")}
      <div class="postcard-message">“${state.message}”</div>
      <button class="button secondary" data-action="play-all">▶ 播放我的音乐</button>
      <p class="authorship">由我选择与编排 · AI 提供音乐素材和混音帮助</p>
    </div>
    <div class="stage-card">
      <h3>给作品选个名字</h3><div class="choice-chips">${titles.map(title => `<button class="choice-chip ${state.title === title ? "selected" : ""}" data-title="${title}">${title}</button>`).join("")}</div>
      <h3 style="margin-top:20px">想说的一句话</h3><div class="choice-chips">${messages.map(message => `<button class="choice-chip ${state.message === message ? "selected" : ""}" data-message="${message}">${message}</button>`).join("")}</div>
    </div>
    <div class="button-row"><button class="button primary" data-action="save">${state.saved ? "✓ 已保存到我的明信片" : "保存到我的明信片"}</button><button class="button secondary" data-go="perform">一起演</button><button class="button secondary" data-action="share">分享给家人朋友</button></div>
  </section>${renderModal()}`;
}

function renderPerform() {
  return `${topbar("一起演")}<section class="screen">
    <div class="hero"><p class="eyebrow">这里不会拍摄你</p><h2>跟着动物一起动起来</h2><p class="lead">小狗拍手、小兔唱 do re mi、小熊弹键盘、小猫摇摆、小狮子先吸气、再吹小号。没有评分，尽情表演吧！</p></div>
    ${band(state.playingSection !== null ? "playing" : "")}
    ${bodyPattern()}
    <div class="actions"><button class="button primary" data-action="play-performance">▶ 开始一起演</button><button class="button secondary" data-go="classroom">回到教师课堂</button></div>
  </section>`;
}

function renderStage() {
  const sectionIndex = state.playingSection ?? state.stageSection;
  const activeAnimals = state.stageCompleted
    ? Object.keys(animals).filter(key => state.sections.some(section => section.includes(key)))
    : state.sections[sectionIndex];
  const visibleAnimals = [...new Set([...activeAnimals, ...state.stageLeaving])];
  const performers = Object.entries(animals)
    .filter(([key]) => visibleAnimals.includes(key))
    .map(([key, animal]) => `
      <div class="stage-character stage-${key} ${state.stageEntering.includes(key) ? "stage-enter" : ""} ${state.stageLeaving.includes(key) ? "stage-leave" : ""}" title="${animal.name} · ${animal.role}">
        ${performerMarkup(key, "stage-art")}
        <span class="stage-name">${animal.name}</span>
      </div>`).join("");
  return `<section class="stage-panel" aria-label="动物音乐舞台">
    <p class="stage-panel-label">舞台正在演出 · 时间轴决定谁上场</p>
    <div class="paper-theater mood-stage-${state.mood || "miss"}">
      <div class="curtain curtain-left"></div><div class="curtain curtain-right"></div>
      <div class="stage-banner">${state.stageCompleted ? "演奏完成 · 乐队合照" : `第 ${sectionIndex + 1} 段 · 正在演奏`}</div>
      <div class="stage-stars">✦　·　♪　·　✦</div>
      <div class="stage-floor"></div>
      <div class="stage-cast">${performers || `<div class="empty-stage-message">这一段请动物们休息</div>`}</div>
    </div>
  </section>`;
}

function renderModal() {
  if (!state.modal) return "";
  return `<div class="modal-backdrop" data-action="close-modal"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onclick="event.stopPropagation()">
    <div class="icon">🛡️</div><h2 id="modal-title">请一位家长或老师来帮忙</h2><p class="lead">作品现在只保存在这台设备上。分享前，请确认作品里没有真实姓名、学校或住址。</p>
    <div class="actions" style="margin:22px auto 0"><button class="button primary" data-action="adult-confirm">我已确认，模拟生成私密链接</button><button class="button secondary" data-action="close-modal">暂不分享</button></div>
  </div></div>`;
}

function bindEvents() {
  app.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => setScreen(button.dataset.go)));
  app.querySelectorAll("[data-mood]").forEach(button => button.addEventListener("click", () => selectMood(button.dataset.mood)));
  app.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", event => handleAction(button.dataset.action, button, event)));
  app.querySelectorAll("[data-version]").forEach(button => button.addEventListener("click", () => { state.version = button.dataset.version; render(); }));
  app.querySelectorAll("[data-title]").forEach(button => button.addEventListener("click", () => { state.title = button.dataset.title; render(); }));
  app.querySelectorAll("[data-message]").forEach(button => button.addEventListener("click", () => { state.message = button.dataset.message; render(); }));
  bindArrangement();
}

function selectMood(key) {
  state.mood = key;
  const notes = moods[key].notes;
  notes.slice(0, 3).forEach((note, index) => later(() => tone(note, 0.25, 0.09, "triangle"), index * 130));
  render();
}

function handleAction(action, button, event) {
  const actions = {
    back: goBack,
    library: () => showToast(state.saved ? "已经保存 1 张音乐明信片" : "完成作品后，明信片会出现在这里"),
    "play-class-song": playClassSong,
    "play-warm": playWarmup,
    "new-pattern": newWarmPattern,
    clap: () => registerClap(true),
    "start-record": startRecording,
    "enable-mic": enableMicrophone,
    "play-section": () => playSection(Number(button.dataset.index)),
    "play-all": () => playAll(state.screen === "postcard"),
    "preview-version": () => playAll(state.version === "ai"),
    "play-performance": () => playAll(true),
    "begin-refine": beginRefine,
    save: savePostcard,
    share: () => { state.modal = "share"; render(); },
    "close-modal": () => { state.modal = null; render(); },
    "adult-confirm": confirmShare
  };
  actions[action]?.(event);
}

function goBack() {
  if (state.screen === "classroom") return setScreen("home");
  if (state.screen === "classroomLesson") return setScreen("classroom");
  if (state.screen === "perform") return setScreen("refine");
  const order = ["home", "mood", "arrange", "refine", "postcard"];
  const index = order.indexOf(state.screen);
  setScreen(order[Math.max(0, index - 1)]);
}

function playClassSong() {
  clearTimers();
  const notes = [261.6, 261.6, 392, 392, 440, 440, 392, 349.2];
  notes.forEach((note, index) => later(() => {
    tone(note, 0.36, 0.08, "triangle");
    if (index % 2 === 0) drum(0.35);
  }, index * 430));
  later(() => showToast("旋律向上走时举高手，最后一拍停住"), notes.length * 430);
}

function playWarmup() {
  clearTimers();
  const interval = 60000 / (moods[state.mood]?.bpm || 80);
  const dog = document.querySelector("#warm-dog");
  dog?.classList.add("bounce");
  for (let index = 0; index < CREATION_BEATS; index += 1) {
    later(() => {
      document.querySelectorAll("[data-beat]").forEach(dot => dot.classList.toggle("active", Number(dot.dataset.beat) === index));
      if (state.warmPattern.includes(index)) drum(index % 4 === 0 ? 1 : 0.7);
    }, index * interval);
  }
  later(() => { dog?.classList.remove("bounce"); showToast("轮到你啦！拍 4 拍，或者直接开始创作"); }, CREATION_BEATS * interval);
}

function newWarmPattern() {
  const patterns = [[0, 1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 2]];
  const current = patterns.findIndex(pattern => pattern.join() === state.warmPattern.join());
  state.warmPattern = patterns[(current + 1) % patterns.length];
  render();
  playWarmup();
}

async function enableMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast("当前打开方式不能使用麦克风，可以继续轻拍屏幕");
    return;
  }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = getAudioContext();
    const source = ctx.createMediaStreamSource(micStream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    monitorMicrophone();
    showToast("麦克风准备好了，现在可以直接拍手");
  } catch {
    showToast("没有获得麦克风权限，也可以轻拍中间按钮完成体验");
  }
}

function monitorMicrophone() {
  if (!analyser) return;
  const data = new Uint8Array(analyser.fftSize);
  const check = () => {
    analyser.getByteTimeDomainData(data);
    const peak = data.reduce((max, value) => Math.max(max, Math.abs(value - 128)), 0);
    const now = performance.now();
    if (state.isRecording && peak > 42 && now - lastMicHit > 180) {
      lastMicHit = now;
      registerClap(false);
    }
    micFrame = requestAnimationFrame(check);
  };
  cancelAnimationFrame(micFrame);
  check();
}

function startRecording() {
  clearTimers();
  state.recordHits = [];
  state.isRecording = false;
  render();
  const status = document.querySelector("#record-status");
  let countdown = 3;
  status.textContent = `${countdown}…`;
  const countdownTick = () => {
    countdown -= 1;
    if (countdown > 0) {
      status.textContent = `${countdown}…`;
      drum(0.35);
      later(countdownTick, 650);
    } else {
      beginRecordWindow();
    }
  };
  later(countdownTick, 650);
}

function stopMicrophone() {
  cancelAnimationFrame(micFrame);
  micStream?.getTracks().forEach(track => track.stop());
  micStream = null;
  analyser = null;
}

function beginRecordWindow() {
  state.isRecording = true;
  recordStartedAt = performance.now();
  render();
  const interval = 60000 / (moods[state.mood]?.bpm || 80);
  for (let beat = 0; beat < CREATION_BEATS; beat += 1) {
    later(() => {
      document.querySelectorAll("[data-record-beat]").forEach(dot => dot.classList.toggle("active", Number(dot.dataset.recordBeat) === beat));
      tone(beat % 4 === 0 ? 880 : 660, 0.035, beat % 4 === 0 ? 0.08 : 0.04, "square");
    }, beat * interval);
  }
  later(() => finishRecording(interval), CREATION_BEATS * interval);
}

function registerClap(fromPad) {
  if (!state.isRecording) {
    if (fromPad) showToast("先点“开始录制”，倒计时后再拍");
    return;
  }
  const interval = 60000 / (moods[state.mood]?.bpm || 80);
  const beat = Math.min(CREATION_BEATS - 1, Math.max(0, Math.round((performance.now() - recordStartedAt) / interval)));
  if (!state.recordHits.includes(beat)) state.recordHits.push(beat);
  drum(0.9);
  const pad = document.querySelector(".clap-pad");
  pad?.classList.add("hit");
  later(() => pad?.classList.remove("hit"), 100);
  document.querySelector(`[data-record-beat="${beat}"]`)?.classList.add("hit");
}

function finishRecording(interval) {
  state.isRecording = false;
  if (!state.recordHits.length) state.recordHits = [0, 1, 2, 3];
  state.recordHits.sort((a, b) => a - b);
  render();
  showToast("我听见了！小狗来演一次你的节奏");
  state.recordHits.forEach(beat => later(() => drum(0.9), beat * interval));
}

function bindArrangement() {
  if (state.screen !== "arrange") return;
  app.querySelectorAll("[data-sticker]").forEach(sticker => {
    sticker.addEventListener("click", () => { state.selectedAnimal = state.selectedAnimal === sticker.dataset.sticker ? null : sticker.dataset.sticker; render(); });
    sticker.addEventListener("dragstart", event => event.dataTransfer.setData("text/plain", JSON.stringify({ animal: sticker.dataset.sticker, from: null })));
  });
  app.querySelectorAll("[data-chip]").forEach(chip => {
    chip.addEventListener("click", event => { event.stopPropagation(); removeAnimal(chip.dataset.chip, Number(chip.dataset.from)); });
    chip.addEventListener("dragstart", event => event.dataTransfer.setData("text/plain", JSON.stringify({ animal: chip.dataset.chip, from: Number(chip.dataset.from) })));
  });
  app.querySelectorAll("[data-section]").forEach(section => {
    section.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      if (state.selectedAnimal) addAnimal(state.selectedAnimal, Number(section.dataset.section));
    });
    section.addEventListener("dragover", event => { event.preventDefault(); section.classList.add("drag-over"); });
    section.addEventListener("dragleave", () => section.classList.remove("drag-over"));
    section.addEventListener("drop", event => {
      event.preventDefault();
      const payload = JSON.parse(event.dataTransfer.getData("text/plain"));
      moveAnimal(payload.animal, payload.from, Number(section.dataset.section));
    });
  });
  const tray = app.querySelector("[data-tray]");
  tray?.addEventListener("dragover", event => event.preventDefault());
  tray?.addEventListener("drop", event => {
    event.preventDefault();
    const payload = JSON.parse(event.dataTransfer.getData("text/plain"));
    if (payload.from !== null) removeAnimal(payload.animal, payload.from);
  });
}

function setStageMotion({ entering = [], leaving = [] } = {}) {
  state.stageEntering = entering;
  state.stageLeaving = leaving;
  clearTimeout(stageMotionTimer);
  stageMotionTimer = setTimeout(() => {
    state.stageEntering = [];
    state.stageLeaving = [];
    if (state.screen === "arrange") render();
  }, 680);
}

function addAnimal(animal, sectionIndex) {
  if (state.sections[sectionIndex].includes(animal)) return showToast(`${animals[animal].name}已经在第 ${sectionIndex + 1} 段啦`);
  const isVisibleSection = !state.stageCompleted && sectionIndex === (state.playingSection ?? state.stageSection);
  state.sections[sectionIndex].push(animal);
  state.selectedAnimal = null;
  setStageMotion({ entering: isVisibleSection ? [animal] : [] });
  showToast(`${animals[animal].name}加入第 ${sectionIndex + 1} 段啦`);
  render();
}

function moveAnimal(animal, from, to) {
  if (from === to) return;
  const visibleSection = state.playingSection ?? state.stageSection;
  const entering = !state.stageCompleted && to === visibleSection ? [animal] : [];
  const leaving = !state.stageCompleted && from === visibleSection ? [animal] : [];
  if (from !== null && from !== to) state.sections[from] = state.sections[from].filter(key => key !== animal);
  if (!state.sections[to].includes(animal)) state.sections[to].push(animal);
  state.stageCompleted = false;
  setStageMotion({ entering, leaving });
  render();
}

function removeAnimal(animal, sectionIndex) {
  const isVisibleSection = !state.stageCompleted && sectionIndex === (state.playingSection ?? state.stageSection);
  state.sections[sectionIndex] = state.sections[sectionIndex].filter(key => key !== animal);
  state.stageCompleted = false;
  setStageMotion({ leaving: isVisibleSection ? [animal] : [] });
  showToast(`${animals[animal].name}在第 ${sectionIndex + 1} 段休息`);
  render();
}

function playSection(sectionIndex, embellished = false, onDone) {
  const mood = moods[state.mood] || moods.miss;
  const section = state.sections[sectionIndex];
  const interval = 60000 / mood.bpm;
  state.stageCompleted = false;
  state.playingSection = sectionIndex;
  state.stageOpen = true;
  state.stageSection = sectionIndex;
  render();
  for (let beat = 0; beat < 8; beat += 1) {
    later(() => {
      if (section.includes("dog") && state.recordHits.includes(beat % CREATION_BEATS)) drum(beat % 4 === 0 ? 0.9 : 0.6);
      if (section.includes("cat") && beat % 2 === 0) tone(mood.notes[sectionIndex] / 2, 0.28, 0.08, "sine");
      if (section.includes("lion") && (beat % 4 === 0 || beat % 4 === 3)) {
        const trumpetDuration = beat % 4 === 0 ? 0.48 : 0.18;
        tone(mood.notes[(sectionIndex + 2) % 4] * 2, trumpetDuration, 0.035, "sawtooth");
      }
      if (section.includes("bear") && section.includes("rabbit") && beat % 4 === 0) {
        tone(mood.notes[sectionIndex], 0.48, 0.04, "triangle");
        tone(mood.notes[(sectionIndex + 2) % 4], 0.48, 0.025, "triangle");
      } else if (section.includes("bear") && beat % 2 === 0) {
        const melodyNote = mood.notes[(beat / 2 + sectionIndex) % 4 | 0];
        tone(melodyNote, 0.24, 0.07, "square");
      }
      const rabbitBeat = beat % 2 === 1;
      if (section.includes("rabbit") && rabbitBeat) tone(mood.notes[(beat / 2 + sectionIndex) % 4 | 0] * 2, section.includes("bear") ? 0.36 : 0.18, 0.065, embellished ? "sine" : "triangle");
      if (embellished && beat === 7) tone(mood.notes[(sectionIndex + 1) % 4] * 2, 0.35, 0.05, "sine");
    }, beat * interval);
  }
  later(() => { state.playingSection = null; render(); onDone?.(); }, 8 * interval);
}

function playAll(embellished = false) {
  clearTimers();
  state.stageOpen = true;
  state.stageCompleted = false;
  const mood = moods[state.mood] || moods.miss;
  const sectionDuration = 8 * (60000 / mood.bpm);
  let index = 0;
  const next = () => {
    if (index >= 4) {
      state.playingSection = null;
      state.stageCompleted = true;
      render();
      showToast("演奏完成，这是属于你的音乐");
      return;
    }
    playSection(index, embellished, () => { index += 1; next(); });
  };
  next();
}

function beginRefine() {
  clearTimers();
  state.screen = "processing";
  render();
  later(() => setScreen("refine"), 1800);
}

function savePostcard() {
  state.saved = true;
  try {
    localStorage.setItem("animal-music-postcard", JSON.stringify({
      mood: state.mood,
      title: state.title,
      message: state.message,
      sections: state.sections,
      recordHits: state.recordHits
    }));
  } catch {
    showToast("当前浏览器不允许本地保存，但作品仍保留在本次体验中");
    render();
    return;
  }
  render();
  showToast("已经保存在这台设备上了");
}

function confirmShare() {
  state.modal = null;
  render();
  showToast("演示：私密链接已生成，24 小时后失效");
}

render();
