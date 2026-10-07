use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

impl Point {
    pub fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Region {
    pub id: usize,
    pub number: usize,
    pub polygon: Vec<Point>,
    pub centroid: Point,
    pub color_hex: String,
    pub is_filled: bool,
    pub fill_anim: f64, // 0.0 to 1.0 animation transition
}

impl Region {
    pub fn calculate_centroid(points: &[Point]) -> Point {
        if points.is_empty() {
            return Point::new(0.0, 0.0);
        }
        let mut area = 0.0;
        let mut cx = 0.0;
        let mut cy = 0.0;
        let n = points.len();

        for i in 0..n {
            let j = (i + 1) % n;
            let p1 = &points[i];
            let p2 = &points[j];
            let cross = p1.x * p2.y - p2.x * p1.y;
            area += cross;
            cx += (p1.x + p2.x) * cross;
            cy += (p1.y + p2.y) * cross;
        }

        area *= 0.5;
        if area.abs() > 1e-4 {
            cx /= 6.0 * area;
            cy /= 6.0 * area;
            Point::new(cx, cy)
        } else {
            // Fallback to bounding box / arithmetic mean
            let mut sum_x = 0.0;
            let mut sum_y = 0.0;
            for p in points {
                sum_x += p.x;
                sum_y += p.y;
            }
            Point::new(sum_x / n as f64, sum_y / n as f64)
        }
    }

    /// Point-in-polygon raycasting algorithm
    pub fn contains_point(&self, p: Point) -> bool {
        let n = self.polygon.len();
        if n < 3 {
            return false;
        }
        let mut inside = false;
        let mut j = n - 1;

        for i in 0..n {
            let pi = &self.polygon[i];
            let pj = &self.polygon[j];

            if ((pi.y > p.y) != (pj.y > p.y))
                && (p.x < (pj.x - pi.x) * (p.y - pi.y) / (pj.y - pi.y) + pi.x)
            {
                inside = !inside;
            }
            j = i;
        }
        inside
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PaletteItem {
    pub number: usize,
    pub hex: String,
    pub name: String,
    pub total_count: usize,
    pub filled_count: usize,
    pub is_completed: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ArtworkData {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub width: f64,
    pub height: f64,
    pub palette: Vec<PaletteItem>,
    pub regions: Vec<Region>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Particle {
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    pub color: String,
    pub life: f64,
    pub max_life: f64,
    pub size: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TapFeedback {
    pub success: bool,
    pub region_id: Option<usize>,
    pub number: Option<usize>,
    pub correct_number: Option<usize>,
    pub color_completed: bool,
    pub artwork_completed: bool,
    pub total_filled: usize,
    pub total_regions: usize,
    pub percent: f64,
    pub target_point: Option<Point>,
}
