#!/usr/bin/env python3
"""Generate Paint-by-Number source images via OpenRouter (/api/v1/images/generations)."""

import argparse
import base64
import concurrent.futures
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_OUT_DIR = REPO_ROOT / "public" / "assets" / "paint_by_number"
MANIFEST_PATH = REPO_ROOT / "public" / "assets" / "converted" / "manifest.json"
CONVERT_SCRIPT = REPO_ROOT / "scripts" / "convert_artworks.py"
ENV_PATH = REPO_ROOT / ".env"
DEFAULT_MODEL = "meta/muse-image"
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp")
SNAKE_CASE_RE = re.compile(r"^[a-z0-9]+(?:_[a-z0-9]+)*$")

TIER_TARGETS = {
    "easy": {"regions": (80, 150), "colors": (10, 14)},
    "medium": {"regions": (150, 300), "colors": (14, 20)},
    "hard": {"regions": (300, 500), "colors": (18, 26)},
}

# Positive-framed modifiers (avoids pink-elephant negative keywords on endpoints without negative_prompt).
DIFFICULTY_MODIFIERS = {
    "easy": (
        "minimalist children's coloring-book style, large chunky bold shapes, "
        "10 to 14 distinct flat solid colors, minimal simple background, "
        "thick uniform solid black ink outlines (#000000) completely enclosing every shape"
    ),
    "medium": (
        "clean storybook vector illustration, balanced composition with broad "
        "easy-to-tap enclosed shapes, 14 to 20 vibrant flat solid colors, layered foreground and "
        "background with simple crisp ink-bordered 2-tone cel-shaded color blocks, simplified "
        "foliage and textures with zero tiny speckles"
    ),
    "hard": (
        "intricate stained-glass mosaic vector illustration, full-scene composition with "
        "multi-layered foliage, architectural or natural facets, and crisp ink-bordered cel-shaded "
        "color-blocking in 18 to 26 vibrant flat solid colors, every enclosed shape clearly "
        "separated and large enough to tap"
    ),
}


def validate_key(key: str) -> str:
    if not SNAKE_CASE_RE.match(key):
        raise ValueError(
            f"Invalid key {key!r}: must be lowercase snake_case (a-z, 0-9, single underscores)."
        )
    if key.endswith("_pbn"):
        raise ValueError(
            f"Invalid key {key!r}: omit trailing '_pbn' (scripts/convert_artworks.py strips it automatically)."
        )
    return key


def load_api_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if key:
        return key
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() == "OPENROUTER_API_KEY":
                return v.strip().strip('"').strip("'")
    raise RuntimeError("OPENROUTER_API_KEY not found in environment or .env")


def build_prompt(subject: str, tier: str, extra: str = "", raw_prompt: str = "") -> str:
    if raw_prompt.strip():
        return raw_prompt.strip()
    modifier = DIFFICULTY_MODIFIERS[tier]
    parts = [
        subject.strip(),
        "fully colored unnumbered flat vector coloring-book illustration",
        "uniform solid black ink outlines (#000000) with every shape completely closed",
        modifier,
        "strictly flat solid color fills with zero gradients, zero soft shading, and zero texture or noise",
        "completely unnumbered and text-free illustration with no printed numbers, no labels, and no color legend",
        "unframed floating composition centered with generous pure solid white (#FFFFFF) margin on all four edges and corners",
    ]
    if extra.strip():
        parts.append(extra.strip())
    return ", ".join(parts) + "."


def detect_image_ext(img_bytes: bytes, fallback: str = "png") -> str:
    if img_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if img_bytes.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if len(img_bytes) >= 12 and img_bytes[:4] == b"RIFF" and img_bytes[8:12] == b"WEBP":
        return "webp"
    return fallback


def extract_image_bytes(data: dict) -> tuple[bytes, str]:
    items = data.get("data") or []
    if items:
        item = items[0]
        if item.get("b64_json"):
            raw = base64.b64decode(item["b64_json"])
            return raw, detect_image_ext(raw, "png")
        url = item.get("url") or ""
        if url.startswith("data:"):
            header, b64 = url.split(",", 1)
            hint = "jpg" if ("jpeg" in header or "jpg" in header) else ("webp" if "webp" in header else "png")
            raw = base64.b64decode(b64)
            return raw, detect_image_ext(raw, hint)
        if url.startswith("http"):
            with urllib.request.urlopen(url, timeout=60) as r:
                ct = r.headers.get("Content-Type", "")
                hint = "jpg" if "jpeg" in ct else ("webp" if "webp" in ct else "png")
                raw = r.read()
                return raw, detect_image_ext(raw, hint)
    raise RuntimeError(f"Could not find image in OpenRouter response: {json.dumps(data)[:600]}")


