#!/usr/bin/env python3
"""
Tap Color - Batch Artwork Converter
Converts original images in assets/ to Paint-by-Number and Diamond Art
at 3 different resolutions each for country life & Christian themes.
"""

import os
import sys
import json
import math
from collections import deque, Counter
from PIL import Image, ImageDraw, ImageFilter

def rgb_to_hex(r, g, b):
    return f"#{r:02X}{g:02X}{b:02X}"

def get_luminance(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b

import random

def detect_content_bounds(im):
    w, h = im.size
    sample = im.resize((200, 200), Image.Resampling.BOX)
    pix = sample.load()
    corners = [pix[1, 1], pix[198, 1], pix[1, 198], pix[198, 198]]
    def is_bg(c):
        return c[0] > 240 and c[1] > 240 and c[2] > 240
    if not all(is_bg(c) for c in corners):
        return 0, 0, w, h
    min_x, max_x, min_y, max_y = 200, 0, 200, 0
    non_bg = 0
    for y in range(200):
        for x in range(200):
            c = pix[x, y]
            if not is_bg(c):
                if x < min_x: min_x = x
                if x > max_x: max_x = x
                if y < min_y: min_y = y
                if y > max_y: max_y = y
                non_bg += 1
    if non_bg < 50 or max_x <= min_x or max_y <= min_y:
        return 0, 0, w, h
    scale_x = w / 200.0
    scale_y = h / 200.0
    rx0, rx1 = min_x * scale_x, max_x * scale_x
    ry0, ry1 = min_y * scale_y, max_y * scale_y
    cw, ch = rx1 - rx0, ry1 - ry0
    pad_x = cw * 0.04
    pad_y = ch * 0.04
    sx = max(0, int(rx0 - pad_x))
    sy = max(0, int(ry0 - pad_y))
    sw = min(w - sx, int(cw + pad_x * 2))
    sh = min(h - sy, int(ch + pad_y * 2))
    return sx, sy, sw, sh

def prepare_framed_image(im, target_size):
    sx, sy, sw, sh = detect_content_bounds(im)
    cropped = im.crop((sx, sy, sx + sw, sy + sh))
    scale = min(target_size / sw, target_size / sh)
    dw = int(round(sw * scale))
    dh = int(round(sh * scale))
    resized = cropped.resize((dw, dh), Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', (target_size, target_size), (255, 255, 255))
    dx = (target_size - dw) // 2
    dy = (target_size - dh) // 2
    canvas.paste(resized, (dx, dy))
    return canvas

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

    im = Image.open(img_path).convert('RGB')
    im_framed = prepare_framed_image(im, N)
    
    # Subsample pixels for k-means++ color clustering
    samples = []
    pix = im_framed.load()
    sample_step = max(1, N // 30)
    for y in range(0, N, sample_step):
        for x in range(0, N, sample_step):
            samples.append(pix[x, y])
            
    centers = kmeans_pp(samples, K, max_iter=12)
    # Sort palette colors by perceived brightness (descending)
    centers.sort(key=lambda c: get_luminance(*c), reverse=True)
    
    # Build Palette list
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
            pr, pg, pb = pix[c, r]
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
    
    # Save JSON
    json_path = os.path.join(output_dir, f"{output_id}.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(artwork, f, separators=(',', ':'))
        
    # Render Thumbnail (280x200)
    thumb_w, thumb_h = 280, 200
    thumb_img = Image.new('RGB', (thumb_w, thumb_h), (15, 23, 42))
    draw = ImageDraw.Draw(thumb_img)
    t_margin = 12
    t_avail_w = thumb_w - t_margin * 2
    t_avail_h = thumb_h - t_margin * 2
    t_cell = min(t_avail_w / N, t_avail_h / N)
    t_ox = (thumb_w - N * t_cell) / 2
    t_oy = (thumb_h - N * t_cell) / 2
    
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
            # subtle shine highlight
            draw.rectangle([x0, y0, x0 + t_cell * 0.4, y0 + t_cell * 0.4], fill=(min(255, col[0]+50), min(255, col[1]+50), min(255, col[2]+50)))
            
    thumb_path = os.path.join(output_dir, f"{output_id}_thumb.png")
    thumb_img.save(thumb_path, 'PNG')
    
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
    dx = p[0] - x
    dy = p[1] - y
    return dx * dx + dy * dy

def simplify_dp(points, sq_tol):
    if len(points) <= 2:
        return points
    
    # Iterative stack-based Douglas-Peucker algorithm
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

def chaikin_smooth(points, iters=1):
    if len(points) < 3:
        return points
    curr = points
    for _ in range(iters):
        nxt = []
        n = len(curr)
        for i in range(n):
            p1 = curr[i]
            p2 = curr[(i + 1) % n]
            nxt.append((p1[0] * 0.85 + p2[0] * 0.15, p1[1] * 0.85 + p2[1] * 0.15))
            nxt.append((p1[0] * 0.15 + p2[0] * 0.85, p1[1] * 0.15 + p2[1] * 0.85))
        curr = nxt
    return curr

def trace_boundary(comp_pixels, W, H):
    pix_set = set(comp_pixels)
    edge_map = {}
    first_edge = None
    
    for p in comp_pixels:
        px = p % W
        py = p // W
        # Top
        if (p - W) not in pix_set:
            edge_map[(px, py)] = (px + 1, py)
            if first_edge is None:
                first_edge = ((px, py), (px + 1, py))
        # Right
        if (p + 1) not in pix_set:
            edge_map[(px + 1, py)] = (px + 1, py + 1)
            if first_edge is None:
                first_edge = ((px + 1, py), (px + 1, py + 1))
        # Bottom
        if (p + W) not in pix_set:
            edge_map[(px + 1, py + 1)] = (px, py + 1)
            if first_edge is None:
                first_edge = ((px + 1, py + 1), (px, py + 1))
        # Left
        if (p - 1) not in pix_set:
            edge_map[(px, py + 1)] = (px, py)
            if first_edge is None:
                first_edge = ((px, py + 1), (px, py))
                
    if not first_edge:
        return []
        
    poly = []
    curr = first_edge[0]
    start_pt = curr
    max_loops = len(comp_pixels) * 4 + 100
    loops = 0
    
    while loops < max_loops:
        poly.append(curr)
        nxt = edge_map.get(curr)
        if not nxt:
            break
        curr = nxt
        loops += 1
        if curr == start_pt:
            break
    return poly

def calc_internal_centroid(comp_pixels, W):
    sum_x = sum(p % W for p in comp_pixels)
    sum_y = sum(p // W for p in comp_pixels)
    n = len(comp_pixels)
    mx = round(sum_x / n)
    my = round(sum_y / n)
    pix_set = set(comp_pixels)
    if (my * W + mx) in pix_set:
        return mx, my
    best_dist = float('inf')
    bx, by = comp_pixels[0] % W, comp_pixels[0] // W
    for p in comp_pixels:
        px = p % W
        py = p // W
        d = (px - mx)**2 + (py - my)**2
        if d < best_dist:
            best_dist = d
            bx, by = px, py
    return bx, by

def convert_to_paint_by_number(img_path, complexity, title, artist, output_id, output_dir):
    json_path = os.path.join(output_dir, f"{output_id}.json")
    thumb_path = os.path.join(output_dir, f"{output_id}_thumb.png")

    presets = {
        'detailed': {'K': 16, 'W': 320, 'min_pixels': 22, 'epsilon': 0.70},
        'intricate': {'K': 24, 'W': 360, 'min_pixels': 14, 'epsilon': 0.60},
        'masterpiece': {'K': 32, 'W': 420, 'min_pixels': 10, 'epsilon': 0.50},
    }
    cfg = presets[complexity]
    K, W, min_pixels, epsilon = cfg['K'], cfg['W'], cfg['min_pixels'], cfg['epsilon']
    
    im = Image.open(img_path).convert('RGB')
    im_framed = prepare_framed_image(im, W)
    im_smoothed = im_framed.filter(ImageFilter.MedianFilter(size=3))
    
    # Sample pixels for k-means++
    samples = []
    pix = im_smoothed.load()
    step = max(1, W // 40)
    for y in range(0, W, step):
        for x in range(0, W, step):
            samples.append(pix[x, y])
            
    centers = kmeans_pp(samples, K, max_iter=12)
    # Sort palette colors by perceived brightness (descending)
    centers.sort(key=lambda c: get_luminance(*c), reverse=True)
    
    cR = [c[0] for c in centers]
    cG = [c[1] for c in centers]
    cB = [c[2] for c in centers]
    
    grid = [0] * (W * W)
    for y in range(W):
        for x in range(W):
            pr, pg, pb = pix[x, y]
            best_k = min(range(K), key=lambda k: (pr-cR[k])**2 + (pg-cG[k])**2 + (pb-cB[k])**2)
            grid[y * W + x] = best_k
            
    # Majority filter (speckle cleaning)
    for _ in range(2):
        new_grid = list(grid)
        for y in range(1, W - 1):
            for x in range(1, W - 1):
                idx = y * W + x
                cur = grid[idx]
                counts = Counter()
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        counts[grid[(y + dy) * W + (x + dx)]] += 1
                dom, count = counts.most_common(1)[0]
                if count >= 6 and dom != cur:
                    new_grid[idx] = dom
        grid = new_grid
        
    # Watershed neighbor merge: absorb micro-regions (< min_pixels) into adjacent neighbors
    for _ in range(5):
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
        
        small_comps = [c for c in components if len(c['pixels']) < min_pixels]
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
            
    # Filter valid components (100% planar partition, zero dropped holes)
    valid_components = [c for c in components if len(c['pixels']) >= 3]
    
    width = 800
    height = 800
    margin = 20
    avail_w = width - margin * 2
    avail_h = height - margin * 2
    scale_x = avail_w / W
    scale_y = avail_h / W
    sq_tol = epsilon * epsilon
    
    # Initialize palette
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
        simplified = simplify_dp(raw_poly, sq_tol)
        if len(simplified) < 3:
            continue
        smoothed = chaikin_smooth(simplified, 1)
        
        world_poly = [
            {
                "x": round((margin + pt[0] * scale_x) * 10) / 10,
                "y": round((margin + pt[1] * scale_y) * 10) / 10
            }
            for pt in smoothed
        ]
        
        ix, iy = calc_internal_centroid(comp['pixels'], W)
        world_centroid = {
            "x": round((margin + ix * scale_x) * 10) / 10,
            "y": round((margin + iy * scale_y) * 10) / 10
        }
        
        c_num = comp['color'] + 1
        palette[comp['color']]['total_count'] += 1
        
        regions.append({
            "id": reg_id,
            "number": c_num,
            "polygon": world_poly,
            "centroid": world_centroid,
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
    
    # Save JSON
    json_path = os.path.join(output_dir, f"{output_id}.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(artwork, f, separators=(',', ':'))
        
    # Render Thumbnail (280x200)
    thumb_w, thumb_h = 280, 200
    thumb_img = Image.new('RGB', (thumb_w, thumb_h), (15, 23, 42))
    draw = ImageDraw.Draw(thumb_img)
    ts = 0.22
    tox = (thumb_w - width * ts) / 2
    toy = (thumb_h - height * ts) / 2
    
    for r in regions:
        poly_pts = [(tox + pt['x'] * ts, toy + pt['y'] * ts) for pt in r['polygon']]
        if len(poly_pts) >= 3:
            hex_c = r['color_hex'].lstrip('#')
            rgb_c = tuple(int(hex_c[i:i+2], 16) for i in (0, 2, 4))
            draw.polygon(poly_pts, fill=rgb_c, outline=(240, 240, 240, 60))
            
    thumb_path = os.path.join(output_dir, f"{output_id}_thumb.png")
    thumb_img.save(thumb_path, 'PNG')
    
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
    
    target_key = sys.argv[1].strip() if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else None
    
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

    # Order manifest according to catalog ordering
    ordered_manifest = []
    for item in catalog:
        if item["key"] in manifest_map:
            ordered_manifest.append(manifest_map[item["key"]])
    # Append any extra existing entries that might not be in catalog
    for k, v in manifest_map.items():
        if not any(item["key"] == k for item in catalog):
            ordered_manifest.append(v)
        
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(ordered_manifest, f, indent=2)
    print(f"\nManifest saved to {manifest_path} with {len(ordered_manifest)} gallery entries.")

if __name__ == '__main__':
    main()
