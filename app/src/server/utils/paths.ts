import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// プロジェクトルートの目印となるファイル/ディレクトリ。
// config.json はこのリポジトリのルートにのみ存在するため最優先の目印にする。
// （app/ には package.json があるため、package.json は目印に使わない）
const ROOT_MARKERS = ['config.json', '.git'];

// 指定ディレクトリから上方向へ marker を探索し、最初に見つかった階層を返す
function findUpward(startDir: string, marker: string): string | null {
    let dir = path.resolve(startDir);
    while (true) {
        if (fs.existsSync(path.join(dir, marker))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) return null; // ファイルシステムのルートに到達
        dir = parent;
    }
}

// このソースファイルの場所を取得する（cwd 非依存の安定した起点）
function getCurrentFileDir(): string | null {
    try {
        return path.dirname(fileURLToPath(import.meta.url));
    } catch {
        // CJS など import.meta が使えない環境では __dirname にフォールバック
        return typeof __dirname !== 'undefined' ? __dirname : null;
    }
}

/**
 * プロジェクトルートを cwd に依存せず解決する。
 * このファイルの位置（安定）を起点に上方向へ ROOT_MARKERS を探索し、
 * 見つからなければ cwd から探索、それも無ければ cwd を返す。
 */
export function getProjectRoot(): string {
    const starts = [getCurrentFileDir(), process.cwd()].filter(
        (d): d is string => !!d
    );
    // config.json → .git の優先順で、各起点を上方向に探索する
    for (const marker of ROOT_MARKERS) {
        for (const start of starts) {
            const found = findUpward(start, marker);
            if (found) return found;
        }
    }
    return process.cwd();
}

export const PROJECT_ROOT = getProjectRoot();

/**
 * ユーザーデータ（tasks/config/history/mascots など）の保存先ルート。
 * サーバー管理者は環境変数 MASCOT_STORAGE_DIR で任意の場所を指定できる。
 * 相対パスが指定された場合は PROJECT_ROOT 基準で解決する（cwd 非依存）。
 * 未指定時は従来どおり PROJECT_ROOT/storage を使う。
 */
export function getStorageDir(): string {
    const envDir = process.env.MASCOT_STORAGE_DIR;
    if (envDir && envDir.trim() !== '') {
        return path.resolve(PROJECT_ROOT, envDir.trim());
    }
    return path.join(PROJECT_ROOT, 'storage');
}

export const STORAGE_DIR = getStorageDir();

// ユーザーデータの保存先（STORAGE_DIR 配下 = 環境変数で切り替え可能）
export const USERS_DIR = path.join(STORAGE_DIR, 'users');
export const USERS_FILE_PATH = path.join(STORAGE_DIR, 'users.json');

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
            let mascotSubpath = parts.slice(2).join('/');
            if (mascotSubpath.startsWith('mascots/')) {
                mascotSubpath = mascotSubpath.substring('mascots/'.length);
            }
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
