import path from 'path';
import fs from 'fs';

export function getProjectRoot(): string {
    const cwd = process.cwd();
    // 開発時は cwd が /ui なので、親をプロジェクトルートにする
    // ただし、もし cwd に config.json があるなら cwd 自体をプロジェクトルートにする
    if (fs.existsSync(path.join(cwd, 'config.json'))) {
        return cwd;
    }
    const parent = path.resolve(cwd, '..');
    if (fs.existsSync(path.join(parent, 'config.json'))) {
        return parent;
    }
    // デフォルトは cwd
    return cwd;
}

export const PROJECT_ROOT = getProjectRoot();
export const MASCOTS_DIR = path.join(PROJECT_ROOT, 'mascots');
export const CONFIG_TEMPLATE_PATH = path.join(PROJECT_ROOT, 'config.json');
export const HISTORY_TEMPLATE_PATH = path.join(PROJECT_ROOT, 'chat_history.json');
export const USERS_DIR = path.join(PROJECT_ROOT, 'server/users');
export const USERS_FILE_PATH = path.join(PROJECT_ROOT, 'server/users.json');
export const VISION_DIR = path.join(PROJECT_ROOT, 'server/vision');
export const PYTHON_DIR = path.join(PROJECT_ROOT, 'server/python');
