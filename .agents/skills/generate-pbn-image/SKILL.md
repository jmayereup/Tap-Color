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

This skill guides generating source images specifically tailored to Tap Color's build-time Paint-by-Number pipeline (`scripts/convert_artworks.py` → `scripts/convert_pbn.mjs`), so every asset placed in `public/assets/paint_by_number/` converts cleanly with crisp ink outlines, well-sized tap regions, and a clean palette.

---

## 1. Why Images Fail (Converter Constraints)

During `npm run build` (`npm run build:assets`), `scripts/convert_artworks.py` discovers every image in `public/assets/paint_by_number/` and converts it at `800×800` (with a `24px` margin) via `scripts/convert_pbn.mjs`:

1. **Ink Linework Detection**:
   - The converter extracts dark, low-chroma pixels as the permanent ink overlay (`lum < 58 && chroma < 45` for solid ink, or `lum < 112 && chroma < 72` with `localMean - lum > 28` for thin dark ridges).
   - **Implication**: Outlines **must** be solid dark charcoal/black (`#000000`–`#282828`). Colored outlines (blue, brown, pastel) will not be detected as ink and will break region boundaries.
2. **Closed Contours & White Background Flood-Fill**:
   - The converter flood-fills 4-connected from all four image edges through near-white pixels (`RGB > 232`) to strip the outer background.
   - **Implication**: The outer perimeter of the subject must have **fully closed dark ink outlines**, and the background must be **pure solid white (`#FFFFFF`)** with the subject centered and clear of the edges. Any gap in an outer outline lets the background flood-fill leak into the illustration.
3. **Minimum Region Size (`MIN_REGION_PIXELS = 42`)**:
   - Regions smaller than `42` pixels at `800×800` (~6.5×6.5 px, or ~8–10 px wide at `1024×1024`) are dropped/absorbed.
   - **Implication**: Avoid tiny dots, speckles, grass blades, fur strands, eyelashes, flower stamens, or thin stems. Simplify foliage, fur, and feathers into **large, chunky, scalloped or layered color blocks**.
4. **Flat Color Clustering**:
   - Gradients, soft shadows, painterly textures, and noise fragment regions into noisy slivers or bloated palettes.
   - **Implication**: Use **distinct, flat cel-shaded colors** (10–26 depending on difficulty) with zero gradients. To add depth in Medium/Hard tiers, split surfaces into **ink-bordered cel-shaded highlight/midtone/shadow facets** rather than soft shading. Avoid near-black fills (mistaken for ink lines) and near-white fills on unbordered edges.

---

## 2. Difficulty Tiers (Default: Medium)

Choose a difficulty tier based on the user's request; **default to `Medium`** when unspecified:

| Tier | Target Regions | Target Colors | Visual & Structural Style |
| :--- | :--- | :--- | :--- |
| **Easy** | `80–150` | `10–14` | Bold, chunky, beginner-friendly shapes; single main subject with minimal background elements and simple flat fills. |
| **Medium** *(Default)* | `150–300` | `14–20` | Balanced, richly composed scene with layered foreground/background elements, distinct sub-shapes (petals, planks, tiles, clouds), and crisp ink-bordered 2-tone cel-shading. |
| **Hard** | `300–500` | `18–26` | Intricate stained-glass / mosaic complexity with full-scene detail, multi-layered foliage/feathers/architecture, and faceted cel-shaded color-blocking—while keeping every region `≥ 8–10px` wide. |

---

## 3. Prompt Template & OpenRouter Generation

Use **OpenRouter** (default model: `meta/muse-image` via `https://openrouter.ai/api/v1/images/generations`) with `OPENROUTER_API_KEY` configured in `.env` at the repo root (or in the environment). Combine the **Base Prompt** with the **Difficulty Modifier** for the chosen tier (defaulting to **Medium**):

### Base Prompt
```text
[SUBJECT], flat vector paint-by-number illustration, uniform solid black ink outlines
(#000000) with every shape completely closed, [DIFFICULTY_MODIFIER], zero gradients,
zero soft shading, zero texture or noise, centered composition with generous margin
on a pure solid white (#FFFFFF) background.
```

### Difficulty Modifiers (`[DIFFICULTY_MODIFIER]`)
- **Easy**:
  `minimalist children's coloring-book simplicity, large chunky simple regions (minimum 12px wide), 10 to 14 bold distinct flat solid colors, minimal background elements`
