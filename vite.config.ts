import { defineConfig } from 'vite'
import viteCompression from 'vite-plugin-compression';

// https://vitejs.dev/config/

export default defineConfig({
  server:{
    host: '0.0.0.0',
    strictPort: true,
    port: 3000,
  },
  resolve: {
    alias: {
      "@src": ["/src"]
    }
  },
  build:{
    watch: true,
    minify: true,
    reportCompressedSize: true,
    lib: {
      entry: './src/lib.ts',
      name: 'Pico',
      formats: ['umd'],
    },
    outDir: './build'
  },
  plugins: [viteCompression({algorithm:'gzip'})]
})

