#!/usr/bin/env node
/**
 * Tap Color - Line-Preserving Paint-by-Number Converter
 * Extracts crisp ink linework as a transparent overlay and segments
 * natural enclosed regions directly as they appear in the illustration.
 *
 * Usage:
 *   node scripts/convert_pbn.mjs <raw_rgba_bin> <W> <output_id> <title> <artist> <out_json> <out_lines_rgba> <line_art_url>
 */

import fs from 'fs';

const args = process.argv.slice(2);
if (args.length < 8) {
  console.error('Usage: node scripts/convert_pbn.mjs <raw_rgba_bin> <W> <output_id> <title> <artist> <out_json> <out_lines_rgba> <line_art_url>');
  process.exit(1);
}

const [rawBinPath, wStr, outputId, title, artist, outJsonPath, outLinesPath, lineArtUrl] = args;
const W = parseInt(wStr, 10);
const H = W;
const N = W * H;

const rgbaBuf = fs.readFileSync(rawBinPath);
const data = new Uint8ClampedArray(rgbaBuf.buffer, rgbaBuf.byteOffset, rgbaBuf.byteLength);

// --- Color Space Helpers (sRGB -> CIELAB) ---
function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function rgbToLab(r, g, b) {
  let sr = r / 255, sg = g / 255, sb = b / 255;
  sr = sr > 0.04045 ? Math.pow((sr + 0.055) / 1.055, 2.4) : sr / 12.92;
  sg = sg > 0.04045 ? Math.pow((sg + 0.055) / 1.055, 2.4) : sg / 12.92;
  sb = sb > 0.04045 ? Math.pow((sb + 0.055) / 1.055, 2.4) : sb / 12.92;

  let x = (sr * 0.4124 + sg * 0.3576 + sb * 0.1805) / 0.95047;
  let y = (sr * 0.2126 + sg * 0.7152 + sb * 0.0722) / 1.00000;
  let z = (sr * 0.0193 + sg * 0.1192 + sb * 0.9505) / 1.08883;

  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
}

function labDist(a, b) {
  const dl = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

// --- Step 1: Detect Core Ink Linework (Dark Core + Local Dark-Ridge Detector) ---
const lum = new Float32Array(N);
const chromaArr = new Float32Array(N);

for (let i = 0; i < N; i++) {
  const o = i * 4;
  const r = data[o], g = data[o + 1], b = data[o + 2];
  lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  chromaArr[i] = Math.max(r, g, b) - Math.min(r, g, b);
}

// Fast O(N) integral image (summed-area table) of luminance for local neighborhood mean (radius 6)
const sat = new Float64Array((W + 1) * (H + 1));
const satStride = W + 1;
for (let y = 0; y < H; y++) {
  let rowSum = 0;
  const srcRow = y * W;
  const dstRow = (y + 1) * satStride;
  const prevRow = y * satStride;
  for (let x = 0; x < W; x++) {
    rowSum += lum[srcRow + x];
    sat[dstRow + x + 1] = sat[prevRow + x + 1] + rowSum;
  }
}

function getLocalMeanLum(x, y, rad) {
  const x0 = Math.max(0, x - rad);
  const y0 = Math.max(0, y - rad);
  const x1 = Math.min(W - 1, x + rad);
  const y1 = Math.min(H - 1, y + rad);
  const sum = sat[(y1 + 1) * satStride + (x1 + 1)]
    - sat[y0 * satStride + (x1 + 1)]
    - sat[(y1 + 1) * satStride + x0]
    + sat[y0 * satStride + x0];
  return sum / ((x1 - x0 + 1) * (y1 - y0 + 1));
}

const coreInk = new Uint8Array(N);
let inkR = 0, inkG = 0, inkB = 0, inkCount = 0;

for (let y = 0; y < H; y++) {
  const row = y * W;
  for (let x = 0; x < W; x++) {
    const i = row + x;
    const lv = lum[i];
    const ch = chromaArr[i];
    const localMean = getLocalMeanLum(x, y, 6);

    // 1) Solid dark ink (thick black/dark-brown outlines, eyes, nose)
    // 2) Thin dark ridge (anti-aliased thin lines & veins that are sharply darker than surroundings)
    // Flat dark-colored regions (dark teal hills, brown hooves, dark ears) have localMean - lv ≈ 0 so they stay clean!
    const isSolidDarkInk = lv < 58 && ch < 45;
    const isThinDarkRidge = lv < 112 && ch < 72 && (localMean - lv) > 28;

    if (isSolidDarkInk || isThinDarkRidge) {
      coreInk[i] = 1;
      if (isSolidDarkInk) {
        const o = i * 4;
        inkR += data[o];
        inkG += data[o + 1];
        inkB += data[o + 2];
        inkCount++;
      }
    }
  }
}

const avgInkR = inkCount > 0 ? Math.round(inkR / inkCount) : 28;
const avgInkG = inkCount > 0 ? Math.round(inkG / inkCount) : 24;
const avgInkB = inkCount > 0 ? Math.round(inkB / inkCount) : 22;

// Build smooth anti-aliased line-art overlay RGBA buffer
const linesRgba = new Uint8ClampedArray(N * 4);
const isInkOrHalo = new Uint8Array(N);

for (let y = 0; y < H; y++) {
  const row = y * W;
  for (let x = 0; x < W; x++) {
    const i = row + x;
    const o = i * 4;
    if (coreInk[i]) {
      isInkOrHalo[i] = 1;
      linesRgba[o] = avgInkR;
      linesRgba[o + 1] = avgInkG;
      linesRgba[o + 2] = avgInkB;
      linesRgba[o + 3] = 255;
      continue;
    }

    // Check 8-neighbors for anti-aliased edge pixels touching core ink
    let touchesInk = false;
    for (let dy = -1; dy <= 1 && !touchesInk; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= H) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= W) continue;
        if (coreInk[ny * W + nx]) {
          touchesInk = true;
          break;
        }
      }
    }

    if (touchesInk) {
      isInkOrHalo[i] = 1;
      if (lum[i] < 195) {
        // Smooth anti-aliased alpha proportional to darkness
        const alpha = Math.max(0, Math.min(255, Math.round(((195 - lum[i]) / 120) * 240)));
        linesRgba[o] = avgInkR;
        linesRgba[o + 1] = avgInkG;
        linesRgba[o + 2] = avgInkB;
        linesRgba[o + 3] = alpha;
      }
    }
  }
}

