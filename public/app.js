import { createEffectState, updateEffectState } from "/src/effect-state.js";
import { analyzeFrame } from "/src/frame-analysis.js";
import {
  SHOW_PHASE,
  createShowRuntime,
  deriveSceneParameters,
  resetShowRuntime,
  selectShowPhase,
  triggerClimax,
  updateShowRuntime,
} from "/src/show-runtime.js";

const ANALYSIS_WIDTH = 160;
const ANALYSIS_HEIGHT = 90;
const MAX_PARTICLES = 520;
const SHOW_KEYS = new Map([
  ["1", SHOW_PHASE.CHARGE],
  ["2", SHOW_PHASE.VORTEX],
  ["3", SHOW_PHASE.FREEZE],
  ["x", "climax"],
  ["r", "reset"],
]);
const SHOW_LABELS = new Map([
  [SHOW_PHASE.READY, "READY / 待機"],
  [SHOW_PHASE.CHARGE, "CHARGE / 集合"],
  [SHOW_PHASE.VORTEX, "VORTEX / 渦"],
  [SHOW_PHASE.FREEZE, "FREEZE / 静止"],
  [SHOW_PHASE.CLIMAX, "CLIMAX / 最大演出"],
]);

const elements = {
  analysisCanvas: document.querySelector("#analysisCanvas"),
  brightnessMeter: document.querySelector("#brightnessMeter"),
  brightnessValue: document.querySelector("#brightnessValue"),
  cameraSelect: document.querySelector("#cameraSelect"),
  cameraVideo: document.querySelector("#cameraVideo"),
  energyMeter: document.querySelector("#energyMeter"),
  energyValue: document.querySelector("#energyValue"),
  errorMessage: document.querySelector("#errorMessage"),
  fpsValue: document.querySelector("#fpsValue"),
  fullscreenButton: document.querySelector("#fullscreenButton"),
  motionMeter: document.querySelector("#motionMeter"),
  motionValue: document.querySelector("#motionValue"),
  outputCanvas: document.querySelector("#outputCanvas"),
  refreshButton: document.querySelector("#refreshButton"),
  showButtons: document.querySelectorAll(
    "[data-show-phase], [data-show-command]",
  ),
  showPhase: document.querySelector("#showPhase"),
  stage: document.querySelector("#stage"),
  stageHint: document.querySelector("#stageHint"),
  startButton: document.querySelector("#startButton"),
  status: document.querySelector("#status"),
  stillnessMeter: document.querySelector("#stillnessMeter"),
  stillnessValue: document.querySelector("#stillnessValue"),
  videoSize: document.querySelector("#videoSize"),
};

const analysisContext = elements.analysisCanvas.getContext("2d", {
  willReadFrequently: true,
});
const outputContext = elements.outputCanvas.getContext("2d");

let activeStream = null;
let previousFrame = null;
let effectState = createEffectState();
let showRuntime = createShowRuntime();
let particles = [];
let analysisSessionId = 0;
let lastRenderTime = performance.now();
let renderedFrames = 0;
let fpsWindowStartedAt = performance.now();
let renderedShowPhase = null;

elements.analysisCanvas.width = ANALYSIS_WIDTH;
elements.analysisCanvas.height = ANALYSIS_HEIGHT;

elements.startButton.addEventListener("click", startSelectedCamera);
elements.refreshButton.addEventListener("click", refreshCameras);
elements.fullscreenButton.addEventListener("click", toggleFullscreen);
elements.showButtons.forEach((button) => {
  button.addEventListener("click", () => {
    handleShowCommand(button.dataset.showPhase ?? button.dataset.showCommand);
    button.blur();
  });
});
elements.cameraSelect.addEventListener("change", () => {
  if (activeStream) {
    startSelectedCamera();
  }
});
window.addEventListener("keydown", handleShowKeydown);
window.addEventListener("resize", resizeOutputCanvas);
navigator.mediaDevices?.addEventListener("devicechange", refreshCameras);

resizeOutputCanvas();
updateShowUi();
refreshCameras();
requestAnimationFrame(render);

