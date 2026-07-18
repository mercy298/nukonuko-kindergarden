import assert from "node:assert/strict";
import test from "node:test";

const runtimeModule = await import("../src/show-runtime.js").catch(() => ({}));
const {
  SHOW_PHASE,
  createShowRuntime,
  deriveSceneParameters,
  resetShowRuntime,
  selectShowPhase,
  triggerClimax,
  updateShowRuntime,
} = runtimeModule;

const SIGNAL = {
  motion: 0.6,
  brightness: 0.2,
  centroid: { x: 0.5, y: 0.5 },
};

test("初期状態と直接の場面選択を定義する", () => {
  assert.equal(typeof createShowRuntime, "function");
  assert.equal(typeof selectShowPhase, "function");
  const initial = createShowRuntime();

  assert.deepEqual(initial, {
    phase: "ready",
    energy: 0,
    stillness: 0,
    sceneTime: 0,
    session: 0,
  });
  assert.equal(selectShowPhase(initial, "vortex").phase, "vortex");
  assert.throws(() => selectShowPhase(initial, "unknown"), RangeError);
});

test("強制発火とリセットは現在状態に依存しない", () => {
  assert.equal(typeof triggerClimax, "function");
  assert.equal(typeof resetShowRuntime, "function");
  const vortex = selectShowPhase(createShowRuntime(), SHOW_PHASE.VORTEX);

  assert.equal(triggerClimax(vortex).phase, SHOW_PHASE.CLIMAX);
  assert.deepEqual(resetShowRuntime({ ...vortex, energy: 0.8 }), {
    phase: SHOW_PHASE.READY,
    energy: 0,
    stillness: 0,
    sceneTime: 0,
    session: 1,
  });
});

test("同じ経過時間なら解析頻度によらず蓄積値が一致する", () => {
  assert.equal(typeof updateShowRuntime, "function");
  const start = selectShowPhase(createShowRuntime(), SHOW_PHASE.CHARGE);
  const at30Fps = repeatUpdate(start, SIGNAL, 1 / 30, 30);
  const at60Fps = repeatUpdate(start, SIGNAL, 1 / 60, 60);

  assert.ok(Math.abs(at30Fps.energy - at60Fps.energy) < 0.0001);
  assert.ok(Math.abs(at30Fps.sceneTime - at60Fps.sceneTime) < 0.0001);
  assert.ok(Math.abs(at30Fps.energy - 0.51) < 0.0001);
});

test("静止中は静止ゲージが増え、動くと減る", () => {
  assert.equal(typeof createShowRuntime, "function");
  assert.equal(typeof selectShowPhase, "function");
  assert.equal(typeof updateShowRuntime, "function");
  const start = selectShowPhase(createShowRuntime(), SHOW_PHASE.FREEZE);
  const still = repeatUpdate(start, { ...SIGNAL, motion: 0.02 }, 0.1, 10);
  const moved = updateShowRuntime(still, SIGNAL, 0.25);

  assert.ok(Math.abs(still.stillness - 0.5) < 0.0001);
  assert.ok(Math.abs(moved.stillness - 0.25) < 0.0001);
});

test("全場面の描画パラメーターが有限の範囲内に収まる", () => {
  assert.equal(typeof deriveSceneParameters, "function");

  for (const phase of Object.values(SHOW_PHASE)) {
    const state = {
      ...selectShowPhase(createShowRuntime(), phase),
      energy: 0.7,
      stillness: 0.8,
      sceneTime: 1.2,
    };
    const parameters = deriveSceneParameters(state, SIGNAL);

    for (const key of [
      "intensity",
      "videoAlpha",
      "particleRate",
      "convergence",
      "flash",
    ]) {
      assert.ok(Number.isFinite(parameters[key]), `${phase}.${key} must be finite`);
      assert.ok(parameters[key] >= 0 && parameters[key] <= 1, `${phase}.${key} must be 0...1`);
    }
    assert.ok(parameters.hue >= 0 && parameters.hue <= 360);
  }
});

function repeatUpdate(state, signal, deltaSeconds, count) {
  let current = state;

  for (let index = 0; index < count; index += 1) {
    current = updateShowRuntime(current, signal, deltaSeconds);
  }

  return current;
}
