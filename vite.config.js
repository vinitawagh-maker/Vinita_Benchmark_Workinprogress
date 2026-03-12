import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ command, mode }) => {
  const isDev = mode === 'development';

  return {
    // Base public path (GitHub Pages uses repo subpath in production)
    base: isDev ? '/' : '/VinitaBenchmark/',

    // Root directory
    root: '.',

    // Public directory for static assets
    publicDir: 'public',

    // Path aliases
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@styles': resolve(__dirname, 'src/styles'),
        '@components': resolve(__dirname, 'src/ui/components'),
        '@features': resolve(__dirname, 'src/features'),
        '@utils': resolve(__dirname, 'src/utils'),
        '@services': resolve(__dirname, 'src/services'),
        '@core': resolve(__dirname, 'src/core'),
      }
    },

    // Server configuration
    server: {
      port: 3000,
      open: true,
      cors: true,
      hmr: {
        overlay: true
      }
    },

    // Build configuration
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: !isDev,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false, // Keep console logs for now
          drop_debugger: !isDev
        }
      },

      // Chunk size warning limit
      chunkSizeWarningLimit: 600,

      // Rollup options
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html')
        },
        output: {
          // Manual chunk splitting for better caching
          manualChunks: {
            'vendor-charts': ['chart.js'],
            'vendor-pdf': ['pdfjs-dist', 'html2pdf.js']
          },
          // Asset file naming
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];

            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return `assets/images/[name]-[hash][extname]`;
            } else if (/woff|woff2|eot|ttf|otf/i.test(ext)) {
              return `assets/fonts/[name]-[hash][extname]`;
            } else if (ext === 'css') {
              return `assets/styles/[name]-[hash][extname]`;
            }

            return `assets/[name]-[hash][extname]`;
          },

          // Chunk file naming
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js'
        }
      },

      // Target browsers
      target: 'es2015',

      // CSS code splitting
      cssCodeSplit: true
    },

    // Optimizations
    optimizeDeps: {
      include: ['chart.js', 'pdfjs-dist', 'html2pdf.js'],
      exclude: []
    },

    // CSS options
    css: {
      devSourcemap: isDev
    },

    // Define global constants
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '2.0.0'),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString())
    }
  };
});

