/**
 * Tap Color - Photo-to-Vector Paint-by-Number Pipeline
 * Converts user photos into organic vector artworks matching the Rust WASM engine.
 */

import ImageTracer from 'imagetracerjs';
import { kmeans } from 'ml-kmeans';
import { preprocessImageForVectorization } from './filters.js';

export const COMPLEXITY_PRESETS = {
  cozy: {
    name: 'Cozy (Relaxing)',
    paletteSize: 10,
    pathOmit: 26,
    minArea: 48,
    ltres: 1.5,
    qtres: 1.5,
    workingSize: 360,
  },
  balanced: {
    name: 'Balanced (Standard)',
    paletteSize: 14,
    pathOmit: 15,
    minArea: 24,
    ltres: 1.0,
    qtres: 1.0,
    workingSize: 420,
  },
  detailed: {
    name: 'Detailed (Masterpiece)',
    paletteSize: 18,
    pathOmit: 8,
    minArea: 14,
    ltres: 0.6,
    qtres: 0.6,
    workingSize: 480,
  },
};

/**
 * Calculates the polygon centroid using the area-weighted cross-product formula,
 * matching src/models.rs calculate_centroid.
 *
 * @param {Array<{x: number, y: number}>} points
 * @returns {{x: number, y: number}}
 */
export function calculatePolygonCentroid(points) {
  const n = points.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return { x: points[0].x, y: points[0].y };
  if (n === 2) return { x: (points[0].x + points[1].x) * 0.5, y: (points[0].y + points[1].y) * 0.5 };

  let area = 0.0;
  let cx = 0.0;
  let cy = 0.0;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p1 = points[i];
    const p2 = points[j];
    const cross = p1.x * p2.y - p2.x * p1.y;
    area += cross;
    cx += (p1.x + p2.x) * cross;
    cy += (p1.y + p2.y) * cross;
  }

  area *= 0.5;
  if (Math.abs(area) > 1e-4) {
    cx /= 6.0 * area;
    cy /= 6.0 * area;
    return { x: cx, y: cy };
  }

  // Fallback to arithmetic mean
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += points[i].x;
    sumY += points[i].y;
  }
  return { x: sumX / n, y: sumY / n };
}

/**
 * Calculates absolute polygon area using the shoelace formula.
 * @param {Array<{x: number, y: number}>} points
 * @returns {number}
 */
export function calculatePolygonArea(points) {
  const n = points.length;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(area * 0.5);
}

/**
 * Converts an RGB triplet into a hex string.
 */
function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

/**
 * Generates an organic vector Paint-by-Number artwork from an image element or canvas.
 *
 * @param {HTMLImageElement|HTMLCanvasElement} sourceImage
 * @param {Object} options
 * @param {string} [options.title] - Name of the artwork
 * @param {'cozy'|'balanced'|'detailed'} [options.complexity='balanced'] - Complexity preset
 * @param {number} [options.customPaletteSize] - Optional override for palette color count
 * @param {Function} [options.onProgress] - Progress callback (message: string, percent: number)
 * @returns {Promise<{artwork: Object, thumbnailBlob: Blob}>}
 */
