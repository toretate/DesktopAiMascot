import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useConfigStore } from './config';

export interface User {
    email: string;
    sub: string;
    role: string;
}

export const useAuthStore = defineStore('auth', () => {
    const configStore = useConfigStore();
    
    // ---- State ----
    const user = ref<User | null>(null);
    const isInitialized = ref(false);

    // ---- Getters ----
    const isAuthenticated = computed(() => !!user.value);

    // サーバーのベースURLを構築
    const serverBaseUrl = computed(() => {
        return `http://${configStore.serverHost}:${configStore.serverPort}`;
    });

    // ---- Actions ----
    // ログインステータスをサーバーに問い合わせる
    const checkAuthStatus = async (): Promise<boolean> => {
        if (!configStore.useServer) {
            // サーバー連携が無効な場合は認証スルー
            user.value = null;
            isInitialized.value = true;
            return false;
        }

        try {
            const url = `${serverBaseUrl.value}/api/auth/status`;
            const response = await fetch(url, {
                method: 'GET',
                // credentials: 'include' により、クロスオリジン時でもCookieを自動同封する
                credentials: 'include'
            });

            if (response.ok) {
                const resJson = await response.json();
                if (resJson.success && resJson.user) {
                    user.value = resJson.user;
                    isInitialized.value = true;
                    return true;
                }
            }
        } catch (e: any) {
            console.warn('[AuthStore] 認証ステータスの確認に失敗しました:', e.message);
        }

        user.value = null;
        isInitialized.value = true;
        return false;
    };

    // Googleログインプロセスの開始
    const login = () => {
        if (window.electronAPI) {
            console.log('[AuthStore] Electron経由でGoogleログインを開始します');
            window.electronAPI.loginWithGoogle();
        } else {
            // Webブラウザで動作している場合は、直接リダイレクトする
            const url = `${serverBaseUrl.value}/api/auth/login`;
            window.location.href = url;
        }
    };

    // ログアウト処理
    const logout = async () => {
        try {
            const url = `${serverBaseUrl.value}/api/auth/logout`;
            await fetch(url, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (e: any) {
            console.error('[AuthStore] ログアウトAPI呼び出し失敗:', e.message);
        } finally {
            user.value = null;
        }
    };

    return {
        user,
        isInitialized,
        isAuthenticated,
        checkAuthStatus,
        login,
        logout
    };
});
