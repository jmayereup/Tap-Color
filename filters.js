/**
 * Tap Color - Canvas Image Filtering & Smoothing Pipeline
 * Implements fast edge-preserving bilateral and median filters to remove
 * high-frequency camera noise and texture grain while preserving crisp outlines.
 */

/**
 * Applies an edge-preserving bilateral filter over ImageData.
 * Blurs textures and flat areas while keeping sharp color contrast edges intact.
 *
 * @param {ImageData} imageData - Target canvas ImageData
 * @param {number} [radius=2] - Neighborhood kernel radius (2 = 5x5 kernel)
 * @param {number} [sigmaSpace=2.5] - Spatial distance decay
 * @param {number} [sigmaColor=32.0] - Color similarity decay
 * @returns {ImageData} New smoothed ImageData
 */
export function applyBilateralFilter(imageData, radius = 2, sigmaSpace = 2.5, sigmaColor = 32.0) {
  const width = imageData.width;
  const height = imageData.height;
  const src = imageData.data;
  const output = new ImageData(width, height);
  const dst = output.data;

  const twoSigmaSpaceSq = 2 * sigmaSpace * sigmaSpace;
  const twoSigmaColorSq = 2 * sigmaColor * sigmaColor;

  // Precompute spatial Gaussian weights
  const spatialWeights = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const distSq = dx * dx + dy * dy;
      spatialWeights.push(Math.exp(-distSq / twoSigmaSpaceSq));
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const centerIdx = (y * width + x) * 4;
      const cR = src[centerIdx];
      const cG = src[centerIdx + 1];
      const cB = src[centerIdx + 2];

      let totalWeight = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let kIdx = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        const ny = Math.min(Math.max(y + dy, 0), height - 1);
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), width - 1);
          const neighborIdx = (ny * width + nx) * 4;

          const nR = src[neighborIdx];
          const nG = src[neighborIdx + 1];
          const nB = src[neighborIdx + 2];

          const dR = cR - nR;
          const dG = cG - nG;
          const dB = cB - nB;
          const colorDistSq = dR * dR + dG * dG + dB * dB;

          const colorWeight = Math.exp(-colorDistSq / twoSigmaColorSq);
          const weight = spatialWeights[kIdx++] * colorWeight;

          sumR += nR * weight;
          sumG += nG * weight;
          sumB += nB * weight;
          totalWeight += weight;
        }
      }

      const invWeight = totalWeight > 0 ? 1 / totalWeight : 1;
      dst[centerIdx] = Math.round(sumR * invWeight);
      dst[centerIdx + 1] = Math.round(sumG * invWeight);
      dst[centerIdx + 2] = Math.round(sumB * invWeight);
      dst[centerIdx + 3] = src[centerIdx + 3]; // Preserve alpha
    }
  }

  return output;
}

/**
 * Fast 3x3 median filter to eliminate single-pixel specks and isolated noise.
 * @param {ImageData} imageData
 * @returns {ImageData}
 */
export function applyMedianFilter(imageData) {
  const width = imageData.width;
  const height = imageData.height;
  const src = imageData.data;
  const output = new ImageData(width, height);
  const dst = output.data;

  const rBuf = new Uint8Array(9);
  const gBuf = new Uint8Array(9);
  const bBuf = new Uint8Array(9);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          rBuf[count] = src[idx];
          gBuf[count] = src[idx + 1];
          bBuf[count] = src[idx + 2];
          count++;
        }
      }

      // Quick sort 9 items to find median (index 4)
      rBuf.sort();
      gBuf.sort();
      bBuf.sort();

      const outIdx = (y * width + x) * 4;
      dst[outIdx] = rBuf[4];
      dst[outIdx + 1] = gBuf[4];
      dst[outIdx + 2] = bBuf[4];
      dst[outIdx + 3] = src[outIdx + 3];
    }
  }

  // Copy borders
  for (let x = 0; x < width; x++) {
    const top = x * 4;
    const bot = ((height - 1) * width + x) * 4;
    for (let c = 0; c < 4; c++) {
      dst[top + c] = src[top + c];
      dst[bot + c] = src[bot + c];
    }
  }
  for (let y = 0; y < height; y++) {
    const left = (y * width) * 4;
    const right = (y * width + (width - 1)) * 4;
    for (let c = 0; c < 4; c++) {
      dst[left + c] = src[left + c];
      dst[right + c] = src[right + c];
    }
  }

  return output;
}

/**
 * Preprocesses an image before color quantization and tracing.
 * Combines median filtering (to kill salt-and-pepper specks) with bilateral smoothing.
 *
 * @param {ImageData} imageData
 * @param {Object} [options]
 * @returns {ImageData}
 */
export function preprocessImageForVectorization(imageData, options = {}) {
  const { radius = 2, sigmaSpace = 2.5, sigmaColor = 30.0, useMedian = true } = options;

  let processed = imageData;
  if (useMedian) {
    processed = applyMedianFilter(processed);
  }
  processed = applyBilateralFilter(processed, radius, sigmaSpace, sigmaColor);

  return processed;
}
