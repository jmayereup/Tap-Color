use crate::models::{ArtworkData, PaletteItem, Point, Region};

#[allow(dead_code)]
pub fn get_available_artwork_ids() -> Vec<(&'static str, &'static str)> {
    vec![
        ("starry_night_diamond", "Van Gogh: Starry Night (Diamond Art)"),
        ("peacock_diamond", "Royal Crystal Peacock (Diamond Art)"),
        ("sakura_pagoda_diamond", "Mount Fuji & Sakura Pagoda (Diamond Art)"),
        ("cosmic_wolf_diamond", "Cosmic Aurora Wolf (Diamond Art)"),
        ("lotus_koi_diamond", "Zen Lotus & Golden Koi (Diamond Art)"),
        ("hummingbird", "Origami Hummingbird & Blossoms"),
        ("cosmic_whale", "Cosmic Whale & Constellations"),
        ("stained_butterfly", "Monarch Butterfly"),
        ("sunset_landscape", "Geometric Sunset Mountains"),
    ]
}

pub fn load_artwork(id: &str) -> ArtworkData {
    match id {
        "starry_night_diamond" => generate_starry_night_diamond(),
        "peacock_diamond" => generate_peacock_diamond(),
        "sakura_pagoda_diamond" => generate_sakura_pagoda_diamond(),
        "cosmic_wolf_diamond" => generate_cosmic_wolf_diamond(),
        "lotus_koi_diamond" => generate_lotus_koi_diamond(),
        "hummingbird" => generate_hummingbird(),
        "cosmic_whale" => generate_cosmic_whale(),
        "stained_butterfly" => generate_stained_butterfly(),
        "sunset_landscape" => generate_sunset_landscape(),
        _ => generate_starry_night_diamond(),
    }
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

    let mut regions = Vec::new();
    let mut region_id = 0;

    for r in 0..rows {
        for c in 0..cols {
            let p00 = grid_points[r * (cols + 1) + c];
            let p10 = grid_points[r * (cols + 1) + (c + 1)];
            let p01 = grid_points[(r + 1) * (cols + 1) + c];
            let p11 = grid_points[(r + 1) * (cols + 1) + (c + 1)];

            // Split quad into two triangles
            let color_idx1 = ((rand_f64() * palette_colors.len() as f64).floor() as usize) % palette_colors.len();
            let color1 = palette_colors[color_idx1];

            let poly1 = vec![p00, p10, p11];
            let cent1 = Region::calculate_centroid(&poly1);
            regions.push(Region {
                id: region_id,
                number: color1.0,
                polygon: poly1,
                centroid: cent1,
                color_hex: color1.1.to_string(),
                is_filled: false,
                fill_anim: 0.0,
            });
            region_id += 1;

            let color_idx2 = ((rand_f64() * palette_colors.len() as f64).floor() as usize) % palette_colors.len();
            let color2 = palette_colors[color_idx2];

            let poly2 = vec![p00, p11, p01];
            let cent2 = Region::calculate_centroid(&poly2);
            regions.push(Region {
                id: region_id,
                number: color2.0,
                polygon: poly2,
                centroid: cent2,
                color_hex: color2.1.to_string(),
                is_filled: false,
                fill_anim: 0.0,
            });
            region_id += 1;
        }
    }

    // Build palette summary
    let palette = palette_colors
        .iter()
        .map(|(num, hex, name)| {
            let total = regions.iter().filter(|r| r.number == *num).count();
            PaletteItem {
                number: *num,
                hex: hex.to_string(),
                name: name.to_string(),
                total_count: total,
                filled_count: 0,
                is_completed: false,
            }
        })
        .collect();

    ArtworkData {
        id: format!("mosaic_{}_{}", seed, palette_type),
        title: format!("Surprise Mosaic #{}", seed % 1000),
        artist: "Surprise Pattern".to_string(),
        width,
        height,
        palette,
        regions,
    }
}

