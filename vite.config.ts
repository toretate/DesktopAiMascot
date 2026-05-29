import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        electron([
            {
                // メインプロセスのエントリーポイント
                entry: 'electron/main.ts',
            },
            {
                // プリロードスクリプトのエントリーポイント
                entry: 'electron/preload.ts',
            },
        ]),
        renderer(),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    }
});