// --- Step 2: Exterior White Background Detection ---
// Flood-fill 4-connected from image edges through non-coreInk near-white pixels
const isExteriorBg = new Uint8Array(N);
const queue = new Int32Array(N);
let qHead = 0, qTail = 0;

function isNearWhite(idx) {
  const o = idx * 4;
  return data[o] > 235 && data[o + 1] > 235 && data[o + 2] > 235;
}

for (let x = 0; x < W; x++) {
  const top = x;
  const bot = (H - 1) * W + x;
  if (!coreInk[top] && isNearWhite(top) && !isExteriorBg[top]) {
    isExteriorBg[top] = 1; queue[qTail++] = top;
  }
  if (!coreInk[bot] && isNearWhite(bot) && !isExteriorBg[bot]) {
    isExteriorBg[bot] = 1; queue[qTail++] = bot;
  }
}
for (let y = 0; y < H; y++) {
  const left = y * W;
  const right = y * W + (W - 1);
  if (!coreInk[left] && isNearWhite(left) && !isExteriorBg[left]) {
    isExteriorBg[left] = 1; queue[qTail++] = left;
  }
  if (!coreInk[right] && isNearWhite(right) && !isExteriorBg[right]) {
    isExteriorBg[right] = 1; queue[qTail++] = right;
  }
}

while (qHead < qTail) {
  const curr = queue[qHead++];
  const cx = curr % W;
  const cy = (curr - cx) / W;

  if (cx > 0) {
    const nb = curr - 1;
    if (!isExteriorBg[nb] && !coreInk[nb] && isNearWhite(nb)) {
      isExteriorBg[nb] = 1; queue[qTail++] = nb;
    }
  }
  if (cx < W - 1) {
    const nb = curr + 1;
    if (!isExteriorBg[nb] && !coreInk[nb] && isNearWhite(nb)) {
      isExteriorBg[nb] = 1; queue[qTail++] = nb;
    }
  }
  if (cy > 0) {
    const nb = curr - W;
    if (!isExteriorBg[nb] && !coreInk[nb] && isNearWhite(nb)) {
      isExteriorBg[nb] = 1; queue[qTail++] = nb;
    }
  }
  if (cy < H - 1) {
    const nb = curr + W;
    if (!isExteriorBg[nb] && !coreInk[nb] && isNearWhite(nb)) {
      isExteriorBg[nb] = 1; queue[qTail++] = nb;
    }
  }
}

// --- Step 3: Clean Interior Connected-Component Extraction ---
// Exclude 1px anti-aliased ink halo when seeding regions so JPEG ringing near lines
// never creates false sliver regions. Also split sharp lineless color boundaries (e.g. 2-tone horns).
const seedMap = new Int32Array(N); // 0 = unassigned, >0 = component ID
let nextCompId = 1;
const compPixels = new Map();