/// Hand-crafted Artwork 1: Origami Hummingbird & Blossoms
fn generate_hummingbird() -> ArtworkData {
    let width = 800.0;
    let height = 800.0;

    let palette_def = vec![
        (1, "#E63946", "Ruby Crimson"),
        (2, "#F4A261", "Warm Apricot"),
        (3, "#E76F51", "Coral Rust"),
        (4, "#2A9D8F", "Emerald Teal"),
        (5, "#48CAE4", "Sky Blue"),
        (6, "#0077B6", "Deep Cerulean"),
        (7, "#90BE6D", "Fresh Lime"),
        (8, "#43AA8B", "Jade Green"),
        (9, "#577590", "Slate Feather"),
        (10, "#F72585", "Sakura Pink"),
        (11, "#B5179E", "Orchid Violet"),
        (12, "#FFE5D9", "Petal Blush"),
    ];

    let mut regions = Vec::new();
    let mut add_poly = |num: usize, pts: Vec<(f64, f64)>| {
        let hex = palette_def
            .iter()
            .find(|(n, _, _)| *n == num)
            .map(|(_, h, _)| *h)
            .unwrap_or("#CCCCCC");

        let poly: Vec<Point> = pts.into_iter().map(|(x, y)| Point::new(x, y)).collect();
        let centroid = Region::calculate_centroid(&poly);
        let id = regions.len();
        regions.push(Region {
            id,
            number: num,
            polygon: poly,
            centroid,
            color_hex: hex.to_string(),
            is_filled: false,
            fill_anim: 0.0,
        });
    };

    // --- BEAK ---
    add_poly(9, vec![(180.0, 310.0), (330.0, 335.0), (325.0, 342.0)]);
    add_poly(9, vec![(180.0, 310.0), (325.0, 342.0), (310.0, 350.0)]);

    // --- HEAD ---
    add_poly(4, vec![(330.0, 335.0), (380.0, 300.0), (395.0, 330.0), (335.0, 345.0)]);
    add_poly(4, vec![(380.0, 300.0), (430.0, 315.0), (420.0, 345.0), (395.0, 330.0)]);
    add_poly(5, vec![(335.0, 345.0), (395.0, 330.0), (385.0, 370.0)]); // Eye cheek
    add_poly(9, vec![(365.0, 330.0), (375.0, 325.0), (380.0, 335.0), (370.0, 340.0)]); // Eye pupil

    // --- THROAT (RUBY GORGET) ---
    add_poly(1, vec![(335.0, 345.0), (385.0, 370.0), (355.0, 400.0)]);
    add_poly(1, vec![(385.0, 370.0), (415.0, 390.0), (375.0, 420.0), (355.0, 400.0)]);
    add_poly(2, vec![(415.0, 390.0), (455.0, 400.0), (420.0, 435.0), (375.0, 420.0)]);
    add_poly(3, vec![(355.0, 400.0), (375.0, 420.0), (350.0, 460.0)]);

    // --- BREAST & BELLY ---
    add_poly(2, vec![(375.0, 420.0), (420.0, 435.0), (400.0, 485.0), (350.0, 460.0)]);
    add_poly(12, vec![(350.0, 460.0), (400.0, 485.0), (380.0, 530.0), (335.0, 495.0)]);
    add_poly(12, vec![(335.0, 495.0), (380.0, 530.0), (360.0, 570.0), (325.0, 530.0)]);
    add_poly(5, vec![(325.0, 530.0), (360.0, 570.0), (345.0, 605.0), (315.0, 560.0)]);

    // --- UPPER WING (PRIMARY FEATHERS) ---
    add_poly(6, vec![(420.0, 345.0), (490.0, 240.0), (460.0, 340.0)]);
    add_poly(5, vec![(490.0, 240.0), (560.0, 160.0), (515.0, 255.0), (460.0, 340.0)]);
    add_poly(6, vec![(560.0, 160.0), (630.0, 100.0), (585.0, 185.0), (515.0, 255.0)]);
    add_poly(4, vec![(630.0, 100.0), (700.0, 50.0), (650.0, 130.0), (585.0, 185.0)]); // Wing tip top
    add_poly(7, vec![(700.0, 50.0), (720.0, 40.0), (675.0, 120.0), (650.0, 130.0)]);

    // --- WING SECONDARY & COVERT FEATHERS ---
    add_poly(4, vec![(460.0, 340.0), (515.0, 255.0), (550.0, 290.0), (485.0, 375.0)]);
    add_poly(8, vec![(515.0, 255.0), (585.0, 185.0), (615.0, 230.0), (550.0, 290.0)]);
    add_poly(7, vec![(585.0, 185.0), (650.0, 130.0), (670.0, 180.0), (615.0, 230.0)]);
    add_poly(8, vec![(485.0, 375.0), (550.0, 290.0), (580.0, 340.0), (510.0, 410.0)]);
    add_poly(4, vec![(550.0, 290.0), (615.0, 230.0), (640.0, 280.0), (580.0, 340.0)]);
    add_poly(5, vec![(580.0, 340.0), (640.0, 280.0), (660.0, 330.0), (600.0, 380.0)]);

    // --- BACK & RUMP ---
    add_poly(8, vec![(430.0, 315.0), (460.0, 340.0), (485.0, 375.0), (455.0, 400.0)]);
    add_poly(4, vec![(455.0, 400.0), (485.0, 375.0), (510.0, 410.0), (475.0, 445.0)]);
    add_poly(8, vec![(420.0, 435.0), (455.0, 400.0), (475.0, 445.0), (440.0, 480.0)]);
    add_poly(7, vec![(400.0, 485.0), (440.0, 480.0), (455.0, 520.0), (415.0, 535.0)]);

    // --- TAIL FEATHERS ---
    add_poly(6, vec![(380.0, 530.0), (415.0, 535.0), (450.0, 620.0), (410.0, 610.0)]);
    add_poly(5, vec![(415.0, 535.0), (455.0, 520.0), (500.0, 620.0), (450.0, 620.0)]);
    add_poly(4, vec![(410.0, 610.0), (450.0, 620.0), (480.0, 720.0), (430.0, 700.0)]);
    add_poly(9, vec![(450.0, 620.0), (500.0, 620.0), (540.0, 715.0), (480.0, 720.0)]);
    add_poly(6, vec![(360.0, 570.0), (410.0, 610.0), (430.0, 700.0), (370.0, 650.0)]);

    // --- SAKURA BLOSSOM 1 (TOP LEFT) ---
    add_poly(10, vec![(100.0, 160.0), (140.0, 120.0), (170.0, 155.0), (135.0, 185.0)]);
    add_poly(11, vec![(140.0, 120.0), (195.0, 100.0), (210.0, 145.0), (170.0, 155.0)]);
    add_poly(10, vec![(210.0, 145.0), (260.0, 150.0), (240.0, 195.0), (185.0, 180.0)]);
    add_poly(12, vec![(185.0, 180.0), (240.0, 195.0), (210.0, 240.0), (165.0, 215.0)]);
    add_poly(10, vec![(135.0, 185.0), (165.0, 215.0), (130.0, 245.0), (95.0, 210.0)]);
    add_poly(2, vec![(160.0, 170.0), (185.0, 160.0), (185.0, 180.0), (165.0, 185.0)]); // Flower pistil center

    // --- SAKURA BLOSSOM 2 (BOTTOM RIGHT) ---
    add_poly(10, vec![(640.0, 520.0), (690.0, 480.0), (715.0, 530.0), (665.0, 555.0)]);
    add_poly(11, vec![(690.0, 480.0), (750.0, 490.0), (755.0, 550.0), (715.0, 530.0)]);
    add_poly(12, vec![(715.0, 530.0), (755.0, 550.0), (740.0, 610.0), (685.0, 580.0)]);
    add_poly(10, vec![(665.0, 555.0), (685.0, 580.0), (660.0, 630.0), (615.0, 595.0)]);
    add_poly(11, vec![(615.0, 595.0), (665.0, 555.0), (640.0, 520.0), (600.0, 545.0)]);
    add_poly(2, vec![(680.0, 540.0), (705.0, 535.0), (700.0, 560.0), (675.0, 560.0)]);

    // --- LEAVES & BOTANICAL ACCENTS ---
    add_poly(7, vec![(240.0, 195.0), (300.0, 210.0), (280.0, 245.0), (210.0, 240.0)]);
    add_poly(8, vec![(210.0, 240.0), (280.0, 245.0), (250.0, 285.0), (190.0, 270.0)]);
    add_poly(7, vec![(580.0, 590.0), (615.0, 595.0), (600.0, 660.0), (550.0, 640.0)]);
    add_poly(8, vec![(660.0, 630.0), (720.0, 660.0), (700.0, 710.0), (645.0, 680.0)]);

    // Build palette summary
    let palette = palette_def
        .iter()
        .map(|(num, hex, name)| {
            let total = regions.iter().filter(|r| r.number == *num).count();
            PaletteItem {
                number: *num,
                hex: hex.to_string(),
                name: name.to_string(),
                total_count: total,
                filled_count: 0,
                is_completed: false,
            }
        })
        .collect();

    ArtworkData {
        id: "hummingbird".to_string(),
        title: "Origami Hummingbird & Blossoms".to_string(),
        artist: "Geometric Fauna".to_string(),
        width,
        height,
        palette,
        regions,
    }
}

