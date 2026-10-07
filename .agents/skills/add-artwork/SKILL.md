---
name: add-artwork
description: >-
  Step-by-step runbook for generating, converting, and registering new artworks into the
  Tap Color gallery and Make from Photo presets. Use this skill whenever the user asks to
  add new pictures, drawings, paintings, themes, or graphics to the library.
---

# Adding Artwork to Tap Color Studio

This guide outlines the end-to-end workflow for adding new high-quality artworks to Tap Color. Every artwork in Tap Color exists as both **Diamond Painting** (faceted gemstone mosaic grids) and **Paint by Number** (vector contour regions with closed boundaries).

---

## Architecture Overview

```text
 assets/<name>.jpeg                   (Original image source)
        │
        ▼
 scripts/convert_artworks.py         (Auto-framing, K-Means++ clustering & watershed vectorizer)
        │
        ├─► assets/converted/<id>.json           (Region geometries, labels, color palette)
        ├─► assets/converted/<id>_thumb.png      (Optimized gallery thumbnail)
        └─► assets/converted/manifest.json       (Master index of all artworks & variants)
        │
        ▼
 app.js (this.artworksMeta)           (Frontend gallery & game configuration)
 index.html (Make from Photo preset)  (Optional quick-load preset button)
```

---

## 1. Artwork Source & Aesthetic Guidelines

For optimal vectorization and gameplay satisfaction, source images should adhere to these standards:

- **Style**: Vector graphic, clean sticker art, or adult coloring book base with bold, clean, closed outlines.
- **Regions**: Flat or gentle tonal shading rather than noisy photographic grain or heavy stippling.
- **Background**: Solid clean white (`#FFFFFF`) or transparent background. The converter's `detect_content_bounds()` algorithm automatically trims excess whitespace, preserves the native aspect ratio, and centers the artwork.
- **Resolution**: Ideally 1024×1024 (or 1024×572 for 16:9 banner subjects).
- **Naming**: Use lowercase alphanumeric characters and underscores/hyphens (e.g. `country_barn.jpeg`, `fluffy-cow-3.jpeg`).

> [!TIP]
> If generating base images using AI or image generators, include: `"clean vector graphics, bold dark outlines, vibrant solid flat colors, white background, sticker style, coloring book art"`.

---

## 2. Step-by-Step Procedure

### Step 1: Place Original Image in `assets/`

Copy or generate the source image into the project `assets/` directory:
```bash
# Example
assets/cottage_garden.jpeg
```

---

### Step 2: Register in `scripts/convert_artworks.py`

