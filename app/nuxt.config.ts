import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const pkgRoot = path.resolve(__dirname, '../packages/expression-alignment');

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2024-11-01',
    devtools: { enabled: true },
    experimental: {
        appManifest: true,
    },
    ssr: false, // Electron クライアントで動かすために SSR はオフにする
    srcDir: 'src/', // 既存の src/ ディレクトリを Nuxt のルートにする
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
        '@desktop-ai-mascot/expression-alignment/adapters/opencv-browser':
            path.resolve(pkgRoot, 'adapters/opencv-browser.ts'),
        '@desktop-ai-mascot/expression-alignment': path.resolve(pkgRoot, 'src/index.ts'),
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
        resolve: {
            alias: {
                // Vite 6 + Nuxt 3.15 + ssr: false のデッドコードにおける解析バグの回避策
                '#app-manifest': fileURLToPath(new URL('./src/main.ts', import.meta.url))
            }
        },
        server: {
            fs: {
                // ワークスペース全体を dev server から参照できるように許可
                allow: [
                    path.resolve(__dirname, '..'),
                ]
            }
        }
    }
});
