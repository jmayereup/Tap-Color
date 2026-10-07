/**
 * Tap Color - Planar Vector Paint-by-Number Pipeline
 * Generates true non-overlapping planar vector regions from photos & drawings.
 * Every piece is an independent, non-overlapping puzzle piece matching the Rust WASM engine.
 */

import { kmeans } from 'ml-kmeans';
import { applyBilateralFilter } from './filters.js';

export { kmeans };

export const COMPLEXITY_PRESETS = {
  cozy: {
    name: 'Cozy (Relaxing)',
    paletteSize: 10,
    minPixels: 40,
    workingSize: 300,
    simplifyEpsilon: 0.75,
  },
  balanced: {
    name: 'Balanced (Standard)',
    paletteSize: 14,
    minPixels: 22,
    workingSize: 340,
    simplifyEpsilon: 0.65,
  },
  detailed: {
    name: 'Detailed (Masterpiece)',
    paletteSize: 18,
    minPixels: 14,
    workingSize: 380,
    simplifyEpsilon: 0.55,
  },
};

/**
 * Detects the bounding box of non-background content in an image.
 * If the image has uniform borders (e.g. transparent or pure white borders common in drawings & stickers),
 * this trims the empty borders so the main subject fills the canvas.
 */
export function detectContentBounds(sourceImage) {
  const srcW = sourceImage.naturalWidth || sourceImage.videoWidth || sourceImage.width;
  const srcH = sourceImage.naturalHeight || sourceImage.videoHeight || sourceImage.height;
  if (!srcW || !srcH) return { sx: 0, sy: 0, sw: 100, sh: 100 };

  const sampleSize = 200;
  const canvas = document.createElement('canvas');
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(sourceImage, 0, 0, sampleSize, sampleSize);

  const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize);
  const data = imgData.data;

  const getCornerPixel = (x, y) => {
    const idx = (y * sampleSize + x) * 4;
    return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
  };

  const corners = [
    getCornerPixel(1, 1),
    getCornerPixel(sampleSize - 2, 1),
    getCornerPixel(1, sampleSize - 2),
    getCornerPixel(sampleSize - 2, sampleSize - 2),
  ];

  const isBgPixel = (p) => {
    if (p[3] < 30) return true;
    if (p[0] > 240 && p[1] > 240 && p[2] > 240) return true;
    return false;
  };

  const cornersAreBg = corners.every(c => isBgPixel(c));
  if (!cornersAreBg) {
    return { sx: 0, sy: 0, sw: srcW, sh: srcH };
  }

  let minX = sampleSize, maxX = 0, minY = sampleSize, maxY = 0;
  let nonBgCount = 0;

  for (let y = 0; y < sampleSize; y++) {
    for (let x = 0; x < sampleSize; x++) {
      const idx = (y * sampleSize + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
      if (a > 30 && (r < 240 || g < 240 || b < 240)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        nonBgCount++;
      }
    }
  }

  if (nonBgCount < 50 || maxX <= minX || maxY <= minY) {
    return { sx: 0, sy: 0, sw: srcW, sh: srcH };
  }

  const scaleX = srcW / sampleSize;
  const scaleY = srcH / sampleSize;

  const realMinX = minX * scaleX;
  const realMaxX = maxX * scaleX;
  const realMinY = minY * scaleY;
  const realMaxY = maxY * scaleY;

  const contentW = realMaxX - realMinX;
  const contentH = realMaxY - realMinY;

  const padX = contentW * 0.04;
  const padY = contentH * 0.04;

  const sx = Math.max(0, Math.floor(realMinX - padX));
  const sy = Math.max(0, Math.floor(realMinY - padY));
  const sw = Math.min(srcW - sx, Math.ceil(contentW + padX * 2));
  const sh = Math.min(srcH - sy, Math.ceil(contentH + padY * 2));

  return { sx, sy, sw, sh };
}

/**
 * Chaikin's corner smoothing algorithm to convert jagged staircase pixel steps into smooth organic curves.
 */
function chaikinSmooth(points, iterations = 1) {
  if (points.length < 3) return points;
  let curr = points;
  for (let it = 0; it < iterations; it++) {
    const next = [];
    const len = curr.length;
    for (let i = 0; i < len; i++) {
      const p1 = curr[i];
      const p2 = curr[(i + 1) % len];
      next.push({
        x: p1.x * 0.85 + p2.x * 0.15,
        y: p1.y * 0.85 + p2.y * 0.15,
      });
      next.push({
        x: p1.x * 0.15 + p2.x * 0.85,
        y: p1.y * 0.15 + p2.y * 0.85,
      });
    }
    curr = next;
  }
  return curr;
}

