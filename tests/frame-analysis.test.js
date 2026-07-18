import assert from "node:assert/strict";
import test from "node:test";

const analysisModule = await import("../src/frame-analysis.js").catch(() => ({}));
const { analyzeFrame } = analysisModule;

function frame(width, height, rgbValues) {
  const data = new Uint8ClampedArray(width * height * 4);

  rgbValues.forEach(([red, green, blue], index) => {
    const offset = index * 4;
    data[offset] = red;
    data[offset + 1] = green;
    data[offset + 2] = blue;
    data[offset + 3] = 255;
  });

  return { data, width, height };
}

test("同一フレームでは動きを検出しない", () => {
  assert.equal(typeof analyzeFrame, "function");
  const still = frame(2, 1, [
    [20, 20, 20],
    [240, 240, 240],
  ]);

  const result = analyzeFrame(still, still);

  assert.equal(result.motionRatio, 0);
  assert.equal(result.brightRatio, 0.5);
  assert.equal(result.motionCentroid, null);
});

test("変化した画素の割合と重心を返す", () => {
  assert.equal(typeof analyzeFrame, "function");
  const previous = frame(2, 2, [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  const current = frame(2, 2, [
    [0, 0, 0],
    [255, 255, 255],
    [0, 0, 0],
    [255, 255, 255],
  ]);

  const result = analyzeFrame(previous, current);

  assert.equal(result.motionRatio, 0.5);
  assert.equal(result.brightRatio, 0.5);
  assert.deepEqual(result.motionCentroid, { x: 1, y: 0.5 });
});

test("最初のフレームは明るさだけを測り、動きの基準値にする", () => {
  assert.equal(typeof analyzeFrame, "function");
  const current = frame(1, 1, [[255, 255, 255]]);

  const result = analyzeFrame(null, current);

  assert.equal(result.motionRatio, 0);
  assert.equal(result.brightRatio, 1);
  assert.equal(result.motionCentroid, null);
});
