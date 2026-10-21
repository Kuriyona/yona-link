import { fileURLToPath, URL } from 'node:url';
import { VarletImportResolver } from '@varlet/import-resolver';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/panel/',
  plugins: [
    vue(),
    Components({
      resolvers: [VarletImportResolver()],
      dts: false
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    proxy: {
      '/api': {
        target:
          process.env.API_PROXY_TARGET ?? `http://localhost:${process.env.WORKER_PORT ?? 8787}`
      }
    }
  },
  build: {
    // 直接产出到 Worker 的静态资源目录：Worker 以 /panel 提供管理面板。
    outDir: '../worker/public/panel',
    emptyOutDir: true,
    sourcemap: false
  }
});
