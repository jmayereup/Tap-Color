---
name: generate-pbn-image
description: >-
  Craft prompts and generate Paint-by-Number-friendly source images for Tap Color,
  validating them against the build-time line-preserving PBN converter before placing
  them in public/assets/paint_by_number/. Use this skill whenever the user asks to
  generate, design, or prepare new Paint-by-Number illustrations or prompts for the
  asset folder.
---

# Generating Paint-by-Number-Friendly Images

This skill guides generating source images tailored to Tap Color's build-time Paint-by-Number pipeline (`scripts/convert_artworks.py` → `scripts/convert_pbn.mjs`) using [generate_pbn_image.py](./scripts/generate_pbn_image.py), so every asset placed in `public/assets/paint_by_number/` converts cleanly with crisp ink outlines, well-sized tap regions, and a clean palette.

---

## 1. Converter Constraints (Why Images Fail)

During `npm run build` (`npm run build:assets`), `scripts/convert_artworks.py` discovers every image in `public/assets/paint_by_number/`, auto-trims white borders, frames it into `800×800` (with a `24px` margin), and converts it via `scripts/convert_pbn.mjs`:

1. **Ink Linework Detection**:
   - Solid ink: `lum < 58 && chroma < 45`; thin dark ridges: `lum < 112 && chroma < 72` with `localMean - lum > 28`. Regions expand up to `UNDER_INK_PX = 3` pixels behind detected ink.
   - **Implication**: Outlines **must** be solid dark charcoal/black (`#000000`–`#282828`) and thick enough to survive resizing to `800×800`. Colored outlines (blue, brown, pastel) are not detected as ink and break region boundaries.
2. **Auto-Trim & Exterior White Background Flood-Fill**:
   - `load_framed_rgb_grid` checks all 4 corners for near-white (`RGB > 240`) to auto-crop margins; `convert_pbn.mjs` then 4-connected flood-fills from all four edges through near-white pixels (`RGB > 235`) to strip the exterior background.
   - **Implication**: The outer background must be **pure solid white (`#FFFFFF`)** across all four edges and corners, with no frame/border, and the subject's outer perimeter must have **fully closed black ink outlines**. Any gap lets the white flood-fill leak inside; any off-white tint (`≤ 235`) turns the background into a giant paintable region.
3. **Lineless Color-Jump Splitting (`COLOR_JUMP_SQ = 38²`)**:
   - Adjacent pixels with Euclidean RGB distance `> 38` split into separate regions even without ink lines.
   - **Implication**: Gradients, soft shadows, painterly textures, and noise fragment surfaces into hundreds of noisy slivers. Use **strictly flat solid color fills**; add depth only via **ink-bordered cel-shaded color blocks**.
4. **Minimum Region Size (`MIN_REGION_PIXELS = 42`) & Eye Sparkles**:
   - Regions smaller than `42` pixels at `800×800` (~6.5×6.5 px, or ~8–10 px wide at `1024×1024`) are dropped/absorbed.
   - Tiny bright white dots (`lum > 190`) completely surrounded by ink (e.g., eye sparkles) are automatically baked into `_lines.png`, so eye highlights work cleanly when enclosed in solid black eyes.
   - **Implication**: Avoid grass blades, fur strands, eyelashes, flower stamens, or confetti speckles. Simplify foliage, fur, and feathers into **chunky, scalloped, or layered color blocks**.
5. **Palette Merging & Hard Cap (`MAX_COLORS = 26`)**:
   - Regions are merged in CIELAB (`MERGE_DELTA_E = 11.5`) and hard-capped at **`26` colors**.
   - **Implication**: Hitting `colors = 26` on an Easy or Medium illustration is a saturation signal indicating unintended gradients or color noise.

---

## 2. Difficulty Tiers (Default: Medium)

Choose a difficulty tier based on the user's request; **default to `medium`** when unspecified:

