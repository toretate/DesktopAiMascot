import { app, ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export function registerHistoryHandlers() {
    // チャット履歴の取得ハンドラー
    ipcMain.handle('get-chat-history', async () => {
        const historyPath = path.join(app.getPath('userData'), 'chat_history.json');
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
        const historyPath = path.join(app.getPath('userData'), 'chat_history.json');
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
        const historyPath = path.join(app.getPath('userData'), 'chat_history.json');
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
}
