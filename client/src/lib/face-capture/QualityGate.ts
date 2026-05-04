export interface QualityGateResult {
  sharp: boolean;
  exposure: boolean;
  variance: number;
  meanLuma: number;
  stdLuma: number;
}

function createFrameCanvas(video: HTMLVideoElement): HTMLCanvasElement | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function luma(rgbR: number, rgbG: number, rgbB: number): number {
  return 0.2126 * rgbR + 0.7152 * rgbG + 0.0722 * rgbB;
}

export function computeImageStats(canvas: HTMLCanvasElement): {
  meanLuma: number;
  stdLuma: number;
} {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { meanLuma: 0, stdLuma: 0 };
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const pixels = data.length / 4;
  if (pixels === 0) return { meanLuma: 0, stdLuma: 0 };

  let sum = 0;
  const lumas = new Float32Array(pixels);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const v = luma(data[i]!, data[i + 1]!, data[i + 2]!);
    lumas[p] = v;
    sum += v;
  }
  const meanLuma = sum / pixels;
  let variance = 0;
  for (let i = 0; i < lumas.length; i++) {
    const d = lumas[i]! - meanLuma;
    variance += d * d;
  }
  variance /= pixels;
  return { meanLuma, stdLuma: Math.sqrt(variance) };
}

export function laplacianVariance(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  const { width, height } = canvas;
  if (width < 3 || height < 3) return 0;
  const image = ctx.getImageData(0, 0, width, height).data;
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < image.length; i += 4, p++) {
    gray[p] = luma(image[i]!, image[i + 1]!, image[i + 2]!);
  }

  const lap = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const c = y * width + x;
      lap[c] =
        -4 * gray[c]! +
        gray[c - 1]! +
        gray[c + 1]! +
        gray[c - width]! +
        gray[c + width]!;
    }
  }

  let mean = 0;
  for (let i = 0; i < lap.length; i++) mean += lap[i]!;
  mean /= lap.length;
  let variance = 0;
  for (let i = 0; i < lap.length; i++) {
    const d = lap[i]! - mean;
    variance += d * d;
  }
  return variance / lap.length;
}

export function evaluateFrameQuality(
  video: HTMLVideoElement,
  sharpnessThreshold = 80,
  exposure: { minMean: number; maxMean: number; minStd: number } = {
    minMean: 60,
    maxMean: 200,
    minStd: 25,
  },
): QualityGateResult {
  const canvas = createFrameCanvas(video);
  if (!canvas) {
    return {
      sharp: false,
      exposure: false,
      variance: 0,
      meanLuma: 0,
      stdLuma: 0,
    };
  }
  const variance = laplacianVariance(canvas);
  const { meanLuma, stdLuma } = computeImageStats(canvas);
  return {
    sharp: variance >= sharpnessThreshold,
    exposure:
      meanLuma >= exposure.minMean &&
      meanLuma <= exposure.maxMean &&
      stdLuma >= exposure.minStd,
    variance,
    meanLuma,
    stdLuma,
  };
}

/**
 * Softer thresholds used **only** immediately before JPEG capture. The user has
 * already held the pose for ~1.8s; the strict `evaluateFrameQuality` gate was
 * causing frequent false rejects (soft auto‑exposure, slight motion blur,
 * ring-light uniforms with low stdLuma), which reset the hold and looked
 * like an infinite scan loop.
 */
export function evaluateFrameQualityForCapture(
  video: HTMLVideoElement,
): QualityGateResult {
  return evaluateFrameQuality(video, 32, {
    minMean: 38,
    maxMean: 238,
    minStd: 8,
  });
}

/**
 * Last-resort check if two `evaluateFrameQualityForCapture` passes still fail.
 * Only rejects obvious failures (black / blown-out frame).
 */
export function evaluateFrameQualityMinimal(
  video: HTMLVideoElement,
): QualityGateResult {
  const canvas = createFrameCanvas(video);
  if (!canvas) {
    return {
      sharp: false,
      exposure: false,
      variance: 0,
      meanLuma: 0,
      stdLuma: 0,
    };
  }
  const variance = laplacianVariance(canvas);
  const { meanLuma, stdLuma } = computeImageStats(canvas);
  return {
    sharp: variance >= 12,
    exposure: meanLuma >= 18 && meanLuma <= 248 && stdLuma >= 3,
    variance,
    meanLuma,
    stdLuma,
  };
}

/** Whether both sharpness and exposure heuristics pass (capture / minimal). */
export function qualityGateAccepts(q: QualityGateResult): boolean {
  return q.sharp && q.exposure;
}