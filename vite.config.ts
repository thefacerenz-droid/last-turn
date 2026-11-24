import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@dimforge')) return 'physics-engine';
          if (id.includes('/three/')) return 'graphics-engine';
        },
      },
    },
    chunkSizeWarningLimit: 2600,
  },
});
