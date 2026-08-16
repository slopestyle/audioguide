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
  },
});
