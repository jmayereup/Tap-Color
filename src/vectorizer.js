/**
 * Tap Color - Paint-by-Number Vectorizer Engine
 * Powered by the open-source paintbynumbersgenerator (drake7707 / BenjaminSymons v2)
 * CIELAB k-means quantization, narrow-strip cleanup, topological facet reduction,
 * shared Haar-wavelet border segmentation, and exact facetMap pole-of-inaccessibility labeling.
 */

import { kmeans } from 'ml-kmeans';
import {
  Settings,
  ClusteringColorSpace,
  ColorReducer,
  FacetCreator,
  FacetReducer,
  FacetBorderTracer,
  FacetBorderSegmenter,
} from './lib/paintbynumbersgenerator.js';

export { kmeans };

export const COMPLEXITY_PRESETS = {
  cozy: {
    name: 'Cozy (Relaxing)',
    paletteSize: 16,
    minPixels: 45,
    workingSize: 380,
    halvePasses: 2,
    stripCleanupRuns: 2,
  },
  balanced: {
    name: 'Balanced (Standard)',
    paletteSize: 22,
    minPixels: 30,
    workingSize: 440,
    halvePasses: 2,
    stripCleanupRuns: 2,
  },
  detailed: {
    name: 'Detailed (Masterpiece)',
    paletteSize: 28,
    minPixels: 20,
    workingSize: 500,
    halvePasses: 2,
    stripCleanupRuns: 2,
  },
  // Aliases used by batch CLI presets
  intricate: {
    name: 'Intricate (Classic)',
    paletteSize: 22,
    minPixels: 30,
    workingSize: 440,
    halvePasses: 2,
    stripCleanupRuns: 2,
  },
  masterpiece: {
    name: 'Masterpiece (Detailed)',
    paletteSize: 28,
    minPixels: 20,
    workingSize: 500,
    halvePasses: 2,
    stripCleanupRuns: 2,
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

function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

/**
 * Exact O(W*H) Pole of Inaccessibility using facetResult.facetMap:
 * Finds the point inside each facet's actual pixels that maximizes clearance to any
 * other facet (automatically respecting both outer borders and nested interior holes).
 */
export function computeExactFacetLabels(facetResult) {
  const W = facetResult.width;
  const H = facetResult.height;
  const total = W * H;
  const fmap = facetResult.facetMap.arr;

  const dist = new Int32Array(total);
  const q = new Int32Array(total);
  let head = 0;
  let tail = 0;

  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const idx = row + x;
      const fid = fmap[idx];
      if (
        x === 0 || x === W - 1 || y === 0 || y === H - 1 ||
        fmap[idx - 1] !== fid || fmap[idx + 1] !== fid ||
        fmap[idx - W] !== fid || fmap[idx + W] !== fid
      ) {
        dist[idx] = 1;
        q[tail++] = idx;
      }
    }
  }

  while (head < tail) {
    const curr = q[head++];
    const d = dist[curr];
    const fid = fmap[curr];
    const cx = curr % W;
    const cy = (curr - cx) / W;

    if (cx > 0 && dist[curr - 1] === 0 && fmap[curr - 1] === fid) {
      dist[curr - 1] = d + 1;
      q[tail++] = curr - 1;
    }
    if (cx < W - 1 && dist[curr + 1] === 0 && fmap[curr + 1] === fid) {
      dist[curr + 1] = d + 1;
      q[tail++] = curr + 1;
    }
    if (cy > 0 && dist[curr - W] === 0 && fmap[curr - W] === fid) {
      dist[curr - W] = d + 1;
      q[tail++] = curr - W;
    }
    if (cy < H - 1 && dist[curr + W] === 0 && fmap[curr + W] === fid) {
      dist[curr + W] = d + 1;
      q[tail++] = curr + W;
    }
  }

  const pixelsByFacet = new Map();
  for (let idx = 0; idx < total; idx++) {
    const fid = fmap[idx];
    let list = pixelsByFacet.get(fid);
    if (!list) {
      list = [];
      pixelsByFacet.set(fid, list);
    }
    list.push(idx);
  }

  const labelInfo = new Map();
  for (const f of facetResult.facets) {
    if (!f) continue;
    const pix = pixelsByFacet.get(f.id);
    if (!pix || pix.length === 0) continue;

    let maxD = 1;
    for (let i = 0; i < pix.length; i++) {
      const d = dist[pix[i]];
      if (d > maxD) maxD = d;
    }

    const coreThresh = maxD >= 4 ? maxD - 1 : maxD;
    let sumX = 0, sumY = 0, count = 0;
    for (let i = 0; i < pix.length; i++) {
      const p = pix[i];
      const d = dist[p];
      if (d >= coreThresh) {
        const w = d * d;
        sumX += (p % W) * w;
        sumY += Math.floor(p / W) * w;
        count += w;
      }
    }
    const meanX = count > 0 ? sumX / count : (pix[0] % W);
    const meanY = count > 0 ? sumY / count : Math.floor(pix[0] / W);

    let bestP = pix[0];
    let bestScore = -Infinity;
    for (let i = 0; i < pix.length; i++) {
      const p = pix[i];
      const d = dist[p];
      if (d < coreThresh) continue;
      const px = p % W;
      const py = (p - px) / W;
      const distToMean = Math.hypot(px - meanX, py - meanY);
      const score = d * 100 - distToMean;
      if (score > bestScore) {
        bestScore = score;
        bestP = p;
      }
    }

    labelInfo.set(f.id, {
      x: (bestP % W) + 0.5,
      y: Math.floor(bestP / W) + 0.5,
      radius: Math.max(1.0, maxD),
    });
  }
  return labelInfo;
}

