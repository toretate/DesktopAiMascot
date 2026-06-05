import { ipcMain, BrowserWindow, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export function registerSelectLocalImageHandler() {
    ipcMain.handle('select-local-image', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return null;

        try {
            const result = await dialog.showOpenDialog(win, {
                title: '画像ファイルを選択',
                properties: ['openFile'],
                filters: [
                    { name: '画像ファイル', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }
                ]
            });

            if (result.canceled || result.filePaths.length === 0) {
                return null;
            }

            const filePath = result.filePaths[0];
            const fileBuffer = fs.readFileSync(filePath);

            // 拡張子から適切なMIMEタイプを判別
            const ext = path.extname(filePath).toLowerCase();
            let mimeType = 'image/png';
            if (ext === '.jpg' || ext === '.jpeg') {
                mimeType = 'image/jpeg';
            } else if (ext === '.gif') {
                mimeType = 'image/gif';
            } else if (ext === '.webp') {
                mimeType = 'image/webp';
            } else if (ext === '.svg') {
                mimeType = 'image/svg+xml';
            }

            const base64Data = fileBuffer.toString('base64');
            const dataUrl = `data:${mimeType};base64,${base64Data}`;

            // ファイル名も返すことでアセット名の自動補完を可能にする
            const fileName = path.basename(filePath, ext);

            return {
                success: true,
                path: dataUrl,
                name: fileName
            };
        } catch (error) {
            console.error('[IPC] Failed to select or read local image:', error);
            return {
                success: false,
                error: '画像のロードに失敗しました。'
            };
        }
    });
}
