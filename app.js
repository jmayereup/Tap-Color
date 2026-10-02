// Tap Color • WebAssembly Application Engine

class SoundController {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    // Pentatonic scale frequencies for harmonic satisfaction
    this.scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTap(colorIndex = 1) {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const freq = this.scale[(colorIndex - 1) % this.scale.length];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.02, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.36);
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

  playColorComplete() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const chords = [523.25, 659.25, 783.99, 1046.50]; // C Major
    chords.forEach((freq, idx) => {
      setTimeout(() => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.51);
      }, idx * 75);
    });
  }

  playVictory() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const notes = [392.00, 523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.9);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.95);
      }, idx * 110);
    });
  }
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
    this.initialPinchDistance = 0;
    this.currentArtworkId = 'hummingbird';
    this.activeNumber = 1;
    this.hintCount = 5;

    // Statistics
    this.startTime = Date.now();
    this.totalTaps = 0;
    this.successfulTaps = 0;

    this.artworksMeta = [
      { id: 'hummingbird', title: 'Origami Hummingbird', artist: 'Geometric Fauna', desc: 'Vibrant hummingbird with cherry blossoms' },
      { id: 'cosmic_whale', title: 'Cosmic Whale & Stars', artist: 'Astral Ocean', desc: 'Ethereal whale swimming through constellations' },
      { id: 'stained_butterfly', title: 'Stained Glass Monarch', artist: 'Prism Sanctuary', desc: 'Monarch butterfly on botanical lotus' },
      { id: 'sunset_landscape', title: 'Geometric Sunset Mountains', artist: 'Low Poly Vistas', desc: 'Tranquil alpine peaks and glowing lake' },
    ];
  }

  async init() {
    this.setupCanvasDpi();
    this.bindEvents();
    this.populateGalleryModal();

    // Attempt to load compiled Rust WebAssembly module
    try {
      const wasmPath = './pkg/tap_color.js';
      const wasmModule = await import(/* @vite-ignore */ wasmPath);
      await wasmModule.default();
      this.controller = new wasmModule.GameController('game-canvas', this.currentArtworkId);
      this.isWasmActive = true;
      document.getElementById('engine-status-text').textContent = 'Rust WebAssembly Engine Active (wasm-bindgen)';
      document.getElementById('engine-status').classList.add('wasm-mode');
    } catch (e) {
      console.warn('WASM module not yet compiled or unavailable. Launching client preview engine.', e);
      document.getElementById('engine-status-text').textContent = 'WASM Ready: Run "wasm-pack build --target web"';
      document.getElementById('engine-status').classList.remove('wasm-mode');
      this.controller = new FallbackJsController(this.canvas, this.currentArtworkId);
    }

    this.updateArtworkUI();
    this.refreshPaletteUI();
    this.startRenderLoop();
  }

  setupCanvasDpi() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.viewport.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    const ctx = this.canvas.getContext('2d');
    ctx.scale(dpr, dpr);
  }

  startRenderLoop() {
    const loop = (timestamp) => {
      if (this.controller) {
        this.controller.render(timestamp);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.setupCanvasDpi();
      if (this.controller) this.controller.fit_to_screen();
    });

    // Pointer events (Mouse / Pen / Touch)
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));

    // Wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.controller) return;
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.controller.update_pan_zoom(0, 0, zoomFactor, x, y);
    }, { passive: false });

    // Touch pinch to zoom
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        this.initialPinchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && this.initialPinchDistance > 0 && this.controller) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / this.initialPinchDistance;
        this.initialPinchDistance = dist;
        const rect = this.canvas.getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        this.controller.update_pan_zoom(0, 0, factor, midX, midY);
      }
    });

    // UI Buttons
    document.getElementById('btn-sound').addEventListener('click', () => {
      this.sound.enabled = !this.sound.enabled;
      document.getElementById('btn-sound').classList.toggle('active', this.sound.enabled);
    });

    document.getElementById('btn-outline').addEventListener('click', () => {
      if (!this.controller) return;
      const visible = this.controller.toggle_outlines();
      document.getElementById('btn-outline').classList.toggle('active', visible);
    });

    document.getElementById('btn-wand').addEventListener('click', () => {
      if (!this.controller) return;
      const resJson = this.controller.fill_all_of_current();
      const res = JSON.parse(resJson);
      if (res.success) {
        this.sound.playColorComplete();
        this.onTapFeedback(res);
      }
    });

    document.getElementById('btn-hint').addEventListener('click', () => this.triggerHint());

    // Zoom buttons
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      if (!this.controller) return;
      const rect = this.canvas.getBoundingClientRect();
      this.controller.update_pan_zoom(0, 0, 1.25, rect.width / 2, rect.height / 2);
    });

    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      if (!this.controller) return;
      const rect = this.canvas.getBoundingClientRect();
      this.controller.update_pan_zoom(0, 0, 0.8, rect.width / 2, rect.height / 2);
    });

    document.getElementById('btn-zoom-reset').addEventListener('click', () => {
      if (this.controller) this.controller.fit_to_screen();
    });

    // Gallery Modal
    const modalGallery = document.getElementById('modal-gallery');
    document.getElementById('btn-gallery').addEventListener('click', () => {
      modalGallery.classList.remove('hidden');
    });

    document.getElementById('btn-close-gallery').addEventListener('click', () => {
      modalGallery.classList.add('hidden');
    });

    // Procedural Generator button
    document.getElementById('btn-generate-mosaic').addEventListener('click', () => {
      const palette = document.getElementById('select-mosaic-palette').value;
      const seed = Math.floor(Math.random() * 100000);
      if (this.controller) {
        this.controller.load_procedural_mosaic(seed, palette);
        modalGallery.classList.add('hidden');
        this.updateArtworkUI();
        this.refreshPaletteUI();
      }
    });

    // Victory Modal actions
    const modalVictory = document.getElementById('modal-victory');
    document.getElementById('btn-export-png').addEventListener('click', () => {
      this.exportArtworkPng();
    });

    document.getElementById('btn-next-artwork').addEventListener('click', () => {
      modalVictory.classList.add('hidden');
      const curIdx = this.artworksMeta.findIndex(a => a.id === this.currentArtworkId);
      const nextIdx = (curIdx + 1) % this.artworksMeta.length;
      this.selectArtwork(this.artworksMeta[nextIdx].id);
    });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        this.triggerHint();
      } else if (e.key === 'f' || e.key === 'F') {
        if (this.controller) this.controller.fit_to_screen();
      } else if (e.key === 'o' || e.key === 'O') {
        document.getElementById('btn-outline').click();
      } else if (/^[1-9]$/.test(e.key)) {
        const num = parseInt(e.key, 10);
        this.selectNumber(num);
      }
    });
  }

  onPointerDown(e) {
    this.isDragging = true;
    this.dragDistance = 0;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  }

  onPointerMove(e) {
    if (!this.isDragging || !this.controller) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.dragDistance += Math.hypot(dx, dy);
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    const rect = this.canvas.getBoundingClientRect();
    this.controller.update_pan_zoom(dx, dy, 1.0, rect.width / 2, rect.height / 2);
  }

  onPointerUp(e) {
    if (!this.isDragging) return;
    this.isDragging = false;

    // If movement is under 6px, treat as clean tap!
    if (this.dragDistance < 6 && this.controller) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.totalTaps++;
      const resJson = this.controller.handle_tap(x, y);
      const res = JSON.parse(resJson);

      if (res.success) {
        this.successfulTaps++;
        this.sound.playTap(res.number || 1);
        if (navigator.vibrate) navigator.vibrate(15);
        this.onTapFeedback(res);
      } else if (res.region_id !== undefined && res.region_id !== null) {
        this.sound.playWrong();
        // Friendly highlight on the correct number in palette
        if (res.number) {
          const item = document.querySelector(`.palette-item[data-number="${res.number}"]`);
          if (item) {
            item.classList.add('shake');
            setTimeout(() => item.classList.remove('shake'), 400);
          }
        }
      }
    }
  }

  onTapFeedback(res) {
    // Update progress bar
    const percent = Math.round(res.percent || 0);
    document.getElementById('progress-fill').style.width = `${percent}%`;
    document.getElementById('progress-text').textContent = `${percent}%`;

    // Refresh palette swatches
    this.refreshPaletteUI();

    // Check color completion chime
    if (res.color_completed && !res.artwork_completed) {
      this.sound.playColorComplete();
    }

    // Check artwork victory celebration
    if (res.artwork_completed) {
      setTimeout(() => {
        this.sound.playVictory();
        this.showVictoryModal(res.total_regions);
      }, 500);
    }
  }

  triggerHint() {
    if (!this.controller || this.hintCount <= 0) return;
    const ptJson = this.controller.trigger_hint();
    const pt = JSON.parse(ptJson);
    if (pt) {
      this.hintCount--;
      document.getElementById('hint-badge').textContent = this.hintCount;
      this.sound.playTap(this.activeNumber);
    }
  }

  selectNumber(num) {
    this.activeNumber = num;
    if (this.controller) {
      this.controller.select_number(num);
    }
    document.querySelectorAll('.palette-item').forEach(el => {
      el.classList.toggle('active', parseInt(el.dataset.number, 10) === num);
    });
  }

  refreshPaletteUI() {
    if (!this.controller) return;
    const palette = JSON.parse(this.controller.get_palette_json());
    const info = JSON.parse(this.controller.get_artwork_info_json());
    if (info.active_number) this.activeNumber = info.active_number;

    const track = document.getElementById('palette-track');
    track.innerHTML = '';

    palette.forEach(item => {
      const el = document.createElement('div');
      el.className = `palette-item ${item.number === this.activeNumber ? 'active' : ''} ${item.is_completed ? 'completed' : ''}`;
      el.dataset.number = item.number;

      const remaining = item.total_count - item.filled_count;

      el.innerHTML = `
        <div class="swatch-circle" style="background-color: ${item.hex}">
          <span class="swatch-number" style="color: ${this.getContrastTextColor(item.hex)}">${item.number}</span>
          <svg class="swatch-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <span class="swatch-count">${item.is_completed ? '✓' : remaining}</span>
      `;

      el.addEventListener('click', () => {
        this.selectNumber(item.number);
      });

      track.appendChild(el);
    });
  }

  getContrastTextColor(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? '#111827' : '#FFFFFF';
  }

  populateGalleryModal() {
    const grid = document.getElementById('artwork-grid');
    grid.innerHTML = '';

    this.artworksMeta.forEach(meta => {
      const card = document.createElement('div');
      card.className = 'artwork-card';
      card.innerHTML = `
        <h4>${meta.title}</h4>
        <p>${meta.desc}</p>
      `;
      card.addEventListener('click', () => {
        this.selectArtwork(meta.id);
        document.getElementById('modal-gallery').classList.add('hidden');
      });
      grid.appendChild(card);
    });
  }

  selectArtwork(id) {
    this.currentArtworkId = id;
    if (this.controller) {
      this.controller.load_artwork(id);
    }
    this.startTime = Date.now();
    this.totalTaps = 0;
    this.successfulTaps = 0;
    this.updateArtworkUI();
    this.refreshPaletteUI();
  }

  updateArtworkUI() {
    if (!this.controller) return;
    const info = JSON.parse(this.controller.get_artwork_info_json());
    document.getElementById('artwork-title').textContent = info.title || 'Tap Color';
    document.getElementById('artwork-artist').textContent = info.artist || 'Art Studio';
    const percent = Math.round((info.filled_regions / Math.max(1, info.total_regions)) * 100);
    document.getElementById('progress-fill').style.width = `${percent}%`;
    document.getElementById('progress-text').textContent = `${percent}%`;
  }

  showVictoryModal(totalPieces) {
    const elapsedSecs = Math.floor((Date.now() - this.startTime) / 1000);
    const mins = String(Math.floor(elapsedSecs / 60)).padStart(2, '0');
    const secs = String(elapsedSecs % 60).padStart(2, '0');

    document.getElementById('stat-time').textContent = `${mins}:${secs}`;
    document.getElementById('stat-pieces').textContent = totalPieces;
    const acc = this.totalTaps > 0 ? Math.round((this.successfulTaps / this.totalTaps) * 100) : 100;
    document.getElementById('stat-accuracy').textContent = `${acc}%`;

    document.getElementById('modal-victory').classList.remove('hidden');
  }

  exportArtworkPng() {
    // Generate clean full-resolution image download
    const link = document.createElement('a');
    link.download = `${this.currentArtworkId}_tap_color.png`;
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }
}

