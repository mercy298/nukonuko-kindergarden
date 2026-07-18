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
      drawClimaxPulse() { calls.push("climax"); },
      drawFreezeCircles() { calls.push("freeze"); },
      drawStandbyGrid() { calls.push("ready"); },
      drawVortexArcs() { calls.push("vortex"); },
      showRuntime: { phase, sceneTime: 1 },
    };

    loadFunction("drawScene", sandbox)(1280, 720, {});
    assert.deepEqual(calls, [expected], `${phase}の描画先が一致する`);
  }
});

test("CLIMAXの放射中心は解析重心に依存せず画面中央に固定する", () => {
  const origins = [];
  const sandbox = {
    MAX_PARTICLES: 520,
    Math,
    SHOW_PHASE,
    createParticle(phase, x, y) {
      origins.push({ phase, x, y });
      return { x, y, vx: 1, vy: 1 };
    },
    effectState: { centroid: { x: 0.1, y: 0.9 } },
    particles: [],
    showRuntime: { phase: SHOW_PHASE.CLIMAX },
  };

  loadFunction("spawnParticles", sandbox)(1280, 720, { particleRate: 0.1 });

  assert.equal(origins.length, 1);
  assert.deepEqual(origins[0], {
    phase: SHOW_PHASE.CLIMAX,
    x: 640,
    y: 360,
  });
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