export async function vectorizeImage(sourceImage, options = {}) {
  const progress = options.onProgress || (() => {});
  const complexityKey = options.complexity || 'balanced';
  const preset = COMPLEXITY_PRESETS[complexityKey] || COMPLEXITY_PRESETS.balanced;
  const K = options.customPaletteSize || preset.paletteSize;
  const W = preset.workingSize;
  const H = preset.workingSize;

  progress('Preparing canvas & scaling image...', 10);
  await new Promise(r => setTimeout(r, 20));

  // 1. Draw source image onto a square working canvas
  const workCanvas = document.createElement('canvas');
  workCanvas.width = W;
  workCanvas.height = H;
  const workCtx = workCanvas.getContext('2d');

  // Fill neutral background in case source has transparency
  workCtx.fillStyle = '#FFFFFF';
  workCtx.fillRect(0, 0, W, H);

  // Contain / cover aspect ratio fitting into square canvas
  const srcW = sourceImage.naturalWidth || sourceImage.videoWidth || sourceImage.width;
  const srcH = sourceImage.naturalHeight || sourceImage.videoHeight || sourceImage.height;
  const scale = Math.max(W / srcW, H / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;
  workCtx.drawImage(sourceImage, dx, dy, dw, dh);

  const rawImgData = workCtx.getImageData(0, 0, W, H);

  // 2. Preprocess with bilateral and median filters
  progress('Smoothing textures & preserving outlines...', 25);
  await new Promise(r => setTimeout(r, 20));

  const smoothedImgData = preprocessImageForVectorization(rawImgData, {
    radius: 2,
    sigmaSpace: 2.5,
    sigmaColor: 30.0,
    useMedian: true,
  });

  // 3. Subsample pixels for fast K-Means clustering
  progress('Quantizing harmonious color palette...', 45);
  await new Promise(r => setTimeout(r, 20));

  const dataPoints = [];
  const pixels = smoothedImgData.data;
  const sampleStride = Math.max(1, Math.floor((W * H) / 12000)); // ~12k sample points is plenty
  for (let i = 0; i < pixels.length; i += sampleStride * 4) {
    dataPoints.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  }

  const kResult = kmeans(dataPoints, K, {
    initialization: 'kmeans++',
    maxIterations: 15,
  });

  // Sort palette colors by perceived brightness for intuitive numbering
  const centers = kResult.centroids.map(c => [
    Math.min(255, Math.max(0, Math.round(c[0]))),
    Math.min(255, Math.max(0, Math.round(c[1]))),
    Math.min(255, Math.max(0, Math.round(c[2]))),
  ]);

  centers.sort((a, b) => {
    const lumA = 0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2];
    const lumB = 0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2];
    return lumB - lumA; // Lightest to darkest
  });

  // ImageTracer palette format
  const itPal = centers.map(c => ({ r: c[0], g: c[1], b: c[2], a: 255 }));

  // 4. Trace quantized layers into vector paths
  progress('Tracing organic vector contours...', 70);
  await new Promise(r => setTimeout(r, 20));

  const tracerOptions = {
    corsenabled: false,
    ltres: preset.ltres,
    qtres: preset.qtres,
    pathomit: preset.pathOmit,
    rightangleenhance: false,
    colorsampling: 0,
    numberofcolors: K,
    pal: itPal,
    scale: 1,
    roundcoords: 1,
    linefilter: true,
  };

  const traceData = ImageTracer.imagedataToTracedata(smoothedImgData, tracerOptions);

  // 5. Convert ImageTracer paths into ArtworkData regions
  progress('Optimizing geometry & placing number pins...', 85);
  await new Promise(r => setTimeout(r, 20));

  const artworkWidth = 800;
  const artworkHeight = 800;
  const margin = 20;
  const targetArea = artworkWidth - margin * 2;
  const scaleX = targetArea / W;
  const scaleY = targetArea / H;

  // Build Palette Items
  const palette = centers.map((c, idx) => ({
    number: idx + 1,
    hex: rgbToHex(c[0], c[1], c[2]),
    name: `Tone #${idx + 1}`,
    total_count: 0,
    filled_count: 0,
    is_completed: false,
  }));

  const regions = [];
  let regId = 0;

  // Process each color layer
  traceData.layers.forEach((layerPaths, colorIdx) => {
    if (colorIdx >= palette.length) return;
    const colorNum = colorIdx + 1;
    const colorHex = palette[colorIdx].hex;

    layerPaths.forEach(pathObj => {
      if (!pathObj.segments || pathObj.segments.length < 3) return;

      const polygon = [];
      pathObj.segments.forEach(seg => {
        const px = margin + seg.x1 * scaleX;
        const py = margin + seg.y1 * scaleY;
        polygon.push({ x: Math.round(px * 10) / 10, y: Math.round(py * 10) / 10 });

        // If quadratic curve, sample intermediate point for smooth curves
        if (seg.type === 'Q') {
          const midX = margin + (0.25 * seg.x1 + 0.5 * seg.x2 + 0.25 * seg.x3) * scaleX;
          const midY = margin + (0.25 * seg.y1 + 0.5 * seg.y2 + 0.25 * seg.y3) * scaleY;
          polygon.push({ x: Math.round(midX * 10) / 10, y: Math.round(midY * 10) / 10 });
        }
      });

      // Filter out degenerate or tiny speckles
      if (polygon.length < 3) return;
      const area = calculatePolygonArea(polygon);
      if (area < preset.minArea) return;

      const centroid = calculatePolygonCentroid(polygon);
      palette[colorIdx].total_count++;

      regions.push({
        id: regId++,
        number: colorNum,
        polygon,
        centroid: {
          x: Math.round(centroid.x * 10) / 10,
          y: Math.round(centroid.y * 10) / 10,
        },
        color_hex: colorHex,
        is_filled: false,
        fill_anim: 0.0,
      });
    });
  });

  // Filter out any empty palette colors that ended up with 0 regions
  const activePalette = palette.filter(p => p.total_count > 0);
  // Re-index palette numbers sequentially if any were dropped
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

  const artworkId = `custom_vector_${Date.now()}`;
  const artwork = {
    id: artworkId,
    title: options.title || 'Custom Photo Art',
    artist: 'My Photo Studio',
    category: 'imported',
    width: artworkWidth,
    height: artworkHeight,
    palette: activePalette,
    regions,
  };

  // 6. Generate crisp thumbnail preview Blob
  progress('Generating on-device thumbnail preview...', 95);
  const thumbnailBlob = await generateThumbnailBlob(artwork);

  progress('Complete!', 100);
  return { artwork, thumbnailBlob };
}

/**
 * Renders an ArtworkData object to a 280x200 canvas and exports as a PNG Blob.
 * @param {Object} artwork
 * @returns {Promise<Blob>}
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

  // Background white card
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, artwork.width, artwork.height);

  artwork.regions.forEach(reg => {
    if (!reg.polygon || reg.polygon.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(reg.polygon[0].x, reg.polygon[0].y);
    for (let i = 1; i < reg.polygon.length; i++) {
      ctx.lineTo(reg.polygon[i].x, reg.polygon[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = reg.color_hex;
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1.0;
    ctx.stroke();
  });

  ctx.restore();

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/png');
  });
}
