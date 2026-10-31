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
import math
import random
from collections import deque, Counter

try:
    from PIL import Image, ImageDraw, ImageFilter
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
    """Loads an image, trims uniform white/transparent borders, and frames it into a target_size x target_size RGB list."""
    if HAS_PIL:
        im = Image.open(img_path).convert('RGB')
        w, h = im.size
        sample = im.resize((200, 200), Image.Resampling.BOX)
        spix = sample.load()
        def get_sp(x, y):
            return spix[x, y]
    else:
        pb = GdkPixbuf.Pixbuf.new_from_file(img_path)
        w, h = pb.get_width(), pb.get_height()
        samp = pb.scale_simple(200, 200, GdkPixbuf.InterpType.BILINEAR)
        sdata = samp.get_pixels()
        srs = samp.get_rowstride()
        sch = samp.get_n_channels()
        def get_sp(x, y):
            i = y * srs + x * sch
            return (sdata[i], sdata[i+1], sdata[i+2])

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
    avail = width - margin * 2
    cell_size = avail / N

    regions = []
    reg_id = 0
    cR = [c[0] for c in centers]
    cG = [c[1] for c in centers]
    cB = [c[2] for c in centers]

    for r in range(N):
        y0 = margin + r * cell_size
        y1 = y0 + cell_size
        cy = (y0 + y1) * 0.5
        for c in range(N):
            pr, pg, pb = grid_rgb[r * N + c]
            best_k = min(range(K), key=lambda k: (pr-cR[k])**2 + (pg-cG[k])**2 + (pb-cB[k])**2)
            palette[best_k]["total_count"] += 1
            num = best_k + 1

            x0 = margin + c * cell_size
            x1 = x0 + cell_size
            cx = (x0 + x1) * 0.5

            regions.append({
                "id": reg_id,
                "number": num,
                "polygon": [
                    {"x": round(x0, 2), "y": round(y0, 2)},
                    {"x": round(x1, 2), "y": round(y0, 2)},
                    {"x": round(x1, 2), "y": round(y1, 2)},
                    {"x": round(x0, 2), "y": round(y1, 2)},
                ],
                "centroid": {"x": round(cx, 2), "y": round(cy, 2)},
                "color_hex": palette[best_k]["hex"],
                "is_filled": False,
                "fill_anim": 0.0
            })
            reg_id += 1

    artwork = {
        "id": output_id,
        "title": title,
        "artist": artist,
        "category": "diamond",
        "width": width,
        "height": height,
        "palette": palette,
        "regions": regions
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
                drill = regions[drill_idx]
                drill_idx += 1
                col_hex = drill["color_hex"].lstrip('#')
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
                drill = regions[drill_idx]
                drill_idx += 1
                col_hex = drill["color_hex"].lstrip('#')
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

    print(f"  [Diamond] {output_id}: {N}x{N} ({len(regions)} drills, {len(palette)} colors)")
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

def convert_to_paint_by_number(img_path, complexity, title, artist, output_id, output_dir):
    json_path = os.path.join(output_dir, f"{output_id}.json")
    thumb_path = os.path.join(output_dir, f"{output_id}_thumb.png")

    presets = {
        'detailed': {'K': 18, 'W': 420, 'min_pixels': 22, 'min_thickness': 2, 'epsilon': 0.44},
        'intricate': {'K': 26, 'W': 540, 'min_pixels': 18, 'min_thickness': 2, 'epsilon': 0.38},
        'masterpiece': {'K': 34, 'W': 660, 'min_pixels': 14, 'min_thickness': 2, 'epsilon': 0.34},
    }
    cfg = presets[complexity]
    K, W, min_pixels, min_thickness, epsilon = (
        cfg['K'], cfg['W'], cfg['min_pixels'], cfg['min_thickness'], cfg['epsilon']
    )

    grid_rgb = load_framed_rgb_grid(img_path, W)
    # Edge-preserving bilateral smoothing
    grid_rgb = bilateral_smooth_rgb(grid_rgb, W, W)

    # Sample pixels for k-means++
    samples = []
    step = max(1, W // 50)
    for y in range(0, W, step):
        for x in range(0, W, step):
            samples.append(grid_rgb[y * W + x])

    centers = kmeans_pp(samples, K, max_iter=12)
    centers.sort(key=lambda c: get_luminance(*c), reverse=True)

    cR = [c[0] for c in centers]
    cG = [c[1] for c in centers]
    cB = [c[2] for c in centers]

    grid = [0] * (W * W)
    for idx, (pr, pg, pb) in enumerate(grid_rgb):
        best_k = min(range(K), key=lambda k: (pr-cR[k])**2 + (pg-cG[k])**2 + (pb-cB[k])**2)
        grid[idx] = best_k

    # 2 passes of majority filter (mode >= 5) to smooth ragged pixel boundaries
    for _ in range(2):
        new_grid = list(grid)
        for y in range(1, W - 1):
            row = y * W
            for x in range(1, W - 1):
                idx = row + x
                cur = grid[idx]
                counts = Counter()
                for dy in (-1, 0, 1):
                    nrow = (y + dy) * W
                    for dx in (-1, 0, 1):
                        counts[grid[nrow + x + dx]] += 1
                dom, count = counts.most_common(1)[0]
                if count >= 5 and dom != cur:
                    new_grid[idx] = dom
        grid = new_grid

    # Morphological cleanup of 1px spurs/hairs
    for _ in range(2):
        for y in range(1, W - 1):
            row = y * W
            for x in range(1, W - 1):
                idx = row + x
                cur = grid[idx]
                orth = [grid[idx - 1], grid[idx + 1], grid[idx - W], grid[idx + W]]
                same = sum(1 for v in orth if v == cur)
                if same <= 1:
                    others = [v for v in orth if v != cur]
                    if others:
                        grid[idx] = Counter(others).most_common(1)[0][0]

    # Watershed neighbor merge: absorb micro-regions (< min_pixels) AND thin 1px outline slivers (< min_thickness)
    for _ in range(6):
        labels = [-1] * (W * W)
        components = []
        next_label = 0
        for y in range(W):
            for x in range(W):
                idx = y * W + x
                if labels[idx] != -1:
                    continue
                color = grid[idx]
                label = next_label
                next_label += 1
                labels[idx] = label

                q = deque([idx])
                comp_pixels = []
                while q:
                    curr = q.popleft()
                    comp_pixels.append(curr)
                    cx = curr % W
                    cy = curr // W
                    if cx > 0 and labels[curr - 1] == -1 and grid[curr - 1] == color:
                        labels[curr - 1] = label
                        q.append(curr - 1)
                    if cx < W - 1 and labels[curr + 1] == -1 and grid[curr + 1] == color:
                        labels[curr + 1] = label
                        q.append(curr + 1)
                    if cy > 0 and labels[curr - W] == -1 and grid[curr - W] == color:
                        labels[curr - W] = label
                        q.append(curr - W)
                    if cy < W - 1 and labels[curr + W] == -1 and grid[curr + W] == color:
                        labels[curr + W] = label
                        q.append(curr + W)
                components.append({'label': label, 'color': color, 'pixels': comp_pixels})

        small_comps = []
        for c in components:
            n_pix = len(c['pixels'])
            if n_pix < min_pixels:
                small_comps.append(c)
            elif n_pix < min_pixels * 5:
                thick, _, _ = get_component_thickness_and_pole(c['pixels'], W, W)
                if thick < min_thickness:
                    small_comps.append(c)

        if not small_comps:
            break
        small_comps.sort(key=lambda c: len(c['pixels']))
        merged_any = False
        for c in small_comps:
            contact = Counter()
            for p in c['pixels']:
                cx = p % W
                cy = p // W
                if cx > 0 and labels[p - 1] != c['label']:
                    contact[grid[p - 1]] += 1
                if cx < W - 1 and labels[p + 1] != c['label']:
                    contact[grid[p + 1]] += 1
                if cy > 0 and labels[p - W] != c['label']:
                    contact[grid[p - W]] += 1
                if cy < W - 1 and labels[p + W] != c['label']:
                    contact[grid[p + W]] += 1
            if not contact:
                continue
            cur_rgb = centers[c['color']]
            def score(cand):
                n_rgb = centers[cand]
                cdist = math.sqrt(sum((a - b)**2 for a, b in zip(cur_rgb, n_rgb)))
                return contact[cand] * 1000 - cdist
            best_col = max(contact.keys(), key=score)
            for p in c['pixels']:
                grid[p] = best_col
            merged_any = True
        if not merged_any:
            break

    valid_components = [c for c in components if len(c['pixels']) >= 4]

    width = 800
    height = 800
    margin = 20
    avail_w = width - margin * 2
    avail_h = height - margin * 2
    scale_x = avail_w / W
    scale_y = avail_h / W
    sq_tol = epsilon * epsilon

    palette = []
    for idx, c in enumerate(centers):
        palette.append({
            "number": idx + 1,
            "hex": rgb_to_hex(*c),
            "name": f"Color #{idx + 1}",
            "total_count": 0,
            "filled_count": 0,
            "is_completed": False
        })

    regions = []
    reg_id = 0

    for comp in valid_components:
        raw_poly = trace_boundary(comp['pixels'], W, W)
        if len(raw_poly) < 3:
            continue
        smoothed = smooth_contour(raw_poly, W, W, sq_tol)
        if len(smoothed) < 3:
            continue

        world_poly = [
            {
                "x": round((margin + pt[0] * scale_x) * 10) / 10,
                "y": round((margin + pt[1] * scale_y) * 10) / 10
            }
            for pt in smoothed
        ]

        thick, cands, dist_map = get_component_thickness_and_pole(comp['pixels'], W, W)
        cx, cy, label_rad = refine_pole_in_poly(cands, world_poly, dist_map, W, margin, scale_x)
        world_centroid = {
            "x": round(cx * 10) / 10,
            "y": round(cy * 10) / 10
        }

        c_num = comp['color'] + 1
        palette[comp['color']]['total_count'] += 1

        regions.append({
            "id": reg_id,
            "number": c_num,
            "polygon": world_poly,
            "centroid": world_centroid,
            "label_radius": round(label_rad * 10) / 10,
            "color_hex": palette[comp['color']]['hex'],
            "is_filled": False,
            "fill_anim": 0.0
        })
        reg_id += 1

    # Re-index active palette colors sequentially
    active_palette = [p for p in palette if p['total_count'] > 0]
    for new_idx, p in enumerate(active_palette):
        old_num = p['number']
        new_num = new_idx + 1
        p['number'] = new_num
        p['name'] = f"Color #{new_num}"
        if old_num != new_num:
            for r in regions:
                if r['number'] == old_num:
                    r['number'] = new_num

    artwork = {
        "id": output_id,
        "title": title,
        "artist": artist,
        "category": "classic",
        "width": width,
        "height": height,
        "palette": active_palette,
        "regions": regions
    }

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(artwork, f, separators=(',', ':'))

    # Render Thumbnail (280x200)
    thumb_w, thumb_h = 280, 200
    ts = 0.22
    tox = (thumb_w - width * ts) / 2
    toy = (thumb_h - height * ts) / 2

    if HAS_PIL:
        thumb_img = Image.new('RGB', (thumb_w, thumb_h), (15, 23, 42))
        draw = ImageDraw.Draw(thumb_img)
        for r in regions:
            poly_pts = [(tox + pt['x'] * ts, toy + pt['y'] * ts) for pt in r['polygon']]
            if len(poly_pts) >= 3:
                hex_c = r['color_hex'].lstrip('#')
                rgb_c = tuple(int(hex_c[i:i+2], 16) for i in (0, 2, 4))
                draw.polygon(poly_pts, fill=rgb_c, outline=(240, 240, 240, 60))
        thumb_img.save(thumb_path, 'PNG')
    else:
        surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, thumb_w, thumb_h)
        ctx = cairo.Context(surf)
        ctx.set_source_rgb(15/255.0, 23/255.0, 42/255.0)
        ctx.paint()
        for r in regions:
            poly_pts = [(tox + pt['x'] * ts, toy + pt['y'] * ts) for pt in r['polygon']]
            if len(poly_pts) >= 3:
                hex_c = r['color_hex'].lstrip('#')
                rgb_c = tuple(int(hex_c[i:i+2], 16) for i in (0, 2, 4))
                ctx.new_path()
                ctx.move_to(poly_pts[0][0], poly_pts[0][1])
                for pt in poly_pts[1:]:
                    ctx.line_to(pt[0], pt[1])
                ctx.close_path()
                ctx.set_source_rgb(rgb_c[0]/255.0, rgb_c[1]/255.0, rgb_c[2]/255.0)
                ctx.fill_preserve()
                ctx.set_source_rgba(0.94, 0.94, 0.94, 0.25)
                ctx.set_line_width(0.8)
                ctx.stroke()
        surf.write_to_png(thumb_path)

    print(f"  [Paint-by-Number] {output_id} ({complexity}): {len(regions)} regions, {len(active_palette)} colors")
    return artwork

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assets_dir = os.path.join(base_dir, "public", "assets")
    output_dir = os.path.join(assets_dir, "converted")
    os.makedirs(output_dir, exist_ok=True)

    catalog = [
        {
            "key": "fluffy_cow",
            "file": "fluffy-cow-3.jpeg",
            "title": "Sweet Highland Calf",
            "artist": "Country Homestead",
            "desc": "Gentle fluffy highland cow calf surrounded by meadow wildflowers and rustic wooden pasture"
        },
        {
            "key": "hummingbird",
            "file": "hummingbird.jpeg",
            "title": "Garden Hummingbird",
            "artist": "Sunlit Meadow",
            "desc": "Vibrant hummingbird sipping sweet nectar among blooming country garden flora"
        },
        {
            "key": "country_barn",
            "file": "country_barn.jpeg",
            "title": "Rustic Red Barn",
            "artist": "Heartland Heritage",
            "desc": "Classic red country barn with silo, split-rail fence, and sunflowers under sunny blue sky"
        },
        {
            "key": "country_rooster",
            "file": "country_rooster.jpeg",
            "title": "Morning Farm Rooster",
            "artist": "Sunrise Farmstead",
            "desc": "Colorful country rooster greeting the morning sun from a rustic fence post"
        },
        {
            "key": "country_truck",
            "file": "country_truck.jpeg",
            "title": "Vintage Harvest Truck",
            "artist": "Country Roads Studio",
            "desc": "Classic turquoise vintage pickup truck filled with harvest pumpkins and sunflowers"
        },
        {
            "key": "country_puppy",
            "file": "country_puppy.jpeg",
            "title": "Porch Golden Puppy",
            "artist": "Cottage Companions",
            "desc": "Adorable golden retriever puppy in a red bandana enjoying a sunny farm morning"
        },
        {
            "key": "yorky_teacup",
            "file": "yorky_teacup.jpeg",
            "title": "Teacup Yorkie Ribbon",
            "artist": "Petite Paws Studio",
            "desc": "Adorable teacup Yorkshire Terrier puppy with pink bow nestled in vintage porcelain"
        },
        {
            "key": "yorky_garden",
            "file": "yorky_garden.jpeg",
            "title": "Garden Blossom Yorkie",
            "artist": "Cottage Petals",
            "desc": "Cheerful Yorkshire Terrier puppy surrounded by blooming pansies and meadow lavender"
        },
        {
            "key": "yorky_autumn",
            "file": "yorky_autumn.jpeg",
            "title": "Cozy Autumn Yorkie",
            "artist": "Harvest Hearth",
            "desc": "Sweet Yorkshire Terrier in a cozy red knit sweater among autumn maple leaves and pumpkins"
        },
        {
            "key": "yorky_playful",
            "file": "yorky_playful.jpeg",
            "title": "Playful Meadow Yorkie",
            "artist": "Sunny Pastures",
            "desc": "Joyful Yorkshire Terrier puppy in a polka dot bandana playing with a ball in buttercups"
        },
        {
            "key": "rural_windmill",
            "file": "rural_windmill.jpeg",
            "title": "Prairie Windmill Sunset",
            "artist": "Heartland Horizons",
            "desc": "Classic American farm windmill standing tall above golden wheat fields and prairie sunflowers"
        },
        {
            "key": "country_store",
            "file": "country_store.jpeg",
            "title": "Old Country Store",
            "artist": "Heritage Homestead",
            "desc": "Charming general store with wooden porch, rocking chairs, bushel of apples, and hanging lanterns"
        },
        {
            "key": "pasture_horses",
            "file": "pasture_horses.jpeg",
            "title": "Pasture Mare & Foal",
            "artist": "Meadow Run Stables",
            "desc": "Loving chestnut farm mare and playful young foal beside a rustic split-rail pasture fence"
        },
        {
            "key": "vintage_tractor",
            "file": "vintage_tractor.jpeg",
            "title": "Heartland Antique Tractor",
            "artist": "Country Roads Studio",
            "desc": "Classic vintage farm tractor in vibrant green and yellow beside summer cornfields and harvest crates"
        },
        {
            "key": "covered_bridge",
            "file": "covered_bridge.jpeg",
            "title": "Rustic Covered Bridge",
            "artist": "Valley Stream Folk",
            "desc": "Historic red wooden covered bridge spanning a peaceful babbling stream surrounded by wildflowers"
        }
    ]

    diamond_resolutions = [
        {"name": "Cozy (6.4k)", "grid": 80, "colors": 18, "suffix": "80", "label": "80×80"},
        {"name": "Standard (14.4k)", "grid": 120, "colors": 26, "suffix": "120", "label": "120×120"},
        {"name": "Masterpiece (25.6k)", "grid": 160, "colors": 36, "suffix": "160", "label": "160×160"},
    ]

    pbn_resolutions = [
        {"name": "Detailed (800+)", "complexity": "detailed", "suffix": "detailed", "label": "Detailed"},
        {"name": "Intricate (2,000+)", "complexity": "intricate", "suffix": "intricate", "label": "Intricate"},
        {"name": "Masterpiece (4,000+)", "complexity": "masterpiece", "suffix": "masterpiece", "label": "Masterpiece"},
    ]

    pbn_only = '--pbn-only' in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    target_key = args[0].strip() if args else None

    manifest_path = os.path.join(output_dir, "manifest.json")
    manifest_map = {}
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                for entry in json.load(f):
                    manifest_map[entry["key"]] = entry
        except Exception as e:
            print(f"Warning: could not read existing manifest ({e})")

    for item in catalog:
        if target_key and item["key"] != target_key:
            continue

        img_path = os.path.join(assets_dir, item["file"])
        if not os.path.exists(img_path):
            print(f"Skipping {img_path}: file not found")
            continue

        print(f"\nProcessing '{item['title']}' ({item['file']}):")

        # 1. Diamond Art at 3 resolutions
        if pbn_only and item["key"] in manifest_map and "diamondVariants" in manifest_map[item["key"]]:
            diamond_variants = manifest_map[item["key"]]["diamondVariants"]
        else:
            diamond_variants = []
            for d_res in diamond_resolutions:
                art_id = f"{item['key']}_diamond_{d_res['suffix']}"
                variant_title = f"{item['title']} ({d_res['name']} Diamond)"
                art = convert_to_diamond_art(
                    img_path=img_path,
                    N=d_res["grid"],
                    K=d_res["colors"],
                    title=variant_title,
                    artist=item["artist"],
                    output_id=art_id,
                    output_dir=output_dir
                )
                diamond_variants.append({
                    "id": art_id,
                    "resolution": d_res["name"],
                    "label": d_res["label"],
                    "grid": d_res["grid"],
                    "pieces": len(art["regions"]),
                    "colors": len(art["palette"]),
                    "jsonFile": f"assets/converted/{art_id}.json",
                    "thumbnailUrl": f"assets/converted/{art_id}_thumb.png",
                })

        # 2. Paint-by-Number at 3 resolutions
        pbn_variants = []
        for p_res in pbn_resolutions:
            art_id = f"{item['key']}_pbn_{p_res['suffix']}"
            variant_title = f"{item['title']} ({p_res['name']})"
            art = convert_to_paint_by_number(
                img_path=img_path,
                complexity=p_res["complexity"],
                title=variant_title,
                artist=item["artist"],
                output_id=art_id,
                output_dir=output_dir
            )
            pbn_variants.append({
                "id": art_id,
                "resolution": p_res["name"],
                "complexity": p_res["complexity"],
                "pieces": len(art["regions"]),
                "colors": len(art["palette"]),
                "jsonFile": f"assets/converted/{art_id}.json",
                "thumbnailUrl": f"assets/converted/{art_id}_thumb.png",
            })

        manifest_map[item["key"]] = {
            "key": item["key"],
            "title": item["title"],
            "artist": item["artist"],
            "desc": item["desc"],
            "originalAsset": f"assets/{item['file']}",
            "diamondVariants": diamond_variants,
            "pbnVariants": pbn_variants,
        }

    ordered_manifest = []
    for item in catalog:
        if item["key"] in manifest_map:
            ordered_manifest.append(manifest_map[item["key"]])
    for k, v in manifest_map.items():
        if not any(item["key"] == k for item in catalog):
            ordered_manifest.append(v)

    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(ordered_manifest, f, indent=2)
    print(f"\nManifest saved to {manifest_path} with {len(ordered_manifest)} gallery entries.")

if __name__ == '__main__':
    main()