function handleShowKeydown(event) {
  if (isFormControl(event.target)) {
    return;
  }

  const command = SHOW_KEYS.get(event.key.toLowerCase());
  if (!command) {
    return;
  }

  event.preventDefault();
  handleShowCommand(command);
}

function handleShowCommand(command) {
  if (
    command === SHOW_PHASE.CHARGE ||
    command === SHOW_PHASE.VORTEX ||
    command === SHOW_PHASE.FREEZE
  ) {
    showRuntime = selectShowPhase(showRuntime, command);
  } else if (command === "climax") {
    showRuntime = triggerClimax(showRuntime);
  } else if (command === "reset") {
    showRuntime = resetShowRuntime(showRuntime);
    particles = [];
  } else {
    throw new RangeError(`未定義の演目操作です: ${command}`);
  }

  updateShowUi();
}

function isFormControl(target) {
  return target instanceof Element &&
    target.matches("input, select, textarea, button");
}

async function refreshCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    showError("このブラウザはカメラ取得APIに対応していません。Chrome最新版で開いてください。");
    return [];
  }

  try {
    const selectedDeviceId = elements.cameraSelect.value;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");

    elements.cameraSelect.replaceChildren();

    if (cameras.length === 0) {
      appendCameraOption("", "カメラが見つかりません");
      return [];
    }

    cameras.forEach((camera, index) => {
      appendCameraOption(
        camera.deviceId,
        camera.label || `カメラ ${index + 1}（開始後に名前を表示）`,
      );
    });

    const preferred = cameras.find((camera) =>
      /iphone|continuity/i.test(camera.label),
    );
    const preserved = cameras.find(
      (camera) => camera.deviceId === selectedDeviceId,
    );
    elements.cameraSelect.value =
      preserved?.deviceId ?? preferred?.deviceId ?? cameras[0].deviceId;
    return cameras;
  } catch (error) {
    showError(describeCameraError(error));
    return [];
  }
}

function appendCameraOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  elements.cameraSelect.append(option);
}

async function startSelectedCamera() {
  clearError();
  setBusy(true);
  setStatus("connecting", "接続中");

  try {
    stopActiveStream();
    const selectedDeviceId = elements.cameraSelect.value;
    const videoConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 60 },
    };

    if (selectedDeviceId) {
      videoConstraints.deviceId = { exact: selectedDeviceId };
    }

    activeStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: videoConstraints,
    });
    elements.cameraVideo.srcObject = activeStream;
    await elements.cameraVideo.play();

    const cameras = await refreshCameras();
    const selectedWasAutomatic = !selectedDeviceId;
    const continuityCamera = cameras.find((camera) =>
      /iphone|continuity/i.test(camera.label),
    );

    if (selectedWasAutomatic && continuityCamera) {
      elements.cameraSelect.value = continuityCamera.deviceId;
    }

    previousFrame = null;
    effectState = createEffectState();
    elements.stage.dataset.live = "true";
    elements.stageHint.textContent = "動くほど信号が増幅します";
    elements.videoSize.textContent = `${elements.cameraVideo.videoWidth} × ${elements.cameraVideo.videoHeight}`;
    setStatus("live", "入力中");
    scheduleAnalysis(analysisSessionId);
  } catch (error) {
    stopActiveStream();
    setStatus("error", "接続失敗");
    showError(describeCameraError(error));
  } finally {
    setBusy(false);
  }
}

function stopActiveStream() {
  analysisSessionId += 1;

  if (!activeStream) {
    return;
  }

  activeStream.getTracks().forEach((track) => track.stop());
  activeStream = null;
  elements.cameraVideo.srcObject = null;
  elements.stage.dataset.live = "false";
}

function scheduleAnalysis(sessionId) {
  if (!activeStream || sessionId !== analysisSessionId) {
    return;
  }

  if ("requestVideoFrameCallback" in elements.cameraVideo) {
    elements.cameraVideo.requestVideoFrameCallback(() =>
      analyzeVideoFrame(sessionId),
    );
  } else {
    requestAnimationFrame(() => analyzeVideoFrame(sessionId));
  }
}

