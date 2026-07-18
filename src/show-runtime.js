export const SHOW_PHASE = Object.freeze({
  READY: "ready",
  CHARGE: "charge",
  VORTEX: "vortex",
  FREEZE: "freeze",
  CLIMAX: "climax",
});

const VALID_PHASES = new Set(Object.values(SHOW_PHASE));

export function createShowRuntime(session = 0) {
  return {
    phase: SHOW_PHASE.READY,
    energy: 0,
    stillness: 0,
    sceneTime: 0,
    session,
  };
}

export function selectShowPhase(state, phase) {
  if (!VALID_PHASES.has(phase)) {
    throw new RangeError(`未定義の演目フェーズです: ${phase}`);
  }

  return {
    ...state,
    phase,
    sceneTime: 0,
  };
}

export function triggerClimax(state) {
  return selectShowPhase(state, SHOW_PHASE.CLIMAX);
}

export function resetShowRuntime(state) {
  return createShowRuntime(state.session + 1);
}

export function updateShowRuntime(state, signal, deltaSeconds) {
  const elapsed = normalizeElapsed(deltaSeconds);
  const motion = clamp01(signal.motion);
  let { energy, stillness } = state;

  if (state.phase === SHOW_PHASE.CHARGE) {
    energy = clamp01(energy + (motion * 0.9 - 0.03) * elapsed);
  } else if (state.phase === SHOW_PHASE.VORTEX) {
    energy = clamp01(energy + motion * 0.25 * elapsed);
  } else if (state.phase === SHOW_PHASE.FREEZE) {
    const stillnessRate = motion < 0.1 ? 0.65 : -1.2;
    stillness = clamp01(stillness + stillnessRate * elapsed);
  }

  return {
    ...state,
    energy,
    stillness,
    sceneTime: state.sceneTime + elapsed,
  };
}

export function deriveSceneParameters(state, signal) {
  const motion = clamp01(signal.motion);
  const amplifiedMotion = amplifyMotion(motion);
  const energy = clamp01(state.energy);
  const stillness = clamp01(state.stillness);
  let parameters;

  switch (state.phase) {
    case SHOW_PHASE.CHARGE:
      parameters = {
        intensity: 0.12 + energy * 0.38 + amplifiedMotion * 0.5,
        videoAlpha: 0.48,
        particleRate: amplifiedMotion * 0.95,
        convergence: 0.35,
        flash: 0,
        hue: 25,
      };
      break;
    case SHOW_PHASE.VORTEX:
      parameters = {
        intensity: 0.18 + energy * 0.32 + amplifiedMotion * 0.5,
        videoAlpha: 0.55,
        particleRate: amplifiedMotion * 0.95,
        convergence: 0,
        flash: 0,
        hue: 280,
      };
      break;
    case SHOW_PHASE.FREEZE:
      parameters = {
        intensity: 0.3 + stillness * 0.6,
        videoAlpha: 0.35,
        particleRate: 0,
        convergence: stillness,
        flash: 0,
        hue: 200,
      };
      break;
    case SHOW_PHASE.CLIMAX:
      parameters = {
        intensity: 1,
        videoAlpha: 0,
        particleRate: 0,
        convergence: 0,
        flash: state.sceneTime >= 0.9 && state.sceneTime < 1.3
          ? 1 - (state.sceneTime - 0.9) / 0.4
          : 0,
        hue: 45,
      };
      break;
    case SHOW_PHASE.READY:
    default:
      parameters = {
        intensity: 0.08 + amplifiedMotion * 0.12,
        videoAlpha: 0.26,
        particleRate: amplifiedMotion * 0.04,
        convergence: 0,
        flash: 0,
        hue: 180,
      };
      break;
  }

  return {
    ...parameters,
    intensity: clamp01(parameters.intensity),
    videoAlpha: clamp01(parameters.videoAlpha),
    particleRate: clamp01(parameters.particleRate),
    convergence: clamp01(parameters.convergence),
    flash: clamp01(parameters.flash),
    hue: clamp(parameters.hue, 0, 360),
  };
}

function amplifyMotion(motion) {
  const normalized = clamp01((motion - 0.02) / 0.28);
  return Math.sqrt(normalized);
}

function normalizeElapsed(deltaSeconds) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new RangeError("経過秒は0以上の有限値で指定してください");
  }

  return deltaSeconds;
}

function clamp01(value) {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
