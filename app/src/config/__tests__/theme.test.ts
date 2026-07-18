import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    APP_THEME_STORAGE_KEY,
    DEFAULT_APP_THEME,
    applyAppTheme,
    getStoredAppTheme,
    initializeAppTheme,
    isAppTheme,
} from '../theme';

describe('theme', () => {
    const storage = new Map<string, string>();
    const documentElement = { dataset: {} as Record<string, string> };

    beforeEach(() => {
        storage.clear();
        documentElement.dataset = {};
        vi.stubGlobal('document', { documentElement });
        vi.stubGlobal('window', {
            localStorage: {
                getItem: (key: string) => storage.get(key) ?? null,
                setItem: (key: string, value: string) => storage.set(key, value),
            },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('isAppTheme_Purpleのみ有効なテーマとして判定する', () => {
        expect(isAppTheme('purple')).toBe(true);
        expect(isAppTheme('blue')).toBe(false);
        expect(isAppTheme(null)).toBe(false);
    });

    it('getStoredAppTheme_未保存または不正値なら既定テーマを返す', () => {
        expect(getStoredAppTheme()).toBe(DEFAULT_APP_THEME);
        storage.set(APP_THEME_STORAGE_KEY, 'unknown');
        expect(getStoredAppTheme()).toBe(DEFAULT_APP_THEME);
    });

    it('applyAppTheme_テーマをDOMとLocalStorageへ適用する', () => {
        applyAppTheme('purple');

        expect(documentElement.dataset.theme).toBe('purple');
        expect(storage.get(APP_THEME_STORAGE_KEY)).toBe('purple');
    });

    it('initializeAppTheme_保存済みテーマを永続化せずDOMへ復元する', () => {
        storage.set(APP_THEME_STORAGE_KEY, 'purple');

        expect(initializeAppTheme()).toBe('purple');
        expect(documentElement.dataset.theme).toBe('purple');
    });
});