| Tier | Target Regions | Target Colors | Visual & Structural Style |
| :--- | :--- | :--- | :--- |
| **Easy** | `80–150` | `10–14` | Bold, chunky, beginner-friendly coloring-book shapes; single main subject with minimal background elements and simple flat fills. |
| **Medium** *(Default)* | `150–300` | `14–20` | Clean storybook vector illustration with broad, easy-to-tap shapes, layered foreground/background elements, and simple ink-bordered 2-tone cel-shading (avoid "stained-glass" cues here—they overshoot to 400–800 regions). |
| **Hard** | `300–500` | `18–26` | Intricate stained-glass / mosaic complexity with full-scene detail, multi-layered foliage/feathers/architecture, and faceted ink-bordered color-blocking. |

---

## 3. Prompt Crafting Guidelines

[generate_pbn_image.py](./scripts/generate_pbn_image.py) is the single source of truth for the base prompt and tier modifiers. It uses **positive framing** and asks for a **fully colored, unnumbered, text-free flat vector coloring-book illustration**—combining `"coloring-book"` (for thick, closed black ink outlines on every element including clouds and water) with `"flat vector"` (for clean solid fills without paper/crayon texture), while avoiding the literal phrase `"paint-by-number"` so models don't bake printed numbers (`1, 2, 3...`) or a color legend bar into `_lines.png`. Tap Color renders region numbers dynamically at runtime.

### Subject Simplification Tips
- **Reaching Medium/Hard region counts cleanly**: Describe **structured sub-regions** (e.g., roof shingles, stone blocks, layered flower petals, scalloped tree canopies, terraced hills, stylized clouds, and ink-bordered shadow/highlight blocks) rather than fine textures.
- **Animals (fur/feathers)**: Describe *"chunky, ink-bordered cel-shaded color blocks for fur/plumage"* instead of *"fluffy detailed fur strands"*.
- **Plants/Florals**: Describe *"bold layered petals, broad leaves, and clustered blooms"* instead of *"tiny wildflower speckles and grass blades"*.
- **Skies/Water/Landscapes**: Describe *"stylized banded clouds, terraced hills, and rippled water shapes"* enclosed inside a clean outer black silhouette or arched/circular medallion so the pure white outer margin stays separate.

---

## 4. Step-by-Step Workflow

### Step 1: Generate & Visually Inspect
1. Generate a `1024×1024` (1:1) image via OpenRouter using [generate_pbn_image.py](./scripts/generate_pbn_image.py) (requires `OPENROUTER_API_KEY` in `.env` or environment, and external network access):
   ```bash
   python3 .agents/skills/generate-pbn-image/scripts/generate_pbn_image.py <snake_case_name> "<SUBJECT>" --tier medium --verify
   ```
   - **Common flags**:
     - `--tier easy|medium|hard` (default: `medium`)
     - `--extra "<adjustments>"` to append targeted fixes on retries (e.g., thicker outlines or simpler background)
     - `--raw-prompt "<full prompt>"` to bypass the built-in template
     - `--dry-run` to preview the resolved prompt without calling OpenRouter
     - `--verify` to immediately run `scripts/convert_artworks.py <key>` and check region/color counts against the tier target (combine with `--pbn-only` when iterating on an existing key)
     - `--tags "<tag1,tag2>"` to assign gallery category tags (e.g., `--tags "christian,stained-glass"`) when running `--verify`
     - `--model <provider/model>` (defaults to `meta/muse-image`; note that `/api/v1/images/generations` only supports dedicated image models, not chat-modality image models)
   - **Batch generation** (for themed sets): pass `--batch <jobs.json|jobs.jsonl>` (each entry: `{"key", "subject", "tier"?, "extra"?, "model"?, "tags"?}`) with `--jobs 3` (generation runs concurrently; `--verify` runs sequentially so `manifest.json` never races).
2. **Visually inspect** the saved image by opening it with `read_file`:
   - Pure `#FFFFFF` outer background across all 4 edges/corners with generous margin and no border/frame.
   - Continuous, closed black ink outlines with no gaps (especially around white/light elements like snow, clouds, or white petals).
   - Flat solid fills with no soft gradients or tiny confetti speckles.