// Light 3x3 edge-preserving color smooth for clean color-jump tests
const smoothR = new Uint8Array(N);
const smoothG = new Uint8Array(N);
const smoothB = new Uint8Array(N);
for (let y = 0; y < H; y++) {
  const row = y * W;
  for (let x = 0; x < W; x++) {
    const i = row + x;
    const o = i * 4;
    if (isInkOrHalo[i] || isExteriorBg[i] || x === 0 || x === W - 1 || y === 0 || y === H - 1) {
      smoothR[i] = data[o]; smoothG[i] = data[o + 1]; smoothB[i] = data[o + 2];
      continue;
    }
    const cr = data[o], cg = data[o + 1], cb = data[o + 2];
    let sr = cr * 2, sg = cg * 2, sb = cb * 2, tw = 2;
    const nbs = [i - 1, i + 1, i - W, i + W];
    for (let k = 0; k < 4; k++) {
      const ni = nbs[k];
      if (isInkOrHalo[ni] || isExteriorBg[ni]) continue;
      const no = ni * 4;
      const nr = data[no], ng = data[no + 1], nb = data[no + 2];
      const d2 = (cr - nr) ** 2 + (cg - ng) ** 2 + (cb - nb) ** 2;
      if (d2 < 1200) {
        sr += nr; sg += ng; sb += nb; tw++;
      }
    }
    smoothR[i] = Math.round(sr / tw);
    smoothG[i] = Math.round(sg / tw);
    smoothB[i] = Math.round(sb / tw);
  }
}

const COLOR_JUMP_SQ = 38 * 38; // splits sharp flat-color transitions without ink lines

for (let i = 0; i < N; i++) {
  if (isInkOrHalo[i] || isExteriorBg[i] || seedMap[i] !== 0) continue;

  const cid = nextCompId++;
  const pixList = [];
  qHead = 0; qTail = 0;
  seedMap[i] = cid;
  queue[qTail++] = i;

  while (qHead < qTail) {
    const curr = queue[qHead++];
    pixList.push(curr);
    const cx = curr % W;
    const cy = (curr - cx) / W;
    const cr = smoothR[curr], cg = smoothG[curr], cb = smoothB[curr];

    const tryPush = (nb) => {
      if (seedMap[nb] !== 0 || isInkOrHalo[nb] || isExteriorBg[nb]) return;
      const dr = cr - smoothR[nb];
      const dg = cg - smoothG[nb];
      const db = cb - smoothB[nb];
      if (dr * dr + dg * dg + db * db <= COLOR_JUMP_SQ) {
        seedMap[nb] = cid;
        queue[qTail++] = nb;
      }
    };

    if (cx > 0) tryPush(curr - 1);
    if (cx < W - 1) tryPush(curr + 1);
    if (cy > 0) tryPush(curr - W);
    if (cy < H - 1) tryPush(curr + W);
  }

  compPixels.set(cid, pixList);
}

// --- Step 4: Filter Tiny Noise (Two-Stage: Preserve Ink-Enclosed Regions & Eye Sparkles) ---
const MIN_REGION_PIXELS = 42;    // ~6.5x6.5 px at 800x800 for non-enclosed color-jump regions
const MIN_ENCLOSED_PIXELS = 10;  // ~3.2x3.2 seed px (~25-35 visible px) for ink-enclosed pockets
const validCompIds = new Set();
const tinyComps = [];

for (const [cid, pix] of compPixels.entries()) {
  if (pix.length >= MIN_REGION_PIXELS) {
    validCompIds.add(cid);
  } else {
    tinyComps.push([cid, pix]);
    // Clear from seedMap initially so Pass A absorbs non-enclosed specks into neighbors
    for (let k = 0; k < pix.length; k++) {
      seedMap[pix[k]] = 0;
    }
  }
}

// --- Step 5: Voronoi / Multi-Source BFS Expansion ---
// Pass A1: Expand primary (>= MIN_REGION_PIXELS) seeds into non-coreInk interior gaps/halos.
// Any tiny component touching a primary region (directly or through other non-ink pixels) gets absorbed.
const labelMap = new Int32Array(seedMap); // copy of primary valid seeds
const visibleMap = new Int32Array(N); // tracks visible (non-coreInk) pixels per region for label placement
const distSteps = new Uint8Array(N);

qHead = 0; qTail = 0;
for (let i = 0; i < N; i++) {
  if (labelMap[i] > 0) {
    queue[qTail++] = i;
    distSteps[i] = 1;
    if (!coreInk[i]) visibleMap[i] = labelMap[i];
  }
}