function analyzeVideoFrame(sessionId) {
  if (!activeStream || sessionId !== analysisSessionId) {
    return;
  }

  if (elements.cameraVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    scheduleAnalysis(sessionId);
    return;
  }

  analysisContext.drawImage(
    elements.cameraVideo,
    0,
    0,
    ANALYSIS_WIDTH,
    ANALYSIS_HEIGHT,
  );
  const currentFrame = analysisContext.getImageData(
    0,
    0,
    ANALYSIS_WIDTH,
    ANALYSIS_HEIGHT,
  );
  const analysis = analyzeFrame(previousFrame, currentFrame);
  effectState = updateEffectState(effectState, analysis);
  previousFrame = currentFrame;
  updateMeters(effectState);
  scheduleAnalysis(sessionId);
}

function updateMeters(state) {
  const motionPercent = Math.min(100, state.motion * 100);
  const brightnessPercent = Math.min(100, state.brightness * 100);

  updateMeter(
    elements.motionMeter,
    elements.motionValue,
    motionPercent,
  );
  updateMeter(
    elements.brightnessMeter,
    elements.brightnessValue,
    brightnessPercent,
  );
}

function updateMeter(meter, output, value) {
  const roundedValue = value.toFixed(1);
  meter.style.setProperty("--value", roundedValue);
  meter.setAttribute("aria-valuenow", roundedValue);
  output.value = `${roundedValue}%`;
}

function render(now) {
  resizeOutputCanvas();
  const width = elements.outputCanvas.width;
  const height = elements.outputCanvas.height;
  const deltaSeconds = Math.min(
    0.1,
    Math.max(0, (now - lastRenderTime) / 1000),
  );
  lastRenderTime = now;
  showRuntime = updateShowRuntime(showRuntime, effectState, deltaSeconds);
  const sceneParameters = deriveSceneParameters(showRuntime, effectState);
  updateShowUi();

  outputContext.fillStyle = activeStream
    ? "rgba(4, 5, 8, 0.18)"
    : "rgba(4, 5, 8, 1)";
  outputContext.fillRect(0, 0, width, height);

  if (activeStream && elements.cameraVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    drawCameraFeed(width, height, sceneParameters);
  }

  drawScene(width, height, sceneParameters);
  spawnParticles(width, height, sceneParameters);
  updateAndDrawParticles(width, height, deltaSeconds, sceneParameters);

  updateFps(now);
  requestAnimationFrame(render);
}

function updateShowUi() {
  if (renderedShowPhase !== showRuntime.phase) {
    elements.showPhase.value = SHOW_LABELS.get(showRuntime.phase);
    elements.stage.dataset.phase = showRuntime.phase;
    elements.showButtons.forEach((button) => {
      const representedPhase =
        button.dataset.showPhase ??
        (button.dataset.showCommand === "climax" ? SHOW_PHASE.CLIMAX : null);
      if (representedPhase) {
        button.setAttribute(
          "aria-pressed",
          String(representedPhase === showRuntime.phase),
        );
      }
    });
    renderedShowPhase = showRuntime.phase;
  }

  updateMeter(
    elements.energyMeter,
    elements.energyValue,
    showRuntime.energy * 100,
  );
  updateMeter(
    elements.stillnessMeter,
    elements.stillnessValue,
    showRuntime.stillness * 100,
  );
}

function drawCameraFeed(width, height, sceneParameters) {
  const video = elements.cameraVideo;
  const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
  const drawnWidth = video.videoWidth * scale;
  const drawnHeight = video.videoHeight * scale;
  const x = (width - drawnWidth) / 2;
  const y = (height - drawnHeight) / 2;

  outputContext.save();
  outputContext.translate(width, 0);
  outputContext.scale(-1, 1);
  outputContext.globalAlpha = sceneParameters.videoAlpha;
  outputContext.drawImage(video, x, y, drawnWidth, drawnHeight);
  outputContext.restore();
}

