#!/usr/bin/env node
/**
 * Tap Color - CLI Paint-by-Number Converter
 * Uses the shared open-source paintbynumbersgenerator engine in src/vectorizer.js
 */

import fs from 'fs';
import { buildArtworkFromImageData, COMPLEXITY_PRESETS } from '../src/vectorizer.js';

const args = process.argv.slice(2);
if (args.length < 6) {
  console.error('Usage: node scripts/convert_pbn.mjs <raw_rgba_bin> <W> <complexity> <output_id> <title> <artist> <out_json>');
  process.exit(1);
}

const [rawBinPath, wStr, complexity, outputId, title, artist, outJsonPath] = args;
const W = parseInt(wStr, 10);
const preset = COMPLEXITY_PRESETS[complexity] || COMPLEXITY_PRESETS.balanced;

const rgbaBuf = fs.readFileSync(rawBinPath);
const rawImgData = {
  width: W,
  height: W,
  data: new Uint8ClampedArray(rgbaBuf.buffer, rgbaBuf.byteOffset, rgbaBuf.byteLength),
};

const artwork = await buildArtworkFromImageData(rawImgData, {
  id: outputId,
  title,
  artist,
  category: 'classic',
  complexity,
  customPaletteSize: preset.paletteSize,
  minPixels: preset.minPixels,
});

fs.writeFileSync(outJsonPath, JSON.stringify(artwork));