/**
 * Core headless Paint-by-Number pipeline using paintbynumbersgenerator.
 * Accepts an ImageData-like object { width, height, data: Uint8ClampedArray }
 * and returns a Tap Color ArtworkData JSON structure.
 */
export async function buildArtworkFromImageData(rawImgData, options = {}) {
  const progress = options.onProgress || (() => {});
  const complexityKey = options.complexity || 'balanced';
  const preset = COMPLEXITY_PRESETS[complexityKey] || COMPLEXITY_PRESETS.balanced;
  const K = options.customPaletteSize || preset.paletteSize;
  const W = rawImgData.width;
  const H = rawImgData.height;

  const settings = new Settings();
  settings.kMeansNrOfClusters = K;
  settings.kMeansMinDeltaDifference = 1;
  settings.kMeansClusteringColorSpace = ClusteringColorSpace.LAB;
  settings.removeFacetsSmallerThanNrOfPoints = options.minPixels || preset.minPixels;
  settings.removeFacetsFromLargeToSmall = false;
  settings.maximumNumberOfFacets = 100000;
  settings.nrOfTimesToHalveBorderSegments = preset.halvePasses ?? 2;
  settings.narrowPixelStripCleanupRuns = preset.stripCleanupRuns ?? 2;
  settings.randomSeed = 42;

  progress('Quantizing palette in CIELAB space...', 25);
  const kmeansImgData = {
    width: W,
    height: H,
    data: new Uint8ClampedArray(W * H * 4),
  };

  await ColorReducer.applyKMeansClustering(rawImgData, kmeansImgData, null, settings, null);
  const colormapResult = ColorReducer.createColorMap(kmeansImgData);

  progress('Building & cleaning color facets...', 50);
  let facetResult = null;
  for (let run = 0; run < settings.narrowPixelStripCleanupRuns; run++) {
    await ColorReducer.processNarrowPixelStripCleanup(colormapResult);
    facetResult = await FacetCreator.getFacets(W, H, colormapResult.imgColorIndices, null);
    await FacetReducer.reduceFacets(
      settings.removeFacetsSmallerThanNrOfPoints,
      settings.removeFacetsFromLargeToSmall,
      settings.maximumNumberOfFacets,
      colormapResult.colorsByIndex,
      facetResult,
      colormapResult.imgColorIndices,
      null
    );
  }

  progress('Tracing & smoothing shared boundaries...', 75);
  await FacetBorderTracer.buildFacetBorderPaths(facetResult, null);
  await FacetBorderSegmenter.buildFacetBorderSegments(
    facetResult,
    settings.nrOfTimesToHalveBorderSegments,
    null
  );

  progress('Computing pole-of-inaccessibility number positions...', 88);
  const labelMap = computeExactFacetLabels(facetResult);

  // Check if the four corners of the image are white sticker background
  const fmap = facetResult.facetMap.arr;
  const cornerFacetIds = new Set([
    fmap[0],
    fmap[W - 1],
    fmap[(H - 1) * W],
    fmap[H * W - 1],
  ]);

  const artworkWidth = 800;
  const artworkHeight = 800;
  const margin = 20;
  const availW = artworkWidth - margin * 2;
  const availH = artworkHeight - margin * 2;
  const scaleX = availW / W;
  const scaleY = availH / H;

  const rawColors = colormapResult.colorsByIndex;
  const palette = rawColors.map((c, idx) => ({
    number: idx + 1,
    hex: rgbToHex(c[0], c[1], c[2]),
    rgb: c,
    name: `Color #${idx + 1}`,
    total_count: 0,
    filled_count: 0,
    is_completed: false,
  }));

  // Collect valid facets and sort by (bboxArea, pointCount) descending so
  // outer enclosing shapes always draw before inner islands (and inner islands hit-test first).
  const candidateFacets = [];
  for (const f of facetResult.facets) {
    if (!f || !f.borderSegments || f.borderSegments.length === 0) continue;
    const c = rawColors[f.color];
    const bboxArea = f.bbox.width * f.bbox.height;

    // Skip the outer white paper/sticker background facet touching the canvas corners
    const isWhiteBg = c[0] > 242 && c[1] > 242 && c[2] > 242;
    if (isWhiteBg && cornerFacetIds.has(f.id) && bboxArea > W * H * 0.35) {
      continue;
    }

    candidateFacets.push({
      facet: f,
      bboxArea,
      pointCount: f.pointCount,
    });
  }

  candidateFacets.sort((a, b) => {
    if (b.bboxArea !== a.bboxArea) return b.bboxArea - a.bboxArea;
    return b.pointCount - a.pointCount;
  });

  const regions = [];
  let regId = 0;

  for (const item of candidateFacets) {
    const f = item.facet;
    const pathPts = f.getFullPathFromBorderSegments(false);
    if (!pathPts || pathPts.length < 3) continue;

    // Subdivide quadratic curve midpoints matching paintbynumbersgenerator's SVG path generator
    const closed = [...pathPts];
    if (closed[0].x !== closed[closed.length - 1].x || closed[0].y !== closed[closed.length - 1].y) {
      closed.push(closed[0]);
    }

    const worldPoly = [];
    worldPoly.push({
      x: Math.round((margin + closed[0].x * scaleX) * 10) / 10,
      y: Math.round((margin + closed[0].y * scaleY) * 10) / 10,
    });
    for (let i = 1; i < closed.length; i++) {
      const p0 = closed[i - 1];
      const p1 = closed[i];
      const mx = (p0.x + p1.x) * 0.5;
      const my = (p0.y + p1.y) * 0.5;
      worldPoly.push({
        x: Math.round((margin + mx * scaleX) * 10) / 10,
        y: Math.round((margin + my * scaleY) * 10) / 10,
      });
      worldPoly.push({
        x: Math.round((margin + p1.x * scaleX) * 10) / 10,
        y: Math.round((margin + p1.y * scaleY) * 10) / 10,
      });
    }

    if (worldPoly.length < 3) continue;

    const lbl = labelMap.get(f.id) || {
      x: (f.bbox.minX + f.bbox.maxX) * 0.5,
      y: (f.bbox.minY + f.bbox.maxY) * 0.5,
      radius: 2.0,
    };

    const worldCentroid = {
      x: Math.round((margin + lbl.x * scaleX) * 10) / 10,
      y: Math.round((margin + lbl.y * scaleY) * 10) / 10,
    };
    const worldRadius = Math.max(1.5, Math.round(lbl.radius * scaleX * 10) / 10);

    const colorNum = f.color + 1;
    palette[f.color].total_count++;

    regions.push({
      id: regId++,
      number: colorNum,
      polygon: worldPoly,
      centroid: worldCentroid,
      label_radius: worldRadius,
      color_hex: palette[f.color].hex,
      is_filled: false,
      fill_anim: 0.0,
    });
  }

  // Filter out unused palette entries and sort by perceived luminance (lightest to darkest)
  const activePalette = palette.filter(p => p.total_count > 0);
  activePalette.sort((a, b) => {
    const lumA = 0.299 * a.rgb[0] + 0.587 * a.rgb[1] + 0.114 * a.rgb[2];
    const lumB = 0.299 * b.rgb[0] + 0.587 * b.rgb[1] + 0.114 * b.rgb[2];
    return lumB - lumA;
  });

  const oldToNewNum = new Map();
  activePalette.forEach((p, idx) => {
    const newNum = idx + 1;
    oldToNewNum.set(p.number, newNum);
    p.number = newNum;
    p.name = `Color #${newNum}`;
    delete p.rgb;
  });

  for (const r of regions) {
    r.number = oldToNewNum.get(r.number) || r.number;
  }

  return {
    id: options.id || `custom_art_${Date.now()}`,
    title: options.title || 'My Photo Painting',
    artist: options.artist || 'My Custom Art',
    category: options.category || 'imported',
    width: artworkWidth,
    height: artworkHeight,
    palette: activePalette,
    regions,
  };
}