function drawScene(width, height, sceneParameters) {
  switch (showRuntime.phase) {
    case SHOW_PHASE.CHARGE:
      drawChargeRings(width, height, sceneParameters);
      break;
    case SHOW_PHASE.VORTEX:
      drawVortexArcs(width, height, sceneParameters);
      break;
    case SHOW_PHASE.FREEZE:
      drawFreezeCircles(width, height, sceneParameters);
      break;
    case SHOW_PHASE.CLIMAX:
      drawClimaxPulse(width, height, sceneParameters);
      break;
    case SHOW_PHASE.READY:
    default:
      drawStandbyGrid(width, height, showRuntime.sceneTime * 1000);
      break;
  }
}

function drawChargeRings(width, height, sceneParameters) {
  const { x, y } = getSceneCenter(width, height);
  const scale = Math.min(width, height);

  outputContext.save();
  outputContext.globalCompositeOperation = "screen";
  outputContext.strokeStyle = `hsla(${sceneParameters.hue}, 100%, 64%, ${0.2 + sceneParameters.intensity * 0.58})`;
  outputContext.lineWidth = Math.max(2, scale * 0.004);

  for (let index = 0; index < 3; index += 1) {
    const pulse = (Math.sin(showRuntime.sceneTime * 3 - index) + 1) *
      0.012 * sceneParameters.particleRate;
    const radius = scale * (
      0.08 + sceneParameters.particleRate * 0.18 + index * 0.075 + pulse
    );
    outputContext.beginPath();
    outputContext.arc(x, y, radius, 0, Math.PI * 2);
    outputContext.stroke();
  }

  outputContext.restore();
}

function drawVortexArcs(width, height, sceneParameters) {
  const { x, y } = getSceneCenter(width, height);
  const scale = Math.min(width, height);

  outputContext.save();
  outputContext.globalCompositeOperation = "screen";
  outputContext.strokeStyle = `hsla(${sceneParameters.hue}, 92%, 70%, ${0.25 + sceneParameters.intensity * 0.6})`;
  outputContext.lineWidth = Math.max(2, scale * 0.005);
  outputContext.lineCap = "round";

  for (let index = 0; index < 5; index += 1) {
    const radius = scale * (0.1 + index * 0.07);
    const angularSpeed = sceneParameters.particleRate * 2.6;
    const start = showRuntime.sceneTime * angularSpeed *
      (1 + index * 0.08) + index;
    const arcLength = Math.PI * (
      0.32 + sceneParameters.particleRate * 1.05 + index * 0.05
    );
    outputContext.beginPath();
    outputContext.arc(x, y, radius, start, start + arcLength);
    outputContext.stroke();
  }

  outputContext.restore();
}

function drawFreezeCircles(width, height, sceneParameters) {
  const { x, y } = getSceneCenter(width, height);
  const scale = Math.min(width, height);
  const outerRadius = scale * (0.1 + (1 - sceneParameters.convergence) * 0.3);

  outputContext.save();
  outputContext.globalCompositeOperation = "screen";
  outputContext.strokeStyle = `hsla(${sceneParameters.hue}, 95%, 78%, ${0.22 + sceneParameters.intensity * 0.62})`;
  outputContext.lineWidth = Math.max(1.5, scale * 0.003);

  for (const ratio of [1, 0.68, 0.36]) {
    outputContext.beginPath();
    outputContext.arc(x, y, outerRadius * ratio, 0, Math.PI * 2);
    outputContext.stroke();
  }

  outputContext.restore();
}

