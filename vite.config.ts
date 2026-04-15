import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3217,
    strictPort: false,
    open: false,
  },
  preview: {
    host: "0.0.0.0",
    port: 4217,
    strictPort: false,
  },
});
