import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // The Sword Quest game lives in its own top-level /game folder (a
    // plain static HTML/JS/canvas game, not part of the React app) rather
    // than inside /public, so it reads as a clearly separate project in
    // the repo. This plugin serves it at /game during `npm run dev` and
    // copies it into dist/game on `npm run build`, so it still ends up
    // reachable at the same /game/index.html URL either way.
    viteStaticCopy({
      targets: [{ src: 'game', dest: '.' }],
    }),
  ],
  build: {
    // Default is 500kb; we intentionally split heavy 3D vendor code into
    // its own chunk below, so raise the warning threshold slightly instead
    // of silencing real regressions elsewhere.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split rarely-changing, heavy vendor code away from app code so:
        // 1) the browser can fetch/parse it in parallel with app code,
        // 2) it stays cached across deploys where only app code changes,
        // 3) the React.lazy() imports in the app can actually defer
        //    loading it instead of it all living in one eagerly-executed
        //    bundle. Vite 8's rolldown bundler requires a function here
        //    rather than the classic object-map form.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('node_modules/three')) return 'three';
          if (
            id.includes('@react-three/fiber') ||
            id.includes('@react-three/drei') ||
            id.includes('@react-three/postprocessing')
          ) {
            return 'r3f-vendor';
          }
          if (id.includes('framer-motion')) return 'motion-vendor';
          return undefined;
        },
      },
    },
  },
  // Strip debug-only statements from production output. Vite 8's rolldown
  // bundler reads this via `oxc` rather than the classic `esbuild` option.
  oxc: {
    compilerOptions: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
  },
}))