/**
 * Fallback client preview controller:
 * Ensures the web app opens and renders beautifully even before the user executes `wasm-pack build`.
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
    this.load_artwork(artworkId);
  }

  load_artwork(id) {
    // Built-in hummingbird representation
    this.artwork = {
      id,
      title: id === 'cosmic_whale' ? 'Cosmic Whale & Stars' : (id === 'stained_butterfly' ? 'Stained Glass Monarch' : 'Origami Hummingbird'),
      artist: 'Geometric Fauna',
      width: 800,
      height: 800,
      palette: [
        { number: 1, hex: '#E63946', name: 'Ruby Crimson', total_count: 3, filled_count: 0, is_completed: false },
        { number: 2, hex: '#F4A261', name: 'Warm Apricot', total_count: 3, filled_count: 0, is_completed: false },
        { number: 3, hex: '#E76F51', name: 'Coral Rust', total_count: 2, filled_count: 0, is_completed: false },
        { number: 4, hex: '#2A9D8F', name: 'Emerald Teal', total_count: 6, filled_count: 0, is_completed: false },
        { number: 5, hex: '#48CAE4', name: 'Sky Blue', total_count: 4, filled_count: 0, is_completed: false },
        { number: 6, hex: '#0077B6', name: 'Deep Cerulean', total_count: 4, filled_count: 0, is_completed: false },
        { number: 7, hex: '#90BE6D', name: 'Fresh Lime', total_count: 3, filled_count: 0, is_completed: false },
        { number: 8, hex: '#43AA8B', name: 'Jade Green', total_count: 3, filled_count: 0, is_completed: false },
        { number: 9, hex: '#577590', name: 'Slate Feather', total_count: 3, filled_count: 0, is_completed: false },
        { number: 10, hex: '#F72585', name: 'Sakura Pink', total_count: 4, filled_count: 0, is_completed: false },
      ],
      regions: [
        // Beak
        { id: 0, number: 9, color_hex: '#577590', is_filled: false, polygon: [{x:180,y:310},{x:330,y:335},{x:325,y:342}], centroid: {x:278,y:329} },
        { id: 1, number: 9, color_hex: '#577590', is_filled: false, polygon: [{x:180,y:310},{x:325,y:342},{x:310,y:350}], centroid: {x:271,y:334} },
        // Head
        { id: 2, number: 4, color_hex: '#2A9D8F', is_filled: false, polygon: [{x:330,y:335},{x:380,y:300},{x:395,y:330},{x:335,y:345}], centroid: {x:360,y:327} },
        { id: 3, number: 4, color_hex: '#2A9D8F', is_filled: false, polygon: [{x:380,y:300},{x:430,y:315},{x:420,y:345},{x:395,y:330}], centroid: {x:406,y:322} },
        { id: 4, number: 5, color_hex: '#48CAE4', is_filled: false, polygon: [{x:335,y:345},{x:395,y:330},{x:385,y:370}], centroid: {x:371,y:348} },
        { id: 5, number: 9, color_hex: '#577590', is_filled: false, polygon: [{x:365,y:330},{x:375,y:325},{x:380,y:335},{x:370,y:340}], centroid: {x:372,y:332} },
        // Throat
        { id: 6, number: 1, color_hex: '#E63946', is_filled: false, polygon: [{x:335,y:345},{x:385,y:370},{x:355,y:400}], centroid: {x:358,y:371} },
        { id: 7, number: 1, color_hex: '#E63946', is_filled: false, polygon: [{x:385,y:370},{x:415,y:390},{x:375,y:420},{x:355,y:400}], centroid: {x:382,y:395} },
        { id: 8, number: 2, color_hex: '#F4A261', is_filled: false, polygon: [{x:415,y:390},{x:455,y:400},{x:420,y:435},{x:375,y:420}], centroid: {x:416,y:411} },
        { id: 9, number: 3, color_hex: '#E76F51', is_filled: false, polygon: [{x:355,y:400},{x:375,y:420},{x:350,y:460}], centroid: {x:360,y:426} },
        // Wings
        { id: 10, number: 6, color_hex: '#0077B6', is_filled: false, polygon: [{x:420,y:345},{x:490,y:240},{x:460,y:340}], centroid: {x:456,y:308} },
        { id: 11, number: 5, color_hex: '#48CAE4', is_filled: false, polygon: [{x:490,y:240},{x:560,y:160},{x:515,y:255},{x:460,y:340}], centroid: {x:506,y:248} },
        { id: 12, number: 6, color_hex: '#0077B6', is_filled: false, polygon: [{x:560,y:160},{x:630,y:100},{x:585,y:185},{x:515,y:255}], centroid: {x:572,y:175} },
        { id: 13, number: 4, color_hex: '#2A9D8F', is_filled: false, polygon: [{x:630,y:100},{x:700,y:50},{x:650,y:130},{x:585,y:185}], centroid: {x:641,y:116} },
        { id: 14, number: 7, color_hex: '#90BE6D', is_filled: false, polygon: [{x:700,y:50},{x:720,y:40},{x:675,y:120},{x:650,y:130}], centroid: {x:686,y:85} },
        // Feathers & Body
        { id: 15, number: 4, color_hex: '#2A9D8F', is_filled: false, polygon: [{x:460,y:340},{x:515,y:255},{x:550,y:290},{x:485,y:375}], centroid: {x:502,y:315} },
        { id: 16, number: 8, color_hex: '#43AA8B', is_filled: false, polygon: [{x:515,y:255},{x:585,y:185},{x:615,y:230},{x:550,y:290}], centroid: {x:566,y:240} },
        { id: 17, number: 7, color_hex: '#90BE6D', is_filled: false, polygon: [{x:585,y:185},{x:650,y:130},{x:670,y:180},{x:615,y:230}], centroid: {x:630,y:181} },
        { id: 18, number: 8, color_hex: '#43AA8B', is_filled: false, polygon: [{x:485,y:375},{x:550,y:290},{x:580,y:340},{x:510,y:410}], centroid: {x:531,y:353} },
        { id: 19, number: 4, color_hex: '#2A9D8F', is_filled: false, polygon: [{x:550,y:290},{x:615,y:230},{x:640,y:280},{x:580,y:340}], centroid: {x:596,y:285} },
        { id: 20, number: 5, color_hex: '#48CAE4', is_filled: false, polygon: [{x:580,y:340},{x:640,y:280},{x:660,y:330},{x:600,y:380}], centroid: {x:620,y:332} },
        // Breast
        { id: 21, number: 2, color_hex: '#F4A261', is_filled: false, polygon: [{x:375,y:420},{x:420,y:435},{x:400,y:485},{x:350,y:460}], centroid: {x:386,y:450} },
        { id: 22, number: 3, color_hex: '#E76F51', is_filled: false, polygon: [{x:350,y:460},{x:400,y:485},{x:380,y:530},{x:335,y:495}], centroid: {x:366,y:492} },
        { id: 23, number: 1, color_hex: '#E63946', is_filled: false, polygon: [{x:335,y:495},{x:380,y:530},{x:360,y:570},{x:325,y:530}], centroid: {x:350,y:531} },
        { id: 24, number: 5, color_hex: '#48CAE4', is_filled: false, polygon: [{x:325,y:530},{x:360,y:570},{x:345,y:605},{x:315,y:560}], centroid: {x:336,y:566} },
        // Tail
        { id: 25, number: 6, color_hex: '#0077B6', is_filled: false, polygon: [{x:380,y:530},{x:415,y:535},{x:450,y:620},{x:410,y:610}], centroid: {x:413,y:573} },
        { id: 26, number: 6, color_hex: '#0077B6', is_filled: false, polygon: [{x:415,y:535},{x:455,y:520},{x:500,y:620},{x:450,y:620}], centroid: {x:455,y:573} },
        // Blossom Sakura
        { id: 27, number: 10, color_hex: '#F72585', is_filled: false, polygon: [{x:100,y:160},{x:140,y:120},{x:170,y:155},{x:135,y:185}], centroid: {x:136,y:155} },
        { id: 28, number: 10, color_hex: '#F72585', is_filled: false, polygon: [{x:140,y:120},{x:195,y:100},{x:210,y:145},{x:170,y:155}], centroid: {x:178,y:130} },
        { id: 29, number: 10, color_hex: '#F72585', is_filled: false, polygon: [{x:210,y:145},{x:260,y:150},{x:240,y:195},{x:185,y:180}], centroid: {x:223,y:167} },
        { id: 30, number: 10, color_hex: '#F72585', is_filled: false, polygon: [{x:185,y:180},{x:240,y:195},{x:210,y:240},{x:165,y:215}], centroid: {x:200,y:207} },
        { id: 31, number: 2, color_hex: '#F4A261', is_filled: false, polygon: [{x:160,y:170},{x:185,y:160},{x:185,y:180},{x:165,y:185}], centroid: {x:173,y:173} },
        { id: 32, number: 7, color_hex: '#90BE6D', is_filled: false, polygon: [{x:240,y:195},{x:300,y:210},{x:280,y:245},{x:210,y:240}], centroid: {x:257,y:222} },
        { id: 33, number: 8, color_hex: '#43AA8B', is_filled: false, polygon: [{x:210,y:240},{x:280,y:245},{x:250,y:285},{x:190,y:270}], centroid: {x:232,y:260} },
      ]
    };
    this.activeNumber = 1;
    this.fit_to_screen();
  }

  load_procedural_mosaic(seed, paletteType) {
    // Generate simple procedural grid
    this.load_artwork('hummingbird');
    this.artwork.title = `Stained Glass Mosaic #${seed % 1000}`;
    this.artwork.artist = 'Procedural Generator';
  }

  fit_to_screen() {
    const margin = 40;
    const availW = Math.max(100, this.canvas.width / (window.devicePixelRatio || 1) - margin * 2);
    const availH = Math.max(100, this.canvas.height / (window.devicePixelRatio || 1) - margin * 2);
    const s = Math.min(availW / this.artwork.width, availH / this.artwork.height, 1.2);
    this.targetScale = s;
    this.targetPanX = (this.canvas.width / (window.devicePixelRatio || 1) - this.artwork.width * s) / 2;
    this.targetPanY = (this.canvas.height / (window.devicePixelRatio || 1) - this.artwork.height * s) / 2;
  }

  update_pan_zoom(dx, dy, factor, ax, ay) {
    const oldS = this.targetScale;
    const newS = Math.min(Math.max(oldS * factor, 0.4), 5.0);
    const wx = (ax - this.targetPanX) / oldS;
    const wy = (ay - this.targetPanY) / oldS;
    this.targetScale = newS;
    this.targetPanX = ax - wx * newS + dx;
    this.targetPanY = ay - wy * newS + dy;
  }

  select_number(num) {
    this.activeNumber = num;
    this.hintRegionId = null;
  }

  toggle_outlines() {
    this.showOutlines = !this.showOutlines;
    return this.showOutlines;
  }

  trigger_hint() {
    const uncompleted = this.artwork.regions.find(r => !r.is_filled && r.number === this.activeNumber);
    if (uncompleted) {
      this.hintRegionId = uncompleted.id;
      const targetS = 1.35;
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
    let count = 0;
    this.artwork.regions.forEach(r => {
      if (!r.is_filled && r.number === this.activeNumber) {
        r.is_filled = true;
        count++;
      }
    });
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
      color_completed: true,
      artwork_completed: filled === total,
      total_filled: filled,
      total_regions: total,
      percent: (filled / total) * 100,
      number: this.activeNumber,
    });
  }

  handle_tap(sx, sy) {
    const wx = (sx - this.panX) / this.scale;
    const wy = (sy - this.panY) / this.scale;

    const idx = this.artwork.regions.findLastIndex(r => this.pointInPoly(wx, wy, r.polygon));
    if (idx !== -1) {
      const reg = this.artwork.regions[idx];
      if (!reg.is_filled) {
        if (reg.number === this.activeNumber) {
          reg.is_filled = true;
          this.spawnBurst(reg.centroid.x, reg.centroid.y, reg.color_hex);

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
            artwork_completed: filled === total,
            total_filled: filled,
            total_regions: total,
            percent: (filled / total) * 100,
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

    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);

    this.ctx.clearRect(0, 0, w, h);
    this.ctx.save();
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.scale, this.scale);

    // Canvas drop shadow
    this.ctx.shadowColor = 'rgba(0,0,0,0.3)';
    this.ctx.shadowBlur = 30;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.artwork.width, this.artwork.height);
    this.ctx.shadowBlur = 0;

    const pulse = Math.sin(this.pulsePhase) * 0.5 + 0.5;

    // Render regions
    this.artwork.regions.forEach(region => {
      this.ctx.beginPath();
      this.ctx.moveTo(region.polygon[0].x, region.polygon[0].y);
      for (let i = 1; i < region.polygon.length; i++) {
        this.ctx.lineTo(region.polygon[i].x, region.polygon[i].y);
      }
      this.ctx.closePath();

      if (region.is_filled) {
        this.ctx.fillStyle = region.color_hex;
        this.ctx.fill();
      } else {
        if (region.id === this.hintRegionId) {
          this.ctx.fillStyle = `rgba(255, 215, 0, ${0.45 + pulse * 0.35})`;
        } else {
          this.ctx.fillStyle = '#F8FAFC';
        }
        this.ctx.fill();
      }

      if (this.showOutlines) {
        const isHinted = region.id === this.hintRegionId;
        this.ctx.strokeStyle = isHinted ? '#F59E0B' : 'rgba(30, 41, 59, 0.45)';
        this.ctx.lineWidth = (isHinted ? 2.5 : 1.2) / Math.max(0.5, this.scale);
        this.ctx.stroke();
      }
    });

    // Render numbers
    const fontSize = Math.max(8, Math.min(24, 14 / this.scale));
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    this.artwork.regions.forEach(region => {
      if (region.is_filled) return;
      const isHinted = region.id === this.hintRegionId;
      const cx = region.centroid.x, cy = region.centroid.y;

      if (isHinted) {
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, (18 + pulse * 6) / this.scale, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#F59E0B';
        this.ctx.lineWidth = 3 / this.scale;
        this.ctx.stroke();
      }

      if (isHinted || this.scale > 0.7) {
        this.ctx.font = `${isHinted ? 'bold' : '600'} ${isHinted ? fontSize * 1.25 : fontSize}px 'Outfit', sans-serif`;
        this.ctx.fillStyle = isHinted ? '#B45309' : 'rgba(71, 85, 105, 0.75)';
        this.ctx.fillText(String(region.number), cx, cy);
      }
    });

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.vx *= 0.96;
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
  }

  get_palette_json() {
    return JSON.stringify(this.artwork.palette);
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
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  const app = new TapColorApp();
  app.init();
  window.tapColorApp = app;
});