function runPassABfs() {
  while (qHead < qTail) {
    const curr = queue[qHead++];
    const cid = labelMap[curr];
    const cx = curr % W;
    const cy = (curr - cx) / W;

    const expand = (nb) => {
      if (labelMap[nb] !== 0 || isExteriorBg[nb] || coreInk[nb]) return;
      labelMap[nb] = cid;
      visibleMap[nb] = cid;
      queue[qTail++] = nb;
    };
    if (cx > 0) expand(curr - 1);
    if (cx < W - 1) expand(curr + 1);
    if (cy > 0) expand(curr - W);
    if (cy < H - 1) expand(curr + W);
  }
}

runPassABfs();

// Pass A2: Rescue clearly defined ink-enclosed regions (>= MIN_ENCLOSED_PIXELS seed pixels)
// that Pass A1 could not reach because they are completely surrounded by coreInk.
qHead = 0; qTail = 0;
const stillTinyEnclosed = [];
for (const [cid, pix] of tinyComps) {
  if (labelMap[pix[0]] !== 0) continue; // already absorbed by a neighbor in Pass A1
  if (pix.length >= MIN_ENCLOSED_PIXELS) {
    validCompIds.add(cid);
    for (let k = 0; k < pix.length; k++) {
      const p = pix[k];
      seedMap[p] = cid;
      labelMap[p] = cid;
      if (!coreInk[p]) visibleMap[p] = cid;
      queue[qTail++] = p;
    }
  } else {
    stillTinyEnclosed.push([cid, pix]);
  }
}

if (qTail > 0) {
  runPassABfs();
}

// Handle truly microscopic (< MIN_ENCLOSED_PIXELS) ink-enclosed pockets (e.g. eye sparkles & pinholes)
// by baking them into linesRgba so they never become unfillable white holes.
for (const [, pix] of stillTinyEnclosed) {
  if (labelMap[pix[0]] !== 0) continue; // absorbed by a rescued sibling in Pass A2
  let sumR = 0, sumG = 0, sumB = 0, sumLum = 0, sumChroma = 0;
  for (let k = 0; k < pix.length; k++) {
    const p = pix[k];
    const o = p * 4;
    sumR += data[o];
    sumG += data[o + 1];
    sumB += data[o + 2];
    sumLum += lum[p];
    sumChroma += chromaArr[p];
  }
  const n = pix.length;
  const isWhiteSparkle = (sumLum / n) > 215 && (sumChroma / n) < 25;
  const fillR = isWhiteSparkle ? 255 : Math.round(sumR / n);
  const fillG = isWhiteSparkle ? 255 : Math.round(sumG / n);
  const fillB = isWhiteSparkle ? 255 : Math.round(sumB / n);

  // Flood-fill the tiny enclosed pocket's non-coreInk pixels (including its 1px halo) into linesRgba
  qHead = 0; qTail = 0;
  for (let k = 0; k < pix.length; k++) {
    const p = pix[k];
    if (labelMap[p] === 0) {
      labelMap[p] = -1; // mark visited so we don't revisit
      queue[qTail++] = p;
    }
  }
  while (qHead < qTail) {
    const curr = queue[qHead++];
    const o = curr * 4;
    if (linesRgba[o + 3] < 255) {
      // Blend baked fill behind any existing anti-aliased ink alpha
      const a = linesRgba[o + 3] / 255;
      linesRgba[o] = Math.round(linesRgba[o] * a + fillR * (1 - a));
      linesRgba[o + 1] = Math.round(linesRgba[o + 1] * a + fillG * (1 - a));
      linesRgba[o + 2] = Math.round(linesRgba[o + 2] * a + fillB * (1 - a));
      linesRgba[o + 3] = 255;
    }
    const cx = curr % W;
    const cy = (curr - cx) / W;
    const tryPocket = (nb) => {
      if (labelMap[nb] !== 0 || isExteriorBg[nb] || coreInk[nb]) return;
      labelMap[nb] = -1;
      queue[qTail++] = nb;
    };
    if (cx > 0) tryPocket(curr - 1);
    if (cx < W - 1) tryPocket(curr + 1);
    if (cy > 0) tryPocket(curr - W);
    if (cy < H - 1) tryPocket(curr + W);
  }
}

// Clear temporary -1 markers from labelMap before Pass B
for (let i = 0; i < N; i++) {
  if (labelMap[i] < 0) labelMap[i] = 0;
}

