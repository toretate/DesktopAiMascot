import path from 'path';
import fs from 'fs';

export function getProjectRoot(): string {
    const cwd = process.cwd();
    if (fs.existsSync(path.join(cwd, 'config.json'))) {
        return cwd;
    }
    const parent = path.resolve(cwd, '..');
    if (fs.existsSync(path.join(parent, 'config.json'))) {
        return parent;
    }
    return cwd;
}

export const PROJECT_ROOT = getProjectRoot();

// ユーザーデータの保存先
export const USERS_DIR = path.join(PROJECT_ROOT, 'storage/users');
export const USERS_FILE_PATH = path.join(PROJECT_ROOT, 'storage/users.json');

// Python関連
export const VISION_DIR = path.join(PROJECT_ROOT, 'python-services/vision');
export const PYTHON_DIR = path.join(PROJECT_ROOT, 'python-services');

// 設定・履歴テンプレート
export const CONFIG_TEMPLATE_PATH = path.join(PROJECT_ROOT, 'config.json');
export const HISTORY_TEMPLATE_PATH = path.join(PROJECT_ROOT, 'chat_history.json');

/**
 * リクエストされた /mascots/... パスからローカルファイルシステム上の絶対パスを解決する。
 * @param requestPath "/mascots/users/xxx/image.png" や "/mascots/mascot_xxx/image.png"
 */
export function resolveMascotPath(requestPath: string): string {
    const subpath = requestPath.startsWith('/mascots/')
        ? requestPath.substring('/mascots/'.length)
        : requestPath;

    const decodedSubpath = decodeURIComponent(subpath);

    // 1. ユーザー固有のプライベートデータの場合 ("users/{userId}/...")
    if (decodedSubpath.startsWith('users/')) {
        const parts = decodedSubpath.split('/');
        const userId = parts[1];
        if (userId) {
            const mascotSubpath = parts.slice(2).join('/');
            return path.resolve(USERS_DIR, userId, 'mascots', mascotSubpath);
        }
    }

    // 2. プリセット（共通）アセットの場合
    const isDev = process.env.NODE_ENV !== 'production';
    const appDirName = fs.existsSync(path.resolve(PROJECT_ROOT, 'app')) ? 'app' : 'ui';
    const publicMascotsBase = isDev
        ? path.resolve(PROJECT_ROOT, `${appDirName}/src/public/mascots`)
        : path.resolve(PROJECT_ROOT, `${appDirName}/.output/public/mascots`);

    return path.resolve(publicMascotsBase, decodedSubpath);
}
