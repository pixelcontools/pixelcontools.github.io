import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// In dev mode, Vite's SPA fallback intercepts /help/ before the public-dir
// static file server can handle it.  This middleware runs first and serves
// public/help/index.html directly.
const serveHelpPage: Plugin = {
  name: 'serve-help-page',
  configureServer(server) {
    server.middlewares.use('/help/', (_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(readFileSync(resolve(__dirname, 'public/help/index.html')))
    })
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), serveHelpPage],
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
