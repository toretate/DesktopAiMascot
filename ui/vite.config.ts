import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { fileURLToPath, URL } from 'node:url';
import path from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const pkgRoot = path.resolve(__dirname, '../packages/expression-alignment');

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
                vite: {
                    build: {
                        rollupOptions: {
                            // ws のオプション依存（ネイティブモジュール）をバンドル対象から除外
                            external: ['bufferutil', 'utf-8-validate'],
                        },
                    },
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
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            // expression-alignment パッケージ（TS ソースを直接参照）
            '@desktop-ai-mascot/expression-alignment': path.resolve(pkgRoot, 'src/index.ts'),
            '@desktop-ai-mascot/expression-alignment/adapters/opencv-browser':
                path.resolve(pkgRoot, 'adapters/opencv-browser.ts'),
            // @techstark/opencv-js はパッケージの node_modules から解決
            '@techstark/opencv-js': path.resolve(pkgRoot, 'node_modules/@techstark/opencv-js'),
        }
    },
    server: {
        fs: {
            // パッケージソースを dev server から参照できるよう許可
            allow: ['../packages'],
        }
    },
    optimizeDeps: {
        exclude: ['@desktop-ai-mascot/expression-alignment'],
    },
});
