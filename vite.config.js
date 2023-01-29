import { defineConfig } from 'vite'
import viteCompression from 'vite-plugin-compression';
// https://vitejs.dev/config/

export default defineConfig({
  server:{
    host: 'localhost',
    strictPort: true,
    port: 3000,
    proxy:{
      "/api":{
        target: 'http://localhost:3000',
        changeOrigin: false,
        rewrite: path => path.replace(/^\/api/, '/mocks')+".json"
      }
    }
  },
  resolve: {
    alias: {
      "@src": ["/src"]
    }
  },
  build:{
    watch: true,
    minify: 'terser',
    terserOptions:{mangle: {toplevel: true}, compress: {dead_code: false}},
    reportCompressedSize: true,
    lib: {
      entry: './src/lib.ts',
      name: 'Kunai',
      formats: ['umd'],
    },
    outDir: './build'
  },
  plugins: [viteCompression({algorithm: 'brotliCompress'})]
})