def remove_sibling_extensions(out_dir: Path, key: str, keep_path: Path) -> list[Path]:
    removed = []
    for ext in IMAGE_EXTS:
        candidate = out_dir / f"{key}{ext}"
        if candidate != keep_path and candidate.exists():
            candidate.unlink()
            removed.append(candidate)
    return removed


def generate_image(
    subject: str,
    key: str,
    tier: str = "medium",
    model: str = DEFAULT_MODEL,
    out_dir: Path = DEFAULT_OUT_DIR,
    extra: str = "",
    raw_prompt: str = "",
    dry_run: bool = False,
) -> Path | None:
    validate_key(key)
    prompt = build_prompt(subject, tier, extra=extra, raw_prompt=raw_prompt)
    if dry_run:
        print(f"[DRY RUN] key={key} tier={tier} model={model}")
        print(f"  out_dir: {out_dir}")
        print(f"  prompt:  {prompt}")
        return None

    api_key = load_api_key()
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "model": model,
        "prompt": prompt,
        "n": 1,
        "size": "1024x1024",
    }
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/images/generations",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://tap-color.local",
            "X-Title": "Tap Color Artwork Generator",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        hint = ""
        if model != DEFAULT_MODEL:
            hint = (
                " (Note: /api/v1/images/generations only supports dedicated image models like "
                f"{DEFAULT_MODEL}, not chat-modality image models.)"
            )
        raise RuntimeError(f"HTTP {e.code} for {key}: {body[:600]}{hint}") from e

    img_bytes, ext = extract_image_bytes(data)
    out_path = out_dir / f"{key}.{ext}"
    out_path.write_bytes(img_bytes)
    removed = remove_sibling_extensions(out_dir, key, out_path)
    for stale in removed:
        print(f"Removed conflicting sibling asset: {stale}")
    return out_path


def verify_key(key: str, tier: str, pbn_only: bool = False) -> None:
    cmd = [sys.executable, str(CONVERT_SCRIPT), key]
    if pbn_only:
        cmd.append("--pbn-only")
    subprocess.run(cmd, check=True, cwd=str(REPO_ROOT))

    if not MANIFEST_PATH.exists():
        print(f"[WARN] {MANIFEST_PATH} not found after conversion.")
        return

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    entry = next((e for e in manifest if e.get("key") == key), None)
    if not entry or not entry.get("pbnVariants"):
        print(f"[WARN] No PBN variant found in manifest for {key}.")
        return

    v = entry["pbnVariants"][0]
    pieces = v["pieces"]
    colors = v["colors"]
    r_lo, r_hi = TIER_TARGETS[tier]["regions"]
    c_lo, c_hi = TIER_TARGETS[tier]["colors"]

    warnings = []
    if pieces < r_lo:
        warnings.append(f"regions={pieces} below {tier} target ({r_lo}-{r_hi})")
    elif pieces > r_hi:
        warnings.append(f"regions={pieces} above {tier} target ({r_lo}-{r_hi})")
    if colors < c_lo:
        warnings.append(f"colors={colors} below {tier} target ({c_lo}-{c_hi})")
    elif colors > c_hi:
        warnings.append(f"colors={colors} above {tier} target ({c_lo}-{c_hi})")
    if tier in ("easy", "medium") and colors >= 26:
        warnings.append("hit MAX_COLORS=26 ceiling (likely gradients or color noise)")

    status = "OK" if not warnings else "WARN"
    print(f"[{status}] {key} ({tier}): {pieces} regions, {colors} colors")
    for w in warnings:
        print(f"  - {w}")


