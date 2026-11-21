use std::f64::consts::PI;
use wasm_bindgen::JsCast;
use web_sys::{CanvasPattern, CanvasRenderingContext2d, CanvasWindingRule, HtmlCanvasElement, HtmlImageElement};

use crate::artworks::{generate_procedural_mosaic, load_artwork};
use crate::models::{ArtworkData, Particle, Point, Region, TapFeedback};

pub struct GameEngine {
    pub artwork: ArtworkData,
    pub active_number: usize,
    pub show_outlines: bool,
    pub pan_x: f64,
    pub pan_y: f64,
    pub scale: f64,
    pub target_pan_x: f64,
    pub target_pan_y: f64,
    pub target_scale: f64,
    pub particles: Vec<Particle>,
    pub hint_region_id: Option<usize>,
    pub hint_timer: f64,
    pub last_time: f64,
    pub pulse_phase: f64,
    pub highlight_matching_tiles: bool,
    pub line_art_image: Option<HtmlImageElement>,
    pub hatch_pattern: Option<CanvasPattern>,
    pub undo_stack: Vec<Vec<usize>>,
    pub dirty: bool,
}

impl GameEngine {
    pub fn new(artwork_id: &str) -> Self {
        let mut artwork = load_artwork(artwork_id);
        artwork.precompute_bboxes();
        let first_active = artwork.palette.first().map(|p| p.number).unwrap_or(1);

        GameEngine {
            artwork,
            active_number: first_active,
            show_outlines: true,
            highlight_matching_tiles: false,
            pan_x: 0.0,
            pan_y: 0.0,
            scale: 1.0,
            target_pan_x: 0.0,
            target_pan_y: 0.0,
            target_scale: 1.0,
            particles: Vec::new(),
            hint_region_id: None,
            hint_timer: 0.0,
            last_time: 0.0,
            pulse_phase: 0.0,
            line_art_image: None,
            hatch_pattern: None,
            undo_stack: Vec::new(),
            dirty: true,
        }
    }

    pub fn is_diamond_art(&self) -> bool {
        self.artwork.id.contains("diamond")
            || (self.artwork.regions.len() > 300
                && self.artwork.regions.first().map_or(false, |r| r.polygon.len() == 4))
    }

    pub fn needs_render(&self) -> bool {
        self.dirty
            || (self.target_pan_x - self.pan_x).abs() > 0.05
            || (self.target_pan_y - self.pan_y).abs() > 0.05
            || (self.target_scale - self.scale).abs() > 0.0005
            || !self.particles.is_empty()
            || self.hint_timer > 0.0
            || self.highlight_matching_tiles
            || self.artwork.regions.iter().any(|r| r.is_filled && r.fill_anim < 1.0)
    }

    pub fn set_line_art_image(&mut self, img: Option<HtmlImageElement>) {
        self.line_art_image = img;
        self.dirty = true;
    }