function drawClimaxPulse(width, height, sceneParameters) {
  const centerX = width / 2;
  const centerY = height / 2;
  const scale = Math.max(width, height);

  outputContext.save();
  outputContext.globalCompositeOperation = "screen";
  outputContext.strokeStyle = `rgba(255, 218, 145, ${0.32 + sceneParameters.flash * 0.48})`;
  outputContext.lineWidth = Math.max(1, scale * 0.002);

  for (let index = 0; index < 24; index += 1) {
    const angle = (index / 24) * Math.PI * 2 + showRuntime.sceneTime * 0.18;
    const innerRadius = scale * 0.08;
    const outerRadius = scale * (0.32 + (index % 3) * 0.045);
    outputContext.beginPath();
    outputContext.moveTo(
      centerX + Math.cos(angle) * innerRadius,
      centerY + Math.sin(angle) * innerRadius,
    );
    outputContext.lineTo(
      centerX + Math.cos(angle) * outerRadius,
      centerY + Math.sin(angle) * outerRadius,
    );
    outputContext.stroke();
  }

  outputContext.fillStyle = `rgba(255, 255, 255, ${sceneParameters.flash * 0.22})`;
  outputContext.fillRect(0, 0, width, height);
  outputContext.restore();
}

function spawnParticles(width, height, sceneParameters) {
  const spawnCount = Math.min(
    14,
    Math.floor(sceneParameters.particleRate * 14),
  );
  const originX = showRuntime.phase === SHOW_PHASE.CLIMAX
    ? width / 2
    : (1 - effectState.centroid.x) * width;
  const originY = showRuntime.phase === SHOW_PHASE.CLIMAX
    ? height / 2
    : effectState.centroid.y * height;
  const scale = Math.min(width, height);

  for (let index = 0; index < spawnCount; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const particle = createParticle(
      showRuntime.phase,
      originX,
      originY,
      scale,
      angle,
    );
    particles.push({
      ...particle,
      life: 0.55 + Math.random() * 0.9,
      maximumLife: 1.45,
      radius: 1.2 + Math.random() * 4.8,
    });
  }

  if (particles.length > MAX_PARTICLES) {
    particles = particles.slice(-MAX_PARTICLES);
  }
}

function createParticle(phase, originX, originY, scale, angle) {
  const variation = 0.75 + Math.random() * 0.5;

  switch (phase) {
    case SHOW_PHASE.CHARGE: {
      const distance = scale * (0.26 + Math.random() * 0.28);
      const speed = (90 + effectState.motion * 260) * variation;
      return {
        x: originX + Math.cos(angle) * distance,
        y: originY + Math.sin(angle) * distance,
        vx: -Math.cos(angle) * speed,
        vy: -Math.sin(angle) * speed,
      };
    }
    case SHOW_PHASE.VORTEX: {
      const distance = scale * (0.12 + Math.random() * 0.3);
      const speed = (120 + effectState.motion * 330) * variation;
      return {
        x: originX + Math.cos(angle) * distance,
        y: originY + Math.sin(angle) * distance,
        vx: -Math.sin(angle) * speed,
        vy: Math.cos(angle) * speed,
      };
    }
    case SHOW_PHASE.FREEZE: {
      const distance = scale * (0.16 + Math.random() * 0.25);
      const speed = 35 * variation;
      return {
        x: originX + Math.cos(angle) * distance,
        y: originY + Math.sin(angle) * distance,
        vx: -Math.cos(angle) * speed,
        vy: -Math.sin(angle) * speed,
      };
    }
    case SHOW_PHASE.CLIMAX: {
      const speed = (260 + Math.random() * 480) * variation;
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      };
    }
    case SHOW_PHASE.READY:
    default: {
      const speed = 18 * variation;
      return {
        x: originX + (Math.random() - 0.5) * scale * 0.22,
        y: originY + (Math.random() - 0.5) * scale * 0.22,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 8,
      };
    }
  }
}