// --- Step 6: Compute Pure Median RGB for Each Valid Region (O(K) Histogram) ---
const compColor = new Map();
const histR = new Int32Array(256);
const histG = new Int32Array(256);
const histB = new Int32Array(256);
const medianFromHist = (hist, target) => {
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc > target) return v;
  }
  return 0;
};
for (const cid of validCompIds) {
  const pix = compPixels.get(cid);
  histR.fill(0); histG.fill(0); histB.fill(0);
  for (let k = 0; k < pix.length; k++) {
    const o = pix[k] * 4;
    histR[data[o]]++;
    histG[data[o + 1]]++;
    histB[data[o + 2]]++;
  }
  const mid = pix.length >> 1;
  compColor.set(cid, [
    medianFromHist(histR, mid),
    medianFromHist(histG, mid),
    medianFromHist(histB, mid),
  ]);
}

// Pass B: Expand up to 3px underneath coreInk (stopping before exterior background)
const UNDER_INK_PX = 3;
qHead = 0; qTail = 0;
distSteps.fill(0);
for (let i = 0; i < N; i++) {
  if (labelMap[i] > 0) {
    const cx = i % W, cy = (i - cx) / W;
    if (
      (cx > 0 && coreInk[i - 1]) ||
      (cx < W - 1 && coreInk[i + 1]) ||
      (cy > 0 && coreInk[i - W]) ||
      (cy < H - 1 && coreInk[i + W])
    ) {
      queue[qTail++] = i;
      distSteps[i] = 1;
    }
  }
}

while (qHead < qTail) {
  const curr = queue[qHead++];
  const d = distSteps[curr];
  if (d > UNDER_INK_PX) continue;
  const cid = labelMap[curr];
  const cx = curr % W;
  const cy = (curr - cx) / W;

  const expandInk = (nb) => {
    if (labelMap[nb] !== 0 || !coreInk[nb]) return;
    labelMap[nb] = cid;
    distSteps[nb] = d + 1;
    queue[qTail++] = nb;
  };
  if (cx > 0) expandInk(curr - 1);
  if (cx < W - 1) expandInk(curr + 1);
  if (cy > 0) expandInk(curr - W);
  if (cy < H - 1) expandInk(curr + W);
}

// --- Step 7: Natural Palette Merging in CIELAB ---
// Group regions with perceptually identical colors (ΔE < 11) so the same color shares one number.
let clusters = [];
for (const cid of validCompIds) {
  const rgb = compColor.get(cid);
  const weight = compPixels.get(cid).length;
  clusters.push({
    r: rgb[0], g: rgb[1], b: rgb[2],
    lab: rgbToLab(rgb[0], rgb[1], rgb[2]),
    weight,
    cids: [cid],
  });
}

const MERGE_DELTA_E = 11.5;
const MAX_COLORS = 26;
const M = clusters.length;
const distMat = new Float64Array(M * M);
for (let i = 0; i < M; i++) {
  for (let j = i + 1; j < M; j++) {
    const d = labDist(clusters[i].lab, clusters[j].lab);
    distMat[i * M + j] = d;
    distMat[j * M + i] = d;
  }
}
const activeIdx = [];
for (let i = 0; i < M; i++) activeIdx.push(i);

while (activeIdx.length > 1) {
  let bestDist = Infinity;
  let biPos = -1, bjPos = -1;
  for (let p = 0; p < activeIdx.length; p++) {
    const i = activeIdx[p];
    const row = i * M;
    for (let q = p + 1; q < activeIdx.length; q++) {
      const d = distMat[row + activeIdx[q]];
      if (d < bestDist) {
        bestDist = d;
        biPos = p;
        bjPos = q;
      }
    }
  }
  if (bestDist > MERGE_DELTA_E && activeIdx.length <= MAX_COLORS) break;
  const i = activeIdx[biPos];
  const j = activeIdx[bjPos];
  const a = clusters[i];
  const b = clusters[j];
  const tot = a.weight + b.weight;
  a.r = Math.round((a.r * a.weight + b.r * b.weight) / tot);
  a.g = Math.round((a.g * a.weight + b.g * b.weight) / tot);
  a.b = Math.round((a.b * a.weight + b.b * b.weight) / tot);
  a.lab = rgbToLab(a.r, a.g, a.b);
  a.weight = tot;
  a.cids.push(...b.cids);
  activeIdx.splice(bjPos, 1);

  for (let p = 0; p < activeIdx.length; p++) {
    const k = activeIdx[p];
    if (k === i) continue;
    const d = labDist(a.lab, clusters[k].lab);
    distMat[i * M + k] = d;
    distMat[k * M + i] = d;
  }
}

clusters = activeIdx.map(i => clusters[i]);

