import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GHP_BASE is set by the GitHub Pages workflow to '/<repo-name>/';
// local dev and preview stay at '/'.
export default defineConfig({
  base: process.env.GHP_BASE ?? '/',
  plugins: [react()],
})
