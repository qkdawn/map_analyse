import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      vue: 'vue/dist/vue.esm-bundler.js',
    },
  },
  base: '/static/frontend/',
  build: {
    outDir: '../static/frontend',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/vue/') || id.includes('/pinia/')) return 'vendor-vue'
            return 'vendor'
          }
          if (id.includes('/src/features/road/') || id.includes('/src/map/')) return 'feature-road-map'
          if (id.includes('/src/features/h3/')) return 'feature-h3'
          if (id.includes('/src/features/history/')) return 'feature-history'
          if (id.includes('/src/features/export/')) return 'feature-export'
          if (id.includes('/src/features/poi/')) return 'feature-poi'
          if (id.includes('/src/features/isochrone/')) return 'feature-isochrone'
          if (id.includes('/src/stores/')) return 'feature-stores'
          return undefined
        },
      },
    },
  },
})
