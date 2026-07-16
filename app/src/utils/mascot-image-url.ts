export interface MascotImageUrlOptions {
    serverHost: string;
    serverPort: number;
    absoluteMascotUrl?: boolean;
}

/**
 * 実行環境に応じてAPI・画像配信サーバーのオリジンを解決する。
 * Web版では閲覧中のホストを使用し、Electron版では設定された接続先を使用する。
 */
export function resolveServerOrigin(serverHost: string, serverPort: number): string {
    if (typeof window !== 'undefined' && (!window.electronAPI || window.electronAPI.isWeb)) {
        return window.location.origin;
    }

    return `http://${serverHost}:${serverPort}`;
}

/**
 * 永続化済みのマスコット画像パスを描画用URLへ変換する。
 * アセット単位の版数はpath自身の?v=を使用し、グローバル版数は付与しない。
 */
export function resolveMascotImageUrl(
    path: string | undefined | null,
    options: MascotImageUrlOptions
): string {
    if (!path) return '';
    if (path.startsWith('data:image/') || path.startsWith('blob:')) return path;

    if (path.startsWith('/mascots/') && options.absoluteMascotUrl) {
        return `${resolveServerOrigin(options.serverHost, options.serverPort)}${path}`;
    }

    return path;
}