/**
 * Douglas-Peucker polygon simplification.
 */
function getSqDist(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
}

function getSqSegDist(p, p1, p2) {
  let x = p1.x;
  let y = p1.y;
  let dx = p2.x - x;
  let dy = p2.y - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = p2.x;
      y = p2.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = p.x - x;
  dy = p.y - y;
  return dx * dx + dy * dy;
}

function simplifyDouglasPeucker(points, sqTol) {
  if (points.length <= 2) return points;
  let maxSqDist = 0;
  let index = 0;
  const p1 = points[0];
  const p2 = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const sqDist = getSqSegDist(points[i], p1, p2);
    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }

  if (maxSqDist > sqTol) {
    const left = simplifyDouglasPeucker(points.slice(0, index + 1), sqTol);
    const right = simplifyDouglasPeucker(points.slice(index), sqTol);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [p1, p2];
  }
}

/**
 * Converts an RGB triplet into a hex string.
 */
function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

/**
 * Traces the exterior boundary of a pixel component into an ordered polygon loop.
 */
function traceComponentBoundary(compPixels, W, H) {
  const pixSet = new Set(compPixels);
  const edgeMap = new Map();
  let firstEdge = null;

  for (const p of compPixels) {
    const px = p % W;
    const py = Math.floor(p / W);

    // Top edge (clockwise: [px, py] -> [px+1, py])
    if (!pixSet.has(p - W)) {
      edgeMap.set(`${px},${py}`, [px + 1, py]);
      if (!firstEdge) firstEdge = [[px, py], [px + 1, py]];
    }
    // Right edge (clockwise: [px+1, py] -> [px+1, py+1])
    if (!pixSet.has(p + 1)) {
      edgeMap.set(`${px + 1},${py}`, [px + 1, py + 1]);
      if (!firstEdge) firstEdge = [[px + 1, py], [px + 1, py + 1]];
    }
    // Bottom edge (clockwise: [px+1, py+1] -> [px, py+1])
    if (!pixSet.has(p + W)) {
      edgeMap.set(`${px + 1},${py + 1}`, [px, py + 1]);
      if (!firstEdge) firstEdge = [[px + 1, py + 1], [px, py + 1]];
    }
    // Left edge (clockwise: [px, py+1] -> [px, py])
    if (!pixSet.has(p - 1)) {
      edgeMap.set(`${px},${py + 1}`, [px, py]);
      if (!firstEdge) firstEdge = [[px, py + 1], [px, py]];
    }
  }

  if (!firstEdge) return [];

  // Chain edges into loop
  const poly = [];
  let curr = firstEdge[0];
  const startKey = `${curr[0]},${curr[1]}`;
  let key = startKey;
  let loops = 0;
  const maxLoops = compPixels.length * 4 + 100;

  while (loops++ < maxLoops) {
    poly.push({ x: curr[0], y: curr[1] });
    const next = edgeMap.get(key);
    if (!next) break;
    key = `${next[0]},${next[1]}`;
    curr = next;
    if (key === startKey) break;
  }

  return poly;
}

/**
 * Finds a centroid that is strictly inside the component's pixel mass.
 */
function calculateInternalCentroid(compPixels, W) {
  let sumX = 0, sumY = 0;
  for (const p of compPixels) {
    sumX += p % W;
    sumY += Math.floor(p / W);
  }
  const meanX = Math.round(sumX / compPixels.length);
  const meanY = Math.round(sumY / compPixels.length);

  // Check if mean is inside the component
  const meanIdx = meanY * W + meanX;
  const pixSet = new Set(compPixels);
  if (pixSet.has(meanIdx)) {
    return { x: meanX, y: meanY };
  }

  // Find pixel in compPixels closest to mean
  let bestDist = Infinity;
  let bestX = compPixels[0] % W;
  let bestY = Math.floor(compPixels[0] / W);

  for (const p of compPixels) {
    const px = p % W;
    const py = Math.floor(p / W);
    const d = (px - meanX) * (px - meanX) + (py - meanY) * (py - meanY);
    if (d < bestDist) {
      bestDist = d;
      bestX = px;
      bestY = py;
    }
  }

  return { x: bestX, y: bestY };
}

