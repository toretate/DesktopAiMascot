import { defineNuxtPlugin } from 'nuxt/app';

const canRegisterServiceWorker = (): boolean => {
    if (!('serviceWorker' in navigator) || import.meta.dev) {
        return false;
    }

    // Electron版のキャッシュ戦略には影響させず、スマートフォンWeb版だけを対象にする。
    return typeof window.electronAPI === 'undefined';
};

export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.hook('app:mounted', () => {
        if (!canRegisterServiceWorker()) {
            return;
        }

        navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
            console.warn('[PWA] Service Workerの登録に失敗しました。', error);
        });
    });
});
