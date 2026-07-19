import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const pkgRoot = path.resolve(__dirname, '../packages/expression-alignment');

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2024-11-01',
    devtools: { enabled: true },
    experimental: {
        appManifest: false,
    },
    ssr: false, // Electron クライアントで動かすために SSR はオフにする
    srcDir: 'src/', // 既存の src/ ディレクトリを Nuxt のルートにする
    devServer: {
        port: 3000,
        host: 'localhost'
    },
    css: [
        '@/styles/main.css'
    ],

    modules: [
        '@nuxtjs/tailwindcss',
        '@pinia/nuxt'
    ],

    // TailwindCSS の設定
    tailwindcss: {
        exposeConfig: true,
        viewer: true
    },

    // ビルド設定とエイリアス
    alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@prompt': fileURLToPath(new URL('./src/skills/tool-use/prompts', import.meta.url)),
        '@tonarice/expression-alignment/adapters/opencv-browser':
            path.resolve(pkgRoot, 'adapters/opencv-browser.ts'),
        '@tonarice/expression-alignment': path.resolve(pkgRoot, 'src/index.ts'),
        '@techstark/opencv-js': path.resolve(pkgRoot, 'node_modules/@techstark/opencv-js'),
    },

    // Nitro サーバー（バックエンド）の設定
    nitro: {
        // バックエンド API や WebSocket サーバーを Nitro 上で動作させる
        experimental: {
            websocket: true
        }
    },

    vite: {
        server: {
            hmr: {
                protocol: 'ws',
            },
            fs: {
                // ワークスペース全体を dev server から参照できるように許可
                allow: [
                    path.resolve(__dirname, '..'),
                ]
            }
        }
    }
});
