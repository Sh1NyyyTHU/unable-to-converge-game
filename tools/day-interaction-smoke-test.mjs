import fs from "node:fs";
import vm from "node:vm";

const listeners = {};
const noop = () => {};
const ctx = {
  save: noop,
  restore: noop,
  fillRect: noop,
  strokeRect: noop,
  beginPath: noop,
  arc: noop,
  stroke: noop,
  fill: noop,
  moveTo: noop,
  lineTo: noop,
  quadraticCurveTo: noop,
  closePath: noop,
  drawImage: noop,
  fillText: noop,
  strokeText: noop,
  measureText: (text) => ({ width: String(text).length * 10 }),
  createLinearGradient: () => ({ addColorStop: noop }),
  setTransform: noop,
};
const canvas = {
  width: 960,
  height: 540,
  style: {},
  getContext: () => ctx,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }),
  addEventListener: (name, fn) => {
    listeners[name] = fn;
  },
};

class MockImage {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
  }

  set src(value) {
    this._src = value;
  }
}

class MockAudio {
  constructor() {
    this.paused = true;
    this.currentTime = 0;
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

const sandbox = {
  console,
  listeners,
  document: { getElementById: () => canvas },
  window: { devicePixelRatio: 1, addEventListener: noop },
  Image: MockImage,
  Audio: MockAudio,
  requestAnimationFrame: noop,
  Math,
};

vm.createContext(sandbox);
const code = `${fs.readFileSync("script.js", "utf8")}
globalThis.__test = { GameState, startGame, draw, goToNextDayOrEnding, listeners, hotspots: () => hotspots };
`;
vm.runInContext(code, sandbox);

const test = sandbox.__test;

function click(x, y) {
  listeners.click({ clientX: x, clientY: y });
  test.draw();
}

function assertScene(scene, label) {
  if (test.GameState.scene !== scene) {
    throw new Error(`${label}: expected ${scene}, got ${test.GameState.scene}`);
  }
}

test.startGame();
test.draw();
click(460, 180);
click(690, 210);
click(490, 190);
assertScene("dayResult", "day 1 network flow");

test.goToNextDayOrEnding();
test.draw();
click(340, 180);
click(560, 190);
click(700, 190);
assertScene("dayResult", "day 2 document flow");

test.goToNextDayOrEnding();
test.draw();
click(300, 190);
click(480, 260);
click(640, 220);
click(340, 280);
click(760, 270);
click(700, 180);
assertScene("dayResult", "day 3 room flow");

test.goToNextDayOrEnding();
test.draw();
click(310, 190);
click(540, 180);
click(720, 180);
assertScene("dayResult", "day 4 presentation flow");

console.log("OK day interactions", JSON.stringify({
  day: test.GameState.day,
  scene: test.GameState.scene,
  feedback: test.GameState.feedback,
  clarity: test.GameState.clarity,
  self: test.GameState.self,
}));