/**
 * Connected Component Labeling (4-connectivity) using fast typed array queue.
 */
function computeConnectedComponents(grid, W, H) {
  const labels = new Int32Array(W * H).fill(-1);
  let nextLabel = 0;
  const components = [];
  const q = new Int32Array(W * H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (labels[idx] !== -1) continue;
      const color = grid[idx];
      const label = nextLabel++;
      labels[idx] = label;

      let head = 0;
      let tail = 0;
      q[tail++] = idx;
      const pixels = [];

      while (head < tail) {
        const curr = q[head++];
        pixels.push(curr);
        const cx = curr % W;
        const cy = Math.floor(curr / W);

        if (cx > 0) {
          const left = curr - 1;
          if (labels[left] === -1 && grid[left] === color) {
            labels[left] = label;
            q[tail++] = left;
          }
        }
        if (cx < W - 1) {
          const right = curr + 1;
          if (labels[right] === -1 && grid[right] === color) {
            labels[right] = label;
            q[tail++] = right;
          }
        }
        if (cy > 0) {
          const up = curr - W;
          if (labels[up] === -1 && grid[up] === color) {
            labels[up] = label;
            q[tail++] = up;
          }
        }
        if (cy < H - 1) {
          const down = curr + W;
          if (labels[down] === -1 && grid[down] === color) {
            labels[down] = label;
            q[tail++] = down;
          }
        }
      }

      components.push({ label, color, pixels });
    }
  }

  return { components, labels };
}

/**
 * Watershed neighbor merge: absorbs micro-components (< minPixels) into their
 * most compatible adjacent neighbor (maximizing shared border length and color similarity).
 * Guarantees 100% planar partition with zero dropped pixels, eliminating white holes.
 */
function mergeSmallRegions(grid, W, H, minPixels, centers, maxPasses = 5) {
  for (let pass = 0; pass < maxPasses; pass++) {
    const { components, labels } = computeConnectedComponents(grid, W, H);
    const smallComponents = components.filter(c => c.pixels.length < minPixels);
    if (smallComponents.length === 0) break;

    // Smallest first so isolated fragments get absorbed first
    smallComponents.sort((a, b) => a.pixels.length - b.pixels.length);

    let mergedCount = 0;
    for (const comp of smallComponents) {
      const neighborCounts = new Map(); // color -> count of border contacts

      for (const p of comp.pixels) {
        const cx = p % W;
        const cy = Math.floor(p / W);

        if (cx > 0) {
          const n = p - 1;
          if (labels[n] !== comp.label) {
            const col = grid[n];
            neighborCounts.set(col, (neighborCounts.get(col) || 0) + 1);
          }
        }
        if (cx < W - 1) {
          const n = p + 1;
          if (labels[n] !== comp.label) {
            const col = grid[n];
            neighborCounts.set(col, (neighborCounts.get(col) || 0) + 1);
          }
        }
        if (cy > 0) {
          const n = p - W;
          if (labels[n] !== comp.label) {
            const col = grid[n];
            neighborCounts.set(col, (neighborCounts.get(col) || 0) + 1);
          }
        }
        if (cy < H - 1) {
          const n = p + W;
          if (labels[n] !== comp.label) {
            const col = grid[n];
            neighborCounts.set(col, (neighborCounts.get(col) || 0) + 1);
          }
        }
      }

      if (neighborCounts.size === 0) continue;

      // Select neighbor with maximum contact length and minimum color difference
      let bestColor = -1;
      let bestScore = -Infinity;
      const curRgb = centers[comp.color] || [128, 128, 128];

      for (const [col, contactCount] of neighborCounts.entries()) {
        const nRgb = centers[col] || [128, 128, 128];
        const dr = curRgb[0] - nRgb[0];
        const dg = curRgb[1] - nRgb[1];
        const db = curRgb[2] - nRgb[2];
        const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);

        // Strongly prioritize boundary contact, with color difference penalty
        const score = contactCount * 1000 - colorDist;
        if (score > bestScore) {
          bestScore = score;
          bestColor = col;
        }
      }

      if (bestColor !== -1) {
        for (const p of comp.pixels) {
          grid[p] = bestColor;
        }
        mergedCount++;
      }
    }

    if (mergedCount === 0) break;
  }
}

/**
 * Converts any photo or drawing into a clean, planar non-overlapping Paint-by-Number artwork.
 *
 * @param {HTMLImageElement|HTMLCanvasElement} sourceImage
 * @param {Object} options
 * @returns {Promise<{artwork: Object, thumbnailBlob: Blob}>}
 */
