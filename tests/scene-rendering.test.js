import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const appSource = await readFile(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);

const SHOW_PHASE = Object.freeze({
  READY: "ready",
  CHARGE: "charge",
  VORTEX: "vortex",
  FREEZE: "freeze",
  CLIMAX: "climax",
});

test("描画ループは導出済みの場面パラメーターを映像と粒子へ渡す", () => {
  const calls = [];
  const runtime = { phase: SHOW_PHASE.CHARGE };
  const signal = { motion: 0.4 };
  const sceneParameters = { videoAlpha: 0.48, particleRate: 0.5 };
  const sandbox = {
    HTMLMediaElement: { HAVE_CURRENT_DATA: 2 },
    SHOW_PHASE,
    activeStream: {},
    deriveSceneParameters(receivedRuntime, receivedSignal) {
      assert.equal(receivedRuntime, runtime);
      assert.equal(receivedSignal, signal);
      return sceneParameters;
    },
    drawCameraFeed(...args) {
      calls.push(["camera", ...args]);
    },
    drawScene(...args) {
      calls.push(["scene", ...args]);
    },
    effectState: signal,
    elements: {
      cameraVideo: { readyState: 2 },
      outputCanvas: { width: 1280, height: 720 },
    },
    lastRenderTime: 0,
    outputContext: {
      fillRect() {},
      fillStyle: "",
    },
    requestAnimationFrame() {},
    resizeOutputCanvas() {},
    showRuntime: runtime,
    spawnParticles(...args) {
      calls.push(["spawn", ...args]);
    },
    updateAndDrawParticles(...args) {
      calls.push(["particles", ...args]);
    },
    updateFps() {},
    updateShowRuntime(receivedRuntime) {
      return receivedRuntime;
    },
    updateShowUi() {},
  };

  loadFunction("render", sandbox)(16);

  assert.deepEqual(calls, [
    ["camera", 1280, 720, sceneParameters],
    ["scene", 1280, 720, sceneParameters],
    ["spawn", 1280, 720, sceneParameters],
    ["particles", 1280, 720, 0.016, sceneParameters],
  ]);
});

test("各演目状態は対応する専用描画だけを呼び出す", () => {
  const expectedDrawCall = new Map([
    [SHOW_PHASE.READY, "ready"],
    [SHOW_PHASE.CHARGE, "charge"],
    [SHOW_PHASE.VORTEX, "vortex"],
    [SHOW_PHASE.FREEZE, "freeze"],
    [SHOW_PHASE.CLIMAX, "climax"],
  ]);

  for (const [phase, expected] of expectedDrawCall) {
    const calls = [];
    const sandbox = {
      SHOW_PHASE,
      drawChargeRings() { calls.push("charge"); },
      drawClimaxSequence() { calls.push("climax"); },
      drawFreezeCircles() { calls.push("freeze"); },
      drawStandbyGrid() { calls.push("ready"); },
      drawVortexArcs() { calls.push("vortex"); },
      showRuntime: { phase, sceneTime: 1 },
    };

    loadFunction("drawScene", sandbox)(1280, 720, {});
    assert.deepEqual(calls, [expected], `${phase}の描画先が一致する`);
  }
});

test("粒子は場面を保持せず、Canvasの高負荷効果を使わない", () => {
  const createParticle = loadFunction("createParticle", {
    Math,
    SHOW_PHASE,
    effectState: { motion: 0.5 },
  });

  for (const phase of Object.values(SHOW_PHASE)) {
    const particle = createParticle(phase, 640, 360, 720, Math.PI / 4);
    assert.deepEqual(Object.keys(particle).sort(), ["vx", "vy", "x", "y"]);
    assert.ok(Object.values(particle).every(Number.isFinite));
  }

  assert.doesNotMatch(appSource, /outputContext\.(?:filter|shadowBlur)\s*=/);
  assert.doesNotMatch(appSource, /\bmode\s*:/);
});