/// Hand-crafted Artwork 2: Cosmic Whale & Constellations
fn generate_cosmic_whale() -> ArtworkData {
    let width = 800.0;
    let height = 800.0;

    let palette_def = vec![
        (1, "#3A0CA3", "Cosmic Violet"),
        (2, "#4361EE", "Starlight Blue"),
        (3, "#4CC9F0", "Nebula Cyan"),
        (4, "#7209B7", "Twilight Amethyst"),
        (5, "#F72585", "Supernova Pink"),
        (6, "#FFD166", "Solar Gold"),
        (7, "#06D6A0", "Bioluminescent Mint"),
        (8, "#1B1947", "Deep Void"),
        (9, "#F4F1DE", "Star Dust"),
    ];

    let mut regions = Vec::new();
    let mut add_poly = |num: usize, pts: Vec<(f64, f64)>| {
        let hex = palette_def
            .iter()
            .find(|(n, _, _)| *n == num)
            .map(|(_, h, _)| *h)
            .unwrap_or("#CCCCCC");

        let poly: Vec<Point> = pts.into_iter().map(|(x, y)| Point::new(x, y)).collect();
        let centroid = Region::calculate_centroid(&poly);
        let id = regions.len();
        regions.push(Region {
            id,
            number: num,
            polygon: poly,
            centroid,
            color_hex: hex.to_string(),
            is_filled: false,
            fill_anim: 0.0,
        });
    };

    // --- WHALE HEAD & SNOUT ---
    add_poly(1, vec![(120.0, 360.0), (190.0, 310.0), (270.0, 330.0), (210.0, 400.0), (140.0, 390.0)]);
    add_poly(2, vec![(190.0, 310.0), (290.0, 270.0), (370.0, 310.0), (270.0, 330.0)]);
    add_poly(6, vec![(250.0, 350.0), (270.0, 345.0), (275.0, 365.0), (255.0, 365.0)]); // Whale eye

    // --- WHALE BELLY PLEATS (BIOLUMINESCENT) ---
    add_poly(7, vec![(140.0, 390.0), (210.0, 400.0), (280.0, 420.0), (230.0, 450.0), (160.0, 425.0)]);
    add_poly(3, vec![(210.0, 400.0), (270.0, 330.0), (350.0, 380.0), (280.0, 420.0)]);
    add_poly(7, vec![(230.0, 450.0), (280.0, 420.0), (370.0, 450.0), (320.0, 490.0), (250.0, 480.0)]);
    add_poly(3, vec![(280.0, 420.0), (350.0, 380.0), (430.0, 420.0), (370.0, 450.0)]);
    add_poly(7, vec![(320.0, 490.0), (370.0, 450.0), (450.0, 470.0), (400.0, 520.0), (340.0, 510.0)]);

    // --- WHALE BACK & BODY ---
    add_poly(4, vec![(290.0, 270.0), (390.0, 260.0), (460.0, 310.0), (370.0, 310.0)]);
    add_poly(1, vec![(370.0, 310.0), (460.0, 310.0), (490.0, 370.0), (430.0, 420.0), (350.0, 380.0)]);
    add_poly(4, vec![(390.0, 260.0), (490.0, 270.0), (540.0, 330.0), (460.0, 310.0)]);
    add_poly(2, vec![(460.0, 310.0), (540.0, 330.0), (570.0, 390.0), (490.0, 370.0)]);

    // --- PECTORAL FLIPPER ---
    add_poly(5, vec![(370.0, 450.0), (430.0, 420.0), (460.0, 510.0), (410.0, 550.0)]);
    add_poly(4, vec![(430.0, 420.0), (490.0, 460.0), (470.0, 560.0), (410.0, 550.0)]);
    add_poly(5, vec![(460.0, 510.0), (470.0, 560.0), (440.0, 650.0), (410.0, 610.0)]);

    // --- TAIL FLUKES ---
    add_poly(1, vec![(540.0, 330.0), (620.0, 360.0), (570.0, 390.0)]);
    add_poly(2, vec![(570.0, 390.0), (620.0, 360.0), (670.0, 400.0), (610.0, 420.0)]);
    add_poly(3, vec![(620.0, 360.0), (710.0, 320.0), (730.0, 380.0), (670.0, 400.0)]);
    add_poly(7, vec![(670.0, 400.0), (730.0, 380.0), (750.0, 440.0), (680.0, 460.0), (610.0, 420.0)]);
    add_poly(3, vec![(680.0, 460.0), (750.0, 440.0), (760.0, 510.0), (700.0, 500.0)]);

    // --- STARS & CONSTELLATIONS ---
    add_poly(6, vec![(160.0, 160.0), (180.0, 140.0), (200.0, 160.0), (180.0, 180.0)]);
    add_poly(9, vec![(310.0, 140.0), (325.0, 125.0), (340.0, 140.0), (325.0, 155.0)]);
    add_poly(6, vec![(480.0, 150.0), (500.0, 130.0), (520.0, 150.0), (500.0, 170.0)]);
    add_poly(9, vec![(640.0, 200.0), (655.0, 185.0), (670.0, 200.0), (655.0, 215.0)]);
    add_poly(6, vec![(210.0, 560.0), (225.0, 545.0), (240.0, 560.0), (225.0, 575.0)]);
    add_poly(9, vec![(560.0, 600.0), (580.0, 580.0), (600.0, 600.0), (580.0, 620.0)]);

    // --- COSMIC NEBULA CRYSTALS ---
    add_poly(5, vec![(100.0, 500.0), (150.0, 460.0), (160.0, 520.0), (110.0, 540.0)]);
    add_poly(4, vec![(110.0, 540.0), (160.0, 520.0), (180.0, 580.0), (120.0, 610.0)]);

    let palette = palette_def
        .iter()
        .map(|(num, hex, name)| {
            let total = regions.iter().filter(|r| r.number == *num).count();
            PaletteItem {
                number: *num,
                hex: hex.to_string(),
                name: name.to_string(),
                total_count: total,
                filled_count: 0,
                is_completed: false,
            }
        })
        .collect();

    ArtworkData {
        id: "cosmic_whale".to_string(),
        title: "Cosmic Whale & Constellations".to_string(),
        artist: "Astral Ocean".to_string(),
        width,
        height,
        palette,
        regions,
    }
}

