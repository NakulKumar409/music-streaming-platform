import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: '0.0.0.0'
  },
  resolve: {
    alias: {
      'shaka-player/dist/shaka-player.ui': path.resolve(__dirname, 'node_modules/shaka-player/dist/shaka-player.ui.js'),
      'shaka-player': path.resolve(__dirname, 'node_modules/shaka-player/dist/shaka-player.ui.js')
    }
  }
});
