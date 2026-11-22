#!/usr/bin/env python3
"""
Tap Color - Batch Artwork Converter
Converts original images in assets/ to Paint-by-Number and Diamond Art
at 3 different resolutions each for country life & Christian themes.
Uses PIL if available, or GdkPixbuf + PyCairo seamlessly.
"""

import os
import sys
import json
import random

try:
    from PIL import Image, ImageDraw, ImageOps
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    import gi
    gi.require_version('GdkPixbuf', '2.0')
    from gi.repository import GdkPixbuf
    import cairo

def rgb_to_hex(r, g, b):
    return f"#{r:02X}{g:02X}{b:02X}"

def get_luminance(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b

def load_framed_rgb_grid(img_path, target_size):
    """Loads an image, composites transparency onto white, trims uniform borders, and frames into target_size x target_size."""
    if HAS_PIL:
        raw_im = ImageOps.exif_transpose(Image.open(img_path))
        if raw_im.mode in ('RGBA', 'LA') or (raw_im.mode == 'P' and 'transparency' in raw_im.info):
            rgba = raw_im.convert('RGBA')
            bg = Image.new('RGBA', rgba.size, (255, 255, 255, 255))
            im = Image.alpha_composite(bg, rgba).convert('RGB')
        else:
            im = raw_im.convert('RGB')
        w, h = im.size
        sample = im.resize((200, 200), Image.Resampling.BOX)
        spix = sample.load()
        def get_sp(x, y):
            return spix[x, y]
    else:
        pb = GdkPixbuf.Pixbuf.new_from_file(img_path)
        pb = pb.apply_embedded_orientation()
        w, h = pb.get_width(), pb.get_height()
        samp = pb.scale_simple(200, 200, GdkPixbuf.InterpType.BILINEAR)
        sdata = samp.get_pixels()
        srs = samp.get_rowstride()
        sch = samp.get_n_channels()
        def get_sp(x, y):
            i = y * srs + x * sch
            if sch >= 4:
                a = sdata[i + 3] / 255.0
                return (
                    int(sdata[i] * a + 255 * (1.0 - a)),
                    int(sdata[i + 1] * a + 255 * (1.0 - a)),
                    int(sdata[i + 2] * a + 255 * (1.0 - a)),
                )
            return (sdata[i], sdata[i + 1], sdata[i + 2])

    def is_bg(c):
        return c[0] > 240 and c[1] > 240 and c[2] > 240

    corners = [get_sp(1, 1), get_sp(198, 1), get_sp(1, 198), get_sp(198, 198)]
    sx, sy, sw, sh = 0, 0, w, h
    if all(is_bg(c) for c in corners):
        min_x, max_x, min_y, max_y = 200, 0, 200, 0
        non_bg = 0
        for y in range(200):
            for x in range(200):
                if not is_bg(get_sp(x, y)):
                    if x < min_x: min_x = x
                    if x > max_x: max_x = x
                    if y < min_y: min_y = y
                    if y > max_y: max_y = y
                    non_bg += 1
        if non_bg >= 50 and max_x > min_x and max_y > min_y:
            rx0, rx1 = min_x * (w / 200.0), max_x * (w / 200.0)
            ry0, ry1 = min_y * (h / 200.0), max_y * (h / 200.0)
            cw, ch = rx1 - rx0, ry1 - ry0
            pad_x, pad_y = cw * 0.04, ch * 0.04
            sx = max(0, int(rx0 - pad_x))
            sy = max(0, int(ry0 - pad_y))
            sw = min(w - sx, int(cw + pad_x * 2))
            sh = min(h - sy, int(ch + pad_y * 2))

    scale = min(target_size / sw, target_size / sh)
    dw = max(1, int(round(sw * scale)))
    dh = max(1, int(round(sh * scale)))
    dx = (target_size - dw) // 2
    dy = (target_size - dh) // 2

    grid_rgb = [(255, 255, 255)] * (target_size * target_size)

    if HAS_PIL:
        cropped = im.crop((sx, sy, sx + sw, sy + sh))
        resized = cropped.resize((dw, dh), Image.Resampling.LANCZOS)
        rpix = resized.load()
        for y in range(dh):
            dst_off = (y + dy) * target_size + dx
            for x in range(dw):
                grid_rgb[dst_off + x] = rpix[x, y]
    else:
        cropped = pb.new_subpixbuf(sx, sy, sw, sh)
        resized = cropped.scale_simple(dw, dh, GdkPixbuf.InterpType.HYPER)
        rdata = resized.get_pixels()
        rrs = resized.get_rowstride()
        rch = resized.get_n_channels()
        for y in range(dh):
            row_off = y * rrs
            dst_off = (y + dy) * target_size + dx
            for x in range(dw):
                pi = row_off + x * rch
                if rch >= 4:
                    a = rdata[pi + 3] / 255.0
                    grid_rgb[dst_off + x] = (
                        int(rdata[pi] * a + 255 * (1.0 - a)),
                        int(rdata[pi + 1] * a + 255 * (1.0 - a)),
                        int(rdata[pi + 2] * a + 255 * (1.0 - a)),
                    )
                else:
                    grid_rgb[dst_off + x] = (rdata[pi], rdata[pi+1], rdata[pi+2])

    return grid_rgb

def bilateral_smooth_rgb(grid_rgb, W, H):
    """Edge-preserving bilateral smoothing filter to remove texture noise while keeping sharp color boundaries."""
    out = list(grid_rgb)
    for y in range(1, H - 1):
        row = y * W
        for x in range(1, W - 1):
            idx = row + x
            cr, cg, cb = grid_rgb[idx]
            sr, sg, sb, tw = cr * 4, cg * 4, cb * 4, 4
            for dy in (-1, 0, 1):
                nrow = (y + dy) * W
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nr, ng, nb = grid_rgb[nrow + x + dx]
                    dist_sq = (cr - nr) ** 2 + (cg - ng) ** 2 + (cb - nb) ** 2
                    if dist_sq < 2400:
                        w = 2 if dist_sq < 600 else 1
                        sr += nr * w
                        sg += ng * w
                        sb += nb * w
                        tw += w
            out[idx] = (sr // tw, sg // tw, sb // tw)
    return out

def kmeans_pp(samples, K, max_iter=12):
    random.seed(42)
    centers = [list(random.choice(samples))]
    for _ in range(1, K):
        dists = []
        for s in samples:
            min_d = min((s[0]-c[0])**2 + (s[1]-c[1])**2 + (s[2]-c[2])**2 for c in centers)
            dists.append(min_d)
        total = sum(dists)
        if total == 0:
            centers.append(list(random.choice(samples)))
            continue
        r = random.random() * total
        acc = 0
        for i, d in enumerate(dists):
            acc += d
            if acc >= r:
                centers.append(list(samples[i]))
                break
    for _ in range(max_iter):
        sums = [[0, 0, 0] for _ in range(K)]
        counts = [0] * K
        for s in samples:
            best_k = min(range(K), key=lambda k: (s[0]-centers[k][0])**2 + (s[1]-centers[k][1])**2 + (s[2]-centers[k][2])**2)
            sums[best_k][0] += s[0]
            sums[best_k][1] += s[1]
            sums[best_k][2] += s[2]
            counts[best_k] += 1
        for k in range(K):
            if counts[k] > 0:
                centers[k] = [sums[k][0] // counts[k], sums[k][1] // counts[k], sums[k][2] // counts[k]]
    return centers


# --- Diamond Art Generator ---
def convert_to_diamond_art(img_path, N, K, title, artist, output_id, output_dir):
    json_path = os.path.join(output_dir, f"{output_id}.json")
    thumb_path = os.path.join(output_dir, f"{output_id}_thumb.png")

    grid_rgb = load_framed_rgb_grid(img_path, N)

    samples = []
    sample_step = max(1, N // 30)
    for y in range(0, N, sample_step):
        for x in range(0, N, sample_step):
            samples.append(grid_rgb[y * N + x])

    centers = kmeans_pp(samples, K, max_iter=12)
    centers.sort(key=lambda c: get_luminance(*c), reverse=True)

    palette = []
    for idx, c in enumerate(centers):
        palette.append({
            "number": idx + 1,
            "hex": rgb_to_hex(*c),
            "name": f"Gemstone Drill #{idx + 1}",
            "total_count": 0,
            "filled_count": 0,
            "is_completed": False
        })

    width = 800
    height = 800
    margin = 28

    cells = []
    cR = [c[0] for c in centers]
    cG = [c[1] for c in centers]
    cB = [c[2] for c in centers]

    for r in range(N):
        for c in range(N):
            pr, pg, pb = grid_rgb[r * N + c]
            best_k = min(range(K), key=lambda k: (pr-cR[k])**2 + (pg-cG[k])**2 + (pb-cB[k])**2)
            palette[best_k]["total_count"] += 1
            cells.append(best_k + 1)

    artwork = {
        "id": output_id,
        "title": title,
        "artist": artist,
        "category": "diamond",
        "width": width,
        "height": height,
        "grid": N,
        "margin": margin,
        "palette": palette,
        "cells": cells
    }

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(artwork, f, separators=(',', ':'))

    # Render Thumbnail (280x200)
    thumb_w, thumb_h = 280, 200
    t_margin = 12
    t_avail_w = thumb_w - t_margin * 2
    t_avail_h = thumb_h - t_margin * 2
    t_cell = min(t_avail_w / N, t_avail_h / N)
    t_ox = (thumb_w - N * t_cell) / 2
    t_oy = (thumb_h - N * t_cell) / 2

    if HAS_PIL:
        thumb_img = Image.new('RGB', (thumb_w, thumb_h), (15, 23, 42))
        draw = ImageDraw.Draw(thumb_img)
        drill_idx = 0
        for r in range(N):
            for c in range(N):
                num = cells[drill_idx]
                drill_idx += 1
                col_hex = palette[num - 1]["hex"].lstrip('#')
                col = tuple(int(col_hex[i:i+2], 16) for i in (0, 2, 4))
                x0 = t_ox + c * t_cell
                y0 = t_oy + r * t_cell
                draw.rectangle([x0, y0, x0 + t_cell - 0.5, y0 + t_cell - 0.5], fill=col)
                draw.rectangle([x0, y0, x0 + t_cell * 0.4, y0 + t_cell * 0.4], fill=(min(255, col[0]+50), min(255, col[1]+50), min(255, col[2]+50)))
        thumb_img.save(thumb_path, 'PNG')
    else:
        surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, thumb_w, thumb_h)
        ctx = cairo.Context(surf)
        ctx.set_source_rgb(15/255.0, 23/255.0, 42/255.0)
        ctx.paint()
        drill_idx = 0
        for r in range(N):
            for c in range(N):
                num = cells[drill_idx]
                drill_idx += 1
                col_hex = palette[num - 1]["hex"].lstrip('#')
                col = tuple(int(col_hex[i:i+2], 16) for i in (0, 2, 4))
                x0 = t_ox + c * t_cell
                y0 = t_oy + r * t_cell
                ctx.set_source_rgb(col[0]/255.0, col[1]/255.0, col[2]/255.0)
                ctx.rectangle(x0, y0, max(0.5, t_cell - 0.3), max(0.5, t_cell - 0.3))
                ctx.fill()
                ctx.set_source_rgb(min(255, col[0]+50)/255.0, min(255, col[1]+50)/255.0, min(255, col[2]+50)/255.0)
                ctx.rectangle(x0, y0, t_cell * 0.4, t_cell * 0.4)
                ctx.fill()
        surf.write_to_png(thumb_path)

    print(f"  [Diamond] {output_id}: {N}x{N} ({len(cells)} drills, {len(palette)} colors)")
    return artwork


# --- Paint by Number Generator ---
def get_sq_seg_dist(p, p1, p2):
    x, y = p1[0], p1[1]
    dx, dy = p2[0] - x, p2[1] - y
    if dx != 0 or dy != 0:
        t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)
        if t > 1:
            x, y = p2[0], p2[1]
        elif t > 0:
            x += dx * t
            y += dy * t
    return (p[0] - x) ** 2 + (p[1] - y) ** 2

def simplify_dp(points, sq_tol):
    if len(points) <= 3:
        return points
    stack = [(0, len(points) - 1)]
    keep = [False] * len(points)
    keep[0] = True
    keep[-1] = True
    while stack:
        start_idx, end_idx = stack.pop()
        p1 = points[start_idx]
        p2 = points[end_idx]
        max_sq_dist = 0.0
        max_idx = start_idx
        for i in range(start_idx + 1, end_idx):
            d = get_sq_seg_dist(points[i], p1, p2)
            if d > max_sq_dist:
                max_sq_dist = d
                max_idx = i
        if max_sq_dist > sq_tol:
            keep[max_idx] = True
            if max_idx - start_idx > 1:
                stack.append((start_idx, max_idx))
            if end_idx - max_idx > 1:
                stack.append((max_idx, end_idx))
    return [points[i] for i in range(len(points)) if keep[i]]

def smooth_contour(raw_poly, W, H, sq_tol):
    """
    Melts pixel staircase jaggies into smooth organic vector curves using
    6 passes of zero-shrinkage Taubin smoothing followed by DP simplification and Chaikin corner-cutting.
    """
    n = len(raw_poly)
    if n < 4:
        return [(float(p[0]), float(p[1])) for p in raw_poly]
    pts = [(float(p[0]), float(p[1])) for p in raw_poly]

    for it in range(6):
        w = 0.50 if (it % 2 == 0) else -0.46
        nxt = []
        for i in range(n):
            px, py = pts[i]
            if (px in (0.0, float(W))) and (py in (0.0, float(H))):
                nxt.append((px, py))
                continue
            p_prev = pts[(i - 1) % n]
            p_next = pts[(i + 1) % n]
            mx = 0.5 * (p_prev[0] + p_next[0])
            my = 0.5 * (p_prev[1] + p_next[1])
            nx = px + w * (mx - px)
            ny = py + w * (my - py)
            if px == 0.0 and p_prev[0] == 0.0 and p_next[0] == 0.0:
                nx = 0.0
            elif px == float(W) and p_prev[0] == float(W) and p_next[0] == float(W):
                nx = float(W)
            if py == 0.0 and p_prev[1] == 0.0 and p_next[1] == 0.0:
                ny = 0.0
            elif py == float(H) and p_prev[1] == float(H) and p_next[1] == float(H):
                ny = float(H)
            nxt.append((nx, ny))
        pts = nxt

    simplified = simplify_dp(pts, sq_tol)
    if len(simplified) < 3:
        simplified = pts

    curr = simplified
    for _ in range(2):
        nxt = []
        m = len(curr)
        for i in range(m):
            p1 = curr[i]
            p2 = curr[(i + 1) % m]
            if p1[0] in (0.0, float(W)) and p1[1] in (0.0, float(H)):
                nxt.append(p1)
            else:
                nxt.append((p1[0] * 0.75 + p2[0] * 0.25, p1[1] * 0.75 + p2[1] * 0.25))
            if not (p2[0] in (0.0, float(W)) and p2[1] in (0.0, float(H))):
                nxt.append((p1[0] * 0.25 + p2[0] * 0.75, p1[1] * 0.25 + p2[1] * 0.75))
        curr = nxt
    return curr

def trace_boundary(comp_pixels, W, H):
    """
    Traces the exterior boundary of a 4-connected pixel component.
    Properly handles canvas edges (preventing row wrap-around) and saddle vertices (using rightmost-turn rule).
    """
    pix_set = set(comp_pixels)
    adj = {}
    for p in comp_pixels:
        px = p % W
        py = p // W
        if py == 0 or (p - W) not in pix_set:
            adj.setdefault((px, py), []).append((px + 1, py))
        if px == W - 1 or (p + 1) not in pix_set:
            adj.setdefault((px + 1, py), []).append((px + 1, py + 1))
        if py == H - 1 or (p + W) not in pix_set:
            adj.setdefault((px + 1, py + 1), []).append((px, py + 1))
        if px == 0 or (p - 1) not in pix_set:
            adj.setdefault((px, py + 1), []).append((px, py))

    if not adj:
        return []

    start_v = min(adj.keys(), key=lambda v: (v[1], v[0]))
    first_next = max(adj[start_v], key=lambda v: v[0] - start_v[0])
    dir_idx = {(1, 0): 0, (0, 1): 1, (-1, 0): 2, (0, -1): 3}

    poly = [start_v]
    prev_v = start_v
    curr_v = first_next
    used = {(start_v, first_next)}
    max_steps = len(comp_pixels) * 4 + 100
    steps = 0

    while steps < max_steps:
        if curr_v == start_v:
            break
        poly.append(curr_v)
        dx = curr_v[0] - prev_v[0]
        dy = curr_v[1] - prev_v[1]
        in_dir = dir_idx.get((dx, dy), 0)
        candidates = [n for n in adj.get(curr_v, []) if (curr_v, n) not in used]
        if not candidates:
            break
        if len(candidates) == 1:
            nxt_v = candidates[0]
        else:
            nxt_v = min(candidates, key=lambda n: (dir_idx.get((n[0] - curr_v[0], n[1] - curr_v[1]), 0) - in_dir - 1) % 4)
        used.add((curr_v, nxt_v))
        prev_v = curr_v
        curr_v = nxt_v
        steps += 1
    return poly

def get_component_thickness_and_pole(comp_pixels, W, H):
    """
    Computes exact internal distance transform of a pixel component, returning its maximum thickness
    and candidate pole-of-inaccessibility centers inside its largest thick lobe.
    """
    pix_set = set(comp_pixels)
    dist = {}
    q = deque()
    for p in comp_pixels:
        px = p % W
        py = p // W
        if (px == 0 or px == W - 1 or py == 0 or py == H - 1 or
            (p - 1) not in pix_set or (p + 1) not in pix_set or
            (p - W) not in pix_set or (p + W) not in pix_set):
            dist[p] = 1
            q.append(p)

    max_d = 1
    while q:
        curr = q.popleft()
        d = dist[curr]
        if d > max_d:
            max_d = d
        for nxt in (curr - 1, curr + 1, curr - W, curr + W):
            if nxt in pix_set and nxt not in dist:
                dist[nxt] = d + 1
                q.append(nxt)

    core_thresh = max(1, max_d - 1) if max_d >= 4 else max_d
    core_set = {p for p, d in dist.items() if d >= core_thresh}
    visited = set()
    best_cluster = []
    best_cluster_score = -1

    for p in core_set:
        if p in visited:
            continue
        cluster = []
        cq = deque([p])
        visited.add(p)
        score = 0
        while cq:
            cur = cq.popleft()
            cluster.append(cur)
            score += dist[cur] ** 2
            for nxt in (cur - 1, cur + 1, cur - W, cur + W):
                if nxt in core_set and nxt not in visited:
                    visited.add(nxt)
                    cq.append(nxt)
        if score > best_cluster_score:
            best_cluster_score = score
            best_cluster = cluster

    if not best_cluster:
        best_cluster = list(core_set)

    sum_x = sum((p % W) * dist[p] for p in best_cluster)
    sum_y = sum((p // W) * dist[p] for p in best_cluster)
    tot_w = sum(dist[p] for p in best_cluster)
    mx = sum_x / tot_w
    my = sum_y / tot_w

    top_pixels = sorted(best_cluster, key=lambda p: (-dist[p], (p % W - mx)**2 + (p // W - my)**2))
    candidates = []
    for p in top_pixels:
        cx, cy = (p % W) + 0.5, (p // W) + 0.5
        if all((cx - ox)**2 + (cy - oy)**2 > 9.0 for ox, oy, _ in candidates):
            candidates.append((cx, cy, dist[p]))
            if len(candidates) >= 6:
                break
    if not candidates:
        p0 = top_pixels[0]
        candidates.append(((p0 % W) + 0.5, (p0 // W) + 0.5, dist[p0]))
    return max_d, candidates, dist

def point_to_poly_dist(x, y, poly):
    inside = False
    min_dist_sq = float('inf')
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]['x'], poly[i]['y']
        xj, yj = poly[j]['x'], poly[j]['y']
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        dx, dy = xj - xi, yj - yi
        px, py = xi, yi
        if dx != 0 or dy != 0:
            t = ((x - px) * dx + (y - py) * dy) / (dx * dx + dy * dy)
            if t > 1:
                px, py = xj, yj
            elif t > 0:
                px += dx * t
                py += dy * t
        d_sq = (x - px) ** 2 + (y - py) ** 2
        if d_sq < min_dist_sq:
            min_dist_sq = d_sq
        j = i
    return (1 if inside else -1) * math.sqrt(min_dist_sq)

def refine_pole_in_poly(candidates, poly, dist_map, W, margin, scale):
    """
    Finds the Pole of Inaccessibility (visual center with maximum inscribed circle radius)
    accounting for both the smoothed exterior polygon and any interior holes/boundaries.
    """
    def effective_clearance(wx, wy):
        px = int((wx - margin) / scale)
        py = int((wy - margin) / scale)
        if px < 0 or px >= W or py < 0 or py >= W:
            return -10.0
        p_idx = py * W + px
        d_pix = dist_map.get(p_idx, 0)
        if d_pix <= 0:
            return -5.0
        d_poly = point_to_poly_dist(wx, wy, poly)
        return min(d_poly, (d_pix - 0.15) * scale)

    best_x = margin + candidates[0][0] * scale
    best_y = margin + candidates[0][1] * scale
    best_d = -float('inf')
    for cx, cy, _ in candidates:
        wx = margin + cx * scale
        wy = margin + cy * scale
        d = effective_clearance(wx, wy)
        if d > best_d:
            best_d = d
            best_x, best_y = wx, wy

    for step in (3.0, 1.5, 0.7, 0.3):
        improved = True
        iters = 0
        while improved and iters < 5:
            improved = False
            iters += 1
            for dy in (-step, 0.0, step):
                for dx in (-step, 0.0, step):
                    if dx == 0.0 and dy == 0.0:
                        continue
                    nx, ny = best_x + dx, best_y + dy
                    d = effective_clearance(nx, ny)
                    if d > best_d + 0.02:
                        best_d = d
                        best_x, best_y = nx, ny
                        improved = True
    return best_x, best_y, max(1.0, best_d)

def detect_bg_and_ink_grid(grid_rgb, W):
    """
    Separates outer white background (mask=1) and thin dark ink outlines (mask=2)
    from playable interior color pixels (mask=0) on a flat RGB tuple list.
    """
    total = W * W
    mask = [0] * total

    def is_white_bg(rgb):
        return rgb[0] > 232 and rgb[1] > 232 and rgb[2] > 232

    q = deque()
    for x in range(W):
        for y in (0, W - 1):
            idx = y * W + x
            if mask[idx] == 0 and is_white_bg(grid_rgb[idx]):
                mask[idx] = 1
                q.append(idx)
    for y in range(1, W - 1):
        for x in (0, W - 1):
            idx = y * W + x
            if mask[idx] == 0 and is_white_bg(grid_rgb[idx]):
                mask[idx] = 1
                q.append(idx)

    while q:
        curr = q.popleft()
        cx = curr % W
        cy = curr // W
        if cx > 0 and mask[curr - 1] == 0 and is_white_bg(grid_rgb[curr - 1]):
            mask[curr - 1] = 1
            q.append(curr - 1)
        if cx < W - 1 and mask[curr + 1] == 0 and is_white_bg(grid_rgb[curr + 1]):
            mask[curr + 1] = 1
            q.append(curr + 1)
        if cy > 0 and mask[curr - W] == 0 and is_white_bg(grid_rgb[curr - W]):
            mask[curr - W] = 1
            q.append(curr - W)
        if cy < W - 1 and mask[curr + W] == 0 and is_white_bg(grid_rgb[curr + W]):
            mask[curr + W] = 1
            q.append(curr + W)

    dark = [False] * total
    for i in range(total):
        if mask[i] != 0:
            continue
        r, g, b = grid_rgb[i]
        lum = get_luminance(r, g, b)
        sat = max(r, g, b) - min(r, g, b)
        if lum < 105 and sat < 55:
            dark[i] = True

    R = max(3, W // 100)
    core = [False] * total
    for y in range(R, W - R):
        for x in range(R, W - R):
            idx = y * W + x
            if not dark[idx]:
                continue
            all_dark = True
            for dy in range(-R, R + 1):
                row_off = (y + dy) * W
                for dx in range(-R, R + 1):
                    if not dark[row_off + x + dx]:
                        all_dark = False
                        break
                if not all_dark:
                    break
            if all_dark:
                core[idx] = True

    solid_dark = [False] * total
    for y in range(W):
        for x in range(W):
            if core[y * W + x]:
                y0, y1 = max(0, y - R), min(W - 1, y + R)
                x0, x1 = max(0, x - R), min(W - 1, x + R)
                for ny in range(y0, y1 + 1):
                    row_off = ny * W
                    for nx in range(x0, x1 + 1):
                        if dark[row_off + nx]:
                            solid_dark[row_off + nx] = True

    for i in range(total):
        if dark[i] and not solid_dark[i]:
            mask[i] = 2

    return mask


def merge_similar_palette(centers, counts, min_dist):
    """Merges visually redundant palette centers within min_dist perceptual RGB distance."""
    active = [[list(c), cnt] for c, cnt in zip(centers, counts) if cnt > 0]
    while len(active) > 4:
        best_i, best_j, best_d = -1, -1, float('inf')
        for i in range(len(active)):
            ci = active[i][0]
            for j in range(i + 1, len(active)):
                cj = active[j][0]
                dr = ci[0] - cj[0]
                dg = ci[1] - cj[1]
                db = ci[2] - cj[2]
                d = math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db) / 3.0
                if d < best_d:
                    best_d = d
                    best_i, best_j = i, j
        if best_d >= min_dist or best_i == -1:
            break
        wi, wj = active[best_i][1], active[best_j][1]
        tot = wi + wj
        ci, cj = active[best_i][0], active[best_j][0]
        active[best_i][0] = [
            round((ci[0] * wi + cj[0] * wj) / tot),
            round((ci[1] * wi + cj[1] * wj) / tot),
            round((ci[2] * wi + cj[2] * wj) / tot),
        ]
        active[best_i][1] = tot
        active.pop(best_j)
    return [a[0] for a in active]


def save_rgba_to_png(rgba_bytes, W, H, png_path):
    """Saves straight-alpha RGBA bytes (W*H*4) to a PNG file using PIL or Cairo."""
    if HAS_PIL:
        im = Image.frombytes('RGBA', (W, H), bytes(rgba_bytes))
        im.save(png_path, 'PNG')
    else:
        # Cairo FORMAT_ARGB32 on little-endian expects premultiplied BGRA bytes
        bgra = bytearray(W * H * 4)
        for i in range(0, W * H * 4, 4):
            a = rgba_bytes[i + 3]
            if a == 255:
                bgra[i] = rgba_bytes[i + 2]
                bgra[i + 1] = rgba_bytes[i + 1]
                bgra[i + 2] = rgba_bytes[i]
                bgra[i + 3] = 255
            elif a > 0:
                bgra[i] = (rgba_bytes[i + 2] * a + 127) // 255
                bgra[i + 1] = (rgba_bytes[i + 1] * a + 127) // 255
                bgra[i + 2] = (rgba_bytes[i] * a + 127) // 255
                bgra[i + 3] = a
        surf = cairo.ImageSurface.create_for_data(bgra, cairo.FORMAT_ARGB32, W, H, W * 4)
        surf.write_to_png(png_path)


def convert_to_paint_by_number(img_path, title, artist, output_id, output_dir):
    import subprocess, tempfile
    json_path = os.path.join(output_dir, f"{output_id}.json")
    lines_png_path = os.path.join(output_dir, f"{output_id}_lines.png")
    thumb_path = os.path.join(output_dir, f"{output_id}_thumb.png")
    line_art_url = f"assets/converted/{output_id}_lines.png"

    W = 800
    pad = 24
    inner_w = W - pad * 2
    inner_rgb = load_framed_rgb_grid(img_path, inner_w)

    # Place framed artwork inside 800x800 white canvas with 24px margin for 1:1 world alignment
    buf = bytearray([255] * (W * W * 4))
    for y in range(inner_w):
        src_row = y * inner_w
        dst_row = (y + pad) * W + pad
        for x in range(inner_w):
            r, g, b = inner_rgb[src_row + x]
            o = (dst_row + x) * 4
            buf[o] = r
            buf[o + 1] = g
            buf[o + 2] = b
            buf[o + 3] = 255

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pbn_script = os.path.join(base_dir, "scripts", "convert_pbn.mjs")

    with tempfile.NamedTemporaryFile(suffix=".bin", delete=False) as tf:
        raw_bin_path = tf.name
        tf.write(buf)
    with tempfile.NamedTemporaryFile(suffix=".rgba", delete=False) as lf:
        lines_bin_path = lf.name

    try:
        subprocess.run(
            ["node", pbn_script, raw_bin_path, str(W), output_id, title, artist, json_path, lines_bin_path, line_art_url],
            check=True,
            cwd=base_dir,
        )
        with open(lines_bin_path, 'rb') as lf:
            lines_rgba = lf.read()
        save_rgba_to_png(lines_rgba, W, W, lines_png_path)
    finally:
        if os.path.exists(raw_bin_path):
            os.remove(raw_bin_path)
        if os.path.exists(lines_bin_path):
            os.remove(lines_bin_path)

    with open(json_path, 'r', encoding='utf-8') as f:
        artwork = json.load(f)

    regions = artwork["regions"]
    active_palette = artwork["palette"]
    width = artwork["width"]
    height = artwork["height"]

    # Render Thumbnail (280x200 on clean paper background with crisp ink overlay)
    thumb_w, thumb_h = 280, 200
    ts = min((thumb_w - 16) / width, (thumb_h - 16) / height)
    tox = (thumb_w - width * ts) / 2
    toy = (thumb_h - height * ts) / 2

    if HAS_PIL:
        ss = 2
        thumb_hi = Image.new('RGBA', (thumb_w * ss, thumb_h * ss), (248, 250, 252, 255))
        draw = ImageDraw.Draw(thumb_hi)
        for r in regions:
            poly_pts = [(tox * ss + pt['x'] * ts * ss, toy * ss + pt['y'] * ts * ss) for pt in r['polygon']]
            if len(poly_pts) >= 3:
                hex_c = r['color_hex'].lstrip('#')
                rgb_c = tuple(int(hex_c[i:i+2], 16) for i in (0, 2, 4)) + (255,)
                draw.polygon(poly_pts, fill=rgb_c)
        lines_im = Image.open(lines_png_path).convert('RGBA')
        lines_scaled = lines_im.resize((int(round(width * ts * ss)), int(round(height * ts * ss))), Image.Resampling.LANCZOS)
        thumb_hi.alpha_composite(lines_scaled, (int(round(tox * ss)), int(round(toy * ss))))
        thumb_img = thumb_hi.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS).convert('RGB')
        thumb_img.save(thumb_path, 'PNG')
    else:
        surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, thumb_w, thumb_h)
        ctx = cairo.Context(surf)
        ctx.set_source_rgb(248/255.0, 250/255.0, 252/255.0)
        ctx.paint()
        ctx.save()
        ctx.translate(tox, toy)
        ctx.scale(ts, ts)
        ctx.set_fill_rule(cairo.FILL_RULE_EVEN_ODD)
        for r in regions:
            poly = r.get('polygon', [])
            if len(poly) < 3:
                continue
            hex_c = r['color_hex'].lstrip('#')
            rgb_c = tuple(int(hex_c[i:i+2], 16) for i in (0, 2, 4))
            ctx.new_path()
            ctx.move_to(poly[0]['x'], poly[0]['y'])
            for pt in poly[1:]:
                ctx.line_to(pt['x'], pt['y'])
            ctx.close_path()
            for hole in r.get('holes', []):
                if len(hole) >= 3:
                    ctx.move_to(hole[0]['x'], hole[0]['y'])
                    for pt in hole[1:]:
                        ctx.line_to(pt['x'], pt['y'])
                    ctx.close_path()
            ctx.set_source_rgb(rgb_c[0]/255.0, rgb_c[1]/255.0, rgb_c[2]/255.0)
            ctx.fill()
        # Composite crisp ink line-art overlay on top
        lines_surf = cairo.ImageSurface.create_from_png(lines_png_path)
        ctx.set_source_surface(lines_surf, 0, 0)
        ctx.paint()
        ctx.restore()
        surf.write_to_png(thumb_path)

    print(f"  [Paint-by-Number] {output_id}: {len(regions)} regions, {len(active_palette)} colors")
    return artwork

def main():
    import re
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assets_dir = os.path.join(base_dir, "public", "assets")
    pbn_dir = os.path.join(assets_dir, "paint_by_number")
    diamond_only_dir = os.path.join(assets_dir, "diamond_art_only")
    output_dir = os.path.join(assets_dir, "converted")
    os.makedirs(pbn_dir, exist_ok=True)
    os.makedirs(diamond_only_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    # Optional curated metadata overrides for known artwork keys
    METADATA_BY_KEY = {
        "fluffy_cow": {
            "title": "Sweet Highland Calf",
            "artist": "Country Homestead",
            "desc": "Gentle fluffy highland cow calf surrounded by meadow wildflowers and rustic wooden pasture",
        },
        "hummingbird": {
            "title": "Garden Hummingbird",
            "artist": "Sunlit Meadow",
            "desc": "Vibrant hummingbird sipping sweet nectar among blooming country garden flora",
        },
        "country_barn": {
            "title": "Rustic Red Barn",
            "artist": "Heartland Heritage",
            "desc": "Classic red country barn with silo, split-rail fence, and sunflowers under sunny blue sky",
        },
        "country_rooster": {
            "title": "Morning Farm Rooster",
            "artist": "Sunrise Farmstead",
            "desc": "Colorful country rooster greeting the morning sun from a rustic fence post",
        },
        "country_truck": {
            "title": "Vintage Harvest Truck",
            "artist": "Country Roads Studio",
            "desc": "Classic turquoise vintage pickup truck filled with harvest pumpkins and sunflowers",
        },
        "country_puppy": {
            "title": "Porch Golden Puppy",
            "artist": "Cottage Companions",
            "desc": "Adorable golden retriever puppy in a red bandana enjoying a sunny farm morning",
        },
        "yorky_teacup": {
            "title": "Teacup Yorkie Ribbon",
            "artist": "Petite Paws Studio",
            "desc": "Adorable teacup Yorkshire Terrier puppy with pink bow nestled in vintage porcelain",
        },
        "yorky_garden": {
            "title": "Garden Blossom Yorkie",
            "artist": "Cottage Petals",
            "desc": "Cheerful Yorkshire Terrier puppy surrounded by blooming pansies and meadow lavender",
        },
        "yorky_autumn": {
            "title": "Cozy Autumn Yorkie",
            "artist": "Harvest Hearth",
            "desc": "Sweet Yorkshire Terrier in a cozy red knit sweater among autumn maple leaves and pumpkins",
        },
        "yorky_playful": {
            "title": "Playful Meadow Yorkie",
            "artist": "Sunny Pastures",
            "desc": "Joyful Yorkshire Terrier puppy in a polka dot bandana playing with a ball in buttercups",
        },
        "rural_windmill": {
            "title": "Prairie Windmill Sunset",
            "artist": "Heartland Horizons",
            "desc": "Classic American farm windmill standing tall above golden wheat fields and prairie sunflowers",
        },
        "country_store": {
            "title": "Old Country Store",
            "artist": "Heritage Homestead",
            "desc": "Charming general store with wooden porch, rocking chairs, bushel of apples, and hanging lanterns",
        },
        "pasture_horses": {
            "title": "Pasture Mare & Foal",
            "artist": "Meadow Run Stables",
            "desc": "Loving chestnut farm mare and playful young foal beside a rustic split-rail pasture fence",
        },
        "vintage_tractor": {
            "title": "Heartland Antique Tractor",
            "artist": "Country Roads Studio",
            "desc": "Classic vintage farm tractor in vibrant green and yellow beside summer cornfields and harvest crates",
        },
        "covered_bridge": {
            "title": "Rustic Covered Bridge",
            "artist": "Valley Stream Folk",
            "desc": "Historic red wooden covered bridge spanning a peaceful babbling stream surrounded by wildflowers",
        },
        "autumn_fox": {
            "title": "Cozy Autumn Fox",
            "artist": "Woodland Folk",
            "desc": "Cozy red fox curled up among autumn leaves, red-capped mushrooms, and meadow wildflowers",
        },
    }

    STEM_ALIASES = {
        "fluffy-cow-3": "fluffy_cow",
        "autumn_fox_pbn": "autumn_fox",
    }

    IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}

    def stem_to_key(stem):
        if stem in STEM_ALIASES:
            return STEM_ALIASES[stem]
        if stem.endswith("_pbn"):
            stem = stem[:-4]
        return re.sub(r"[^a-z0-9_]+", "_", stem.lower()).strip("_")

    def get_meta(key, raw_stem):
        if key in METADATA_BY_KEY:
            meta = dict(METADATA_BY_KEY[key])
        else:
            title = raw_stem.replace("_", " ").replace("-", " ").title()
            meta = {
                "title": title,
                "artist": "Tap Color Studio",
                "desc": f"{title} artwork",
            }
        if key == target_key and explicit_tags:
            meta["tags"] = explicit_tags
        elif not meta.get("tags"):
            meta["tags"] = infer_tags(key, meta.get("title", ""), meta.get("desc", ""))
        return meta

    def infer_tags(key, title="", desc=""):
        text = f"{key} {title} {desc}".lower()
        tags = []

        def add(tag):
            if tag not in tags:
                tags.append(tag)

        if key.startswith("stained_glass_") or "stained glass" in text:
            add("stained-glass")
        if (
            key.startswith("stained_glass_")
            or key.startswith("nativity")
            or key in ("sermon_on_the_mount", "washing_of_the_feet")
        ):
            add("christian")
        if (
            key.startswith("christmas")
            or key.startswith("santa")
            or key.startswith("nativity")
            or key in ("jolly_snowman", "snowy_cottage", "cozy_fireplace")
        ):
            add("christmas")
        if key.startswith("thanksgiving_"):
            add("thanksgiving")
        if key.startswith("loi_krathong_"):
            add("loi-krathong")
        if key.startswith("dia_de_los_muertos_"):
            add("dia-de-los-muertos")
        if (
            key.startswith("highland_")
            or key.startswith("yorkie_")
            or key.startswith("yorky_")
            or key.startswith("baby_")
            or key.startswith("mother_deer")
            or key.startswith("mother_fox")
            or key.startswith("mother_whale")
            or key in (
                "fluffy_cow",
                "hummingbird",
                "country_rooster",
                "country_puppy",
                "pasture_horses",
                "autumn_fox",
                "arctic_fox_snow",
                "polar_bear_aurora",
                "winter_cardinal",
                "winter_penguin",
                "florida_flamingo_lagoon",
                "florida_manatee_springs",
                "loi_krathong_elephant_festival",
                "thanksgiving_turkey_pilgrim",
                "dia_de_los_muertos_xolo_dog",
                "dia_de_los_muertos_monarch_marigolds",
            )
        ):
            add("animals")
        if key.startswith("mother_"):
            add("family")
        if (
            key.startswith("florida_")
            or key.startswith("country_")
            or key in (
                "covered_bridge",
                "vintage_tractor",
                "rural_windmill",
                "autumn_fox",
                "hummingbird",
                "thanksgiving_barn_harvest",
                "thanksgiving_covered_bridge",
                "thanksgiving_autumn_wreath",
                "thanksgiving_cranberry_harvest",
            )
        ):
            add("nature")
        if not tags:
            add("general")
        return tags

    def is_up_to_date(src_path, out_paths):
        src_mtime = os.path.getmtime(src_path)
        for p in out_paths:
            if not os.path.exists(p) or os.path.getmtime(p) < src_mtime:
                return False
        return True

    # Discover artworks from paint_by_number/ and diamond_art_only/
    discovered = {}

    for fname in sorted(os.listdir(pbn_dir)):
        ext = os.path.splitext(fname)[1].lower()
        if ext not in IMAGE_EXTS:
            continue
        stem = os.path.splitext(fname)[0]
        key = stem_to_key(stem)
        rel_path = f"assets/paint_by_number/{fname}"
        abs_path = os.path.join(pbn_dir, fname)
        entry = discovered.setdefault(key, {
            "key": key,
            "raw_stem": stem,
            "pbn_path": None,
            "pbn_rel": None,
            "diamond_path": None,
            "diamond_rel": None,
        })
        entry["pbn_path"] = abs_path
        entry["pbn_rel"] = rel_path
        entry["diamond_path"] = abs_path
        entry["diamond_rel"] = rel_path

    for fname in sorted(os.listdir(diamond_only_dir)):
        ext = os.path.splitext(fname)[1].lower()
        if ext not in IMAGE_EXTS:
            continue
        stem = os.path.splitext(fname)[0]
        key = stem_to_key(stem)
        rel_path = f"assets/diamond_art_only/{fname}"
        abs_path = os.path.join(diamond_only_dir, fname)
        entry = discovered.setdefault(key, {
            "key": key,
            "raw_stem": stem,
            "pbn_path": None,
            "pbn_rel": None,
            "diamond_path": None,
            "diamond_rel": None,
        })
        # diamond_art_only overrides diamond source (so complex artwork can be used for diamond)
        entry["diamond_path"] = abs_path
        entry["diamond_rel"] = rel_path

    diamond_resolutions = [
        {"name": "Cozy (6.4k)", "grid": 80, "colors": 18, "suffix": "80", "label": "80×80"},
        {"name": "Standard (14.4k)", "grid": 120, "colors": 26, "suffix": "120", "label": "120×120"},
        {"name": "Masterpiece (25.6k)", "grid": 160, "colors": 36, "suffix": "160", "label": "160×160"},
    ]

    pbn_only = '--pbn-only' in sys.argv
    force = '--force' in sys.argv
    explicit_tags = []
    for a in sys.argv[1:]:
        if a.startswith('--tags='):
            explicit_tags = [
                re.sub(r'[^a-z0-9-]+', '-', t.strip().lower()).strip('-')
                for t in a.split('=', 1)[1].split(',')
                if t.strip()
            ]
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    target_key = args[0].strip() if args else None

    manifest_path = os.path.join(output_dir, "manifest.json")
    existing_manifest = {}
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                for entry in json.load(f):
                    existing_manifest[entry["key"]] = entry
        except Exception as e:
            print(f"Warning: could not read existing manifest ({e})")

    manifest_entries = []
    preferred_order = list(METADATA_BY_KEY.keys())
    ordered_keys = [k for k in preferred_order if k in discovered] + [
        k for k in sorted(discovered.keys()) if k not in preferred_order
    ]

    for key in ordered_keys:
        item = discovered[key]
        src_paths = [p for p in (item["diamond_path"], item["pbn_path"]) if p and os.path.exists(p)]
        src_added_at = int(max(os.path.getmtime(p) for p in src_paths) * 1000) if src_paths else 0

        if target_key and key != target_key:
            if key in existing_manifest:
                prev_entry = dict(existing_manifest[key])
                if not prev_entry.get("addedAt") and src_added_at:
                    prev_entry["addedAt"] = src_added_at
                if not prev_entry.get("tags"):
                    prev_entry["tags"] = infer_tags(
                        key, prev_entry.get("title", ""), prev_entry.get("desc", "")
                    )
                manifest_entries.append(prev_entry)
            continue

        meta = get_meta(key, item["raw_stem"])
        prev = existing_manifest.get(key, {})
        added_at = prev.get("addedAt") or src_added_at

        # 1. Diamond Art (generated for both diamond_art_only/ and paint_by_number/ images)
        diamond_variants = []
        if item["diamond_path"]:
            d_outputs = []
            for d_res in diamond_resolutions:
                art_id = f"{key}_diamond_{d_res['suffix']}"
                d_outputs.append(os.path.join(output_dir, f"{art_id}.json"))
                d_outputs.append(os.path.join(output_dir, f"{art_id}_thumb.png"))

            if (pbn_only or (not force and is_up_to_date(item["diamond_path"], d_outputs))) and prev.get("diamondVariants"):
                diamond_variants = prev["diamondVariants"]
            else:
                print(f"\nConverting Diamond Art for '{meta['title']}' ({item['diamond_rel']}):")
                for d_res in diamond_resolutions:
                    art_id = f"{key}_diamond_{d_res['suffix']}"
                    variant_title = f"{meta['title']} ({d_res['name']} Diamond)"
                    art = convert_to_diamond_art(
                        img_path=item["diamond_path"],
                        N=d_res["grid"],
                        K=d_res["colors"],
                        title=variant_title,
                        artist=meta["artist"],
                        output_id=art_id,
                        output_dir=output_dir
                    )
                    diamond_variants.append({
                        "id": art_id,
                        "resolution": d_res["name"],
                        "label": d_res["label"],
                        "grid": d_res["grid"],
                        "pieces": len(art["cells"]) if "cells" in art else len(art["regions"]),
                        "colors": len(art["palette"]),
                        "jsonFile": f"assets/converted/{art_id}.json",
                        "thumbnailUrl": f"assets/converted/{art_id}_thumb.png",
                    })

        # 2. Paint-by-Number (ONLY for images in public/assets/paint_by_number/)
        pbn_variants = []
        if item["pbn_path"]:
            art_id = f"{key}_pbn"
            p_outputs = [
                os.path.join(output_dir, f"{art_id}.json"),
                os.path.join(output_dir, f"{art_id}_lines.png"),
                os.path.join(output_dir, f"{art_id}_thumb.png"),
            ]
            if not force and is_up_to_date(item["pbn_path"], p_outputs) and prev.get("pbnVariants"):
                pbn_variants = prev["pbnVariants"]
            else:
                print(f"\nConverting Paint-by-Number for '{meta['title']}' ({item['pbn_rel']}):")
                art = convert_to_paint_by_number(
                    img_path=item["pbn_path"],
                    title=meta["title"],
                    artist=meta["artist"],
                    output_id=art_id,
                    output_dir=output_dir
                )
                pbn_variants = [{
                    "id": art_id,
                    "resolution": "Original",
                    "pieces": len(art["regions"]),
                    "colors": len(art["palette"]),
                    "jsonFile": f"assets/converted/{art_id}.json",
                    "lineArtUrl": f"assets/converted/{art_id}_lines.png",
                    "thumbnailUrl": f"assets/converted/{art_id}_thumb.png",
                }]

        manifest_entries.append({
            "key": key,
            "title": meta["title"],
            "artist": meta["artist"],
            "desc": meta["desc"],
            "tags": meta["tags"],
            "addedAt": added_at,
            "originalAsset": item["diamond_rel"] or item["pbn_rel"],
            "pbnAsset": item["pbn_rel"],
            "diamondVariants": diamond_variants,
            "pbnVariants": pbn_variants,
        })

    manifest_entries.sort(key=lambda e: e.get("addedAt", 0), reverse=True)

    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest_entries, f, indent=2)
    print(f"Manifest saved to {manifest_path} with {len(manifest_entries)} gallery entries.")

    if not target_key and not pbn_only:
        keep_files = {"manifest.json"}
        for entry in manifest_entries:
            for v in entry.get("diamondVariants", []) + entry.get("pbnVariants", []):
                for field in ("jsonFile", "lineArtUrl", "thumbnailUrl"):
                    rel = v.get(field)
                    if rel:
                        keep_files.add(os.path.basename(rel))
        pruned = 0
        for fname in os.listdir(output_dir):
            if fname not in keep_files:
                fpath = os.path.join(output_dir, fname)
                if os.path.isfile(fpath):
                    os.remove(fpath)
                    pruned += 1
        if pruned:
            print(f"Pruned {pruned} orphaned files from {output_dir}")

if __name__ == '__main__':
    main()