/// Hand-crafted Artwork 3: Stained Glass Monarch
fn generate_stained_butterfly() -> ArtworkData {
    let width = 800.0;
    let height = 800.0;

    let palette_def = vec![
        (1, "#FF5400", "Vivid Tangerine"),
        (2, "#FF8500", "Amber Marigold"),
        (3, "#FFD000", "Canary Yellow"),
        (4, "#240046", "Midnight Obsidian"),
        (5, "#5A189A", "Royal Purple"),
        (6, "#7B2CBF", "Amethyst Veil"),
        (7, "#00A896", "Teal Foliage"),
        (8, "#028090", "Deep Jade"),
        (9, "#F8F9FA", "Pearl Accent"),
    ];

    let mut regions = Vec::new();
    let mut add_poly = |num: usize, pts: Vec<(f64, f64)>| {
        let hex = palette_def
            .iter()
            .find(|(n, _, _)| *n == num)
            .map(|(_, h, _)| *h)
            .unwrap_or("#CCCCCC");

        let poly: Vec<Point> = pts.into_iter().map(|(x, y)| Point::new(x, y)).collect();
        let centroid = Region::calculate_centroid(&poly);
        let id = regions.len();
        regions.push(Region {
            id,
            number: num,
            polygon: poly,
            centroid,
            color_hex: hex.to_string(),
            is_filled: false,
            fill_anim: 0.0,
        });
    };

    // Center butterfly body
    add_poly(4, vec![(390.0, 280.0), (410.0, 280.0), (405.0, 340.0), (395.0, 340.0)]); // Thorax
    add_poly(4, vec![(395.0, 340.0), (405.0, 340.0), (408.0, 480.0), (392.0, 480.0)]); // Abdomen
    add_poly(4, vec![(392.0, 260.0), (408.0, 260.0), (410.0, 280.0), (390.0, 280.0)]); // Head

    // Left Forewing cells
    add_poly(1, vec![(390.0, 290.0), (320.0, 240.0), (310.0, 320.0), (390.0, 330.0)]);
    add_poly(2, vec![(320.0, 240.0), (250.0, 180.0), (230.0, 260.0), (310.0, 320.0)]);
    add_poly(3, vec![(250.0, 180.0), (170.0, 140.0), (150.0, 220.0), (230.0, 260.0)]);
    add_poly(1, vec![(230.0, 260.0), (150.0, 220.0), (160.0, 310.0), (240.0, 340.0)]);
    add_poly(2, vec![(310.0, 320.0), (240.0, 340.0), (260.0, 410.0), (330.0, 380.0)]);
    add_poly(4, vec![(170.0, 140.0), (140.0, 120.0), (120.0, 190.0), (150.0, 220.0)]); // Border edge
    add_poly(9, vec![(130.0, 150.0), (145.0, 140.0), (140.0, 160.0)]); // Wing dot

    // Right Forewing cells (Symmetrical counterpart)
    add_poly(1, vec![(410.0, 290.0), (480.0, 240.0), (490.0, 320.0), (410.0, 330.0)]);
    add_poly(2, vec![(480.0, 240.0), (550.0, 180.0), (570.0, 260.0), (490.0, 320.0)]);
    add_poly(3, vec![(550.0, 180.0), (630.0, 140.0), (650.0, 220.0), (570.0, 260.0)]);
    add_poly(1, vec![(570.0, 260.0), (650.0, 220.0), (640.0, 310.0), (560.0, 340.0)]);
    add_poly(2, vec![(490.0, 320.0), (560.0, 340.0), (540.0, 410.0), (470.0, 380.0)]);
    add_poly(4, vec![(630.0, 140.0), (660.0, 120.0), (680.0, 190.0), (650.0, 220.0)]);
    add_poly(9, vec![(670.0, 150.0), (655.0, 140.0), (660.0, 160.0)]);

    // Left Hindwing
    add_poly(2, vec![(390.0, 350.0), (330.0, 380.0), (300.0, 460.0), (370.0, 470.0)]);
    add_poly(1, vec![(330.0, 380.0), (260.0, 410.0), (240.0, 490.0), (300.0, 460.0)]);
    add_poly(3, vec![(300.0, 460.0), (240.0, 490.0), (260.0, 560.0), (330.0, 530.0)]);
    add_poly(4, vec![(240.0, 490.0), (210.0, 510.0), (230.0, 580.0), (260.0, 560.0)]);

    // Right Hindwing
    add_poly(2, vec![(410.0, 350.0), (470.0, 380.0), (500.0, 460.0), (430.0, 470.0)]);
    add_poly(1, vec![(470.0, 380.0), (540.0, 410.0), (560.0, 490.0), (500.0, 460.0)]);
    add_poly(3, vec![(500.0, 460.0), (560.0, 490.0), (540.0, 560.0), (470.0, 530.0)]);
    add_poly(4, vec![(560.0, 490.0), (590.0, 510.0), (570.0, 580.0), (540.0, 560.0)]);

    // Botanical Surroundings
    add_poly(7, vec![(100.0, 620.0), (200.0, 580.0), (280.0, 650.0), (170.0, 690.0)]);
    add_poly(8, vec![(170.0, 690.0), (280.0, 650.0), (320.0, 740.0), (210.0, 760.0)]);
    add_poly(7, vec![(700.0, 620.0), (600.0, 580.0), (520.0, 650.0), (630.0, 690.0)]);
    add_poly(8, vec![(630.0, 690.0), (520.0, 650.0), (480.0, 740.0), (590.0, 760.0)]);
    add_poly(5, vec![(350.0, 650.0), (400.0, 600.0), (450.0, 650.0), (400.0, 710.0)]); // Lotus flower
    add_poly(6, vec![(380.0, 640.0), (400.0, 615.0), (420.0, 640.0), (400.0, 670.0)]);

    let palette = palette_def
        .iter()
        .map(|(num, hex, name)| {
            let total = regions.iter().filter(|r| r.number == *num).count();
            PaletteItem {
                number: *num,
                hex: hex.to_string(),
                name: name.to_string(),
                total_count: total,
                filled_count: 0,
                is_completed: false,
            }
        })
        .collect();

    ArtworkData {
        id: "stained_butterfly".to_string(),
        title: "Monarch Butterfly".to_string(),
        artist: "Floral Garden".to_string(),
        width,
        height,
        palette,
        regions,
    }
}

