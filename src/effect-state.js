const MOTION_RESPONSE = 0.25;
const BRIGHTNESS_RESPONSE = 0.2;

export function createEffectState() {
  return {
    motion: 0,
    brightness: 0,
    centroid: { x: 0.5, y: 0.5 },
  };
}

/**
 * 手ブレや単発ノイズを画面へ直結させないため、解析値を時間方向に平滑化する。
 * 重心が得られないフレームでは直前位置を維持し、粒子の瞬間移動を避ける。
 */
export function updateEffectState(previous, analysis) {
  return {
    motion: blend(previous.motion, analysis.motionRatio, MOTION_RESPONSE),
    brightness: blend(
      previous.brightness,
      analysis.brightRatio,
      BRIGHTNESS_RESPONSE,
    ),
    centroid: analysis.motionCentroid ?? previous.centroid,
  };
}

function blend(previous, current, response) {
  return Number((previous + (current - previous) * response).toFixed(4));
}
