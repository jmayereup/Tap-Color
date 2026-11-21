#!/usr/bin/env python3
"""
Shrinks source images copied into dist/assets/paint_by_number and
dist/assets/diamond_art_only so they serve as lightweight gallery thumbnails
while keeping full-resolution originals in public/assets/ for build:assets.
"""

import os
import sys

MAX_DIM = 400
JPEG_QUALITY = "82"

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    import gi
    gi.require_version("GdkPixbuf", "2.0")
    from gi.repository import GdkPixbuf


def shrink_file(path, max_dim=MAX_DIM):
    ext = os.path.splitext(path)[1].lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp"):
        return 0, 0

    orig_size = os.path.getsize(path)
    tmp_path = path + ".tmp"

    try:
        if HAS_PIL:
            with Image.open(path) as im:
                w, h = im.size
                if max(w, h) <= max_dim:
                    return orig_size, orig_size
                scale = max_dim / max(w, h)
                nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
                resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
                if ext in (".jpg", ".jpeg"):
                    if resized.mode != "RGB":
                        resized = resized.convert("RGB")
                    resized.save(tmp_path, "JPEG", quality=int(JPEG_QUALITY), optimize=True)
                elif ext == ".png":
                    resized.save(tmp_path, "PNG", optimize=True)
                elif ext == ".webp":
                    resized.save(tmp_path, "WEBP", quality=int(JPEG_QUALITY))
        else:
            pb = GdkPixbuf.Pixbuf.new_from_file(path)
            w, h = pb.get_width(), pb.get_height()
            if max(w, h) <= max_dim:
                return orig_size, orig_size
            scale = max_dim / max(w, h)
            nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
            scaled = pb.scale_simple(nw, nh, GdkPixbuf.InterpType.BILINEAR)
            if ext in (".jpg", ".jpeg"):
                scaled.savev(tmp_path, "jpeg", ["quality"], [JPEG_QUALITY])
            elif ext == ".png":
                scaled.savev(tmp_path, "png", ["compression"], ["9"])
            elif ext == ".webp":
                # GdkPixbuf often lacks a webp saver; skip if unsupported (webp files are already small)
                return orig_size, orig_size

        new_size = os.path.getsize(tmp_path)
        if new_size < orig_size:
            os.replace(tmp_path, path)
            return orig_size, new_size
        os.remove(tmp_path)
        return orig_size, orig_size
    except Exception as exc:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        print(f"  [skip] {os.path.basename(path)}: {exc}", file=sys.stderr)
        return orig_size, orig_size


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_dirs = [
        os.path.join(root, "dist", "assets", "paint_by_number"),
        os.path.join(root, "dist", "assets", "diamond_art_only"),
    ]

    total_before = 0
    total_after = 0
    count = 0

    for d in target_dirs:
        if not os.path.isdir(d):
            continue
        for fname in sorted(os.listdir(d)):
            fpath = os.path.join(d, fname)
            if os.path.isfile(fpath):
                before, after = shrink_file(fpath)
                total_before += before
                total_after += after
                if before != after:
                    count += 1

    print(
        f"Shrunk {count} dist thumbnail images (max {MAX_DIM}px): "
        f"{total_before / 1024 / 1024:.2f} MB -> {total_after / 1024 / 1024:.2f} MB"
    )


if __name__ == "__main__":
    main()