def load_batch_items(batch_path: Path, default_tier: str, default_model: str) -> list[dict]:
    text = batch_path.read_text(encoding="utf-8").strip()
    if not text:
        raise ValueError(f"Batch file {batch_path} is empty.")
    if text.startswith("["):
        raw_items = json.loads(text)
    else:
        raw_items = [json.loads(line) for line in text.splitlines() if line.strip()]

    items = []
    for idx, item in enumerate(raw_items):
        if "key" not in item or ("subject" not in item and "raw_prompt" not in item):
            raise ValueError(f"Batch item #{idx} must include 'key' and 'subject' (or 'raw_prompt').")
        tier = item.get("tier", default_tier)
        if tier not in DIFFICULTY_MODIFIERS:
            raise ValueError(f"Batch item #{idx} has invalid tier {tier!r}.")
        items.append({
            "key": validate_key(item["key"]),
            "subject": item.get("subject", ""),
            "tier": tier,
            "model": item.get("model", default_model),
            "extra": item.get("extra", ""),
            "raw_prompt": item.get("raw_prompt", ""),
        })
    return items


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate Paint-by-Number source images via OpenRouter."
    )
    parser.add_argument("key", nargs="?", help="Lowercase snake_case output key (e.g., winter_penguin)")
    parser.add_argument("subject", nargs="?", help="Subject description to insert into the PBN prompt template")
    parser.add_argument(
        "--tier",
        choices=["easy", "medium", "hard"],
        default="medium",
        help="Difficulty tier (default: medium)",
    )
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"OpenRouter image model (default: {DEFAULT_MODEL})")
    parser.add_argument("--extra", default="", help="Additional comma-separated prompt instructions appended to the template")
    parser.add_argument("--raw-prompt", default="", help="Use this exact prompt instead of the built-in template")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR, help=f"Output directory (default: {DEFAULT_OUT_DIR})")
    parser.add_argument("--batch", type=Path, help="JSON array or JSONL file of {key, subject, tier?, extra?, model?} jobs")
    parser.add_argument("--jobs", type=int, default=3, help="Concurrent generation workers for --batch (default: 3)")
    parser.add_argument("--dry-run", action="store_true", help="Print resolved prompt(s) without calling OpenRouter")
    parser.add_argument("--verify", action="store_true", help="Run scripts/convert_artworks.py <key> after generation and check tier targets")
    parser.add_argument("--pbn-only", action="store_true", help="Pass --pbn-only when running --verify (faster for existing keys)")
    args = parser.parse_args()

    if args.batch:
        items = load_batch_items(args.batch, args.tier, args.model)
        if args.dry_run:
            for item in items:
                generate_image(
                    item["subject"],
                    item["key"],
                    tier=item["tier"],
                    model=item["model"],
                    out_dir=args.out_dir,
                    extra=item["extra"],
                    raw_prompt=item["raw_prompt"],
                    dry_run=True,
                )
            return

        succeeded: list[dict] = []
        failed: list[tuple[str, str]] = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
            futs = {
                pool.submit(
                    generate_image,
                    item["subject"],
                    item["key"],
                    item["tier"],
                    item["model"],
                    args.out_dir,
                    item["extra"],
                    item["raw_prompt"],
                    False,
                ): item
                for item in items
            }
            for fut in concurrent.futures.as_completed(futs):
                item = futs[fut]
                try:
                    out_path = fut.result()
                    assert out_path is not None
                    print(f"Saved {out_path} ({out_path.stat().st_size} bytes)")
                    succeeded.append(item)
                except Exception as exc:
                    print(f"[ERROR] {item['key']}: {exc}", file=sys.stderr)
                    failed.append((item["key"], str(exc)))

        if args.verify:
            # Run verification sequentially so manifest.json writes never race.
            for item in succeeded:
                verify_key(item["key"], item["tier"], pbn_only=args.pbn_only)

        if failed:
            print(f"\nBatch finished with {len(failed)} failure(s) out of {len(items)}.", file=sys.stderr)
            sys.exit(1)
        return

    if not args.key or (not args.subject and not args.raw_prompt):
        parser.error("Provide <key> and <subject> (or --raw-prompt), or use --batch <file>.")

    out_path = generate_image(
        args.subject or "",
        args.key,
        tier=args.tier,
        model=args.model,
        out_dir=args.out_dir,
        extra=args.extra,
        raw_prompt=args.raw_prompt,
        dry_run=args.dry_run,
    )
    if out_path is not None:
        print(f"Saved {out_path} ({out_path.stat().st_size} bytes)")
        if args.verify:
            verify_key(args.key, args.tier, pbn_only=args.pbn_only)


if __name__ == "__main__":
    main()
