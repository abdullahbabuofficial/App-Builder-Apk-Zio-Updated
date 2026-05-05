import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  // Port 5174 so it doesn't collide with pushcare-admin (5173).
  server: { port: 5174, host: true },
});
