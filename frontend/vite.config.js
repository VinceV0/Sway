import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // <--- Make sure this has the slash @vitejs/plugin-react

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  base: './', // Ensures relative asset paths when served by Python
})