// Sort palette lightest to darkest for a pleasing paint tray
clusters.sort((a, b) => {
  const la = 0.299 * a.r + 0.587 * a.g + 0.114 * a.b;
  const lb = 0.299 * b.r + 0.587 * b.g + 0.114 * b.b;
  return lb - la;
});

const cidToPaletteIdx = new Map();
const palette = clusters.map((c, idx) => {
  for (const cid of c.cids) cidToPaletteIdx.set(cid, idx);
  return {
    number: idx + 1,
    hex: rgbToHex(c.r, c.g, c.b),
    name: `Color #${idx + 1}`,
    total_count: 0,
    filled_count: 0,
    is_completed: false,
  };
});

// --- Step 8: Exact Pole-of-Inaccessibility on Visible (Non-Ink) Pixels ---
const distToEdge = new Int32Array(N);
qHead = 0; qTail = 0;

for (let y = 0; y < H; y++) {
  const row = y * W;
  for (let x = 0; x < W; x++) {
    const i = row + x;
    const cid = visibleMap[i];
    if (cid === 0) continue;
    if (
      x === 0 || x === W - 1 || y === 0 || y === H - 1 ||
      visibleMap[i - 1] !== cid || visibleMap[i + 1] !== cid ||
      visibleMap[i - W] !== cid || visibleMap[i + W] !== cid
    ) {
      distToEdge[i] = 1;
      queue[qTail++] = i;
    }
  }
}

while (qHead < qTail) {
  const curr = queue[qHead++];
  const d = distToEdge[curr];
  const cid = visibleMap[curr];
  const cx = curr % W;
  const cy = (curr - cx) / W;

  if (cx > 0 && distToEdge[curr - 1] === 0 && visibleMap[curr - 1] === cid) {
    distToEdge[curr - 1] = d + 1; queue[qTail++] = curr - 1;
  }
  if (cx < W - 1 && distToEdge[curr + 1] === 0 && visibleMap[curr + 1] === cid) {
    distToEdge[curr + 1] = d + 1; queue[qTail++] = curr + 1;
  }
  if (cy > 0 && distToEdge[curr - W] === 0 && visibleMap[curr - W] === cid) {
    distToEdge[curr - W] = d + 1; queue[qTail++] = curr - W;
  }
  if (cy < H - 1 && distToEdge[curr + W] === 0 && visibleMap[curr + W] === cid) {
    distToEdge[curr + W] = d + 1; queue[qTail++] = curr + W;
  }
}

const visiblePixelsByCid = new Map();
const expandedPixelsByCid = new Map();
for (let i = 0; i < N; i++) {
  const vc = visibleMap[i];
  if (vc > 0) {
    let list = visiblePixelsByCid.get(vc);
    if (!list) { list = []; visiblePixelsByCid.set(vc, list); }
    list.push(i);
  }
  const ec = labelMap[i];
  if (ec > 0) {
    let list = expandedPixelsByCid.get(ec);
    if (!list) { list = []; expandedPixelsByCid.set(ec, list); }
    list.push(i);
  }
}

function computeLabelPos(cid) {
  const pix = visiblePixelsByCid.get(cid) || expandedPixelsByCid.get(cid);
  if (!pix || pix.length === 0) return { x: 0, y: 0, radius: 2 };

  let maxD = 1;
  for (let i = 0; i < pix.length; i++) {
    const d = distToEdge[pix[i]];
    if (d > maxD) maxD = d;
  }

  const coreThresh = maxD >= 4 ? maxD - 1 : maxD;
  let sumX = 0, sumY = 0, wSum = 0;
  for (let i = 0; i < pix.length; i++) {
    const p = pix[i];
    const d = distToEdge[p];
    if (d >= coreThresh) {
      const w = d * d;
      sumX += (p % W) * w;
      sumY += Math.floor(p / W) * w;
      wSum += w;
    }
  }
  const meanX = wSum > 0 ? sumX / wSum : (pix[0] % W);
  const meanY = wSum > 0 ? sumY / wSum : Math.floor(pix[0] / W);

  let bestP = pix[0];
  let bestScore = -Infinity;
  for (let i = 0; i < pix.length; i++) {
    const p = pix[i];
    const d = distToEdge[p];
    if (d < coreThresh) continue;
    const px = p % W;
    const py = (p - px) / W;
    const score = d * 100 - Math.hypot(px - meanX, py - meanY);
    if (score > bestScore) {
      bestScore = score;
      bestP = p;
    }
  }

  return {
    x: Math.round(((bestP % W) + 0.5) * 10) / 10,
    y: Math.round((Math.floor(bestP / W) + 0.5) * 10) / 10,
    radius: Math.max(2.0, Math.round(maxD * 10) / 10),
  };
}

