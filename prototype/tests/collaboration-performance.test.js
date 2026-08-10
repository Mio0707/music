const fs = require("fs");
const path = require("path");
const vm = require("vm");

const prototypeRoot = path.join(__dirname, "..");
const appElement = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
const toastElement = { textContent: "", classList: { add() {}, remove() {} } };
const storage = new Map();

class FakeAudio {
  static instances = [];
  constructor(src) {
    this.src = src;
    this.readyState = 1;
    this.currentTime = 0;
    FakeAudio.instances.push(this);
  }
  play() { return Promise.resolve(); }
  pause() {}
  load() {}
  addEventListener() {}
}

const context = {
  console, Math, Float32Array, Array, Object, Number, String, JSON, structuredClone,
  document: { querySelector: selector => selector === "#app" ? appElement : toastElement, querySelectorAll: () => [] },
  window: { scrollTo() {} },
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key)
  },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame() {},
  setTimeout: () => 0,
  clearTimeout() {},
  Audio: FakeAudio
};

vm.createContext(context);
const appSource = fs.readFileSync(path.join(prototypeRoot, "app.js"), "utf8");
vm.runInContext(`${appSource}
globalThis.__state = state;
globalThis.__render = render;
globalThis.__poemLibrary = POEM_LIBRARY;
globalThis.__playPoemLine = playCollaborationPoemLine;
globalThis.__saveGesture = saveCollaborationGesture;`, context);

context.__state.mood = "miss";
context.__state.groove = "steady";
context.__state.screen = "poetry";
context.__render();
if (!appElement.innerHTML.includes('data-go="collaboration"')) throw new Error("Poem choice must go directly to collaboration");
if (appElement.innerHTML.includes("child-poetry-success")) throw new Error("Removed success transition is still rendered");

for (const mood of ["happy", "calm", "brave", "miss"]) {
  const count = context.__poemLibrary[mood].length;
  if (count < 2 || count > 3) throw new Error(`${mood} must provide 2-3 poem candidates`);
}

const readyPoems = Object.values(context.__poemLibrary).flat().filter(poem => poem.audioUrl);
if (readyPoems.length !== 1 || readyPoems[0].id !== "jingyesi") throw new Error("Only Jing Ye Si should be audio-ready");
if (readyPoems[0].lineAudioUrls.length !== 4 || new Set(readyPoems[0].lineAudioUrls).size !== 4) {
  throw new Error("Four poem lines must use four different audio clips");
}
readyPoems[0].lineAudioUrls.forEach((relativePath, index) => {
  const audioPath = path.join(prototypeRoot, ...relativePath.split("/"));
  if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size < 30000) throw new Error(`Line audio ${index + 1} is missing`);
  FakeAudio.instances.length = 0;
  context.__state.collaborationLineIndex = index;
  context.__playPoemLine();
  if (!FakeAudio.instances.at(-1)?.src.endsWith(`line-${index + 1}.wav`)) throw new Error(`Line ${index + 1} plays the wrong clip`);
});

context.__state.screen = "collab-body";
context.__state.poetryPreviewMode = null;
context.__state.playingSection = null;
context.__render();
if (!appElement.innerHTML.includes('data-action="preview-poem-mix"')) throw new Error("Body practice must play the full vocal mix");
if (!appElement.innerHTML.includes("dog-table-actions.png")) throw new Error("Body practice must reuse the action asset");
if (appElement.innerHTML.includes("body-collab-content\"><p") && appElement.innerHTML.match(/body-collab-content/g)?.length !== 1) throw new Error("Unexpected body practice copy");

context.__state.screen = "collab-melody";
context.__state.collaborationGesturePickerOpen = true;
context.__render();
if (!appElement.innerHTML.includes('data-action="preview-collab-full-mix"')) throw new Error("Melody practice must play the full vocal mix");
if (!appElement.innerHTML.includes('data-collab-gesture-choice=')) throw new Error("Gesture picker is missing");
if ((appElement.innerHTML.match(/data-collab-gesture="/g) || []).length !== 8) throw new Error("Melody practice must show eight bar cards");

context.__saveGesture(0, "arch");
const savedGestures = JSON.parse(storage.get("animal-music-collaboration-gestures"));
if (savedGestures[0] !== "arch" || context.__state.collaborationGestureIds[0] !== "arch") throw new Error("Custom gesture did not auto-save");

if (!appSource.includes("playCollaborationFromBar(Number(button.dataset.collabGesture))")) throw new Error("Gesture card click does not seek playback");
if (!appSource.includes("schedulePoemLineClips(startBar)") || !appSource.includes("startOffsetSeconds")) throw new Error("The 2+4+2 timeline or bar seek is missing");

context.__state.collaborationPractice = { sing: true, body: true, melody: true };
context.__state.screen = "ensemble";
context.__render();
if ((appElement.innerHTML.match(/ensemble-gesture-thumb/g) || []).length !== 4) throw new Error("Ensemble must show four current gesture cards");

console.log(JSON.stringify({
  directToCollaboration: true,
  poemLineClips: 4,
  mixBars: "2+4+2",
  bodyFullMix: true,
  melodyFullMix: true,
  gestureCards: 8,
  gestureCustomizationSaved: true
}, null, 2));
