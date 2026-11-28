/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * The dev server proxies the API to the viewer server; its address comes
 * from server.config.json (IN1, AC3).
 */
function serverAddress(): string {
  const config = JSON.parse(
    readFileSync(new URL('./server.config.json', import.meta.url), 'utf8'),
  ) as { host?: string; port?: number }
  return `http://${config.host ?? '127.0.0.1'}:${config.port ?? 5180}`
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': serverAddress() },
  },
  test: {
    environment: 'node',
  },
})