/// Hand-crafted Artwork 4: Geometric Sunset Mountains
fn generate_sunset_landscape() -> ArtworkData {
    let width = 800.0;
    let height = 800.0;

    let palette_def = vec![
        (1, "#F72585", "Magenta Sun"),
        (2, "#7209B7", "Twilight Peak"),
        (3, "#3A0CA3", "Indigo Ridge"),
        (4, "#4361EE", "Alpine Mist"),
        (5, "#4CC9F0", "Glacier Lake"),
        (6, "#F77F00", "Golden Horizon"),
        (7, "#FCBF49", "Amber Sky"),
        (8, "#EAE2B7", "Morning Glow"),
    ];

    let mut regions = Vec::new();
    let mut add_poly = |num: usize, pts: Vec<(f64, f64)>| {
        let hex = palette_def
            .iter()
            .find(|(n, _, _)| *n == num)
            .map(|(_, h, _)| *h)
            .unwrap_or("#CCCCCC");

        let poly: Vec<Point> = pts.into_iter().map(|(x, y)| Point::new(x, y)).collect();
        let centroid = Region::calculate_centroid(&poly);
        let id = regions.len();
        regions.push(Region {
            id,
            number: num,
            polygon: poly,
            centroid,
            color_hex: hex.to_string(),
            is_filled: false,
            fill_anim: 0.0,
        });
    };

    // Sun Rays and Sky
    add_poly(8, vec![(0.0, 0.0), (400.0, 0.0), (400.0, 280.0), (0.0, 200.0)]);
    add_poly(8, vec![(400.0, 0.0), (800.0, 0.0), (800.0, 200.0), (400.0, 280.0)]);
    add_poly(7, vec![(0.0, 200.0), (400.0, 280.0), (320.0, 360.0), (0.0, 320.0)]);
    add_poly(7, vec![(800.0, 200.0), (400.0, 280.0), (480.0, 360.0), (800.0, 320.0)]);

    // Giant Sunset Sun
    add_poly(1, vec![(320.0, 240.0), (400.0, 200.0), (480.0, 240.0), (460.0, 320.0), (340.0, 320.0)]);
    add_poly(6, vec![(340.0, 320.0), (460.0, 320.0), (400.0, 370.0)]);

    // Mountain Peaks
    add_poly(2, vec![(400.0, 310.0), (520.0, 480.0), (400.0, 460.0)]);
    add_poly(3, vec![(400.0, 310.0), (400.0, 460.0), (280.0, 480.0)]);
    add_poly(2, vec![(200.0, 380.0), (280.0, 480.0), (140.0, 520.0)]);
    add_poly(3, vec![(600.0, 380.0), (660.0, 520.0), (520.0, 480.0)]);

    // Foothills
    add_poly(4, vec![(0.0, 480.0), (140.0, 520.0), (280.0, 480.0), (220.0, 580.0), (0.0, 560.0)]);
    add_poly(4, vec![(800.0, 480.0), (660.0, 520.0), (520.0, 480.0), (580.0, 580.0), (800.0, 560.0)]);
    add_poly(3, vec![(280.0, 480.0), (400.0, 460.0), (520.0, 480.0), (400.0, 560.0)]);

    // Mirror Lake Reflections
    add_poly(5, vec![(0.0, 560.0), (220.0, 580.0), (400.0, 560.0), (320.0, 680.0), (0.0, 650.0)]);
    add_poly(5, vec![(800.0, 560.0), (580.0, 580.0), (400.0, 560.0), (480.0, 680.0), (800.0, 650.0)]);
    add_poly(6, vec![(320.0, 680.0), (400.0, 560.0), (480.0, 680.0), (400.0, 720.0)]); // Sun reflection
    add_poly(4, vec![(0.0, 650.0), (320.0, 680.0), (400.0, 720.0), (260.0, 800.0), (0.0, 800.0)]);
    add_poly(4, vec![(800.0, 650.0), (480.0, 680.0), (400.0, 720.0), (540.0, 800.0), (800.0, 800.0)]);
    add_poly(5, vec![(260.0, 800.0), (400.0, 720.0), (540.0, 800.0)]);

    let palette = palette_def
        .iter()
        .map(|(num, hex, name)| {
            let total = regions.iter().filter(|r| r.number == *num).count();
            PaletteItem {
                number: *num,
                hex: hex.to_string(),
                name: name.to_string(),
                total_count: total,
                filled_count: 0,
                is_completed: false,
            }
        })
        .collect();

    ArtworkData {
        id: "sunset_landscape".to_string(),
        title: "Geometric Sunset Mountains".to_string(),
        artist: "Low Poly Vistas".to_string(),
        width,
        height,
        palette,
        regions,
    }
}



// ============================================================================
// Diamond Art Paintings (Fine-Scale 5D Rhinestone / Faceted Gem Mosaics)
// ============================================================================

fn create_diamond_grid(
    id: &str,
    title: &str,
    artist: &str,
    palette_def: Vec<(usize, &str, &str)>,
    grid: Vec<Vec<usize>>,
) -> ArtworkData {
    let width = 800.0;
    let height = 800.0;
    let n = grid.len();
    let margin = 28.0;
    let avail = width - margin * 2.0;
    let cell_size = avail / n as f64;

    let mut regions = Vec::with_capacity(n * n);
    let mut region_id = 0;

    for r in 0..n {
        for c in 0..n {
            let num = grid[r][c];
            let hex = palette_def
                .iter()
                .find(|(n_id, _, _)| *n_id == num)
                .map(|(_, h, _)| *h)
                .unwrap_or("#888888");

            let x0 = margin + c as f64 * cell_size;
            let y0 = margin + r as f64 * cell_size;
            let x1 = x0 + cell_size;
            let y1 = y0 + cell_size;

            let poly = vec![
                Point::new(x0, y0),
                Point::new(x1, y0),
                Point::new(x1, y1),
                Point::new(x0, y1),
            ];
            let centroid = Point::new((x0 + x1) * 0.5, (y0 + y1) * 0.5);

            regions.push(Region {
                id: region_id,
                number: num,
                polygon: poly,
                centroid,
                color_hex: hex.to_string(),
                is_filled: false,
                fill_anim: 0.0,
            });
            region_id += 1;
        }
    }

    let palette = palette_def
        .iter()
        .map(|(num, hex, name)| {
            let total = regions.iter().filter(|r| r.number == *num).count();
            PaletteItem {
                number: *num,
                hex: hex.to_string(),
                name: name.to_string(),
                total_count: total,
                filled_count: 0,
                is_completed: false,
            }
        })
        .collect();

    ArtworkData {
        id: id.to_string(),
        title: title.to_string(),
        artist: artist.to_string(),
        width,
        height,
        palette,
        regions,
    }
}

