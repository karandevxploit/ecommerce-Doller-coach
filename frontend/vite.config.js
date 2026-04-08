import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"
import { fileURLToPath } from "url"
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: 'Doller Coach',
        short_name: 'DollerCoach',
        description: 'Premium eCommerce Store',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'vendor';
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
    proxy: {
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ["@react-oauth/google", "leaflet", "react-leaflet"],
  },
})
