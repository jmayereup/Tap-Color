/**
 * Tap Color - Planar Vector Paint-by-Number Pipeline
 * Generates true non-overlapping planar vector regions from photos & drawings.
 * Every piece is an independent, non-overlapping puzzle piece matching the Rust WASM engine.
 */

import { kmeans } from 'ml-kmeans';
import { applyBilateralFilter, applyMedianFilter } from './filters.js';

export { kmeans };

export const COMPLEXITY_PRESETS = {
  cozy: {
    name: 'Cozy (Relaxing)',
    paletteSize: 16,
    minPixels: 22,
    minThickness: 2,
    workingSize: 420,
    simplifyEpsilon: 0.44,
  },
  balanced: {
    name: 'Balanced (Standard)',
    paletteSize: 24,
    minPixels: 18,
    minThickness: 2,
    workingSize: 540,
    simplifyEpsilon: 0.38,
  },
  detailed: {
    name: 'Detailed (Masterpiece)',
    paletteSize: 32,
    minPixels: 14,
    minThickness: 2,
    workingSize: 660,
    simplifyEpsilon: 0.34,
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
 * Douglas-Peucker polygon simplification.
 */
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
  if (points.length <= 3) return points;
  const stack = [[0, points.length - 1]];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  while (stack.length > 0) {
    const [startIdx, endIdx] = stack.pop();
    const p1 = points[startIdx];
    const p2 = points[endIdx];
    let maxSqDist = 0;
    let maxIdx = startIdx;

    for (let i = startIdx + 1; i < endIdx; i++) {
      const sqDist = getSqSegDist(points[i], p1, p2);
      if (sqDist > maxSqDist) {
        maxSqDist = sqDist;
        maxIdx = i;
      }
    }

    if (maxSqDist > sqTol) {
      keep[maxIdx] = 1;
      if (maxIdx - startIdx > 1) stack.push([startIdx, maxIdx]);
      if (endIdx - maxIdx > 1) stack.push([maxIdx, endIdx]);
    }
  }

  const result = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) result.push(points[i]);
  }
  return result;
}

/**
 * Melts pixel staircase jaggies into smooth organic vector curves using
 * 6 passes of zero-shrinkage Taubin smoothing followed by DP simplification and Chaikin corner-cutting.
 */
function smoothContour(rawPoly, W, H, sqTol) {
  const n = rawPoly.length;
  if (n < 4) return rawPoly;

  let pts = rawPoly.map(p => ({ x: p.x, y: p.y }));

  for (let it = 0; it < 6; it++) {
    const w = (it % 2 === 0) ? 0.50 : -0.46;
    const next = new Array(n);
    for (let i = 0; i < n; i++) {
      const px = pts[i].x;
      const py = pts[i].y;
      if ((px === 0 || px === W) && (py === 0 || py === H)) {
        next[i] = { x: px, y: py };
        continue;
      }
      const pPrev = pts[(i - 1 + n) % n];
      const pNext = pts[(i + 1) % n];
      const mx = 0.5 * (pPrev.x + pNext.x);
      const my = 0.5 * (pPrev.y + pNext.y);
      let nx = px + w * (mx - px);
      let ny = py + w * (my - py);

      if (px === 0 && pPrev.x === 0 && pNext.x === 0) nx = 0;
      else if (px === W && pPrev.x === W && pNext.x === W) nx = W;
      if (py === 0 && pPrev.y === 0 && pNext.y === 0) ny = 0;
      else if (py === H && pPrev.y === H && pNext.y === H) ny = H;

      next[i] = { x: nx, y: ny };
    }
    pts = next;
  }

  let simplified = simplifyDouglasPeucker(pts, sqTol);
  if (simplified.length < 3) simplified = pts;

  let curr = simplified;
  for (let it = 0; it < 2; it++) {
    const next = [];
    const m = curr.length;
    for (let i = 0; i < m; i++) {
      const p1 = curr[i];
      const p2 = curr[(i + 1) % m];
      const p1Corner = (p1.x === 0 || p1.x === W) && (p1.y === 0 || p1.y === H);
      const p2Corner = (p2.x === 0 || p2.x === W) && (p2.y === 0 || p2.y === H);

      if (p1Corner) {
        next.push({ x: p1.x, y: p1.y });
      } else {
        next.push({
          x: p1.x * 0.75 + p2.x * 0.25,
          y: p1.y * 0.75 + p2.y * 0.25,
        });
      }
      if (!p2Corner) {
        next.push({
          x: p1.x * 0.25 + p2.x * 0.75,
          y: p1.y * 0.25 + p2.y * 0.75,
        });
      }
    }
    curr = next;
  }

  return curr;
}

/**
 * Converts an RGB triplet into a hex string.
 */
function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

