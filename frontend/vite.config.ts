import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import dotenv from 'dotenv';
dotenv.config();

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: `${process.env.VITE_DOMAIN?.includes(process.env.VITE_PROJECT!) ? `/${process.env.VITE_PROJECT}` : ''}/${process.env.VITE_SITENAME?.toLowerCase()}`,
  build: {
    assetsInlineLimit: 0,
    outDir: '../',
    assetsDir: "dist"
  }
})
