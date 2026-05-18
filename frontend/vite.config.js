import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  root: __dirname,
  publicDir: path.resolve(__dirname, "public"),
  cacheDir: path.resolve(__dirname, "node_modules/.vite"),
  envPrefix: "VITE_",
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    minify: "oxc",
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 900,
    modulePreload: false,
    reportCompressedSize: false,
    rolldownOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('react')) return 'vendor_react';
            if (id.includes('@tanstack/react-query') || id.includes('axios') || id.includes('zustand')) return 'vendor_data';
            if (id.includes('framer-motion') || id.includes('lucide-react') || id.includes('react-icons')) return 'ui';
            if (id.includes('leaflet')) return 'maps';
            if (id.includes('recharts')) return 'charts';
            return 'vendor_core';
          }
        }
      }
    }
  },
  server: {
    port: 3000,
    strictPort: false,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "unvitally-nontidal-jordynn.ngrok-free.dev",
      ".ngrok-free.dev",
    ],
    proxy: {
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ["@react-oauth/google", "leaflet", "react-leaflet", "@tanstack/react-query"],
  },
})