- **Medium (Default)**:
  `richly detailed stained-glass / cel-shaded vector style, 150 to 300 distinct enclosed regions (minimum 10px wide), 14 to 20 vibrant flat solid colors, layered foreground and background elements with crisp ink-bordered 2-tone color-blocking facets`
- **Hard**:
  `intricate mosaic-like paint-by-number illustration, 300 to 500 distinct enclosed regions (minimum 8px wide), 18 to 26 vibrant flat solid colors, full-scene composition with multi-layered foliage, architectural or natural facets, and crisp ink-bordered cel-shaded color-blocking`

### Avoid / Negative Prompt
```text
gradients, soft shadows, painterly texture, watercolor, film grain, noise,
colored outlines, broken lines, open contours, photorealistic, 3D render,
tiny confetti speckles, micro-dots, hairline strands, hatching, crosshatching,
text, watermark, frame, border
```

### Subject Simplification Tips
- **Reaching Medium/Hard region counts cleanly**: Add **structured sub-regions** (e.g., individual roof shingles, brick/stone blocks, layered flower petals, scalloped tree canopies, terraced hills, stylized clouds, and ink-bordered shadow/highlight facets) rather than noisy texture or tiny dots.
- **Animals (fur/feathers)**: Describe *"layered, ink-bordered cel-shaded color facets for fur/plumage"* instead of *"fluffy detailed fur strands"*.
- **Plants/Florals**: Describe *"abundant layered petals, broad leaves, and clustered blooms"* instead of *"tiny wildflower speckles and grass blades"*.
- **Skies/Water/Landscapes**: Describe *"stylized banded clouds, terraced hills, and rippled water facets"* bounded by closed black ink lines inside a clean outer silhouette or arched/circular frame so the white outer background stays separate.

---

## 4. Step-by-Step Workflow

### Step 1: Generate & Inspect the Image
1. Generate a `1024×1024` (1:1) image via OpenRouter using the skill's helper script (requires `OPENROUTER_API_KEY` in `.env` or environment, and external network access):
   ```bash
   python3 .agents/skills/generate-pbn-image/scripts/generate_pbn_image.py <snake_case_name> "<SUBJECT>" --tier medium
   ```
   - Use `--tier easy`, `--tier medium` (default), or `--tier hard`.
   - Override the OpenRouter image model with `--model <provider/model>` (defaults to `meta/muse-image`).
   - *(Note: Dedicated image models like `meta/muse-image` use OpenRouter's `/api/v1/images/generations` endpoint, not `/api/v1/chat/completions`.)*
2. Visually inspect the generated image against these checks:
   - Pure `#FFFFFF` outer background with clear margin around the subject.
   - Continuous, closed black ink outlines with no gaps (especially around white/light elements like flower petals or snow so they don't merge with adjacent regions).
   - No tiny confetti/speckle regions or soft gradients.
   - If any check fails, regenerate with stronger outline/simplification wording before converting.

### Step 2: Verify Asset Placement in `public/assets/paint_by_number/`
The helper script saves directly to `public/assets/paint_by_number/<snake_case_name>.<ext>` (using lowercase `snake_case` naming):
```text
public/assets/paint_by_number/<snake_case_name>.png
```
> [!NOTE]
> `scripts/convert_artworks.py` automatically discovers all images in `public/assets/paint_by_number/`, derives the artwork key from the filename (stripping any trailing `_pbn`), and auto-generates a title unless an override exists in `METADATA_BY_KEY`.

*(Optional)* If you want a custom title, artist, or description, add an entry to `METADATA_BY_KEY` in `scripts/convert_artworks.py`.

### Step 3: Verify Build-Time Conversion
Run the converter for just the new artwork key to verify it converts cleanly before committing:
```bash
python3 scripts/convert_artworks.py <key>
```
Check the terminal output and generated files in `public/assets/converted/`:
- **Region & Color Count**: Verify the counts match your target tier:
  - **Easy**: `~80–150` regions, `10–14` colors
  - **Medium (Default)**: `~150–300` regions, `14–20` colors
  - **Hard**: `~300–500` regions, `18–26` colors
  *(If regions exceed `~550` or colors exceed `28`, check for accidental gradients or noisy micro-regions.)*
- **Line Art (`<key>_pbn_lines.png`)**: Open and verify outlines are crisp, continuous, and dark, with no missing edges.
- **Thumbnail (`<key>_pbn_thumb.png`)**: Verify the subject is cleanly centered, properly framed, and has no white background bleed into interior shapes.

---

## 5. Operational Constraints
- **CRITICAL**: Do **NOT** execute `npm run deploy` without asking for and receiving explicit user confirmation.
