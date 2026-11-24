mod artworks;
mod engine;
mod models;

use engine::GameEngine;
use wasm_bindgen::prelude::*;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement, HtmlImageElement};

#[wasm_bindgen(start)]
pub fn main_js() -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    Ok(())
}

#[wasm_bindgen]
pub struct GameController {
    engine: GameEngine,
    ctx: CanvasRenderingContext2d,
    viewport_w: f64,
    viewport_h: f64,
}

#[wasm_bindgen]
impl GameController {
    #[wasm_bindgen(constructor)]
    pub fn new(canvas_id: &str, artwork_id: &str) -> Result<GameController, JsValue> {
        let window = web_sys::window().ok_or_else(|| JsValue::from_str("No global window found"))?;
        let document = window
            .document()
            .ok_or_else(|| JsValue::from_str("No document found"))?;
        let element = document
            .get_element_by_id(canvas_id)
            .ok_or_else(|| JsValue::from_str(&format!("Canvas with id '{}' not found", canvas_id)))?;
        let canvas: HtmlCanvasElement = element
            .dyn_into::<HtmlCanvasElement>()
            .map_err(|_| JsValue::from_str("Element is not a canvas"))?;

        let ctx = canvas
            .get_context("2d")?
            .ok_or_else(|| JsValue::from_str("Canvas 2d context not available"))?
            .dyn_into::<CanvasRenderingContext2d>()?;

        let dpr = window.device_pixel_ratio().max(1.0);
        let viewport_w = (canvas.width() as f64 / dpr).max(1.0);
        let viewport_h = (canvas.height() as f64 / dpr).max(1.0);

        let mut engine = GameEngine::new(artwork_id);
        engine.fit_to_screen(viewport_w, viewport_h);

        Ok(GameController {
            engine,
            ctx,
            viewport_w,
            viewport_h,
        })
    }

    pub fn set_viewport_size(&mut self, css_width: f64, css_height: f64) {
        self.viewport_w = css_width.max(1.0);
        self.viewport_h = css_height.max(1.0);
        self.engine.dirty = true;
    }

    pub fn needs_render(&self) -> bool {
        self.engine.needs_render()
    }

    #[wasm_bindgen(getter)]
    pub fn is_diamond_mode(&self) -> bool {
        self.engine.is_diamond_art()
    }

    pub fn handle_tap(&mut self, screen_x: f64, screen_y: f64) -> String {
        let feedback = self.engine.handle_tap(screen_x, screen_y);
        serde_json::to_string(&feedback).unwrap_or_else(|_| "{}".to_string())
    }

    pub fn select_number(&mut self, number: usize) {
        self.engine.select_number(number);
    }

    pub fn set_viewport(&mut self, pan_x: f64, pan_y: f64, scale: f64) {
        self.engine.set_viewport(pan_x, pan_y, scale);
    }

    pub fn update_pan_zoom(&mut self, delta_x: f64, delta_y: f64, zoom_factor: f64, anchor_x: f64, anchor_y: f64) {
        let old_scale = self.engine.target_scale;
        let new_scale = (old_scale * zoom_factor).clamp(0.1, 10.0);

        // Zoom relative to anchor
        let wx = (anchor_x - self.engine.target_pan_x) / old_scale;
        let wy = (anchor_y - self.engine.target_pan_y) / old_scale;

        self.engine.target_scale = new_scale;
        self.engine.target_pan_x = anchor_x - wx * new_scale + delta_x;
        self.engine.target_pan_y = anchor_y - wy * new_scale + delta_y;
        self.engine.dirty = true;
    }

    pub fn fit_to_screen(&mut self) {
        self.engine.fit_to_screen(self.viewport_w, self.viewport_h);
    }

    pub fn world_to_screen(&self, world_x: f64, world_y: f64) -> String {
        let pt = self.engine.world_to_screen(world_x, world_y);
        serde_json::to_string(&pt).unwrap_or_else(|_| "{}".to_string())
    }

    pub fn screen_to_world(&self, screen_x: f64, screen_y: f64) -> String {
        let pt = self.engine.screen_to_world(screen_x, screen_y);
        serde_json::to_string(&pt).unwrap_or_else(|_| "{}".to_string())
    }

