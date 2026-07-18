const BRIGHTNESS_RESPONSE = 0.2;
const CALIBRATION_DURATION_SECONDS = 1;
const CENTROID_RESPONSE = 0.08;

export function createEffectState() {
  return {
    motion: 0,
    brightness: 0,
    centroid: { x: 0.5, y: 0.5 },
    calibrated: false,
    calibrationElapsed: 0,
    noiseFloor: 0,
    motionActive: false,
  };
}

/**
 * 手ブレや単発ノイズを画面へ直結させないため、解析値を時間方向に平滑化する。
 * 重心が得られないフレームでは直前位置を維持し、粒子の瞬間移動を避ける。
 */
export function updateEffectState(previous, analysis, deltaSeconds = 1 / 30) {
  const elapsed = normalizeElapsed(deltaSeconds);
  const brightness = blend(
    previous.brightness,
    analysis.brightRatio,
    BRIGHTNESS_RESPONSE,
  );

  if (!previous.calibrated) {
    const calibrationElapsed = Math.min(
      CALIBRATION_DURATION_SECONDS,
      previous.calibrationElapsed + elapsed,
    );
    const sampleDuration = calibrationElapsed - previous.calibrationElapsed;
    const noiseFloor = calibrationElapsed === 0
      ? previous.noiseFloor
      : (
          previous.noiseFloor * previous.calibrationElapsed +
          analysis.motionRatio * sampleDuration
        ) / calibrationElapsed;

    return {
      ...previous,
      motion: 0,
      brightness,
      calibrated: calibrationElapsed >= CALIBRATION_DURATION_SECONDS,
      calibrationElapsed,
      noiseFloor: round(noiseFloor),
      motionActive: false,
    };
  }

  const enterThreshold = previous.noiseFloor * 2.2 + 0.015;
  const exitThreshold = previous.noiseFloor * 1.5 + 0.004;
  const motionActive = previous.motionActive
    ? analysis.motionRatio >= exitThreshold
    : analysis.motionRatio >= enterThreshold;
  const motion = motionActive
    ? clamp01(
        (analysis.motionRatio - exitThreshold) /
        Math.max(0.001, 0.2 - exitThreshold),
      )
    : 0;
  const centroid = motionActive && analysis.motionCentroid
    ? {
        x: blend(previous.centroid.x, analysis.motionCentroid.x, CENTROID_RESPONSE),
        y: blend(previous.centroid.y, analysis.motionCentroid.y, CENTROID_RESPONSE),
      }
    : previous.centroid;

  return {
    ...previous,
    motion: round(motion),
    brightness,
    centroid,
    motionActive,
  };
}

function blend(previous, current, response) {
  return round(previous + (current - previous) * response);
}

function normalizeElapsed(deltaSeconds) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new RangeError("解析経過秒は0以上の有限値で指定してください");
  }

  return deltaSeconds;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function round(value) {
  return Number(value.toFixed(4));
}
