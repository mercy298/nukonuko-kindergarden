import assert from "node:assert/strict";
import test from "node:test";

const effectModule = await import("../src/effect-state.js").catch(() => ({}));
const { createEffectState, updateEffectState } = effectModule;

test("動きと明るさを滑らかな演出強度へ変換する", () => {
  assert.equal(typeof createEffectState, "function");
  assert.equal(typeof updateEffectState, "function");
  const initial = createEffectState();

  const next = updateEffectState(initial, {
    motionRatio: 1,
    brightRatio: 0.5,
    motionCentroid: { x: 0.75, y: 0.25 },
  });

  assert.deepEqual(next, {
    motion: 0.25,
    brightness: 0.1,
    centroid: { x: 0.75, y: 0.25 },
  });
});

test("入力が止まると演出強度が減衰する", () => {
  assert.equal(typeof updateEffectState, "function");
  const active = {
    motion: 0.8,
    brightness: 0.4,
    centroid: { x: 0.25, y: 0.5 },
  };

  const next = updateEffectState(active, {
    motionRatio: 0,
    brightRatio: 0,
    motionCentroid: null,
  });

  assert.equal(next.motion, 0.6);
  assert.equal(next.brightness, 0.32);
  assert.deepEqual(next.centroid, active.centroid);
});