pub fn generate_starry_night_diamond() -> ArtworkData {
    let palette_def = vec![
        (1, "#0B1335", "Midnight Ultramarine"),
        (2, "#15224D", "Deep Cobalt"),
        (3, "#233973", "Indigo Whirlpool"),
        (4, "#2E51A2", "Azure Swirl"),
        (5, "#4880D6", "Cerulean Wave"),
        (6, "#6BA8F2", "Cyan Starlight"),
        (7, "#F7DF79", "Pale Starlight"),
        (8, "#F9CA24", "Radiant Golden Moon"),
        (9, "#F0932B", "Amber Glow"),
        (10, "#0D2B22", "Dark Cypress Pine"),
        (11, "#184D3B", "Pine Foliage Green"),
        (12, "#0A1128", "Deep River Shadow"),
    ];

    let n = 28;
    let mut grid = vec![vec![1; n]; n];

    for r in 0..n {
        for c in 0..n {
            let u = c as f64 / (n - 1) as f64;
            let v = r as f64 / (n - 1) as f64;

            let mut col = if v < 0.25 {
                if c % 3 == 0 { 2 } else { 1 }
            } else if v < 0.6 {
                2
            } else if v < 0.72 {
                1
            } else {
                12 // river
            };

            // Cosmic swirl wave 1
            let wave1 = (u * std::f64::consts::PI * 2.2 + 0.5).sin() * 0.15 + 0.38;
            let dist_wave1 = (v - wave1).abs();
            if dist_wave1 < 0.08 && c > 5 && v < 0.68 {
                col = if dist_wave1 < 0.03 { 5 } else if dist_wave1 < 0.055 { 4 } else { 3 };
            }

            // Cosmic swirl wave 2
            let wave2 = (u * std::f64::consts::PI * 1.8 - 0.2).cos() * 0.12 + 0.22;
            let dist_wave2 = (v - wave2).abs();
            if dist_wave2 < 0.06 && c > 7 && v < 0.6 {
                col = if dist_wave2 < 0.025 { 4 } else { 3 };
            }

            // Crescent Moon top-right
            let d_moon = ((r as f64 - 4.5).powi(2) + (c as f64 - 22.5).powi(2)).sqrt();
            if d_moon <= 3.8 {
                if d_moon <= 2.2 {
                    let d_cut = ((r as f64 - 3.8).powi(2) + (c as f64 - 21.2).powi(2)).sqrt();
                    col = if d_cut < 1.6 { 7 } else { 8 };
                } else if d_moon <= 3.0 {
                    col = 7;
                } else {
                    col = 6;
                }
            }

            // Big Star #1
            let d_star1 = ((r as f64 - 6.0).powi(2) + (c as f64 - 9.0).powi(2)).sqrt();
            if d_star1 < 3.2 {
                col = if d_star1 < 0.9 { 8 } else if d_star1 < 1.6 { 7 } else if d_star1 < 2.3 { 6 } else { 5 };
            }

            // Star #2
            let d_star2 = ((r as f64 - 11.0).powi(2) + (c as f64 - 16.0).powi(2)).sqrt();
            if d_star2 < 2.6 {
                col = if d_star2 < 0.8 { 8 } else if d_star2 < 1.5 { 7 } else { 6 };
            }

            // Star #3
            let d_star3 = ((r as f64 - 3.0).powi(2) + (c as f64 - 14.0).powi(2)).sqrt();
            if d_star3 < 1.8 {
                col = if d_star3 < 0.8 { 8 } else { 6 };
            }

            // Star #4
            let d_star4 = ((r as f64 - 8.0).powi(2) + (c as f64 - 2.0).powi(2)).sqrt();
            if d_star4 < 1.8 {
                col = if d_star4 < 0.8 { 8 } else { 7 };
            }

            // Rolling hills & village
            let hill1 = 18.0 + (c as f64 * 0.4).sin() * 1.5;
            if r as f64 >= hill1 && r < 23 {
                col = if r > 19 { 3 } else { 2 };
                if r == 20 && (c == 11 || c == 12 || c == 18 || c == 21) { col = 9; }
                if r == 21 && (c == 11 || c == 12 || c == 17 || c == 18 || c == 20 || c == 21) { col = 8; }
                if c == 14 && r >= 16 && r <= 20 { col = 10; }
            }

            // River Rhone reflections
            if r >= 23 {
                col = if r % 2 == 0 { 12 } else { 1 };
                if (c as i32 - 9).abs() <= 1 && (r == 23 || r == 25) { col = 9; }
                if (c as i32 - 16).abs() <= 1 && (r == 24 || r == 26) { col = 9; }
                if (c as i32 - 22).abs() <= 1 && (r == 23 || r == 26) { col = 8; }
                if c > 24 && r == 25 { col = 7; }
            }

            // Cypress Tree
            let cypress_width = (r as f64 - 2.0) * 0.17;
            let cypress_center = 3.5 + (r as f64 * 0.3).sin() * 0.5;
            if r >= 3 && (c as f64 - cypress_center).abs() <= cypress_width {
                col = if (r + c) % 3 == 0 { 11 } else { 10 };
            }

            grid[r][c] = col;
        }
    }

    create_diamond_grid(
        "starry_night_diamond",
        "Van Gogh: Starry Night",
        "Vincent van Gogh (Diamond Edition)",
        palette_def,
        grid,
    )
}

pub fn generate_peacock_diamond() -> ArtworkData {
    let palette_def = vec![
        (1, "#091B33", "Deep Navy Night"),
        (2, "#10355E", "Midnight Sapphire"),
        (3, "#0A527A", "Royal Blue"),
        (4, "#0D7399", "Electric Cerulean"),
        (5, "#00A896", "Emerald Turquoise"),
        (6, "#02C39A", "Vivid Mint Jade"),
        (7, "#05668D", "Deep Teal Plumage"),
        (8, "#F4A261", "Warm Topaz"),
        (9, "#E76F51", "Coral Amber"),
        (10, "#E63946", "Ruby Crown"),
        (11, "#F1FAEE", "Pearl Crest"),
        (12, "#F72585", "Amethyst Magenta"),
    ];

    let n = 28;
    let mut grid = vec![vec![1; n]; n];

    let ocelli = [
        (7.0, 5.0), (6.0, 11.0), (6.0, 17.0), (7.0, 23.0),
        (12.0, 3.0), (12.0, 9.0), (12.0, 19.0), (12.0, 25.0),
        (17.0, 2.0), (17.0, 7.0), (18.0, 21.0), (17.0, 26.0),
        (23.0, 4.0), (24.0, 9.0), (24.0, 19.0), (23.0, 24.0),
    ];

    for r in 0..n {
        for c in 0..n {
            let mut col = if (r + c) % 5 == 0 { 2 } else { 1 };

            // Fan plumage background
            let angle = (r as f64 - 16.0).atan2(c as f64 - 14.0);
            let dist = ((r as f64 - 16.0).powi(2) + (c as f64 - 14.0).powi(2)).sqrt();
            if dist > 4.0 && dist < 15.0 {
                col = if (angle * 8.0).sin().abs() > 0.4 { 5 } else { 7 };
                if dist > 9.0 && (r + c) % 2 == 0 { col = 6; }
            }

            // Ocelli
            for &(or_val, oc_val) in &ocelli {
                let d = ((r as f64 - or_val).powi(2) + (c as f64 - oc_val).powi(2)).sqrt();
                if d < 2.2 {
                    col = if d < 0.6 { 11 } else if d < 1.1 { 10 } else if d < 1.6 { 8 } else { 6 };
                }
            }

            // Head (r: 6, c: 14)
            let d_head = ((r as f64 - 6.0).powi(2) + (c as f64 - 14.0).powi(2)).sqrt();
            if d_head <= 1.8 {
                col = if c == 14 && r == 6 { 11 } else { 4 };
                if c == 15 && r == 6 { col = 10; }
            }

            // Crest
            if (r == 3 && (c == 13 || c == 14 || c == 15)) || (r == 4 && (c == 13 || c == 14 || c == 15)) {
                col = if r == 3 { 10 } else { 6 };
            }

            // Neck
            let neck_c = 14.0 + ((r as f64 - 8.0) * 0.4).sin() * 0.8;
            if r >= 8 && r <= 13 && (c as f64 - neck_c).abs() <= 1.3 {
                col = if (c as f64) <= neck_c { 4 } else { 3 };
            }

            // Breast and Torso
            let body_w = 2.2 + (r as f64 - 14.0) * 0.2;
            if r >= 14 && r <= 22 && (c as f64 - 14.5).abs() <= body_w {
                col = if c == 14 || c == 15 { 4 } else { 3 };
                if r > 18 { col = if (r + c) % 2 == 0 { 5 } else { 7 }; }
            }

            // Perch branch
            if r == 25 && c >= 8 && c <= 21 { col = 8; }
            if r == 26 && c >= 9 && c <= 20 { col = 9; }

            grid[r][c] = col;
        }
    }

    create_diamond_grid(
        "peacock_diamond",
        "Royal Crystal Peacock",
        "Jeweled Aviary",
        palette_def,
        grid,
    )
}