    pub fn trigger_hint(&mut self) -> String {
        let pt = self.engine.trigger_hint(self.viewport_w, self.viewport_h);
        serde_json::to_string(&pt).unwrap_or_else(|_| "null".to_string())
    }

    pub fn fill_all_of_current(&mut self) -> String {
        let feedback = self.engine.fill_all_of_current();
        serde_json::to_string(&feedback).unwrap_or_else(|_| "{}".to_string())
    }

    pub fn handle_erase(&mut self, screen_x: f64, screen_y: f64) -> String {
        let feedback = self.engine.handle_erase(screen_x, screen_y);
        serde_json::to_string(&feedback).unwrap_or_else(|_| "{}".to_string())
    }

    pub fn clear_all_tiles(&mut self) -> String {
        let feedback = self.engine.clear_all_tiles();
        serde_json::to_string(&feedback).unwrap_or_else(|_| "{}".to_string())
    }

    pub fn undo_last(&mut self) -> String {
        let feedback = self.engine.undo_last();
        serde_json::to_string(&feedback).unwrap_or_else(|_| "{}".to_string())
    }

    pub fn toggle_matching_hints(&mut self) -> bool {
        self.engine.toggle_matching_hints()
    }

    pub fn set_matching_hints(&mut self, enabled: bool) {
        self.engine.set_matching_hints(enabled);
    }

    pub fn get_matching_hints(&self) -> bool {
        self.engine.highlight_matching_tiles
    }

    pub fn toggle_outlines(&mut self) -> bool {
        self.engine.show_outlines = !self.engine.show_outlines;
        self.engine.dirty = true;
        self.engine.show_outlines
    }

    pub fn load_artwork(&mut self, artwork_id: &str) {
        self.engine.load_artwork_by_id(artwork_id);
        self.engine.fit_to_screen(self.viewport_w, self.viewport_h);
    }

    pub fn set_line_art_image(&mut self, img: Option<HtmlImageElement>) {
        self.engine.set_line_art_image(img);
    }

    pub fn set_color_art_image(&mut self, img: Option<HtmlImageElement>) {
        self.engine.set_color_art_image(img);
    }

    pub fn load_artwork_json(&mut self, json_str: &str) -> bool {
        if let Ok(mut artwork) = serde_json::from_str::<crate::models::ArtworkData>(json_str) {
            artwork.precompute_bboxes();
            self.engine.artwork = artwork;
            self.engine.reset_state();
            self.engine.fit_to_screen(self.viewport_w, self.viewport_h);
            true
        } else {
            false
        }
    }

    pub fn load_procedural_mosaic(&mut self, seed: u32, palette_type: &str) {
        self.engine.load_custom_mosaic(seed, palette_type);
        self.engine.fit_to_screen(self.viewport_w, self.viewport_h);
    }

    pub fn render(&mut self, timestamp: f64) {
        self.engine.render(&self.ctx, self.viewport_w, self.viewport_h, timestamp);
    }

    pub fn get_palette_json(&self) -> String {
        serde_json::to_string(&self.engine.artwork.palette).unwrap_or_else(|_| "[]".to_string())
    }

    pub fn get_visible_unfilled_numbers_json(&self) -> String {
        let nums = self
            .engine
            .get_visible_unfilled_numbers(self.viewport_w, self.viewport_h);
        serde_json::to_string(&nums).unwrap_or_else(|_| "[]".to_string())
    }

    pub fn get_artwork_info_json(&self) -> String {
        serde_json::to_string(&serde_json::json!({
            "id": self.engine.artwork.id,
            "title": self.engine.artwork.title,
            "artist": self.engine.artwork.artist,
            "width": self.engine.artwork.width,
            "height": self.engine.artwork.height,
            "active_number": self.engine.active_number,
            "total_regions": self.engine.artwork.regions.len(),
            "filled_regions": self.engine.artwork.regions.iter().filter(|r| r.is_filled).count(),
        }))
        .unwrap_or_else(|_| "{}".to_string())
    }

    pub fn get_artwork_json(&self) -> String {
        serde_json::to_string(&self.engine.artwork).unwrap_or_else(|_| "{}".to_string())
    }

    pub fn render_export(&self, ctx: &CanvasRenderingContext2d, width: f64, height: f64, force_all_filled: bool) {
        self.engine.render_export(ctx, width, height, force_all_filled);
    }
}
