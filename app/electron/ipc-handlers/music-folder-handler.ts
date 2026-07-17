import { app, BrowserWindow, dialog, ipcMain, net, protocol } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const MUSIC_PROTOCOL = 'local-music';
const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga', '.flac', '.opus', '.webm']);
const musicFiles = new Map<string, string>();

interface PersistedMusicSettings {
    folderPath?: string;
}

export interface LocalMusicFile {
    name: string;
    relativePath: string;
    size: number;
    lastModified: number;
    url: string;
}

export interface MusicFolderResult {
    success: boolean;
    folderPath?: string;
    files?: LocalMusicFile[];
    error?: string;
}

export function registerMusicProtocolScheme() {
    protocol.registerSchemesAsPrivileged([{
        scheme: MUSIC_PROTOCOL,
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            stream: true
        }
    }]);
}

const getSettingsPath = () => path.join(app.getPath('userData'), 'music-player.json');

const readSettings = (): PersistedMusicSettings => {
    try {
        return JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8')) as PersistedMusicSettings;
    } catch {
        return {};
    }
};

const saveFolderPath = (folderPath: string) => {
    fs.writeFileSync(getSettingsPath(), JSON.stringify({ folderPath }, null, 2), 'utf8');
};

const clearSavedFolderPath = () => {
    try {
        fs.unlinkSync(getSettingsPath());
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
};

const collectMusicFiles = (folderPath: string): string[] => {
    const results: string[] = [];
    const visit = (directoryPath: string) => {
        for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
            const entryPath = path.join(directoryPath, entry.name);
            if (entry.isDirectory()) {
                visit(entryPath);
            } else if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
                results.push(entryPath);
            }
        }
    };
    visit(folderPath);
    return results.sort((left, right) => left.localeCompare(right, 'ja', { numeric: true, sensitivity: 'base' }));
};

const loadFolder = (folderPath: string): MusicFolderResult => {
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
        return { success: false, error: '前回選択したフォルダが見つかりません。' };
    }

    const files = collectMusicFiles(folderPath).map(filePath => {
        // 同じフォルダを別ウィンドウが再読込しても、既存プレイヤーのURLを維持する。
        const id = createHash('sha256').update(filePath).digest('hex');
        const stat = fs.statSync(filePath);
        musicFiles.set(id, filePath);
        return {
            name: path.basename(filePath),
            relativePath: path.relative(folderPath, filePath).replace(/\\/g, '/'),
            size: stat.size,
            lastModified: stat.mtimeMs,
            url: `${MUSIC_PROTOCOL}://track/${id}`
        };
    });

    return { success: true, folderPath, files };
};

export function registerMusicFolderHandlers() {
    protocol.handle(MUSIC_PROTOCOL, request => {
        const id = new URL(request.url).pathname.slice(1);
        const filePath = musicFiles.get(id);
        if (!filePath) return new Response('Not found', { status: 404 });
        return net.fetch(pathToFileURL(filePath).toString(), { headers: request.headers });
    });

    ipcMain.handle('select-music-folder', async event => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return null;

        const previousFolder = readSettings().folderPath;
        const result = await dialog.showOpenDialog(win, {
            title: 'フォルダを選択',
            buttonLabel: '選択',
            defaultPath: previousFolder,
            properties: ['openDirectory']
        });
        if (result.canceled || result.filePaths.length === 0) return null;

        try {
            const folderPath = result.filePaths[0];
            saveFolderPath(folderPath);
            return loadFolder(folderPath);
        } catch (error) {
            console.error('[IPC] 音楽フォルダの読み込みに失敗しました:', error);
            return { success: false, error: '音楽フォルダの読み込みに失敗しました。' } satisfies MusicFolderResult;
        }
    });

    ipcMain.handle('load-last-music-folder', async () => {
        const folderPath = readSettings().folderPath;
        if (!folderPath) return null;
        try {
            return loadFolder(folderPath);
        } catch (error) {
            console.error('[IPC] 前回の音楽フォルダの再読み込みに失敗しました:', error);
            return { success: false, error: '前回の音楽フォルダを再読み込みできませんでした。' } satisfies MusicFolderResult;
        }
    });

    ipcMain.handle('clear-last-music-folder', async () => {
        // 別ウィンドウで再生中の local-music URL を無効化しないため、
        // アプリ終了までURLとファイルの対応は保持する。音声本体はメモリへ読み込まない。
        clearSavedFolderPath();
        return { success: true };
    });
}
