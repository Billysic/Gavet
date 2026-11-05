import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    {
      name: 'html-minify-plugin',
      apply: 'build',
      transformIndexHtml(html) {
        return html
          .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
          .replace(/[ \t\r\n]+/g, ' ')
          .replace(/>\s+</g, '><')
          .trim();
      }
    }
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  esbuild: {
    legalComments: 'none',
    pure: ['console.log', 'console.debug', 'console.trace', 'console.info']
  },
  build: {
    target: 'es2020',
    cssMinify: true,
    minify: 'esbuild',
    chunkSizeWarningLimit: 800,
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            return 'vendor';
          }
        },
        compact: true
      }
    }
  }
});