pub fn generate_sakura_pagoda_diamond() -> ArtworkData {
    let palette_def = vec![
        (1, "#FF7675", "Sunset Coral"),
        (2, "#FAB1A0", "Peach Horizon"),
        (3, "#FFEAA7", "Golden Evening Sun"),
        (4, "#DFE6E9", "Fuji Snow Crest"),
        (5, "#74B9FF", "Alpine Ice Shadow"),
        (6, "#2C3E50", "Pagoda & Mountain Silhouette"),
        (7, "#D63031", "Vermilion Pagoda Accent"),
        (8, "#FD79A8", "Vibrant Sakura Blossom"),
        (9, "#FFB8B8", "Soft Petal Blush"),
        (10, "#6C5CE7", "Twilight Lake Reflection"),
        (11, "#2D3436", "Ancient Pine Trunk"),
        (12, "#00B894", "Spring Moss Jade"),
    ];

    let n = 28;
    let mut grid = vec![vec![1; n]; n];

    let roof_tiers = [
        (9, 2.0),
        (12, 2.8),
        (15, 3.4),
        (18, 4.0),
        (21, 4.6),
    ];

    for r in 0..n {
        for c in 0..n {
            let mut col = if r < 7 { 3 } else if r < 14 { 2 } else if r < 19 { 1 } else { 10 };

            // Sun
            let d_sun = ((r as f64 - 8.5).powi(2) + (c as f64 - 19.5).powi(2)).sqrt();
            if d_sun <= 3.8 {
                col = if d_sun <= 2.4 { 3 } else { 2 };
            }

            // Mount Fuji
            let peak_c = 19.5;
            let peak_r = 8.0;
            if r as f64 >= peak_r && r <= 19 {
                let slope_w = (r as f64 - peak_r) * 0.95;
                if (c as f64 - peak_c).abs() <= slope_w {
                    if r <= 11 {
                        col = if (c as f64) < peak_c { 4 } else { 5 };
                    } else if r <= 13 {
                        col = if (r + c) % 2 == 0 { 4 } else { 6 };
                    } else {
                        col = 6;
                    }
                }
            }

            // Lake water
            if r >= 20 {
                col = if r % 2 == 0 { 10 } else { 1 };
                if c >= 17 && c <= 22 { col = if r % 2 == 0 { 2 } else { 3 }; }
                if c >= 4 && c <= 9 && r <= 24 { col = 6; }
            }

            // Pagoda
            let pag_c = 6.5;
            if r >= 7 && r <= 8 && (c == 6 || c == 7) { col = 7; }

            for &(tier_r, tier_w) in &roof_tiers {
                if r == tier_r && (c as f64 - pag_c).abs() <= tier_w { col = 7; }
                if r == tier_r + 1 && (c as f64 - pag_c).abs() <= tier_w - 0.7 { col = 6; }
                if r == tier_r + 2 && (c as f64 - pag_c).abs() <= tier_w - 1.2 {
                    col = if (r + c) % 2 == 0 { 7 } else { 6 };
                }
            }
            if r >= 22 && r <= 24 && (c as f64 - pag_c).abs() <= 3.8 { col = 6; }

            // Embankment
            if r >= 25 && c <= 12 {
                col = if r == 27 { 11 } else { 12 };
            }

            // Sakura branches and blossoms
            if (r as f64 - (2.0 + (27.0 - c as f64) * 0.35)).abs() <= 1.2 && c >= 16 {
                col = 11;
            }
            let d_cl1 = ((r as f64 - 3.0).powi(2) + (c as f64 - 24.0).powi(2)).sqrt();
            let d_cl2 = ((r as f64 - 5.0).powi(2) + (c as f64 - 20.0).powi(2)).sqrt();
            let d_cl3 = ((r as f64 - 2.0).powi(2) + (c as f64 - 18.0).powi(2)).sqrt();
            if d_cl1 < 2.8 || d_cl2 < 2.5 || d_cl3 < 2.2 {
                col = if (r + c) % 3 == 0 { 9 } else { 8 };
            }

            let d_cl4 = ((r as f64 - 24.0).powi(2) + (c as f64 - 23.0).powi(2)).sqrt();
            let d_cl5 = ((r as f64 - 26.0).powi(2) + (c as f64 - 26.0).powi(2)).sqrt();
            if d_cl4 < 3.2 || d_cl5 < 2.8 {
                col = if (r + c) % 2 == 0 { 8 } else { 9 };
            }

            grid[r][c] = col;
        }
    }

    create_diamond_grid(
        "sakura_pagoda_diamond",
        "Mount Fuji & Sakura Pagoda",
        "Ukiyo-e Gem Art",
        palette_def,
        grid,
    )
}

