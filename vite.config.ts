import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// base — подпуть GitHub Pages (slopestyle.github.io/audioguide/).
// При переезде на собственный домен меняется на '/'.
export default defineConfig({
  base: '/audioguide/',
  plugins: [preact()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      // Отдельная точка входа: код админки не попадает в гостевой бандл.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
      },
    },
  },
});
