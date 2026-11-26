/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Rewrites the built index.html to load the bundle as a classic script
 * instead of an ES module, so the portable build works from file:// URLs.
 */
function classicScripts(): Plugin {
  return {
    name: 'classic-scripts',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html
          .replace(/<script type="module" crossorigin/g, '<script defer')
          .replace(/<script type="module"/g, '<script defer'),
    },
  }
}

// https://vite.dev/config/
// `vite build --mode portable` produces a file://-compatible classic-script
// build in dist-portable/; the default build stays an ES module build.
export default defineConfig(({ mode }) => {
  const portable = mode === 'portable'
  return {
    base: portable ? './' : '/',
    plugins: [react(), ...(portable ? [classicScripts()] : [])],
    build: portable
      ? {
          outDir: 'dist-portable',
          modulePreload: false,
          rollupOptions: {
            output: { format: 'iife' as const, inlineDynamicImports: true },
          },
        }
      : {},
    test: {
      environment: 'jsdom',
    },
  }
})