test("CHARGEは入力強度に応じてリング径を大きく変える", () => {
  const weakArcs = captureSceneArcs("drawChargeRings", {
    hue: 25,
    intensity: 0.35,
    particleRate: 0.4,
  });
  const strongArcs = captureSceneArcs("drawChargeRings", {
    hue: 25,
    intensity: 0.85,
    particleRate: 0.95,
  });

  assert.ok(strongArcs[0].radius - weakArcs[0].radius >= 70);
});

test("VORTEXは入力強度に応じて円弧の長さと角速度を変える", () => {
  const weakArcs = captureSceneArcs("drawVortexArcs", {
    hue: 280,
    intensity: 0.4,
    particleRate: 0.4,
  });
  const strongArcs = captureSceneArcs("drawVortexArcs", {
    hue: 280,
    intensity: 0.9,
    particleRate: 0.95,
  });
  const weakLength = weakArcs[0].end - weakArcs[0].start;
  const strongLength = strongArcs[0].end - strongArcs[0].start;

  assert.ok(strongLength - weakLength >= 1.5);
  assert.ok(strongArcs[0].start - weakArcs[0].start >= 2.5);
});

test("Xは既存粒子を消してCLIMAXを開始する", () => {
  const sandbox = {
    SHOW_PHASE,
    particles: [{ life: 1 }],
    resetShowRuntime(state) { return state; },
    selectShowPhase(state) { return state; },
    showRuntime: { phase: SHOW_PHASE.VORTEX },
    triggerClimax(state) { return { ...state, phase: SHOW_PHASE.CLIMAX }; },
    updateShowUi() {},
  };

  loadFunction("handleShowCommand", sandbox)("climax");

  assert.equal(sandbox.showRuntime.phase, SHOW_PHASE.CLIMAX);
  assert.equal(sandbox.particles.length, 0);
});

test("CLIMAX中はカメラと通常粒子を描画しない", () => {
  const calls = [];
  const runtime = { phase: SHOW_PHASE.CLIMAX };
  const sandbox = {
    HTMLMediaElement: { HAVE_CURRENT_DATA: 2 },
    SHOW_PHASE,
    activeStream: {},
    deriveSceneParameters() { return { particleRate: 0 }; },
    drawCameraFeed() { calls.push("camera"); },
    drawScene() { calls.push("scene"); },
    effectState: { motion: 0 },
    elements: {
      cameraVideo: { readyState: 2 },
      outputCanvas: { width: 1280, height: 720 },
    },
    lastRenderTime: 0,
    outputContext: { fillRect() {}, fillStyle: "" },
    requestAnimationFrame() {},
    resizeOutputCanvas() {},
    showRuntime: runtime,
    spawnParticles() { calls.push("spawn"); },
    updateAndDrawParticles() { calls.push("particles"); },
    updateFps() {},
    updateShowRuntime(state) { return state; },
    updateShowUi() {},
  };

  loadFunction("render", sandbox)(16);

  assert.deepEqual(calls, ["scene"]);
});

test("CLIMAXは暗転、集中、発火、固定余韻をsceneTimeだけで進める", () => {
  const blackout = captureClimaxFrame(0.1);
  const focus = captureClimaxFrame(0.5);
  const ignition = captureClimaxFrame(1.1);
  const fixed = captureClimaxFrame(1.5);
  const held = captureClimaxFrame(4.5);

  assert.equal(blackout.lines.length, 0);
  assert.equal(blackout.images.length, 0);
  assert.ok(focus.lines.length >= 16);
  assert.equal(focus.images.length, 0);
  assert.equal(ignition.images.length, 1);
  assert.equal(fixed.images.length, 1);
  assert.ok(ignition.images[0].width < fixed.images[0].width);
  assert.equal(held.lines.length, 0);
  assert.deepEqual(held.images[0], fixed.images[0]);
});