// --- Step 9: Exact Crack-Code Boundary Tracing + Simplification ---
function getSqSegDist(p, p1, p2) {
  let x = p1.x, y = p1.y;
  let dx = p2.x - x, dy = p2.y - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = p2.x; y = p2.y; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  return (p.x - x) ** 2 + (p.y - y) ** 2;
}

function simplifyDP(pts, sqTol) {
  if (pts.length <= 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length > 0) {
    const [s, e] = stack.pop();
    let maxD = 0, maxIdx = s;
    for (let i = s + 1; i < e; i++) {
      const d = getSqSegDist(pts[i], pts[s], pts[e]);
      if (d > maxD) { maxD = d; maxIdx = i; }
    }
    if (maxD > sqTol) {
      keep[maxIdx] = 1;
      if (maxIdx - s > 1) stack.push([s, maxIdx]);
      if (e - maxIdx > 1) stack.push([maxIdx, e]);
    }
  }
  const out = [];
  for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

function smoothAndSimplifyLoop(rawPts) {
  if (rawPts.length < 4) return rawPts;
  // Remove collinear grid points first
  const dedup = [];
  const n = rawPts.length;
  for (let i = 0; i < n; i++) {
    const prev = rawPts[(i - 1 + n) % n];
    const curr = rawPts[i];
    const next = rawPts[(i + 1) % n];
    if ((curr.x - prev.x) * (next.y - curr.y) !== (curr.y - prev.y) * (next.x - curr.x)) {
      dedup.push({ x: curr.x, y: curr.y });
    }
  }
  if (dedup.length < 3) return rawPts;

  // 2 light Taubin smoothing passes to melt pixel staircases without shrinking
  let pts = dedup;
  for (let pass = 0; pass < 2; pass++) {
    const m = pts.length;
    const tmp = new Array(m);
    for (let i = 0; i < m; i++) {
      const p0 = pts[(i - 1 + m) % m];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % m];
      tmp[i] = {
        x: p1.x + 0.35 * ((p0.x + p2.x) * 0.5 - p1.x),
        y: p1.y + 0.35 * ((p0.y + p2.y) * 0.5 - p1.y),
      };
    }
    const nxt = new Array(m);
    for (let i = 0; i < m; i++) {
      const p0 = tmp[(i - 1 + m) % m];
      const p1 = tmp[i];
      const p2 = tmp[(i + 1) % m];
      nxt[i] = {
        x: p1.x - 0.36 * ((p0.x + p2.x) * 0.5 - p1.x),
        y: p1.y - 0.36 * ((p0.y + p2.y) * 0.5 - p1.y),
      };
    }
    pts = nxt;
  }

  // Douglas-Peucker simplification (closed loop)
  const closed = [...pts, pts[0]];
  const simp = simplifyDP(closed, 0.75 * 0.75);
  if (simp.length > 1) simp.pop(); // remove duplicate closing vertex

  return simp.map(p => ({
    x: Math.round(p.x * 10) / 10,
    y: Math.round(p.y * 10) / 10,
  }));
}

function signedArea(loop) {
  let a = 0;
  for (let i = 0; i < loop.length; i++) {
    const p1 = loop[i];
    const p2 = loop[(i + 1) % loop.length];
    a += (p1.x * p2.y - p2.x * p1.y);
  }
  return a * 0.5;
}