/**
 * Traces the exterior boundary of a 4-connected pixel component into an ordered polygon loop.
 * Properly handles canvas borders (preventing row wrap-around) and saddle vertices (rightmost-turn rule).
 */
function traceComponentBoundary(compPixels, W, H) {
  const pixSet = new Set(compPixels);
  const adj = new Map();

  const addEdge = (x0, y0, x1, y1) => {
    const k = `${x0},${y0}`;
    let list = adj.get(k);
    if (!list) {
      list = [];
      adj.set(k, list);
    }
    list.push([x1, y1]);
  };

  let startV = null;

  for (const p of compPixels) {
    const px = p % W;
    const py = Math.floor(p / W);

    // Top edge
    if (py === 0 || !pixSet.has(p - W)) {
      addEdge(px, py, px + 1, py);
      if (!startV || py < startV[1] || (py === startV[1] && px < startV[0])) {
        startV = [px, py];
      }
    }
    // Right edge
    if (px === W - 1 || !pixSet.has(p + 1)) {
      addEdge(px + 1, py, px + 1, py + 1);
    }
    // Bottom edge
    if (py === H - 1 || !pixSet.has(p + W)) {
      addEdge(px + 1, py + 1, px, py + 1);
    }
    // Left edge
    if (px === 0 || !pixSet.has(p - 1)) {
      addEdge(px, py + 1, px, py);
    }
  }

  if (!startV) return [];

  const startKey = `${startV[0]},${startV[1]}`;
  const startNextList = adj.get(startKey);
  if (!startNextList || startNextList.length === 0) return [];

  // Choose rightmost initial edge from top-left vertex
  let firstNext = startNextList[0];
  for (const cand of startNextList) {
    if (cand[0] - startV[0] > firstNext[0] - startV[0]) {
      firstNext = cand;
    }
  }

  const getDirIdx = (dx, dy) => {
    if (dx === 1 && dy === 0) return 0;
    if (dx === 0 && dy === 1) return 1;
    if (dx === -1 && dy === 0) return 2;
    return 3;
  };

  const poly = [{ x: startV[0], y: startV[1] }];
  let prevV = startV;
  let currV = firstNext;
  const used = new Set([`${startV[0]},${startV[1]}->${firstNext[0]},${firstNext[1]}`]);
  const maxSteps = compPixels.length * 4 + 100;
  let steps = 0;

  while (steps++ < maxSteps) {
    if (currV[0] === startV[0] && currV[1] === startV[1]) break;
    poly.push({ x: currV[0], y: currV[1] });

    const inDir = getDirIdx(currV[0] - prevV[0], currV[1] - prevV[1]);
    const currKey = `${currV[0]},${currV[1]}`;
    const neighbors = adj.get(currKey) || [];
    const candidates = neighbors.filter(n => !used.has(`${currKey}->${n[0]},${n[1]}`));
    if (candidates.length === 0) break;

    let nextV = candidates[0];
    if (candidates.length > 1) {
      let bestPriority = 99;
      for (const cand of candidates) {
        const outDir = getDirIdx(cand[0] - currV[0], cand[1] - currV[1]);
        const priority = (outDir - inDir - 1 + 8) % 4;
        if (priority < bestPriority) {
          bestPriority = priority;
          nextV = cand;
        }
      }
    }

    used.add(`${currKey}->${nextV[0]},${nextV[1]}`);
    prevV = currV;
    currV = nextV;
  }

  return poly;
}

/**
 * Computes exact internal distance transform of a pixel component, returning its maximum thickness
 * and candidate pole-of-inaccessibility centers inside its largest thick lobe.
 */
