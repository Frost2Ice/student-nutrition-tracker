import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [vue(), viteSingleFile(), cloudflare()],
  build: { target: 'es2017', cssCodeSplit: false, assetsInlineLimit: 100000000 },
});