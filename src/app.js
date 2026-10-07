// Tap Color • WebAssembly & Diamond Art Studio Engine
import { storage } from './storage.js';
import { vectorizeImage, generateThumbnailBlob, kmeans, detectContentBounds } from './vectorizer.js';

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

  playDiamondSnap(colorIndex = 1) {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // High-frequency crystal snap + harmonic chime
    const freq = this.scale[(colorIndex - 1) % this.scale.length] * 2.2;
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

// Client-side diamond art grid generators for instant thumbnails and JS fallback
const DIAMOND_PALETTES = {
  starry_night_diamond: [
    { num: 1, hex: "#0B1335", name: "Midnight Ultramarine" },
    { num: 2, hex: "#15224D", name: "Deep Cobalt" },
    { num: 3, hex: "#233973", name: "Indigo Whirlpool" },
    { num: 4, hex: "#2E51A2", name: "Azure Swirl" },
    { num: 5, hex: "#4880D6", name: "Cerulean Wave" },
    { num: 6, hex: "#6BA8F2", name: "Cyan Starlight" },
    { num: 7, hex: "#F7DF79", name: "Pale Starlight" },
    { num: 8, hex: "#F9CA24", name: "Radiant Golden Moon" },
    { num: 9, hex: "#F0932B", name: "Amber Glow" },
    { num: 10, hex: "#0D2B22", name: "Dark Cypress Pine" },
    { num: 11, hex: "#184D3B", name: "Pine Foliage Green" },
    { num: 12, hex: "#0A1128", name: "Deep River Shadow" },
  ],
  peacock_diamond: [
    { num: 1, hex: "#091B33", name: "Deep Navy Night" },
    { num: 2, hex: "#10355E", name: "Midnight Sapphire" },
    { num: 3, hex: "#0A527A", name: "Royal Blue" },
    { num: 4, hex: "#0D7399", name: "Electric Cerulean" },
    { num: 5, hex: "#00A896", name: "Emerald Turquoise" },
    { num: 6, hex: "#02C39A", name: "Vivid Mint Jade" },
    { num: 7, hex: "#05668D", name: "Deep Teal Plumage" },
    { num: 8, hex: "#F4A261", name: "Warm Topaz" },
    { num: 9, hex: "#E76F51", name: "Coral Amber" },
    { num: 10, hex: "#E63946", name: "Ruby Crown" },
    { num: 11, hex: "#F1FAEE", name: "Pearl Crest" },
    { num: 12, hex: "#F72585", name: "Amethyst Magenta" },
  ],
  sakura_pagoda_diamond: [
    { num: 1, hex: "#FF7675", name: "Sunset Coral" },
    { num: 2, hex: "#FAB1A0", name: "Peach Horizon" },
    { num: 3, hex: "#FFEAA7", name: "Golden Evening Sun" },
    { num: 4, hex: "#DFE6E9", name: "Fuji Snow Crest" },
    { num: 5, hex: "#74B9FF", name: "Alpine Ice Shadow" },
    { num: 6, hex: "#2C3E50", name: "Pagoda & Mountain Silhouette" },
    { num: 7, hex: "#D63031", name: "Vermilion Pagoda Accent" },
    { num: 8, hex: "#FD79A8", name: "Vibrant Sakura Blossom" },
    { num: 9, hex: "#FFB8B8", name: "Soft Petal Blush" },
    { num: 10, hex: "#6C5CE7", name: "Twilight Lake Reflection" },
    { num: 11, hex: "#2D3436", name: "Ancient Pine Trunk" },
    { num: 12, hex: "#00B894", name: "Spring Moss Jade" },
  ],
  cosmic_wolf_diamond: [
    { num: 1, hex: "#08071A", name: "Void Obsidian" },
    { num: 2, hex: "#1E113E", name: "Cosmic Violet" },
    { num: 3, hex: "#3D1C68", name: "Twilight Amethyst" },
    { num: 4, hex: "#00F5D4", name: "Aurora Neon Cyan" },
    { num: 5, hex: "#70E000", name: "Aurora Electric Lime" },
    { num: 6, hex: "#38B000", name: "Deep Emerald Aurora" },
    { num: 7, hex: "#F72585", name: "Solar Flare Magenta" },
    { num: 8, hex: "#FFFFFF", name: "Pure Star Sparkle" },
    { num: 9, hex: "#CAF0F8", name: "Moon Silver" },
    { num: 10, hex: "#3F37C9", name: "Wolf Fur Shadow" },
    { num: 11, hex: "#4895EF", name: "Wolf Fur Rimlight" },
    { num: 12, hex: "#14142B", name: "Cliff Ridge Rock" },
  ],
  lotus_koi_diamond: [
    { num: 1, hex: "#06283D", name: "Abyssal Pond Deep" },
    { num: 2, hex: "#144272", name: "Sapphire Ripple" },
    { num: 3, hex: "#205295", name: "Clear Spring Blue" },
    { num: 4, hex: "#2C74B3", name: "Sunlit Water Highlight" },
    { num: 5, hex: "#006466", name: "Deep Lotus Pad Green" },
    { num: 6, hex: "#2A9D8F", name: "Emerald Lily Pad" },
    { num: 7, hex: "#E76F51", name: "Scarlet Koi Scales" },
    { num: 8, hex: "#F4A261", name: "Golden Topaz Koi" },
    { num: 9, hex: "#FFD166", name: "Sunbeam Fin Scales" },
    { num: 10, hex: "#FFFFFF", name: "Pearl Koi Belly" },
    { num: 11, hex: "#FF70A6", name: "Sacred Lotus Petal" },
    { num: 12, hex: "#FFEAA7", name: "Golden Stamen Heart" },
  ],
};

function getDiamondArtGrid(id, N = 28) {
  const grid = Array.from({ length: N }, () => Array(N).fill(1));

  if (id === 'starry_night_diamond') {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const u = c / (N - 1);
        const v = r / (N - 1);
        let col = v < 0.25 ? (c % 3 === 0 ? 2 : 1) : (v < 0.6 ? 2 : (v < 0.72 ? 1 : 12));
        const w1 = Math.sin(u * Math.PI * 2.2 + 0.5) * 0.15 + 0.38;
        const dw1 = Math.abs(v - w1);
        if (dw1 < 0.08 && c > 5 && v < 0.68) col = dw1 < 0.03 ? 5 : (dw1 < 0.055 ? 4 : 3);
        const w2 = Math.cos(u * Math.PI * 1.8 - 0.2) * 0.12 + 0.22;
        const dw2 = Math.abs(v - w2);
        if (dw2 < 0.06 && c > 7 && v < 0.6) col = dw2 < 0.025 ? 4 : 3;
        const dMoon = Math.hypot(r - 4.5, c - 22.5);
        if (dMoon <= 3.8) {
          col = dMoon <= 2.2 ? (Math.hypot(r - 3.8, c - 21.2) < 1.6 ? 7 : 8) : (dMoon <= 3.0 ? 7 : 6);
        }
        const dS1 = Math.hypot(r - 6, c - 9);
        if (dS1 < 3.2) col = dS1 < 0.9 ? 8 : (dS1 < 1.6 ? 7 : (dS1 < 2.3 ? 6 : 5));
        const dS2 = Math.hypot(r - 11, c - 16);
        if (dS2 < 2.6) col = dS2 < 0.8 ? 8 : (dS2 < 1.5 ? 7 : 6);
        const dS3 = Math.hypot(r - 3, c - 14);
        if (dS3 < 1.8) col = dS3 < 0.8 ? 8 : 6;
        const dS4 = Math.hypot(r - 8, c - 2);
        if (dS4 < 1.8) col = dS4 < 0.8 ? 8 : 7;
        const h1 = 18 + Math.sin(c * 0.4) * 1.5;
        if (r >= h1 && r < 23) {
          col = r > 19 ? 3 : 2;
          if (r === 20 && (c === 11 || c === 12 || c === 18 || c === 21)) col = 9;
          if (r === 21 && (c === 11 || c === 12 || c === 17 || c === 18 || c === 20 || c === 21)) col = 8;
          if (c === 14 && r >= 16 && r <= 20) col = 10;
        }
        if (r >= 23) {
          col = (r % 2 === 0) ? 12 : 1;
          if (Math.abs(c - 9) <= 1 && (r === 23 || r === 25)) col = 9;
          if (Math.abs(c - 16) <= 1 && (r === 24 || r === 26)) col = 9;
          if (Math.abs(c - 22) <= 1 && (r === 23 || r === 26)) col = 8;
          if (c > 24 && r === 25) col = 7;
        }
        const cw = (r - 2) * 0.17;
        const cc = 3.5 + Math.sin(r * 0.3) * 0.5;
        if (r >= 3 && Math.abs(c - cc) <= cw) col = (r + c) % 3 === 0 ? 11 : 10;
        grid[r][c] = col;
      }
    }
  } else if (id === 'peacock_diamond') {
    const ocelli = [
      { r: 7, c: 5 }, { r: 6, c: 11 }, { r: 6, c: 17 }, { r: 7, c: 23 },
      { r: 12, c: 3 }, { r: 12, c: 9 }, { r: 12, c: 19 }, { r: 12, c: 25 },
      { r: 17, c: 2 }, { r: 17, c: 7 }, { r: 18, c: 21 }, { r: 17, c: 26 },
      { r: 23, c: 4 }, { r: 24, c: 9 }, { r: 24, c: 19 }, { r: 23, c: 24 },
    ];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        let col = (r + c) % 5 === 0 ? 2 : 1;
        const angle = Math.atan2(r - 16, c - 14);
        const dist = Math.hypot(r - 16, c - 14);
        if (dist > 4 && dist < 15) {
          col = Math.abs(Math.sin(angle * 8)) > 0.4 ? 5 : 7;
          if (dist > 9 && (r + c) % 2 === 0) col = 6;
        }
        for (const oc of ocelli) {
          const d = Math.hypot(r - oc.r, c - oc.c);
          if (d < 2.2) col = d < 0.6 ? 11 : (d < 1.1 ? 10 : (d < 1.6 ? 8 : 6));
        }
        const dHead = Math.hypot(r - 6, c - 14);
        if (dHead <= 1.8) {
          col = (c === 14 && r === 6) ? 11 : 4;
          if (c === 15 && r === 6) col = 10;
        }
        if ((r === 3 && (c === 13 || c === 14 || c === 15)) || (r === 4 && (c === 13 || c === 14 || c === 15))) {
          col = r === 3 ? 10 : 6;
        }
        const neckC = 14 + Math.sin((r - 8) * 0.4) * 0.8;
        if (r >= 8 && r <= 13 && Math.abs(c - neckC) <= 1.3) col = c <= neckC ? 4 : 3;
        const bodyW = 2.2 + (r - 14) * 0.2;
        if (r >= 14 && r <= 22 && Math.abs(c - 14.5) <= bodyW) {
          col = (c === 14 || c === 15) ? 4 : 3;
          if (r > 18) col = (r + c) % 2 === 0 ? 5 : 7;
        }
        if (r === 25 && c >= 8 && c <= 21) col = 8;
        if (r === 26 && c >= 9 && c <= 20) col = 9;
        grid[r][c] = col;
      }
    }
  } else if (id === 'sakura_pagoda_diamond') {
    const roofTiers = [{ r: 9, w: 2 }, { r: 12, w: 2.8 }, { r: 15, w: 3.4 }, { r: 18, w: 4.0 }, { r: 21, w: 4.6 }];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        let col = r < 7 ? 3 : (r < 14 ? 2 : (r < 19 ? 1 : 10));
        const dSun = Math.hypot(r - 8.5, c - 19.5);
        if (dSun <= 3.8) col = dSun <= 2.4 ? 3 : 2;
        if (r >= 8 && r <= 19) {
          const slopeW = (r - 8) * 0.95;
          if (Math.abs(c - 19.5) <= slopeW) {
            col = r <= 11 ? (c < 19.5 ? 4 : 5) : (r <= 13 ? ((r + c) % 2 === 0 ? 4 : 6) : 6);
          }
        }
        if (r >= 20) {
          col = r % 2 === 0 ? 10 : 1;
          if (c >= 17 && c <= 22) col = r % 2 === 0 ? 2 : 3;
          if (c >= 4 && c <= 9 && r <= 24) col = 6;
        }
        if (r >= 7 && r <= 8 && (c === 6 || c === 7)) col = 7;
        for (const tier of roofTiers) {
          if (r === tier.r && Math.abs(c - 6.5) <= tier.w) col = 7;
          if (r === tier.r + 1 && Math.abs(c - 6.5) <= tier.w - 0.7) col = 6;
          if (r === tier.r + 2 && Math.abs(c - 6.5) <= tier.w - 1.2) col = (r + c) % 2 === 0 ? 7 : 6;
        }
        if (r >= 22 && r <= 24 && Math.abs(c - 6.5) <= 3.8) col = 6;
        if (r >= 25 && c <= 12) col = r === 27 ? 11 : 12;
        if (Math.abs(r - (2 + (27 - c) * 0.35)) <= 1.2 && c >= 16) col = 11;
        if (Math.hypot(r - 3, c - 24) < 2.8 || Math.hypot(r - 5, c - 20) < 2.5 || Math.hypot(r - 2, c - 18) < 2.2) {
          col = (r + c) % 3 === 0 ? 9 : 8;
        }
        if (Math.hypot(r - 24, c - 23) < 3.2 || Math.hypot(r - 26, c - 26) < 2.8) col = (r + c) % 2 === 0 ? 8 : 9;
        grid[r][c] = col;
      }
    }
  } else if (id === 'cosmic_wolf_diamond') {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        let col = r < 6 ? 2 : (r < 13 ? (c % 2 === 0 ? 2 : 1) : 1);
        const dMoon = Math.hypot(r - 5, c - 22);
        if (dMoon <= 3.8) col = dMoon <= 2.2 ? 8 : (dMoon <= 3.0 ? 9 : 3);
        const a1 = 3 + Math.sin(c * 0.3) * 2.2;
        if (Math.abs(r - a1) <= 1.8 && (c < 18 || r > 8)) col = Math.abs(r - a1) <= 0.8 ? 5 : (r > a1 ? 6 : 4);
        const a2 = 7 + Math.sin(c * 0.25 + 1.2) * 2.0;
        if (Math.abs(r - a2) <= 1.6 && c < 19) col = Math.abs(r - a2) <= 0.7 ? 4 : 7;
        if ((r === 1 && c === 4) || (r === 2 && c === 12) || (r === 10 && c === 2) || (r === 11 && c === 26) || (r === 8 && c === 14)) col = 8;
        const cliff = 10 + (27 - r) * 0.6;
        if (c >= cliff && r >= 19) col = Math.abs(c - cliff) < 1.0 ? 10 : 12;
        if ((r === 11 && (c === 15 || c === 16)) || (r === 12 && (c === 13 || c === 14 || c === 15))) col = (c === 16 || r === 11) ? 11 : 10;
        if (r === 13 && c >= 11 && c <= 14) col = (c === 11 || c === 14) ? 11 : 10;
        if (r >= 14 && r <= 15 && c >= 10 && c <= 14) col = (c === 10 || c === 14) ? 11 : 10;
        if (r >= 16 && r <= 18 && c >= 9 && c <= 15) col = (c === 9 || c === 15) ? 11 : 10;
        if (r >= 19 && r <= 21 && c >= 10 && c <= 16) col = c === 10 ? 11 : 10;
        if (r >= 18 && r <= 22 && (c === 8 || c === 9)) col = c === 8 ? 11 : 10;
        grid[r][c] = col;
      }
    }
  } else if (id === 'lotus_koi_diamond') {
    const koi1 = [
      { r: 8, c: 8, t: 8 }, { r: 9, c: 7, t: 7 }, { r: 10, c: 7, t: 8 },
      { r: 11, c: 6, t: 10 }, { r: 12, c: 6, t: 7 }, { r: 13, c: 6, t: 8 },
      { r: 14, c: 6, t: 7 }, { r: 15, c: 6, t: 8 }, { r: 16, c: 7, t: 10 },
      { r: 17, c: 7, t: 8 }, { r: 18, c: 8, t: 7 }, { r: 19, c: 9, t: 8 },
      { r: 20, c: 10, t: 9 }, { r: 21, c: 11, t: 9 },
    ];
    const koi2 = [
      { r: 19, c: 20, t: 8 }, { r: 18, c: 21, t: 7 }, { r: 17, c: 21, t: 8 },
      { r: 16, c: 22, t: 10 }, { r: 15, c: 22, t: 7 }, { r: 14, c: 22, t: 8 },
      { r: 13, c: 22, t: 7 }, { r: 12, c: 22, t: 8 }, { r: 11, c: 21, t: 10 },
      { r: 10, c: 21, t: 8 }, { r: 9, c: 20, t: 7 }, { r: 8, c: 19, t: 8 },
      { r: 7, c: 18, t: 9 }, { r: 6, c: 17, t: 9 },
    ];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const dCenter = Math.hypot(r - 14, c - 14);
        const rip = Math.sin(dCenter * 0.8);
        let col = rip > 0.4 ? 3 : (rip > -0.2 ? 2 : 1);
        const dP1 = Math.hypot(r - 4, c - 5);
        if (dP1 <= 3.8 && !(r === 4 && c <= 5)) col = dP1 <= 2.8 ? 6 : 5;
        const dP2 = Math.hypot(r - 23, c - 22);
        if (dP2 <= 3.6 && !(c === 22 && r >= 23)) col = dP2 <= 2.6 ? 6 : 5;
        for (const pt of koi1) {
          if (Math.hypot(r - pt.r, c - pt.c) < 1.3) col = pt.t;
        }
        if ((r === 10 && c === 5) || (r === 11 && c === 5) || (r === 15 && c === 5) || (r === 16 && c === 5)) col = 9;
        for (const pt of koi2) {
          if (Math.hypot(r - pt.r, c - pt.c) < 1.3) col = pt.t;
        }
        if ((r === 17 && c === 23) || (r === 18 && c === 23) || (r === 12 && c === 23) || (r === 13 && c === 23)) col = 9;
        const dLotus = Math.hypot(r - 14, c - 14);
        if (dLotus <= 3.2) col = dLotus <= 1.0 ? 12 : (dLotus <= 2.2 ? ((r + c) % 2 === 0 ? 11 : 10) : 11);
        grid[r][c] = col;
      }
    }
  }

  return grid;
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
    this.toolMode = 'pen'; // 'pen', 'erase', or 'pan'
    this.highlightMatching = false; // Matching tiles are not highlighted by default
    this.currentArtworkId = 'fluffy_cow_diamond';
    this.activeNumber = 1;
    this.hintCount = 5;
    this.activeCategory = 'diamond'; // 'classic', 'diamond', 'saved', 'custom'

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

    // Statistics
    this.startTime = Date.now();
    this.totalTaps = 0;
    this.successfulTaps = 0;
    this.activeImportedRecord = null;
    this.autosaveTimer = null;

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
        originalAsset: 'assets/fluffy-cow-3.jpeg',
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
        originalAsset: 'assets/hummingbird.jpeg',
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
        originalAsset: 'assets/country_barn.jpeg',
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
        originalAsset: 'assets/country_rooster.jpeg',
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
        originalAsset: 'assets/country_truck.jpeg',
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
        originalAsset: 'assets/country_puppy.jpeg',
        thumbnailUrl: 'assets/converted/country_puppy_diamond_120_thumb.png',
        variants: [
          { id: 'country_puppy_diamond_80', label: '80×80', name: 'Cozy Canvas', pieces: 6400, colors: 18, grid: 80, jsonFile: 'assets/converted/country_puppy_diamond_80.json', thumbnailUrl: 'assets/converted/country_puppy_diamond_80_thumb.png' },
          { id: 'country_puppy_diamond_120', label: '120×120', name: 'Standard Kit', pieces: 14400, colors: 26, grid: 120, jsonFile: 'assets/converted/country_puppy_diamond_120.json', thumbnailUrl: 'assets/converted/country_puppy_diamond_120_thumb.png' },
          { id: 'country_puppy_diamond_160', label: '160×160', name: 'Masterpiece Ultra', pieces: 25600, colors: 36, grid: 160, jsonFile: 'assets/converted/country_puppy_diamond_160.json', thumbnailUrl: 'assets/converted/country_puppy_diamond_160_thumb.png' },
        ],
      },
      // 6 Country Life Paint by Number Paintings (Multi-Resolution Vector Masterpieces)
      {
        id: 'fluffy_cow_pbn',
        title: 'Sweet Highland Calf',
        artist: 'Country Homestead',
        category: 'classic',
        pieces: 333,
        desc: 'Gentle fluffy highland cow calf surrounded by meadow wildflowers and rustic pasture',
        defaultVariantId: 'fluffy_cow_pbn_intricate',
        selectedVariantId: 'fluffy_cow_pbn_intricate',
        originalAsset: 'assets/fluffy-cow-3.jpeg',
        thumbnailUrl: 'assets/converted/fluffy_cow_pbn_intricate_thumb.png',
        variants: [
          { id: 'fluffy_cow_pbn_detailed', label: 'Detailed', name: 'Detailed', pieces: 198, colors: 15, complexity: 'detailed', jsonFile: 'assets/converted/fluffy_cow_pbn_detailed.json', thumbnailUrl: 'assets/converted/fluffy_cow_pbn_detailed_thumb.png' },
          { id: 'fluffy_cow_pbn_intricate', label: 'Intricate', name: 'Intricate', pieces: 333, colors: 22, complexity: 'intricate', jsonFile: 'assets/converted/fluffy_cow_pbn_intricate.json', thumbnailUrl: 'assets/converted/fluffy_cow_pbn_intricate_thumb.png' },
          { id: 'fluffy_cow_pbn_masterpiece', label: 'Masterpiece', name: 'Masterpiece', pieces: 759, colors: 31, complexity: 'masterpiece', jsonFile: 'assets/converted/fluffy_cow_pbn_masterpiece.json', thumbnailUrl: 'assets/converted/fluffy_cow_pbn_masterpiece_thumb.png' },
        ],
      },
      {
        id: 'hummingbird_pbn',
        title: 'Garden Hummingbird',
        artist: 'Sunlit Meadow',
        category: 'classic',
        pieces: 248,
        desc: 'Vibrant hummingbird sipping sweet nectar among blooming country garden flora',
        defaultVariantId: 'hummingbird_pbn_intricate',
        selectedVariantId: 'hummingbird_pbn_intricate',
        originalAsset: 'assets/hummingbird.jpeg',
        thumbnailUrl: 'assets/converted/hummingbird_pbn_intricate_thumb.png',
        variants: [
          { id: 'hummingbird_pbn_detailed', label: 'Detailed', name: 'Detailed', pieces: 140, colors: 15, complexity: 'detailed', jsonFile: 'assets/converted/hummingbird_pbn_detailed.json', thumbnailUrl: 'assets/converted/hummingbird_pbn_detailed_thumb.png' },
          { id: 'hummingbird_pbn_intricate', label: 'Intricate', name: 'Intricate', pieces: 248, colors: 23, complexity: 'intricate', jsonFile: 'assets/converted/hummingbird_pbn_intricate.json', thumbnailUrl: 'assets/converted/hummingbird_pbn_intricate_thumb.png' },
          { id: 'hummingbird_pbn_masterpiece', label: 'Masterpiece', name: 'Masterpiece', pieces: 586, colors: 31, complexity: 'masterpiece', jsonFile: 'assets/converted/hummingbird_pbn_masterpiece.json', thumbnailUrl: 'assets/converted/hummingbird_pbn_masterpiece_thumb.png' },
        ],
      },
      {
        id: 'country_barn_pbn',
        title: 'Rustic Red Barn',
        artist: 'Heartland Heritage',
        category: 'classic',
        pieces: 657,
        desc: 'Classic red country barn with silo, split-rail fence, and sunflowers under sunny blue sky',
        defaultVariantId: 'country_barn_pbn_intricate',
        selectedVariantId: 'country_barn_pbn_intricate',
        originalAsset: 'assets/country_barn.jpeg',
        thumbnailUrl: 'assets/converted/country_barn_pbn_intricate_thumb.png',
        variants: [
          { id: 'country_barn_pbn_detailed', label: 'Detailed', name: 'Detailed', pieces: 318, colors: 16, complexity: 'detailed', jsonFile: 'assets/converted/country_barn_pbn_detailed.json', thumbnailUrl: 'assets/converted/country_barn_pbn_detailed_thumb.png' },
          { id: 'country_barn_pbn_intricate', label: 'Intricate', name: 'Intricate', pieces: 657, colors: 24, complexity: 'intricate', jsonFile: 'assets/converted/country_barn_pbn_intricate.json', thumbnailUrl: 'assets/converted/country_barn_pbn_intricate_thumb.png' },
          { id: 'country_barn_pbn_masterpiece', label: 'Masterpiece', name: 'Masterpiece', pieces: 1161, colors: 32, complexity: 'masterpiece', jsonFile: 'assets/converted/country_barn_pbn_masterpiece.json', thumbnailUrl: 'assets/converted/country_barn_pbn_masterpiece_thumb.png' },
        ],
      },
      {
        id: 'country_rooster_pbn',
        title: 'Morning Farm Rooster',
        artist: 'Sunrise Farmstead',
        category: 'classic',
        pieces: 638,
        desc: 'Colorful country rooster greeting the morning sun from a rustic fence post',
        defaultVariantId: 'country_rooster_pbn_intricate',
        selectedVariantId: 'country_rooster_pbn_intricate',
        originalAsset: 'assets/country_rooster.jpeg',
        thumbnailUrl: 'assets/converted/country_rooster_pbn_intricate_thumb.png',
        variants: [
          { id: 'country_rooster_pbn_detailed', label: 'Detailed', name: 'Detailed', pieces: 283, colors: 16, complexity: 'detailed', jsonFile: 'assets/converted/country_rooster_pbn_detailed.json', thumbnailUrl: 'assets/converted/country_rooster_pbn_detailed_thumb.png' },
          { id: 'country_rooster_pbn_intricate', label: 'Intricate', name: 'Intricate', pieces: 638, colors: 24, complexity: 'intricate', jsonFile: 'assets/converted/country_rooster_pbn_intricate.json', thumbnailUrl: 'assets/converted/country_rooster_pbn_intricate_thumb.png' },
          { id: 'country_rooster_pbn_masterpiece', label: 'Masterpiece', name: 'Masterpiece', pieces: 1092, colors: 32, complexity: 'masterpiece', jsonFile: 'assets/converted/country_rooster_pbn_masterpiece.json', thumbnailUrl: 'assets/converted/country_rooster_pbn_masterpiece_thumb.png' },
        ],
      },
      {
        id: 'country_truck_pbn',
        title: 'Vintage Harvest Truck',
        artist: 'Country Roads Studio',
        category: 'classic',
        pieces: 436,
        desc: 'Classic turquoise vintage pickup truck filled with harvest pumpkins and sunflowers',
        defaultVariantId: 'country_truck_pbn_intricate',
        selectedVariantId: 'country_truck_pbn_intricate',
        originalAsset: 'assets/country_truck.jpeg',
        thumbnailUrl: 'assets/converted/country_truck_pbn_intricate_thumb.png',
        variants: [
          { id: 'country_truck_pbn_detailed', label: 'Detailed', name: 'Detailed', pieces: 195, colors: 15, complexity: 'detailed', jsonFile: 'assets/converted/country_truck_pbn_detailed.json', thumbnailUrl: 'assets/converted/country_truck_pbn_detailed_thumb.png' },
          { id: 'country_truck_pbn_intricate', label: 'Intricate', name: 'Intricate', pieces: 436, colors: 24, complexity: 'intricate', jsonFile: 'assets/converted/country_truck_pbn_intricate.json', thumbnailUrl: 'assets/converted/country_truck_pbn_intricate_thumb.png' },
          { id: 'country_truck_pbn_masterpiece', label: 'Masterpiece', name: 'Masterpiece', pieces: 784, colors: 32, complexity: 'masterpiece', jsonFile: 'assets/converted/country_truck_pbn_masterpiece.json', thumbnailUrl: 'assets/converted/country_truck_pbn_masterpiece_thumb.png' },
        ],
      },
      {
        id: 'country_puppy_pbn',
        title: 'Porch Golden Puppy',
        artist: 'Cottage Companions',
        category: 'classic',
        pieces: 420,
        desc: 'Adorable golden retriever puppy in a red bandana enjoying a sunny farm morning',
        defaultVariantId: 'country_puppy_pbn_intricate',
        selectedVariantId: 'country_puppy_pbn_intricate',
        originalAsset: 'assets/country_puppy.jpeg',
        thumbnailUrl: 'assets/converted/country_puppy_pbn_intricate_thumb.png',
        variants: [
          { id: 'country_puppy_pbn_detailed', label: 'Detailed', name: 'Detailed', pieces: 195, colors: 16, complexity: 'detailed', jsonFile: 'assets/converted/country_puppy_pbn_detailed.json', thumbnailUrl: 'assets/converted/country_puppy_pbn_detailed_thumb.png' },
          { id: 'country_puppy_pbn_intricate', label: 'Intricate', name: 'Intricate', pieces: 420, colors: 24, complexity: 'intricate', jsonFile: 'assets/converted/country_puppy_pbn_intricate.json', thumbnailUrl: 'assets/converted/country_puppy_pbn_intricate_thumb.png' },
          { id: 'country_puppy_pbn_masterpiece', label: 'Masterpiece', name: 'Masterpiece', pieces: 755, colors: 32, complexity: 'masterpiece', jsonFile: 'assets/converted/country_puppy_pbn_masterpiece.json', thumbnailUrl: 'assets/converted/country_puppy_pbn_masterpiece_thumb.png' },
        ],
      },
    ];
  }

  async init() {
    this.setupCanvasDpi();
    this.bindEvents();
    this.populateGalleryModal();
    await this.updateSavedBadge();

    // Attempt to load compiled Rust WebAssembly module
    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const wasmUrl = new URL(`${baseUrl.replace(/\/$/, '')}/pkg/tap_color.js`, window.location.href).href;
      const wasmModule = await import(/* @vite-ignore */ wasmUrl);
      await wasmModule.default();
      this.controller = new wasmModule.GameController('game-canvas', this.currentArtworkId);
      this.isWasmActive = true;
    } catch (e) {
      console.warn('WASM module not yet compiled or unavailable. Launching client preview engine.', e);
      this.controller = new FallbackJsController(this.canvas, this.currentArtworkId);
    }

    await this.selectArtwork(this.currentArtworkId);

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

    // Touch controls: 1-finger touch to place / glide, 2-fingers pan & pinch-to-zoom
    this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
    this.canvas.addEventListener('touchcancel', (e) => this.onTouchCancel(e), { passive: false });

    // Tool Mode buttons (Pen vs Eraser vs Pan)
    const btnPen = document.getElementById('btn-mode-pen');
    const btnErase = document.getElementById('btn-mode-erase');
    const btnPan = document.getElementById('btn-mode-pan');
    const btnClearCanvas = document.getElementById('btn-clear-canvas');

    const setToolMode = (mode) => {
      this.toolMode = mode;
      btnPen.classList.toggle('active', mode === 'pen');
      if (btnErase) btnErase.classList.toggle('active', mode === 'erase');
      btnPan.classList.toggle('active', mode === 'pan');
      this.canvas.style.cursor = mode === 'pen' ? 'crosshair' : (mode === 'erase' ? 'cell' : 'grab');
    };

    btnPen.addEventListener('click', () => setToolMode('pen'));
    if (btnErase) btnErase.addEventListener('click', () => setToolMode('erase'));
    btnPan.addEventListener('click', () => setToolMode('pan'));

    if (btnClearCanvas) {
      btnClearCanvas.addEventListener('click', () => {
        if (confirm('Clear all placed tiles on this artwork?')) {
          this.clearCanvasTiles();
        }
      });
    }

    // Sound toggle
    document.getElementById('btn-sound').addEventListener('click', () => {
      this.sound.enabled = !this.sound.enabled;
      document.getElementById('btn-sound').classList.toggle('active', this.sound.enabled);
    });

    // Outline toggle
    document.getElementById('btn-outline').addEventListener('click', () => {
      if (!this.controller) return;
      const visible = this.controller.toggle_outlines();
      document.getElementById('btn-outline').classList.toggle('active', visible);
    });

    // Magic wand fill current
    document.getElementById('btn-wand').addEventListener('click', () => {
      if (!this.controller) return;
      const resJson = this.controller.fill_all_of_current();
      const res = JSON.parse(resJson);
      if (res.success) {
        this.sound.playColorComplete();
        this.onTapFeedback(res);
      }
    });

    // Hint button: toggles matching tile highlights on/off
    document.getElementById('btn-hint').addEventListener('click', () => this.toggleHintHighlights());

    // Zoom buttons
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      if (!this.controller) return;
      const rect = this.canvas.getBoundingClientRect();
      this.controller.update_pan_zoom(0, 0, 1.35, rect.width / 2, rect.height / 2);
    });

    document.getElementById('btn-zoom-drill').addEventListener('click', () => {
      // Zoom directly into diamond drill level (scale ~2.2)
      if (!this.controller) return;
      const rect = this.canvas.getBoundingClientRect();
      const currentScale = this.controller.target_scale || (this.controller.engine ? this.controller.engine.target_scale : 1.0);
      const factor = 2.2 / Math.max(0.2, currentScale);
      this.controller.update_pan_zoom(0, 0, factor, rect.width / 2, rect.height / 2);
    });

    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      if (!this.controller) return;
      const rect = this.canvas.getBoundingClientRect();
      this.controller.update_pan_zoom(0, 0, 0.75, rect.width / 2, rect.height / 2);
    });

    document.getElementById('btn-zoom-reset').addEventListener('click', () => {
      if (this.controller) this.controller.fit_to_screen();
    });

    // Gallery Modal open/close
    const modalGallery = document.getElementById('modal-gallery');
    document.getElementById('btn-gallery').addEventListener('click', async () => {
      await this.flushAutosave();
      modalGallery.classList.remove('hidden');
      if (this.activeCategory === 'saved') {
        await this.renderSavedGallery();
      }
    });

    document.getElementById('btn-close-gallery').addEventListener('click', () => {
      modalGallery.classList.add('hidden');
    });

    // Flush autosave when window loses focus or unloads
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
    const togglePbn = document.getElementById('quick-toggle-pbn');
    const toggleDiamond = document.getElementById('quick-toggle-diamond');

    if (btnResSwitcher && dropdownQuick) {
      btnResSwitcher.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = dropdownQuick.classList.contains('hidden');
        if (isHidden) {
          this.renderQuickStyleDropdown();
          dropdownQuick.classList.remove('hidden');
          btnResSwitcher.classList.add('active');
        } else {
          dropdownQuick.classList.add('hidden');
          btnResSwitcher.classList.remove('active');
        }
      });

      document.addEventListener('click', (e) => {
        if (!dropdownQuick.classList.contains('hidden') && !dropdownQuick.contains(e.target) && e.target !== btnResSwitcher) {
          dropdownQuick.classList.add('hidden');
          btnResSwitcher.classList.remove('active');
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !dropdownQuick.classList.contains('hidden')) {
          dropdownQuick.classList.add('hidden');
          btnResSwitcher.classList.remove('active');
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
        document.querySelectorAll('.gallery-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeCategory = tab.dataset.tab;

        const grid = document.getElementById('artwork-grid');
        const customPanel = document.getElementById('tab-custom-panel');
        const savedPanel = document.getElementById('tab-saved-panel');

        if (this.activeCategory === 'custom') {
          grid.style.display = 'none';
          if (savedPanel) savedPanel.classList.add('hidden');
          customPanel.classList.remove('hidden');
          if (this.updateStudioPreview) this.updateStudioPreview();
        } else if (this.activeCategory === 'saved') {
          grid.style.display = 'none';
          customPanel.classList.add('hidden');
          if (savedPanel) savedPanel.classList.remove('hidden');
          await this.renderSavedGallery();
        } else {
          customPanel.classList.add('hidden');
          if (savedPanel) savedPanel.classList.add('hidden');
          grid.style.display = 'grid';
          this.populateGalleryModal();
          this.filterGalleryCards();
        }
      });
    });

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

    modalVictory.addEventListener('click', (e) => {
      if (e.target === modalVictory) {
        closeVictoryModal();
      }
    });

    document.getElementById('btn-export-png').addEventListener('click', () => {
      this.exportArtworkPng();
    });

    const btnExportHeader = document.getElementById('btn-export-header');
    if (btnExportHeader) {
      btnExportHeader.addEventListener('click', () => {
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

    document.getElementById('btn-next-artwork').addEventListener('click', () => {
      modalVictory.classList.add('hidden');
      const curIdx = this.artworksMeta.findIndex(a => a.id === this.currentArtworkId);
      const nextIdx = (curIdx + 1) % this.artworksMeta.length;
      this.selectArtwork(this.artworksMeta[nextIdx].id);
    });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      // Escape key closes open modals
      if (e.key === 'Escape') {
        if (!modalVictory.classList.contains('hidden')) {
          closeVictoryModal();
          return;
        }
        const modalGallery = document.getElementById('modal-gallery');
        if (modalGallery && !modalGallery.classList.contains('hidden')) {
          modalGallery.classList.add('hidden');
          return;
        }
        const modalRes = document.getElementById('modal-resolution-picker');
        if (modalRes && !modalRes.classList.contains('hidden')) {
          modalRes.classList.add('hidden');
          return;
        }
      }

      // Arrow keys to pan
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        this.onArrowKeyDown(e);
        return;
      }

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
        document.getElementById('btn-zoom-drill').click();
      } else if (e.key === 'f' || e.key === 'F') {
        if (this.controller) this.controller.fit_to_screen();
      } else if (e.key === 'o' || e.key === 'O') {
        document.getElementById('btn-outline').click();
      } else if (/^[1-9]$/.test(e.key)) {
        const num = parseInt(e.key, 10);
        this.selectNumber(num);
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
    });
  }

  onPointerDown(e) {
    if (e.pointerType === 'touch') return; // Handled by TouchEvents on mobile & touchscreens

    this.isDragging = true;
    this.dragDistance = 0;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.pointerButton = e.button;

    // In Pen or Erase mode, left click immediately interacts
    if (this.toolMode === 'pen' && e.button === 0) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.tryPlaceDrill(x, y);
    } else if (this.toolMode === 'erase' && e.button === 0) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.tryEraseDrill(x, y);
    }
  }

  onPointerMove(e) {
    if (e.pointerType === 'touch') return;
    if (!this.isDragging || !this.controller) return;

    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.dragDistance += Math.hypot(dx, dy);
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    // Middle click or right click always pans
    if (this.pointerButton === 1 || this.pointerButton === 2) {
      const rect = this.canvas.getBoundingClientRect();
      this.controller.update_pan_zoom(dx, dy, 1.0, rect.width / 2, rect.height / 2);
      return;
    }

    if (this.toolMode === 'pen' && e.buttons === 1) {
      // Applicator pen glide: color drills continuously
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.tryPlaceDrill(x, y);
    } else if (this.toolMode === 'erase' && e.buttons === 1) {
      // Eraser glide: clear drills continuously
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.tryEraseDrill(x, y);
    } else {
      // Pan canvas
      const rect = this.canvas.getBoundingClientRect();
      this.controller.update_pan_zoom(dx, dy, 1.0, rect.width / 2, rect.height / 2);
    }
  }

  onPointerUp(e) {
    if (e.pointerType === 'touch') return;
    if (!this.isDragging) return;
    this.isDragging = false;

    // Small movement (< 6px) tap interaction
    if (this.toolMode === 'pan' && this.dragDistance < 6 && this.controller && this.pointerButton === 0) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.tryPlaceDrill(x, y, true);
    } else if (this.toolMode === 'erase' && this.dragDistance < 6 && this.controller && this.pointerButton === 0) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.tryEraseDrill(x, y);
    }
  }

  // Touchscreen Controls: 1-finger touch to place/glide, 2-fingers pan & pinch-zoom
  onTouchStart(e) {
    e.preventDefault();

    if (e.touches.length === 1) {
      if (Date.now() < this.suppressSingleTouchUntil) return;
      this.isTwoFingerGesture = false;

      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
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
      this.touchPlaceTimeout = setTimeout(() => {
        if (this.pendingTouch && !this.isTwoFingerGesture) {
          const pt = this.pendingTouch;
          this.pendingTouch = null;
          this.executeTouchPlace(pt.x, pt.y, true);
        }
      }, 35);

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

    if (e.touches.length === 1) {
      if (this.isTwoFingerGesture || Date.now() < this.suppressSingleTouchUntil) return;

      const touch = e.touches[0];
      const moveDist = Math.hypot(
        touch.clientX - (this.singleTouchStartPos ? this.singleTouchStartPos.x : touch.clientX),
        touch.clientY - (this.singleTouchStartPos ? this.singleTouchStartPos.y : touch.clientY)
      );

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
        const rect = this.canvas.getBoundingClientRect();
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
      this.isTwoFingerGesture = true;

      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const currentMidX = (t0.clientX + t1.clientX) / 2;
      const currentMidY = (t0.clientY + t1.clientY) / 2;
      const currentDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);

      // Pan delta between touch midpoints
      const dx = currentMidX - this.touchMidX;
      const dy = currentMidY - this.touchMidY;

      // Pinch zoom factor
      let factor = 1.0;
      if (this.touchPinchDist > 0 && currentDist > 0) {
        factor = currentDist / this.touchPinchDist;
      }

      const rect = this.canvas.getBoundingClientRect();
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
      const rect = this.canvas.getBoundingClientRect();
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
        const rect = this.canvas.getBoundingClientRect();
        this.controller.update_pan_zoom(dx, dy, 1.0, rect.width / 2, rect.height / 2);
      }

      this.arrowPanRafId = requestAnimationFrame(loop);
    };

    this.arrowPanRafId = requestAnimationFrame(loop);
  }

  tryPlaceDrill(x, y, playWrongOnFail = false) {
    if (!this.controller) return;
    const resJson = this.controller.handle_tap(x, y);
    const res = JSON.parse(resJson);

    if (res.success) {
      this.totalTaps++;
      this.successfulTaps++;
      if (this.currentArtworkId.includes('diamond')) {
        this.sound.playDiamondSnap(res.number || 1);
      } else {
        this.sound.playTap(res.number || 1);
      }
      if (navigator.vibrate) navigator.vibrate(12);
      this.onTapFeedback(res);
    } else if (playWrongOnFail && res.region_id !== undefined && res.region_id !== null) {
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
    document.getElementById('progress-fill').style.width = `${percent}%`;
    document.getElementById('progress-text').textContent = `${percent}%`;

    this.refreshPaletteUI();

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
      // Smoothly zoom out so the user can see the entire completed artwork
      if (this.controller && this.controller.fit_to_screen) {
        this.controller.fit_to_screen();
      }
      setTimeout(() => {
        this.sound.playVictory();
        this.showVictoryModal(res.total_regions);
      }, 500);
    }
  }

  tryEraseDrill(x, y) {
    if (!this.controller) return;
    const resJson = this.controller.handle_erase(x, y);
    const res = JSON.parse(resJson);
    if (res.success) {
      this.sound.playErase();
      if (navigator.vibrate) navigator.vibrate(8);
      this.onTapFeedback(res);
    }
  }

  clearCanvasTiles() {
    if (!this.controller) return;
    const resJson = this.controller.clear_all_tiles();
    const res = JSON.parse(resJson);
    this.sound.playErase();
    this.onTapFeedback(res);
    this.triggerAutosave();
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
      card.dataset.category = meta.category;

      const isDiamond = meta.category === 'diamond';
      const activeVariant = meta.variants
        ? (meta.variants.find(v => v.id === (meta.selectedVariantId || meta.defaultVariantId)) || meta.variants[0])
        : null;

      const piecesCount = activeVariant ? activeVariant.pieces : meta.pieces;

      let resolutionSelectorHtml = '';
      if (meta.variants && meta.variants.length > 0) {
        resolutionSelectorHtml = `
          <div class="artwork-resolution-selector">
            <span class="resolution-title">Resolution / Difficulty:</span>
            <div class="resolution-pills">
              ${meta.variants.map(v => `
                <button type="button" class="res-pill ${v.id === (activeVariant ? activeVariant.id : '') ? 'active' : ''}" data-variant-id="${v.id}" title="${v.name}: ${v.pieces} pieces, ${v.colors} colors">
                  ${v.label} <span class="res-pill-count">(${v.pieces})</span>
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
          <h4>${meta.title}</h4>
          <span class="artwork-artist-tag">${meta.artist}</span>
          <p>${meta.desc}</p>
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
              const numEl = card.querySelector('.card-pieces-count');
              if (numEl) numEl.textContent = chosen.pieces;
              const thumbCanvas = card.querySelector('.artwork-thumb-canvas');
              if (thumbCanvas) this.renderThumbnail(thumbCanvas, meta);
            }
          });
        });
      }

      card.addEventListener('click', () => {
        const chosenVarId = meta.selectedVariantId || meta.defaultVariantId || meta.id;
        this.selectArtwork(meta.id, chosenVarId);
        document.getElementById('modal-gallery').classList.add('hidden');
      });

      grid.appendChild(card);

      // Render thumbnail preview
      const thumbCanvas = card.querySelector('.artwork-thumb-canvas');
      this.renderThumbnail(thumbCanvas, meta);
    });

    this.filterGalleryCards();
  }

  filterGalleryCards() {
    document.querySelectorAll('.artwork-card').forEach(card => {
      if (this.activeCategory === 'diamond') {
        card.style.display = card.dataset.category === 'diamond' ? 'flex' : 'none';
      } else if (this.activeCategory === 'classic') {
        card.style.display = card.dataset.category === 'classic' ? 'flex' : 'none';
      } else {
        card.style.display = 'flex';
      }
    });
  }

  async updateSavedBadge() {
    try {
      const artworks = await storage.getAllArtworks();
      const badge = document.getElementById('saved-badge');
      if (badge) {
        const inProgress = artworks.filter(a => (a.filledCount || 0) > 0 && !a.completed);
        const count = inProgress.length > 0 ? inProgress.length : artworks.length;
        badge.textContent = count;
        badge.title = inProgress.length > 0 ? `${inProgress.length} In Progress` : `${artworks.length} Saved Artworks`;
      }
    } catch (e) {
      console.warn('Could not update saved badge:', e);
    }
  }

  triggerAutosave() {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
    }
    this.autosaveTimer = setTimeout(() => {
      this.saveCurrentProgress();
    }, 400);
  }

  async flushAutosave() {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    await this.saveCurrentProgress();
  }

  async saveCurrentProgress() {
    if (!this.controller) return;

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
        await this.updateSavedBadge();

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

        // Separate into in-progress, completed, and creations (0% progress)
        const inProgressList = allSaved.filter(r => (r.filledCount || 0) > 0 && !r.completed);
        const completedList = allSaved.filter(r => r.completed);
        const creationsList = allSaved.filter(r => (r.filledCount || 0) === 0 && !r.completed);

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

    const isDiamond = (record.category === 'diamond') || (record.artworkData && record.artworkData.id && record.artworkData.id.includes('diamond'));
    const modeBadgeText = isDiamond ? '💎 Diamond Painting' : '🎨 Paint by Number';
    const thumbUrl = record.thumbnailBlob ? URL.createObjectURL(record.thumbnailBlob) : '';
    const timeStr = this.formatRelativeTime(record.lastModified || record.createdAt);
    const totalPieces = record.pieces || (record.artworkData && record.artworkData.regions ? record.artworkData.regions.length : 0);
    const filled = record.filledCount || 0;
    const percent = Math.min(100, Math.round((filled / Math.max(1, totalPieces)) * 100));

    let overlayBadgeHtml = '';
    let actionBtnHtml = '';

    if (sectionType === 'in-progress') {
      overlayBadgeHtml = `<span class="progress-pill-badge">⚡ ${percent}%</span>`;
      actionBtnHtml = `
        <button class="btn-resume-card" type="button">▶ Continue</button>
        <button class="btn-reset-card" title="Reset Progress" type="button">↺</button>
        <button class="btn-delete-saved" title="Remove" type="button">🗑️</button>
      `;
    } else if (sectionType === 'completed') {
      overlayBadgeHtml = `<span class="progress-pill-badge completed">🎉 100%</span>`;
      actionBtnHtml = `
        <button class="btn-resume-card completed" type="button">👀 View</button>
        <button class="btn-export-card" title="Export High-Res PNG" type="button">💾 Export</button>
        <button class="btn-delete-saved" title="Remove" type="button">🗑️</button>
      `;
    } else {
      actionBtnHtml = `
        <button class="btn-resume-card" type="button">🎨 Color</button>
        <button class="btn-delete-saved" title="Remove" type="button">🗑️</button>
      `;
    }

    card.innerHTML = `
      <div class="artwork-thumb-wrap">
        ${thumbUrl ? `<img class="artwork-thumb-img" src="${thumbUrl}" alt="${record.title}">` : '<canvas class="artwork-thumb-canvas" width="280" height="200"></canvas>'}
        <span class="artwork-badge ${isDiamond ? 'diamond' : 'classic'}">${modeBadgeText}</span>
        ${overlayBadgeHtml}
      </div>
      <div class="artwork-info">
        <h4>${record.title}</h4>
        <span class="artwork-artist-tag">${record.artist || 'Tap Color Studio'} • ${timeStr}</span>
        
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

    // Click on card to load
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-delete-saved') || e.target.closest('.btn-reset-card') || e.target.closest('.btn-export-card')) {
        return;
      }
      this.loadSavedArtwork(record);
      document.getElementById('modal-gallery').classList.add('hidden');
    });

    // Reset progress button
    const resetBtn = card.querySelector('.btn-reset-card');
    if (resetBtn) {
      resetBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Reset progress on "${record.title}" back to 0%?`)) {
          await storage.resetArtworkProgress(record.id);
          // If this artwork is currently loaded on canvas, reload it
          if (this.currentArtworkId === record.id || (this.activeImportedRecord && this.activeImportedRecord.id === record.id)) {
            const fresh = await storage.getArtworkById(record.id);
            if (fresh) this.loadSavedArtwork(fresh);
          }
          await this.renderSavedGallery();
        }
      });
    }

    // Export button (for completed)
    const exportBtn = card.querySelector('.btn-export-card');
    if (exportBtn) {
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.loadSavedArtwork(record);
        document.getElementById('modal-gallery').classList.add('hidden');
        setTimeout(() => this.exportArtworkPng(), 200);
      });
    }

    // Delete button
    const deleteBtn = card.querySelector('.btn-delete-saved');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Remove "${record.title}" from your saved pictures?`)) {
          if (this.activeImportedRecord && this.activeImportedRecord.id === record.id) {
            this.activeImportedRecord = null;
          }
          await storage.deleteArtwork(record.id);
          await this.renderSavedGallery();
        }
      });
    }

    return card;
  }

  loadSavedArtwork(record) {
    const artwork = record.artworkData;
    if (!artwork) return;

    this.currentArtworkId = record.parentArtworkId || artwork.id;
    this.activeImportedRecord = record;
    this.highlightMatching = false;
    const btnHint = document.getElementById('btn-hint');
    const badge = document.getElementById('hint-badge');
    if (btnHint) btnHint.classList.remove('active');
    if (badge) badge.textContent = 'OFF';

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
      this.controller.load_artwork_json(JSON.stringify(artwork));
    } else if (this.controller) {
      this.controller.artwork = artwork;
      this.controller.fit_to_screen();
    }

    this.startTime = Date.now();
    this.totalTaps = 0;
    this.successfulTaps = 0;
    this.updateArtworkUI();
    this.refreshPaletteUI();
    this.updateResolutionBarUI();
  }

  loadImportedArtwork(record) {
    this.loadSavedArtwork(record);
  }

  renderThumbnail(canvas, meta) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const activeVar = meta.variants
      ? (meta.variants.find(v => v.id === (meta.selectedVariantId || meta.defaultVariantId)) || meta.variants[0])
      : null;
    const thumbUrl = activeVar ? activeVar.thumbnailUrl : meta.thumbnailUrl;

    if (thumbUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
      };
      img.src = thumbUrl;
      return;
    }

    if (meta.category === 'diamond') {
      const N = 28;
      const grid = getDiamondArtGrid(meta.id, N);
      const palette = DIAMOND_PALETTES[meta.id] || [];
      const colorMap = Object.fromEntries(palette.map(p => [p.num, p.hex]));

      const margin = 12;
      const size = Math.min(w - margin * 2, h - margin * 2);
      const cellSize = size / N;
      const ox = (w - size) / 2;
      const oy = (h - size) / 2;

      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const num = grid[r][c];
          const hex = colorMap[num] || '#FFFFFF';
          const x = ox + c * cellSize;
          const y = oy + r * cellSize;

          ctx.fillStyle = hex;
          ctx.fillRect(x, y, cellSize - 0.5, cellSize - 0.5);

          // Subtle diamond bevel shine on thumbnail
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(x, y, (cellSize - 0.5) * 0.5, (cellSize - 0.5) * 0.5);
        }
      }
    } else {
      // Classic vector thumbnail
      const s = 0.22;
      const ox = (w - 800 * s) / 2;
      const oy = (h - 800 * s) / 2;

      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(s, s);

      // Simple representative preview colors
      const fallbackEngine = new FallbackJsController(canvas, meta.id);
      fallbackEngine.artwork.regions.forEach(reg => {
        ctx.beginPath();
        ctx.moveTo(reg.polygon[0].x, reg.polygon[0].y);
        for (let i = 1; i < reg.polygon.length; i++) {
          ctx.lineTo(reg.polygon[i].x, reg.polygon[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = reg.color_hex;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      ctx.restore();
    }
  }

  setupCustomStudio() {
    let customImg = null;
    let selectedPreset = 'fluffy_cow';
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
        const bounds = detectContentBounds(customImg);
        const scale = Math.min(previewCanvas.width / bounds.sw, previewCanvas.height / bounds.sh);
        const dw = bounds.sw * scale;
        const dh = bounds.sh * scale;
        const dx = (previewCanvas.width - dw) / 2;
        const dy = (previewCanvas.height - dh) / 2;
        pCtx.drawImage(customImg, bounds.sx, bounds.sy, bounds.sw, bounds.sh, dx, dy, dw, dh);

        if (currentStudioMode === 'diamond') {
          // Draw subtle diamond gemstone grid preview mesh with sparkle highlights
          pCtx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
          pCtx.lineWidth = 0.5;
          const step = 8;
          for (let gx = dx; gx <= dx + dw; gx += step) {
            pCtx.beginPath();
            pCtx.moveTo(gx, dy);
            pCtx.lineTo(gx, dy + dh);
            pCtx.stroke();
          }
          for (let gy = dy; gy <= dy + dh; gy += step) {
            pCtx.beginPath();
            pCtx.moveTo(dx, gy);
            pCtx.lineTo(dx + dw, gy);
            pCtx.stroke();
          }
        }

        const activeBtn = document.querySelector('.btn-preset.active');
        const titleInp = document.getElementById('input-custom-title');
        if (previewCaption) {
          previewCaption.textContent = (titleInp && titleInp.value.trim()) || (activeBtn ? activeBtn.textContent.trim() : 'Custom Photo Preview');
        }
      }
    };
    this.updateStudioPreview = updateStudioPreview;
    setTimeout(() => updateStudioPreview(), 50);

    const presetButtons = document.querySelectorAll('.btn-preset');
    presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        presetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPreset = btn.dataset.key || btn.dataset.preset;
        const assetUrl = btn.dataset.asset;
        const assetTitle = btn.dataset.title;

        if (assetUrl) {
          document.getElementById('upload-filename').textContent = btn.textContent.trim();
          if (assetTitle) {
            const titleInp = document.getElementById('input-custom-title');
            if (titleInp) titleInp.value = assetTitle;
          }
          const img = new Image();
          img.onload = () => {
            customImg = img;
            updateStudioPreview();
          };
          img.src = assetUrl;
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
      const img = new Image();
      img.onload = () => {
        customImg = img;
        updateStudioPreview();
      };
      img.src = assetUrl;
    }

    const fileInput = document.getElementById('input-custom-photo');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          document.getElementById('upload-filename').textContent = file.name;
          presetButtons.forEach(b => b.classList.remove('active'));
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              customImg = img;
              updateStudioPreview();
            };
            img.src = event.target.result;
          };
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
      const assetUrl = (activeBtn && activeBtn.dataset.asset) || 'assets/fluffy-cow-3.jpeg';
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
        const modalConv = document.getElementById('modal-conversion');
        const statusEl = document.getElementById('conversion-status');
        const fillEl = document.getElementById('conversion-progress-fill');
        const titleInput = document.getElementById('input-custom-title');
        const customTitle = (titleInput && titleInput.value.trim()) || 'My Painting';

        const complexity = document.getElementById('select-vector-complexity').value || 'balanced';
        const customPaletteSize = parseInt(document.getElementById('select-vector-colors').value, 10) || 14;

        modalConv.classList.remove('hidden');
        fillEl.style.width = '10%';
        statusEl.textContent = 'Preparing your picture...';

        try {
          const source = await getActiveSourceImage();
          this.lastCustomImage = source;
          this.lastCustomTitle = customTitle;
          this.lastCustomMode = 'classic';
          this.lastCustomComplexity = complexity;
          this.lastCustomPaletteSize = customPaletteSize;
          this.currentArtworkMeta = null;
          this.currentArtworkVariant = null;

          const onProgress = (msg, pct) => {
            statusEl.textContent = msg;
            fillEl.style.width = `${pct}%`;
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

          modalConv.classList.add('hidden');
          document.getElementById('modal-gallery').classList.add('hidden');

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
          alert('Could not create coloring page: ' + err.message);
          modalConv.classList.add('hidden');
        }
      });
    }

    const btnConvertDiamond = document.getElementById('btn-convert-diamond');
    if (btnConvertDiamond) {
      btnConvertDiamond.addEventListener('click', async () => {
        const N = parseInt(document.getElementById('select-custom-grid').value, 10) || 120;
        const K = parseInt(document.getElementById('select-custom-colors').value, 10) || 26;
        const titleInput = document.getElementById('input-custom-title');
        const customTitle = (titleInput && titleInput.value.trim()) || 'Diamond Masterpiece';

        const source = await getActiveSourceImage();
        this.lastCustomImage = source;
        this.lastCustomTitle = customTitle;
        this.lastCustomMode = 'diamond';
        this.lastCustomGrid = N;
        this.lastCustomColors = K;
        this.currentArtworkMeta = null;
        this.currentArtworkVariant = null;

        this.convertImageToDiamondArt(source, selectedPreset, N, K, customTitle);
        document.getElementById('modal-gallery').classList.add('hidden');
      });
    }
  }

  convertImageToDiamondArt(img, presetName, N, K, customTitle = '') {
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

    const km = kmeans(samples, K, { initialization: 'kmeans++', maxIterations: 12 });
    const centers = km.centroids.map(c => [
      Math.min(255, Math.max(0, Math.round(c[0]))),
      Math.min(255, Math.max(0, Math.round(c[1]))),
      Math.min(255, Math.max(0, Math.round(c[2]))),
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
        for (let k = 0; k < K; k++) {
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

    const artwork = {
      id: 'custom_diamond_' + Date.now(),
      title: customTitle || 'Custom Photo Diamond Art',
      artist: 'Custom Studio Creation',
      width,
      height,
      palette,
      regions,
    };

    generateThumbnailBlob(artwork).then(blob => {
      storage.saveArtwork(artwork, blob, artwork.title).then(savedId => {
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
      });
    }).catch(e => console.warn('Could not save diamond artwork to IndexedDB:', e));

    this.currentArtworkId = artwork.id;
    if (this.controller && this.controller.load_artwork_json) {
      this.controller.load_artwork_json(JSON.stringify(artwork));
    } else if (this.controller) {
      this.controller.artwork = artwork;
      this.controller.fit_to_screen();
    }

    this.startTime = Date.now();
    this.totalTaps = 0;
    this.successfulTaps = 0;
    this.updateArtworkUI();
    this.refreshPaletteUI();
    this.updateResolutionBarUI();
  }

  async selectArtwork(id, variantId = null) {
    await this.flushAutosave();

    this.currentArtworkId = id;
    this.activeImportedRecord = null;
    this.highlightMatching = false;
    const btnHint = document.getElementById('btn-hint');
    const badge = document.getElementById('hint-badge');
    if (btnHint) btnHint.classList.remove('active');
    if (badge) badge.textContent = 'OFF';

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
        const artworkData = await res.json();
        if (this.controller && this.controller.load_artwork_json) {
          this.controller.load_artwork_json(JSON.stringify(artworkData));
        } else if (this.controller) {
          this.controller.artwork = artworkData;
          this.controller.fit_to_screen();
        }
      } catch (err) {
        console.error('Failed to load artwork JSON from ' + jsonPath, err);
        if (this.controller) {
          this.controller.load_artwork(id);
        }
      }
    } else {
      if (this.controller) {
        this.controller.load_artwork(id);
      }
    }

    this.startTime = Date.now();
    this.totalTaps = 0;
    this.successfulTaps = 0;
    this.updateArtworkUI();
    this.refreshPaletteUI();
    this.updateResolutionBarUI();
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

    if (this.currentArtworkMeta && this.currentArtworkMeta.variants) {
      const v = this.currentArtworkVariant;
      const typeLabel = isDiamond ? 'Diamond' : 'Paint';
      labelRes.textContent = v ? `${typeLabel} • ${v.name || v.label} (${v.pieces.toLocaleString()} pcs)` : `${typeLabel} Art`;
      btnRes.classList.remove('hidden');
    } else if (this.activeImportedRecord || this.lastCustomImage) {
      let count = 0;
      if (this.activeImportedRecord && this.activeImportedRecord.artworkData && this.activeImportedRecord.artworkData.regions) {
        count = this.activeImportedRecord.artworkData.regions.length;
      } else if (this.controller && this.controller.get_artwork_info_json) {
        try {
          const info = JSON.parse(this.controller.get_artwork_info_json());
          count = info.total_regions || 0;
        } catch (_) {}
      }
      labelRes.textContent = isDiamond ? `Diamond (${count.toLocaleString()} drills)` : `Paint (${count.toLocaleString()} pcs)`;
      btnRes.classList.remove('hidden');
    } else {
      btnRes.classList.remove('hidden');
    }
  }

  renderQuickStyleDropdown() {
    const isDiamond = this.getCurrentArtMode() === 'diamond';
    const togglePbn = document.getElementById('quick-toggle-pbn');
    const toggleDiamond = document.getElementById('quick-toggle-diamond');
    const optionsContainer = document.getElementById('quick-dropdown-options');
    const artTitleEl = document.getElementById('quick-dropdown-art-title');

    if (togglePbn) togglePbn.classList.toggle('active', !isDiamond);
    if (toggleDiamond) toggleDiamond.classList.toggle('active', isDiamond);

    const title = this.currentArtworkMeta ? this.currentArtworkMeta.title : (this.lastCustomTitle || 'Current Artwork');
    if (artTitleEl) artTitleEl.textContent = `${title} • Detail Level`;

    if (!optionsContainer) return;
    optionsContainer.innerHTML = '';

    const closeDropdown = () => {
      const dropdown = document.getElementById('quick-style-dropdown');
      const btn = document.getElementById('btn-resolution-switcher');
      if (dropdown) dropdown.classList.add('hidden');
      if (btn) btn.classList.remove('active');
    };

    // Case 1: Gallery Artwork
    if (this.currentArtworkMeta && this.currentArtworkMeta.variants) {
      const meta = this.currentArtworkMeta;
      const isMetaDiamond = meta.category === 'diamond';

      meta.variants.forEach(v => {
        const isActive = this.currentArtworkVariant && this.currentArtworkVariant.id === v.id;
        const item = document.createElement('div');
        item.className = `quick-dropdown-item ${isMetaDiamond ? 'diamond-item' : ''} ${isActive ? 'active' : ''}`;
        
        let icon = '🟡';
        if (v.id.includes('80') || v.id.includes('detailed')) icon = '🟢';
        if (v.id.includes('160') || v.id.includes('masterpiece')) icon = '🟣';

        item.innerHTML = `
          <div class="quick-item-left">
            <span class="quick-item-icon">${icon}</span>
            <div class="quick-item-info">
              <span class="quick-item-title">${v.name || v.label} ${isActive ? '✓' : ''}</span>
              <span class="quick-item-subtitle">${isMetaDiamond ? `${v.grid}×${v.grid} grid` : 'Clean vector contours'} • ${v.colors} colors</span>
            </div>
          </div>
          <span class="quick-item-badge">${v.pieces.toLocaleString()} pcs</span>
        `;

        item.addEventListener('click', () => {
          closeDropdown();
          if (!isActive) {
            this.selectArtwork(meta.id, v.id);
          }
        });

        optionsContainer.appendChild(item);
      });
      return;
    }

    // Case 2: Custom Photo
    if (isDiamond) {
      const diamondPresets = [
        { grid: 80, colors: 18, name: 'Cozy Canvas (80×80)', icon: '🟢', drills: 6400 },
        { grid: 120, colors: 26, name: 'Standard Kit (120×120)', icon: '🟡', drills: 14400 },
        { grid: 160, colors: 36, name: 'Masterpiece Ultra (160×160)', icon: '🟣', drills: 25600 }
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
        { complexity: 'cozy', colors: 10, name: 'Easy & Relaxing', icon: '🟢', desc: 'Larger spaces • 10 colors' },
        { complexity: 'balanced', colors: 14, name: 'Standard', icon: '🟡', desc: 'Recommended • 14 colors' },
        { complexity: 'detailed', colors: 24, name: 'Detailed', icon: '🟣', desc: 'Finer areas • 24 colors' }
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
          if (this.lastCustomImage) {
            this.lastCustomComplexity = preset.complexity;
            this.lastCustomPaletteSize = preset.colors;
            const modalConv = document.getElementById('modal-conversion');
            const statusEl = document.getElementById('conversion-status');
            const fillEl = document.getElementById('conversion-progress-fill');
            if (modalConv) modalConv.classList.remove('hidden');
            if (fillEl) fillEl.style.width = '20%';
            if (statusEl) statusEl.textContent = 'Generating Paint by Number...';

            try {
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
              alert('Could not update detail: ' + err.message);
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

    // 1. Gallery Artwork: find counterpart
    if (this.currentArtworkMeta) {
      const currentId = this.currentArtworkMeta.id;
      const baseKey = currentId.replace(/_(pbn|diamond)$/, '');
      const counterpartId = baseKey + (targetMode === 'diamond' ? '_diamond' : '_pbn');
      const counterpartMeta = this.artworksMeta.find(a => a.id === counterpartId);
      if (counterpartMeta) {
        if (dropdownQuick) dropdownQuick.classList.add('hidden');
        if (btnResSwitcher) btnResSwitcher.classList.remove('active');
        await this.selectArtwork(counterpartMeta.id);
        return;
      }
    }

    // 2. Custom Photo or Active Imported Artwork
    if (this.lastCustomImage) {
      if (dropdownQuick) dropdownQuick.classList.add('hidden');
      if (btnResSwitcher) btnResSwitcher.classList.remove('active');

      if (targetMode === 'diamond') {
        const N = this.lastCustomGrid || 120;
        const K = this.lastCustomColors || 26;
        const title = this.lastCustomTitle || 'Custom Diamond Art';
        this.convertImageToDiamondArt(this.lastCustomImage, 'custom', N, K, title);
      } else {
        const modalConv = document.getElementById('modal-conversion');
        const statusEl = document.getElementById('conversion-status');
        const fillEl = document.getElementById('conversion-progress-fill');
        if (modalConv) modalConv.classList.remove('hidden');
        if (fillEl) fillEl.style.width = '20%';
        if (statusEl) statusEl.textContent = 'Generating Paint by Number...';

        try {
          const comp = this.lastCustomComplexity || 'balanced';
          const colors = this.lastCustomPaletteSize || 14;
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
          alert('Could not convert to Paint by Number: ' + err.message);
        }
      }
    }
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

    const link = document.createElement('a');
    link.download = `${cleanTitle}_masterpiece.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
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

    const isDiamond = (artwork.id && artwork.id.includes('diamond')) || artwork.regions.length > 200;

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

      if (isFilled) {
        ctx.fillStyle = region.color_hex;
        if (isQuad) {
          ctx.fillRect(p0.x, p0.y, cellW, cellH);
        } else {
          ctx.beginPath();
          ctx.moveTo(region.polygon[0].x, region.polygon[0].y);
          for (let i = 1; i < region.polygon.length; i++) {
            ctx.lineTo(region.polygon[i].x, region.polygon[i].y);
          }
          ctx.closePath();
          ctx.fill();

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
          ctx.beginPath();
          ctx.moveTo(region.polygon[0].x, region.polygon[0].y);
          for (let i = 1; i < region.polygon.length; i++) {
            ctx.lineTo(region.polygon[i].x, region.polygon[i].y);
          }
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = '#F8FAFC';
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      }
    }
    ctx.restore();
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
    this.load_artwork(artworkId);
  }

  get is_diamond_mode() {
    return (this.artwork && this.artwork.id && this.artwork.id.includes('diamond')) || false;
  }

  load_artwork(id) {
    this.highlightMatchingTiles = false;
    if (DIAMOND_PALETTES[id]) {
      const N = 28;
      const grid = getDiamondArtGrid(id, N);
      const paletteDef = DIAMOND_PALETTES[id];
      const width = 800;
      const height = 800;
      const margin = 28;
      const avail = width - margin * 2;
      const cellSize = avail / N;
      const regions = [];
      let regId = 0;

      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const num = grid[r][c];
          const pal = paletteDef.find(p => p.num === num) || paletteDef[0];
          const x0 = margin + c * cellSize;
          const y0 = margin + r * cellSize;
          const x1 = x0 + cellSize;
          const y1 = y0 + cellSize;

          regions.push({
            id: regId++,
            number: num,
            polygon: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }],
            centroid: { x: (x0 + x1) * 0.5, y: (y0 + y1) * 0.5 },
            color_hex: pal.hex,
            is_filled: false,
            fill_anim: 0.0,
          });
        }
      }

      this.artwork = {
        id,
        title: id === 'starry_night_diamond' ? 'Van Gogh: Starry Night' : (id === 'peacock_diamond' ? 'Royal Crystal Peacock' : 'Diamond Art Masterpiece'),
        artist: 'Diamond Art Studio',
        width,
        height,
        palette: paletteDef.map(p => ({
          number: p.num,
          hex: p.hex,
          name: p.name,
          total_count: regions.filter(r => r.number === p.num).length,
          filled_count: 0,
          is_completed: false,
        })),
        regions,
      };
    } else {
      // Classic Paint by Number artwork representation
      this.artwork = {
        id,
        title: id === 'cosmic_whale' ? 'Cosmic Whale & Stars' : (id === 'stained_butterfly' ? 'Monarch Butterfly' : 'Origami Hummingbird'),
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
        ]
      };
    }
    this.activeNumber = 1;
    this.fit_to_screen();
  }

  load_procedural_mosaic(seed, paletteType) {
    this.load_artwork('starry_night_diamond');
  }

  load_artwork_json(jsonStr) {
    try {
      this.artwork = JSON.parse(jsonStr);
      this.activeNumber = 1;
      this.fit_to_screen();
      return true;
    } catch (e) {
      return false;
    }
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
    const newS = Math.min(Math.max(oldS * factor, 0.1), 10.0);
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

  toggle_matching_hints() {
    this.highlightMatchingTiles = !this.highlightMatchingTiles;
    return this.highlightMatchingTiles;
  }

  set_matching_hints(val) {
    this.highlightMatchingTiles = val;
  }

  get_matching_hints() {
    return this.highlightMatchingTiles;
  }

  handle_erase(sx, sy) {
    const wx = (sx - this.panX) / this.scale;
    const wy = (sy - this.panY) / this.scale;

    const idx = this.artwork.regions.findLastIndex(r => {
      const p0 = r.polygon[0];
      const p2 = r.polygon[2] || p0;
      const minX = Math.min(p0.x, p2.x) - 1;
      const maxX = Math.max(p0.x, p2.x) + 1;
      const minY = Math.min(p0.y, p2.y) - 1;
      const maxY = Math.max(p0.y, p2.y) + 1;
      if (wx < minX || wx > maxX || wy < minY || wy > maxY) return false;
      return this.pointInPoly(wx, wy, r.polygon);
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
        const filled = this.artwork.regions.filter(r => r.is_filled).length;
        const total = this.artwork.regions.length;
        return JSON.stringify({
          success: true,
          region_id: reg.id,
          number: reg.number,
          total_filled: filled,
          total_regions: total,
          percent: (filled / total) * 100,
        });
      }
    }
    return JSON.stringify({ success: false });
  }

  clear_all_tiles() {
    this.artwork.regions.forEach(r => {
      r.is_filled = false;
    });
    this.artwork.palette.forEach(p => {
      p.filled_count = 0;
      p.is_completed = false;
    });
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
        return this.pointInPoly(wx, wy, r.polygon);
      });
    }

    if (idx !== -1) {
      const reg = this.artwork.regions[idx];
      if (!reg.is_filled) {
        if (reg.number === this.activeNumber) {
          reg.is_filled = true;

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

    this.ctx.shadowColor = 'rgba(0,0,0,0.3)';
    this.ctx.shadowBlur = 30;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.artwork.width, this.artwork.height);
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    this.ctx.shadowColor = 'transparent';

    const pulse = Math.sin(this.pulsePhase) * 0.5 + 0.5;
    const isDiamond = this.artwork.id.includes('diamond') || (this.artwork.regions.length > 300 && this.artwork.regions[0] && this.artwork.regions[0].polygon.length === 4);

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

    // Render regions
    this.artwork.regions.forEach(region => {
      this.ctx.beginPath();
      this.ctx.moveTo(region.polygon[0].x, region.polygon[0].y);
      for (let i = 1; i < region.polygon.length; i++) {
        this.ctx.lineTo(region.polygon[i].x, region.polygon[i].y);
      }
      this.ctx.closePath();

      const isHinted = region.id === this.hintRegionId;
      const isActiveTarget = this.highlightMatchingTiles && (region.number === this.activeNumber);

      if (region.is_filled) {
        this.ctx.fillStyle = region.color_hex;
        this.ctx.fill();

        // Seam-seal stroke prevents white hairline cracks between adjacent pieces
        this.ctx.strokeStyle = region.color_hex;
        this.ctx.lineWidth = 1.4 / Math.max(0.5, this.scale);
        this.ctx.stroke();

        // 3D diamond facet luster when zoomed in
        if (isDiamond && region.polygon.length === 4 && drillScreenSize >= 10.0) {
          const p0 = region.polygon[0];
          const p1 = region.polygon[1];
          const p2 = region.polygon[2];
          const p3 = region.polygon[3];

          // Top highlight facet
          this.ctx.beginPath();
          this.ctx.moveTo(p0.x, p0.y);
          this.ctx.lineTo(p1.x, p1.y);
          this.ctx.lineTo(p3.x, p3.y);
          this.ctx.closePath();
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
          this.ctx.fill();

          // Bottom shadow facet
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.lineTo(p3.x, p3.y);
          this.ctx.closePath();
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
          this.ctx.fill();
        }
      } else {
        const unfillColor = isHinted
          ? `rgba(255, 215, 0, ${0.45 + pulse * 0.35})`
          : (isActiveTarget ? `rgba(99, 102, 241, ${0.16 + pulse * 0.12})` : '#F8FAFC');

        this.ctx.fillStyle = unfillColor;
        this.ctx.fill();

        // Seam-seal stroke for unfilled tiles
        this.ctx.strokeStyle = unfillColor;
        this.ctx.lineWidth = 1.4 / Math.max(0.5, this.scale);
        this.ctx.stroke();
      }

      if (this.showOutlines) {
        if (isHinted) {
          this.ctx.strokeStyle = '#F59E0B';
          this.ctx.lineWidth = 2.5 / Math.max(0.5, this.scale);
        } else if (isActiveTarget) {
          this.ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
          this.ctx.lineWidth = 1.2 / Math.max(0.5, this.scale);
        } else if (isDiamond) {
          this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
          this.ctx.lineWidth = 0.7 / Math.max(0.5, this.scale);
        } else {
          this.ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
          this.ctx.lineWidth = 1.2 / Math.max(0.5, this.scale);
        }
        this.ctx.stroke();
      }
    });

    // Render numbers
    const fontBaseSize = Math.max(8, Math.min(24, 14 / this.scale));
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    this.artwork.regions.forEach(region => {
      if (region.is_filled) return;
      const isHinted = region.id === this.hintRegionId;
      const isActiveTarget = this.highlightMatchingTiles && (region.number === this.activeNumber);
      const cx = region.centroid.x, cy = region.centroid.y;

      let regionWorldSize = drillWorldSize;
      let regionScreenSize = drillScreenSize;
      if (!isDiamond) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        if (region.polygon) {
          for (let i = 0; i < region.polygon.length; i++) {
            const pt = region.polygon[i];
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
          }
        }
        const spanW = Math.max(1, maxX - minX);
        const spanH = Math.max(1, maxY - minY);
        regionWorldSize = Math.max(Math.min(spanW, spanH), Math.max(spanW, spanH) * 0.45);
        regionScreenSize = regionWorldSize * this.scale;
      }

      if (isHinted) {
        const ringR = isDiamond
          ? Math.max(12 / this.scale, drillWorldSize * (0.85 + pulse * 0.25))
          : Math.min(28 / this.scale, Math.max(10 / this.scale, regionWorldSize * 0.75));
        const ringW = isDiamond
          ? Math.min(drillWorldSize * 0.22, 2.2 / this.scale)
          : Math.min(regionWorldSize * 0.2, 2.4 / this.scale);
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#F59E0B';
        this.ctx.lineWidth = ringW;
        this.ctx.stroke();
      }

      // Level of Detail: when zoomed out on high-res artworks, only draw indicator dots
      if (regionScreenSize < 13.0) {
        if (isHinted || isActiveTarget) {
          const dotR = Math.max(1.2 / this.scale, Math.min(3.5 / this.scale, regionWorldSize * 0.35));
          this.ctx.beginPath();
          this.ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
          this.ctx.fillStyle = isHinted ? '#F59E0B' : 'rgba(99, 102, 241, 0.85)';
          this.ctx.fill();
        }
      } else {
        const digits = region.number >= 100 ? 3 : (region.number >= 10 ? 2 : 1);
        const fontScale = digits >= 3 ? 0.34 : (digits === 2 ? 0.44 : 0.56);
        const maxFontWorld = 18 / this.scale;
        const fontSize = isDiamond
          ? (isHinted ? Math.min(drillWorldSize * 0.68, drillWorldSize * fontScale * 1.15) : drillWorldSize * fontScale)
          : (isHinted ? Math.min(maxFontWorld * 1.15, regionWorldSize * fontScale * 1.15) : Math.min(maxFontWorld, regionWorldSize * fontScale));
        this.ctx.font = `${isHinted || isActiveTarget ? 'bold' : '600'} ${fontSize.toFixed(2)}px 'Outfit', sans-serif`;
        this.ctx.fillStyle = isHinted ? '#B45309' : (isActiveTarget ? '#3730A3' : 'rgba(71, 85, 105, 0.75)');
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

    const isDiamond = (this.artwork.id && this.artwork.id.includes('diamond')) || (this.artwork.regions && this.artwork.regions.length > 200);

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
          ctx.beginPath();
          ctx.moveTo(region.polygon[0].x, region.polygon[0].y);
          for (let i = 1; i < region.polygon.length; i++) {
            ctx.lineTo(region.polygon[i].x, region.polygon[i].y);
          }
          ctx.closePath();
          ctx.fill();
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
          ctx.beginPath();
          ctx.moveTo(region.polygon[0].x, region.polygon[0].y);
          for (let i = 1; i < region.polygon.length; i++) {
            ctx.lineTo(region.polygon[i].x, region.polygon[i].y);
          }
          ctx.closePath();
          ctx.fill();
        }
      }

      if (this.showOutlines) {
        if (isDiamond) {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
          ctx.lineWidth = Math.max(0.5, 0.7 / s);
        } else {
          ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
          ctx.lineWidth = Math.max(0.6, 1.0 / s);
        }

        if (isQuad) {
          ctx.strokeRect(p0.x, p0.y, cellW, cellH);
        } else {
          ctx.stroke();
        }
      }
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
