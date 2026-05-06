import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:3002'
  return {
    plugins: [react()],
    server: {
      port: 5173,
      /** Opens your default browser when you run `npm run dev` (or root `npm run dev`). */
      open: true,
      proxy: {
        '/api': { target, changeOrigin: true },
      },
    },
  }
})
