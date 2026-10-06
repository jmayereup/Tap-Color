use std::f64::consts::PI;
use web_sys::CanvasRenderingContext2d;

use crate::artworks::{generate_procedural_mosaic, load_artwork};
use crate::models::{ArtworkData, Particle, Point, TapFeedback};

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
}

impl GameEngine {
    pub fn new(artwork_id: &str) -> Self {
        let artwork = load_artwork(artwork_id);
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
        }
    }

    pub fn load_artwork_by_id(&mut self, id: &str) {
        self.artwork = load_artwork(id);
        self.reset_state();
    }

    pub fn load_custom_mosaic(&mut self, seed: u32, palette_type: &str) {
        self.artwork = generate_procedural_mosaic(seed, palette_type);
        self.reset_state();
    }

    pub fn reset_state(&mut self) {
        self.active_number = self.artwork.palette.first().map(|p| p.number).unwrap_or(1);
        self.particles.clear();
        self.hint_region_id = None;
        self.hint_timer = 0.0;
        self.highlight_matching_tiles = false;
        self.pan_x = 0.0;
        self.pan_y = 0.0;
        self.scale = 1.0;
        self.target_pan_x = 0.0;
        self.target_pan_y = 0.0;
        self.target_scale = 1.0;
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
    }

    /// Fast O(1) grid hit-testing for Diamond Art, fallback to polygon test
    pub fn find_region_at_world_point(&self, world_pt: Point) -> Option<usize> {
        let total_regions = self.artwork.regions.len();
        if total_regions == 0 {
            return None;
        }

        let is_diamond_art = self.artwork.id.contains("diamond");
        if is_diamond_art && total_regions >= 100 {
            let n_side = (total_regions as f64).sqrt().round() as usize;
            if n_side * n_side == total_regions {
                if let Some(p0) = self.artwork.regions[0].polygon.first() {
                    let margin = p0.x;
                    let avail = self.artwork.width - margin * 2.0;
                    if avail > 0.0 {
                        let cell_size = avail / (n_side as f64);
                        if world_pt.x >= margin && world_pt.x < self.artwork.width - margin
                            && world_pt.y >= margin && world_pt.y < self.artwork.height - margin {
                            let col = ((world_pt.x - margin) / cell_size).floor() as usize;
                            let row = ((world_pt.y - margin) / cell_size).floor() as usize;
                            if col < n_side && row < n_side {
                                let idx = row * n_side + col;
                                if idx < total_regions {
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
            let mut min_x = f64::INFINITY;
            let mut max_x = f64::NEG_INFINITY;
            let mut min_y = f64::INFINITY;
            let mut max_y = f64::NEG_INFINITY;
            for pt in &region.polygon {
                if pt.x < min_x { min_x = pt.x; }
                if pt.x > max_x { max_x = pt.x; }
                if pt.y < min_y { min_y = pt.y; }
                if pt.y > max_y { max_y = pt.y; }
            }
            if world_pt.x < min_x - 0.5 || world_pt.x > max_x + 0.5 || world_pt.y < min_y - 0.5 || world_pt.y > max_y + 0.5 {
                return false;
            }
            region.contains_point(world_pt)
        })
    }

    /// Handles a tap/click at canvas coordinates
    pub fn handle_tap(&mut self, screen_x: f64, screen_y: f64) -> TapFeedback {
        let world_pt = self.screen_to_world(screen_x, screen_y);
        let found_idx = self.find_region_at_world_point(world_pt);
        let total_regions = self.artwork.regions.len();

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

                    // Spawn celebratory sparkle particles
                    let color = region.color_hex.clone();
                    self.spawn_burst(centroid.x, centroid.y, &color, 16);

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

                    return TapFeedback {
                        success: true,
                        region_id: Some(reg_id),
                        number: Some(reg_number),
                        correct_number: Some(self.active_number),
                        color_completed,
                        artwork_completed,
                        total_filled: filled_count,
                        total_regions,
                        percent: (filled_count as f64 / total_regions as f64) * 100.0,
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
                        percent: (filled_count as f64 / total_regions as f64) * 100.0,
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
            percent: (filled_count as f64 / total_regions as f64) * 100.0,
            target_point: None,
        }
    }

    /// Finds an uncompleted region matching the active number and centers camera on it
    pub fn trigger_hint(&mut self, canvas_w: f64, canvas_h: f64) -> Option<Point> {
        let uncompleted = self
            .artwork
            .regions
            .iter()
            .find(|r| !r.is_filled && r.number == self.active_number);

        if let Some(reg) = uncompleted {
            self.hint_region_id = Some(reg.id);
            self.hint_timer = 5.0; // 5 seconds highlight

            // Smoothly pan camera to center this region with zoom scaled to drill size
            let is_diamond_art = self.artwork.id.contains("diamond") || (self.artwork.regions.len() > 300 && self.artwork.regions.get(0).map_or(false, |r| r.polygon.len() == 4));
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
            } else {
                let mut min_x = f64::INFINITY;
                let mut max_x = f64::NEG_INFINITY;
                let mut min_y = f64::INFINITY;
                let mut max_y = f64::NEG_INFINITY;
                for p in &reg.polygon {
                    if p.x < min_x { min_x = p.x; }
                    if p.x > max_x { max_x = p.x; }
                    if p.y < min_y { min_y = p.y; }
                    if p.y > max_y { max_y = p.y; }
                }
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
        self.highlight_matching_tiles
    }

    /// Set matching tiles highlight directly
    pub fn set_matching_hints(&mut self, enabled: bool) {
        self.highlight_matching_tiles = enabled;
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

                return TapFeedback {
                    success: true,
                    region_id: Some(reg_id),
                    number: Some(reg_num),
                    correct_number: Some(self.active_number),
                    color_completed: false,
                    artwork_completed: false,
                    total_filled: filled_count,
                    total_regions,
                    percent: (filled_count as f64 / total_regions as f64) * 100.0,
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
            percent: (filled_count as f64 / total_regions as f64) * 100.0,
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
        let mut filled_any = false;
        let active = self.active_number;
        let mut last_pt = None;

        for r in self.artwork.regions.iter_mut() {
            if !r.is_filled && r.number == active {
                r.is_filled = true;
                r.fill_anim = 0.0;
                filled_any = true;
                last_pt = Some(r.centroid);
            }
        }

        if let Some(pal) = self.artwork.palette.iter_mut().find(|p| p.number == active) {
            pal.filled_count = pal.total_count;
            pal.is_completed = true;
        }

        let total_filled = self.artwork.regions.iter().filter(|r| r.is_filled).count();
        let total = self.artwork.regions.len();
        let artwork_completed = total_filled == total;

        if filled_any {
            if let Some(pt) = last_pt {
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
            color_completed: true,
            artwork_completed,
            total_filled,
            total_regions: total,
            percent: (total_filled as f64 / total as f64) * 100.0,
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

        let is_diamond_art = self.artwork.id.contains("diamond") || self.artwork.regions.len() > 200;
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
                    ctx.begin_path();
                    ctx.move_to(region.polygon[0].x, region.polygon[0].y);
                    for pt in region.polygon.iter().skip(1) {
                        ctx.line_to(pt.x, pt.y);
                    }
                    ctx.close_path();
                    ctx.fill();
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
                    ctx.begin_path();
                    ctx.move_to(region.polygon[0].x, region.polygon[0].y);
                    for pt in region.polygon.iter().skip(1) {
                        ctx.line_to(pt.x, pt.y);
                    }
                    ctx.close_path();
                    ctx.fill();
                }
            }

            // Outline strokes
            if self.show_outlines {
                if is_diamond_art {
                    ctx.set_stroke_style_str("rgba(148, 163, 184, 0.35)");
                    ctx.set_line_width((0.7 / s).max(0.5));
                } else {
                    ctx.set_stroke_style_str("rgba(30, 41, 59, 0.35)");
                    ctx.set_line_width((1.0 / s).max(0.6));
                }

                if is_quad {
                    ctx.stroke_rect(p0.x, p0.y, cell_w, cell_h);
                } else {
                    ctx.stroke();
                }
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

        // 1. Draw artwork drop shadow / paper boundary
        ctx.set_shadow_color("rgba(0, 0, 0, 0.25)");
        ctx.set_shadow_blur(30.0);
        ctx.set_shadow_offset_x(0.0);
        ctx.set_shadow_offset_y(8.0);
        ctx.set_fill_style_str("#FFFFFF");
        ctx.fill_rect(0.0, 0.0, self.artwork.width, self.artwork.height);

        // Completely reset shadow state so lines and numbers render sharp and clean
        ctx.set_shadow_blur(0.0);
        ctx.set_shadow_offset_x(0.0);
        ctx.set_shadow_offset_y(0.0);
        ctx.set_shadow_color("transparent");

        let active_pulse = self.pulse_phase.sin() * 0.5 + 0.5; // 0.0 to 1.0
        let is_diamond_art = self.artwork.id.contains("diamond") || (self.artwork.regions.len() > 300 && self.artwork.regions.get(0).map_or(false, |r| r.polygon.len() == 4));

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

        // 2. Render all regions (fills and animations)
        for region in &mut self.artwork.regions {
            let n = region.polygon.len();
            if n < 3 {
                continue;
            }

            let cx = region.centroid.x;
            let cy = region.centroid.y;
            // Viewport frustum culling: skip regions completely outside current screen view
            if cx < view_min_x || cx > view_max_x || cy < view_min_y || cy > view_max_y {
                continue;
            }

            // Animate fill transition
            if region.is_filled && region.fill_anim < 1.0 {
                region.fill_anim = (region.fill_anim + dt * 4.0).min(1.0);
            }

            let is_hinted = Some(region.id) == self.hint_region_id;
            let is_active_target = self.highlight_matching_tiles && (region.number == self.active_number);

            let is_quad = is_diamond_art && n == 4;
            let (p0, p1, p2, p3) = if is_quad {
                (region.polygon[0], region.polygon[1], region.polygon[2], region.polygon[3])
            } else {
                (Point::new(0.0, 0.0), Point::new(0.0, 0.0), Point::new(0.0, 0.0), Point::new(0.0, 0.0))
            };
            let cell_w = p1.x - p0.x;
            let cell_h = p2.y - p1.y;

            if region.is_filled {
                ctx.set_fill_style_str(&region.color_hex);
                if is_quad {
                    ctx.fill_rect(p0.x, p0.y, cell_w, cell_h);
                } else {
                    ctx.begin_path();
                    ctx.move_to(region.polygon[0].x, region.polygon[0].y);
                    for pt in region.polygon.iter().skip(1) {
                        ctx.line_to(pt.x, pt.y);
                    }
                    ctx.close_path();
                    ctx.fill();
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
                if is_hinted {
                    let alpha = 0.45 + active_pulse * 0.35;
                    ctx.set_fill_style_str(&format!("rgba(255, 215, 0, {:.2})", alpha));
                } else if is_active_target {
                    let alpha = 0.16 + active_pulse * 0.12;
                    ctx.set_fill_style_str(&format!("rgba(99, 102, 241, {:.2})", alpha));
                } else {
                    ctx.set_fill_style_str("#F8FAFC");
                }

                if is_quad {
                    ctx.fill_rect(p0.x, p0.y, cell_w, cell_h);
                } else {
                    ctx.begin_path();
                    ctx.move_to(region.polygon[0].x, region.polygon[0].y);
                    for pt in region.polygon.iter().skip(1) {
                        ctx.line_to(pt.x, pt.y);
                    }
                    ctx.close_path();
                    ctx.fill();
                }
            }

            // Outline strokes
            if can_draw_outlines {
                if is_hinted {
                    ctx.set_stroke_style_str("#F59E0B");
                    ctx.set_line_width(2.5 / self.scale.max(0.5));
                } else if is_active_target {
                    ctx.set_stroke_style_str("rgba(99, 102, 241, 0.6)");
                    ctx.set_line_width(1.2 / self.scale.max(0.5));
                } else if is_diamond_art {
                    ctx.set_stroke_style_str("rgba(148, 163, 184, 0.35)");
                    ctx.set_line_width(0.7 / self.scale.max(0.5));
                } else {
                    ctx.set_stroke_style_str("rgba(30, 41, 59, 0.45)");
                    ctx.set_line_width(1.2 / self.scale.max(0.5));
                }

                if is_quad {
                    ctx.stroke_rect(p0.x, p0.y, cell_w, cell_h);
                } else {
                    ctx.stroke();
                }
            }
        }

        // 3. Render Number Labels on uncolored regions
        ctx.set_text_align("center");
        ctx.set_text_baseline("middle");

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
            } else {
                let mut min_x = f64::INFINITY;
                let mut max_x = f64::NEG_INFINITY;
                let mut min_y = f64::INFINITY;
                let mut max_y = f64::NEG_INFINITY;
                for p in &region.polygon {
                    if p.x < min_x { min_x = p.x; }
                    if p.x > max_x { max_x = p.x; }
                    if p.y < min_y { min_y = p.y; }
                    if p.y > max_y { max_y = p.y; }
                }
                let span_w = (max_x - min_x).max(1.0);
                let span_h = (max_y - min_y).max(1.0);
                let rw = span_w.min(span_h).max(span_w.max(span_h) * 0.45);
                (rw, rw * self.scale)
            };

            if is_hinted {
                // Prominent hint halo
                let ring_r = if is_diamond_art {
                    (drill_world_size * (0.85 + active_pulse * 0.25)).max(12.0 / self.scale)
                } else {
                    (region_world_size * 0.75).clamp(10.0 / self.scale, 28.0 / self.scale)
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
            if region_screen_size < 13.0 {
                if is_hinted || is_active_target {
                    let dot_r = (region_world_size * 0.35).min(3.5 / self.scale).max(1.2 / self.scale);
                    ctx.begin_path();
                    let _ = ctx.arc(cx, cy, dot_r, 0.0, 2.0 * PI);
                    ctx.set_fill_style_str(if is_hinted { "#F59E0B" } else { "rgba(99, 102, 241, 0.85)" });
                    ctx.fill();
                }
            } else {
                let num_str = region.number.to_string();
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
                let max_font_world = 18.0 / self.scale;
                let font_size = if is_diamond_art {
                    if is_hinted {
                        (drill_world_size * font_scale * 1.15).min(drill_world_size * 0.68)
                    } else {
                        drill_world_size * font_scale
                    }
                } else {
                    let base = (region_world_size * font_scale).min(max_font_world);
                    if is_hinted { base * 1.15 } else { base }
                };
                let font_weight = if is_hinted || is_active_target { "bold" } else { "600" };
                ctx.set_font(&format!("{} {:.2}px 'Outfit', sans-serif", font_weight, font_size));

                if is_hinted {
                    ctx.set_fill_style_str("#B45309");
                } else if is_active_target {
                    ctx.set_fill_style_str("#3730A3");
                } else {
                    ctx.set_fill_style_str("rgba(71, 85, 105, 0.75)");
                }
                let _ = ctx.fill_text(&num_str, cx, cy);
            }
        }

        // 4. Update and render particle physics
        let mut i = 0;
        while i < self.particles.len() {
            let p = &mut self.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.08; // subtle gravity
            p.vx *= 0.96;
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
    }
}
