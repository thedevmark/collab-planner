import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { resolve } from "node:path";

// HTTPS in dev (basicSsl) is required by Twitch Local Test — the dashboard
// iframes panel.html / config.html and browsers block mixed content. The
// self-signed cert prompts a browser warning the first time; accept it for
// localhost:5173 and the warning won't come back.
export default defineConfig({
  plugins: [react(), basicSsl()],
  base: "./",
  server: {
    host: "localhost",
    port: 5173,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        panel: resolve(__dirname, "panel.html"),
        config: resolve(__dirname, "config.html"),
        // Mobile reuses panel.tsx; see mobile.html for why.
        mobile: resolve(__dirname, "mobile.html"),
      },
    },
    minify: false,
  },
});