test("粒子は速度方向の太い光跡として場面色で描く", () => {
  const charge = captureParticleStroke(SHOW_PHASE.CHARGE);
  const vortex = captureParticleStroke(SHOW_PHASE.VORTEX);

  assert.equal(charge.arcs, 0);
  assert.equal(vortex.arcs, 0);
  assert.equal(charge.lines.length, 1);
  assert.equal(vortex.lines.length, 1);
  assert.ok(charge.lineWidth >= 3);
  assert.ok(charge.lines[0].length >= 20);
  assert.match(charge.strokeStyle, /rgba\(255, /);
  assert.match(vortex.strokeStyle, /hsla\(2[0-9]{2},/);
});

function loadFunction(name, sandbox) {
  return vm.runInNewContext(`(${extractFunction(name)})`, sandbox);
}

function captureSceneArcs(name, sceneParameters) {
  const arcs = [];
  const outputContext = {
    beginPath() {},
    restore() {},
    save() {},
    stroke() {},
    arc(x, y, radius, start, end) {
      arcs.push({ x, y, radius, start, end });
    },
  };
  const sandbox = {
    Math,
    getSceneCenter() { return { x: 640, y: 360 }; },
    outputContext,
    showRuntime: { sceneTime: 2 },
  };

  loadFunction(name, sandbox)(1280, 720, sceneParameters);
  return arcs;
}

function captureClimaxFrame(sceneTime) {
  const lines = [];
  const images = [];
  let lineStart = null;
  const outputContext = {
    beginPath() {},
    drawImage(_image, x, y, width, height) {
      images.push({ x, y, width, height });
    },
    fillRect() {},
    lineTo(x, y) {
      if (lineStart) lines.push({ from: lineStart, to: { x, y } });
    },
    moveTo(x, y) { lineStart = { x, y }; },
    restore() {},
    save() {},
    stroke() {},
    strokeRect() {},
  };
  const sandbox = {
    Math,
    blossomImage: { complete: true, naturalWidth: 560 },
    outputContext,
    showRuntime: { sceneTime },
  };
  sandbox.drawBlossom = loadFunction("drawBlossom", sandbox);
  sandbox.drawClimaxNeedles = loadFunction("drawClimaxNeedles", sandbox);

  loadFunction("drawClimaxSequence", sandbox)(1280, 720);
  return { images, lines };
}

function captureParticleStroke(phase) {
  let arcs = 0;
  const lines = [];
  let lineStart = null;
  const outputContext = {
    arc() { arcs += 1; },
    beginPath() {},
    fill() {},
    lineTo(x, y) {
      if (!lineStart) return;
      lines.push({
        length: Math.hypot(x - lineStart.x, y - lineStart.y),
      });
    },
    moveTo(x, y) { lineStart = { x, y }; },
    restore() {},
    save() {},
    stroke() {},
  };
  const sandbox = {
    Math,
    SHOW_PHASE,
    getSceneCenter() { return { x: 640, y: 360 }; },
    outputContext,
    particles: [{
      life: 1,
      maximumLife: 1.45,
      radius: 4,
      vx: 240,
      vy: 80,
      x: 200,
      y: 200,
    }],
    showRuntime: { phase },
  };
  sandbox.getParticleStrokeStyle = loadFunction(
    "getParticleStrokeStyle",
    sandbox,
  );

  loadFunction("updateAndDrawParticles", sandbox)(1280, 720, 1 / 60, {
    convergence: 0,
  });
  return {
    arcs,
    lines,
    lineWidth: outputContext.lineWidth,
    strokeStyle: outputContext.strokeStyle,
  };
}

function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name}がpublic/app.jsに存在する`);
  const bodyStart = appSource.indexOf("{", start);
  let depth = 0;

  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") {
      depth += 1;
    } else if (appSource[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return appSource.slice(start, index + 1);
      }
    }
  }

  throw new Error(`${name}の終端を検出できません`);
}
