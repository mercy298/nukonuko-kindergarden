import assert from "node:assert/strict";
import test from "node:test";

const effectModule = await import("../src/effect-state.js").catch(() => ({}));
const { createEffectState, updateEffectState } = effectModule;

test("動きと明るさを滑らかな演出強度へ変換する", () => {
  assert.equal(typeof createEffectState, "function");
  assert.equal(typeof updateEffectState, "function");
  const initial = createEffectState();

  const calibrated = {
    ...initial,
    calibrated: true,
    calibrationElapsed: 1,
    noiseFloor: 0.01,
  };
  const next = updateEffectState(calibrated, {
    motionRatio: 1,
    brightRatio: 0.5,
    motionCentroid: { x: 0.75, y: 0.25 },
  }, 1 / 30);

  assert.ok(next.motion > 0.9);
  assert.equal(next.brightness, 0.1);
  assert.equal(next.motionActive, true);
  assert.deepEqual(next.centroid, { x: 0.52, y: 0.48 });
});

test("入力が止まると演出強度が減衰する", () => {
  assert.equal(typeof updateEffectState, "function");
  const active = {
    motion: 0.8,
    brightness: 0.4,
    centroid: { x: 0.25, y: 0.5 },
    calibrated: true,
    calibrationElapsed: 1,
    noiseFloor: 0.01,
    motionActive: true,
  };

  const next = updateEffectState(active, {
    motionRatio: 0,
    brightRatio: 0,
    motionCentroid: null,
  }, 1 / 30);

  assert.equal(next.motion, 0);
  assert.equal(next.brightness, 0.32);
  assert.deepEqual(next.centroid, active.centroid);
});

test("開始後約1秒は静止ノイズ床を学習してmotionを出さない", () => {
  const first = updateEffectState(createEffectState(), {
    motionRatio: 0.012,
    brightRatio: 0.2,
    motionCentroid: { x: 0.1, y: 0.1 },
  }, 0.5);
  const calibrated = updateEffectState(first, {
    motionRatio: 0.014,
    brightRatio: 0.2,
    motionCentroid: { x: 0.9, y: 0.9 },
  }, 0.5);

  assert.equal(first.motion, 0);
  assert.equal(calibrated.motion, 0);
  assert.equal(calibrated.calibrated, true);
  assert.ok(Math.abs(calibrated.noiseFloor - 0.013) < 0.0001);
  assert.deepEqual(calibrated.centroid, { x: 0.5, y: 0.5 });
});

test("ヒステリシスでノイズを無効化しactive時だけ重心を低速補間する", () => {
  const calibrated = {
    ...createEffectState(),
    calibrated: true,
    calibrationElapsed: 1,
    noiseFloor: 0.013,
  };
  const noise = updateEffectState(calibrated, {
    motionRatio: 0.025,
    brightRatio: 0,
    motionCentroid: { x: 0, y: 0 },
  }, 1 / 30);
  const active = updateEffectState(noise, {
    motionRatio: 0.12,
    brightRatio: 0,
    motionCentroid: { x: 0.9, y: 0.1 },
  }, 1 / 30);
  const held = updateEffectState(active, {
    motionRatio: 0.025,
    brightRatio: 0,
    motionCentroid: { x: 0.1, y: 0.9 },
  }, 1 / 30);
  const stopped = updateEffectState(held, {
    motionRatio: 0.015,
    brightRatio: 0,
    motionCentroid: { x: 0.1, y: 0.9 },
  }, 1 / 30);

  assert.equal(noise.motion, 0);
  assert.deepEqual(noise.centroid, calibrated.centroid);
  assert.equal(active.motionActive, true);
  assert.ok(active.motion > 0);
  assert.ok(active.centroid.x > 0.5 && active.centroid.x < 0.6);
  assert.equal(held.motionActive, true);
  assert.equal(stopped.motionActive, false);
  assert.equal(stopped.motion, 0);
  assert.deepEqual(stopped.centroid, held.centroid);
});
