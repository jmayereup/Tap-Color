#!/usr/bin/env python3
"""Generate Paint-by-Number source images via OpenRouter (/api/v1/images/generations)."""

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_OUT_DIR = REPO_ROOT / "public" / "assets" / "paint_by_number"
ENV_PATH = REPO_ROOT / ".env"
DEFAULT_MODEL = "meta/muse-image"

DIFFICULTY_MODIFIERS = {
    "easy": (
        "minimalist children's coloring-book simplicity, large chunky simple regions "
        "(minimum 12px wide), 80 to 150 total regions, 10 to 14 bold distinct flat solid colors, "
        "minimal background elements, EVERY petal, leaf, and shape completely enclosed by thick "
        "solid black ink outlines (#000000)"
    ),
    "medium": (
        "richly detailed stained-glass / cel-shaded vector style, 150 to 300 distinct enclosed "
        "regions (minimum 10px wide), 14 to 20 vibrant flat solid colors, layered foreground and "
        "background elements with crisp ink-bordered 2-tone color-blocking facets"
    ),
    "hard": (
        "intricate mosaic-like paint-by-number illustration, 300 to 500 distinct enclosed regions "
        "(minimum 8px wide), 18 to 26 vibrant flat solid colors, full-scene composition with "
        "multi-layered foliage, architectural or natural facets, and crisp ink-bordered cel-shaded "
        "color-blocking"
    ),
}

NEGATIVE_PROMPT = (
    "gradients, soft shadows, painterly texture, watercolor, film grain, noise, "
    "colored outlines, broken lines, open contours, photorealistic, 3D render, "
    "tiny confetti speckles, micro-dots, hairline strands, hatching, crosshatching, "
    "text, watermark, frame, border"
)


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


def build_prompt(subject: str, tier: str) -> str:
    modifier = DIFFICULTY_MODIFIERS[tier]
    return (
        f"{subject}, flat vector paint-by-number illustration, uniform solid black ink outlines "
        f"(#000000) with every shape completely closed, {modifier}, zero gradients, zero soft "
        "shading, zero texture or noise, centered composition with generous margin on a pure "
        f"solid white (#FFFFFF) background. Avoid: {NEGATIVE_PROMPT}."
    )


def extract_image_bytes(data: dict) -> tuple[bytes, str]:
    items = data.get("data") or []
    if items:
        item = items[0]
        if item.get("b64_json"):
            return base64.b64decode(item["b64_json"]), "png"
        url = item.get("url") or ""
        if url.startswith("data:"):
            header, b64 = url.split(",", 1)
            ext = "jpg" if ("jpeg" in header or "jpg" in header) else ("webp" if "webp" in header else "png")
            return base64.b64decode(b64), ext
        if url.startswith("http"):
            with urllib.request.urlopen(url, timeout=60) as r:
                ct = r.headers.get("Content-Type", "")
                ext = "jpg" if "jpeg" in ct else ("webp" if "webp" in ct else "png")
                return r.read(), ext
    raise RuntimeError(f"Could not find image in OpenRouter response: {json.dumps(data)[:600]}")


def generate_image(subject: str, key: str, tier: str = "medium", model: str = DEFAULT_MODEL, out_dir: Path = DEFAULT_OUT_DIR) -> Path:
    api_key = load_api_key()
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "model": model,
        "prompt": build_prompt(subject, tier),
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
        raise RuntimeError(f"HTTP {e.code} for {key}: {body[:600]}") from e

    img_bytes, ext = extract_image_bytes(data)
    out_path = out_dir / f"{key}.{ext}"
    out_path.write_bytes(img_bytes)
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a Paint-by-Number source image via OpenRouter.")
    parser.add_argument("key", help="Lowercase snake_case output key (e.g., winter_penguin)")
    parser.add_argument("subject", help="Subject description to insert into the PBN prompt template")
    parser.add_argument("--tier", choices=["easy", "medium", "hard"], default="medium", help="Difficulty tier (default: medium)")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"OpenRouter image model (default: {DEFAULT_MODEL})")
    args = parser.parse_args()

    out_path = generate_image(args.subject, args.key, tier=args.tier, model=args.model)
    print(f"Saved {out_path} ({out_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