function updateAndDrawParticles(width, height, deltaSeconds, sceneParameters) {
  const { x: centerX, y: centerY } = getSceneCenter(width, height);

  outputContext.save();
  outputContext.globalCompositeOperation = "screen";

  particles = particles.filter((particle) => {
    particle.life -= deltaSeconds;
    if (particle.life <= 0) {
      return false;
    }

    particle.x += particle.vx * deltaSeconds;
    particle.y += particle.vy * deltaSeconds;
    particle.vx *= 0.985;
    particle.vy = particle.vy * 0.985 - 7 * deltaSeconds;

    if (showRuntime.phase === SHOW_PHASE.FREEZE) {
      const interpolation = sceneParameters.convergence * deltaSeconds * 3.2;
      particle.x += (centerX - particle.x) * interpolation;
      particle.y += (centerY - particle.y) * interpolation;
      particle.vx *= 1 - sceneParameters.convergence * 0.08;
      particle.vy *= 1 - sceneParameters.convergence * 0.08;
    }

    const alpha = Math.min(1, particle.life / particle.maximumLife);
    outputContext.beginPath();
    outputContext.fillStyle = `rgba(255, ${120 + Math.floor(alpha * 110)}, ${65 + Math.floor(alpha * 70)}, ${alpha})`;
    outputContext.arc(
      particle.x,
      particle.y,
      particle.radius * alpha,
      0,
      Math.PI * 2,
    );
    outputContext.fill();
    return true;
  });

  outputContext.restore();
}

function getSceneCenter(width, height) {
  return {
    x: (1 - effectState.centroid.x) * width,
    y: effectState.centroid.y * height,
  };
}

function drawStandbyGrid(width, height, now) {
  const gap = Math.max(42, width / 20);
  const pulse = 0.05 + (Math.sin(now / 900) + 1) * 0.025;
  outputContext.save();
  outputContext.strokeStyle = `rgba(135, 245, 209, ${pulse})`;
  outputContext.lineWidth = 1;

  for (let x = gap; x < width; x += gap) {
    outputContext.beginPath();
    outputContext.moveTo(x, 0);
    outputContext.lineTo(x, height);
    outputContext.stroke();
  }

  for (let y = gap; y < height; y += gap) {
    outputContext.beginPath();
    outputContext.moveTo(0, y);
    outputContext.lineTo(width, y);
    outputContext.stroke();
  }

  outputContext.restore();
}

function resizeOutputCanvas() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = Math.floor(elements.outputCanvas.clientWidth * pixelRatio);
  const height = Math.floor(elements.outputCanvas.clientHeight * pixelRatio);

  if (
    width > 0 &&
    height > 0 &&
    (elements.outputCanvas.width !== width || elements.outputCanvas.height !== height)
  ) {
    elements.outputCanvas.width = width;
    elements.outputCanvas.height = height;
  }
}

function updateFps(now) {
  renderedFrames += 1;
  const elapsed = now - fpsWindowStartedAt;

  if (elapsed < 1000) {
    return;
  }

  elements.fpsValue.textContent = `${Math.round((renderedFrames * 1000) / elapsed)} FPS`;
  renderedFrames = 0;
  fpsWindowStartedAt = now;
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await elements.stage.requestFullscreen();
      elements.stage.focus();
    }
  } catch (error) {
    showError(`全画面表示を開始できませんでした: ${error.message}`);
  }
}

function setBusy(isBusy) {
  elements.startButton.disabled = isBusy;
  elements.refreshButton.disabled = isBusy;
  elements.cameraSelect.disabled = isBusy;
  elements.startButton.textContent = isBusy ? "接続しています…" : "カメラを開始";
}

function setStatus(state, label) {
  elements.status.dataset.state = state;
  elements.status.textContent = label;
}

function clearError() {
  elements.errorMessage.hidden = true;
  elements.errorMessage.textContent = "";
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.hidden = false;
}

function describeCameraError(error) {
  switch (error.name) {
    case "NotAllowedError":
      return "カメラ権限が許可されていません。Chromeのサイト設定でlocalhostのカメラを許可してください。";
    case "NotFoundError":
      return "利用可能なカメラが見つかりません。iPhoneの接続とContinuity Camera設定を確認してください。";
    case "NotReadableError":
      return "カメラを開始できません。ほかのアプリがiPhoneカメラを使用していないか確認してください。";
    case "OverconstrainedError":
      return "選択したカメラが要求した映像形式に対応していません。再取得して別のカメラを選んでください。";
    default:
      return `カメラ接続に失敗しました: ${error.message || error.name}`;
  }
}