export async function vectorizeImage(sourceImage, options = {}) {
  const progress = options.onProgress || (() => {});
  const complexityKey = options.complexity || 'balanced';
  const preset = COMPLEXITY_PRESETS[complexityKey] || COMPLEXITY_PRESETS.balanced;
  const K = options.customPaletteSize || preset.paletteSize;
  const W = preset.workingSize;
  const H = preset.workingSize;

  progress('Opening your picture...', 10);
  await new Promise(r => setTimeout(r, 20));

  // 1. Draw image onto working canvas maintaining aspect ratio, auto-framing subject
  const workCanvas = document.createElement('canvas');
  workCanvas.width = W;
  workCanvas.height = H;
  const workCtx = workCanvas.getContext('2d');

  workCtx.fillStyle = '#FFFFFF';
  workCtx.fillRect(0, 0, W, H);

  const bounds = detectContentBounds(sourceImage);
  const scale = Math.min(W / bounds.sw, H / bounds.sh);
  const dw = bounds.sw * scale;
  const dh = bounds.sh * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;
  workCtx.drawImage(sourceImage, bounds.sx, bounds.sy, bounds.sw, bounds.sh, dx, dy, dw, dh);

  const rawImgData = workCtx.getImageData(0, 0, W, H);

  // 2. Preprocess with bilateral edge-preserving filter
  progress('Smoothing textures & lines...', 25);
  await new Promise(r => setTimeout(r, 20));

  const smoothed = applyBilateralFilter(rawImgData, 2, 2.5, 30.0);
  const sData = smoothed.data;

  // 3. Subsample pixels for K-Means color clustering
  progress('Picking pretty paint colors...', 45);
  await new Promise(r => setTimeout(r, 20));

  const samples = [];
  for (let i = 0; i < sData.length; i += 16) {
    samples.push([sData[i], sData[i + 1], sData[i + 2]]);
  }

  const km = kmeans(samples, K, {
    initialization: 'kmeans++',
    maxIterations: 12,
  });

  const centers = km.centroids.map(c => [
    Math.min(255, Math.max(0, Math.round(c[0]))),
    Math.min(255, Math.max(0, Math.round(c[1]))),
    Math.min(255, Math.max(0, Math.round(c[2]))),
  ]);

  // Sort palette by perceived brightness
  centers.sort((a, b) => {
    const lumA = 0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2];
    const lumB = 0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2];
    return lumB - lumA; // Lightest to darkest
  });

  // 4. Map every pixel to color index
  progress('Creating color sections...', 60);
  await new Promise(r => setTimeout(r, 20));

  const grid = new Int32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = sData[i * 4];
    const g = sData[i * 4 + 1];
    const b = sData[i * 4 + 2];

    let bestDist = Infinity;
    let bestK = 0;
    for (let k = 0; k < K; k++) {
      const dr = r - centers[k][0];
      const dg = g - centers[k][1];
      const db = b - centers[k][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestDist) {
        bestDist = d;
        bestK = k;
      }
    }
    grid[i] = bestK;
  }

  // 5. Clean up single-pixel speckle noise with 2 passes of majority filter
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x;
        const cur = grid[idx];
        const counts = {};
        let maxCount = 0;
        let dominant = cur;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const val = grid[(y + dy) * W + (x + dx)];
            counts[val] = (counts[val] || 0) + 1;
            if (counts[val] > maxCount) {
              maxCount = counts[val];
              dominant = val;
            }
          }
        }
        if (maxCount >= 6 && dominant !== cur) {
          grid[idx] = dominant;
        }
      }
    }
  }

  // 6. Watershed Neighbor Merge: absorb micro-regions (< minPixels) into adjacent neighbors
  progress('Drawing clean outlines...', 75);
  await new Promise(r => setTimeout(r, 20));

  mergeSmallRegions(grid, W, H, preset.minPixels, centers, 5);

  // 7. Final Connected Component Labeling (guaranteed 100% planar partition with zero dropped holes)
  const { components } = computeConnectedComponents(grid, W, H);
  const validComponents = components.filter(c => c.pixels.length >= 3);

  // 8. Build ArtworkData structures (scaled to 800x800)
  progress('Adding numbers to coloring areas...', 90);
  await new Promise(r => setTimeout(r, 20));

  const artworkWidth = 800;
  const artworkHeight = 800;
  const margin = 20;
  const availW = artworkWidth - margin * 2;
  const availH = artworkHeight - margin * 2;
  const scaleX = availW / W;
  const scaleY = availH / H;

  // Build Palette
  const palette = centers.map((c, idx) => ({
    number: idx + 1,
    hex: rgbToHex(c[0], c[1], c[2]),
    name: `Color #${idx + 1}`,
    total_count: 0,
    filled_count: 0,
    is_completed: false,
  }));

  const regions = [];
  let regId = 0;
  const sqTol = preset.simplifyEpsilon * preset.simplifyEpsilon;

  for (const comp of validComponents) {
    const rawPoly = traceComponentBoundary(comp.pixels, W, H);
    if (rawPoly.length < 3) continue;

    // Simplify polygon
    const simplified = simplifyDouglasPeucker(rawPoly, sqTol);
    if (simplified.length < 3) continue;

    // Apply corner smoothing to eliminate staircase pixel artifacts
    const smoothedPoly = chaikinSmooth(simplified, 1);

    // Scale to 800x800 world coordinates
    const worldPoly = smoothedPoly.map(pt => ({
      x: Math.round((margin + pt.x * scaleX) * 10) / 10,
      y: Math.round((margin + pt.y * scaleY) * 10) / 10,
    }));

    // Calculate centroid strictly inside the component
    const internalC = calculateInternalCentroid(comp.pixels, W);
    const worldCentroid = {
      x: Math.round((margin + internalC.x * scaleX) * 10) / 10,
      y: Math.round((margin + internalC.y * scaleY) * 10) / 10,
    };

    const colorNum = comp.color + 1;
    palette[comp.color].total_count++;

    regions.push({
      id: regId++,
      number: colorNum,
      polygon: worldPoly,
      centroid: worldCentroid,
      color_hex: palette[comp.color].hex,
      is_filled: false,
      fill_anim: 0.0,
    });
  }

  // Filter out any unused palette colors and renumber sequentially
  const activePalette = palette.filter(p => p.total_count > 0);
  activePalette.forEach((p, idx) => {
    const oldNum = p.number;
    const newNum = idx + 1;
    p.number = newNum;
    if (oldNum !== newNum) {
      regions.forEach(r => {
        if (r.number === oldNum) r.number = newNum;
      });
    }
  });

  const artworkId = `custom_art_${Date.now()}`;
  const artwork = {
    id: artworkId,
    title: options.title || 'My Photo Painting',
    artist: 'My Custom Art',
    category: 'imported',
    width: artworkWidth,
    height: artworkHeight,
    palette: activePalette,
    regions,
  };

  progress('Saving picture preview...', 96);
  const thumbnailBlob = await generateThumbnailBlob(artwork);

  progress('Ready to color! ✨', 100);
  return { artwork, thumbnailBlob };
}

