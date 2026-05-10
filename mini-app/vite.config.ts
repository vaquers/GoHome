import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';
import tsconfigPaths from 'vite-tsconfig-paths';
import { execSync } from 'child_process';

function getGitCommitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  base: '/',
  define: {
    __BUILD_COMMIT__: JSON.stringify(getGitCommitSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern',
      },
    },
  },
  plugins: [
    react(),
    tsconfigPaths(),
    process.env.HTTPS && mkcert(),
  ],
  build: {
    target: 'esnext',
    minify: 'terser',
  },
  publicDir: './public',
  server: {
    host: false,
    allowedHosts: ['.ngrok-free.app'],
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
