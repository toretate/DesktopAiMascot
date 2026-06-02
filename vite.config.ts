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
                onstart(options) {
                    if (process.env.VSCODE_DEBUG) {
                        console.log('VS Code Debug mode: Skip auto startup');
                    } else {
                        options.startup();
                    }
                },
            },
            {
                // プリロードスクリプトのエントリーポイント
                entry: 'electron/preload.ts',
                onstart(options) {
                    options.reload();
                },
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
