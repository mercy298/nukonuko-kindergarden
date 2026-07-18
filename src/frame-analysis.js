const DEFAULT_DIFFERENCE_THRESHOLD = 24;
const DEFAULT_BRIGHTNESS_THRESHOLD = 220;

/**
 * 前後フレームの画面全体の変化を、演出が扱える少数の特徴量へ変換する。
 * 個人や物体を推定しないことで、参加人数と遮蔽に依存しない入力を作る。
 */
export function analyzeFrame(previous, current, options = {}) {
  const differenceThreshold =
    options.differenceThreshold ?? DEFAULT_DIFFERENCE_THRESHOLD;
  const brightnessThreshold =
    options.brightnessThreshold ?? DEFAULT_BRIGHTNESS_THRESHOLD;
  const pixelCount = current.width * current.height;
  const exposureOffset = previous
    ? calculateExposureOffset(previous, current, pixelCount)
    : { red: 0, green: 0, blue: 0 };
  let brightPixels = 0;
  let changedPixels = 0;
  let changedX = 0;
  let changedY = 0;

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    const red = current.data[offset];
    const green = current.data[offset + 1];
    const blue = current.data[offset + 2];
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;

    if (luminance >= brightnessThreshold) {
      brightPixels += 1;
    }

    if (!previous) {
      continue;
    }

    const difference =
      (Math.abs(red - previous.data[offset] - exposureOffset.red) +
        Math.abs(green - previous.data[offset + 1] - exposureOffset.green) +
        Math.abs(blue - previous.data[offset + 2] - exposureOffset.blue)) /
      3;

    if (difference < differenceThreshold) {
      continue;
    }

    changedPixels += 1;
    changedX += pixelIndex % current.width;
    changedY += Math.floor(pixelIndex / current.width);
  }

  const motionCentroid =
    changedPixels === 0
      ? null
      : {
          x: normalizeCoordinate(changedX / changedPixels, current.width),
          y: normalizeCoordinate(changedY / changedPixels, current.height),
        };

  return {
    motionRatio: previous ? changedPixels / pixelCount : 0,
    brightRatio: brightPixels / pixelCount,
    motionCentroid,
  };
}

function calculateExposureOffset(previous, current, pixelCount) {
  const redHistogram = new Uint32Array(511);
  const greenHistogram = new Uint32Array(511);
  const blueHistogram = new Uint32Array(511);

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    redHistogram[current.data[offset] - previous.data[offset] + 255] += 1;
    greenHistogram[
      current.data[offset + 1] - previous.data[offset + 1] + 255
    ] += 1;
    blueHistogram[
      current.data[offset + 2] - previous.data[offset + 2] + 255
    ] += 1;
  }

  return {
    red: findLowerMedianOffset(redHistogram, pixelCount),
    green: findLowerMedianOffset(greenHistogram, pixelCount),
    blue: findLowerMedianOffset(blueHistogram, pixelCount),
  };
}

function findLowerMedianOffset(histogram, sampleCount) {
  const target = Math.floor((sampleCount - 1) / 2);
  let seen = 0;

  for (let index = 0; index < histogram.length; index += 1) {
    seen += histogram[index];
    if (seen > target) {
      return index - 255;
    }
  }

  return 0;
}

function normalizeCoordinate(coordinate, dimension) {
  return dimension === 1 ? 0.5 : coordinate / (dimension - 1);
}
