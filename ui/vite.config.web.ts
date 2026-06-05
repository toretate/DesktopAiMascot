import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// Web版専用のVite設定（Electron依存をすべて除外）
export default defineConfig({
    root: 'web',
    plugins: [
        vue()
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    build: {
        outDir: '../dist-web',
        emptyOutDir: true
    }
});