    fn ensure_hatch_pattern(&mut self, ctx: &CanvasRenderingContext2d) {
        if self.hatch_pattern.is_some() {
            return;
        }
        if let Some(window) = web_sys::window() {
            if let Some(document) = window.document() {
                if let Ok(el) = document.create_element("canvas") {
                    if let Ok(tile) = el.dyn_into::<HtmlCanvasElement>() {
                        tile.set_width(10);
                        tile.set_height(10);
                        if let Ok(Some(tctx_obj)) = tile.get_context("2d") {
                            if let Ok(tctx) = tctx_obj.dyn_into::<CanvasRenderingContext2d>() {
                                tctx.set_fill_style_str("#E8EEF5");
                                tctx.fill_rect(0.0, 0.0, 10.0, 10.0);
                                tctx.set_stroke_style_str("rgba(100, 116, 139, 0.32)");
                                tctx.set_line_width(1.6);
                                tctx.begin_path();
                                tctx.move_to(-2.0, 12.0);
                                tctx.line_to(12.0, -2.0);
                                tctx.move_to(-2.0, 2.0);
                                tctx.line_to(2.0, -2.0);
                                tctx.move_to(8.0, 12.0);
                                tctx.line_to(12.0, 8.0);
                                tctx.stroke();
                                if let Ok(pat) = ctx.create_pattern_with_html_canvas_element(&tile, "repeat") {
                                    self.hatch_pattern = pat;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    fn trace_region_path(ctx: &CanvasRenderingContext2d, region: &Region) {
        ctx.begin_path();
        ctx.move_to(region.polygon[0].x, region.polygon[0].y);
        for pt in region.polygon.iter().skip(1) {
            ctx.line_to(pt.x, pt.y);
        }
        ctx.close_path();
        for hole in &region.holes {
            if hole.len() >= 3 {
                ctx.move_to(hole[0].x, hole[0].y);
                for pt in hole.iter().skip(1) {
                    ctx.line_to(pt.x, pt.y);
                }
                ctx.close_path();
            }
        }
    }

    pub fn load_artwork_by_id(&mut self, id: &str) {
        self.artwork = load_artwork(id);
        self.artwork.precompute_bboxes();
        self.reset_state();
    }

    pub fn load_custom_mosaic(&mut self, seed: u32, palette_type: &str) {
        self.artwork = generate_procedural_mosaic(seed, palette_type);
        self.artwork.precompute_bboxes();
        self.reset_state();
    }

    pub fn reset_state(&mut self) {
        self.active_number = self.artwork.palette.first().map(|p| p.number).unwrap_or(1);
        self.particles.clear();
        self.hint_region_id = None;
        self.hint_timer = 0.0;
        self.highlight_matching_tiles = false;
        self.line_art_image = None;
        self.pan_x = 0.0;
        self.pan_y = 0.0;
        self.scale = 1.0;
        self.target_pan_x = 0.0;
        self.target_pan_y = 0.0;
        self.target_scale = 1.0;
        self.undo_stack.clear();
        self.dirty = true;
    }

    pub fn screen_to_world(&self, screen_x: f64, screen_y: f64) -> Point {
        let wx = (screen_x - self.pan_x) / self.scale;
        let wy = (screen_y - self.pan_y) / self.scale;
        Point::new(wx, wy)
    }

    #[allow(dead_code)]
    pub fn world_to_screen(&self, world_x: f64, world_y: f64) -> Point {
        let sx = world_x * self.scale + self.pan_x;
        let sy = world_y * self.scale + self.pan_y;
        Point::new(sx, sy)
    }

    pub fn select_number(&mut self, num: usize) {
        self.active_number = num;
        self.hint_region_id = None;
        self.dirty = true;
    }

    fn point_in_rect(x: f64, y: f64, min_x: f64, min_y: f64, max_x: f64, max_y: f64) -> bool {
        x >= min_x && x <= max_x && y >= min_y && y <= max_y
    }

    fn segment_intersects_rect(
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        min_x: f64,
        min_y: f64,
        max_x: f64,
        max_y: f64,
    ) -> bool {
        let dx = x2 - x1;
        let dy = y2 - y1;
        let mut t0 = 0.0_f64;
        let mut t1 = 1.0_f64;
        let checks = [
            (-dx, x1 - min_x),
            (dx, max_x - x1),
            (-dy, y1 - min_y),
            (dy, max_y - y1),
        ];
        for (p, q) in checks {
            if p.abs() < 1e-12 {
                if q < 0.0 {
                    return false;
                }
            } else {
                let r = q / p;
                if p < 0.0 {
                    if r > t1 {
                        return false;
                    }
                    if r > t0 {
                        t0 = r;
                    }
                } else {
                    if r < t0 {
                        return false;
                    }
                    if r < t1 {
                        t1 = r;
                    }
                }
            }
        }
        t0 <= t1
    }

    fn region_intersects_rect(
        region: &Region,
        min_x: f64,
        min_y: f64,
        max_x: f64,
        max_y: f64,
        view_center: Point,
    ) -> bool {
        if Self::point_in_rect(region.centroid.x, region.centroid.y, min_x, min_y, max_x, max_y) {
            return true;
        }
        let n = region.polygon.len();
        for pt in &region.polygon {
            if Self::point_in_rect(pt.x, pt.y, min_x, min_y, max_x, max_y) {
                return true;
            }
        }
        for i in 0..n {
            let p1 = &region.polygon[i];
            let p2 = &region.polygon[(i + 1) % n];
            if Self::segment_intersects_rect(p1.x, p1.y, p2.x, p2.y, min_x, min_y, max_x, max_y) {
                return true;
            }
        }
        region.contains_point(view_center)
    }

    /// Returns the distinct unfilled palette numbers currently visible within the viewport
    pub fn get_visible_unfilled_numbers(&self, viewport_w: f64, viewport_h: f64) -> Vec<usize> {
        let (pan_x, pan_y, scale) = if self.last_time > 0.0 {
            (self.pan_x, self.pan_y, self.scale)
        } else {
            (self.target_pan_x, self.target_pan_y, self.target_scale)
        };

        if scale <= 0.0 || viewport_w <= 0.0 || viewport_h <= 0.0 {
            return self
                .artwork
                .palette
                .iter()
                .filter(|p| !p.is_completed)
                .map(|p| p.number)
                .collect();
        }

        let incomplete_total = self.artwork.palette.iter().filter(|p| !p.is_completed).count();
        if incomplete_total == 0 {
            return Vec::new();
        }

        let view_min_x = -pan_x / scale;
        let view_max_x = (viewport_w - pan_x) / scale;
        let view_min_y = -pan_y / scale;
        let view_max_y = (viewport_h - pan_y) / scale;
        let view_center = Point::new(
            (view_min_x + view_max_x) * 0.5,
            (view_min_y + view_max_y) * 0.5,
        );

        let max_num = self.artwork.palette.iter().map(|p| p.number).max().unwrap_or(0);
        let mut seen = vec![false; max_num + 1];
        let mut seen_count = 0usize;
        let is_diamond = self.is_diamond_art();

        for region in &self.artwork.regions {
            if region.is_filled {
                continue;
            }
            let num = region.number;
            if num < seen.len() && seen[num] {
                continue;
            }
            if region.polygon.len() < 3 {
                continue;
            }
            let (r_min_x, r_min_y, r_max_x, r_max_y) = region.bbox;
            if r_max_x < view_min_x
                || r_min_x > view_max_x
                || r_max_y < view_min_y
                || r_min_y > view_max_y
            {
                continue;
            }

            let is_visible = if is_diamond {
                true
            } else {
                Self::region_intersects_rect(
                    region,
                    view_min_x,
                    view_min_y,
                    view_max_x,
                    view_max_y,
                    view_center,
                )
            };

            if is_visible {
                if num < seen.len() {
                    seen[num] = true;
                }
                seen_count += 1;
                if seen_count >= incomplete_total {
                    break;
                }
            }
        }

        self.artwork
            .palette
            .iter()
            .filter(|p| !p.is_completed && p.number < seen.len() && seen[p.number])
            .map(|p| p.number)
            .collect()
    }

    /// Fast O(1) grid hit-testing for Diamond Art, fallback to polygon test
    pub fn find_region_at_world_point(&self, world_pt: Point) -> Option<usize> {
        let total_regions = self.artwork.regions.len();
        if total_regions == 0 {
            return None;
        }

        if self.is_diamond_art() && total_regions >= 100 {
            if let (Some(p0), Some(p2)) = (
                self.artwork.regions[0].polygon.first(),
                self.artwork.regions[0].polygon.get(2),
            ) {
                let cell_w = (p2.x - p0.x).abs();
                let cell_h = (p2.y - p0.y).abs();
                if cell_w > 0.01 && cell_h > 0.01 {
                    let origin_x = p0.x;
                    let origin_y = p0.y;
                    let cols = ((self.artwork.width - origin_x * 2.0) / cell_w).round().max(1.0) as usize;
                    let rows = (total_regions + cols - 1) / cols;
                    if world_pt.x >= origin_x && world_pt.y >= origin_y {
                        let col = ((world_pt.x - origin_x) / cell_w).floor() as usize;
                        let row = ((world_pt.y - origin_y) / cell_h).floor() as usize;
                        if col < cols && row < rows {
                            let idx = row * cols + col;
                            if idx < total_regions {
                                let r = &self.artwork.regions[idx];
                                if world_pt.x >= r.bbox.0 - 0.1
                                    && world_pt.x <= r.bbox.2 + 0.1
                                    && world_pt.y >= r.bbox.1 - 0.1
                                    && world_pt.y <= r.bbox.3 + 0.1
                                {
                                    return Some(idx);
                                }
                            }
                        }
                    }
                }
            }
        }

        self.artwork.regions.iter().rposition(|region| {
            if region.polygon.len() < 3 {
                return false;
            }
            let (min_x, min_y, max_x, max_y) = region.bbox;
            if world_pt.x < min_x - 0.5
                || world_pt.x > max_x + 0.5
                || world_pt.y < min_y - 0.5
                || world_pt.y > max_y + 0.5
            {
                return false;
            }
            region.contains_point(world_pt)
        })
    }

    /// Handles a tap/click at canvas coordinates
    pub fn handle_tap(&mut self, screen_x: f64, screen_y: f64) -> TapFeedback {
        let world_pt = self.screen_to_world(screen_x, screen_y);
        let mut found_idx = self.find_region_at_world_point(world_pt);
        let total_regions = self.artwork.regions.len();

        // Smart ~7px screen-space snap for tiny regions/slivers when exact point missed or hit a filled/wrong neighbor
        let exact_matches_active = found_idx
            .and_then(|i| self.artwork.regions.get(i))
            .map_or(false, |r| !r.is_filled && r.number == self.active_number);

        if !exact_matches_active {
            let snap_r = 7.0 / self.scale.max(0.1);
            let dirs = [
                (snap_r, 0.0), (-snap_r, 0.0), (0.0, snap_r), (0.0, -snap_r),
                (snap_r * 0.707, snap_r * 0.707), (-snap_r * 0.707, snap_r * 0.707),
                (snap_r * 0.707, -snap_r * 0.707), (-snap_r * 0.707, -snap_r * 0.707),
                (snap_r * 0.45, 0.0), (-snap_r * 0.45, 0.0), (0.0, snap_r * 0.45), (0.0, -snap_r * 0.45),
            ];
            let mut best_idx = None;
            let mut best_dist_sq = f64::INFINITY;
            for (i, r) in self.artwork.regions.iter().enumerate().rev() {
                if r.is_filled || r.number != self.active_number || r.polygon.len() < 3 {
                    continue;
                }
                let (min_x, min_y, max_x, max_y) = r.bbox;
                if world_pt.x < min_x - snap_r
                    || world_pt.x > max_x + snap_r
                    || world_pt.y < min_y - snap_r
                    || world_pt.y > max_y + snap_r
                {
                    continue;
                }
                let hit = dirs.iter().any(|(ox, oy)| {
                    let probe = Point::new(world_pt.x + ox, world_pt.y + oy);
                    r.contains_point(probe)
                });
                if hit {
                    let dx = r.centroid.x - world_pt.x;
                    let dy = r.centroid.y - world_pt.y;
                    let d_sq = dx * dx + dy * dy;
                    if d_sq < best_dist_sq {
                        best_dist_sq = d_sq;
                        best_idx = Some(i);
                    }
                }
            }
            if best_idx.is_some() {
                found_idx = best_idx;
            }
        }

        if let Some(idx) = found_idx {
            let region = &mut self.artwork.regions[idx];
            let reg_number = region.number;
            let reg_id = region.id;
            let centroid = region.centroid;

            if !region.is_filled {
                if reg_number == self.active_number {
                    // Correct tap!
                    region.is_filled = true;
                    region.fill_anim = 0.0; // Starts pop/expand animation
                    self.undo_stack.push(vec![idx]);
                    if self.undo_stack.len() > 100 {
                        self.undo_stack.remove(0);
                    }

                    // Clear active hint if this was the hinted region
                    if self.hint_region_id == Some(reg_id) {
                        self.hint_region_id = None;
                    }

                    // Update palette count
                    let mut color_completed = false;
                    if let Some(pal_item) = self
                        .artwork
                        .palette
                        .iter_mut()
                        .find(|p| p.number == self.active_number)
                    {
                        pal_item.filled_count += 1;
                        if pal_item.filled_count >= pal_item.total_count {
                            pal_item.is_completed = true;
                            color_completed = true;
                        }
                    }

                    // Check if entire artwork is completed
                    let filled_count = self
                        .artwork
                        .regions
                        .iter()
                        .filter(|r| r.is_filled)
                        .count();
                    let artwork_completed = filled_count == total_regions;

                    if artwork_completed {
                        // Grand fireworks
                        for _ in 0..5 {
                            let rx = (idx as f64 * 37.0) % self.artwork.width;
                            let ry = (idx as f64 * 53.0) % self.artwork.height;
                            self.spawn_burst(rx, ry, "#FFD700", 25);
                        }
                    } else if color_completed {
                        // Auto-advance to next incomplete number
                        if let Some(next_pal) = self.artwork.palette.iter().find(|p| !p.is_completed) {
                            self.active_number = next_pal.number;
                        }
                    }

                    self.dirty = true;
                    return TapFeedback {
                        success: true,
                        region_id: Some(reg_id),
                        number: Some(reg_number),
                        correct_number: Some(self.active_number),
                        color_completed,
                        artwork_completed,
                        total_filled: filled_count,
                        total_regions,
                        percent: (filled_count as f64 / total_regions.max(1) as f64) * 100.0,
                        target_point: Some(centroid),
                    };
                } else {
                    // Mismatched number tapped: return feedback
                    let filled_count = self
                        .artwork
                        .regions
                        .iter()
                        .filter(|r| r.is_filled)
                        .count();
                    return TapFeedback {
                        success: false,
                        region_id: Some(reg_id),
                        number: Some(reg_number),
                        correct_number: Some(self.active_number),
                        color_completed: false,
                        artwork_completed: false,
                        total_filled: filled_count,
                        total_regions,
                        percent: (filled_count as f64 / total_regions.max(1) as f64) * 100.0,
                        target_point: Some(centroid),
                    };
                }
            }
        }

        let filled_count = self
            .artwork
            .regions
            .iter()
            .filter(|r| r.is_filled)
            .count();
        TapFeedback {
            success: false,
            region_id: None,
            number: None,
            correct_number: Some(self.active_number),
            color_completed: false,
            artwork_completed: false,
            total_filled: filled_count,
            total_regions,
            percent: (filled_count as f64 / total_regions.max(1) as f64) * 100.0,
            target_point: None,
        }
    }

    /// Finds an uncompleted region matching the active number and centers camera on it
    pub fn trigger_hint(&mut self, canvas_w: f64, canvas_h: f64) -> Option<Point> {
        let is_diamond_art = self.is_diamond_art();
        let uncompleted = self
            .artwork
            .regions
            .iter()
            .find(|r| !r.is_filled && r.number == self.active_number);

        if let Some(reg) = uncompleted {
            self.hint_region_id = Some(reg.id);
            self.hint_timer = 5.0; // 5 seconds highlight
            self.dirty = true;

            // Smoothly pan camera to center this region with zoom scaled to drill size
            let drill_world_size = if is_diamond_art && !self.artwork.regions.is_empty() {
                let p0 = self.artwork.regions[0].polygon.first();
                let p1 = self.artwork.regions[0].polygon.get(1);
                if let (Some(a), Some(b)) = (p0, p1) {
                    let dx = (b.x - a.x).abs();
                    if dx > 0.01 { dx } else { 16.0 }
                } else {
                    16.0
                }
            } else {
                16.0
            };
            let target_s = if is_diamond_art {
                (24.0 / drill_world_size).clamp(1.8, 5.0)
            } else if reg.label_radius > 0.5 {
                let d = (reg.label_radius * 2.0).max(4.0);
                (26.0 / d).clamp(1.35, 4.5)
            } else {
                let (min_x, min_y, max_x, max_y) = reg.bbox;
                let span = (max_x - min_x).min(max_y - min_y).max(4.0);
                (32.0 / span).clamp(1.35, 4.5)
            };
            self.target_scale = target_s;
            self.target_pan_x = canvas_w / 2.0 - reg.centroid.x * target_s;
            self.target_pan_y = canvas_h / 2.0 - reg.centroid.y * target_s;

            Some(reg.centroid)
        } else {
            None
        }
    }

    /// Toggle highlight on all matching tiles of the active number
    pub fn toggle_matching_hints(&mut self) -> bool {
        self.highlight_matching_tiles = !self.highlight_matching_tiles;
        self.dirty = true;
        self.highlight_matching_tiles
    }

    /// Set matching tiles highlight directly
    pub fn set_matching_hints(&mut self, enabled: bool) {
        self.highlight_matching_tiles = enabled;
        self.dirty = true;
    }

    /// Erase / remove color from a region under screen coordinates
    pub fn handle_erase(&mut self, screen_x: f64, screen_y: f64) -> TapFeedback {
        let world_pt = self.screen_to_world(screen_x, screen_y);
        let found_idx = self.find_region_at_world_point(world_pt);
        let total_regions = self.artwork.regions.len();

        if let Some(idx) = found_idx {
            let region = &mut self.artwork.regions[idx];
            if region.is_filled {
                region.is_filled = false;
                region.fill_anim = 0.0;
                let reg_num = region.number;
                let reg_id = region.id;
                let centroid = region.centroid;

                // Spawn gentle eraser dust particles
                self.spawn_burst(centroid.x, centroid.y, "#94A3B8", 8);

                // Update palette count
                if let Some(pal_item) = self
                    .artwork
                    .palette
                    .iter_mut()
                    .find(|p| p.number == reg_num)
                {
                    if pal_item.filled_count > 0 {
                        pal_item.filled_count -= 1;
                    }
                    pal_item.is_completed = false;
                }

                let filled_count = self
                    .artwork
                    .regions
                    .iter()
                    .filter(|r| r.is_filled)
                    .count();

                self.dirty = true;
                return TapFeedback {
                    success: true,
                    region_id: Some(reg_id),
                    number: Some(reg_num),
                    correct_number: Some(self.active_number),
                    color_completed: false,
                    artwork_completed: false,
                    total_filled: filled_count,
                    total_regions,
                    percent: (filled_count as f64 / total_regions.max(1) as f64) * 100.0,
                    target_point: Some(centroid),
                };
            }
        }

        let filled_count = self
            .artwork
            .regions
            .iter()
            .filter(|r| r.is_filled)
            .count();

        TapFeedback {
            success: false,
            region_id: None,
            number: None,
            correct_number: Some(self.active_number),
            color_completed: false,
            artwork_completed: false,
            total_filled: filled_count,
            total_regions,
            percent: (filled_count as f64 / total_regions.max(1) as f64) * 100.0,
            target_point: None,
        }
    }

    /// Clear all filled tiles on current artwork
    pub fn clear_all_tiles(&mut self) -> TapFeedback {
        for region in self.artwork.regions.iter_mut() {
            region.is_filled = false;
            region.fill_anim = 0.0;
        }

        for pal_item in self.artwork.palette.iter_mut() {
            pal_item.filled_count = 0;
            pal_item.is_completed = false;
        }
        self.undo_stack.clear();
        self.dirty = true;

        let total_regions = self.artwork.regions.len();
        TapFeedback {
            success: true,
            region_id: None,
            number: None,
            correct_number: Some(self.active_number),
            color_completed: false,
            artwork_completed: false,
            total_filled: 0,
            total_regions,
            percent: 0.0,
            target_point: None,
        }
    }

    /// Magic Wand: fills all remaining pieces of active number
    pub fn fill_all_of_current(&mut self) -> TapFeedback {
        let mut filled_indices = Vec::new();
        let active = self.active_number;
        let mut last_pt = None;

        for (idx, r) in self.artwork.regions.iter_mut().enumerate() {
            if !r.is_filled && r.number == active {
                r.is_filled = true;
                r.fill_anim = 0.0;
                filled_indices.push(idx);
                last_pt = Some(r.centroid);
            }
        }
        let filled_any = !filled_indices.is_empty();
        if filled_any {
            self.undo_stack.push(filled_indices);
            if self.undo_stack.len() > 100 {
                self.undo_stack.remove(0);
            }
        }

        if let Some(pal) = self.artwork.palette.iter_mut().find(|p| p.number == active) {
            pal.filled_count = pal.total_count;
            pal.is_completed = true;
        }

        let total_filled = self.artwork.regions.iter().filter(|r| r.is_filled).count();
        let total = self.artwork.regions.len();
        let artwork_completed = total > 0 && total_filled == total;

        if filled_any {
            self.dirty = true;
            if artwork_completed {
                for i in 0..5 {
                    let rx = ((i + 1) as f64 * 137.0) % self.artwork.width;
                    let ry = ((i + 1) as f64 * 193.0) % self.artwork.height;
                    self.spawn_burst(rx, ry, "#FFD700", 25);
                }
            } else if let Some(pt) = last_pt {
                self.spawn_burst(pt.x, pt.y, "#FFD700", 24);
            }
            if let Some(next_pal) = self.artwork.palette.iter().find(|p| !p.is_completed) {
                self.active_number = next_pal.number;
            }
        }

        TapFeedback {
            success: filled_any,
            region_id: None,
            number: Some(active),
            correct_number: Some(self.active_number),
            color_completed: filled_any,
            artwork_completed,
            total_filled,
            total_regions: total,
            percent: (total_filled as f64 / total.max(1) as f64) * 100.0,
            target_point: last_pt,
        }
    }

    /// Undo the most recent fill action (single tap or fill-all batch)
    pub fn undo_last(&mut self) -> TapFeedback {
        let total_regions = self.artwork.regions.len();
        let Some(indices) = self.undo_stack.pop() else {
            let total_filled = self.artwork.regions.iter().filter(|r| r.is_filled).count();
            return TapFeedback {
                success: false,
                region_id: None,
                number: None,
                correct_number: Some(self.active_number),
                color_completed: false,
                artwork_completed: false,
                total_filled,
                total_regions,
                percent: (total_filled as f64 / total_regions.max(1) as f64) * 100.0,
                target_point: None,
            };
        };

        let mut undone_number = None;
        let mut last_pt = None;

        for idx in indices {
            if let Some(region) = self.artwork.regions.get_mut(idx) {
                if region.is_filled {
                    region.is_filled = false;
                    region.fill_anim = 0.0;
                    let num = region.number;
                    undone_number = Some(num);
                    last_pt = Some(region.centroid);
                    if let Some(pal_item) = self.artwork.palette.iter_mut().find(|p| p.number == num) {
                        pal_item.filled_count = pal_item.filled_count.saturating_sub(1);
                        pal_item.is_completed = pal_item.filled_count >= pal_item.total_count;
                    }
                }
            }
        }

        if let Some(num) = undone_number {
            self.active_number = num;
            self.dirty = true;
        }

        let total_filled = self.artwork.regions.iter().filter(|r| r.is_filled).count();
        TapFeedback {
            success: undone_number.is_some(),
            region_id: None,
            number: undone_number,
            correct_number: Some(self.active_number),
            color_completed: false,
            artwork_completed: false,
            total_filled,
            total_regions,
            percent: (total_filled as f64 / total_regions.max(1) as f64) * 100.0,
            target_point: last_pt,
        }
    }

    pub fn set_viewport(&mut self, px: f64, py: f64, s: f64) {
        self.pan_x = px;
        self.pan_y = py;
        self.scale = s;
        self.target_pan_x = px;
        self.target_pan_y = py;
        self.target_scale = s;
        self.dirty = true;
    }

    pub fn fit_to_screen(&mut self, canvas_w: f64, canvas_h: f64) {
        let margin = 40.0;
        let avail_w = (canvas_w - margin * 2.0).max(100.0);
        let avail_h = (canvas_h - margin * 2.0).max(100.0);

        let scale_x = avail_w / self.artwork.width;
        let scale_y = avail_h / self.artwork.height;
        let s = scale_x.min(scale_y).min(1.2);

        let px = (canvas_w - self.artwork.width * s) / 2.0;
        let py = (canvas_h - self.artwork.height * s) / 2.0;

        self.target_scale = s;
        self.target_pan_x = px;
        self.target_pan_y = py;
        self.dirty = true;
    }

    /// Render complete high-resolution artwork to canvas context without viewport panning, zooming, numbers, or UI overlays
    pub fn render_export(&self, ctx: &CanvasRenderingContext2d, width: f64, height: f64, force_all_filled: bool) {
        ctx.clear_rect(0.0, 0.0, width, height);
        ctx.set_fill_style_str("#FFFFFF");
        ctx.fill_rect(0.0, 0.0, width, height);

        let scale_x = width / self.artwork.width;
        let scale_y = height / self.artwork.height;
        let s = scale_x.min(scale_y);
        let ox = (width - self.artwork.width * s) / 2.0;
        let oy = (height - self.artwork.height * s) / 2.0;

        ctx.save();
        let _ = ctx.translate(ox, oy);
        let _ = ctx.scale(s, s);

        let is_diamond_art = self.is_diamond_art();
        let has_line_art = self.line_art_image.is_some();
        let drill_screen_size = if is_diamond_art && !self.artwork.regions.is_empty() {
            let p0 = self.artwork.regions[0].polygon.first();
            let p1 = self.artwork.regions[0].polygon.get(1);
            if let (Some(a), Some(b)) = (p0, p1) {
                (b.x - a.x).abs() * s
            } else {
                16.0 * s
            }
        } else {
            16.0 * s
        };
        let can_draw_facets = is_diamond_art && drill_screen_size >= 8.0;

        for region in &self.artwork.regions {
            let n = region.polygon.len();
            if n < 3 {
                continue;
            }

            let is_filled = region.is_filled || force_all_filled;
            let is_quad = is_diamond_art && n == 4;
            let (p0, p1, p2, p3) = if is_quad {
                (region.polygon[0], region.polygon[1], region.polygon[2], region.polygon[3])
            } else {
                (Point::new(0.0, 0.0), Point::new(0.0, 0.0), Point::new(0.0, 0.0), Point::new(0.0, 0.0))
            };
            let cell_w = p1.x - p0.x;
            let cell_h = p2.y - p1.y;
            let cx = region.centroid.x;
            let cy = region.centroid.y;

            if is_filled {
                ctx.set_fill_style_str(&region.color_hex);
                if is_quad {
                    ctx.fill_rect(p0.x, p0.y, cell_w, cell_h);
                } else {
                    Self::trace_region_path(ctx, region);
                    ctx.fill_with_canvas_winding_rule(CanvasWindingRule::Evenodd);

                    // Seam-seal stroke: prevents anti-aliasing white cracks between adjacent polygons
                    ctx.set_stroke_style_str(&region.color_hex);
                    ctx.set_line_width(if has_line_art { 0.8 } else { (1.5 / s).max(0.8) });
                    ctx.stroke();
                }

                if is_quad && can_draw_facets {
                    // Top-left diagonal highlight
                    ctx.begin_path();
                    ctx.move_to(p0.x, p0.y);
                    ctx.line_to(p1.x, p1.y);
                    ctx.line_to(p3.x, p3.y);
                    ctx.close_path();
                    ctx.set_fill_style_str("rgba(255, 255, 255, 0.18)");
                    ctx.fill();

                    // Bottom-right diagonal shadow
                    ctx.begin_path();
                    ctx.move_to(p1.x, p1.y);
                    ctx.line_to(p2.x, p2.y);
                    ctx.line_to(p3.x, p3.y);
                    ctx.close_path();
                    ctx.set_fill_style_str("rgba(0, 0, 0, 0.16)");
                    ctx.fill();

                    // Center table facet
                    let hw = cell_w.abs() * 0.28;
                    let hh = cell_h.abs() * 0.28;

                    ctx.begin_path();
                    ctx.move_to(cx, cy - hh);
                    ctx.line_to(cx + hw, cy);
                    ctx.line_to(cx, cy + hh);
                    ctx.line_to(cx - hw, cy);
                    ctx.close_path();
                    ctx.set_fill_style_str("rgba(255, 255, 255, 0.12)");
                    ctx.fill();

                    if drill_screen_size >= 12.0 {
                        let s_dot = (1.6 / s).max(1.0);
                        ctx.set_fill_style_str("rgba(255, 255, 255, 0.75)");
                        ctx.fill_rect(cx - hw * 0.4, cy - hh * 0.4, s_dot, s_dot);
                    }
                }
            } else {
                ctx.set_fill_style_str("#F8FAFC");
                if is_quad {
                    ctx.fill_rect(p0.x, p0.y, cell_w, cell_h);
                } else {
                    Self::trace_region_path(ctx, region);
                    ctx.fill_with_canvas_winding_rule(CanvasWindingRule::Evenodd);
                }
            }

            // Outline strokes (when line_art_image is present, only draw faint hairline guides on unfilled regions)
            if self.show_outlines {
                if is_diamond_art {
                    ctx.set_stroke_style_str("rgba(148, 163, 184, 0.35)");
                    ctx.set_line_width((0.7 / s).max(0.5));
                    if is_quad {
                        ctx.stroke_rect(p0.x, p0.y, cell_w, cell_h);
                    } else {
                        Self::trace_region_path(ctx, region);
                        ctx.stroke();
                    }
                } else if !has_line_art {
                    ctx.set_stroke_style_str("rgba(30, 41, 59, 0.72)");
                    ctx.set_line_width((1.8 / s).max(1.0));
                    Self::trace_region_path(ctx, region);
                    ctx.stroke();
                } else if !is_filled {
                    ctx.set_stroke_style_str("rgba(148, 163, 184, 0.35)");
                    ctx.set_line_width((0.7 / s).max(0.4));
                    Self::trace_region_path(ctx, region);
                    ctx.stroke();
                }
            }
        }

        // Composite crisp ink line-art overlay on top
        if let Some(ref img) = self.line_art_image {
            if img.complete() && img.natural_width() > 0 {
                let _ = ctx.draw_image_with_html_image_element_and_dw_and_dh(
                    img,
                    0.0,
                    0.0,
                    self.artwork.width,
                    self.artwork.height,
                );
            }
        }

        ctx.restore();
    }

    pub fn spawn_burst(&mut self, x: f64, y: f64, color: &str, count: usize) {
        for i in 0..count {
            let angle = (i as f64 / count as f64) * 2.0 * PI + (x * 0.01);
            let speed = 2.0 + ((i * 7) % 5) as f64 * 1.5;
            let p = Particle {
                x,
                y,
                vx: angle.cos() * speed,
                vy: angle.sin() * speed,
                color: color.to_string(),
                life: 1.0,
                max_life: 0.6 + ((i * 3) % 4) as f64 * 0.2,
                size: 3.0 + ((i * 5) % 4) as f64,
            };
            self.particles.push(p);
        }
    }

    /// Main 60fps render loop executed in WebAssembly
    pub fn render(&mut self, ctx: &CanvasRenderingContext2d, width: f64, height: f64, timestamp: f64) {
        let dt = if self.last_time > 0.0 {
            ((timestamp - self.last_time) / 1000.0).clamp(0.001, 0.1)
        } else {
            0.016
        };
        self.last_time = timestamp;
        self.pulse_phase += dt * 3.5;

        // Smooth camera lerp
        self.pan_x += (self.target_pan_x - self.pan_x) * (dt * 10.0).min(1.0);
        self.pan_y += (self.target_pan_y - self.pan_y) * (dt * 10.0).min(1.0);
        self.scale += (self.target_scale - self.scale) * (dt * 10.0).min(1.0);

        if self.hint_timer > 0.0 {
            self.hint_timer = (self.hint_timer - dt).max(0.0);
            if self.hint_timer <= 0.0 {
                self.hint_region_id = None;
            }
        }

        // Clear canvas
        ctx.clear_rect(0.0, 0.0, width, height);

        // Save canvas transform
        ctx.save();
        let _ = ctx.translate(self.pan_x, self.pan_y);
        let _ = ctx.scale(self.scale, self.scale);

        // 1. Draw artwork paper boundary (avoid per-frame shadowBlur GPU pass)
        ctx.set_fill_style_str("#FFFFFF");
        ctx.fill_rect(0.0, 0.0, self.artwork.width, self.artwork.height);
        ctx.set_stroke_style_str("rgba(148, 163, 184, 0.35)");
        ctx.set_line_width(1.5 / self.scale.max(0.25));
        ctx.stroke_rect(0.0, 0.0, self.artwork.width, self.artwork.height);

        let active_pulse = self.pulse_phase.sin() * 0.5 + 0.5; // 0.0 to 1.0
        let is_diamond_art = self.is_diamond_art();

        // Viewport Frustum Culling in world coordinates
        let pad = 24.0 / self.scale.max(0.1);
        let view_min_x = -self.pan_x / self.scale - pad;
        let view_max_x = (width - self.pan_x) / self.scale + pad;
        let view_min_y = -self.pan_y / self.scale - pad;
        let view_max_y = (height - self.pan_y) / self.scale + pad;

        // Drill world size and screen size in actual pixels for Level-of-Detail (LOD)
        let drill_world_size = if is_diamond_art && !self.artwork.regions.is_empty() {
            let p0 = self.artwork.regions[0].polygon.first();
            let p1 = self.artwork.regions[0].polygon.get(1);
            if let (Some(a), Some(b)) = (p0, p1) {
                let dx = (b.x - a.x).abs();
                if dx > 0.01 { dx } else { 16.0 }
            } else {
                16.0
            }
        } else {
            16.0
        };
        let drill_screen_size = drill_world_size * self.scale;
        let can_draw_facets = is_diamond_art && drill_screen_size >= 10.0;
        let can_draw_outlines = self.show_outlines && (!is_diamond_art || drill_screen_size >= 3.5);
        let has_line_art = self.line_art_image.is_some();

        if !is_diamond_art {
            self.ensure_hatch_pattern(ctx);
        }

        // 2. Render all regions (fills and animations)
        for region in &mut self.artwork.regions {
            let n = region.polygon.len();
            if n < 3 {
                continue;
            }

            let cx = region.centroid.x;
            let cy = region.centroid.y;

            // Viewport frustum culling:
            // - Diamond drills are tiny squares, so centroid check is exact & O(1).
            // - Paint-by-Number regions can span half the canvas, so cull against bounding box!
            if is_diamond_art {
                if cx < view_min_x || cx > view_max_x || cy < view_min_y || cy > view_max_y {
                    continue;
                }
            } else {
                let (r_min_x, r_min_y, r_max_x, r_max_y) = region.bbox;
                if r_max_x < view_min_x || r_min_x > view_max_x || r_max_y < view_min_y || r_min_y > view_max_y {
                    continue;
                }
            }

            // Animate fill transition
            if region.is_filled && region.fill_anim < 1.0 {
                region.fill_anim = (region.fill_anim + dt * 4.5).min(1.0);
            }

            let is_hinted = Some(region.id) == self.hint_region_id;
            let is_active_number = region.number == self.active_number;
            let is_active_target = self.highlight_matching_tiles && is_active_number;

            let is_quad = is_diamond_art && n == 4;
            let (p0, p1, p2, p3) = if is_quad {
                (region.polygon[0], region.polygon[1], region.polygon[2], region.polygon[3])
            } else {
                (Point::new(0.0, 0.0), Point::new(0.0, 0.0), Point::new(0.0, 0.0), Point::new(0.0, 0.0))
            };
            let cell_w = p1.x - p0.x;
            let cell_h = p2.y - p1.y;

            let mut path_traced = false;
            if region.is_filled {
                ctx.set_fill_style_str(&region.color_hex);
                if is_quad {
                    ctx.fill_rect(p0.x, p0.y, cell_w, cell_h);
                } else {
                    Self::trace_region_path(ctx, region);
                    path_traced = true;
                    ctx.fill_with_canvas_winding_rule(CanvasWindingRule::Evenodd);

                    // Seam-seal stroke: prevents anti-aliasing white cracks between adjacent polygons
                    ctx.set_stroke_style_str(&region.color_hex);
                    ctx.set_line_width(if has_line_art { 0.8 } else { (1.5 / self.scale).max(0.8) });
                    ctx.stroke();
                }

                // Authentic 5D Diamond Facet Cut for diamond art tiles when zoomed in
                if is_quad && can_draw_facets {
                    // Top-left diagonal highlight
                    ctx.begin_path();
                    ctx.move_to(p0.x, p0.y);
                    ctx.line_to(p1.x, p1.y);
                    ctx.line_to(p3.x, p3.y);
                    ctx.close_path();
                    ctx.set_fill_style_str("rgba(255, 255, 255, 0.18)");
                    ctx.fill();

                    // Bottom-right diagonal shadow
                    ctx.begin_path();
                    ctx.move_to(p1.x, p1.y);
                    ctx.line_to(p2.x, p2.y);
                    ctx.line_to(p3.x, p3.y);
                    ctx.close_path();
                    ctx.set_fill_style_str("rgba(0, 0, 0, 0.16)");
                    ctx.fill();

                    // Center table facet
                    let hw = cell_w.abs() * 0.28;
                    let hh = cell_h.abs() * 0.28;

                    ctx.begin_path();
                    ctx.move_to(cx, cy - hh);
                    ctx.line_to(cx + hw, cy);
                    ctx.line_to(cx, cy + hh);
                    ctx.line_to(cx - hw, cy);
                    ctx.close_path();
                    ctx.set_fill_style_str("rgba(255, 255, 255, 0.12)");
                    ctx.fill();

                    // Crystal specular sparkle gleam
                    if drill_screen_size >= 14.0 {
                        let s_dot = 1.6 / self.scale.max(0.5);
                        ctx.set_fill_style_str("rgba(255, 255, 255, 0.75)");
                        ctx.fill_rect(cx - hw * 0.4, cy - hh * 0.4, s_dot, s_dot);
                    }
                }
            } else {
                // Unfilled region
                if is_quad {
                    if is_hinted {
                        let alpha = 0.45 + active_pulse * 0.35;
                        ctx.set_fill_style_str(&format!("rgba(255, 215, 0, {:.2})", alpha));
                    } else if is_active_target {
                        let alpha = 0.16 + active_pulse * 0.12;
                        ctx.set_fill_style_str(&format!("rgba(99, 102, 241, {:.2})", alpha));
                    } else {
                        ctx.set_fill_style_str("#F8FAFC");
                    }
                    ctx.fill_rect(p0.x, p0.y, cell_w, cell_h);
                } else {
                    Self::trace_region_path(ctx, region);
                    path_traced = true;
                    if is_hinted {
                        let alpha = 0.45 + active_pulse * 0.35;
                        let c = format!("rgba(255, 215, 0, {:.2})", alpha);
                        ctx.set_fill_style_str(&c);
                        ctx.fill_with_canvas_winding_rule(CanvasWindingRule::Evenodd);
                    } else if is_active_number {
                        // Classic Paint-by-Number diagonal hatch pattern for the active color
                        if let Some(ref pat) = self.hatch_pattern {
                            ctx.set_fill_style_canvas_pattern(pat);
                            ctx.fill_with_canvas_winding_rule(CanvasWindingRule::Evenodd);
                        } else {
                            ctx.set_fill_style_str("#E2E8F0");
                            ctx.fill_with_canvas_winding_rule(CanvasWindingRule::Evenodd);
                        }
                        if is_active_target {
                            let alpha = 0.14 + active_pulse * 0.12;
                            let c = format!("rgba(99, 102, 241, {:.2})", alpha);
                            ctx.set_fill_style_str(&c);
                            ctx.fill_with_canvas_winding_rule(CanvasWindingRule::Evenodd);
                        }
                    } else {
                        ctx.set_fill_style_str("#F8FAFC");
                        ctx.fill_with_canvas_winding_rule(CanvasWindingRule::Evenodd);
                    }
                }
            }

            // Outline strokes (reuse already-traced path when possible)
            if can_draw_outlines {
                if is_quad {
                    if is_hinted {
                        ctx.set_stroke_style_str("#F59E0B");
                        ctx.set_line_width(2.5 / self.scale.max(0.5));
                    } else if is_active_target {
                        ctx.set_stroke_style_str("rgba(99, 102, 241, 0.6)");
                        ctx.set_line_width(1.3 / self.scale.max(0.5));
                    } else {
                        ctx.set_stroke_style_str("rgba(148, 163, 184, 0.35)");
                        ctx.set_line_width(0.7 / self.scale.max(0.5));
                    }
                    ctx.stroke_rect(p0.x, p0.y, cell_w, cell_h);
                } else if is_hinted {
                    if !path_traced { Self::trace_region_path(ctx, region); }
                    ctx.set_stroke_style_str("#F59E0B");
                    ctx.set_line_width(2.5 / self.scale.max(0.5));
                    ctx.stroke();
                } else if !has_line_art {
                    if !path_traced { Self::trace_region_path(ctx, region); }
                    if is_active_target {
                        ctx.set_stroke_style_str("rgba(99, 102, 241, 0.6)");
                        ctx.set_line_width(1.3 / self.scale.max(0.5));
                    } else {
                        ctx.set_stroke_style_str("rgba(30, 41, 59, 0.72)");
                        ctx.set_line_width(1.6 / self.scale.max(0.5));
                    }
                    ctx.stroke();
                } else if !region.is_filled {
                    if !path_traced { Self::trace_region_path(ctx, region); }
                    ctx.set_stroke_style_str("rgba(148, 163, 184, 0.42)");
                    ctx.set_line_width(0.8 / self.scale.max(0.5));
                    ctx.stroke();
                }
            }
        }

        // 2.5 Composite crisp ink line-art overlay directly above fills and below numbers
        if let Some(ref img) = self.line_art_image {
            if img.complete() && img.natural_width() > 0 {
                let _ = ctx.draw_image_with_html_image_element_and_dw_and_dh(
                    img,
                    0.0,
                    0.0,
                    self.artwork.width,
                    self.artwork.height,
                );
            }
        }

        // 3. Render Number Labels on uncolored regions
        ctx.set_text_align("center");
        ctx.set_text_baseline("middle");
        let mut last_font = String::new();
        let mut last_fill_str = "";

        for region in &self.artwork.regions {
            if region.is_filled {
                continue;
            }

            let cx = region.centroid.x;
            let cy = region.centroid.y;
            if cx < view_min_x || cx > view_max_x || cy < view_min_y || cy > view_max_y {
                continue;
            }

            let is_hinted = Some(region.id) == self.hint_region_id;
            let is_active_target = self.highlight_matching_tiles && (region.number == self.active_number);

            let (region_world_size, region_screen_size) = if is_diamond_art {
                (drill_world_size, drill_screen_size)
            } else if region.label_radius > 0.5 {
                let rw = region.label_radius * 2.0;
                (rw, rw * self.scale)
            } else {
                let (min_x, min_y, max_x, max_y) = region.bbox;
                let span_w = (max_x - min_x).max(1.0);
                let span_h = (max_y - min_y).max(1.0);
                let rw = span_w.min(span_h);
                (rw, rw * self.scale)
            };

            if is_hinted {
                // Prominent hint halo
                let ring_r = if is_diamond_art {
                    (drill_world_size * (0.85 + active_pulse * 0.25)).max(12.0 / self.scale)
                } else {
                    (region_world_size * 0.65).clamp(10.0 / self.scale, 28.0 / self.scale)
                };
                let ring_w = if is_diamond_art {
                    (2.2 / self.scale).min(drill_world_size * 0.22)
                } else {
                    (2.4 / self.scale).min(region_world_size * 0.2)
                };
                ctx.begin_path();
                let _ = ctx.arc(cx, cy, ring_r, 0.0, 2.0 * PI);
                ctx.set_stroke_style_str("#F59E0B");
                ctx.set_line_width(ring_w);
                ctx.stroke();
            }

            // Level of Detail: when zoomed out on high-res artworks, only draw indicator dots on tiny regions
            let min_screen_for_text = if is_diamond_art { 13.0 } else { 7.5 };
            if region_screen_size < min_screen_for_text {
                if is_hinted || is_active_target {
                    let dot_r = (region_world_size * 0.35).min(3.5 / self.scale).max(1.2 / self.scale);
                    ctx.begin_path();
                    let _ = ctx.arc(cx, cy, dot_r, 0.0, 2.0 * PI);
                    let fill_c = if is_hinted { "#F59E0B" } else { "rgba(99, 102, 241, 0.85)" };
                    if fill_c != last_fill_str {
                        ctx.set_fill_style_str(fill_c);
                        last_fill_str = fill_c;
                    }
                    ctx.fill();
                }
            } else {
                let digits = if region.number >= 100 {
                    3
                } else if region.number >= 10 {
                    2
                } else {
                    1
                };
                let font_scale = if digits >= 3 {
                    0.34
                } else if digits == 2 {
                    0.44
                } else {
                    0.56
                };
                let max_font_world = if is_diamond_art { 15.0 / self.scale } else { 20.0 / self.scale };
                let font_size = if is_diamond_art {
                    if is_hinted {
                        (drill_world_size * font_scale * 1.15).min(drill_world_size * 0.68)
                    } else {
                        drill_world_size * font_scale
                    }
                } else {
                    let base = (region_world_size * font_scale).min(max_font_world);
                    if is_hinted { (base * 1.12).min(region_world_size * 0.56) } else { base }
                };
                let font_weight = if is_hinted || is_active_target { "bold" } else { "600" };
                let font_str = format!("{} {:.2}px 'Outfit', sans-serif", font_weight, font_size);
                if font_str != last_font {
                    ctx.set_font(&font_str);
                    last_font = font_str;
                }

                let fill_c = if is_hinted {
                    "#B45309"
                } else if is_active_target {
                    "#3730A3"
                } else if is_diamond_art {
                    "rgba(71, 85, 105, 0.78)"
                } else {
                    "rgba(30, 41, 59, 0.88)"
                };
                if fill_c != last_fill_str {
                    ctx.set_fill_style_str(fill_c);
                    last_fill_str = fill_c;
                }
                let _ = ctx.fill_text(&region.number.to_string(), cx, cy);
            }
        }

        // 4. Update and render particle physics (frame-rate independent)
        let dt_scale = dt * 60.0;
        let drag = 0.96_f64.powf(dt_scale);
        let mut i = 0;
        while i < self.particles.len() {
            let p = &mut self.particles[i];
            p.x += p.vx * dt_scale;
            p.y += p.vy * dt_scale;
            p.vy += 0.08 * dt_scale; // subtle gravity
            p.vx *= drag;
            p.life -= dt / p.max_life;

            if p.life <= 0.0 {
                self.particles.swap_remove(i);
            } else {
                ctx.begin_path();
                let rad = p.size * p.life;
                let _ = ctx.arc(p.x, p.y, rad, 0.0, 2.0 * PI);
                ctx.set_fill_style_str(&p.color);
                ctx.set_global_alpha(p.life);
                ctx.fill();
                i += 1;
            }
        }
        ctx.set_global_alpha(1.0);

        // Restore canvas transform
        ctx.restore();
        self.dirty = false;
    }
}
