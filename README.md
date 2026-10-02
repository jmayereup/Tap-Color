# 🎨 Tap Color • WebAssembly Art Studio

A relaxing, high-performance **Tap to Color** (Color-by-Number) game targeting the browser via **WebAssembly (WASM)** compiled from **Rust**, rendering directly to an HTML5 `<canvas>` using `web-sys` and `wasm-bindgen`.

---

## ⚡ Fedora Linux Setup Guide

To build and run this project in your Fedora environment, run the following steps in your terminal:

### 1. Install Fedora Development Tools
Install the standard C/C++ compiler and toolchain (needed for linker tooling and native utilities):
```bash
sudo dnf install -y gcc gcc-c++ make clang lld
```

### 2. Configure Rust & WebAssembly Target
Ensure Rust is in your current shell's `PATH` and install the `wasm32-unknown-unknown` compilation target:
```bash
# Load Rust environment into current shell
source "$HOME/.cargo/env"

# Add WebAssembly target
rustup target add wasm32-unknown-unknown
```

### 3. Install `wasm-pack`
`wasm-pack` manages building, optimizing, and generating JavaScript glue code for Rust WASM modules:
```bash
# Official installer script
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```
*(Alternatively: `cargo install wasm-pack`)*

---

## 🚀 Building & Running the Project

From this folder (`/home/jmayer/Dev/Tap-Color`):

### 1. Compile the Rust WebAssembly Package
```bash
wasm-pack build --target web --out-dir pkg
```
This generates the optimized `.wasm` binary and JavaScript interop bindings in the `pkg/` directory.

### 2. Launch Local Web Server
You can launch using any of the following:

**Using Vite (Recommended for hot reload):**
```bash
npm install
npm run dev
```

**Or using Python:**
```bash
python3 -m http.server 8080
```

**Or using npx serve:**
```bash
npx serve .
```

Open your browser at `http://localhost:5173` (or `http://localhost:8080`).

---

## 🌟 Game Features

- **Blazing Fast WebAssembly Engine**: Point-in-polygon raycasting, camera transformation matrices, particle animations, and canvas rendering written in pure Rust.
- **Multiple Hand-Crafted Artworks**:
  - *Origami Hummingbird & Blossoms*
  - *Cosmic Whale & Constellations*
  - *Stained Glass Monarch Butterfly*
  - *Geometric Sunset Mountains*
- **Procedural Stained Glass Generator**: Generate unlimited Voronoi stained-glass mosaics with custom color palettes (Sunset, Emerald, Neon Cyber).
- **Interactive Assistance Tools**:
  - **Hint Spotlight**: Locates hidden uncompleted pieces and smoothly pans/zooms the camera.
  - **Magic Wand (Fill Color)**: Instantly completes the active color group.
  - **Toggle Outlines**: Clean line-art switch to admire the artwork with or without border strokes.
- **Relaxing Audio Experience**: Built-in harmonic pentatonic synthesizer using the Web Audio API that dynamically plays pleasant notes as you color.
- **Mobile & Desktop Controls**: Smooth mouse drag pan, wheel zoom, single-touch tap, and multi-touch pinch-to-zoom.
- **Victory Screen & Export**: Confetti celebrations, completion stats (time, accuracy, total pieces), and high-resolution PNG image download.
