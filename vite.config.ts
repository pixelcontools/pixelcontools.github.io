import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: 'docs',
    sourcemap: true,
    rollupOptions: {
      // Externalize onnxruntime-web: @imgly/background-removal loads the ONNX
      // runtime + WASM + model from IMG.LY CDN at runtime, so we don't need to
      // bundle the ~23 MB WASM or ~800 KB ORT JS into our output.
      external: [/^onnxruntime/],
    },
  },
})
