import { app, BrowserWindow } from 'electron';
import * as path from 'path';

// 開発環境と本番環境の判定
const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;

function createWindow() {
    // マスコット表示用の透過・枠なし・最前面ウィンドウを作成
    const mascotWindow = new BrowserWindow({
        width: 300,
        height: 400,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if (isDev) {
        mascotWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
    } else {
        mascotWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
