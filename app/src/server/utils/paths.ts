import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

export interface ProjectRoots {
    appRoot: string;
    workspaceRoot: string;
}

// Nuxtアプリのルートとして必要な構成を持つか判定する。
function isAppRoot(dir: string): boolean {
    return fs.existsSync(path.join(dir, 'package.json'))
        && fs.existsSync(path.join(dir, 'src'))
        && fs.existsSync(path.join(dir, 'nuxt.config.ts'));
}

// 指定ディレクトリから上方向へ条件に一致する階層を探索する。
function findUpward(startDir: string, predicate: (dir: string) => boolean): string | null {
    let dir = path.resolve(startDir);
    while (true) {
        if (predicate(dir)) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

// cwdがapp内・ワークスペース内のどちらでもappルートを見つける。
function findAppRoot(startDir: string): string | null {
    return findUpward(startDir, (dir) => {
        if (isAppRoot(dir)) return true;
        return isAppRoot(path.join(dir, 'app'));
    });
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
 * cwdを起点にアプリルートとワークスペースルートを解決する。
 * cwdがワークスペース側の場合は直下のapp/も探索する。
 */
export function resolveProjectRoots(cwd = process.cwd()): ProjectRoots {
    const resolvedCwd = path.resolve(cwd);
    let appRoot = findAppRoot(resolvedCwd);
    if (appRoot && !isAppRoot(appRoot)) {
        appRoot = path.join(appRoot, 'app');
    }

    if (!appRoot) {
        const sourceDir = getCurrentFileDir();
        appRoot = sourceDir ? findUpward(sourceDir, isAppRoot) : null;
    }

    appRoot ??= resolvedCwd;
    const parentDir = path.dirname(appRoot);
    const workspaceRoot = path.basename(appRoot).toLowerCase() === 'app'
        ? parentDir
        : appRoot;

    return { appRoot, workspaceRoot };
}

export const { appRoot: APP_ROOT, workspaceRoot: WORKSPACE_ROOT } = resolveProjectRoots();

// 既存コードとの互換性を保つ。ワークスペース資産は常にこちらを基準にする。
export const PROJECT_ROOT = WORKSPACE_ROOT;

/**
 * ユーザーデータ（tasks/config/history/mascots など）の保存先ルート。
 * サーバー管理者は環境変数 MASCOT_STORAGE_DIR で任意の場所を指定できる。
 * 相対パスが指定された場合は WORKSPACE_ROOT 基準で解決する。
 * 未指定時は標準の WORKSPACE_ROOT/storage を使う。
 */
export function getStorageDir(
    workspaceRoot = WORKSPACE_ROOT,
    envDir = process.env.MASCOT_STORAGE_DIR
): string {
    if (envDir && envDir.trim() !== '') {
        return path.resolve(workspaceRoot, envDir.trim());
    }
    return path.join(workspaceRoot, 'storage');
}

export const STORAGE_DIR = getStorageDir();

// ユーザーデータの保存先（STORAGE_DIR 配下 = 環境変数で切り替え可能）
export const USERS_DIR = path.join(STORAGE_DIR, 'users');
export const USERS_FILE_PATH = path.join(STORAGE_DIR, 'users.json');

// Python関連
export const VISION_DIR = path.join(WORKSPACE_ROOT, 'python-services/vision');
export const PYTHON_DIR = path.join(WORKSPACE_ROOT, 'python-services');

// 履歴テンプレート
export const HISTORY_TEMPLATE_PATH = path.join(WORKSPACE_ROOT, 'chat_history.json');

export interface RuntimePathConfig {
    appRoot: string;
    workspaceRoot: string;
    storageDir: string;
    usersDir: string;
    pythonDir: string;
    visionDir: string;
    historyTemplatePath: string;
}

/**
 * 起動時ログや診断で使用する主要パス設定を返す。
 */
export function getRuntimePathConfig(): RuntimePathConfig {
    return {
        appRoot: APP_ROOT,
        workspaceRoot: WORKSPACE_ROOT,
        storageDir: STORAGE_DIR,
        usersDir: USERS_DIR,
        pythonDir: PYTHON_DIR,
        visionDir: VISION_DIR,
        historyTemplatePath: HISTORY_TEMPLATE_PATH
    };
}

/**
 * リクエストされた /mascots/... パスからローカルファイルシステム上の絶対パスを解決する。
 * @param requestPath "/mascots/users/xxx/image.png" や "/mascots/mascot_xxx/image.png"
 */
export function resolveMascotPath(requestPath: string): string {
    // アセット単位の版数クエリやフラグメントは物理パスへ含めない。
    const pathOnly = requestPath.split(/[?#]/, 1)[0];
    const subpath = pathOnly.startsWith('/mascots/')
        ? pathOnly.substring('/mascots/'.length)
        : pathOnly;

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
    const publicMascotsBase = isDev
        ? path.resolve(APP_ROOT, 'src/public/mascots')
        : path.resolve(APP_ROOT, '.output/public/mascots');

    return path.resolve(publicMascotsBase, decodedSubpath);
}
