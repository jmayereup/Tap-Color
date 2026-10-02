use crate::models::{ArtworkData, PaletteItem, Point, Region};

#[allow(dead_code)]
pub fn get_available_artwork_ids() -> Vec<(&'static str, &'static str)> {
    vec![
        ("hummingbird", "Origami Hummingbird & Blossoms"),
        ("cosmic_whale", "Cosmic Whale & Constellations"),
        ("stained_butterfly", "Stained Glass Monarch"),
        ("sunset_landscape", "Geometric Sunset Mountains"),
    ]
}

pub fn load_artwork(id: &str) -> ArtworkData {
    match id {
        "cosmic_whale" => generate_cosmic_whale(),
        "stained_butterfly" => generate_stained_butterfly(),
        "sunset_landscape" => generate_sunset_landscape(),
        _ => generate_hummingbird(),
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
        title: format!("Stained Glass Mosaic #{}", seed % 1000),
        artist: "Procedural Generator".to_string(),
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
        title: "Stained Glass Monarch".to_string(),
        artist: "Prism Sanctuary".to_string(),
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