/**
 * Browser entry point: converts an HTMLImageElement or HTMLCanvasElement into
 * a planar Paint-by-Number artwork + thumbnail Blob.
 */
export async function vectorizeImage(sourceImage, options = {}) {
  const progress = options.onProgress || (() => {});
  const complexityKey = options.complexity || 'balanced';
  const preset = COMPLEXITY_PRESETS[complexityKey] || COMPLEXITY_PRESETS.balanced;
  const W = preset.workingSize;
  const H = preset.workingSize;

  progress('Opening your picture...', 10);
  await new Promise(r => setTimeout(r, 20));

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

  const artwork = await buildArtworkFromImageData(rawImgData, {
    ...options,
    complexity: complexityKey,
    onProgress: progress,
  });

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

  ctx.fillStyle = '#F8FAFC';
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

  const isDiamond = (artwork.id && artwork.id.includes('diamond')) ||
    (artwork.regions.length > 500 && artwork.regions[0]?.polygon?.length === 4);

  artwork.regions.forEach(reg => {
    if (!reg.polygon || reg.polygon.length < 3) return;
    if (isDiamond && reg.polygon.length === 4) {
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

      ctx.strokeStyle = 'rgba(30, 41, 59, 0.78)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
  });

  ctx.restore();

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/png');
  });
}