### Step 2: Asset Placement, Category Tags & Optional Metadata
- The script saves directly to `public/assets/paint_by_number/<snake_case_name>.<ext>` (sniffing actual image magic bytes and removing any stale conflicting extension for the same key).
- `public/assets/converted/` is gitignored; only source images in `public/assets/paint_by_number/` (and optional metadata edits) are committed.
- `scripts/convert_artworks.py` automatically discovers all images in `public/assets/paint_by_number/`, derives the key (stripping any trailing `_pbn`), generates both PBN and 3 Diamond Art variants, assigns category `tags`, and orders `manifest.json` newest-first by `addedAt`.
- **Category Tags**: Check the existing categories in `infer_tags` in `scripts/convert_artworks.py` (`animals`, `anime`, `christian`, `christmas`, `dia-de-los-muertos`, `family`, `holidays`, `mandala`, `native-american`, `nature`, `stained-glass`, `thai`, `thanksgiving`).
  - **Reuse an existing category** whenever the new artwork fits (pass `--tags` or use a matching key prefix).
  - **Create a new category** only when introducing a distinct new theme: pass `--tags "<new-kebab-tag>"` with `--verify`, and add the rule to `infer_tags` in `scripts/convert_artworks.py` (plus this list) so full rebuilds preserve it.
- *(Optional)* To set a custom title, artist, description, or tags, add an entry to `METADATA_BY_KEY` in `scripts/convert_artworks.py`.

### Step 3: Verify Build-Time Conversion
If you did not pass `--verify` in Step 1, run the converter for the new artwork key:
```bash
python3 scripts/convert_artworks.py <key>
```
*(When re-running after regenerating an existing key, append `--pbn-only` to skip rebuilding the 3 Diamond Art variants.)*

Inspect the terminal output and open the converted previews in `public/assets/converted/` using `read_file`:
- **Region & Color Counts**: Check against the tier table in Section 2. Flag `regions > 550` or `colors == 26` on Easy/Medium.
- **Line Art (`public/assets/converted/<key>_pbn_lines.png`)**: Verify outlines are crisp, dark, and continuous with no broken edges.
- **Thumbnail (`public/assets/converted/<key>_pbn_thumb.png`)**: Verify clean centering, balanced colors, and zero white background bleed into interior shapes.

### Step 4: Troubleshooting Failed Conversions

| Symptom | Likely Cause | Fix |
| :--- | :--- | :--- |
| Regions `> 400–550` on Medium, or `colors == 26` | Soft shading / gradients triggering `COLOR_JUMP_SQ`, or overly dense foliage/facets | Regenerate with `--extra "simpler broad shapes, fewer small background details, strictly flat solid fills with zero shading"` (or drop to `--tier easy` for busy scenes). |
| Regions `< 80` | Subject too sparse or thick merged blocks | Add structured sub-elements (petals, planks, tiles, layered hills, 2-tone ink-bordered color blocks) to `<SUBJECT>`. |
| White bleed into interior shapes | Gap in outer black outline, or unbordered white shape (snow, clouds, white fur) touching the background | Regenerate with `--extra "thick continuous closed black ink outline around the entire outer silhouette and all white shapes"`. |
| Outer background became a giant paintable region | Background tinted off-white (`RGB ≤ 235`), or an outer frame/border blocked edge flood-fill | Regenerate with `--extra "pure bright white (#FFFFFF) empty background all the way to all four corners, unframed floating vignette"`. |
| Missing or faint interior lines in `_lines.png` | Colored or thin gray outlines failed ink luminance/chroma thresholds | Regenerate with `--extra "bold uniform pure black (#000000) ink outlines on every detail"`. |
| Printed numbers, text, or color legend baked into `_lines.png` | Model generated a literal PBN worksheet with numbers/key | Regenerate with `--extra "clean blank unnumbered illustration with zero text, zero printed numbers, and zero color legend"` (and avoid `"paint-by-number"` in `<SUBJECT>`). |

---

## 5. Operational Constraints
- **CRITICAL**: Do **NOT** execute `npm run deploy` without asking for and receiving explicit user confirmation.
