import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: 'http://127.0.0.1:3001',
          ws: true,
          changeOrigin: true,
          secure: false,
        }
      }
    },
    plugins: [react(), basicSsl()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-leaflet': ['leaflet', 'react-leaflet', 'leaflet.markercluster', 'react-leaflet-cluster'],
            'vendor-d3': ['d3'],
            'vendor-pdf': ['jspdf', 'html2canvas'],
            'vendor-zip': ['jszip'],
            'vendor-motion': ['framer-motion'],
            'vendor-stripe': ['@stripe/react-stripe-js', '@stripe/stripe-js'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
  };
});
