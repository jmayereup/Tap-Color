import { defineConfig } from 'vite';
import fs from 'node:fs';

export default defineConfig({
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    open: false,
    fs: {
      allow: ['.']
    }
  },
  plugins: [
    {
      name: 'copy-wasm-pkg',
      closeBundle() {
        if (fs.existsSync('pkg')) {
          fs.cpSync('pkg', 'dist/pkg', { recursive: true });
        }
      }
    }
  ]
});