function getComponentThicknessAndPole(compPixels, W, H) {
  const pixSet = new Set(compPixels);
  const dist = new Map();
  const q = new Int32Array(compPixels.length);
  let head = 0;
  let tail = 0;

  for (const p of compPixels) {
    const px = p % W;
    const py = Math.floor(p / W);
    if (
      px === 0 || px === W - 1 || py === 0 || py === H - 1 ||
      !pixSet.has(p - 1) || !pixSet.has(p + 1) ||
      !pixSet.has(p - W) || !pixSet.has(p + W)
    ) {
      dist.set(p, 1);
      q[tail++] = p;
    }
  }

  let maxD = 1;
  while (head < tail) {
    const curr = q[head++];
    const d = dist.get(curr);
    if (d > maxD) maxD = d;

    const neighbors = [curr - 1, curr + 1, curr - W, curr + W];
    for (let i = 0; i < 4; i++) {
      const nxt = neighbors[i];
      if (pixSet.has(nxt) && !dist.has(nxt)) {
        dist.set(nxt, d + 1);
        q[tail++] = nxt;
      }
    }
  }

  const coreThresh = maxD >= 4 ? Math.max(1, maxD - 1) : maxD;
  const coreSet = new Set();
  for (const [p, d] of dist.entries()) {
    if (d >= coreThresh) coreSet.add(p);
  }

  const visited = new Set();
  let bestCluster = [];
  let bestScore = -1;

  for (const p of coreSet) {
    if (visited.has(p)) continue;
    const cluster = [];
    const cq = [p];
    visited.add(p);
    let score = 0;
    let cHead = 0;
    while (cHead < cq.length) {
      const cur = cq[cHead++];
      cluster.push(cur);
      const cd = dist.get(cur) || 1;
      score += cd * cd;
      const neighbors = [cur - 1, cur + 1, cur - W, cur + W];
      for (let i = 0; i < 4; i++) {
        const nxt = neighbors[i];
        if (coreSet.has(nxt) && !visited.has(nxt)) {
          visited.add(nxt);
          cq.push(nxt);
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCluster = cluster;
    }
  }

  if (bestCluster.length === 0) {
    bestCluster = Array.from(coreSet);
  }

  let sumX = 0, sumY = 0, totW = 0;
  for (const p of bestCluster) {
    const w = dist.get(p) || 1;
    sumX += (p % W) * w;
    sumY += Math.floor(p / W) * w;
    totW += w;
  }
  const mx = sumX / (totW || 1);
  const my = sumY / (totW || 1);

  bestCluster.sort((a, b) => {
    const da = dist.get(a) || 1;
    const db = dist.get(b) || 1;
    if (db !== da) return db - da;
    const distA = (a % W - mx) ** 2 + (Math.floor(a / W) - my) ** 2;
    const distB = (b % W - mx) ** 2 + (Math.floor(b / W) - my) ** 2;
    return distA - distB;
  });

  const candidates = [];
  for (const p of bestCluster) {
    const cx = (p % W) + 0.5;
    const cy = Math.floor(p / W) + 0.5;
    if (candidates.every(c => (cx - c.x) ** 2 + (cy - c.y) ** 2 > 9.0)) {
      candidates.push({ x: cx, y: cy, d: dist.get(p) || 1 });
      if (candidates.length >= 6) break;
    }
  }
  if (candidates.length === 0) {
    const p0 = bestCluster[0] || compPixels[0];
    candidates.push({ x: (p0 % W) + 0.5, y: Math.floor(p0 / W) + 0.5, d: dist.get(p0) || 1 });
  }

  return { maxD, candidates, dist };
}

/**
 * Signed distance from a point to a polygon (positive inside, negative outside).
 */
function pointToPolyDist(x, y, poly) {
  let inside = false;
  let minDistSq = Infinity;
  const n = poly.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }

    const dx = xj - xi;
    const dy = yj - yi;
    let px = xi;
    let py = yi;
    if (dx !== 0 || dy !== 0) {
      const t = ((x - px) * dx + (y - py) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        px = xj;
        py = yj;
      } else if (t > 0) {
        px += dx * t;
        py += dy * t;
      }
    }
    const dSq = (x - px) * (x - px) + (y - py) * (y - py);
    if (dSq < minDistSq) minDistSq = dSq;
  }

  return (inside ? 1 : -1) * Math.sqrt(minDistSq);
}

/**
 * Finds the Pole of Inaccessibility (visual center with maximum inscribed circle radius)
 * accounting for both the smoothed exterior polygon and any interior holes/boundaries.
 */
