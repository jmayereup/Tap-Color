#!/usr/bin/env python3
"""
Tap Color - Batch Artwork Converter
Converts original images in assets/ to Paint-by-Number and Diamond Art
at 3 different resolutions each for country life & Christian themes.
"""

import os
import json
import math
from collections import deque, Counter
from PIL import Image, ImageDraw, ImageFilter

def rgb_to_hex(r, g, b):
    return f"#{r:02X}{g:02X}{b:02X}"

def get_luminance(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b

# --- Diamond Art Generator ---
def convert_to_diamond_art(img_path, N, K, title, artist, output_id, output_dir):
    json_path = os.path.join(output_dir, f"{output_id}.json")
    thumb_path = os.path.join(output_dir, f"{output_id}_thumb.png")
    if os.path.exists(json_path) and os.path.exists(thumb_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            artwork = json.load(f)
        print(f"  [Diamond] {output_id} (cached): {len(artwork['regions'])} drills")
        return artwork

    im = Image.open(img_path).convert('RGB')
    # Resize to N x N
    im_resized = im.resize((N, N), Image.Resampling.LANCZOS)
    
    # Adaptive palette quantization
    quant = im_resized.convert('P', palette=Image.ADAPTIVE, colors=K)
    raw_pal = quant.getpalette()[:K*3]
    centers = [tuple(raw_pal[i:i+3]) for i in range(0, len(raw_pal), 3)]
    
    # Sort palette colors by perceived brightness (descending)
    indexed_centers = list(enumerate(centers))
    indexed_centers.sort(key=lambda item: get_luminance(*item[1]), reverse=True)
    
    # Remap old indices to new sorted indices (0-indexed)
    remap = {old_idx: new_idx for new_idx, (old_idx, _) in enumerate(indexed_centers)}
    sorted_centers = [c for _, c in indexed_centers]
    
    # Build Palette list
    palette = []
    for idx, c in enumerate(sorted_centers):
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
    quant_pixels = quant.load()
    
    for r in range(N):
        y0 = margin + r * cell_size
        y1 = y0 + cell_size
        cy = (y0 + y1) * 0.5
        for c in range(N):
            raw_idx = quant_pixels[c, r]
            if raw_idx >= len(centers):
                raw_idx = 0
            new_idx = remap.get(raw_idx, 0)
            palette[new_idx]["total_count"] += 1
            num = new_idx + 1
            
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
                "color_hex": palette[new_idx]["hex"],
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
    
    for r in range(N):
        for c in range(N):
            raw_idx = quant_pixels[c, r]
            new_idx = remap.get(raw_idx, 0)
            col = sorted_centers[new_idx]
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
            nxt.append((p1[0] * 0.75 + p2[0] * 0.25, p1[1] * 0.75 + p2[1] * 0.25))
            nxt.append((p1[0] * 0.25 + p2[0] * 0.75, p1[1] * 0.25 + p2[1] * 0.75))
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
    if os.path.exists(json_path) and os.path.exists(thumb_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            artwork = json.load(f)
        print(f"  [Paint-by-Number] {output_id} (cached): {len(artwork['regions'])} regions, {len(artwork['palette'])} colors")
        return artwork

    presets = {
        'detailed': {'K': 20, 'W': 320, 'min_pixels': 20, 'epsilon': 0.95},
        'intricate': {'K': 28, 'W': 400, 'min_pixels': 12, 'epsilon': 0.70},
        'masterpiece': {'K': 36, 'W': 480, 'min_pixels': 8, 'epsilon': 0.50},
    }
    cfg = presets[complexity]
    K, W, min_pixels, epsilon = cfg['K'], cfg['W'], cfg['min_pixels'], cfg['epsilon']
    
    im = Image.open(img_path).convert('RGB')
    im_resized = im.resize((W, W), Image.Resampling.LANCZOS)
    im_smoothed = im_resized.filter(ImageFilter.GaussianBlur(radius=1.2))
    
    quant = im_smoothed.convert('P', palette=Image.ADAPTIVE, colors=K)
    raw_pal = quant.getpalette()[:K*3]
    centers = [tuple(raw_pal[i:i+3]) for i in range(0, len(raw_pal), 3)]
    
    # Sort palette by perceived brightness (descending)
    indexed_centers = list(enumerate(centers))
    indexed_centers.sort(key=lambda item: get_luminance(*item[1]), reverse=True)
    remap = {old_idx: new_idx for new_idx, (old_idx, _) in enumerate(indexed_centers)}
    sorted_centers = [c for _, c in indexed_centers]
    
    pixels = quant.load()
    grid = [0] * (W * W)
    for y in range(W):
        for x in range(W):
            raw_idx = pixels[x, y]
            grid[y * W + x] = remap.get(raw_idx, 0)
            
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
        
    # Connected component labeling (BFS)
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
                
                # Check 4 neighbors
                if cx > 0:
                    left = curr - 1
                    if labels[left] == -1 and grid[left] == color:
                        labels[left] = label
                        q.append(left)
                if cx < W - 1:
                    right = curr + 1
                    if labels[right] == -1 and grid[right] == color:
                        labels[right] = label
                        q.append(right)
                if cy > 0:
                    up = curr - W
                    if labels[up] == -1 and grid[up] == color:
                        labels[up] = label
                        q.append(up)
                if cy < W - 1:
                    down = curr + W
                    if labels[down] == -1 and grid[down] == color:
                        labels[down] = label
                        q.append(down)
                        
            components.append({'label': label, 'color': color, 'pixels': comp_pixels})
            
    # Filter valid components
    valid_components = [c for c in components if len(c['pixels']) >= min_pixels]
    
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
    for idx, c in enumerate(sorted_centers):
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
    assets_dir = "/home/jmayer/Dev/Tap-Color/assets"
    output_dir = "/home/jmayer/Dev/Tap-Color/assets/converted"
    os.makedirs(output_dir, exist_ok=True)
    
    catalog = [
        {
            "key": "country_chapel",
            "file": "country_chapel.jpg",
            "title": "Country Chapel in Meadow",
            "artist": "Heartland Faith Studio",
            "desc": "Little white country chapel with steeple & cross, grazing sheep, sunflowers, and split-rail fence bathed in morning rays"
        },
        {
            "key": "good_shepherd",
            "file": "good_shepherd.jpg",
            "title": "The Lord is My Shepherd",
            "artist": "Psalm 23 Heritage",
            "desc": "Peaceful rolling pasture with mother sheep and lambs resting beside still waters and stone bridge"
        },
        {
            "key": "country_porch_bible",
            "file": "country_porch_bible.jpg",
            "title": "Devotions on the Porch",
            "artist": "Country Cottage Morning",
            "desc": "Open Holy Bible, reading glasses, wild garden bouquet, and quilt on a rustic rocking chair overlooking red barn"
        },
        {
            "key": "cross_and_dogwood",
            "file": "cross_and_dogwood.jpg",
            "title": "Old Rugged Cross & Dogwoods",
            "artist": "Grace & Glory Studio",
            "desc": "Handcrafted timber cross adorned with blooming dogwoods and wild roses overlooking tranquil valley at sunrise"
        },
        {
            "key": "fluffy_cow",
            "file": "fluffy-cow-3.jpeg",
            "title": "Sweet Highland Calf",
            "artist": "Country Homestead",
            "desc": "Gentle fluffy highland cow calf surrounded by meadow wildflowers and rustic wooden pasture"
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
    
    manifest = []
    
    for item in catalog:
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
            
        manifest.append({
            "key": item["key"],
            "title": item["title"],
            "artist": item["artist"],
            "desc": item["desc"],
            "originalAsset": f"assets/{item['file']}",
            "diamondVariants": diamond_variants,
            "pbnVariants": pbn_variants,
        })
        
    manifest_path = os.path.join(output_dir, "manifest.json")
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    print(f"\nManifest saved to {manifest_path} with {len(manifest)} gallery entries.")

if __name__ == '__main__':
    main()