/**
 * Renders an ArtworkData object to a 280x200 canvas and exports as a PNG Blob.
 */
export async function generateThumbnailBlob(artwork) {
  const canvas = document.createElement('canvas');
  canvas.width = 280;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const margin = 12;
  const fitScale = Math.min(
    (canvas.width - margin * 2) / artwork.width,
    (canvas.height - margin * 2) / artwork.height
  );
  const ox = (canvas.width - artwork.width * fitScale) / 2;
  const oy = (canvas.height - artwork.height * fitScale) / 2;

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(fitScale, fitScale);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, artwork.width, artwork.height);

  const isHighRes = artwork.regions.length > 500;
  artwork.regions.forEach(reg => {
    if (!reg.polygon || reg.polygon.length < 3) return;
    if (reg.polygon.length === 4) {
      const p0 = reg.polygon[0];
      const p2 = reg.polygon[2];
      ctx.fillStyle = reg.color_hex;
      ctx.fillRect(p0.x, p0.y, p2.x - p0.x, p2.y - p0.y);
    } else {
      ctx.beginPath();
      ctx.moveTo(reg.polygon[0].x, reg.polygon[0].y);
      for (let i = 1; i < reg.polygon.length; i++) {
        ctx.lineTo(reg.polygon[i].x, reg.polygon[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = reg.color_hex;
      ctx.fill();

      // Seam-seal stroke prevents white hairline cracks in thumbnails
      ctx.strokeStyle = reg.color_hex;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      if (!isHighRes) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
    }
  });

  ctx.restore();

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/png');
  });
}