function refinePoleInPoly(candidates, poly, distMap, W, margin, scale) {
  const effectiveClearance = (wx, wy) => {
    const px = Math.floor((wx - margin) / scale);
    const py = Math.floor((wy - margin) / scale);
    if (px < 0 || px >= W || py < 0 || py >= W) return -10.0;
    const pIdx = py * W + px;
    const dPix = distMap.get(pIdx) || 0;
    if (dPix <= 0) return -5.0;
    const dPoly = pointToPolyDist(wx, wy, poly);
    return Math.min(dPoly, (dPix - 0.15) * scale);
  };

  let bestX = margin + candidates[0].x * scale;
  let bestY = margin + candidates[0].y * scale;
  let bestD = -Infinity;

  for (const c of candidates) {
    const wx = margin + c.x * scale;
    const wy = margin + c.y * scale;
    const d = effectiveClearance(wx, wy);
    if (d > bestD) {
      bestD = d;
      bestX = wx;
      bestY = wy;
    }
  }

  const steps = [3.0, 1.5, 0.7, 0.3];
  for (const step of steps) {
    let improved = true;
    let iters = 0;
    while (improved && iters++ < 5) {
      improved = false;
      for (const dy of [-step, 0, step]) {
        for (const dx of [-step, 0, step]) {
          if (dx === 0 && dy === 0) continue;
          const nx = bestX + dx;
          const ny = bestY + dy;
          const d = effectiveClearance(nx, ny);
          if (d > bestD + 0.02) {
            bestD = d;
            bestX = nx;
            bestY = ny;
            improved = true;
          }
        }
      }
    }
  }

  return { x: bestX, y: bestY, radius: Math.max(1.0, bestD) };
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
 * Watershed neighbor merge: absorbs micro-components (< minPixels) and paper-thin
 * 1px outline slivers (< minThickness) into their most compatible adjacent neighbor.
 * Guarantees 100% planar partition with zero dropped pixels.
 */
function mergeSmallRegions(grid, W, H, minPixels, minThickness, centers, maxPasses = 6) {
  for (let pass = 0; pass < maxPasses; pass++) {
    const { components, labels } = computeConnectedComponents(grid, W, H);
    const smallComponents = [];

    for (const c of components) {
      const nPix = c.pixels.length;
      if (nPix < minPixels) {
        smallComponents.push(c);
      } else if (nPix < minPixels * 5) {
        const { maxD } = getComponentThicknessAndPole(c.pixels, W, H);
        if (maxD < minThickness) {
          smallComponents.push(c);
        }
      }
    }

    if (smallComponents.length === 0) break;

    // Smallest first so isolated fragments get absorbed first
    smallComponents.sort((a, b) => a.pixels.length - b.pixels.length);

    let mergedCount = 0;
    for (const comp of smallComponents) {
      const neighborCounts = new Map();

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

      let bestColor = -1;
      let bestScore = -Infinity;
      const curRgb = centers[comp.color] || [128, 128, 128];

      for (const [col, contactCount] of neighborCounts.entries()) {
        const nRgb = centers[col] || [128, 128, 128];
        const dr = curRgb[0] - nRgb[0];
        const dg = curRgb[1] - nRgb[1];
        const db = curRgb[2] - nRgb[2];
        const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);

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

  // 2. Preprocess with median + bilateral edge-preserving filter
  progress('Smoothing textures & lines...', 25);
  await new Promise(r => setTimeout(r, 20));

  const medianFiltered = applyMedianFilter(rawImgData);
  const smoothed = applyBilateralFilter(medianFiltered, 2, 2.5, 32.0);
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
    return lumB - lumA;
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

  // 5. Clean up speckle noise and smooth boundaries with 2 passes of majority filter (mode >= 5)
  for (let pass = 0; pass < 2; pass++) {
    const nextGrid = new Int32Array(grid);
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
        if (maxCount >= 5 && dominant !== cur) {
          nextGrid[idx] = dominant;
        }
      }
    }
    grid.set(nextGrid);
  }

  // Prune 1-pixel spurs/hairs
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x;
        const cur = grid[idx];
        const orth = [grid[idx - 1], grid[idx + 1], grid[idx - W], grid[idx + W]];
        let same = 0;
        for (let i = 0; i < 4; i++) {
          if (orth[i] === cur) same++;
        }
        if (same <= 1) {
          for (let i = 0; i < 4; i++) {
            if (orth[i] !== cur) {
              grid[idx] = orth[i];
              break;
            }
          }
        }
      }
    }
  }

  // 6. Watershed Neighbor Merge: absorb micro-regions (< minPixels) and thin 1px slivers
  progress('Drawing clean outlines...', 75);
  await new Promise(r => setTimeout(r, 20));

  mergeSmallRegions(grid, W, H, preset.minPixels, preset.minThickness || 2, centers, 6);

  // 7. Final Connected Component Labeling
  const { components } = computeConnectedComponents(grid, W, H);
  const validComponents = components.filter(c => c.pixels.length >= 4);

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

    // Apply zero-shrinkage Taubin smoothing + DP simplification + Chaikin curve smoothing
    const smoothedPoly = smoothContour(rawPoly, W, H, sqTol);
    if (smoothedPoly.length < 3) continue;

    // Scale to 800x800 world coordinates
    const worldPoly = smoothedPoly.map(pt => ({
      x: Math.round((margin + pt.x * scaleX) * 10) / 10,
      y: Math.round((margin + pt.y * scaleY) * 10) / 10,
    }));

    // Calculate Pole of Inaccessibility (visual center & inscribed clearance radius)
    const { candidates, dist } = getComponentThicknessAndPole(comp.pixels, W, H);
    const pole = refinePoleInPoly(candidates, worldPoly, dist, W, margin, scaleX);
    const worldCentroid = {
      x: Math.round(pole.x * 10) / 10,
      y: Math.round(pole.y * 10) / 10,
    };

    const colorNum = comp.color + 1;
    palette[comp.color].total_count++;

    regions.push({
      id: regId++,
      number: colorNum,
      polygon: worldPoly,
      centroid: worldCentroid,
      label_radius: Math.round(pole.radius * 10) / 10,
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
    p.name = `Color #${newNum}`;
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
