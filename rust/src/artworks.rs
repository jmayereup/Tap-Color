use crate::models::{ArtworkData, PaletteItem, Point, Region};

pub fn load_artwork(_id: &str) -> ArtworkData {
    generate_procedural_mosaic(42, "sunset")
}

pub fn generate_procedural_mosaic(seed: u32, palette_type: &str) -> ArtworkData {
    let width = 800.0;
    let height = 800.0;

    let palette_colors = match palette_type {
        "sunset" => vec![
            (1, "#FF5964", "Coral Red"),
            (2, "#F48668", "Peach Orange"),
            (3, "#F7D070", "Sunbeam Yellow"),
            (4, "#E2847A", "Dusty Rose"),
            (5, "#805E73", "Twilight Violet"),
            (6, "#4D4861", "Midnight Slate"),
            (7, "#352D39", "Deep Obsidian"),
        ],
        "emerald" => vec![
            (1, "#2EC4B6", "Bright Turquoise"),
            (2, "#0E9594", "Ocean Teal"),
            (3, "#006466", "Deep Forest"),
            (4, "#212F45", "Abyssal Navy"),
            (5, "#70C1B3", "Seafoam Green"),
            (6, "#B2DBBF", "Mint Frost"),
            (7, "#F3FFBD", "Lime Glow"),
        ],
        _ => vec![
            (1, "#FF6B6B", "Flamingo Pink"),
            (2, "#4ECDC4", "Tiffany Turquoise"),
            (3, "#FFE66D", "Electric Lemon"),
            (4, "#1A535C", "Nordic Pine"),
            (5, "#FF9F1C", "Vibrant Amber"),
            (6, "#9D4EDD", "Neon Amethyst"),
            (7, "#F72585", "Cyber Magenta"),
        ],
    };

    // Deterministic LCG pseudo-random generator
    let mut state = seed.max(1) as u64;
    let mut rand_f64 = || {
        state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        ((state >> 32) as u32 as f64) / (u32::MAX as f64)
    };

    let cols = 8;
    let rows = 8;
    let cell_w = width / cols as f64;
    let cell_h = height / rows as f64;

    // Generate grid points with jitter
    let mut grid_points = Vec::with_capacity((rows + 1) * (cols + 1));
    for r in 0..=rows {
        for c in 0..=cols {
            let base_x = c as f64 * cell_w;
            let base_y = r as f64 * cell_h;
            let jx = if c == 0 || c == cols { 0.0 } else { (rand_f64() - 0.5) * cell_w * 0.6 };
            let jy = if r == 0 || r == rows { 0.0 } else { (rand_f64() - 0.5) * cell_h * 0.6 };
            grid_points.push(Point::new(base_x + jx, base_y + jy));
        }
    }

    let mut regions = Vec::with_capacity(rows * cols * 2);
    let mut region_id = 0;

    for r in 0..rows {
        for c in 0..cols {
            let p00 = grid_points[r * (cols + 1) + c];
            let p10 = grid_points[r * (cols + 1) + (c + 1)];
            let p01 = grid_points[(r + 1) * (cols + 1) + c];
            let p11 = grid_points[(r + 1) * (cols + 1) + (c + 1)];

            let color_idx1 = ((rand_f64() * palette_colors.len() as f64).floor() as usize) % palette_colors.len();
            let color1 = palette_colors[color_idx1];
            let poly1 = vec![p00, p10, p11];
            let cent1 = Region::calculate_centroid(&poly1);
            let mut reg1 = Region {
                id: region_id,
                number: color1.0,
                polygon: poly1,
                centroid: cent1,
                holes: Vec::new(),
                label_radius: 0.0,
                color_hex: color1.1.to_string(),
                is_filled: false,
                fill_anim: 0.0,
                bbox: (0.0, 0.0, 0.0, 0.0),
            };
            reg1.compute_bbox();
            regions.push(reg1);
            region_id += 1;

            let color_idx2 = ((rand_f64() * palette_colors.len() as f64).floor() as usize) % palette_colors.len();
            let color2 = palette_colors[color_idx2];
            let poly2 = vec![p00, p11, p01];
            let cent2 = Region::calculate_centroid(&poly2);
            let mut reg2 = Region {
                id: region_id,
                number: color2.0,
                polygon: poly2,
                centroid: cent2,
                holes: Vec::new(),
                label_radius: 0.0,
                color_hex: color2.1.to_string(),
                is_filled: false,
                fill_anim: 0.0,
                bbox: (0.0, 0.0, 0.0, 0.0),
            };
            reg2.compute_bbox();
            regions.push(reg2);
            region_id += 1;
        }
    }

    // Build palette summary, omitting unused colors so no 0/0 swatches appear
    let palette = palette_colors
        .iter()
        .filter_map(|(num, hex, name)| {
            let total = regions.iter().filter(|r| r.number == *num).count();
            if total == 0 {
                None
            } else {
                Some(PaletteItem {
                    number: *num,
                    hex: hex.to_string(),
                    name: name.to_string(),
                    total_count: total,
                    filled_count: 0,
                    is_completed: false,
                })
            }
        })
        .collect();

    ArtworkData {
        id: format!("mosaic_{}_{}", seed, palette_type),
        title: format!("Surprise Mosaic #{}", seed % 1000),
        artist: "Surprise Pattern".to_string(),
        width,
        height,
        line_art_url: None,
        color_art_url: None,
        palette,
        regions,
    }
}
