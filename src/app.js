// Tap Color • WebAssembly & Diamond Art Studio Engine
import { storage } from './storage.js';
import { vectorizeImage, generateThumbnailBlob, kmeans, detectContentBounds } from './vectorizer.js';
import { initInAppBrowserBanner } from './inAppBrowser.js';

class SoundController {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.lastTapTime = 0;
    // Pentatonic scale frequencies for harmonic satisfaction
    this.scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
  }

  ensureContext() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (_) {
      this.ctx = null;
    }
  }

  playTap(colorIndex = 1) {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastTapTime < 35) return;
    this.lastTapTime = now;
    this.ensureContext();
    if (!this.ctx) return;

    const idx = Math.max(0, (Number(colorIndex) || 1) - 1) % this.scale.length;
    const freq = this.scale[idx];
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.02, t + 0.15);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.36);
  }

  playDiamondSnap(colorIndex = 1) {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastTapTime < 35) return;
    this.lastTapTime = now;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const idx = Math.max(0, (Number(colorIndex) || 1) - 1) % this.scale.length;
    const freq = this.scale[idx] * 2.2;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.8, t + 0.08);

    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.13);
  }

  playWrong() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, this.ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playErase() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.12);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.13);
  }

  playClick() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.05);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.07);
  }

  playColorComplete() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const base = this.ctx.currentTime;
    const chords = [523.25, 659.25, 783.99, 1046.50]; // C Major
    chords.forEach((freq, idx) => {
      const t = base + idx * 0.075;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.51);
    });
  }

  playVictory() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const base = this.ctx.currentTime;
    const notes = [392.00, 523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const t = base + idx * 0.11;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.95);
    });
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class TapColorApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.viewport = document.getElementById('viewport');
    this.sound = new SoundController();
    this.controller = null;
    this.isWasmActive = false;

    // Interaction states
    this.isDragging = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.dragDistance = 0;
    this.toolMode = 'pen'; // 'pen', 'erase', or 'pan'
    this.highlightMatching = false; // Matching tiles are not highlighted by default
    this.currentArtworkId = 'fluffy_cow_pbn';
    this.activeNumber = 1;
    this.activeCategory = 'classic'; // 'classic', 'diamond', 'saved', 'custom'
    this.activeTagFilters = new Set();
    this.pbnMinPiecesFilter = null;
    this.pbnMaxPiecesFilter = null;

    // Async generation tokens & timers
    this.loadGeneration = 0;
    this.lineArtGeneration = 0;
    this.victoryTimeout = null;
    this.dialogFocusTimeout = null;
    this.savedBlobUrls = [];
    this.canvasRect = null;
    this.viewportWidth = 0;
    this.viewportHeight = 0;
    this.isConverting = false;
    this._saveInFlight = null;
    this._visiblePaletteSig = null;
    this._lastPaletteVisibilitySync = 0;
    this._allColorsCompleted = false;

    // Multi-touch & touchscreen controls
    this.touchPinchDist = 0;
    this.touchMidX = 0;
    this.touchMidY = 0;
    this.isTwoFingerGesture = false;
    this.suppressSingleTouchUntil = 0;
    this.lastTouchPlaceX = 0;
    this.lastTouchPlaceY = 0;
    this.singleTouchStartPos = null;
    this.pendingTouch = null;
    this.touchPlaceTimeout = null;

    // Arrow keys smooth pan navigation
    this.arrowKeys = new Set();
    this.arrowPanRafId = null;

    // Stylus hold-to-scroll gesture state
    this.stylusHoldTimeout = null;
    this.isStylusPanning = false;
    this.isStylusActive = false;
    this.pendingStylusAction = null;

    // Statistics
    this.startTime = Date.now();
    this.totalTaps = 0;
    this.successfulTaps = 0;
    this.activeImportedRecord = null;
    this.autosaveTimer = null;
    this.isInitialized = false;

    // Custom alert & confirm dialog state
    this.dialogResolve = null;
    this.dialogPreviousFocus = null;

    this.artworksMeta = [
      // 6 Country Life Diamond Art Masterpieces (High-Resolution Diamond Grids)
      {
        id: 'fluffy_cow_diamond',
        title: 'Sweet Highland Calf',
        artist: 'Country Homestead',
        category: 'diamond',
        pieces: 14400,
        desc: 'Gentle fluffy highland cow calf surrounded by meadow wildflowers and rustic wooden pasture',
        defaultVariantId: 'fluffy_cow_diamond_120',
        selectedVariantId: 'fluffy_cow_diamond_120',
        originalAsset: 'assets/paint_by_number/fluffy-cow-3.jpeg',
        thumbnailUrl: 'assets/converted/fluffy_cow_diamond_120_thumb.png',
        variants: [
          { id: 'fluffy_cow_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/fluffy_cow_diamond_80.json', thumbnailUrl: 'assets/converted/fluffy_cow_diamond_80_thumb.png' },
          { id: 'fluffy_cow_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/fluffy_cow_diamond_120.json', thumbnailUrl: 'assets/converted/fluffy_cow_diamond_120_thumb.png' },
          { id: 'fluffy_cow_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/fluffy_cow_diamond_160.json', thumbnailUrl: 'assets/converted/fluffy_cow_diamond_160_thumb.png' },
        ],
      },
      {
        id: 'hummingbird_diamond',
        title: 'Garden Hummingbird',
        artist: 'Sunlit Meadow',
        category: 'diamond',
        pieces: 14400,
        desc: 'Vibrant hummingbird sipping sweet nectar among blooming country garden flora',
        defaultVariantId: 'hummingbird_diamond_120',
        selectedVariantId: 'hummingbird_diamond_120',
        originalAsset: 'assets/diamond_art_only/hummingbird.jpeg',
        thumbnailUrl: 'assets/converted/hummingbird_diamond_120_thumb.png',
        variants: [
          { id: 'hummingbird_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/hummingbird_diamond_80.json', thumbnailUrl: 'assets/converted/hummingbird_diamond_80_thumb.png' },
          { id: 'hummingbird_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/hummingbird_diamond_120.json', thumbnailUrl: 'assets/converted/hummingbird_diamond_120_thumb.png' },
          { id: 'hummingbird_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/hummingbird_diamond_160.json', thumbnailUrl: 'assets/converted/hummingbird_diamond_160_thumb.png' },
        ],
      },
      {
        id: 'country_barn_diamond',
        title: 'Rustic Red Barn',
        artist: 'Heartland Heritage',
        category: 'diamond',
        pieces: 14400,
        desc: 'Classic red country barn with silo, split-rail fence, and sunflowers under sunny blue sky',
        defaultVariantId: 'country_barn_diamond_120',
        selectedVariantId: 'country_barn_diamond_120',
        originalAsset: 'assets/diamond_art_only/country_barn.jpeg',
        thumbnailUrl: 'assets/converted/country_barn_diamond_120_thumb.png',
        variants: [
          { id: 'country_barn_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/country_barn_diamond_80.json', thumbnailUrl: 'assets/converted/country_barn_diamond_80_thumb.png' },
          { id: 'country_barn_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/country_barn_diamond_120.json', thumbnailUrl: 'assets/converted/country_barn_diamond_120_thumb.png' },
          { id: 'country_barn_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/country_barn_diamond_160.json', thumbnailUrl: 'assets/converted/country_barn_diamond_160_thumb.png' },
        ],
      },
      {
        id: 'country_rooster_diamond',
        title: 'Morning Farm Rooster',
        artist: 'Sunrise Farmstead',
        category: 'diamond',
        pieces: 14400,
        desc: 'Colorful country rooster greeting the morning sun from a rustic fence post',
        defaultVariantId: 'country_rooster_diamond_120',
        selectedVariantId: 'country_rooster_diamond_120',
        originalAsset: 'assets/diamond_art_only/country_rooster.jpeg',
        thumbnailUrl: 'assets/converted/country_rooster_diamond_120_thumb.png',
        variants: [
          { id: 'country_rooster_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/country_rooster_diamond_80.json', thumbnailUrl: 'assets/converted/country_rooster_diamond_80_thumb.png' },
          { id: 'country_rooster_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/country_rooster_diamond_120.json', thumbnailUrl: 'assets/converted/country_rooster_diamond_120_thumb.png' },
          { id: 'country_rooster_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/country_rooster_diamond_160.json', thumbnailUrl: 'assets/converted/country_rooster_diamond_160_thumb.png' },
        ],
      },
      {
        id: 'country_truck_diamond',
        title: 'Vintage Harvest Truck',
        artist: 'Country Roads Studio',
        category: 'diamond',
        pieces: 14400,
        desc: 'Classic turquoise vintage pickup truck filled with harvest pumpkins and sunflowers',
        defaultVariantId: 'country_truck_diamond_120',
        selectedVariantId: 'country_truck_diamond_120',
        originalAsset: 'assets/diamond_art_only/country_truck.jpeg',
        thumbnailUrl: 'assets/converted/country_truck_diamond_120_thumb.png',
        variants: [
          { id: 'country_truck_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/country_truck_diamond_80.json', thumbnailUrl: 'assets/converted/country_truck_diamond_80_thumb.png' },
          { id: 'country_truck_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/country_truck_diamond_120.json', thumbnailUrl: 'assets/converted/country_truck_diamond_120_thumb.png' },
          { id: 'country_truck_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/country_truck_diamond_160.json', thumbnailUrl: 'assets/converted/country_truck_diamond_160_thumb.png' },
        ],
      },
      {
        id: 'country_puppy_diamond',
        title: 'Porch Golden Puppy',
        artist: 'Cottage Companions',
        category: 'diamond',
        pieces: 14400,
        desc: 'Adorable golden retriever puppy in a red bandana enjoying a sunny farm morning',
        defaultVariantId: 'country_puppy_diamond_120',
        selectedVariantId: 'country_puppy_diamond_120',
        originalAsset: 'assets/diamond_art_only/country_puppy.jpeg',
        thumbnailUrl: 'assets/converted/country_puppy_diamond_120_thumb.png',
        variants: [
          { id: 'country_puppy_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/country_puppy_diamond_80.json', thumbnailUrl: 'assets/converted/country_puppy_diamond_80_thumb.png' },
          { id: 'country_puppy_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/country_puppy_diamond_120.json', thumbnailUrl: 'assets/converted/country_puppy_diamond_120_thumb.png' },
          { id: 'country_puppy_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/country_puppy_diamond_160.json', thumbnailUrl: 'assets/converted/country_puppy_diamond_160_thumb.png' },
        ],
      },
      {
        id: 'yorky_teacup_diamond',
        title: 'Teacup Yorkie Ribbon',
        artist: 'Petite Paws Studio',
        category: 'diamond',
        pieces: 14400,
        desc: 'Adorable teacup Yorkshire Terrier puppy with pink bow nestled in vintage porcelain',
        defaultVariantId: 'yorky_teacup_diamond_120',
        selectedVariantId: 'yorky_teacup_diamond_120',
        originalAsset: 'assets/diamond_art_only/yorky_teacup.jpeg',
        thumbnailUrl: 'assets/converted/yorky_teacup_diamond_120_thumb.png',
        variants: [
          { id: 'yorky_teacup_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/yorky_teacup_diamond_80.json', thumbnailUrl: 'assets/converted/yorky_teacup_diamond_80_thumb.png' },
          { id: 'yorky_teacup_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/yorky_teacup_diamond_120.json', thumbnailUrl: 'assets/converted/yorky_teacup_diamond_120_thumb.png' },
          { id: 'yorky_teacup_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/yorky_teacup_diamond_160.json', thumbnailUrl: 'assets/converted/yorky_teacup_diamond_160_thumb.png' },
        ],
      },
      {
        id: 'yorky_garden_diamond',
        title: 'Garden Blossom Yorkie',
        artist: 'Cottage Petals',
        category: 'diamond',
        pieces: 14400,
        desc: 'Cheerful Yorkshire Terrier puppy surrounded by blooming pansies and meadow lavender',
        defaultVariantId: 'yorky_garden_diamond_120',
        selectedVariantId: 'yorky_garden_diamond_120',
        originalAsset: 'assets/diamond_art_only/yorky_garden.jpeg',
        thumbnailUrl: 'assets/converted/yorky_garden_diamond_120_thumb.png',
        variants: [
          { id: 'yorky_garden_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/yorky_garden_diamond_80.json', thumbnailUrl: 'assets/converted/yorky_garden_diamond_80_thumb.png' },
          { id: 'yorky_garden_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/yorky_garden_diamond_120.json', thumbnailUrl: 'assets/converted/yorky_garden_diamond_120_thumb.png' },
          { id: 'yorky_garden_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/yorky_garden_diamond_160.json', thumbnailUrl: 'assets/converted/yorky_garden_diamond_160_thumb.png' },
        ],
      },
      {
        id: 'yorky_autumn_diamond',
        title: 'Cozy Autumn Yorkie',
        artist: 'Harvest Hearth',
        category: 'diamond',
        pieces: 14400,
        desc: 'Sweet Yorkshire Terrier in a cozy red knit sweater among autumn maple leaves and pumpkins',
        defaultVariantId: 'yorky_autumn_diamond_120',
        selectedVariantId: 'yorky_autumn_diamond_120',
        originalAsset: 'assets/diamond_art_only/yorky_autumn.jpeg',
        thumbnailUrl: 'assets/converted/yorky_autumn_diamond_120_thumb.png',
        variants: [
          { id: 'yorky_autumn_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/yorky_autumn_diamond_80.json', thumbnailUrl: 'assets/converted/yorky_autumn_diamond_80_thumb.png' },
          { id: 'yorky_autumn_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/yorky_autumn_diamond_120.json', thumbnailUrl: 'assets/converted/yorky_autumn_diamond_120_thumb.png' },
          { id: 'yorky_autumn_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/yorky_autumn_diamond_160.json', thumbnailUrl: 'assets/converted/yorky_autumn_diamond_160_thumb.png' },
        ],
      },
      {
        id: 'yorky_playful_diamond',
        title: 'Playful Meadow Yorkie',
        artist: 'Sunny Pastures',
        category: 'diamond',
        pieces: 14400,
        desc: 'Joyful Yorkshire Terrier puppy in a polka dot bandana playing with a ball in buttercups',
        defaultVariantId: 'yorky_playful_diamond_120',
        selectedVariantId: 'yorky_playful_diamond_120',
        originalAsset: 'assets/diamond_art_only/yorky_playful.jpeg',
        thumbnailUrl: 'assets/converted/yorky_playful_diamond_120_thumb.png',
        variants: [
          { id: 'yorky_playful_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/yorky_playful_diamond_80.json', thumbnailUrl: 'assets/converted/yorky_playful_diamond_80_thumb.png' },
          { id: 'yorky_playful_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/yorky_playful_diamond_120.json', thumbnailUrl: 'assets/converted/yorky_playful_diamond_120_thumb.png' },
          { id: 'yorky_playful_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/yorky_playful_diamond_160.json', thumbnailUrl: 'assets/converted/yorky_playful_diamond_160_thumb.png' },
        ],
      },
      {
        id: 'rural_windmill_diamond',
        title: 'Prairie Windmill Sunset',
        artist: 'Heartland Horizons',
        category: 'diamond',
        pieces: 14400,
        desc: 'Classic American farm windmill standing tall above golden wheat fields and prairie sunflowers',
        defaultVariantId: 'rural_windmill_diamond_120',
        selectedVariantId: 'rural_windmill_diamond_120',
        originalAsset: 'assets/diamond_art_only/rural_windmill.jpeg',
        thumbnailUrl: 'assets/converted/rural_windmill_diamond_120_thumb.png',
        variants: [
          { id: 'rural_windmill_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/rural_windmill_diamond_80.json', thumbnailUrl: 'assets/converted/rural_windmill_diamond_80_thumb.png' },
          { id: 'rural_windmill_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/rural_windmill_diamond_120.json', thumbnailUrl: 'assets/converted/rural_windmill_diamond_120_thumb.png' },
          { id: 'rural_windmill_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/rural_windmill_diamond_160.json', thumbnailUrl: 'assets/converted/rural_windmill_diamond_160_thumb.png' },
        ],
      },
      {
        id: 'country_store_diamond',
        title: 'Old Country Store',
        artist: 'Heritage Homestead',
        category: 'diamond',
        pieces: 14400,
        desc: 'Charming general store with wooden porch, rocking chairs, bushel of apples, and hanging lanterns',
        defaultVariantId: 'country_store_diamond_120',
        selectedVariantId: 'country_store_diamond_120',
        originalAsset: 'assets/diamond_art_only/country_store.jpeg',
        thumbnailUrl: 'assets/converted/country_store_diamond_120_thumb.png',
        variants: [
          { id: 'country_store_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/country_store_diamond_80.json', thumbnailUrl: 'assets/converted/country_store_diamond_80_thumb.png' },
          { id: 'country_store_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/country_store_diamond_120.json', thumbnailUrl: 'assets/converted/country_store_diamond_120_thumb.png' },
          { id: 'country_store_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/country_store_diamond_160.json', thumbnailUrl: 'assets/converted/country_store_diamond_160_thumb.png' },
        ],
      },
      {
        id: 'pasture_horses_diamond',
        title: 'Pasture Mare & Foal',
        artist: 'Meadow Run Stables',
        category: 'diamond',
        pieces: 14400,
        desc: 'Loving chestnut farm mare and playful young foal beside a rustic split-rail pasture fence',
        defaultVariantId: 'pasture_horses_diamond_120',
        selectedVariantId: 'pasture_horses_diamond_120',
        originalAsset: 'assets/diamond_art_only/pasture_horses.jpeg',
        thumbnailUrl: 'assets/converted/pasture_horses_diamond_120_thumb.png',
        variants: [
          { id: 'pasture_horses_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/pasture_horses_diamond_80.json', thumbnailUrl: 'assets/converted/pasture_horses_diamond_80_thumb.png' },
          { id: 'pasture_horses_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/pasture_horses_diamond_120.json', thumbnailUrl: 'assets/converted/pasture_horses_diamond_120_thumb.png' },
          { id: 'pasture_horses_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/pasture_horses_diamond_160.json', thumbnailUrl: 'assets/converted/pasture_horses_diamond_160_thumb.png' },
        ],
      },
      {
        id: 'vintage_tractor_diamond',
        title: 'Heartland Antique Tractor',
        artist: 'Country Roads Studio',
        category: 'diamond',
        pieces: 14400,
        desc: 'Classic vintage farm tractor in vibrant green and yellow beside summer cornfields and harvest crates',
        defaultVariantId: 'vintage_tractor_diamond_120',
        selectedVariantId: 'vintage_tractor_diamond_120',
        originalAsset: 'assets/diamond_art_only/vintage_tractor.jpeg',
        thumbnailUrl: 'assets/converted/vintage_tractor_diamond_120_thumb.png',
        variants: [
          { id: 'vintage_tractor_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/vintage_tractor_diamond_80.json', thumbnailUrl: 'assets/converted/vintage_tractor_diamond_80_thumb.png' },
          { id: 'vintage_tractor_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/vintage_tractor_diamond_120.json', thumbnailUrl: 'assets/converted/vintage_tractor_diamond_120_thumb.png' },
          { id: 'vintage_tractor_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/vintage_tractor_diamond_160.json', thumbnailUrl: 'assets/converted/vintage_tractor_diamond_160_thumb.png' },
        ],
      },
      {
        id: 'covered_bridge_diamond',
        title: 'Rustic Covered Bridge',
        artist: 'Valley Stream Folk',
        category: 'diamond',
        pieces: 14400,
        desc: 'Historic red wooden covered bridge spanning a peaceful babbling stream surrounded by wildflowers',
        defaultVariantId: 'covered_bridge_diamond_120',
        selectedVariantId: 'covered_bridge_diamond_120',
        originalAsset: 'assets/diamond_art_only/covered_bridge.jpeg',
        thumbnailUrl: 'assets/converted/covered_bridge_diamond_120_thumb.png',
        variants: [
          { id: 'covered_bridge_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/covered_bridge_diamond_80.json', thumbnailUrl: 'assets/converted/covered_bridge_diamond_80_thumb.png' },
          { id: 'covered_bridge_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/covered_bridge_diamond_120.json', thumbnailUrl: 'assets/converted/covered_bridge_diamond_120_thumb.png' },
          { id: 'covered_bridge_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/covered_bridge_diamond_160.json', thumbnailUrl: 'assets/converted/covered_bridge_diamond_160_thumb.png' },
        ],
      },
      {
        id: 'autumn_fox_diamond',
        title: 'Cozy Autumn Fox',
        artist: 'Woodland Folk',
        category: 'diamond',
        pieces: 14400,
        desc: 'Cozy red fox curled up among autumn leaves, red-capped mushrooms, and meadow wildflowers',
        defaultVariantId: 'autumn_fox_diamond_120',
        selectedVariantId: 'autumn_fox_diamond_120',
        originalAsset: 'assets/diamond_art_only/autumn_fox.jpeg',
        thumbnailUrl: 'assets/converted/autumn_fox_diamond_120_thumb.png',
        variants: [
          { id: 'autumn_fox_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/autumn_fox_diamond_80.json', thumbnailUrl: 'assets/converted/autumn_fox_diamond_80_thumb.png' },
          { id: 'autumn_fox_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/autumn_fox_diamond_120.json', thumbnailUrl: 'assets/converted/autumn_fox_diamond_120_thumb.png' },
          { id: 'autumn_fox_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/autumn_fox_diamond_160.json', thumbnailUrl: 'assets/converted/autumn_fox_diamond_160_thumb.png' },
        ],
      },
      // Paint by Number Paintings (Curated Line-Preserving Editions)
      {
        id: 'fluffy_cow_pbn',
        title: 'Sweet Highland Calf',
        artist: 'Country Homestead',
        category: 'classic',
        pieces: 129,
        desc: 'Gentle fluffy highland cow calf surrounded by meadow wildflowers and rustic pasture',
        defaultVariantId: 'fluffy_cow_pbn',
        selectedVariantId: 'fluffy_cow_pbn',
        originalAsset: 'assets/paint_by_number/fluffy-cow-3.jpeg',
        thumbnailUrl: 'assets/converted/fluffy_cow_pbn_thumb.png',
        variants: [
          { id: 'fluffy_cow_pbn', label: 'Original', name: 'Original Lines', pieces: 129, colors: 15, jsonFile: 'assets/converted/fluffy_cow_pbn.json', lineArtUrl: 'assets/converted/fluffy_cow_pbn_lines.png', thumbnailUrl: 'assets/converted/fluffy_cow_pbn_thumb.png' },
        ],
      },
      {
        id: 'autumn_fox_pbn',
        title: 'Cozy Autumn Fox',
        artist: 'Woodland Folk',
        category: 'classic',
        pieces: 49,
        desc: 'Cozy red fox curled up among autumn leaves, red-capped mushrooms, and meadow wildflowers',
        defaultVariantId: 'autumn_fox_pbn',
        selectedVariantId: 'autumn_fox_pbn',
        originalAsset: 'assets/paint_by_number/autumn_fox_pbn.jpeg',
        thumbnailUrl: 'assets/converted/autumn_fox_pbn_thumb.png',
        variants: [
          { id: 'autumn_fox_pbn', label: 'Original', name: 'Original Lines', pieces: 49, colors: 15, jsonFile: 'assets/converted/autumn_fox_pbn.json', lineArtUrl: 'assets/converted/autumn_fox_pbn_lines.png', thumbnailUrl: 'assets/converted/autumn_fox_pbn_thumb.png' },
        ],
      },
    ];
  }

  async loadManifestMeta() {
    try {
      const res = await fetch('assets/converted/manifest.json');
      if (!res.ok) return;
      const entries = await res.json();
      if (!Array.isArray(entries) || entries.length === 0) return;

      const sortedEntries = [...entries].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      const dynamicMeta = [];

      // 1. Diamond Art entries (from both diamond_art_only/ and paint_by_number/)
      for (const entry of sortedEntries) {
        if (entry.diamondVariants && entry.diamondVariants.length > 0) {
          const defVar = entry.diamondVariants.find(v => v.id.endsWith('_120')) || entry.diamondVariants[0];
          const variants = entry.diamondVariants.map(v => ({
            ...v,
            name: v.grid === 80 ? 'Cozy Canvas' : (v.grid === 120 ? 'Standard Kit' : (v.grid === 160 ? 'Masterpiece Ultra' : v.resolution)),
          }));
          dynamicMeta.push({
            id: `${entry.key}_diamond`,
            title: entry.title,
            artist: entry.artist,
            category: 'diamond',
            tags: Array.isArray(entry.tags) ? entry.tags : [],
            pieces: defVar.pieces,
            desc: entry.desc,
            defaultVariantId: defVar.id,
            selectedVariantId: defVar.id,
            originalAsset: entry.originalAsset,
            thumbnailUrl: defVar.thumbnailUrl,
            variants,
          });
        }
      }

      // 2. Paint by Number entries (ONLY from paint_by_number/)
      for (const entry of sortedEntries) {
        if (entry.pbnVariants && entry.pbnVariants.length > 0) {
          const pbnVar = entry.pbnVariants[0];
          dynamicMeta.push({
            id: `${entry.key}_pbn`,
            title: entry.title,
            artist: entry.artist,
            category: 'classic',
            tags: Array.isArray(entry.tags) ? entry.tags : [],
            pieces: pbnVar.pieces,
            desc: entry.desc,
            defaultVariantId: pbnVar.id,
            selectedVariantId: pbnVar.id,
            originalAsset: entry.pbnAsset || entry.originalAsset,
            thumbnailUrl: pbnVar.thumbnailUrl,
            variants: entry.pbnVariants.map(v => ({
              ...v,
              label: v.label || 'Original',
              name: v.name || 'Original Lines',
            })),
          });
        }
      }

      if (dynamicMeta.length > 0) {
        this.artworksMeta = dynamicMeta;
      }
    } catch (e) {
      console.warn('Could not load manifest.json, using fallback catalog:', e);
    }
  }

  findCatalogArtwork(artId, variantId = null) {
    if (!artId) return null;
    let meta = this.artworksMeta.find(a => a.id === artId);
    let resolvedVariantId = variantId;

    if (!meta) {
      for (const m of this.artworksMeta) {
        if (m.variants) {
          const v = m.variants.find(item => item.id === artId);
          if (v) {
            meta = m;
            resolvedVariantId = v.id;
            break;
          }
        }
      }
    } else if (resolvedVariantId && meta.variants) {
      const v = meta.variants.find(item => item.id === resolvedVariantId);
      resolvedVariantId = v ? v.id : null;
    }

    if (!meta) return null;
    return { meta, variantId: resolvedVariantId };
  }

  setActiveGalleryTab(category) {
    if (category !== 'classic' && category !== 'diamond') return;
    this.activeCategory = category;
    document.querySelectorAll('.gallery-tab').forEach(t => {
      const isMatch = t.dataset.tab === category;
      t.classList.toggle('active', isMatch);
      t.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });
    const grid = document.getElementById('artwork-grid');
    const customPanel = document.getElementById('tab-custom-panel');
    const savedPanel = document.getElementById('tab-saved-panel');
    if (customPanel) customPanel.classList.add('hidden');
    if (savedPanel) savedPanel.classList.add('hidden');
    if (grid) grid.style.display = 'grid';
    this.populateGalleryModal();
  }

  persistCurrentArtworkState() {
    if (!this.isInitialized) return;

    const variantId = this.currentArtworkVariant ? this.currentArtworkVariant.id : null;
    const savedRecordId = this.activeImportedRecord ? this.activeImportedRecord.id : null;
    const state = {
      id: this.currentArtworkMeta ? this.currentArtworkMeta.id : this.currentArtworkId,
      variantId,
      savedRecordId,
    };

    try {
      localStorage.setItem('tap_color_last_artwork', JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save last artwork to localStorage:', e);
    }

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('artwork');
      url.searchParams.delete('variant');
      if (this.currentArtworkMeta) {
        const shareId = variantId || this.currentArtworkMeta.id;
        url.searchParams.set('art', shareId);
      } else {
        url.searchParams.delete('art');
      }
      window.history.replaceState(null, '', url.toString());
    } catch (e) {
      console.warn('Could not update URL query params:', e);
    }
  }

  async resolveInitialArtwork() {
    // 1. Query params take precedence for shared links (e.g. ?art=autumn_fox_pbn)
    try {
      const params = new URLSearchParams(window.location.search);
      const paramArt = params.get('art') || params.get('artwork');
      const paramVariant = params.get('variant');
      if (paramArt) {
        const match = this.findCatalogArtwork(paramArt.trim(), paramVariant ? paramVariant.trim() : null);
        if (match) {
          return {
            id: match.meta.id,
            variantId: match.variantId,
            category: match.meta.category,
            openDirectly: true,
          };
        }
      }
    } catch (e) {
      console.warn('Could not parse URL query params:', e);
    }

    // 2. Otherwise reopen the image the user was last working on in this browser
    try {
      const raw = localStorage.getItem('tap_color_last_artwork');
      if (raw) {
        const savedState = JSON.parse(raw);
        if (savedState && savedState.savedRecordId) {
          const record = await storage.getArtworkById(savedState.savedRecordId);
          if (record && record.artworkData) {
            const parentMeta = record.parentArtworkId ? this.findCatalogArtwork(record.parentArtworkId, record.variantId) : null;
            return {
              id: record.parentArtworkId || record.artworkData.id || savedState.id,
              variantId: record.variantId || savedState.variantId || null,
              category: parentMeta ? parentMeta.meta.category : null,
              savedRecord: record,
              openDirectly: true,
            };
          }
        }
        if (savedState && savedState.id) {
          const match = this.findCatalogArtwork(savedState.id, savedState.variantId || null);
          if (match) {
            return {
              id: match.meta.id,
              variantId: match.variantId,
              category: match.meta.category,
              openDirectly: true,
            };
          }
        }
      }
    } catch (e) {
      console.warn('Could not restore last artwork from localStorage:', e);
    }

    return null;
  }

  async init() {
    this.isInitialized = false;
    this.galleryPopulated = false;
    try {
      initInAppBrowserBanner({
        onVisibilityChange: () => {
          this.setupCanvasDpi();
        },
      });
      this.setupCanvasDpi();
      this.bindEvents();

      // Start WASM loading in parallel with manifest metadata & saved badge
      const wasmPromise = (async () => {
        try {
          const baseUrl = import.meta.env.BASE_URL || '/';
          const wasmUrl = new URL(`${baseUrl.replace(/\/$/, '')}/pkg/tap_color.js`, window.location.href).href;
          const wasmModule = await import(/* @vite-ignore */ wasmUrl);
          await wasmModule.default();
          return wasmModule;
        } catch (e) {
          console.warn('WASM module not yet compiled or unavailable. Launching client preview engine.', e);
          return null;
        }
      })();

      await Promise.all([
        this.loadManifestMeta(),
        this.updateSavedBadge(),
      ]);

      const initialTarget = await this.resolveInitialArtwork();
      if (initialTarget) {
        this.currentArtworkId = initialTarget.id;
        if (initialTarget.category === 'classic' || initialTarget.category === 'diamond') {
          this.activeCategory = initialTarget.category;
          document.querySelectorAll('.gallery-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === initialTarget.category);
          });
        }
      }

      // Only populate gallery thumbnails immediately when landing on the gallery;
      // when opening an artwork directly (e.g. via ?art=...), defer until the user opens the gallery.
      if (!initialTarget || !initialTarget.openDirectly) {
        this.populateGalleryModal();
      }

      const wasmModule = await wasmPromise;
      if (wasmModule) {
        this.controller = new wasmModule.GameController('game-canvas', this.currentArtworkId);
        this.isWasmActive = true;
        if (typeof this.controller.set_viewport_size === 'function' && this.viewportWidth > 0 && this.viewportHeight > 0) {
          this.controller.set_viewport_size(this.viewportWidth, this.viewportHeight);
        }
      } else {
        this.controller = new FallbackJsController(this.canvas, this.currentArtworkId);
      }

      if (initialTarget && initialTarget.savedRecord) {
        this.loadSavedArtwork(initialTarget.savedRecord);
      } else {
        await this.selectArtwork(this.currentArtworkId, initialTarget ? initialTarget.variantId : null);
      }

      if (initialTarget && initialTarget.openDirectly) {
        const modalGallery = document.getElementById('modal-gallery');
        if (modalGallery) modalGallery.classList.add('hidden');
        this.isInitialized = true;
        this.persistCurrentArtworkState();
      } else {
        this.isInitialized = true;
      }

      this.updateArtworkUI();
      this.refreshPaletteUI();
      this.startRenderLoop();
    } finally {
      document.documentElement.classList.remove('has-art-param');
    }
  }

  setupCanvasDpi() {
    if (!this.viewport || !this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    this.viewportWidth = rect.width;
    this.viewportHeight = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.canvasRect = this.canvas.getBoundingClientRect();

    const ctx = this.canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (this.controller && typeof this.controller.set_viewport_size === 'function') {
      this.controller.set_viewport_size(rect.width, rect.height);
    }
  }

  getCanvasRect() {
    if (!this.canvasRect || this.canvasRect.width === 0) {
      this.canvasRect = this.canvas.getBoundingClientRect();
    }
    return this.canvasRect;
  }

  startRenderLoop() {
    if (this.renderRafId) return;
    const modalGallery = document.getElementById('modal-gallery');
    let wasRendering = false;
    const loop = (timestamp) => {
      const galleryOpen = modalGallery && !modalGallery.classList.contains('hidden');
      if (this.controller && !galleryOpen) {
        const shouldRender = typeof this.controller.needs_render === 'function'
          ? this.controller.needs_render()
          : true;
        if (shouldRender) {
          this.controller.render(timestamp);
          if (timestamp - this._lastPaletteVisibilitySync >= 80) {
            this._lastPaletteVisibilitySync = timestamp;
            this.syncVisiblePalette();
          }
          wasRendering = true;
        } else if (wasRendering) {
          wasRendering = false;
          this._lastPaletteVisibilitySync = timestamp;
          this.syncVisiblePalette();
        }
      }
      this.renderRafId = requestAnimationFrame(loop);
    };
    this.renderRafId = requestAnimationFrame(loop);
  }

  bindEvents() {
    this.initDialogListeners();

    window.addEventListener('resize', () => {
      const prevW = this.viewportWidth;
      this.setupCanvasDpi();
      if (this.controller && Math.abs(this.viewportWidth - prevW) > 2) {
        this.controller.fit_to_screen();
      }
    });

    if (this.canvas) {
      // Pointer events (Mouse / Pen / Touch)
      this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      // Wheel zoom
      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (!this.controller) return;
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
        const rect = this.getCanvasRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.controller.update_pan_zoom(0, 0, zoomFactor, x, y);
      }, { passive: false });

      // Touch controls: 1-finger touch to place / glide, 2-fingers pan & pinch-to-zoom
      this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
      this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
      this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
      this.canvas.addEventListener('touchcancel', (e) => this.onTouchCancel(e), { passive: false });
    }
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerCancel(e));

    // Simplified Tool Mode (Color vs One-Finger Move) & Undo
    const morePopover = document.getElementById('more-menu-popover');
    const closeMoreMenu = () => {
      if (morePopover && typeof morePopover.hidePopover === 'function') {
        try {
          if (morePopover.matches(':popover-open')) {
            morePopover.hidePopover();
          }
        } catch (_) {}
      }
    };

    const btnModeToggle = document.getElementById('btn-mode-toggle');
    const labelMoveMode = document.getElementById('label-move-mode');
    const btnClearCanvas = document.getElementById('btn-clear-canvas');
    const btnUndo = document.getElementById('btn-undo');

    const setToolMode = (mode) => {
      this.toolMode = mode;
      const isPan = mode === 'pan';
      if (btnModeToggle) btnModeToggle.classList.toggle('active', isPan);
      if (labelMoveMode) labelMoveMode.textContent = isPan ? 'On' : 'Off';
      if (this.canvas) {
        this.canvas.style.cursor = mode === 'pen' ? 'crosshair' : (mode === 'erase' ? 'cell' : 'grab');
      }
    };
    setToolMode(this.toolMode);

    if (btnUndo) {
      btnUndo.addEventListener('click', () => this.undoLastAction());
    }

    if (btnModeToggle) {
      btnModeToggle.addEventListener('click', () => {
        setToolMode(this.toolMode === 'pan' ? 'pen' : 'pan');
        closeMoreMenu();
      });
    }

    if (btnClearCanvas) {
      btnClearCanvas.addEventListener('click', async () => {
        closeMoreMenu();
        const ok = await this.showConfirm({
          title: 'Start This Picture Over?',
          message: 'This will clear your colors on this picture so you can start fresh.',
          confirmText: 'Start Over',
          cancelText: 'Keep Coloring',
          variant: 'danger',
          icon: 'trash'
        });
        if (ok) {
          this.clearCanvasTiles();
        }
      });
    }

    // Sound toggle
    document.getElementById('btn-sound')?.addEventListener('click', () => {
      this.sound.enabled = !this.sound.enabled;
      const btnSound = document.getElementById('btn-sound');
      const labelSound = document.getElementById('label-sound-state');
      if (btnSound) btnSound.classList.toggle('active', this.sound.enabled);
      if (labelSound) labelSound.textContent = this.sound.enabled ? 'On' : 'Off';
      closeMoreMenu();
    });

    // Outline toggle
    document.getElementById('btn-outline')?.addEventListener('click', () => {
      if (!this.controller) return;
      const visible = this.controller.toggle_outlines();
      const btnOutline = document.getElementById('btn-outline');
      const labelOutline = document.getElementById('label-outline-state');
      if (btnOutline) btnOutline.classList.toggle('active', visible);
      if (labelOutline) labelOutline.textContent = visible ? 'On' : 'Off';
      closeMoreMenu();
    });

    // Magic wand fill current
    document.getElementById('btn-wand')?.addEventListener('click', () => {
      closeMoreMenu();
      if (!this.controller) return;
      try {
        const res = JSON.parse(this.controller.fill_all_of_current());
        if (res.success) {
          this.onTapFeedback(res);
        }
      } catch (_) {}
    });

    // Hint / Find button: toggles matching tile highlights on/off
    document.getElementById('btn-hint')?.addEventListener('click', () => this.toggleHintHighlights());

    // Zoom buttons
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      if (!this.controller) return;
      const rect = this.getCanvasRect();
      this.controller.update_pan_zoom(0, 0, 1.35, rect.width / 2, rect.height / 2);
    });

    const btnZoomDrill = document.getElementById('btn-zoom-drill');
    if (btnZoomDrill) {
      btnZoomDrill.addEventListener('click', () => {
        if (!this.controller) return;
        const rect = this.getCanvasRect();
        const currentScale = this.controller.target_scale || (this.controller.engine ? this.controller.engine.target_scale : 1.0);
        const factor = 2.2 / Math.max(0.2, currentScale);
        this.controller.update_pan_zoom(0, 0, factor, rect.width / 2, rect.height / 2);
      });
    }

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      if (!this.controller) return;
      const rect = this.getCanvasRect();
      this.controller.update_pan_zoom(0, 0, 0.75, rect.width / 2, rect.height / 2);
    });

    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
      if (this.controller) this.controller.fit_to_screen();
    });

    // Gallery Modal open/close
    const modalGallery = document.getElementById('modal-gallery');
    document.getElementById('btn-gallery')?.addEventListener('click', async () => {
      await this.flushAutosave();
      if (modalGallery) modalGallery.classList.remove('hidden');
      if (this.activeCategory === 'saved') {
        await this.renderSavedGallery();
      } else if (!this.galleryPopulated && (this.activeCategory === 'classic' || this.activeCategory === 'diamond')) {
        this.setActiveGalleryTab(this.activeCategory);
      }
    });

    document.getElementById('btn-close-gallery')?.addEventListener('click', () => {
      if (modalGallery) modalGallery.classList.add('hidden');
      this.persistCurrentArtworkState();
    });

    // Flush autosave when window loses focus or unloads
    window.addEventListener('pagehide', () => {
      this.flushAutosave();
    });
    window.addEventListener('beforeunload', () => {
      this.flushAutosave();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushAutosave();
      }
    });

    // Quick Style & Detail Dropdown
    const btnResSwitcher = document.getElementById('btn-resolution-switcher');
    const dropdownQuick = document.getElementById('quick-style-dropdown');
    const backdropQuick = document.getElementById('quick-dropdown-backdrop');
    const btnCloseQuick = document.getElementById('btn-close-quick-dropdown');
    const togglePbn = document.getElementById('quick-toggle-pbn');
    const toggleDiamond = document.getElementById('quick-toggle-diamond');

    const openQuickDropdown = () => {
      this.renderQuickStyleDropdown();
      dropdownQuick.classList.remove('hidden');
      btnResSwitcher.classList.add('active');
      if (backdropQuick) backdropQuick.classList.remove('hidden');
    };

    const closeQuickDropdown = () => {
      dropdownQuick.classList.add('hidden');
      btnResSwitcher.classList.remove('active');
      if (backdropQuick) backdropQuick.classList.add('hidden');
    };

    if (btnResSwitcher && dropdownQuick) {
      btnResSwitcher.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMoreMenu();
        const isHidden = dropdownQuick.classList.contains('hidden');
        if (isHidden) {
          openQuickDropdown();
        } else {
          closeQuickDropdown();
        }
      });

      if (btnCloseQuick) {
        btnCloseQuick.addEventListener('click', (e) => {
          e.stopPropagation();
          closeQuickDropdown();
        });
      }

      if (backdropQuick) {
        backdropQuick.addEventListener('click', (e) => {
          e.stopPropagation();
          closeQuickDropdown();
        });
      }

      document.addEventListener('click', (e) => {
        if (!dropdownQuick.classList.contains('hidden') && !dropdownQuick.contains(e.target) && !btnResSwitcher.contains(e.target)) {
          closeQuickDropdown();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !dropdownQuick.classList.contains('hidden')) {
          closeQuickDropdown();
        }
      });
    }

    if (togglePbn) {
      togglePbn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchArtworkArtType('classic');
      });
    }

    if (toggleDiamond) {
      toggleDiamond.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchArtworkArtType('diamond');
      });
    }

    // Gallery Tabs
    document.querySelectorAll('.gallery-tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        document.querySelectorAll('.gallery-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        this.activeCategory = tab.dataset.tab;

        const grid = document.getElementById('artwork-grid');
        const customPanel = document.getElementById('tab-custom-panel');
        const savedPanel = document.getElementById('tab-saved-panel');
        const pbnFilter = document.getElementById('pbn-pieces-filter');
        const tagFilter = document.getElementById('gallery-tag-filter');

        if (this.activeCategory === 'custom') {
          if (grid) grid.style.display = 'none';
          if (tagFilter) tagFilter.classList.add('hidden');
          if (pbnFilter) pbnFilter.classList.add('hidden');
          if (savedPanel) savedPanel.classList.add('hidden');
          if (customPanel) customPanel.classList.remove('hidden');
          if (this.updateStudioPreview) this.updateStudioPreview();
        } else if (this.activeCategory === 'saved') {
          if (grid) grid.style.display = 'none';
          if (tagFilter) tagFilter.classList.add('hidden');
          if (pbnFilter) pbnFilter.classList.add('hidden');
          if (customPanel) customPanel.classList.add('hidden');
          if (savedPanel) savedPanel.classList.remove('hidden');
          await this.renderSavedGallery();
        } else {
          if (customPanel) customPanel.classList.add('hidden');
          if (savedPanel) savedPanel.classList.add('hidden');
          if (tagFilter) tagFilter.classList.remove('hidden');
          if (grid) grid.style.display = 'grid';
          this.populateGalleryModal();
        }
      });
    });

    // Gallery Category Multi-Select Dropdown
    const tagDropdown = document.getElementById('tag-dropdown');
    const tagDropdownBtn = document.getElementById('tag-dropdown-btn');
    const tagDropdownMenu = document.getElementById('tag-dropdown-menu');
    const clearTagBtn = document.getElementById('btn-clear-tag-filter');

    const closeTagDropdown = () => {
      if (tagDropdownMenu) tagDropdownMenu.classList.add('hidden');
      if (tagDropdownBtn) tagDropdownBtn.setAttribute('aria-expanded', 'false');
    };

    if (tagDropdownBtn && tagDropdownMenu) {
      tagDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !tagDropdownMenu.classList.contains('hidden');
        tagDropdownMenu.classList.toggle('hidden', isOpen);
        tagDropdownBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      });

      document.addEventListener('click', (e) => {
        if (tagDropdown && !tagDropdown.contains(e.target)) {
          closeTagDropdown();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !tagDropdownMenu.classList.contains('hidden')) {
          closeTagDropdown();
          tagDropdownBtn.focus();
        }
      });
    }

    if (clearTagBtn) {
      clearTagBtn.addEventListener('click', () => {
        this.activeTagFilters.clear();
        this.syncTagDropdownUI();
        this.filterGalleryCards();
      });
    }

    // Paint by Number Dual Pieces Slider
    const pbnMinSlider = document.getElementById('pbn-pieces-min-slider');
    const pbnMaxSlider = document.getElementById('pbn-pieces-max-slider');
    const pbnResetBtn = document.getElementById('btn-reset-pbn-filter');
    if (pbnMinSlider) {
      pbnMinSlider.addEventListener('input', () => {
        const maxBound = this.pbnMaxPiecesFilter ?? Number(pbnMinSlider.max);
        const clamped = Math.min(Number(pbnMinSlider.value), maxBound);
        this.pbnMinPiecesFilter = clamped;
        pbnMinSlider.value = String(clamped);
        pbnMinSlider.style.zIndex = '4';
        if (pbnMaxSlider) pbnMaxSlider.style.zIndex = '2';
        this.syncPbnPiecesSliderUI();
        this.filterGalleryCards();
      });
    }
    if (pbnMaxSlider) {
      pbnMaxSlider.addEventListener('input', () => {
        const minBound = this.pbnMinPiecesFilter ?? Number(pbnMaxSlider.min);
        const clamped = Math.max(Number(pbnMaxSlider.value), minBound);
        this.pbnMaxPiecesFilter = clamped;
        pbnMaxSlider.value = String(clamped);
        pbnMaxSlider.style.zIndex = '4';
        if (pbnMinSlider) pbnMinSlider.style.zIndex = '2';
        this.syncPbnPiecesSliderUI();
        this.filterGalleryCards();
      });
    }
    if (pbnResetBtn) {
      pbnResetBtn.addEventListener('click', () => {
        if (!pbnMinSlider || !pbnMaxSlider) return;
        this.pbnMinPiecesFilter = Number(pbnMinSlider.min);
        this.pbnMaxPiecesFilter = Number(pbnMaxSlider.max);
        pbnMinSlider.value = String(this.pbnMinPiecesFilter);
        pbnMaxSlider.value = String(this.pbnMaxPiecesFilter);
        this.syncPbnPiecesSliderUI();
        this.filterGalleryCards();
      });
    }

    const btnOpenStudioEmpty = document.getElementById('btn-open-studio-from-empty');
    if (btnOpenStudioEmpty) {
      btnOpenStudioEmpty.addEventListener('click', () => {
        const studioTab = document.querySelector('.gallery-tab[data-tab="custom"]');
        if (studioTab) studioTab.click();
      });
    }

    const btnBrowseFromEmpty = document.getElementById('btn-browse-from-empty');
    if (btnBrowseFromEmpty) {
      btnBrowseFromEmpty.addEventListener('click', () => {
        const classicTab = document.querySelector('.gallery-tab[data-tab="classic"]');
        if (classicTab) classicTab.click();
      });
    }

    // Procedural Mosaic button
    document.getElementById('btn-generate-mosaic')?.addEventListener('click', async () => {
      await this.flushAutosave();
      const palette = document.getElementById('select-mosaic-palette')?.value || 'sunset';
      const seed = Math.floor(Math.random() * 100000);
      if (this.controller) {
        if (this.victoryTimeout) {
          clearTimeout(this.victoryTimeout);
          this.victoryTimeout = null;
        }
        this.activeImportedRecord = null;
        this.currentArtworkMeta = null;
        this.currentArtworkVariant = null;
        this.lastCustomImage = null;
        this.lastCustomMode = 'classic';
        this.currentArtworkId = `mosaic_${seed}_${palette}`;
        this.syncLineArtOverlay(null);
        this.controller.load_procedural_mosaic(seed, palette);
        if (modalGallery) modalGallery.classList.add('hidden');
        this.startTime = Date.now();
        this.totalTaps = 0;
        this.successfulTaps = 0;
        this.updateArtworkUI();
        this.refreshPaletteUI();
        this.updateResolutionBarUI();
        this.persistCurrentArtworkState();
      }
    });

    // Custom Photo Studio buttons
    this.setupCustomStudio();

    // Victory Modal actions
    const modalVictory = document.getElementById('modal-victory');
    const closeVictoryModal = () => {
      modalVictory.classList.add('hidden');
      if (this.controller && this.controller.fit_to_screen) {
        this.controller.fit_to_screen();
      }
    };

    const btnCloseVictory = document.getElementById('btn-close-victory');
    if (btnCloseVictory) {
      btnCloseVictory.addEventListener('click', closeVictoryModal);
    }

    const btnViewPicture = document.getElementById('btn-view-picture');
    if (btnViewPicture) {
      btnViewPicture.addEventListener('click', closeVictoryModal);
    }

    if (modalVictory) {
      modalVictory.addEventListener('click', (e) => {
        if (e.target === modalVictory) {
          closeVictoryModal();
        }
      });
    }

    document.getElementById('btn-export-png')?.addEventListener('click', () => {
      this.exportArtworkPng();
    });

    const btnExportHeader = document.getElementById('btn-export-header');
    if (btnExportHeader) {
      btnExportHeader.addEventListener('click', () => {
        closeMoreMenu();
        this.exportArtworkPng();
      });
    }

    const progressPill = document.querySelector('.progress-pill');
    if (progressPill) {
      progressPill.addEventListener('click', () => {
        const text = document.getElementById('progress-text')?.textContent;
        if (text === '100%') {
          let totalPieces = 0;
          try {
            if (this.controller && this.controller.get_artwork_info_json) {
              const info = JSON.parse(this.controller.get_artwork_info_json());
              totalPieces = info.total_regions || 0;
            } else if (this.controller && this.controller.artwork) {
              totalPieces = this.controller.artwork.regions?.length || 0;
            }
          } catch (e) {}
          this.showVictoryModal(totalPieces);
        }
      });
    }

    document.getElementById('btn-next-artwork')?.addEventListener('click', () => {
      if (modalVictory) modalVictory.classList.add('hidden');
      if (!this.artworksMeta || this.artworksMeta.length === 0) return;
      const curMode = this.getCurrentArtMode();
      const targetCat = curMode === 'diamond' ? 'diamond' : 'classic';
      const pool = this.artworksMeta.filter(a => a.category === targetCat);
      const list = pool.length > 0 ? pool : this.artworksMeta;
      const curIdx = list.findIndex(a => a.id === this.currentArtworkId);
      const nextIdx = (curIdx + 1) % list.length;
      this.selectArtwork(list[nextIdx].id);
    });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      // Escape key closes open modals
      if (e.key === 'Escape') {
        const modalDialog = document.getElementById('modal-dialog');
        if (modalDialog && !modalDialog.classList.contains('hidden')) {
          this.closeDialog(false);
          return;
        }
        if (modalVictory && !modalVictory.classList.contains('hidden')) {
          closeVictoryModal();
          return;
        }
        if (modalGallery && !modalGallery.classList.contains('hidden')) {
          modalGallery.classList.add('hidden');
          this.persistCurrentArtworkState();
          return;
        }
      }

      // Do not intercept typing in form controls or when a modal/dialog is open
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) {
        return;
      }
      const modalDialog = document.getElementById('modal-dialog');
      if ((modalDialog && !modalDialog.classList.contains('hidden')) ||
          (modalVictory && !modalVictory.classList.contains('hidden')) ||
          (modalGallery && !modalGallery.classList.contains('hidden'))) {
        return;
      }

      // Arrow keys to pan
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        this.onArrowKeyDown(e);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        this.undoLastAction();
        return;
      }

      // Ignore remaining single-key shortcuts when modifier keys are held
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        this.toggleHintHighlights();
      } else if (e.key === 'p' || e.key === 'P') {
        setToolMode('pen');
      } else if (e.key === 'e' || e.key === 'E') {
        setToolMode('erase');
      } else if (e.key === 'h' || e.key === 'H') {
        setToolMode('pan');
      } else if (e.key === 'd' || e.key === 'D') {
        document.getElementById('btn-zoom-drill')?.click();
      } else if (e.key === 'f' || e.key === 'F') {
        if (this.controller) this.controller.fit_to_screen();
      } else if (e.key === 'o' || e.key === 'O') {
        document.getElementById('btn-outline')?.click();
      } else if (/^[1-9]$/.test(e.key)) {
        this.selectNumber(parseInt(e.key, 10));
      }
    });

    window.addEventListener('keyup', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        this.onArrowKeyUp(e);
      }
    });

    window.addEventListener('blur', () => {
      if (this.arrowKeys) {
        this.arrowKeys.clear();
      }
      if (this.stylusHoldTimeout) {
        clearTimeout(this.stylusHoldTimeout);
        this.stylusHoldTimeout = null;
      }
      this.isDragging = false;
      this.isStylusPanning = false;
      this.isStylusActive = false;
      this.pendingStylusAction = null;
    });
  }

  onPointerDown(e) {
    if (e.pointerType === 'touch') return; // Handled by TouchEvents on mobile & touchscreens
    if (this.canvas) {
      this.canvasRect = this.canvas.getBoundingClientRect();
    }

    this.isDragging = true;
    this.dragDistance = 0;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.pointerButton = e.button;

    // Clean up any existing stylus hold timer
    if (this.stylusHoldTimeout) {
      clearTimeout(this.stylusHoldTimeout);
      this.stylusHoldTimeout = null;
    }
    this.isStylusPanning = false;

    // Stylus (Pen) interaction
    if (e.pointerType === 'pen') {
      this.isStylusActive = true;

      // Stylus barrel / side button (button 1 or 2) pans immediately with zero delay
      if (e.button === 1 || e.button === 2) {
        this.isStylusPanning = true;
        this.canvas.style.cursor = 'grabbing';
        return;
      }

      // If user is already in Pan tool mode, regular drag pans
      if (this.toolMode === 'pan') {
        return;
      }

      // Stylus primary tip (button 0): schedule hold-to-scroll gesture (~260ms)
      const rect = this.getCanvasRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.pendingStylusAction = {
        mode: this.toolMode,
        x,
        y,
        clientX: e.clientX,
        clientY: e.clientY
      };

      this.stylusHoldTimeout = setTimeout(() => {
        // Stationary hold threshold reached -> activate pan mode!
        this.isStylusPanning = true;
        this.pendingStylusAction = null;
        this.canvas.style.cursor = 'grabbing';
        if (navigator.vibrate) {
          try { navigator.vibrate(12); } catch (_) {}
        }
        this.showStylusPanFeedback(e.clientX, e.clientY);
      }, 260);

      return;
    }

    // Mouse interaction: Pen or Erase mode left click immediately interacts
    if (this.toolMode === 'pen' && e.button === 0) {
      const rect = this.getCanvasRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.tryPlaceDrill(x, y, true);
    } else if (this.toolMode === 'erase' && e.button === 0) {
      const rect = this.getCanvasRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.tryEraseDrill(x, y);
    }
  }

  onPointerMove(e) {
    if (e.pointerType === 'touch') return;
    if (!this.isDragging || !this.controller) return;
    if (e.buttons === 0 && !this.isStylusPanning) {
      this.isDragging = false;
      return;
    }

    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.dragDistance += Math.hypot(dx, dy);
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    // Middle click, right click, or stylus barrel button always pans
    if (this.pointerButton === 1 || this.pointerButton === 2) {
      const rect = this.getCanvasRect();
      this.controller.update_pan_zoom(dx, dy, 1.0, rect.width / 2, rect.height / 2);
      return;
    }

    // Stylus hold-to-scroll active: pan canvas freely
    if (this.isStylusPanning) {
      const rect = this.getCanvasRect();
      this.controller.update_pan_zoom(dx, dy, 1.0, rect.width / 2, rect.height / 2);
      return;
    }

    // Stylus pending hold check: if movement exceeds deadzone (7px), user is gliding to color
    if (e.pointerType === 'pen' && this.pendingStylusAction) {
      if (this.dragDistance > 7) {
        if (this.stylusHoldTimeout) {
          clearTimeout(this.stylusHoldTimeout);
          this.stylusHoldTimeout = null;
        }
        const act = this.pendingStylusAction;
        this.pendingStylusAction = null;
        if (act.mode === 'pen') {
          this.tryPlaceDrill(act.x, act.y);
        } else if (act.mode === 'erase') {
          this.tryEraseDrill(act.x, act.y);
        }
      } else {
        // Still within hold stationary threshold; wait for timer
        return;
      }
    }

    if (this.toolMode === 'pen' && e.buttons === 1) {
      // Applicator pen glide: color drills continuously
      const rect = this.getCanvasRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.tryPlaceDrill(x, y);
    } else if (this.toolMode === 'erase' && e.buttons === 1) {
      // Eraser glide: clear drills continuously
      const rect = this.getCanvasRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.tryEraseDrill(x, y);
    } else if (this.toolMode === 'pan' && e.buttons === 1) {
      // Pan canvas
      const rect = this.getCanvasRect();
      this.controller.update_pan_zoom(dx, dy, 1.0, rect.width / 2, rect.height / 2);
    }
  }

  onPointerUp(e) {
    if (e.pointerType === 'touch') return;
    if (!this.isDragging) return;
    this.isDragging = false;

    if (this.stylusHoldTimeout) {
      clearTimeout(this.stylusHoldTimeout);
      this.stylusHoldTimeout = null;
    }

    // Stylus finished panning
    if (this.isStylusPanning) {
      this.isStylusPanning = false;
      this.isStylusActive = false;
      this.pendingStylusAction = null;
      this.canvas.style.cursor = this.toolMode === 'pen' ? 'crosshair' : (this.toolMode === 'erase' ? 'cell' : 'grab');
      return;
    }

    // Stylus released before hold timer expired -> quick tap to place/erase!
    if (e.pointerType === 'pen') {
      this.isStylusActive = false;
      if (this.pendingStylusAction) {
        const act = this.pendingStylusAction;
        this.pendingStylusAction = null;
        if (this.dragDistance <= 7 && this.controller && this.pointerButton === 0) {
          if (act.mode === 'pen') {
            this.tryPlaceDrill(act.x, act.y, true);
          } else if (act.mode === 'erase') {
            this.tryEraseDrill(act.x, act.y);
          }
        }
        return;
      }
    }

    // Small movement (< 6px) tap interaction in pan mode
    if (this.toolMode === 'pan' && this.dragDistance < 6 && this.controller && this.pointerButton === 0) {
      const rect = this.getCanvasRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.tryPlaceDrill(x, y, true);
    }
  }

  onPointerCancel(e) {
    if (e.pointerType === 'touch') return;
    if (this.stylusHoldTimeout) {
      clearTimeout(this.stylusHoldTimeout);
      this.stylusHoldTimeout = null;
    }
    this.isStylusPanning = false;
    this.isStylusActive = false;
    this.pendingStylusAction = null;
    this.isDragging = false;
    this.canvas.style.cursor = this.toolMode === 'pen' ? 'crosshair' : (this.toolMode === 'erase' ? 'cell' : 'grab');
  }

  showStylusPanFeedback(clientX, clientY) {
    const ring = document.createElement('div');
    ring.className = 'stylus-pan-ring';
    ring.style.left = `${clientX}px`;
    ring.style.top = `${clientY}px`;
    document.body.appendChild(ring);
    setTimeout(() => {
      if (ring.parentNode) ring.parentNode.removeChild(ring);
    }, 400);
  }

  // Touchscreen Controls: 1-finger touch to place/glide, 2-fingers pan & pinch-zoom
  onTouchStart(e) {
    e.preventDefault();
    if (this.canvas) {
      this.canvasRect = this.canvas.getBoundingClientRect();
    }

    // If stylus pointerdown is active or touch is from a stylus handled by Pointer Events, prevent conflict
    if (this.isStylusActive || (e.touches.length === 1 && e.touches[0].touchType === 'stylus')) {
      return;
    }

    if (e.touches.length === 1) {
      if (Date.now() < this.suppressSingleTouchUntil) return;
      this.isTwoFingerGesture = false;

      const touch = e.touches[0];
      const rect = this.getCanvasRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      this.lastTouchPlaceX = touch.clientX;
      this.lastTouchPlaceY = touch.clientY;
      this.singleTouchStartPos = { x: touch.clientX, y: touch.clientY };

      if (this.touchPlaceTimeout) {
        clearTimeout(this.touchPlaceTimeout);
      }

      // Micro-buffer (35ms) to cleanly distinguish almost-simultaneous 2-finger pan gestures
      this.pendingTouch = { x, y };
      if (this.toolMode !== 'pan') {
        this.touchPlaceTimeout = setTimeout(() => {
          if (this.pendingTouch && !this.isTwoFingerGesture) {
            const pt = this.pendingTouch;
            this.pendingTouch = null;
            this.executeTouchPlace(pt.x, pt.y, true);
          }
        }, 35);
      }

    } else if (e.touches.length >= 2) {
      // 2 fingers (or more): cancel any pending single-finger placement and activate pan/zoom
      if (this.touchPlaceTimeout) {
        clearTimeout(this.touchPlaceTimeout);
        this.touchPlaceTimeout = null;
      }
      this.pendingTouch = null;
      this.isTwoFingerGesture = true;

      const t0 = e.touches[0];
      const t1 = e.touches[1];
      this.touchPinchDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      this.touchMidX = (t0.clientX + t1.clientX) / 2;
      this.touchMidY = (t0.clientY + t1.clientY) / 2;
    }
  }

  onTouchMove(e) {
    e.preventDefault();
    if (this.isStylusActive || (e.touches.length === 1 && e.touches[0].touchType === 'stylus')) {
      return;
    }

    if (e.touches.length === 1) {
      if (this.isTwoFingerGesture || Date.now() < this.suppressSingleTouchUntil) return;

      const touch = e.touches[0];
      const moveDist = Math.hypot(
        touch.clientX - (this.singleTouchStartPos ? this.singleTouchStartPos.x : touch.clientX),
        touch.clientY - (this.singleTouchStartPos ? this.singleTouchStartPos.y : touch.clientY)
      );

      // In One-Finger Move mode, dragging pans the canvas instead of placing drills
      if (this.toolMode === 'pan') {
        if (moveDist >= 6) {
          this.pendingTouch = null;
        }
        const dx = touch.clientX - this.lastTouchPlaceX;
        const dy = touch.clientY - this.lastTouchPlaceY;
        this.lastTouchPlaceX = touch.clientX;
        this.lastTouchPlaceY = touch.clientY;
        if (this.controller && (dx !== 0 || dy !== 0)) {
          const rect = this.getCanvasRect();
          this.controller.update_pan_zoom(dx, dy, 1.0, rect.width / 2, rect.height / 2);
        }
        return;
      }

      // If finger glides before the 35ms timeout fires, trigger placement immediately
      if (this.pendingTouch && moveDist >= 6) {
        clearTimeout(this.touchPlaceTimeout);
        const pt = this.pendingTouch;
        this.pendingTouch = null;
        this.executeTouchPlace(pt.x, pt.y, false);
      }

      // Continuous applicator pen / glide placement along touch path
      const dx = touch.clientX - this.lastTouchPlaceX;
      const dy = touch.clientY - this.lastTouchPlaceY;
      if (Math.hypot(dx, dy) >= 8) {
        this.lastTouchPlaceX = touch.clientX;
        this.lastTouchPlaceY = touch.clientY;
        const rect = this.getCanvasRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        this.executeTouchPlace(x, y, false);
      }

    } else if (e.touches.length >= 2 && this.controller) {
      if (this.touchPlaceTimeout) {
        clearTimeout(this.touchPlaceTimeout);
        this.touchPlaceTimeout = null;
      }
      this.pendingTouch = null;

      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const currentMidX = (t0.clientX + t1.clientX) / 2;
      const currentMidY = (t0.clientY + t1.clientY) / 2;
      const currentDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);

      if (!this.isTwoFingerGesture) {
        this.isTwoFingerGesture = true;
        this.touchMidX = currentMidX;
        this.touchMidY = currentMidY;
        this.touchPinchDist = currentDist;
        return;
      }

      // Pan delta between touch midpoints
      const dx = currentMidX - this.touchMidX;
      const dy = currentMidY - this.touchMidY;

      // Pinch zoom factor
      let factor = 1.0;
      if (this.touchPinchDist > 0 && currentDist > 0) {
        factor = currentDist / this.touchPinchDist;
      }

      const rect = this.getCanvasRect();
      const anchorX = currentMidX - rect.left;
      const anchorY = currentMidY - rect.top;

      this.controller.update_pan_zoom(dx, dy, factor, anchorX, anchorY);

      this.touchMidX = currentMidX;
      this.touchMidY = currentMidY;
      this.touchPinchDist = currentDist;
    }
  }

  onTouchEnd(e) {
    e.preventDefault();
    if (this.isStylusActive) return;

    if (this.isTwoFingerGesture) {
      // Cooldown buffer so lifting fingers does not trigger stray single-touch placement
      this.suppressSingleTouchUntil = Date.now() + 250;
      if (e.touches.length === 0) {
        this.isTwoFingerGesture = false;
      } else if (e.touches.length === 1) {
        this.lastTouchPlaceX = e.touches[0].clientX;
        this.lastTouchPlaceY = e.touches[0].clientY;
      }
      return;
    }

    if (this.pendingTouch) {
      clearTimeout(this.touchPlaceTimeout);
      const pt = this.pendingTouch;
      this.pendingTouch = null;
      this.executeTouchPlace(pt.x, pt.y, true);
    }
  }

  onTouchCancel(e) {
    e.preventDefault();
    if (this.touchPlaceTimeout) {
      clearTimeout(this.touchPlaceTimeout);
      this.touchPlaceTimeout = null;
    }
    this.pendingTouch = null;
    this.isTwoFingerGesture = false;
    this.suppressSingleTouchUntil = Date.now() + 250;
  }

  executeTouchPlace(x, y, playWrongOnFail = false) {
    if (this.toolMode === 'erase') {
      this.tryEraseDrill(x, y);
    } else if (this.toolMode === 'pan') {
      if (playWrongOnFail) this.tryPlaceDrill(x, y, true);
    } else {
      this.tryPlaceDrill(x, y, playWrongOnFail);
    }
  }

  // Keyboard Arrow Keys Panning
  onArrowKeyDown(e) {
    const isFirstPress = !this.arrowKeys.has(e.key);
    this.arrowKeys.add(e.key);

    // Snappy immediate nudge on initial keydown
    if (isFirstPress && this.controller) {
      const nudge = e.shiftKey ? 90 : 45;
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowUp') dy += nudge;
      if (e.key === 'ArrowDown') dy -= nudge;
      if (e.key === 'ArrowLeft') dx += nudge;
      if (e.key === 'ArrowRight') dx -= nudge;
      const rect = this.getCanvasRect();
      this.controller.update_pan_zoom(dx, dy, 1.0, rect.width / 2, rect.height / 2);
    }

    this.startArrowKeyPanning();
  }

  onArrowKeyUp(e) {
    this.arrowKeys.delete(e.key);
  }

  startArrowKeyPanning() {
    if (this.arrowPanRafId) return;

    let lastTime = performance.now();

    const loop = (now) => {
      if (!this.arrowKeys || this.arrowKeys.size === 0) {
        this.arrowPanRafId = null;
        return;
      }

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const speed = 550 * dt;
      let dx = 0;
      let dy = 0;

      if (this.arrowKeys.has('ArrowUp')) dy += speed;
      if (this.arrowKeys.has('ArrowDown')) dy -= speed;
      if (this.arrowKeys.has('ArrowLeft')) dx += speed;
      if (this.arrowKeys.has('ArrowRight')) dx -= speed;

      if ((dx !== 0 || dy !== 0) && this.controller) {
        const rect = this.getCanvasRect();
        this.controller.update_pan_zoom(dx, dy, 1.0, rect.width / 2, rect.height / 2);
      }

      this.arrowPanRafId = requestAnimationFrame(loop);
    };

    this.arrowPanRafId = requestAnimationFrame(loop);
  }

  tryPlaceDrill(x, y, playWrongOnFail = false) {
    if (!this.controller) return;
    let res;
    try {
      res = JSON.parse(this.controller.handle_tap(x, y));
    } catch (_) {
      return;
    }

    if (res.success) {
      this.totalTaps++;
      this.successfulTaps++;
      if (this.getCurrentArtMode() === 'diamond') {
        this.sound.playDiamondSnap(res.number || 1);
      } else {
        this.sound.playTap(res.number || 1);
      }
      if (navigator.vibrate) {
        try { navigator.vibrate(12); } catch (_) {}
      }
      this.onTapFeedback(res);
    } else if (playWrongOnFail && res.region_id !== undefined && res.region_id !== null) {
      this.totalTaps++;
      this.sound.playWrong();
      if (res.number) {
        const item = document.querySelector(`.palette-item[data-number="${res.number}"]`);
        if (item) {
          item.classList.add('shake');
          setTimeout(() => item.classList.remove('shake'), 400);
        }
      }
    }
  }

  onTapFeedback(res) {
    const percent = Math.round(res.percent || 0);
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${percent}%`;

    this.refreshPaletteUI();

    // If a color just completed, prefer auto-selecting an unfilled number currently visible on screen
    if (res.color_completed && !res.artwork_completed) {
      const visibleNums = this.getVisibleUnfilledNumbers();
      if (visibleNums && visibleNums.length > 0 && !visibleNums.includes(this.activeNumber)) {
        this.selectNumber(visibleNums[0]);
      }
    }

    // Persist coloring progress automatically to IndexedDB
    this.triggerAutosave();

    const isCompleted = Boolean(res.artwork_completed || percent >= 100);
    const progressPill = document.querySelector('.progress-pill');
    if (progressPill) {
      progressPill.classList.toggle('completed', isCompleted);
      if (isCompleted) {
        progressPill.title = 'Masterpiece Complete! Click to view celebration & export';
      } else {
        progressPill.removeAttribute('title');
      }
    }

    if (res.color_completed && !res.artwork_completed) {
      this.sound.playColorComplete();
    }

    if (res.artwork_completed) {
      this.flushAutosave();
      if (this.controller && this.controller.fit_to_screen) {
        this.controller.fit_to_screen();
      }
      if (this.victoryTimeout) clearTimeout(this.victoryTimeout);
      this.victoryTimeout = setTimeout(() => {
        this.victoryTimeout = null;
        this.sound.playVictory();
        this.showVictoryModal(res.total_regions);
      }, 500);
    }
  }

  tryEraseDrill(x, y) {
    if (!this.controller) return;
    let res;
    try {
      res = JSON.parse(this.controller.handle_erase(x, y));
    } catch (_) {
      return;
    }
    if (res.success) {
      if (this.victoryTimeout) {
        clearTimeout(this.victoryTimeout);
        this.victoryTimeout = null;
      }
      this.sound.playErase();
      if (navigator.vibrate) {
        try { navigator.vibrate(8); } catch (_) {}
      }
      this.onTapFeedback(res);
    }
  }

  clearCanvasTiles() {
    if (!this.controller) return;
    if (this.victoryTimeout) {
      clearTimeout(this.victoryTimeout);
      this.victoryTimeout = null;
    }
    let res;
    try {
      res = JSON.parse(this.controller.clear_all_tiles());
    } catch (_) {
      return;
    }
    this.startTime = Date.now();
    this.totalTaps = 0;
    this.successfulTaps = 0;
    this.sound.playErase();
    this.onTapFeedback(res);
  }

  triggerHint() {
    this.toggleHintHighlights();
  }

  toggleHintHighlights() {
    if (!this.controller) return;
    const isNowActive = this.controller.toggle_matching_hints();
    this.highlightMatching = isNowActive;

    const btnHint = document.getElementById('btn-hint');
    const badge = document.getElementById('hint-badge');
    if (btnHint) btnHint.classList.toggle('active', isNowActive);
    if (badge) badge.textContent = isNowActive ? 'ON' : 'OFF';

    if (isNowActive) {
      this.sound.playClick();
      this.controller.trigger_hint();
    } else {
      this.sound.playClick();
    }
  }

  selectNumber(num) {
    this.activeNumber = num;
    if (this.controller) {
      this.controller.select_number(num);
    }
    document.querySelectorAll('.palette-item').forEach(el => {
      const isMatch = parseInt(el.dataset.number, 10) === num;
      el.classList.toggle('active', isMatch);
      el.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
    });
  }

  getVisibleUnfilledNumbers() {
    if (!this.controller || typeof this.controller.get_visible_unfilled_numbers_json !== 'function') {
      return null;
    }
    try {
      const parsed = JSON.parse(this.controller.get_visible_unfilled_numbers_json());
      return Array.isArray(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  syncVisiblePalette(force = false) {
    const visibleNums = this.getVisibleUnfilledNumbers();
    if (!visibleNums) return;

    const track = document.getElementById('palette-track');
    if (!track) return;

    const sig = `${this._allColorsCompleted ? '1' : '0'}:${visibleNums.join(',')}`;
    if (!force && this._visiblePaletteSig === sig) return;
    this._visiblePaletteSig = sig;

    const visibleSet = new Set(visibleNums);
    const items = track.querySelectorAll('.palette-item');
    items.forEach(el => {
      const num = parseInt(el.dataset.number, 10);
      const isVisible = visibleSet.has(num);
      el.hidden = !isVisible;
      el.classList.toggle('palette-item--hidden', !isVisible);
      el.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
    });

    let emptyHint = track.querySelector('.palette-empty-hint');
    if (visibleSet.size === 0 && items.length > 0) {
      if (!emptyHint) {
        emptyHint = document.createElement('div');
        emptyHint.className = 'palette-empty-hint';
        track.appendChild(emptyHint);
      }
      if (this._allColorsCompleted) {
        emptyHint.innerHTML = '<span>✨ All colors complete!</span>';
      } else {
        emptyHint.innerHTML = '<span>No unfilled numbers in view</span><button type="button" class="palette-empty-fit-btn">Fit</button>';
        const fitBtn = emptyHint.querySelector('.palette-empty-fit-btn');
        if (fitBtn) {
          fitBtn.addEventListener('click', () => {
            if (this.controller && typeof this.controller.fit_to_screen === 'function') {
              this.controller.fit_to_screen();
            }
          });
        }
      }
    } else if (emptyHint) {
      emptyHint.remove();
    }
  }

  refreshPaletteUI() {
    if (!this.controller) return;
    let palette, info;
    try {
      palette = JSON.parse(this.controller.get_palette_json());
      info = JSON.parse(this.controller.get_artwork_info_json());
    } catch (_) {
      return;
    }
    if (info.active_number) this.activeNumber = info.active_number;
    this._allColorsCompleted = palette.length > 0 && palette.every(p => p.is_completed);

    const track = document.getElementById('palette-track');
    if (!track) return;

    const existingItems = track.querySelectorAll('.palette-item');
    const sig = `${info.id || ''}:${palette.map(p => p.number).join(',')}`;
    if (this._paletteSig === sig && existingItems.length === palette.length) {
      for (let i = 0; i < palette.length; i++) {
        const item = palette[i];
        const el = existingItems[i];
        const isActive = item.number === this.activeNumber;
        el.classList.toggle('active', isActive);
        el.classList.toggle('completed', !!item.is_completed);
        el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        const countEl = el.querySelector('.swatch-count');
        if (countEl) {
          const remaining = Math.max(0, item.total_count - item.filled_count);
          countEl.textContent = item.is_completed ? '✓' : String(remaining);
        }
      }
      this.syncVisiblePalette(true);
      return;
    }

    this._paletteSig = sig;
    this._visiblePaletteSig = null;
    track.innerHTML = '';

    palette.forEach(item => {
      const el = document.createElement('div');
      const isActive = item.number === this.activeNumber;
      el.className = `palette-item ${isActive ? 'active' : ''} ${item.is_completed ? 'completed' : ''}`;
      el.dataset.number = item.number;
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      el.setAttribute('aria-label', `Color ${item.number}${item.name ? `, ${item.name}` : ''}`);

      const remaining = Math.max(0, item.total_count - item.filled_count);
      const safeHex = /^#[0-9a-f]{3,8}$/i.test(item.hex) ? item.hex : '#CCCCCC';

      el.innerHTML = `
        <div class="swatch-circle" style="background-color: ${safeHex}">
          <span class="swatch-number" style="color: ${this.getContrastTextColor(safeHex)}">${item.number}</span>
          <svg class="swatch-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <span class="swatch-count">${item.is_completed ? '✓' : remaining}</span>
      `;

      el.addEventListener('click', () => this.selectNumber(item.number));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.selectNumber(item.number);
        }
      });

      track.appendChild(el);
    });

    this.syncVisiblePalette(true);
  }

  getContrastTextColor(hex) {
    if (!hex || typeof hex !== 'string') return '#111827';
    let c = hex.replace('#', '').trim();
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    if (c.length < 6) return '#111827';
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#111827';
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? '#111827' : '#FFFFFF';
  }

  populateGalleryModal() {
    const grid = document.getElementById('artwork-grid');
    if (!grid) return;
    grid.innerHTML = '';
    this.galleryPopulated = true;

    const category = (this.activeCategory === 'classic' || this.activeCategory === 'diamond')
      ? this.activeCategory
      : 'classic';

    this.renderGalleryTagFilter(category);

    this.artworksMeta
      .filter(meta => meta.category === category)
      .forEach(meta => {
      const card = document.createElement('div');
      card.className = 'artwork-card';
      card.dataset.category = meta.category;
      card.dataset.tags = (meta.tags || []).join(',');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `${meta.title} by ${meta.artist}`);

      const isDiamond = meta.category === 'diamond';
      const activeVariant = meta.variants
        ? (meta.variants.find(v => v.id === (meta.selectedVariantId || meta.defaultVariantId)) || meta.variants[0])
        : null;

      const piecesCount = activeVariant ? activeVariant.pieces : meta.pieces;
      card.dataset.pieces = String(piecesCount);

      let resolutionSelectorHtml = '';
      if (meta.variants && meta.variants.length > 1) {
        resolutionSelectorHtml = `
          <div class="artwork-resolution-selector">
            <span class="resolution-title">Resolution / Difficulty:</span>
            <div class="resolution-pills">
              ${meta.variants.map(v => `
                <button type="button" class="res-pill ${v.id === (activeVariant ? activeVariant.id : '') ? 'active' : ''}" data-variant-id="${escapeHtml(v.id)}" title="${escapeHtml(v.name)}: ${v.pieces} pieces, ${v.colors} colors">
                  ${escapeHtml(v.label)} <span class="res-pill-count">(${v.pieces})</span>
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="artwork-thumb-wrap">
          <canvas class="artwork-thumb-canvas" width="280" height="200"></canvas>
          <span class="artwork-badge ${isDiamond ? 'diamond' : 'classic'}">
            ${isDiamond ? '💎 Diamond Painting' : '🎨 Paint by Number'}
          </span>
        </div>
        <div class="artwork-info">
          <h4>${escapeHtml(meta.title)}</h4>
          <span class="artwork-artist-tag">${escapeHtml(meta.artist)}</span>
          <p>${escapeHtml(meta.desc)}</p>
          ${resolutionSelectorHtml}
          <div class="artwork-footer">
            <span class="artwork-pieces-count">
              ${isDiamond ? '💎' : '🎨'} <span class="card-pieces-count">${piecesCount}</span> Pieces
            </span>
            <span class="btn-play-artwork">Start Coloring</span>
          </div>
        </div>
      `;

      // Resolution pill clicks
      if (meta.variants) {
        card.querySelectorAll('.res-pill').forEach(pill => {
          pill.addEventListener('click', (e) => {
            e.stopPropagation();
            const varId = pill.dataset.variantId;
            meta.selectedVariantId = varId;
            const chosen = meta.variants.find(v => v.id === varId);
            card.querySelectorAll('.res-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            if (chosen) {
              card.dataset.pieces = String(chosen.pieces);
              const numEl = card.querySelector('.card-pieces-count');
              if (numEl) numEl.textContent = chosen.pieces;
              const thumbCanvas = card.querySelector('.artwork-thumb-canvas');
              if (thumbCanvas) this.renderThumbnail(thumbCanvas, meta);
            }
          });
        });
      }

      const openCard = () => {
        const chosenVarId = meta.selectedVariantId || meta.defaultVariantId || meta.id;
        this.selectArtwork(meta.id, chosenVarId);
        document.getElementById('modal-gallery')?.classList.add('hidden');
      };
      card.addEventListener('click', openCard);
      card.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === card) {
          e.preventDefault();
          openCard();
        }
      });

      grid.appendChild(card);

      // Render thumbnail preview
      const thumbCanvas = card.querySelector('.artwork-thumb-canvas');
      this.renderThumbnail(thumbCanvas, meta);
    });

    this.updatePbnPiecesFilterBounds();
    this.filterGalleryCards();
  }

  updatePbnPiecesFilterBounds() {
    const minSlider = document.getElementById('pbn-pieces-min-slider');
    const maxSlider = document.getElementById('pbn-pieces-max-slider');
    if (!minSlider || !maxSlider) return;

    const classicPieces = this.artworksMeta
      .filter(m => m.category === 'classic')
      .map(m => {
        const activeVariant = m.variants
          ? (m.variants.find(v => v.id === (m.selectedVariantId || m.defaultVariantId)) || m.variants[0])
          : null;
        return activeVariant ? activeVariant.pieces : m.pieces;
      })
      .filter(n => typeof n === 'number' && !Number.isNaN(n));

    if (classicPieces.length === 0) return;

    const minPieces = Math.min(...classicPieces);
    const maxPieces = Math.max(...classicPieces);

    minSlider.min = String(minPieces);
    minSlider.max = String(maxPieces);
    maxSlider.min = String(minPieces);
    maxSlider.max = String(maxPieces);

    const minLabel = document.getElementById('pbn-pieces-min-label');
    const maxLabel = document.getElementById('pbn-pieces-max-label');
    if (minLabel) minLabel.textContent = String(minPieces);
    if (maxLabel) maxLabel.textContent = String(maxPieces);

    if (this.pbnMinPiecesFilter === null || this.pbnMinPiecesFilter < minPieces) {
      this.pbnMinPiecesFilter = minPieces;
    } else if (this.pbnMinPiecesFilter > maxPieces) {
      this.pbnMinPiecesFilter = maxPieces;
    }

    if (this.pbnMaxPiecesFilter === null || this.pbnMaxPiecesFilter > maxPieces) {
      this.pbnMaxPiecesFilter = maxPieces;
    } else if (this.pbnMaxPiecesFilter < minPieces) {
      this.pbnMaxPiecesFilter = minPieces;
    }

    if (this.pbnMinPiecesFilter > this.pbnMaxPiecesFilter) {
      this.pbnMinPiecesFilter = this.pbnMaxPiecesFilter;
    }

    minSlider.value = String(this.pbnMinPiecesFilter);
    maxSlider.value = String(this.pbnMaxPiecesFilter);
    this.syncPbnPiecesSliderUI();
  }

  syncPbnPiecesSliderUI() {
    const dualSlider = document.getElementById('pbn-dual-slider');
    const minSlider = document.getElementById('pbn-pieces-min-slider');
    const maxSlider = document.getElementById('pbn-pieces-max-slider');
    const valueEl = document.getElementById('pbn-pieces-value');
    const resetBtn = document.getElementById('btn-reset-pbn-filter');
    if (!minSlider || !maxSlider) return;

    const min = Number(minSlider.min || 0);
    const max = Number(maxSlider.max || 100);
    const minVal = Number(minSlider.value || min);
    const maxVal = Number(maxSlider.value || max);

    const span = max - min;
    const startPct = span > 0 ? ((minVal - min) / span) * 100 : 0;
    const endPct = span > 0 ? ((maxVal - min) / span) * 100 : 100;
    if (dualSlider) {
      dualSlider.style.setProperty('--range-start', `${Math.max(0, Math.min(100, startPct))}%`);
      dualSlider.style.setProperty('--range-end', `${Math.max(0, Math.min(100, endPct))}%`);
    }

    // Prevent thumbs from trapping each other at the endpoints
    if (minVal === maxVal) {
      if (minVal >= max) {
        minSlider.style.zIndex = '4';
        maxSlider.style.zIndex = '2';
      } else if (minVal <= min) {
        minSlider.style.zIndex = '2';
        maxSlider.style.zIndex = '4';
      }
    }

    const isAll = minVal <= min && maxVal >= max;
    let text;
    if (isAll) {
      text = `All (${min}–${max})`;
    } else if (minVal > min && maxVal < max) {
      text = `${minVal}–${maxVal}`;
    } else if (minVal > min) {
      text = `${minVal}+`;
    } else {
      text = `Up to ${maxVal}`;
    }

    if (valueEl) valueEl.textContent = text;
    minSlider.setAttribute('aria-valuetext', `Minimum ${minVal} pieces`);
    maxSlider.setAttribute('aria-valuetext', `Maximum ${maxVal} pieces`);

    if (resetBtn) {
      resetBtn.classList.toggle('hidden', isAll);
    }
  }

  formatTagLabel(tag) {
    const labels = {
      'all': 'All',
      'animals': 'Animals',
      'christian': 'Christian',
      'christmas': 'Christmas',
      'dia-de-los-muertos': 'Día de los Muertos',
      'family': 'Family',
      'loi-krathong': 'Loi Krathong',
      'nature': 'Nature & Country',
      'stained-glass': 'Stained Glass',
      'thanksgiving': 'Thanksgiving',
    };
    if (labels[tag]) return labels[tag];
    return tag.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  syncTagDropdownUI() {
    const labelEl = document.getElementById('tag-dropdown-label');
    const clearBtn = document.getElementById('btn-clear-tag-filter');
    const menu = document.getElementById('tag-dropdown-menu');
    const selected = Array.from(this.activeTagFilters);

    if (menu) {
      menu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = this.activeTagFilters.has(cb.value);
      });
    }

    if (labelEl) {
      if (selected.length === 0) {
        labelEl.textContent = 'Categories: All';
      } else if (selected.length === 1) {
        labelEl.textContent = `Category: ${this.formatTagLabel(selected[0])}`;
      } else {
        const names = selected.map(t => this.formatTagLabel(t)).join(', ');
        labelEl.textContent = `Categories (${selected.length}): ${names}`;
      }
    }

    if (clearBtn) {
      clearBtn.classList.toggle('hidden', selected.length === 0);
    }
  }

  renderGalleryTagFilter(category) {
    const container = document.getElementById('gallery-tag-filter');
    const menu = document.getElementById('tag-dropdown-menu');
    if (!container || !menu) return;

    const items = this.artworksMeta.filter(m => m.category === category);
    const counts = new Map();
    for (const item of items) {
      for (const tag of (item.tags || [])) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }

    const sortedTags = Array.from(counts.keys()).sort((a, b) =>
      this.formatTagLabel(a).localeCompare(this.formatTagLabel(b))
    );

    for (const tag of Array.from(this.activeTagFilters)) {
      if (!counts.has(tag)) this.activeTagFilters.delete(tag);
    }

    container.classList.toggle('hidden', sortedTags.length === 0);
    menu.innerHTML = sortedTags.map(tag => `
      <label class="tag-dropdown-option" role="option" aria-selected="${this.activeTagFilters.has(tag) ? 'true' : 'false'}">
        <input type="checkbox" value="${escapeHtml(tag)}" ${this.activeTagFilters.has(tag) ? 'checked' : ''}>
        <span class="tag-option-text">${escapeHtml(this.formatTagLabel(tag))}</span>
        <span class="tag-option-count">(${counts.get(tag)})</span>
      </label>
    `).join('');

    menu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) {
          this.activeTagFilters.add(cb.value);
        } else {
          this.activeTagFilters.delete(cb.value);
        }
        const opt = cb.closest('.tag-dropdown-option');
        if (opt) opt.setAttribute('aria-selected', cb.checked ? 'true' : 'false');
        this.syncTagDropdownUI();
        this.filterGalleryCards();
      });
    });

    this.syncTagDropdownUI();
  }

  filterGalleryCards() {
    const pbnFilter = document.getElementById('pbn-pieces-filter');
    const tagFilter = document.getElementById('gallery-tag-filter');
    const tagMenu = document.getElementById('tag-dropdown-menu');
    const countEl = document.getElementById('pbn-pieces-count');
    const minSlider = document.getElementById('pbn-pieces-min-slider');
    const maxSlider = document.getElementById('pbn-pieces-max-slider');
    const grid = document.getElementById('artwork-grid');

    if (pbnFilter) {
      pbnFilter.classList.toggle('hidden', this.activeCategory !== 'classic');
    }
    if (tagFilter) {
      const showTags = this.activeCategory === 'classic' || this.activeCategory === 'diamond';
      tagFilter.classList.toggle('hidden', !showTags || (tagMenu && tagMenu.children.length === 0));
    }

    const minPieces = minSlider ? Number(minSlider.value) : 0;
    const maxPieces = maxSlider ? Number(maxSlider.value) : Infinity;
    const hasTagFilters = this.activeTagFilters.size > 0;
    let visibleCount = 0;

    document.querySelectorAll('.artwork-card').forEach(card => {
      const cardTags = card.dataset.tags ? card.dataset.tags.split(',').filter(Boolean) : [];
      const matchesTag = !hasTagFilters || cardTags.some(t => this.activeTagFilters.has(t));

      if (this.activeCategory === 'diamond') {
        const show = card.dataset.category === 'diamond' && matchesTag;
        card.style.display = show ? 'flex' : 'none';
        if (show) visibleCount++;
      } else if (this.activeCategory === 'classic') {
        const isClassic = card.dataset.category === 'classic';
        const pieces = Number(card.dataset.pieces || 0);
        const matchesPieces = pieces >= minPieces && pieces <= maxPieces;
        const show = isClassic && matchesTag && matchesPieces;
        card.style.display = show ? 'flex' : 'none';
        if (show) visibleCount++;
      } else {
        card.style.display = 'flex';
      }
    });

    if (countEl && this.activeCategory === 'classic') {
      countEl.textContent = `${visibleCount} ${visibleCount === 1 ? 'picture' : 'pictures'}`;
    }

    if (grid) {
      const existingEmpty = grid.querySelector('.gallery-empty-filter');
      if (existingEmpty) existingEmpty.remove();
      if (visibleCount === 0 && (this.activeCategory === 'classic' || this.activeCategory === 'diamond')) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'gallery-empty-filter';
        emptyEl.innerHTML = `
          <p>No pictures match the current filters.</p>
          <button type="button" class="pbn-filter-reset">Show All Pictures</button>
        `;
        emptyEl.querySelector('button')?.addEventListener('click', () => {
          this.activeTagFilters.clear();
          this.syncTagDropdownUI();
          const resetBtn = document.getElementById('btn-reset-pbn-filter');
          if (resetBtn && !resetBtn.classList.contains('hidden')) {
            resetBtn.click();
          } else {
            this.filterGalleryCards();
          }
        });
        grid.appendChild(emptyEl);
      }
    }
  }

  updateSavedBadge(prefetchedArtworks = null) {
    const apply = (artworks) => {
      const badge = document.getElementById('saved-badge');
      if (badge) {
        const inProgress = artworks.filter(a => (a.filledCount || 0) > 0 && !a.completed);
        const count = inProgress.length > 0 ? inProgress.length : artworks.length;
        badge.textContent = count;
        badge.title = inProgress.length > 0 ? `${inProgress.length} In Progress` : `${artworks.length} Saved Artworks`;
      }
    };
    if (Array.isArray(prefetchedArtworks)) {
      apply(prefetchedArtworks);
      return Promise.resolve();
    }
    return storage.getAllArtworks()
      .then(apply)
      .catch(e => console.warn('Could not update saved badge:', e));
  }

  triggerAutosave() {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
    }
    this.autosaveTimer = setTimeout(() => {
      this.autosaveTimer = null;
      this.saveCurrentProgress();
    }, 1200);
  }

  async flushAutosave() {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    if (this._saveInFlight) {
      await this._saveInFlight;
    }
    await this.saveCurrentProgress();
  }

  async saveCurrentProgress() {
    if (!this.controller) return;
    if (this._saveInFlight) {
      return this._saveInFlight;
    }

    const genAtStart = this.loadGeneration;
    this._saveInFlight = (async () => {
      let artwork = null;
      if (typeof this.controller.get_artwork_json === 'function') {
        try {
          artwork = JSON.parse(this.controller.get_artwork_json());
        } catch (e) {
          artwork = this.controller.artwork;
        }
      } else {
        artwork = this.controller.artwork;
      }

      if (!artwork || !artwork.regions) return;

      const pieces = artwork.regions.length;
      const filledCount = artwork.regions.filter(r => r.is_filled).length;

      // Do not save clean 0% catalog templates unless it was already an imported/saved record
      if (filledCount === 0 && !this.activeImportedRecord) {
        return;
      }

      let id;
      let title;
      let artist;
      let category = this.getCurrentArtMode();
      let parentArtworkId = null;
      let variantId = null;

      if (this.activeImportedRecord) {
        id = this.activeImportedRecord.id;
        title = this.activeImportedRecord.title || artwork.title;
        artist = this.activeImportedRecord.artist || artwork.artist;
        category = this.activeImportedRecord.category || category;
        parentArtworkId = this.activeImportedRecord.parentArtworkId;
        variantId = this.activeImportedRecord.variantId;
      } else {
        parentArtworkId = this.currentArtworkMeta ? this.currentArtworkMeta.id : this.currentArtworkId;
        variantId = this.currentArtworkVariant ? this.currentArtworkVariant.id : this.currentArtworkId;
        id = variantId || parentArtworkId;
        title = (this.currentArtworkMeta ? this.currentArtworkMeta.title : null) || artwork.title || 'Artwork';
        artist = (this.currentArtworkMeta ? this.currentArtworkMeta.artist : null) || artwork.artist || 'Tap Color Studio';
      }

      // Render snapshot thumbnail showing colored progress
      let thumbnailBlob = null;
      try {
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 280;
        thumbCanvas.height = 200;
        const thumbCtx = thumbCanvas.getContext('2d');
        if (this.isWasmActive && typeof this.controller.render_export === 'function') {
          this.controller.render_export(thumbCtx, 280, 200, false);
        } else {
          this.renderExportFallback(thumbCtx, 280, 200, false);
        }
        thumbnailBlob = await new Promise(resolve => thumbCanvas.toBlob(resolve, 'image/jpeg', 0.85));
      } catch (err) {
        console.warn('Could not generate progress thumbnail:', err);
      }

      if (genAtStart !== this.loadGeneration) return;

      const completed = pieces > 0 && filledCount >= pieces;
      const record = {
        id,
        title,
        artist,
        category,
        parentArtworkId,
        variantId,
        thumbnailBlob: thumbnailBlob || (this.activeImportedRecord ? this.activeImportedRecord.thumbnailBlob : null),
        artworkData: artwork,
        pieces,
        colors: artwork.palette ? artwork.palette.length : 0,
        filledCount,
        completed,
        isAutosave: true,
        lastModified: Date.now(),
      };

      try {
        await storage.saveArtworkRecord(record);
        if (genAtStart !== this.loadGeneration) return;
        this.activeImportedRecord = record;
        await this.updateSavedBadge();

        // If the gallery modal is currently open and viewing saved tab, refresh it live
        const modalGallery = document.getElementById('modal-gallery');
        if (modalGallery && !modalGallery.classList.contains('hidden') && this.activeCategory === 'saved') {
          await this.renderSavedGallery();
        }
      } catch (e) {
        console.warn('Could not persist autosave to IndexedDB:', e);
      }
    })();

    try {
      await this._saveInFlight;
    } finally {
      this._saveInFlight = null;
    }
  }

  formatRelativeTime(ts) {
    if (!ts) return 'Recently';
    const diffMs = Date.now() - ts;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 45) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  async renderSavedGallery() {
    if (this._renderSavedPromise) {
      this._renderSavedQueued = true;
      return this._renderSavedPromise;
    }

    this._renderSavedPromise = (async () => {
      const savedPanel = document.getElementById('tab-saved-panel');
      const inProgressSection = document.getElementById('saved-in-progress-section');
      const inProgressGrid = document.getElementById('in-progress-grid');
      const inProgressBadge = document.getElementById('in-progress-badge');

      const completedSection = document.getElementById('saved-completed-section');
      const completedGrid = document.getElementById('completed-grid');
      const completedBadge = document.getElementById('completed-badge');

      const creationsSection = document.getElementById('saved-creations-section');
      const creationsGrid = document.getElementById('creations-grid');
      const creationsBadge = document.getElementById('creations-badge');

      const emptyPanel = document.getElementById('saved-gallery-empty');

      if (!savedPanel) return;

      try {
        const allSaved = await storage.getAllArtworks();
        this.updateSavedBadge(allSaved);

        if (this.savedBlobUrls.length > 0) {
          for (const url of this.savedBlobUrls) {
            try { URL.revokeObjectURL(url); } catch (_) {}
          }
          this.savedBlobUrls.length = 0;
        }

        if (inProgressGrid) inProgressGrid.innerHTML = '';
        if (completedGrid) completedGrid.innerHTML = '';
        if (creationsGrid) creationsGrid.innerHTML = '';

        if (allSaved.length === 0) {
          if (inProgressSection) inProgressSection.classList.add('hidden');
          if (completedSection) completedSection.classList.add('hidden');
          if (creationsSection) creationsSection.classList.add('hidden');
          if (emptyPanel) emptyPanel.classList.remove('hidden');
          return;
        }

        if (emptyPanel) emptyPanel.classList.add('hidden');

        // Separate into in-progress, completed, and unstarted custom creations
        const inProgressList = allSaved.filter(r => (r.filledCount || 0) > 0 && !r.completed);
        const completedList = allSaved.filter(r => r.completed);
        const creationsList = allSaved.filter(r => (r.filledCount || 0) === 0 && !r.completed && !r.parentArtworkId && r.category === 'imported');

        // 1. IN PROGRESS SUBSECTION (At the top of My Pictures)
        if (inProgressSection && inProgressGrid) {
          inProgressSection.classList.remove('hidden');
          if (inProgressBadge) inProgressBadge.textContent = inProgressList.length;

          if (inProgressList.length > 0) {
            inProgressList.forEach(record => {
              const card = this.createSavedArtworkCard(record, 'in-progress');
              inProgressGrid.appendChild(card);
            });
          } else {
            // Subtle empty state notice for In Progress section
            const emptyNotice = document.createElement('div');
            emptyNotice.className = 'empty-in-progress-notice';
            emptyNotice.innerHTML = `
              <div class="empty-notice-icon">🎨</div>
              <div class="empty-notice-text">
                <strong>No artworks in progress right now.</strong>
                <span>Pick any picture from Paint by Number or Diamond Painting to start coloring — your progress will autosave right here!</span>
              </div>
              <button class="btn-sm-browse" type="button">Browse Library</button>
            `;
            const browseBtn = emptyNotice.querySelector('.btn-sm-browse');
            if (browseBtn) {
              browseBtn.addEventListener('click', () => {
                const pbnTab = document.querySelector('.gallery-tab[data-tab="classic"]');
                if (pbnTab) pbnTab.click();
              });
            }
            inProgressGrid.appendChild(emptyNotice);
          }
        }

        // 2. COMPLETED MASTERPIECES SUBSECTION
        if (completedSection && completedGrid) {
          if (completedList.length > 0) {
            completedSection.classList.remove('hidden');
            if (completedBadge) completedBadge.textContent = completedList.length;
            completedList.forEach(record => {
              const card = this.createSavedArtworkCard(record, 'completed');
              completedGrid.appendChild(card);
            });
          } else {
            completedSection.classList.add('hidden');
          }
        }

        // 3. MY PHOTO STUDIO ARTWORKS SUBSECTION
        if (creationsSection && creationsGrid) {
          if (creationsList.length > 0) {
            creationsSection.classList.remove('hidden');
            if (creationsBadge) creationsBadge.textContent = creationsList.length;
            creationsList.forEach(record => {
              const card = this.createSavedArtworkCard(record, 'creation');
              creationsGrid.appendChild(card);
            });
          } else {
            creationsSection.classList.add('hidden');
          }
        }
      } catch (err) {
        console.error('Failed to render saved gallery:', err);
      }
    })();

    try {
      await this._renderSavedPromise;
    } finally {
      this._renderSavedPromise = null;
      if (this._renderSavedQueued) {
        this._renderSavedQueued = false;
        await this.renderSavedGallery();
      }
    }
  }

  createSavedArtworkCard(record, sectionType) {
    const card = document.createElement('div');
    card.className = 'artwork-card';
    card.dataset.category = 'saved';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${record.title || 'Saved Artwork'}`);

    const isDiamond = (record.category === 'diamond') || (record.artworkData && record.artworkData.id && record.artworkData.id.includes('diamond'));
    const modeBadgeText = isDiamond ? '💎 Diamond Painting' : '🎨 Paint by Number';
    const thumbUrl = record.thumbnailBlob ? URL.createObjectURL(record.thumbnailBlob) : '';
    if (thumbUrl) {
      this.savedBlobUrls.push(thumbUrl);
    }
    const timeStr = this.formatRelativeTime(record.lastModified || record.createdAt);
    const totalPieces = record.pieces || (record.artworkData && record.artworkData.regions ? record.artworkData.regions.length : 0);
    const filled = record.filledCount || 0;
    const percent = Math.min(100, Math.round((filled / Math.max(1, totalPieces)) * 100));
    const safeTitle = escapeHtml(record.title || 'Untitled');
    const safeArtist = escapeHtml(record.artist || 'Tap Color Studio');

    let overlayBadgeHtml = '';
    let actionBtnHtml = '';

    if (sectionType === 'in-progress') {
      overlayBadgeHtml = `<span class="progress-pill-badge">⚡ ${percent}%</span>`;
      actionBtnHtml = `
        <button class="btn-resume-card" type="button">▶ Continue</button>
        <button class="btn-reset-card" title="Reset Progress" aria-label="Reset progress for ${safeTitle}" type="button">↺</button>
        <button class="btn-delete-saved" title="Remove" aria-label="Remove ${safeTitle}" type="button">🗑️</button>
      `;
    } else if (sectionType === 'completed') {
      overlayBadgeHtml = `<span class="progress-pill-badge completed">🎉 100%</span>`;
      actionBtnHtml = `
        <button class="btn-resume-card completed" type="button">👀 View</button>
        <button class="btn-export-card" title="Export High-Res PNG" aria-label="Export ${safeTitle} as PNG" type="button">💾 Export</button>
        <button class="btn-delete-saved" title="Remove" aria-label="Remove ${safeTitle}" type="button">🗑️</button>
      `;
    } else {
      actionBtnHtml = `
        <button class="btn-resume-card" type="button">🎨 Color</button>
        <button class="btn-delete-saved" title="Remove" aria-label="Remove ${safeTitle}" type="button">🗑️</button>
      `;
    }

    card.innerHTML = `
      <div class="artwork-thumb-wrap">
        ${thumbUrl ? `<img class="artwork-thumb-img" src="${thumbUrl}" alt="${safeTitle}">` : '<canvas class="artwork-thumb-canvas" width="280" height="200"></canvas>'}
        <span class="artwork-badge ${isDiamond ? 'diamond' : 'classic'}">${modeBadgeText}</span>
        ${overlayBadgeHtml}
      </div>
      <div class="artwork-info">
        <h4>${safeTitle}</h4>
        <span class="artwork-artist-tag">${safeArtist} • ${timeStr}</span>
        
        <div class="card-progress-bar-wrap">
          <div class="card-progress-bar">
            <div class="card-progress-fill ${record.completed ? 'completed' : ''}" style="width: ${percent}%;"></div>
          </div>
          <div class="card-progress-labels">
            <span>${filled} / ${totalPieces} pieces</span>
            <span class="card-progress-percent ${record.completed ? 'completed' : ''}">${percent}%</span>
          </div>
        </div>

        <div class="artwork-footer">
          <span class="artwork-pieces-count">
            ${isDiamond ? '💎' : '🎨'} ${record.colors || (record.artworkData && record.artworkData.palette ? record.artworkData.palette.length : 0)} Colors
          </span>
          <div class="artwork-card-actions">
            ${actionBtnHtml}
          </div>
        </div>
      </div>
    `;

    if (!thumbUrl) {
      const fbCanvas = card.querySelector('.artwork-thumb-canvas');
      if (fbCanvas) {
        const fctx = fbCanvas.getContext('2d');
        fctx.fillStyle = '#F1F5F9';
        fctx.fillRect(0, 0, fbCanvas.width, fbCanvas.height);
        fctx.fillStyle = '#94A3B8';
        fctx.font = '600 14px sans-serif';
        fctx.textAlign = 'center';
        fctx.textBaseline = 'middle';
        fctx.fillText(isDiamond ? '💎 Diamond Art' : '🎨 Paint by Number', fbCanvas.width / 2, fbCanvas.height / 2);
      }
    }

    const openSaved = async () => {
      try {
        await this.flushAutosave();
        const fullRecord = record.artworkData ? record : await storage.getArtworkById(record.id);
        if (fullRecord && fullRecord.artworkData) {
          this.loadSavedArtwork(fullRecord);
          document.getElementById('modal-gallery')?.classList.add('hidden');
        }
      } catch (err) {
        console.error('Could not load saved artwork:', err);
      }
    };

    // Click or keyboard on card to load
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-delete-saved') || e.target.closest('.btn-reset-card') || e.target.closest('.btn-export-card')) {
        return;
      }
      openSaved();
    });
    card.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === card) {
        e.preventDefault();
        openSaved();
      }
    });

    // Reset progress button
    const resetBtn = card.querySelector('.btn-reset-card');
    if (resetBtn) {
      resetBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const ok = await this.showConfirm({
            title: 'Reset Progress?',
            message: `Reset your progress on "${record.title}" back to 0%? All completed pieces will be cleared.`,
            confirmText: 'Reset to 0%',
            cancelText: 'Cancel',
            variant: 'warning',
            icon: 'warning'
          });
          if (ok) {
            await storage.resetArtworkProgress(record.id);
            const isLoaded = this.currentArtworkId === record.id ||
              (this.currentArtworkVariant && this.currentArtworkVariant.id === record.id) ||
              (this.activeImportedRecord && this.activeImportedRecord.id === record.id);
            if (isLoaded) {
              const fresh = await storage.getArtworkById(record.id);
              if (fresh) this.loadSavedArtwork(fresh);
            }
            await this.renderSavedGallery();
          }
        } catch (err) {
          console.error('Failed to reset artwork progress:', err);
        }
      });
    }

    // Export button (for completed)
    const exportBtn = card.querySelector('.btn-export-card');
    if (exportBtn) {
      exportBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await this.flushAutosave();
          const fullRecord = record.artworkData ? record : await storage.getArtworkById(record.id);
          if (fullRecord && fullRecord.artworkData) {
            const lineArtPromise = this.loadSavedArtwork(fullRecord);
            document.getElementById('modal-gallery')?.classList.add('hidden');
            await lineArtPromise;
            this.exportArtworkPng();
          }
        } catch (err) {
          console.error('Failed to export saved artwork:', err);
        }
      });
    }

    // Delete button
    const deleteBtn = card.querySelector('.btn-delete-saved');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const ok = await this.showConfirm({
            title: 'Remove Picture?',
            message: `Are you sure you want to remove "${record.title}" from your saved pictures? This cannot be undone.`,
            confirmText: 'Remove Picture',
            cancelText: 'Keep Picture',
            variant: 'danger',
            icon: 'trash'
          });
          if (ok) {
            if (this.activeImportedRecord && this.activeImportedRecord.id === record.id) {
              this.activeImportedRecord = null;
            }
            await storage.deleteArtwork(record.id);
            await this.renderSavedGallery();
          }
        } catch (err) {
          console.error('Failed to delete saved artwork:', err);
        }
      });
    }

    return card;
  }

  loadSavedArtwork(record, options = {}) {
    const artwork = record && record.artworkData;
    if (!artwork) return Promise.resolve();

    this.loadGeneration++;
    if (this.victoryTimeout) {
      clearTimeout(this.victoryTimeout);
      this.victoryTimeout = null;
    }
    if (!options.preserveCustomImage) {
      this.lastCustomImage = null;
    }

    this.currentArtworkId = record.parentArtworkId || artwork.id;
    this.activeImportedRecord = record;
    this.highlightMatching = false;
    const btnHint = document.getElementById('btn-hint');
    if (btnHint) btnHint.classList.remove('active');

    // Find meta if it's a catalog artwork
    let meta = this.artworksMeta.find(a => a.id === this.currentArtworkId);
    let targetVariant = null;
    if (meta && meta.variants && record.variantId) {
      targetVariant = meta.variants.find(v => v.id === record.variantId) || meta.variants[0];
      meta.selectedVariantId = targetVariant.id;
    }
    this.currentArtworkMeta = meta || null;
    this.currentArtworkVariant = targetVariant || null;

    // Load artwork into controller
    if (this.controller && this.controller.load_artwork_json) {
      const ok = this.controller.load_artwork_json(JSON.stringify(artwork));
      if (!ok) {
        console.warn('Failed to parse saved artwork JSON into controller');
      }
    } else if (this.controller) {
      this.controller.artwork = artwork;
      this.controller.fit_to_screen();
    }
    const lineArtPromise = this.syncLineArtOverlay(artwork);

    this.startTime = Date.now();
    this.totalTaps = 0;
    this.successfulTaps = 0;
    this.updateArtworkUI();
    this.refreshPaletteUI();
    this.updateResolutionBarUI();
    this.persistCurrentArtworkState();
    return lineArtPromise;
  }

  loadImportedArtwork(record) {
    return this.loadSavedArtwork(record, { preserveCustomImage: true });
  }

  renderThumbnail(canvas, meta) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const activeVar = meta.variants
      ? (meta.variants.find(v => v.id === (meta.selectedVariantId || meta.defaultVariantId)) || meta.variants[0])
      : null;
    const thumbUrl = meta.originalAsset || (activeVar ? activeVar.thumbnailUrl : meta.thumbnailUrl);

    if (thumbUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);
        const pad = 8;
        const scale = Math.min((w - pad * 2) / img.naturalWidth, (h - pad * 2) / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        const dx = (w - dw) / 2;
        const dy = (h - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
      };
      img.onerror = () => {
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(0, 0, w, h);
      };
      img.src = thumbUrl;
    }
  }

  setupCustomStudio() {
    let customImg = null;
    let cachedBounds = null;
    let studioImgGen = 0;
    let currentStudioMode = 'diamond';

    const previewCanvas = document.getElementById('studio-preview-canvas');
    const previewCaption = document.getElementById('preview-caption');
    const previewModeTag = document.getElementById('preview-mode-tag');
    const modeBannerBadge = document.getElementById('mode-banner-badge');
    const modeBannerText = document.getElementById('mode-banner-text');

    const updateStudioPreview = () => {
      if (!previewCanvas) return;
      const pCtx = previewCanvas.getContext('2d');
      pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      if (customImg) {
        pCtx.fillStyle = '#0f172a';
        pCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
        const bounds = cachedBounds || (cachedBounds = detectContentBounds(customImg));
        const scale = Math.min(previewCanvas.width / bounds.sw, previewCanvas.height / bounds.sh);
        const dw = bounds.sw * scale;
        const dh = bounds.sh * scale;
        const dx = (previewCanvas.width - dw) / 2;
        const dy = (previewCanvas.height - dh) / 2;
        pCtx.drawImage(customImg, bounds.sx, bounds.sy, bounds.sw, bounds.sh, dx, dy, dw, dh);

        if (currentStudioMode === 'diamond') {
          pCtx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
          pCtx.lineWidth = 0.5;
          const step = 8;
          pCtx.beginPath();
          for (let gx = dx; gx <= dx + dw; gx += step) {
            pCtx.moveTo(gx, dy);
            pCtx.lineTo(gx, dy + dh);
          }
          for (let gy = dy; gy <= dy + dh; gy += step) {
            pCtx.moveTo(dx, gy);
            pCtx.lineTo(dx + dw, gy);
          }
          pCtx.stroke();
        }

        const activeBtn = document.querySelector('.btn-preset.active');
        const titleInp = document.getElementById('input-custom-title');
        if (previewCaption) {
          previewCaption.textContent = (titleInp && titleInp.value.trim()) || (activeBtn ? activeBtn.textContent.trim() : 'Custom Photo Preview');
        }
      }
    };
    this.updateStudioPreview = updateStudioPreview;

    const loadPreviewImage = (src) => {
      const gen = ++studioImgGen;
      const img = new Image();
      img.onload = () => {
        if (gen !== studioImgGen) return;
        customImg = img;
        cachedBounds = null;
        updateStudioPreview();
      };
      img.onerror = () => {
        if (gen !== studioImgGen) return;
        console.warn('Could not load studio preview image:', src);
      };
      img.src = src;
    };

    const presetButtons = document.querySelectorAll('.btn-preset');
    presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        presetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const assetUrl = btn.dataset.asset;
        const assetTitle = btn.dataset.title;

        if (assetUrl) {
          const uploadName = document.getElementById('upload-filename');
          if (uploadName) uploadName.textContent = btn.textContent.trim();
          if (assetTitle) {
            const titleInp = document.getElementById('input-custom-title');
            if (titleInp) titleInp.value = assetTitle;
          }
          loadPreviewImage(assetUrl);
        }
      });
    });

    // Auto-load initial active asset button if present
    const initAssetBtn = document.querySelector('.btn-preset.active[data-asset]');
    if (initAssetBtn) {
      const assetUrl = initAssetBtn.dataset.asset;
      const assetTitle = initAssetBtn.dataset.title;
      if (assetTitle) {
        const titleInp = document.getElementById('input-custom-title');
        if (titleInp) titleInp.value = assetTitle;
      }
      loadPreviewImage(assetUrl);
    }

    const fileInput = document.getElementById('input-custom-photo');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const uploadName = document.getElementById('upload-filename');
          if (uploadName) uploadName.textContent = file.name;
          presetButtons.forEach(b => b.classList.remove('active'));
          const gen = ++studioImgGen;
          const reader = new FileReader();
          reader.onload = (event) => {
            if (gen !== studioImgGen) return;
            const img = new Image();
            img.onload = () => {
              if (gen !== studioImgGen) return;
              customImg = img;
              cachedBounds = null;
              updateStudioPreview();
            };
            img.onerror = () => console.warn('Could not decode uploaded photo');
            img.src = event.target.result;
          };
          reader.onerror = () => console.warn('Could not read uploaded file');
          reader.readAsDataURL(file);
        }
      });
    }

    // Difficulty chips for Paint by Number
    document.querySelectorAll('#difficulty-chips-vector .btn-diff-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#difficulty-chips-vector .btn-diff-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const comp = chip.dataset.complexity;
        const col = chip.dataset.colors;
        const selectComp = document.getElementById('select-vector-complexity');
        const selectCol = document.getElementById('select-vector-colors');
        if (selectComp) selectComp.value = comp;
        if (selectCol) selectCol.value = col;
      });
    });

    // Difficulty chips for Diamond Painting
    document.querySelectorAll('#difficulty-chips-diamond .btn-diff-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#difficulty-chips-diamond .btn-diff-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const grid = chip.dataset.grid;
        const col = chip.dataset.colors;
        const selectGrid = document.getElementById('select-custom-grid');
        const selectCol = document.getElementById('select-custom-colors');
        if (selectGrid) selectGrid.value = grid;
        if (selectCol) selectCol.value = col;
      });
    });

    // Studio Mode Switcher: Part 1 buttons dynamically change the options available
    const btnModeVector = document.getElementById('btn-mode-vector');
    const btnModeDiamond = document.getElementById('btn-mode-diamond');
    const settingsVector = document.getElementById('settings-vector-panel');
    const settingsDiamond = document.getElementById('settings-diamond-panel');

    const setStudioMode = (mode) => {
      currentStudioMode = mode;
      if (mode === 'vector') {
        btnModeVector.classList.add('active');
        btnModeDiamond.classList.remove('active');
        if (settingsVector) settingsVector.classList.remove('hidden');
        if (settingsDiamond) settingsDiamond.classList.add('hidden');
        if (modeBannerBadge) modeBannerBadge.textContent = '🎨 Paint by Number Active';
        if (modeBannerText) modeBannerText.textContent = 'Vector mode active: Custom outlines, smooth curved boundaries, and seamless fills.';
        if (previewModeTag) {
          previewModeTag.textContent = '🎨 Paint by Number';
          previewModeTag.classList.remove('diamond');
        }
      } else {
        btnModeDiamond.classList.add('active');
        btnModeVector.classList.remove('active');
        if (settingsDiamond) settingsDiamond.classList.remove('hidden');
        if (settingsVector) settingsVector.classList.add('hidden');
        if (modeBannerBadge) modeBannerBadge.textContent = '💎 Diamond Painting Active';
        if (modeBannerText) modeBannerText.textContent = 'Diamond mode active: Sparkly gemstone drills mapped onto a precision mosaic grid.';
        if (previewModeTag) {
          previewModeTag.textContent = '💎 Diamond Painting';
          previewModeTag.classList.add('diamond');
        }
      }
      updateStudioPreview();
    };

    if (btnModeVector && btnModeDiamond) {
      btnModeVector.addEventListener('click', () => setStudioMode('vector'));
      btnModeDiamond.addEventListener('click', () => setStudioMode('diamond'));
    }

    const getActiveSourceImage = async () => {
      if (customImg) return customImg;
      const activeBtn = document.querySelector('.btn-preset.active[data-asset]');
      const assetUrl = (activeBtn && activeBtn.dataset.asset) || 'assets/paint_by_number/fluffy-cow-3.jpeg';
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = assetUrl;
      });
    };

    // Paint-by-Number conversion
    const btnConvertVector = document.getElementById('btn-convert-vector');
    if (btnConvertVector) {
      btnConvertVector.addEventListener('click', async () => {
        if (this.isConverting) return;
        this.isConverting = true;
        const modalConv = document.getElementById('modal-conversion');
        const statusEl = document.getElementById('conversion-status');
        const fillEl = document.getElementById('conversion-progress-fill');
        const titleInput = document.getElementById('input-custom-title');
        const customTitle = (titleInput && titleInput.value.trim()) || 'My Painting';

        const complexity = document.getElementById('select-vector-complexity')?.value || 'balanced';
        const customPaletteSize = parseInt(document.getElementById('select-vector-colors')?.value, 10) || 26;

        if (modalConv) modalConv.classList.remove('hidden');
        if (fillEl) fillEl.style.width = '10%';
        if (statusEl) statusEl.textContent = 'Preparing your picture...';

        try {
          await this.flushAutosave();
          const source = await getActiveSourceImage();
          this.lastCustomImage = source;
          this.lastCustomTitle = customTitle;
          this.lastCustomMode = 'classic';
          this.lastCustomComplexity = complexity;
          this.lastCustomPaletteSize = customPaletteSize;
          this.currentArtworkMeta = null;
          this.currentArtworkVariant = null;

          const onProgress = (msg, pct) => {
            if (statusEl) statusEl.textContent = msg;
            if (fillEl) fillEl.style.width = `${pct}%`;
          };

          const { artwork, thumbnailBlob } = await vectorizeImage(source, {
            title: customTitle,
            complexity,
            customPaletteSize,
            onProgress,
          });

          onProgress('Saving to your collection...', 96);
          const savedId = await storage.saveArtwork(artwork, thumbnailBlob, customTitle);
          await this.updateSavedBadge();

          if (modalConv) modalConv.classList.add('hidden');
          document.getElementById('modal-gallery')?.classList.add('hidden');

          this.loadImportedArtwork({
            id: savedId,
            title: customTitle,
            artist: 'My Custom Art',
            category: 'imported',
            createdAt: Date.now(),
            thumbnailBlob,
            artworkData: artwork,
            pieces: artwork.regions.length,
            colors: artwork.palette.length,
            filledCount: 0,
            completed: false,
          });
        } catch (err) {
          console.error('Art creation failed:', err);
          if (modalConv) modalConv.classList.add('hidden');
          await this.showAlert({
            title: 'Creation Failed',
            message: 'Could not create coloring page: ' + err.message,
            variant: 'error',
            icon: 'error'
          });
        } finally {
          this.isConverting = false;
        }
      });
    }

    const btnConvertDiamond = document.getElementById('btn-convert-diamond');
    if (btnConvertDiamond) {
      btnConvertDiamond.addEventListener('click', async () => {
        if (this.isConverting) return;
        this.isConverting = true;
        try {
          const N = parseInt(document.getElementById('select-custom-grid')?.value, 10) || 120;
          const K = parseInt(document.getElementById('select-custom-colors')?.value, 10) || 26;
          const titleInput = document.getElementById('input-custom-title');
          const customTitle = (titleInput && titleInput.value.trim()) || 'Diamond Masterpiece';

          await this.flushAutosave();
          const source = await getActiveSourceImage();
          this.lastCustomImage = source;
          this.lastCustomTitle = customTitle;
          this.lastCustomMode = 'diamond';
          this.lastCustomGrid = N;
          this.lastCustomColors = K;
          this.currentArtworkMeta = null;
          this.currentArtworkVariant = null;

          this.convertImageToDiamondArt(source, N, K, customTitle);
          document.getElementById('modal-gallery')?.classList.add('hidden');
        } catch (err) {
          console.error('Diamond art creation failed:', err);
          await this.showAlert({
            title: 'Creation Failed',
            message: 'Could not load image for Diamond Painting.',
            variant: 'error',
            icon: 'error'
          });
        } finally {
          this.isConverting = false;
        }
      });
    }
  }

  convertImageToDiamondArt(img, N, K, customTitle = '') {
    const gen = ++this.loadGeneration;
    if (this.victoryTimeout) {
      clearTimeout(this.victoryTimeout);
      this.victoryTimeout = null;
    }
    this.activeImportedRecord = null;
    this.highlightMatching = false;
    const btnHint = document.getElementById('btn-hint');
    if (btnHint) btnHint.classList.remove('active');

    const offCanvas = document.createElement('canvas');
    offCanvas.width = N;
    offCanvas.height = N;
    const ctx = offCanvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, N, N);
    const bounds = detectContentBounds(img);
    const scale = Math.min(N / bounds.sw, N / bounds.sh);
    const dw = bounds.sw * scale;
    const dh = bounds.sh * scale;
    const dx = (N - dw) / 2;
    const dy = (N - dh) / 2;
    ctx.drawImage(img, bounds.sx, bounds.sy, bounds.sw, bounds.sh, dx, dy, dw, dh);

    const imgData = ctx.getImageData(0, 0, N, N);
    const pixels = imgData.data;

    // Palette quantization using kmeans
    const totalDrills = N * N;
    const samples = [];
    const sampleStep = Math.max(1, Math.floor(totalDrills / 2800));
    for (let i = 0; i < totalDrills; i += sampleStep) {
      const pIdx = i * 4;
      samples.push([pixels[pIdx], pixels[pIdx + 1], pixels[pIdx + 2]]);
    }

    const effectiveK = Math.max(1, Math.min(K, samples.length));
    const km = kmeans(samples, effectiveK, { initialization: 'kmeans++', maxIterations: 12 });
    const centers = km.centroids.map(c => [
      Math.min(255, Math.max(0, Math.round(c[0] || 0))),
      Math.min(255, Math.max(0, Math.round(c[1] || 0))),
      Math.min(255, Math.max(0, Math.round(c[2] || 0))),
    ]);

    centers.sort((a, b) => {
      const lumA = 0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2];
      const lumB = 0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2];
      return lumB - lumA;
    });

    // Build Palette
    const palette = centers.map((c, idx) => {
      const hex = '#' + ((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]).toString(16).slice(1).toUpperCase();
      return {
        number: idx + 1,
        hex,
        name: `Gemstone Drill #${idx + 1}`,
        total_count: 0,
        filled_count: 0,
        is_completed: false,
      };
    });

    // Build Regions
    const width = 800;
    const height = 800;
    const margin = 28;
    const avail = width - margin * 2;
    const cellSize = avail / N;
    const regions = new Array(totalDrills);
    let regId = 0;

    const cR = centers.map(c => c[0]);
    const cG = centers.map(c => c[1]);
    const cB = centers.map(c => c[2]);

    for (let r = 0; r < N; r++) {
      const y0 = margin + r * cellSize;
      const y1 = y0 + cellSize;
      const cy = (y0 + y1) * 0.5;
      const rOffset = r * N;

      for (let c = 0; c < N; c++) {
        const pIdx = (rOffset + c) * 4;
        const pr = pixels[pIdx];
        const pg = pixels[pIdx + 1];
        const pb = pixels[pIdx + 2];

        let bestDist = Infinity;
        let bestK = 0;
        for (let k = 0; k < effectiveK; k++) {
          const dr = pr - cR[k];
          const dg = pg - cG[k];
          const db = pb - cB[k];
          const d = dr * dr + dg * dg + db * db;
          if (d < bestDist) {
            bestDist = d;
            bestK = k;
          }
        }

        const num = bestK + 1;
        palette[bestK].total_count++;

        const x0 = margin + c * cellSize;
        const x1 = x0 + cellSize;
        const cx = (x0 + x1) * 0.5;

        regions[regId] = {
          id: regId,
          number: num,
          polygon: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }],
          centroid: { x: cx, y: cy },
          color_hex: palette[bestK].hex,
          is_filled: false,
          fill_anim: 0.0,
        };
        regId++;
      }
    }

    const activePalette = palette.filter(p => p.total_count > 0);

    const artwork = {
      id: 'custom_diamond_' + Date.now(),
      title: customTitle || 'Custom Photo Diamond Art',
      artist: 'Custom Studio Creation',
      width,
      height,
      palette: activePalette,
      regions,
    };

    generateThumbnailBlob(artwork)
      .then(blob => storage.saveArtwork(artwork, blob, artwork.title).then(savedId => ({ savedId, blob })))
      .then(({ savedId, blob }) => {
        if (gen !== this.loadGeneration) return;
        this.activeImportedRecord = {
          id: savedId,
          title: artwork.title,
          artist: artwork.artist,
          category: 'imported',
          createdAt: Date.now(),
          thumbnailBlob: blob,
          artworkData: artwork,
          pieces: artwork.regions.length,
          colors: artwork.palette.length,
          filledCount: 0,
          completed: false,
        };
        this.updateSavedBadge();
        this.persistCurrentArtworkState();
      })
      .catch(e => console.warn('Could not save diamond artwork to IndexedDB:', e));

    this.currentArtworkId = artwork.id;
    this.lastCustomMode = 'diamond';
    if (this.controller && this.controller.load_artwork_json) {
      this.controller.load_artwork_json(JSON.stringify(artwork));
    } else if (this.controller) {
      this.controller.artwork = artwork;
      this.controller.fit_to_screen();
    }
    this.syncLineArtOverlay(null);

    this.startTime = Date.now();
    this.totalTaps = 0;
    this.successfulTaps = 0;
    this.updateArtworkUI();
    this.refreshPaletteUI();
    this.updateResolutionBarUI();
    this.persistCurrentArtworkState();
  }

  syncLineArtOverlay(artworkData) {
    if (!this.controller || typeof this.controller.set_line_art_image !== 'function') {
      return Promise.resolve();
    }
    const gen = ++this.lineArtGeneration;
    const url = artworkData && artworkData.line_art_url;
    if (!url) {
      this.controller.set_line_art_image(null);
      return Promise.resolve();
    }
    this.controller.set_line_art_image(null);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (gen === this.lineArtGeneration && this.controller && typeof this.controller.set_line_art_image === 'function') {
          this.controller.set_line_art_image(img);
        }
        resolve();
      };
      img.onerror = () => {
        console.warn('Could not load line art overlay:', url);
        resolve();
      };
      img.src = url;
    });
  }

  async selectArtwork(id, variantId = null) {
    const gen = ++this.loadGeneration;
    await this.flushAutosave();
    if (gen !== this.loadGeneration) return;

    if (this.victoryTimeout) {
      clearTimeout(this.victoryTimeout);
      this.victoryTimeout = null;
    }

    this.currentArtworkId = id;
    this.activeImportedRecord = null;
    this.highlightMatching = false;
    const btnHint = document.getElementById('btn-hint');
    if (btnHint) btnHint.classList.remove('active');

    // Find meta
    let meta = this.artworksMeta.find(a => a.id === id);
    let targetVariant = null;

    if (!meta) {
      for (const m of this.artworksMeta) {
        if (m.variants) {
          const v = m.variants.find(varItem => varItem.id === id);
          if (v) {
            meta = m;
            targetVariant = v;
            break;
          }
        }
      }
    }

    if (meta && meta.variants && meta.variants.length > 0) {
      if (variantId) {
        targetVariant = meta.variants.find(v => v.id === variantId) || meta.variants[0];
      } else if (!targetVariant) {
        targetVariant = meta.variants.find(v => v.id === (meta.selectedVariantId || meta.defaultVariantId)) || meta.variants[0];
      }
      meta.selectedVariantId = targetVariant.id;
    }

    this.currentArtworkMeta = meta;
    this.currentArtworkVariant = targetVariant;

    // Check if there is an autosaved in-progress session for this artwork variant in storage!
    const targetId = targetVariant ? targetVariant.id : (variantId || id);
    try {
      const savedRecord = await storage.getArtworkById(targetId);
      if (gen !== this.loadGeneration) return;
      if (savedRecord && savedRecord.artworkData && (savedRecord.filledCount || 0) > 0) {
        this.loadSavedArtwork(savedRecord);
        return;
      }
    } catch (e) {
      console.warn('Could not check saved record in storage:', e);
    }

    const jsonPath = targetVariant ? targetVariant.jsonFile : (meta ? meta.jsonFile : null);

    if (jsonPath) {
      try {
        const res = await fetch(jsonPath);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rawArtworkData = await res.json();
        if (gen !== this.loadGeneration) return;
        const artworkData = this.expandCompactArtwork(rawArtworkData);
        if (this.controller && this.controller.load_artwork_json) {
          this.controller.load_artwork_json(JSON.stringify(artworkData));
        } else if (this.controller) {
          this.controller.artwork = artworkData;
          this.controller.fit_to_screen();
        }
        this.syncLineArtOverlay(artworkData);
      } catch (err) {
        if (gen !== this.loadGeneration) return;
        console.error('Failed to load artwork JSON from ' + jsonPath, err);
        if (this.controller) {
          this.controller.load_artwork(id);
        }
        this.syncLineArtOverlay(null);
      }
    } else {
      if (this.controller) {
        this.controller.load_artwork(id);
      }
      this.syncLineArtOverlay(null);
    }

    this.startTime = Date.now();
    this.totalTaps = 0;
    this.successfulTaps = 0;
    this.updateArtworkUI();
    this.refreshPaletteUI();
    this.updateResolutionBarUI();
    this.persistCurrentArtworkState();
  }

  expandCompactArtwork(data) {
    if (!data || !Array.isArray(data.cells) || Array.isArray(data.regions)) {
      return data;
    }

    const N = data.grid || Math.round(Math.sqrt(data.cells.length));
    if (!N) return { ...data, regions: [] };
    const width = data.width || 800;
    const height = data.height || 800;
    const margin = data.margin ?? 28;
    const avail = width - margin * 2;
    const cellSize = avail / N;

    const hexByNum = Object.create(null);
    for (const item of data.palette || []) {
      hexByNum[item.number] = item.hex;
    }

    const round2 = (v) => Math.round(v * 100) / 100;
    const regions = new Array(N * N);

    for (let r = 0; r < N; r++) {
      const y0Raw = margin + r * cellSize;
      const y1Raw = y0Raw + cellSize;
      const y0 = round2(y0Raw);
      const y1 = round2(y1Raw);
      const cy = round2((y0Raw + y1Raw) * 0.5);

      for (let c = 0; c < N; c++) {
        const idx = r * N + c;
        const num = data.cells[idx] ?? 1;
        const x0Raw = margin + c * cellSize;
        const x1Raw = x0Raw + cellSize;
        const x0 = round2(x0Raw);
        const x1 = round2(x1Raw);
        const cx = round2((x0Raw + x1Raw) * 0.5);

        regions[idx] = {
          id: idx,
          number: num,
          polygon: [
            { x: x0, y: y0 },
            { x: x1, y: y0 },
            { x: x1, y: y1 },
            { x: x0, y: y1 },
          ],
          centroid: { x: cx, y: cy },
          color_hex: hexByNum[num] || '#FFFFFF',
          is_filled: false,
          fill_anim: 0.0,
        };
      }
    }

    const { cells: _cells, ...rest } = data;
    return { ...rest, regions };
  }

  getCurrentArtMode() {
    if (this.currentArtworkMeta) {
      return this.currentArtworkMeta.category === 'diamond' ? 'diamond' : 'classic';
    }
    if (this.controller && this.controller.is_diamond_mode) {
      return 'diamond';
    }
    if (this.lastCustomMode) {
      return this.lastCustomMode;
    }
    return 'diamond';
  }

  updateResolutionBarUI() {
    const btnRes = document.getElementById('btn-resolution-switcher');
    const labelRes = document.getElementById('label-current-resolution');
    const resIcon = document.getElementById('res-icon-indicator');
    if (!btnRes || !labelRes) return;

    const isDiamond = this.getCurrentArtMode() === 'diamond';
    if (resIcon) resIcon.textContent = isDiamond ? '💎' : '🎨';
    btnRes.classList.toggle('diamond-mode', isDiamond);

    const formatFriendlyLevel = (v) => {
      if (!v) return 'Medium';
      if (v.grid === 80 || v.name === 'Cozy Canvas') return 'Easy';
      if (v.grid === 120 || v.name === 'Standard Kit') return 'Medium';
      if (v.grid === 160 || v.name === 'Masterpiece Ultra') return 'Detailed';
      if (v.name === 'Original Lines') return 'Classic';
      return v.name || v.label || 'Medium';
    };

    if (this.currentArtworkMeta && this.currentArtworkMeta.variants) {
      const v = this.currentArtworkVariant;
      labelRes.textContent = formatFriendlyLevel(v);
      btnRes.classList.remove('hidden');
    } else if (this.activeImportedRecord || this.lastCustomImage) {
      labelRes.textContent = isDiamond ? 'Diamond Art' : 'Paint by Number';
      btnRes.classList.remove('hidden');
    } else {
      labelRes.textContent = isDiamond ? 'Diamond Art' : 'Classic';
      btnRes.classList.remove('hidden');
    }
  }

  renderQuickStyleDropdown() {
    const isDiamond = this.getCurrentArtMode() === 'diamond';
    const togglePbn = document.getElementById('quick-toggle-pbn');
    const toggleDiamond = document.getElementById('quick-toggle-diamond');
    const optionsContainer = document.getElementById('quick-dropdown-options');
    const artTitleEl = document.getElementById('quick-dropdown-art-title');

    if (togglePbn) {
      // Only show Paint by Number switch if the current gallery artwork has a curated PBN counterpart (or is already PBN)
      let hasPbnCounterpart = !isDiamond;
      if (isDiamond && this.currentArtworkMeta) {
        const baseKey = this.currentArtworkMeta.id.replace(/_(pbn|diamond)$/, '');
        hasPbnCounterpart = this.artworksMeta.some(a => a.id === `${baseKey}_pbn`);
      }
      togglePbn.style.display = hasPbnCounterpart ? '' : 'none';
      togglePbn.classList.toggle('active', !isDiamond);
    }
    if (toggleDiamond) toggleDiamond.classList.toggle('active', isDiamond);

    const title = this.currentArtworkMeta ? this.currentArtworkMeta.title : (this.lastCustomTitle || 'Current Artwork');
    if (artTitleEl) artTitleEl.textContent = isDiamond ? `${title} • Detail Level` : `${title} • Paint by Number`;

    if (!optionsContainer) return;
    optionsContainer.innerHTML = '';

    const closeDropdown = () => {
      const dropdown = document.getElementById('quick-style-dropdown');
      const btn = document.getElementById('btn-resolution-switcher');
      const backdrop = document.getElementById('quick-dropdown-backdrop');
      if (dropdown) dropdown.classList.add('hidden');
      if (btn) btn.classList.remove('active');
      if (backdrop) backdrop.classList.add('hidden');
    };

    // Case 1: Gallery Artwork
    if (this.currentArtworkMeta && this.currentArtworkMeta.variants) {
      const meta = this.currentArtworkMeta;
      const isMetaDiamond = meta.category === 'diamond';

      meta.variants.forEach(v => {
        const isActive = this.currentArtworkVariant && this.currentArtworkVariant.id === v.id;
        const item = document.createElement('div');
        item.className = `quick-dropdown-item ${isMetaDiamond ? 'diamond-item' : ''} ${isActive ? 'active' : ''}`;
        item.setAttribute('role', 'menuitem');
        item.setAttribute('tabindex', '0');

        let icon = '🟡';
        if (v.id.includes('80') || v.id.includes('detailed')) icon = '🟢';
        if (v.id.includes('160') || v.id.includes('masterpiece')) icon = '🟣';

        let friendlyName = v.name || v.label;
        if (v.grid === 80 || friendlyName === 'Cozy Canvas') friendlyName = 'Easy';
        else if (v.grid === 120 || friendlyName === 'Standard Kit') friendlyName = 'Medium';
        else if (v.grid === 160 || friendlyName === 'Masterpiece Ultra') friendlyName = 'Detailed';
        else if (friendlyName === 'Original Lines') friendlyName = 'Classic';

        const safeName = escapeHtml(friendlyName);
        const subtitle = isMetaDiamond
          ? `${v.grid ? `${v.grid}×${v.grid} drills • ` : ''}${v.colors} colors`
          : `Crisp hand-drawn outlines • ${v.colors} colors`;

        item.innerHTML = `
          <div class="quick-item-left">
            <span class="quick-item-icon">${isMetaDiamond ? icon : '🎨'}</span>
            <div class="quick-item-info">
              <span class="quick-item-title">${safeName} ${isActive ? '✓' : ''}</span>
              <span class="quick-item-subtitle">${subtitle}</span>
            </div>
          </div>
          <span class="quick-item-badge">${isActive ? 'Selected' : 'Choose'}</span>
        `;

        const activate = () => {
          closeDropdown();
          if (!isActive) {
            this.selectArtwork(meta.id, v.id);
          }
        };
        item.addEventListener('click', activate);
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activate();
          }
        });

        optionsContainer.appendChild(item);
      });
      return;
    }

    // Case 2: Custom Photo
    if (!this.lastCustomImage) {
      const note = document.createElement('div');
      note.className = 'quick-dropdown-empty';
      note.textContent = 'Custom photo detail levels are available right after creating from a photo.';
      optionsContainer.appendChild(note);
      return;
    }
    if (isDiamond) {
      const diamondPresets = [
        { grid: 80, colors: 18, name: 'Easy', icon: '🟢', drills: 6400 },
        { grid: 120, colors: 26, name: 'Medium', icon: '🟡', drills: 14400 },
        { grid: 160, colors: 36, name: 'Detailed', icon: '🟣', drills: 25600 }
      ];

      diamondPresets.forEach(preset => {
        const isActive = this.lastCustomGrid === preset.grid;
        const item = document.createElement('div');
        item.className = `quick-dropdown-item diamond-item ${isActive ? 'active' : ''}`;
        item.innerHTML = `
          <div class="quick-item-left">
            <span class="quick-item-icon">${preset.icon}</span>
            <div class="quick-item-info">
              <span class="quick-item-title">${preset.name} ${isActive ? '✓' : ''}</span>
              <span class="quick-item-subtitle">${preset.grid}×${preset.grid} drills • ${preset.colors} colors</span>
            </div>
          </div>
          <span class="quick-item-badge">${preset.drills.toLocaleString()} pcs</span>
        `;

        item.addEventListener('click', () => {
          closeDropdown();
          if (this.lastCustomImage) {
            this.lastCustomGrid = preset.grid;
            this.lastCustomColors = preset.colors;
            this.convertImageToDiamondArt(this.lastCustomImage, 'custom', preset.grid, preset.colors, this.lastCustomTitle || 'Custom Diamond');
          }
        });

        optionsContainer.appendChild(item);
      });
    } else {
      const pbnPresets = [
        { complexity: 'cozy', colors: 18, name: 'Detailed', icon: '🟢', desc: 'Smooth spaces • 18 colors' },
        { complexity: 'balanced', colors: 26, name: 'Intricate', icon: '🟡', desc: 'Adult Coloring Book • 26 colors' },
        { complexity: 'detailed', colors: 34, name: 'Masterpiece', icon: '🟣', desc: 'Ultra-fine detail • 34 colors' }
      ];

      pbnPresets.forEach(preset => {
        const isActive = this.lastCustomComplexity === preset.complexity;
        const item = document.createElement('div');
        item.className = `quick-dropdown-item ${isActive ? 'active' : ''}`;
        item.innerHTML = `
          <div class="quick-item-left">
            <span class="quick-item-icon">${preset.icon}</span>
            <div class="quick-item-info">
              <span class="quick-item-title">${preset.name} ${isActive ? '✓' : ''}</span>
              <span class="quick-item-subtitle">${preset.desc}</span>
            </div>
          </div>
          <span class="quick-item-badge">${preset.colors} colors</span>
        `;

        item.addEventListener('click', async () => {
          closeDropdown();
          if (this.lastCustomImage && !this.isConverting) {
            this.isConverting = true;
            this.lastCustomMode = 'classic';
            this.lastCustomComplexity = preset.complexity;
            this.lastCustomPaletteSize = preset.colors;
            const modalConv = document.getElementById('modal-conversion');
            const statusEl = document.getElementById('conversion-status');
            const fillEl = document.getElementById('conversion-progress-fill');
            if (modalConv) modalConv.classList.remove('hidden');
            if (fillEl) fillEl.style.width = '20%';
            if (statusEl) statusEl.textContent = 'Generating Paint by Number...';

            try {
              await this.flushAutosave();
              const title = this.lastCustomTitle || 'Custom Painting';
              const { artwork, thumbnailBlob } = await vectorizeImage(this.lastCustomImage, {
                title,
                complexity: preset.complexity,
                customPaletteSize: preset.colors,
                onProgress: (msg, pct) => {
                  if (statusEl) statusEl.textContent = msg;
                  if (fillEl) fillEl.style.width = `${pct}%`;
                }
              });

              const savedId = await storage.saveArtwork(artwork, thumbnailBlob, title);
              await this.updateSavedBadge();
              if (modalConv) modalConv.classList.add('hidden');

              this.loadImportedArtwork({
                id: savedId,
                title,
                artist: 'My Custom Art',
                category: 'imported',
                createdAt: Date.now(),
                thumbnailBlob,
                artworkData: artwork,
                pieces: artwork.regions.length,
                colors: artwork.palette.length,
                filledCount: 0,
                completed: false,
              });
            } catch (err) {
              console.error('Vectorization failed:', err);
              if (modalConv) modalConv.classList.add('hidden');
              await this.showAlert({
                title: 'Update Failed',
                message: 'Could not update detail: ' + err.message,
                variant: 'error',
                icon: 'error'
              });
            } finally {
              this.isConverting = false;
            }
          }
        });

        optionsContainer.appendChild(item);
      });
    }
  }

  async switchArtworkArtType(targetMode) {
    const currentMode = this.getCurrentArtMode();
    if (currentMode === targetMode) return;

    const dropdownQuick = document.getElementById('quick-style-dropdown');
    const btnResSwitcher = document.getElementById('btn-resolution-switcher');
    const backdropQuick = document.getElementById('quick-dropdown-backdrop');
    const closeQuick = () => {
      if (dropdownQuick) dropdownQuick.classList.add('hidden');
      if (btnResSwitcher) btnResSwitcher.classList.remove('active');
      if (backdropQuick) backdropQuick.classList.add('hidden');
    };

    // 1. Gallery Artwork: find counterpart or convert originalAsset on the fly
    if (this.currentArtworkMeta) {
      const currentId = this.currentArtworkMeta.id;
      const baseKey = currentId.replace(/_(pbn|diamond)$/, '');
      const counterpartId = baseKey + (targetMode === 'diamond' ? '_diamond' : '_pbn');
      const counterpartMeta = this.artworksMeta.find(a => a.id === counterpartId);
      if (counterpartMeta) {
        closeQuick();
        await this.selectArtwork(counterpartMeta.id);
        return;
      } else if (this.currentArtworkMeta.originalAsset) {
        const assetUrl = this.currentArtworkMeta.originalAsset;
        this.lastCustomTitle = this.currentArtworkMeta.title;
        try {
          this.lastCustomImage = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Could not load source image'));
            img.src = assetUrl;
          });
        } catch (err) {
          closeQuick();
          console.error('Could not load originalAsset:', err);
          return;
        }
      }
    }

    // 2. Custom Photo or Active Imported Artwork
    if (this.lastCustomImage && !this.isConverting) {
      closeQuick();
      this.isConverting = true;
      try {
        await this.flushAutosave();
        this.currentArtworkMeta = null;
        this.currentArtworkVariant = null;
        this.lastCustomMode = targetMode;

        if (targetMode === 'diamond') {
          const N = this.lastCustomGrid || 120;
          const K = this.lastCustomColors || 26;
          const title = this.lastCustomTitle || 'Custom Diamond Art';
          this.convertImageToDiamondArt(this.lastCustomImage, N, K, title);
        } else {
          const modalConv = document.getElementById('modal-conversion');
          const statusEl = document.getElementById('conversion-status');
          const fillEl = document.getElementById('conversion-progress-fill');
          if (modalConv) modalConv.classList.remove('hidden');
          if (fillEl) fillEl.style.width = '20%';
          if (statusEl) statusEl.textContent = 'Generating Paint by Number...';

          try {
            const comp = this.lastCustomComplexity || 'balanced';
            const colors = this.lastCustomPaletteSize || 26;
            const title = this.lastCustomTitle || 'Custom Painting';

            const { artwork, thumbnailBlob } = await vectorizeImage(this.lastCustomImage, {
              title,
              complexity: comp,
              customPaletteSize: colors,
              onProgress: (msg, pct) => {
                if (statusEl) statusEl.textContent = msg;
                if (fillEl) fillEl.style.width = `${pct}%`;
              }
            });

            const savedId = await storage.saveArtwork(artwork, thumbnailBlob, title);
            await this.updateSavedBadge();
            if (modalConv) modalConv.classList.add('hidden');

            this.loadImportedArtwork({
              id: savedId,
              title,
              artist: 'My Custom Art',
              category: 'imported',
              createdAt: Date.now(),
              thumbnailBlob,
              artworkData: artwork,
              pieces: artwork.regions.length,
              colors: artwork.palette.length,
              filledCount: 0,
              completed: false,
            });
          } catch (err) {
            console.error('Failed to convert to PBN:', err);
            if (modalConv) modalConv.classList.add('hidden');
            await this.showAlert({
              title: 'Conversion Failed',
              message: 'Could not convert to Paint by Number: ' + err.message,
              variant: 'error',
              icon: 'error'
            });
          }
        }
      } finally {
        this.isConverting = false;
      }
    } else {
      closeQuick();
    }
  }

  updateArtworkUI() {
    if (!this.controller) return;
    let info = {};
    try {
      info = JSON.parse(this.controller.get_artwork_info_json());
    } catch (_) {
      return;
    }
    const cleanTitle = (this.currentArtworkMeta && this.currentArtworkMeta.title) || info.title || 'Tap Color';
    const titleEl = document.getElementById('artwork-title');
    const artistEl = document.getElementById('artwork-artist');
    const fillEl = document.getElementById('progress-fill');
    const textEl = document.getElementById('progress-text');
    if (titleEl) titleEl.textContent = cleanTitle;
    if (artistEl) artistEl.textContent = (this.currentArtworkMeta && this.currentArtworkMeta.artist) || info.artist || 'Art Studio';
    const percent = Math.round(((info.filled_regions || 0) / Math.max(1, info.total_regions || 1)) * 100);
    if (fillEl) fillEl.style.width = `${percent}%`;
    if (textEl) textEl.textContent = `${percent}%`;
  }

  undoLastAction() {
    if (!this.controller || typeof this.controller.undo_last !== 'function') return;
    const resJson = this.controller.undo_last();
    let res = null;
    try {
      res = JSON.parse(resJson);
    } catch (_) {
      return;
    }
    if (res && res.success) {
      this.sound.playClick();
      this.updateArtworkUI();
      this.refreshPaletteUI();
      if (res.correct_number) {
        this.selectNumber(res.correct_number);
      }
      this.scheduleAutosave();
    }
  }

  showVictoryModal(totalPieces) {
    const elapsedSecs = Math.floor((Date.now() - this.startTime) / 1000);
    const mins = String(Math.floor(elapsedSecs / 60)).padStart(2, '0');
    const secs = String(elapsedSecs % 60).padStart(2, '0');

    document.getElementById('stat-time').textContent = `${mins}:${secs}`;
    document.getElementById('stat-pieces').textContent = totalPieces;
    const acc = this.totalTaps > 0 ? Math.round((this.successfulTaps / this.totalTaps) * 100) : 100;
    document.getElementById('stat-accuracy').textContent = `${acc}%`;

    const verses = [
      '“Every good and perfect gift is from above.” — James 1:17',
      '“He has made everything beautiful in its time.” — Ecclesiastes 3:11',
      '“The Lord bless you and keep you.” — Numbers 6:24',
      '“Let all that you do be done in love.” — 1 Corinthians 16:14',
      '“This is the day that the Lord has made; let us rejoice and be glad in it.” — Psalm 118:24'
    ];
    const verseEl = document.getElementById('celebration-verse');
    if (verseEl) {
      verseEl.textContent = verses[Math.floor(Math.random() * verses.length)];
    }

    document.getElementById('modal-victory').classList.remove('hidden');
  }

  exportArtworkPng() {
    if (!this.controller) return;

    let info = { width: 800, height: 800, title: this.currentArtworkId };
    try {
      if (typeof this.controller.get_artwork_info_json === 'function') {
        info = JSON.parse(this.controller.get_artwork_info_json());
      } else if (this.controller.artwork) {
        info = this.controller.artwork;
      }
    } catch (e) {
      console.warn('Could not read artwork info for export:', e);
    }

    const artW = Number(info.width) || 800;
    const artH = Number(info.height) || 800;

    // High resolution: 2x super-sampling for crystal clear edges and diamond facets
    const exportScale = 2.0;
    const exportW = Math.round(artW * exportScale);
    const exportH = Math.round(artH * exportScale);

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportW;
    exportCanvas.height = exportH;
    const exportCtx = exportCanvas.getContext('2d');

    const isFullyComplete = Boolean(
      (info.filled_regions && info.total_regions && info.filled_regions >= info.total_regions) ||
      document.getElementById('progress-text')?.textContent === '100%'
    );

    if (typeof this.controller.render_export === 'function') {
      this.controller.render_export(exportCtx, exportW, exportH, isFullyComplete);
    } else {
      this.renderExportFallback(exportCtx, exportW, exportH, isFullyComplete);
    }

    const rawTitle = info.title || this.currentArtworkId || 'artwork';
    const cleanTitle = rawTitle.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'tap_color';
    const filename = `${cleanTitle}_masterpiece.png`;

    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'image/png');
  }

  renderExportFallback(ctx, width, height, forceAllFilled = false) {
    let artwork = this.controller ? this.controller.artwork : null;
    if (!artwork && this.controller && typeof this.controller.get_artwork_json === 'function') {
      try {
        artwork = JSON.parse(this.controller.get_artwork_json());
      } catch (e) {}
    }
    if (!artwork || !artwork.regions) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    const artW = artwork.width || 800;
    const artH = artwork.height || 800;
    const s = Math.min(width / artW, height / artH);
    const ox = (width - artW * s) / 2;
    const oy = (height - artH * s) / 2;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);

    const isDiamond = Boolean(
      (artwork.id && artwork.id.includes('diamond')) ||
      (artwork.regions.length > 300 && artwork.regions[0] && artwork.regions[0].polygon && artwork.regions[0].polygon.length === 4)
    );

    for (const region of artwork.regions) {
      if (!region.polygon || region.polygon.length < 3) continue;
      const isFilled = region.is_filled || forceAllFilled;
      const isQuad = isDiamond && region.polygon.length === 4;
      const p0 = region.polygon[0];
      const p1 = region.polygon[1];
      const p2 = region.polygon[2] || p0;
      const p3 = region.polygon[3] || p0;
      const cellW = p1.x - p0.x;
      const cellH = p2.y - p1.y;

      const tracePoly = () => {
        ctx.beginPath();
        ctx.moveTo(region.polygon[0].x, region.polygon[0].y);
        for (let i = 1; i < region.polygon.length; i++) {
          ctx.lineTo(region.polygon[i].x, region.polygon[i].y);
        }
        ctx.closePath();
        if (region.holes) {
          for (const hole of region.holes) {
            if (hole.length >= 3) {
              ctx.moveTo(hole[0].x, hole[0].y);
              for (let i = 1; i < hole.length; i++) {
                ctx.lineTo(hole[i].x, hole[i].y);
              }
              ctx.closePath();
            }
          }
        }
      };

      if (isFilled) {
        ctx.fillStyle = region.color_hex;
        if (isQuad) {
          ctx.fillRect(p0.x, p0.y, cellW, cellH);
        } else {
          tracePoly();
          ctx.fill('evenodd');

          // Seam-seal stroke prevents white hairline cracks between adjacent pieces
          ctx.strokeStyle = region.color_hex;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }

        if (isQuad && (cellW * s) >= 8) {
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.closePath();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.closePath();
          ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#F8FAFC';
        if (isQuad) {
          ctx.fillRect(p0.x, p0.y, cellW, cellH);
        } else {
          tracePoly();
          ctx.fill('evenodd');

          ctx.strokeStyle = '#F8FAFC';
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      }
    }

    const lineArtImg = this.controller && this.controller.lineArtImage;
    if (lineArtImg && lineArtImg.complete && lineArtImg.naturalWidth > 0) {
      ctx.drawImage(lineArtImg, 0, 0, artW, artH);
    }
    ctx.restore();
  }

  /* ==========================================================================
     Custom Accessible Alert & Confirm Dialog Modal System
     ========================================================================== */

  initDialogListeners() {
    const modalDialog = document.getElementById('modal-dialog');
    const btnClose = document.getElementById('btn-dialog-close');
    const btnCancel = document.getElementById('btn-dialog-cancel');
    const btnConfirm = document.getElementById('btn-dialog-confirm');

    if (btnClose) {
      btnClose.addEventListener('click', () => this.closeDialog(false));
    }
    if (btnCancel) {
      btnCancel.addEventListener('click', () => this.closeDialog(false));
    }
    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => this.closeDialog(true));
    }
    if (modalDialog) {
      modalDialog.addEventListener('click', (e) => {
        if (e.target === modalDialog) {
          this.closeDialog(false);
        }
      });

      modalDialog.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (document.activeElement === btnCancel || document.activeElement === btnClose) {
            this.closeDialog(false);
          } else {
            this.closeDialog(true);
          }
          e.preventDefault();
        } else if (e.key === 'Tab') {
          const focusables = Array.from(modalDialog.querySelectorAll('button:not([disabled])'))
            .filter(el => el.offsetParent !== null);
          if (focusables.length === 0) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      });
    }

    // Expose helpers globally for seamless access throughout the app
    this._nativeAlert = window.alert ? window.alert.bind(window) : null;
    window.showConfirm = (opts) => this.showConfirm(opts);
    window.showAlert = (opts) => this.showAlert(opts);
    window.alert = (msg) => this.showAlert(msg);
  }

  getDialogIconSvg(iconName, variant) {
    if (!iconName) {
      if (variant === 'danger') iconName = 'trash';
      else if (variant === 'warning') iconName = 'warning';
      else if (variant === 'error') iconName = 'error';
      else if (variant === 'success') iconName = 'success';
      else iconName = 'info';
    }

    if (typeof iconName === 'string' && iconName.trim().startsWith('<svg')) {
      return iconName;
    }

    switch (iconName) {
      case 'trash':
      case 'delete':
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>`;
      case 'warning':
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>`;
      case 'reset':
      case 'refresh':
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>`;
      case 'error':
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>`;
      case 'success':
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>`;
      case 'question':
      case 'help':
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>`;
      case 'info':
      default:
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>`;
    }
  }

  showConfirm(options = {}) {
    if (typeof options === 'string') {
      options = { message: options };
    }
    return this.openDialog({
      mode: 'confirm',
      title: options.title || 'Confirm Action',
      message: options.message || 'Are you sure you want to proceed?',
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      variant: options.variant || 'primary',
      icon: options.icon || (options.variant === 'danger' ? 'trash' : (options.variant === 'warning' ? 'warning' : 'question'))
    });
  }

  showAlert(options = {}) {
    if (typeof options === 'string') {
      const isErr = /could not|error|fail/i.test(options);
      options = {
        message: options,
        title: isErr ? 'Notice' : 'Information',
        variant: isErr ? 'error' : 'info',
        icon: isErr ? 'error' : 'info'
      };
    }
    return this.openDialog({
      mode: 'alert',
      title: options.title || 'Notice',
      message: options.message || '',
      confirmText: options.confirmText || options.buttonText || 'OK',
      cancelText: '',
      variant: options.variant || 'info',
      icon: options.icon || 'info'
    });
  }

  openDialog(config) {
    return new Promise((resolve) => {
      if (this.dialogResolve) {
        this.dialogResolve(false);
      }

      this.dialogResolve = resolve;
      this.dialogPreviousFocus = document.activeElement;

      const modalDialog = document.getElementById('modal-dialog');
      const titleEl = document.getElementById('dialog-title');
      const msgEl = document.getElementById('dialog-message');
      const iconWrapper = document.getElementById('dialog-icon-wrapper');
      const btnCancel = document.getElementById('btn-dialog-cancel');
      const btnConfirm = document.getElementById('btn-dialog-confirm');

      if (!modalDialog || !titleEl || !msgEl || !iconWrapper || !btnConfirm || !btnCancel) {
        if (config.mode === 'confirm') {
          resolve(window.confirm(config.message));
        } else {
          if (this._nativeAlert) this._nativeAlert(config.message);
          resolve(true);
        }
        return;
      }

      titleEl.textContent = config.title;
      msgEl.textContent = config.message;

      iconWrapper.className = `dialog-icon-wrapper variant-${config.variant}`;
      iconWrapper.innerHTML = this.getDialogIconSvg(config.icon, config.variant);

      btnConfirm.textContent = config.confirmText || 'Confirm';
      btnConfirm.className = 'dialog-btn';
      if (config.variant === 'danger') {
        btnConfirm.classList.add('btn-danger');
      } else if (config.variant === 'warning') {
        btnConfirm.classList.add('btn-warning');
      } else {
        btnConfirm.classList.add('btn-primary');
      }

      if (config.mode === 'alert') {
        btnCancel.style.display = 'none';
      } else {
        btnCancel.style.display = '';
        btnCancel.textContent = config.cancelText || 'Cancel';
      }

      modalDialog.classList.remove('hidden');

      if (this.dialogFocusTimeout) clearTimeout(this.dialogFocusTimeout);
      this.dialogFocusTimeout = setTimeout(() => {
        this.dialogFocusTimeout = null;
        if (config.mode === 'confirm' && config.variant === 'danger') {
          btnCancel.focus();
        } else {
          btnConfirm.focus();
        }
      }, 30);
    });
  }

  closeDialog(result) {
    if (this.dialogFocusTimeout) {
      clearTimeout(this.dialogFocusTimeout);
      this.dialogFocusTimeout = null;
    }
    const modalDialog = document.getElementById('modal-dialog');
    if (modalDialog && !modalDialog.classList.contains('hidden')) {
      modalDialog.classList.add('hidden');
    }
    if (this.dialogResolve) {
      const res = this.dialogResolve;
      this.dialogResolve = null;
      res(result);
    }
    if (this.dialogPreviousFocus && typeof this.dialogPreviousFocus.focus === 'function') {
      try {
        this.dialogPreviousFocus.focus();
      } catch (_) {}
      this.dialogPreviousFocus = null;
    }
  }
}

/**
 * Fallback client preview controller:
 * Ensures the web app opens and renders beautifully even before wasm is loaded.
 */
class FallbackJsController {
  constructor(canvas, artworkId) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.panX = 0;
    this.panY = 0;
    this.scale = 1;
    this.targetPanX = 0;
    this.targetPanY = 0;
    this.targetScale = 1;
    this.showOutlines = true;
    this.particles = [];
    this.hintRegionId = null;
    this.pulsePhase = 0;
    this.lastTime = 0;
    this.highlightMatchingTiles = false;
    this.undoStack = [];
    this.dirty = true;
    this.viewportW = canvas ? (canvas.width / (window.devicePixelRatio || 1)) : 800;
    this.viewportH = canvas ? (canvas.height / (window.devicePixelRatio || 1)) : 600;
    this.load_artwork(artworkId);
  }

  set_viewport_size(w, h) {
    this.viewportW = Math.max(1, w);
    this.viewportH = Math.max(1, h);
    this.dirty = true;
  }

  needs_render() {
    return this.dirty ||
      Math.abs(this.targetPanX - this.panX) > 0.05 ||
      Math.abs(this.targetPanY - this.panY) > 0.05 ||
      Math.abs(this.targetScale - this.scale) > 0.0005 ||
      this.particles.length > 0 ||
      this.highlightMatchingTiles;
  }

  get is_diamond_mode() {
    return Boolean(
      this.artwork && (
        (this.artwork.id && this.artwork.id.includes('diamond')) ||
        (this.artwork.regions && this.artwork.regions.length > 300 && this.artwork.regions[0]?.polygon?.length === 4)
      )
    );
  }

  precomputeBboxes(artwork) {
    if (!artwork || !artwork.regions) return;
    for (const r of artwork.regions) {
      if (!r.polygon || r.polygon.length === 0) {
        r._bbox = [0, 0, 0, 0];
        continue;
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const pt of r.polygon) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
      r._bbox = [minX, minY, maxX, maxY];
    }
  }

  load_artwork(id) {
    this.highlightMatchingTiles = false;
    this.undoStack = [];
    this.lineArtImage = null;
    const regions = [
      { id: 0, number: 9, color_hex: '#577590', is_filled: false, polygon: [{x:180,y:310},{x:330,y:335},{x:325,y:342}], centroid: {x:278,y:329} },
      { id: 1, number: 9, color_hex: '#577590', is_filled: false, polygon: [{x:180,y:310},{x:325,y:342},{x:310,y:350}], centroid: {x:271,y:334} },
      { id: 2, number: 4, color_hex: '#2A9D8F', is_filled: false, polygon: [{x:330,y:335},{x:380,y:300},{x:395,y:330},{x:335,y:345}], centroid: {x:360,y:327} },
      { id: 3, number: 4, color_hex: '#2A9D8F', is_filled: false, polygon: [{x:380,y:300},{x:430,y:315},{x:420,y:345},{x:395,y:330}], centroid: {x:406,y:322} },
      { id: 4, number: 5, color_hex: '#48CAE4', is_filled: false, polygon: [{x:335,y:345},{x:395,y:330},{x:385,y:370}], centroid: {x:371,y:348} },
      { id: 5, number: 9, color_hex: '#577590', is_filled: false, polygon: [{x:365,y:330},{x:375,y:325},{x:380,y:335},{x:370,y:340}], centroid: {x:372,y:332} },
      { id: 6, number: 1, color_hex: '#E63946', is_filled: false, polygon: [{x:335,y:345},{x:385,y:370},{x:355,y:400}], centroid: {x:358,y:371} },
      { id: 7, number: 1, color_hex: '#E63946', is_filled: false, polygon: [{x:385,y:370},{x:415,y:390},{x:375,y:420},{x:355,y:400}], centroid: {x:382,y:395} },
      { id: 8, number: 2, color_hex: '#F4A261', is_filled: false, polygon: [{x:415,y:390},{x:455,y:400},{x:420,y:435},{x:375,y:420}], centroid: {x:416,y:411} },
      { id: 9, number: 3, color_hex: '#E76F51', is_filled: false, polygon: [{x:355,y:400},{x:375,y:420},{x:350,y:460}], centroid: {x:360,y:426} },
      { id: 10, number: 6, color_hex: '#0077B6', is_filled: false, polygon: [{x:420,y:345},{x:490,y:240},{x:460,y:340}], centroid: {x:456,y:308} },
      { id: 11, number: 5, color_hex: '#48CAE4', is_filled: false, polygon: [{x:490,y:240},{x:560,y:160},{x:515,y:255},{x:460,y:340}], centroid: {x:506,y:248} },
      { id: 12, number: 6, color_hex: '#0077B6', is_filled: false, polygon: [{x:560,y:160},{x:630,y:100},{x:585,y:185},{x:515,y:255}], centroid: {x:572,y:175} },
      { id: 13, number: 4, color_hex: '#2A9D8F', is_filled: false, polygon: [{x:630,y:100},{x:700,y:50},{x:650,y:130},{x:585,y:185}], centroid: {x:641,y:116} },
      { id: 14, number: 7, color_hex: '#90BE6D', is_filled: false, polygon: [{x:700,y:50},{x:720,y:40},{x:675,y:120},{x:650,y:130}], centroid: {x:686,y:85} },
      { id: 15, number: 4, color_hex: '#2A9D8F', is_filled: false, polygon: [{x:460,y:340},{x:515,y:255},{x:550,y:290},{x:485,y:375}], centroid: {x:502,y:315} },
      { id: 16, number: 8, color_hex: '#43AA8B', is_filled: false, polygon: [{x:515,y:255},{x:585,y:185},{x:615,y:230},{x:550,y:290}], centroid: {x:566,y:240} },
      { id: 17, number: 7, color_hex: '#90BE6D', is_filled: false, polygon: [{x:585,y:185},{x:650,y:130},{x:670,y:180},{x:615,y:230}], centroid: {x:630,y:181} },
    ];
    const basePalette = [
      { number: 1, hex: '#E63946', name: 'Ruby Crimson' },
      { number: 2, hex: '#F4A261', name: 'Warm Apricot' },
      { number: 3, hex: '#E76F51', name: 'Coral Rust' },
      { number: 4, hex: '#2A9D8F', name: 'Emerald Teal' },
      { number: 5, hex: '#48CAE4', name: 'Sky Blue' },
      { number: 6, hex: '#0077B6', name: 'Deep Cerulean' },
      { number: 7, hex: '#90BE6D', name: 'Fresh Lime' },
      { number: 8, hex: '#43AA8B', name: 'Jade Green' },
      { number: 9, hex: '#577590', name: 'Slate Feather' },
    ];
    this.artwork = {
      id: id || 'hummingbird',
      title: 'Origami Hummingbird',
      artist: 'Geometric Fauna',
      width: 800,
      height: 800,
      palette: basePalette.map(p => ({
        ...p,
        total_count: regions.filter(r => r.number === p.number).length,
        filled_count: 0,
        is_completed: false,
      })),
      regions,
    };
    this.precomputeBboxes(this.artwork);
    this.activeNumber = this.artwork.palette[0]?.number || 1;
    this.fit_to_screen();
    this.dirty = true;
  }

  load_procedural_mosaic(seed, paletteType) {
    const palettes = {
      sunset: ['#FF5964', '#F48668', '#F7D070', '#E2847A', '#805E73', '#4D4861', '#352D39'],
      emerald: ['#2EC4B6', '#0E9594', '#006466', '#212F45', '#70C1B3', '#B2DBBF', '#F3FFBD'],
      neon: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#1A535C', '#FF9F1C', '#9D4EDD', '#F72585'],
    };
    const colors = palettes[paletteType] || palettes.neon;
    let state = Math.max(1, seed | 0);
    const rand = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const cols = 8, rows = 8, w = 800, h = 800, cw = w / cols, ch = h / rows;
    const pts = [];
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        pts.push({
          x: c * cw + (c === 0 || c === cols ? 0 : (rand() - 0.5) * cw * 0.6),
          y: r * ch + (r === 0 || r === rows ? 0 : (rand() - 0.5) * ch * 0.6),
        });
      }
    }
    const regions = [];
    let regId = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p00 = pts[r * (cols + 1) + c];
        const p10 = pts[r * (cols + 1) + c + 1];
        const p01 = pts[(r + 1) * (cols + 1) + c];
        const p11 = pts[(r + 1) * (cols + 1) + c + 1];
        for (const poly of [[p00, p10, p11], [p00, p11, p01]]) {
          const ci = Math.floor(rand() * colors.length);
          regions.push({
            id: regId++,
            number: ci + 1,
            polygon: poly,
            centroid: { x: (poly[0].x + poly[1].x + poly[2].x) / 3, y: (poly[0].y + poly[1].y + poly[2].y) / 3 },
            color_hex: colors[ci],
            is_filled: false,
            fill_anim: 0,
          });
        }
      }
    }
    const palette = colors
      .map((hex, i) => ({
        number: i + 1,
        hex,
        name: `Color #${i + 1}`,
        total_count: regions.filter(r => r.number === i + 1).length,
        filled_count: 0,
        is_completed: false,
      }))
      .filter(p => p.total_count > 0);
    this.artwork = { id: `mosaic_${seed}_${paletteType}`, title: `Surprise Mosaic #${seed % 1000}`, artist: 'Surprise Pattern', width: w, height: h, palette, regions };
    this.precomputeBboxes(this.artwork);
    this.undoStack = [];
    this.lineArtImage = null;
    this.activeNumber = palette[0]?.number || 1;
    this.fit_to_screen();
    this.dirty = true;
  }

  set_line_art_image(img) {
    this.lineArtImage = img || null;
    this.dirty = true;
  }

  ensureHatchPattern() {
    if (this.hatchPattern) return this.hatchPattern;
    const tile = document.createElement('canvas');
    tile.width = 10;
    tile.height = 10;
    const tctx = tile.getContext('2d');
    tctx.fillStyle = '#E8EEF5';
    tctx.fillRect(0, 0, 10, 10);
    tctx.strokeStyle = 'rgba(100, 116, 139, 0.32)';
    tctx.lineWidth = 1.6;
    tctx.beginPath();
    tctx.moveTo(-2, 12);
    tctx.lineTo(12, -2);
    tctx.moveTo(-2, 2);
    tctx.lineTo(2, -2);
    tctx.moveTo(8, 12);
    tctx.lineTo(12, 8);
    tctx.stroke();
    this.hatchPattern = this.ctx.createPattern(tile, 'repeat');
    return this.hatchPattern;
  }

  traceRegionPath(ctx, region) {
    if (!region.polygon || region.polygon.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(region.polygon[0].x, region.polygon[0].y);
    for (let i = 1; i < region.polygon.length; i++) {
      ctx.lineTo(region.polygon[i].x, region.polygon[i].y);
    }
    ctx.closePath();
    if (region.holes) {
      for (const hole of region.holes) {
        if (hole.length >= 3) {
          ctx.moveTo(hole[0].x, hole[0].y);
          for (let i = 1; i < hole.length; i++) {
            ctx.lineTo(hole[i].x, hole[i].y);
          }
          ctx.closePath();
        }
      }
    }
  }

  load_artwork_json(jsonStr) {
    try {
      this.artwork = JSON.parse(jsonStr);
      this.precomputeBboxes(this.artwork);
      this.undoStack = [];
      this.activeNumber = (this.artwork.palette && this.artwork.palette[0]?.number) || 1;
      this.fit_to_screen();
      this.dirty = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  fit_to_screen() {
    const margin = 40;
    const availW = Math.max(100, this.viewportW - margin * 2);
    const availH = Math.max(100, this.viewportH - margin * 2);
    const s = Math.min(availW / this.artwork.width, availH / this.artwork.height, 1.2);
    this.targetScale = s;
    this.targetPanX = (this.viewportW - this.artwork.width * s) / 2;
    this.targetPanY = (this.viewportH - this.artwork.height * s) / 2;
    this.dirty = true;
  }

  update_pan_zoom(dx, dy, factor, ax, ay) {
    const oldS = this.targetScale;
    const newS = Math.min(Math.max(oldS * factor, 0.1), 10.0);
    const wx = (ax - this.targetPanX) / oldS;
    const wy = (ay - this.targetPanY) / oldS;
    this.targetScale = newS;
    this.targetPanX = ax - wx * newS + dx;
    this.targetPanY = ay - wy * newS + dy;
    this.dirty = true;
  }

  select_number(num) {
    this.activeNumber = num;
    this.hintRegionId = null;
    this.dirty = true;
  }

  toggle_outlines() {
    this.showOutlines = !this.showOutlines;
    this.dirty = true;
    return this.showOutlines;
  }

  toggle_matching_hints() {
    this.highlightMatchingTiles = !this.highlightMatchingTiles;
    this.dirty = true;
    return this.highlightMatchingTiles;
  }

  set_matching_hints(val) {
    this.highlightMatchingTiles = val;
    this.dirty = true;
  }

  get_matching_hints() {
    return this.highlightMatchingTiles;
  }

  handle_erase(sx, sy) {
    const wx = (sx - this.panX) / this.scale;
    const wy = (sy - this.panY) / this.scale;

    const idx = this.artwork.regions.findLastIndex(r => {
      if (!r.polygon || r.polygon.length < 3) return false;
      const bbox = r._bbox;
      if (bbox && (wx < bbox[0] - 1 || wx > bbox[2] + 1 || wy < bbox[1] - 1 || wy > bbox[3] + 1)) {
        return false;
      }
      if (!this.pointInPoly(wx, wy, r.polygon)) return false;
      if (r.holes) {
        for (const hole of r.holes) {
          if (this.pointInPoly(wx, wy, hole)) return false;
        }
      }
      return true;
    });

    if (idx !== -1) {
      const reg = this.artwork.regions[idx];
      if (reg.is_filled) {
        reg.is_filled = false;
        const pal = this.artwork.palette.find(p => p.number === reg.number);
        if (pal) {
          if (pal.filled_count > 0) pal.filled_count--;
          pal.is_completed = false;
        }
        this.spawnBurst(reg.centroid.x, reg.centroid.y, '#94A3B8');
        this.dirty = true;
        const filled = this.artwork.regions.filter(r => r.is_filled).length;
        const total = Math.max(1, this.artwork.regions.length);
        return JSON.stringify({
          success: true,
          region_id: reg.id,
          number: reg.number,
          total_filled: filled,
          total_regions: this.artwork.regions.length,
          percent: (filled / total) * 100,
        });
      }
    }
    return JSON.stringify({ success: false });
  }

  undo_last() {
    const indices = this.undoStack.pop();
    if (!indices || indices.length === 0) return JSON.stringify({ success: false });
    let undoneNum = null;
    for (const idx of indices) {
      const r = this.artwork.regions[idx];
      if (r && r.is_filled) {
        r.is_filled = false;
        undoneNum = r.number;
        const pal = this.artwork.palette.find(p => p.number === r.number);
        if (pal) {
          pal.filled_count = Math.max(0, pal.filled_count - 1);
          pal.is_completed = pal.filled_count >= pal.total_count;
        }
      }
    }
    if (undoneNum !== null) {
      this.activeNumber = undoneNum;
      this.dirty = true;
    }
    const filled = this.artwork.regions.filter(r => r.is_filled).length;
    const total = Math.max(1, this.artwork.regions.length);
    return JSON.stringify({
      success: undoneNum !== null,
      number: undoneNum,
      correct_number: this.activeNumber,
      total_filled: filled,
      total_regions: this.artwork.regions.length,
      percent: (filled / total) * 100,
    });
  }

  clear_all_tiles() {
    this.artwork.regions.forEach(r => {
      r.is_filled = false;
    });
    this.artwork.palette.forEach(p => {
      p.filled_count = 0;
      p.is_completed = false;
    });
    this.undoStack = [];
    this.dirty = true;
    const total = this.artwork.regions.length;
    return JSON.stringify({
      success: true,
      total_filled: 0,
      total_regions: total,
      percent: 0,
    });
  }

  trigger_hint() {
    const uncompleted = this.artwork.regions.find(r => !r.is_filled && r.number === this.activeNumber);
    if (uncompleted) {
      this.hintRegionId = uncompleted.id;
      const isDiamond = this.artwork.id.includes('diamond') || (this.artwork.regions.length > 300 && this.artwork.regions[0] && this.artwork.regions[0].polygon.length === 4);
      let drillWorldSize = 16.0;
      if (isDiamond && this.artwork.regions.length > 0) {
        const reg0 = this.artwork.regions[0];
        if (reg0.polygon && reg0.polygon.length >= 2) {
          const dx = Math.abs(reg0.polygon[1].x - reg0.polygon[0].x);
          if (dx > 0.01) drillWorldSize = dx;
        }
      }
      let targetS = 1.8;
      if (isDiamond) {
        targetS = Math.min(5.0, Math.max(1.8, 24.0 / drillWorldSize));
      } else if (uncompleted.label_radius && uncompleted.label_radius > 0.5) {
        const d = Math.max(4, uncompleted.label_radius * 2);
        targetS = Math.min(4.5, Math.max(1.35, 26.0 / d));
      } else {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        if (uncompleted.polygon) {
          for (let i = 0; i < uncompleted.polygon.length; i++) {
            const pt = uncompleted.polygon[i];
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
          }
        }
        const span = Math.max(4, Math.min(maxX - minX, maxY - minY));
        targetS = Math.min(4.5, Math.max(1.35, 32.0 / span));
      }
      this.targetScale = targetS;
      const cw = this.canvas.width / (window.devicePixelRatio || 1);
      const ch = this.canvas.height / (window.devicePixelRatio || 1);
      this.targetPanX = cw / 2 - uncompleted.centroid.x * targetS;
      this.targetPanY = ch / 2 - uncompleted.centroid.y * targetS;
      return JSON.stringify(uncompleted.centroid);
    }
    return 'null';
  }

  fill_all_of_current() {
    const filledIndices = [];
    this.artwork.regions.forEach((r, idx) => {
      if (!r.is_filled && r.number === this.activeNumber) {
        r.is_filled = true;
        filledIndices.push(idx);
      }
    });
    const count = filledIndices.length;
    if (count > 0) {
      this.undoStack.push(filledIndices);
      if (this.undoStack.length > 100) this.undoStack.shift();
      this.dirty = true;
    }
    const pal = this.artwork.palette.find(p => p.number === this.activeNumber);
    if (pal) {
      pal.filled_count = pal.total_count;
      pal.is_completed = true;
    }
    const filled = this.artwork.regions.filter(r => r.is_filled).length;
    const total = this.artwork.regions.length;
    const nextPal = this.artwork.palette.find(p => !p.is_completed);
    if (nextPal) this.activeNumber = nextPal.number;

    return JSON.stringify({
      success: count > 0,
      color_completed: count > 0,
      artwork_completed: total > 0 && filled === total,
      total_filled: filled,
      total_regions: total,
      percent: (filled / Math.max(1, total)) * 100,
      number: this.activeNumber,
    });
  }

  handle_tap(sx, sy) {
    const wx = (sx - this.panX) / this.scale;
    const wy = (sy - this.panY) / this.scale;

    // Fast O(1) grid check for Diamond Art, fallback to bounding box + poly check
    let idx = -1;
    const isDiamond = this.artwork.id && this.artwork.id.includes('diamond');
    const totalReg = this.artwork.regions.length;
    if (isDiamond && totalReg >= 100) {
      const nSide = Math.round(Math.sqrt(totalReg));
      if (nSide * nSide === totalReg && this.artwork.regions[0].polygon) {
        const margin = this.artwork.regions[0].polygon[0].x;
        const cellSize = (this.artwork.width - margin * 2) / nSide;
        if (wx >= margin && wx < this.artwork.width - margin && wy >= margin && wy < this.artwork.height - margin) {
          const c = Math.floor((wx - margin) / cellSize);
          const r = Math.floor((wy - margin) / cellSize);
          if (c >= 0 && c < nSide && r >= 0 && r < nSide) {
            const probeIdx = r * nSide + c;
            if (probeIdx < totalReg) idx = probeIdx;
          }
        }
      }
    }

    if (idx === -1) {
      idx = this.artwork.regions.findLastIndex(r => {
        if (!r.polygon || r.polygon.length < 3) return false;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (let i = 0; i < r.polygon.length; i++) {
          const pt = r.polygon[i];
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        }
        if (wx < minX - 1 || wx > maxX + 1 || wy < minY - 1 || wy > maxY + 1) return false;
        if (!this.pointInPoly(wx, wy, r.polygon)) return false;
        if (r.holes) {
          for (const hole of r.holes) {
            if (this.pointInPoly(wx, wy, hole)) return false;
          }
        }
        return true;
      });
    }

    if (idx === -1 || !this.artwork.regions[idx] || this.artwork.regions[idx].is_filled || this.artwork.regions[idx].number !== this.activeNumber) {
      const snapR = 7.0 / Math.max(0.1, this.scale);
      let bestSnapIdx = -1;
      let bestDistSq = Infinity;
      for (let i = this.artwork.regions.length - 1; i >= 0; i--) {
        const r = this.artwork.regions[i];
        if (r.is_filled || r.number !== this.activeNumber || !r.polygon || r.polygon.length < 3) continue;
        const b = r._bbox;
        if (b && (wx < b[0] - snapR || wx > b[2] + snapR || wy < b[1] - snapR || wy > b[3] + snapR)) continue;
        const dx = r.centroid.x - wx;
        const dy = r.centroid.y - wy;
        const dSq = dx * dx + dy * dy;
        let hit = false;
        const probeR = snapR;
        const offsets = [
          [probeR, 0], [-probeR, 0], [0, probeR], [0, -probeR],
          [probeR * 0.7, probeR * 0.7], [-probeR * 0.7, probeR * 0.7],
          [probeR * 0.7, -probeR * 0.7], [-probeR * 0.7, -probeR * 0.7],
        ];
        for (const [ox, oy] of offsets) {
          const px = wx + ox, py = wy + oy;
          if (this.pointInPoly(px, py, r.polygon)) {
            let inHole = false;
            if (r.holes) {
              for (const hole of r.holes) {
                if (this.pointInPoly(px, py, hole)) { inHole = true; break; }
              }
            }
            if (!inHole) { hit = true; break; }
          }
        }
        if (hit && dSq < bestDistSq) {
          bestDistSq = dSq;
          bestSnapIdx = i;
        }
      }
      if (bestSnapIdx !== -1) {
        idx = bestSnapIdx;
      }
    }

    if (idx !== -1) {
      const reg = this.artwork.regions[idx];
      if (!reg.is_filled) {
        if (reg.number === this.activeNumber) {
          reg.is_filled = true;
          this.undoStack.push([idx]);
          if (this.undoStack.length > 100) this.undoStack.shift();
          this.dirty = true;

          const pal = this.artwork.palette.find(p => p.number === this.activeNumber);
          let colComp = false;
          if (pal) {
            pal.filled_count++;
            if (pal.filled_count >= pal.total_count) {
              pal.is_completed = true;
              colComp = true;
              const nextPal = this.artwork.palette.find(p => !p.is_completed);
              if (nextPal) this.activeNumber = nextPal.number;
            }
          }

          const filled = this.artwork.regions.filter(r => r.is_filled).length;
          const total = this.artwork.regions.length;

          return JSON.stringify({
            success: true,
            region_id: reg.id,
            number: reg.number,
            color_completed: colComp,
            artwork_completed: total > 0 && filled === total,
            total_filled: filled,
            total_regions: total,
            percent: (filled / Math.max(1, total)) * 100,
          });
        } else {
          return JSON.stringify({
            success: false,
            region_id: reg.id,
            number: reg.number,
            correct_number: this.activeNumber,
          });
        }
      }
    }
    return JSON.stringify({ success: false });
  }

  pointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  spawnBurst(x, y, color) {
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const spd = 2 + Math.random() * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color,
        life: 1.0,
      });
    }
  }

  render(timestamp) {
    const dt = this.lastTime ? Math.min((timestamp - this.lastTime) / 1000, 0.1) : 0.016;
    this.lastTime = timestamp;
    this.pulsePhase += dt * 3.5;

    this.panX += (this.targetPanX - this.panX) * Math.min(dt * 10, 1);
    this.panY += (this.targetPanY - this.panY) * Math.min(dt * 10, 1);
    this.scale += (this.targetScale - this.scale) * Math.min(dt * 10, 1);

    const w = this.viewportW;
    const h = this.viewportH;

    this.ctx.clearRect(0, 0, w, h);
    this.ctx.save();
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.scale, this.scale);

    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.artwork.width, this.artwork.height);
    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    this.ctx.lineWidth = 1.5 / Math.max(0.25, this.scale);
    this.ctx.strokeRect(0, 0, this.artwork.width, this.artwork.height);

    const pulse = Math.sin(this.pulsePhase) * 0.5 + 0.5;
    const isDiamond = this.is_diamond_mode;

    const pad = 24 / Math.max(0.1, this.scale);
    const viewMinX = -this.panX / this.scale - pad;
    const viewMaxX = (w - this.panX) / this.scale + pad;
    const viewMinY = -this.panY / this.scale - pad;
    const viewMaxY = (h - this.panY) / this.scale + pad;

    // Calculate drill world size and screen size for diamond art
    let drillWorldSize = 16.0;
    if (isDiamond && this.artwork.regions.length > 0) {
      const reg0 = this.artwork.regions[0];
      if (reg0.polygon && reg0.polygon.length >= 2) {
        const dx = Math.abs(reg0.polygon[1].x - reg0.polygon[0].x);
        if (dx > 0.01) drillWorldSize = dx;
      }
    }
    const drillScreenSize = drillWorldSize * this.scale;
    const canDrawOutlines = this.showOutlines && (!isDiamond || drillScreenSize >= 3.5);

    const hasLineArt = !!(this.lineArtImage && this.lineArtImage.complete && this.lineArtImage.naturalWidth > 0);
    const hatchPat = !isDiamond ? this.ensureHatchPattern() : null;

    // Render regions with frustum culling and fillRect fast-path
    for (const region of this.artwork.regions) {
      if (!region.polygon || region.polygon.length < 3) continue;
      const cx = region.centroid.x, cy = region.centroid.y;
      if (isDiamond) {
        if (cx < viewMinX || cx > viewMaxX || cy < viewMinY || cy > viewMaxY) continue;
      } else if (region._bbox) {
        const b = region._bbox;
        if (b[2] < viewMinX || b[0] > viewMaxX || b[3] < viewMinY || b[1] > viewMaxY) continue;
      }

      const isHinted = region.id === this.hintRegionId;
      const isActiveNumber = region.number === this.activeNumber;
      const isActiveTarget = this.highlightMatchingTiles && isActiveNumber;
      const isQuad = isDiamond && region.polygon.length === 4;
      const p0 = region.polygon[0];
      const p1 = region.polygon[1];
      const p2 = region.polygon[2];
      const p3 = region.polygon[3];
      const cellW = p1.x - p0.x;
      const cellH = p2.y - p1.y;

      if (!isQuad) {
        this.traceRegionPath(this.ctx, region);
      }

      if (region.is_filled) {
        this.ctx.fillStyle = region.color_hex;
        if (isQuad) {
          this.ctx.fillRect(p0.x, p0.y, cellW, cellH);
        } else {
          this.ctx.fill('evenodd');
          this.ctx.strokeStyle = region.color_hex;
          this.ctx.lineWidth = hasLineArt ? 0.8 : (1.4 / Math.max(0.5, this.scale));
          this.ctx.stroke();
        }

        if (isQuad && drillScreenSize >= 10.0) {
          this.ctx.beginPath();
          this.ctx.moveTo(p0.x, p0.y);
          this.ctx.lineTo(p1.x, p1.y);
          this.ctx.lineTo(p3.x, p3.y);
          this.ctx.closePath();
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
          this.ctx.fill();

          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.lineTo(p3.x, p3.y);
          this.ctx.closePath();
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
          this.ctx.fill();
        }
      } else {
        if (isHinted) {
          this.ctx.fillStyle = `rgba(255, 215, 0, ${0.45 + pulse * 0.35})`;
        } else if (!isDiamond && isActiveNumber) {
          this.ctx.fillStyle = hatchPat || '#E2E8F0';
        } else {
          this.ctx.fillStyle = isActiveTarget ? `rgba(99, 102, 241, ${0.16 + pulse * 0.12})` : '#F8FAFC';
        }
        if (isQuad) {
          this.ctx.fillRect(p0.x, p0.y, cellW, cellH);
        } else {
          this.ctx.fill('evenodd');
          if (!isHinted && isActiveNumber && isActiveTarget) {
            this.ctx.fillStyle = `rgba(99, 102, 241, ${0.14 + pulse * 0.12})`;
            this.ctx.fill('evenodd');
          }
        }
      }

      if (canDrawOutlines) {
        if (isHinted) {
          this.ctx.strokeStyle = '#F59E0B';
          this.ctx.lineWidth = 2.5 / Math.max(0.5, this.scale);
          if (isQuad) this.ctx.strokeRect(p0.x, p0.y, cellW, cellH); else this.ctx.stroke();
        } else if (isDiamond) {
          this.ctx.strokeStyle = isActiveTarget ? 'rgba(99, 102, 241, 0.6)' : 'rgba(148, 163, 184, 0.35)';
          this.ctx.lineWidth = (isActiveTarget ? 1.2 : 0.7) / Math.max(0.5, this.scale);
          if (isQuad) this.ctx.strokeRect(p0.x, p0.y, cellW, cellH); else this.ctx.stroke();
        } else if (!hasLineArt) {
          this.ctx.strokeStyle = isActiveTarget ? 'rgba(99, 102, 241, 0.6)' : 'rgba(30, 41, 59, 0.72)';
          this.ctx.lineWidth = (isActiveTarget ? 1.2 : 1.6) / Math.max(0.5, this.scale);
          this.ctx.stroke();
        } else if (!region.is_filled) {
          this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.42)';
          this.ctx.lineWidth = 0.8 / Math.max(0.5, this.scale);
          this.ctx.stroke();
        }
      }
    }

    // Composite crisp ink line-art overlay directly above fills and below numbers
    if (hasLineArt) {
      this.ctx.drawImage(this.lineArtImage, 0, 0, this.artwork.width, this.artwork.height);
    }

    // Render numbers
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    let lastFont = '';
    let lastFill = '';

    for (const region of this.artwork.regions) {
      if (region.is_filled) continue;
      const cx = region.centroid.x, cy = region.centroid.y;
      if (cx < viewMinX || cx > viewMaxX || cy < viewMinY || cy > viewMaxY) continue;

      const isHinted = region.id === this.hintRegionId;
      const isActiveTarget = this.highlightMatchingTiles && (region.number === this.activeNumber);

      let regionWorldSize = drillWorldSize;
      let regionScreenSize = drillScreenSize;
      if (!isDiamond) {
        if (region.label_radius && region.label_radius > 0.5) {
          regionWorldSize = region.label_radius * 2.0;
          regionScreenSize = regionWorldSize * this.scale;
        } else if (region._bbox) {
          const b = region._bbox;
          regionWorldSize = Math.min(Math.max(1, b[2] - b[0]), Math.max(1, b[3] - b[1]));
          regionScreenSize = regionWorldSize * this.scale;
        }
      }

      if (isHinted) {
        const ringR = isDiamond
          ? Math.max(12 / this.scale, drillWorldSize * (0.85 + pulse * 0.25))
          : Math.min(28 / this.scale, Math.max(10 / this.scale, regionWorldSize * 0.65));
        const ringW = isDiamond
          ? Math.min(drillWorldSize * 0.22, 2.2 / this.scale)
          : Math.min(regionWorldSize * 0.2, 2.4 / this.scale);
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#F59E0B';
        this.ctx.lineWidth = ringW;
        this.ctx.stroke();
      }

      const minScreenForText = isDiamond ? 13.0 : 7.5;
      if (regionScreenSize < minScreenForText) {
        if (isHinted || isActiveTarget) {
          const dotR = Math.max(1.2 / this.scale, Math.min(3.5 / this.scale, regionWorldSize * 0.35));
          this.ctx.beginPath();
          this.ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
          const fc = isHinted ? '#F59E0B' : 'rgba(99, 102, 241, 0.85)';
          if (fc !== lastFill) { this.ctx.fillStyle = fc; lastFill = fc; }
          this.ctx.fill();
        }
      } else {
        const digits = region.number >= 100 ? 3 : (region.number >= 10 ? 2 : 1);
        const fontScale = digits >= 3 ? 0.34 : (digits === 2 ? 0.44 : 0.56);
        const maxFontWorld = (isDiamond ? 15 : 20) / this.scale;
        const baseFont = Math.min(maxFontWorld, regionWorldSize * fontScale);
        const fontSize = isDiamond
          ? (isHinted ? Math.min(drillWorldSize * 0.68, drillWorldSize * fontScale * 1.15) : drillWorldSize * fontScale)
          : (isHinted ? Math.min(regionWorldSize * 0.56, baseFont * 1.12) : baseFont);
        const fontStr = `${isHinted || isActiveTarget ? 'bold' : '600'} ${fontSize.toFixed(2)}px 'Outfit', sans-serif`;
        if (fontStr !== lastFont) { this.ctx.font = fontStr; lastFont = fontStr; }
        const fc = isHinted ? '#B45309' : (isActiveTarget ? '#3730A3' : (isDiamond ? 'rgba(71, 85, 105, 0.78)' : 'rgba(30, 41, 59, 0.88)'));
        if (fc !== lastFill) { this.ctx.fillStyle = fc; lastFill = fc; }
        this.ctx.fillText(String(region.number), cx, cy);
      }
    }

    // Frame-rate independent particles
    const dtScale = dt * 60;
    const drag = Math.pow(0.96, dtScale);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dtScale;
      p.y += p.vy * dtScale;
      p.vy += 0.08 * dtScale;
      p.vx *= drag;
      p.life -= dt * 1.5;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, Math.max(1, 4 * p.life), 0, Math.PI * 2);
        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = p.life;
        this.ctx.fill();
      }
    }
    this.ctx.globalAlpha = 1.0;

    this.ctx.restore();
    this.dirty = false;
  }

  get_palette_json() {
    return JSON.stringify(this.artwork.palette);
  }

  _segmentIntersectsRect(x1, y1, x2, y2, minX, minY, maxX, maxY) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let t0 = 0;
    let t1 = 1;
    const checks = [
      [-dx, x1 - minX],
      [dx, maxX - x1],
      [-dy, y1 - minY],
      [dy, maxY - y1],
    ];
    for (const [p, q] of checks) {
      if (Math.abs(p) < 1e-12) {
        if (q < 0) return false;
      } else {
        const r = q / p;
        if (p < 0) {
          if (r > t1) return false;
          if (r > t0) t0 = r;
        } else {
          if (r < t0) return false;
          if (r < t1) t1 = r;
        }
      }
    }
    return t0 <= t1;
  }

  _regionIntersectsRect(region, minX, minY, maxX, maxY, cxView, cyView) {
    const cx = region.centroid.x;
    const cy = region.centroid.y;
    if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) return true;

    const poly = region.polygon;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const pt = poly[i];
      if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) return true;
    }
    for (let i = 0; i < n; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % n];
      if (this._segmentIntersectsRect(p1.x, p1.y, p2.x, p2.y, minX, minY, maxX, maxY)) return true;
    }
    if (!this.pointInPoly(cxView, cyView, poly)) return false;
    if (region.holes) {
      for (const hole of region.holes) {
        if (this.pointInPoly(cxView, cyView, hole)) return false;
      }
    }
    return true;
  }

  get_visible_unfilled_numbers_json() {
    const panX = this.lastTime > 0 ? this.panX : this.targetPanX;
    const panY = this.lastTime > 0 ? this.panY : this.targetPanY;
    const scale = this.lastTime > 0 ? this.scale : this.targetScale;
    const w = this.viewportW;
    const h = this.viewportH;

    if (scale <= 0 || w <= 0 || h <= 0) {
      return JSON.stringify(this.artwork.palette.filter(p => !p.is_completed).map(p => p.number));
    }

    const incompleteTotal = this.artwork.palette.filter(p => !p.is_completed).length;
    if (incompleteTotal === 0) return '[]';

    const viewMinX = -panX / scale;
    const viewMaxX = (w - panX) / scale;
    const viewMinY = -panY / scale;
    const viewMaxY = (h - panY) / scale;
    const cxView = (viewMinX + viewMaxX) * 0.5;
    const cyView = (viewMinY + viewMaxY) * 0.5;

    const seen = new Set();
    const isDiamond = this.is_diamond_mode;

    for (const region of this.artwork.regions) {
      if (region.is_filled) continue;
      if (seen.has(region.number)) continue;
      if (!region.polygon || region.polygon.length < 3) continue;

      if (region._bbox) {
        const b = region._bbox;
        if (b[2] < viewMinX || b[0] > viewMaxX || b[3] < viewMinY || b[1] > viewMaxY) continue;
      }

      const isVisible = isDiamond
        ? true
        : this._regionIntersectsRect(region, viewMinX, viewMinY, viewMaxX, viewMaxY, cxView, cyView);

      if (isVisible) {
        seen.add(region.number);
        if (seen.size >= incompleteTotal) break;
      }
    }

    return JSON.stringify(
      this.artwork.palette
        .filter(p => !p.is_completed && seen.has(p.number))
        .map(p => p.number)
    );
  }

  get_artwork_info_json() {
    return JSON.stringify({
      id: this.artwork.id,
      title: this.artwork.title,
      artist: this.artwork.artist,
      width: this.artwork.width,
      height: this.artwork.height,
      active_number: this.activeNumber,
      total_regions: this.artwork.regions.length,
      filled_regions: this.artwork.regions.filter(r => r.is_filled).length,
    });
  }

  get_artwork_json() {
    return JSON.stringify(this.artwork);
  }

  render_export(ctx, width, height, force_all_filled = false) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    const artW = this.artwork.width || 800;
    const artH = this.artwork.height || 800;
    const s = Math.min(width / artW, height / artH);
    const ox = (width - artW * s) / 2;
    const oy = (height - artH * s) / 2;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);

    const isDiamond = this.is_diamond_mode;
    const hasLineArt = !!(this.lineArtImage && this.lineArtImage.complete && this.lineArtImage.naturalWidth > 0);

    for (const region of this.artwork.regions) {
      if (!region.polygon || region.polygon.length < 3) continue;

      const isFilled = region.is_filled || force_all_filled;
      const isQuad = isDiamond && region.polygon.length === 4;
      const p0 = region.polygon[0];
      const p1 = region.polygon[1];
      const p2 = region.polygon[2] || p0;
      const p3 = region.polygon[3] || p0;
      const cellW = p1.x - p0.x;
      const cellH = p2.y - p1.y;

      if (isFilled) {
        ctx.fillStyle = region.color_hex;
        if (isQuad) {
          ctx.fillRect(p0.x, p0.y, cellW, cellH);
        } else {
          this.traceRegionPath(ctx, region);
          ctx.fill('evenodd');
          ctx.strokeStyle = region.color_hex;
          ctx.lineWidth = hasLineArt ? 0.8 : Math.max(0.8, 1.5 / s);
          ctx.stroke();
        }

        // 3D Diamond facet highlights
        if (isQuad && (cellW * s) >= 8) {
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.closePath();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.closePath();
          ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#F8FAFC';
        if (isQuad) {
          ctx.fillRect(p0.x, p0.y, cellW, cellH);
        } else {
          this.traceRegionPath(ctx, region);
          ctx.fill('evenodd');
        }
      }

      if (this.showOutlines) {
        if (isDiamond) {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
          ctx.lineWidth = Math.max(0.5, 0.7 / s);
          if (isQuad) {
            ctx.strokeRect(p0.x, p0.y, cellW, cellH);
          } else {
            this.traceRegionPath(ctx, region);
            ctx.stroke();
          }
        } else if (!hasLineArt) {
          ctx.strokeStyle = 'rgba(30, 41, 59, 0.72)';
          ctx.lineWidth = Math.max(1.0, 1.8 / s);
          this.traceRegionPath(ctx, region);
          ctx.stroke();
        } else if (!isFilled) {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
          ctx.lineWidth = Math.max(0.4, 0.7 / s);
          this.traceRegionPath(ctx, region);
          ctx.stroke();
        }
      }
    }

    if (hasLineArt) {
      ctx.drawImage(this.lineArtImage, 0, 0, artW, artH);
    }

    ctx.restore();
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  const app = new TapColorApp();
  app.init();
  window.tapColorApp = app;
});
