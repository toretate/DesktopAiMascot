import { app, ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export function registerHistoryHandlers() {
    const getHistoryPath = () => {
        if (!app.isPackaged) {
            // 開発環境ではプロジェクトのルートディレクトリにある chat_history.json を使用する
            const currentCwd = process.cwd();
            const dirName = path.basename(currentCwd);
            const baseCwd = (dirName === 'ui' || dirName === 'server') ? path.dirname(currentCwd) : currentCwd;
            return path.join(baseCwd, 'chat_history.json');
        }
        return path.join(app.getPath('userData'), 'chat_history.json');
    };

    // チャット履歴の取得ハンドラー
    ipcMain.handle('get-chat-history', async () => {
        const historyPath = getHistoryPath();
        try {
            if (fs.existsSync(historyPath)) {
                const data = fs.readFileSync(historyPath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('[Config] Failed to load chat history:', error);
        }
        return {};
    });

    // チャット履歴の保存ハンドラー
    ipcMain.handle('save-chat-history', async (event, history: any) => {
        const historyPath = getHistoryPath();
        try {
            fs.writeFileSync(historyPath, JSON.stringify(history, null, 4), 'utf8');
            return { success: true };
        } catch (error) {
            console.error('[Config] Failed to save chat history:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // チャット履歴ファイルをシステムのエディタで開くハンドラー
    ipcMain.on('open-chat-history', () => {
        const historyPath = getHistoryPath();
        if (!fs.existsSync(historyPath)) {
            try {
                fs.writeFileSync(historyPath, JSON.stringify({}, null, 4), 'utf8');
            } catch (error) {
                console.error('[Config] Failed to create empty chat history file:', error);
                return;
            }
        }
        shell.openPath(historyPath);
    });

    // 指定された相対パスのフォルダを作成し、システムで開くハンドラー
    ipcMain.on('open-folder', (event, relativePath: string) => {
        try {
            const currentCwd = process.cwd();
            const dirName = path.basename(currentCwd);
            const baseCwd = (dirName === 'ui' || dirName === 'server') ? path.dirname(currentCwd) : currentCwd;
            const fullPath = path.resolve(baseCwd, relativePath);

            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
            shell.openPath(fullPath);
        } catch (error) {
            console.error('[IPC] Failed to open folder:', error);
        }
    });

    // 音声データをマスコットフォルダに保存するハンドラー
    ipcMain.handle('save-mascot-voice', async (event, mascotId: string, base64Data: string, extension: string) => {
        try {
            const currentCwd = process.cwd();
            const dirName = path.basename(currentCwd);
            const baseCwd = (dirName === 'ui' || dirName === 'server') ? path.dirname(currentCwd) : currentCwd;
            
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}${mm}${dd}`;

            const dirPath = path.join(baseCwd, 'mascots', mascotId, 'voices', dateStr);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }

            const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;
            const filePath = path.join(dirPath, filename);

            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(filePath, buffer);

            console.log(`[IPC] Voice file saved: ${filePath}`);
            return { success: true, path: filePath };
        } catch (error) {
            console.error('[IPC] Failed to save mascot voice:', error);
            return { success: false, error: (error as Error).message };
        }
    });
}