pub fn generate_cosmic_wolf_diamond() -> ArtworkData {
    let palette_def = vec![
        (1, "#08071A", "Void Obsidian"),
        (2, "#1E113E", "Cosmic Violet"),
        (3, "#3D1C68", "Twilight Amethyst"),
        (4, "#00F5D4", "Aurora Neon Cyan"),
        (5, "#70E000", "Aurora Electric Lime"),
        (6, "#38B000", "Deep Emerald Aurora"),
        (7, "#F72585", "Solar Flare Magenta"),
        (8, "#FFFFFF", "Pure Star Sparkle"),
        (9, "#CAF0F8", "Moon Silver"),
        (10, "#3F37C9", "Wolf Fur Shadow"),
        (11, "#4895EF", "Wolf Fur Rimlight"),
        (12, "#14142B", "Cliff Ridge Rock"),
    ];

    let n = 28;
    let mut grid = vec![vec![1; n]; n];

    for r in 0..n {
        for c in 0..n {
            let mut col = if r < 6 { 2 } else if r < 13 { if c % 2 == 0 { 2 } else { 1 } } else { 1 };

            // Moon
            let d_moon = ((r as f64 - 5.0).powi(2) + (c as f64 - 22.0).powi(2)).sqrt();
            if d_moon <= 3.8 {
                col = if d_moon <= 2.2 { 8 } else if d_moon <= 3.0 { 9 } else { 3 };
            }

            // Aurora 1
            let aurora_y1 = 3.0 + (c as f64 * 0.3).sin() * 2.2;
            let dist_a1 = (r as f64 - aurora_y1).abs();
            if dist_a1 <= 1.8 && (c < 18 || r > 8) {
                col = if dist_a1 <= 0.8 { 5 } else if (r as f64) > aurora_y1 { 6 } else { 4 };
            }

            // Aurora 2
            let aurora_y2 = 7.0 + (c as f64 * 0.25 + 1.2).sin() * 2.0;
            let dist_a2 = (r as f64 - aurora_y2).abs();
            if dist_a2 <= 1.6 && c < 19 {
                col = if dist_a2 <= 0.7 { 4 } else { 7 };
            }

            // Stars
            if (r == 1 && c == 4) || (r == 2 && c == 12) || (r == 10 && c == 2) || (r == 11 && c == 26) || (r == 8 && c == 14) {
                col = 8;
            }

            // Cliff
            let cliff_edge = 10.0 + (27.0 - r as f64) * 0.6;
            if c as f64 >= cliff_edge && r >= 19 {
                col = if (c as f64 - cliff_edge).abs() < 1.0 { 10 } else { 12 };
            }

            // Wolf Howling
            if (r == 11 && (c == 15 || c == 16)) || (r == 12 && (c == 13 || c == 14 || c == 15)) {
                col = if c == 16 || r == 11 { 11 } else { 10 };
            }
            if r == 13 && c >= 11 && c <= 14 {
                col = if c == 11 || c == 14 { 11 } else { 10 };
            }
            if r >= 14 && r <= 15 && c >= 10 && c <= 14 {
                col = if c == 10 || c == 14 { 11 } else { 10 };
            }
            if r >= 16 && r <= 18 && c >= 9 && c <= 15 {
                col = if c == 9 || c == 15 { 11 } else { 10 };
            }
            if r >= 19 && r <= 21 && c >= 10 && c <= 16 {
                col = if c == 10 { 11 } else { 10 };
            }
            if r >= 18 && r <= 22 && (c == 8 || c == 9) {
                col = if c == 8 { 11 } else { 10 };
            }

            grid[r][c] = col;
        }
    }

    create_diamond_grid(
        "cosmic_wolf_diamond",
        "Cosmic Aurora Wolf",
        "Celestial Wilderness",
        palette_def,
        grid,
    )
}

pub fn generate_lotus_koi_diamond() -> ArtworkData {
    let palette_def = vec![
        (1, "#06283D", "Abyssal Pond Deep"),
        (2, "#144272", "Sapphire Ripple"),
        (3, "#205295", "Clear Spring Blue"),
        (4, "#2C74B3", "Sunlit Water Highlight"),
        (5, "#006466", "Deep Lotus Pad Green"),
        (6, "#2A9D8F", "Emerald Lily Pad"),
        (7, "#E76F51", "Scarlet Koi Scales"),
        (8, "#F4A261", "Golden Topaz Koi"),
        (9, "#FFD166", "Sunbeam Fin Scales"),
        (10, "#FFFFFF", "Pearl Koi Belly"),
        (11, "#FF70A6", "Sacred Lotus Petal"),
        (12, "#FFEAA7", "Golden Stamen Heart"),
    ];

    let n = 28;
    let mut grid = vec![vec![1; n]; n];

    let koi1_path = [
        (8.0, 8.0, 8), (9.0, 7.0, 7), (10.0, 7.0, 8),
        (11.0, 6.0, 10), (12.0, 6.0, 7), (13.0, 6.0, 8),
        (14.0, 6.0, 7), (15.0, 6.0, 8), (16.0, 7.0, 10),
        (17.0, 7.0, 8), (18.0, 8.0, 7), (19.0, 9.0, 8),
        (20.0, 10.0, 9), (21.0, 11.0, 9),
    ];

    let koi2_path = [
        (19.0, 20.0, 8), (18.0, 21.0, 7), (17.0, 21.0, 8),
        (16.0, 22.0, 10), (15.0, 22.0, 7), (14.0, 22.0, 8),
        (13.0, 22.0, 7), (12.0, 22.0, 8), (11.0, 21.0, 10),
        (10.0, 21.0, 8), (9.0, 20.0, 7), (8.0, 19.0, 8),
        (7.0, 18.0, 9), (6.0, 17.0, 9),
    ];

    for r in 0..n {
        for c in 0..n {
            let d_center = ((r as f64 - 14.0).powi(2) + (c as f64 - 14.0).powi(2)).sqrt();
            let ripple = (d_center * 0.8).sin();
            let mut col = if ripple > 0.4 { 3 } else if ripple > -0.2 { 2 } else { 1 };

            // Lilypad 1
            let d_pad1 = ((r as f64 - 4.0).powi(2) + (c as f64 - 5.0).powi(2)).sqrt();
            if d_pad1 <= 3.8 && !(r == 4 && c <= 5) {
                col = if d_pad1 <= 2.8 { 6 } else { 5 };
            }

            // Lilypad 2
            let d_pad2 = ((r as f64 - 23.0).powi(2) + (c as f64 - 22.0).powi(2)).sqrt();
            if d_pad2 <= 3.6 && !(c == 22 && r >= 23) {
                col = if d_pad2 <= 2.6 { 6 } else { 5 };
            }

            // Koi 1
            for &(kr, kc, kt) in &koi1_path {
                if ((r as f64 - kr).powi(2) + (c as f64 - kc).powi(2)).sqrt() < 1.3 {
                    col = kt;
                }
            }
            if (r == 10 && c == 5) || (r == 11 && c == 5) || (r == 15 && c == 5) || (r == 16 && c == 5) {
                col = 9;
            }

            // Koi 2
            for &(kr, kc, kt) in &koi2_path {
                if ((r as f64 - kr).powi(2) + (c as f64 - kc).powi(2)).sqrt() < 1.3 {
                    col = kt;
                }
            }
            if (r == 17 && c == 23) || (r == 18 && c == 23) || (r == 12 && c == 23) || (r == 13 && c == 23) {
                col = 9;
            }

            // Lotus
            let d_lotus = ((r as f64 - 14.0).powi(2) + (c as f64 - 14.0).powi(2)).sqrt();
            if d_lotus <= 3.2 {
                col = if d_lotus <= 1.0 { 12 } else if d_lotus <= 2.2 { if (r + c) % 2 == 0 { 11 } else { 10 } } else { 11 };
            }

            grid[r][c] = col;
        }
    }

    create_diamond_grid(
        "lotus_koi_diamond",
        "Zen Lotus & Golden Koi",
        "Harmonic Waters",
        palette_def,
        grid,
    )
}

