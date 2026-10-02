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
}

impl GameEngine {
    pub fn new(artwork_id: &str) -> Self {
        let artwork = load_artwork(artwork_id);
        let first_active = artwork.palette.first().map(|p| p.number).unwrap_or(1);

        GameEngine {
            artwork,
            active_number: first_active,
            show_outlines: true,
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

    fn reset_state(&mut self) {
        self.active_number = self.artwork.palette.first().map(|p| p.number).unwrap_or(1);
        self.particles.clear();
        self.hint_region_id = None;
        self.hint_timer = 0.0;
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

    /// Handles a tap/click at canvas coordinates
    pub fn handle_tap(&mut self, screen_x: f64, screen_y: f64) -> TapFeedback {
        let world_pt = self.screen_to_world(screen_x, screen_y);

        // Find which region contains this point (search in reverse for top-most)
        let found_idx = self
            .artwork
            .regions
            .iter()
            .rposition(|region| region.contains_point(world_pt));

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

            // Smoothly pan camera to center this region
            let target_s = 1.35;
            self.target_scale = target_s;
            self.target_pan_x = canvas_w / 2.0 - reg.centroid.x * target_s;
            self.target_pan_y = canvas_h / 2.0 - reg.centroid.y * target_s;

            Some(reg.centroid)
        } else {
            None
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

        // Reset shadow
        ctx.set_shadow_blur(0.0);

        let active_pulse = self.pulse_phase.sin() * 0.5 + 0.5; // 0.0 to 1.0

        // 2. Render all regions (fills and animations)
        for region in &mut self.artwork.regions {
            let n = region.polygon.len();
            if n < 3 {
                continue;
            }

            // Animate fill transition
            if region.is_filled && region.fill_anim < 1.0 {
                region.fill_anim = (region.fill_anim + dt * 4.0).min(1.0);
            }

            ctx.begin_path();
            ctx.move_to(region.polygon[0].x, region.polygon[0].y);
            for pt in region.polygon.iter().skip(1) {
                ctx.line_to(pt.x, pt.y);
            }
            ctx.close_path();

            if region.is_filled {
                // Filled color
                ctx.set_fill_style_str(&region.color_hex);
                ctx.fill();
            } else {
                // Unfilled region
                let is_hinted = Some(region.id) == self.hint_region_id;

                if is_hinted {
                    // Pulsing golden hint fill
                    let alpha = 0.45 + active_pulse * 0.35;
                    ctx.set_fill_style_str(&format!("rgba(255, 215, 0, {:.2})", alpha));
                } else {
                    // Neutral soft white/tint
                    ctx.set_fill_style_str("#F8FAFC");
                }
                ctx.fill();
            }

            // Outline strokes
            if self.show_outlines {
                let is_hinted = Some(region.id) == self.hint_region_id;
                if is_hinted {
                    ctx.set_stroke_style_str("#F59E0B");
                    ctx.set_line_width(2.5 / self.scale.max(0.5));
                } else {
                    ctx.set_stroke_style_str("rgba(30, 41, 59, 0.45)");
                    ctx.set_line_width(1.2 / self.scale.max(0.5));
                }
                ctx.stroke();
            }
        }

        // 3. Render Number Labels on uncolored regions
        let font_base_size = (14.0 / self.scale).clamp(8.0, 24.0);
        ctx.set_text_align("center");
        ctx.set_text_baseline("middle");

        for region in &self.artwork.regions {
            if region.is_filled {
                continue;
            }

            let is_hinted = Some(region.id) == self.hint_region_id;
            let cx = region.centroid.x;
            let cy = region.centroid.y;

            if is_hinted {
                // Draw prominent hint halo
                let ring_r = (18.0 + active_pulse * 6.0) / self.scale;
                ctx.begin_path();
                let _ = ctx.arc(cx, cy, ring_r, 0.0, 2.0 * PI);
                ctx.set_stroke_style_str("#F59E0B");
                ctx.set_line_width(3.0 / self.scale);
                ctx.stroke();
            }

            // Draw number text
            if is_hinted || self.scale > 0.7 {
                let num_str = region.number.to_string();
                let font_size = if is_hinted { font_base_size * 1.25 } else { font_base_size };
                let font_weight = if is_hinted { "bold" } else { "600" };
                ctx.set_font(&format!("{} {}px 'Outfit', sans-serif", font_weight, font_size));

                if is_hinted {
                    ctx.set_fill_style_str("#B45309");
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