Open [scripts/convert_artworks.py](file:///home/jmayer/Dev/Tap-Color/scripts/convert_artworks.py) and add your artwork object to the `catalog` list in `main()`:

```python
{
    "key": "cottage_garden",
    "file": "cottage_garden.jpeg",
    "title": "Cottage Garden",
    "artist": "Homestead Florals",
    "desc": "Blooming country cottage flowerbeds with stone pathway and cozy picket fence"
}
```

---

### Step 3: Run the Conversion Pipeline

Run the converter. You can convert **just your new artwork** by passing its key, or run the entire catalog:

```bash
# Convert only the new artwork (fast, merges cleanly into manifest.json):
python3 scripts/convert_artworks.py cottage_garden

# Or re-generate all catalog artworks:
python3 scripts/convert_artworks.py
```

#### What the script creates:
For each artwork, 6 variants are generated in `assets/converted/`:
1. **Diamond Painting (3 grids)**:
   - Cozy: `80×80` grid (6,400 drills, ~18 colors)
   - Standard: `120×120` grid (14,400 drills, ~26 colors)
   - Masterpiece: `160×160` grid (25,600 drills, ~36 colors)
2. **Paint by Number (3 complexities)**:
   - Detailed: ~150–350 regions, ~15 colors
   - Intricate: ~300–700 regions, ~24 colors
   - Masterpiece: ~700–1,500 regions, ~32 colors
3. **Optimized Thumbnails**: `<key>_<mode>_<res>_thumb.png`
4. **Manifest Entry**: Appended/updated in `assets/converted/manifest.json`.

---

### Step 4: Register in `app.js` (`this.artworksMeta`)

Open [assets/converted/manifest.json](file:///home/jmayer/Dev/Tap-Color/assets/converted/manifest.json) to inspect the generated `pieces` and `colors` counts for your new artwork.

Then open [app.js](file:///home/jmayer/Dev/Tap-Color/app.js) and add two entries to `this.artworksMeta`:

#### 1. Diamond Painting Entry (in the Diamond section):
```javascript
{
  id: 'cottage_garden_diamond',
  title: 'Cottage Garden',
  artist: 'Homestead Florals',
  category: 'diamond',
  pieces: 14400,
  desc: 'Blooming country cottage flowerbeds with stone pathway and cozy picket fence',
  defaultVariantId: 'cottage_garden_diamond_120',
  selectedVariantId: 'cottage_garden_diamond_120',
  originalAsset: 'assets/cottage_garden.jpeg',
  thumbnailUrl: 'assets/converted/cottage_garden_diamond_120_thumb.png',
  variants: [
    { id: 'cottage_garden_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/cottage_garden_diamond_80.json', thumbnailUrl: 'assets/converted/cottage_garden_diamond_80_thumb.png' },
    { id: 'cottage_garden_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/cottage_garden_diamond_120.json', thumbnailUrl: 'assets/converted/cottage_garden_diamond_120_thumb.png' },
    { id: 'cottage_garden_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/cottage_garden_diamond_160.json', thumbnailUrl: 'assets/converted/cottage_garden_diamond_160_thumb.png' },
  ],
},
```

#### 2. Paint by Number Entry (in the Classic/PBN section):
```javascript
{
  id: 'cottage_garden_pbn',
  title: 'Cottage Garden',
  artist: 'Homestead Florals',
  category: 'classic',
  pieces: 480, // Use the Intricate piece count from manifest.json
  desc: 'Blooming country cottage flowerbeds with stone pathway and cozy picket fence',
  defaultVariantId: 'cottage_garden_pbn_intricate',
  selectedVariantId: 'cottage_garden_pbn_intricate',
  originalAsset: 'assets/cottage_garden.jpeg',
  thumbnailUrl: 'assets/converted/cottage_garden_pbn_intricate_thumb.png',
  variants: [
    { id: 'cottage_garden_pbn_detailed', label: 'Detailed', name: 'Detailed', pieces: 210, colors: 15, complexity: 'detailed', jsonFile: 'assets/converted/cottage_garden_pbn_detailed.json', thumbnailUrl: 'assets/converted/cottage_garden_pbn_detailed_thumb.png' },
    { id: 'cottage_garden_pbn_intricate', label: 'Intricate', name: 'Intricate', pieces: 480, colors: 24, complexity: 'intricate', jsonFile: 'assets/converted/cottage_garden_pbn_intricate.json', thumbnailUrl: 'assets/converted/cottage_garden_pbn_intricate_thumb.png' },
    { id: 'cottage_garden_pbn_masterpiece', label: 'Masterpiece', name: 'Masterpiece', pieces: 890, colors: 32, complexity: 'masterpiece', jsonFile: 'assets/converted/cottage_garden_pbn_masterpiece.json', thumbnailUrl: 'assets/converted/cottage_garden_pbn_masterpiece_thumb.png' },
  ],
},
```

---

### Step 5: (Optional) Add Preset Button to "Make from Photo" Studio

If you want the new artwork available as a quick-select preset in the **Make from Photo** modal tab, add a button to the `.preset-pill-grid` inside [index.html](file:///home/jmayer/Dev/Tap-Color/index.html):

```html
<button type="button" class="btn-preset" data-key="cottage_garden" data-asset="assets/cottage_garden.jpeg" data-title="Cottage Garden">
  🌸 Cottage Garden
</button>
```

---

## 3. Verification Checklist

After adding new artworks:

1. **Verify No Console Errors**:
   - Check the browser console at `http://localhost:5173/` for any missing JSON files or 404 images.
2. **Verify Gallery Cards**:
   - Open the **Gallery** (`#btn-gallery`).
   - Switch between **🎨 Paint by Number** and **💎 Diamond Painting** tabs.
   - Verify the thumbnail image is sharply framed, properly centered, and not stretched.
   - Click each resolution chip (`Detailed`, `Intricate`, `Masterpiece` or `80×80`, `120×120`, `160×160`) to verify variant switching.
3. **Verify Gameplay**:
   - Click "Start Coloring" on the new artwork.
   - Verify all numbered regions are clearly readable.
   - Select palette swatches and tap matching regions to ensure fills render seamlessly without line bleeding or gaps.
4. **Verify Custom Studio**:
   - Open "Make from Photo", click the new preset button, toggle between Paint by Number and Diamond Painting, and confirm instant conversion.

---

## 4. Operational Constraints

- **CRITICAL**: Do **NOT** execute `npm run deploy` unless explicitly instructed by the user.