function traceRegionLoops(cid) {
  const pix = expandedPixelsByCid.get(cid);
  if (!pix || pix.length === 0) return { outer: null, holes: [] };

  // Build directed crack-code boundary edges: key = start vertex (vy*(W+1)+vx) -> array of end vertices
  const stride = W + 1;
  const edgeMap = new Map();
  const addEdge = (x0, y0, x1, y1) => {
    const k = y0 * stride + x0;
    const v = y1 * stride + x1;
    let arr = edgeMap.get(k);
    if (!arr) { arr = [v]; edgeMap.set(k, arr); }
    else arr.push(v);
  };

  for (let i = 0; i < pix.length; i++) {
    const p = pix[i];
    const x = p % W;
    const y = (p - x) / W;
    // Top edge (left -> right)
    if (y === 0 || labelMap[p - W] !== cid) addEdge(x, y, x + 1, y);
    // Right edge (top -> bottom)
    if (x === W - 1 || labelMap[p + 1] !== cid) addEdge(x + 1, y, x + 1, y + 1);
    // Bottom edge (right -> left)
    if (y === H - 1 || labelMap[p + W] !== cid) addEdge(x + 1, y + 1, x, y + 1);
    // Left edge (bottom -> top)
    if (x === 0 || labelMap[p - 1] !== cid) addEdge(x, y + 1, x, y);
  }

  const loops = [];
  for (const [startKey, outs] of edgeMap.entries()) {
    while (outs.length > 0) {
      const loop = [];
      let curr = startKey;
      let prevX = -1, prevY = -1;
      let safety = 0;
      while (safety++ < 200000) {
        const cx = curr % stride;
        const cy = (curr - cx) / stride;
        loop.push({ x: cx, y: cy });

        const list = edgeMap.get(curr);
        if (!list || list.length === 0) break;

        // If 2 outgoing edges (4-way vertex), turn right relative to incoming direction to avoid figure-8s
        let chosenIdx = 0;
        if (list.length > 1 && prevX !== -1) {
          const inDx = cx - prevX;
          const inDy = cy - prevY;
          // Right turn in screen coords (y-down): (-inDy, inDx)
          const rx = -inDy, ry = inDx;
          for (let j = 0; j < list.length; j++) {
            const nx = list[j] % stride;
            const ny = (list[j] - nx) / stride;
            if (nx - cx === rx && ny - cy === ry) {
              chosenIdx = j;
              break;
            }
          }
        }
        const next = list.splice(chosenIdx, 1)[0];
        prevX = cx; prevY = cy;
        curr = next;
        if (curr === startKey) break;
      }
      if (loop.length >= 4) loops.push(loop);
    }
  }

  let outer = null;
  let maxAbsArea = -1;
  const holes = [];

  for (const lp of loops) {
    const area = signedArea(lp);
    if (area > maxAbsArea) {
      if (outer) {
        // previous candidate wasn't the largest
      }
      maxAbsArea = area;
      outer = lp;
    }
  }

  for (const lp of loops) {
    if (lp === outer) continue;
    const area = signedArea(lp);
    // Negative signed area = interior hole (only keep meaningful holes >= 25 sq px)
    if (area < -25) {
      holes.push(smoothAndSimplifyLoop(lp));
    }
  }

  return {
    outer: outer ? smoothAndSimplifyLoop(outer) : null,
    holes,
  };
}

// --- Step 10: Assemble Final Regions ---
const candidateRegions = [];

for (const cid of validCompIds) {
  const traced = traceRegionLoops(cid);
  if (!traced.outer || traced.outer.length < 3) continue;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const pt of traced.outer) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const bboxArea = (maxX - minX) * (maxY - minY);
  const lbl = computeLabelPos(cid);
  const pIdx = cidToPaletteIdx.get(cid);

  candidateRegions.push({
    bboxArea,
    pointCount: (expandedPixelsByCid.get(cid) || []).length,
    paletteIdx: pIdx,
    polygon: traced.outer,
    holes: traced.holes.length > 0 ? traced.holes : undefined,
    centroid: { x: lbl.x, y: lbl.y },
    label_radius: lbl.radius,
  });
}

// Sort largest bboxArea first (outer regions draw before inner islands; inner islands hit-test first)
candidateRegions.sort((a, b) => {
  if (b.bboxArea !== a.bboxArea) return b.bboxArea - a.bboxArea;
  return b.pointCount - a.pointCount;
});

const regions = candidateRegions.map((r, idx) => {
  const pal = palette[r.paletteIdx];
  pal.total_count++;
  const reg = {
    id: idx,
    number: pal.number,
    polygon: r.polygon,
    centroid: r.centroid,
    label_radius: r.label_radius,
    color_hex: pal.hex,
    is_filled: false,
    fill_anim: 0.0,
  };
  if (r.holes) reg.holes = r.holes;
  return reg;
});

// Remove any unused palette items (safety)
const activePalette = palette.filter(p => p.total_count > 0);
const numRemap = new Map();
activePalette.forEach((p, idx) => {
  numRemap.set(p.number, idx + 1);
  p.number = idx + 1;
  p.name = `Color #${idx + 1}`;
});
for (const r of regions) {
  r.number = numRemap.get(r.number) || r.number;
}

const artwork = {
  id: outputId,
  title,
  artist,
  category: 'classic',
  width: W,
  height: H,
  line_art_url: lineArtUrl,
  palette: activePalette,
  regions,
};

fs.writeFileSync(outJsonPath, JSON.stringify(artwork));
fs.writeFileSync(outLinesPath, Buffer.from(linesRgba.buffer, linesRgba.byteOffset, linesRgba.byteLength));
console.log(`  [Line-Preserving PBN] ${outputId}: ${regions.length} regions, ${activePalette.length} colors`);
