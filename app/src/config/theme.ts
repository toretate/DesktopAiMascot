export const APP_THEMES = ['purple'] as const;

export type AppTheme = typeof APP_THEMES[number];

export const DEFAULT_APP_THEME: AppTheme = 'purple';
export const DEFAULT_ACCENT_COLOR = '#8b5cf6';
export const APP_THEME_STORAGE_KEY = 'appTheme';

export function isAppTheme(value: string | null): value is AppTheme {
    return value !== null && APP_THEMES.includes(value as AppTheme);
}

export function getStoredAppTheme(): AppTheme {
    if (typeof window === 'undefined') {
        return DEFAULT_APP_THEME;
    }

    try {
        const storedTheme = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
        return isAppTheme(storedTheme) ? storedTheme : DEFAULT_APP_THEME;
    } catch {
        return DEFAULT_APP_THEME;
    }
}

export function applyAppTheme(theme: AppTheme, persist = true): void {
    if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = theme;
    }

    if (!persist || typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(APP_THEME_STORAGE_KEY, theme);
    } catch {
        // LocalStorageが利用できない環境でもテーマ適用自体は継続する
    }
}

export function initializeAppTheme(): AppTheme {
    const theme = getStoredAppTheme();
    applyAppTheme(theme, false);
    return theme;
}
