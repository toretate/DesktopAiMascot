import { ipcMain, shell } from 'electron';

export function registerAuthHandlers(getConfig: () => any) {
    // Googleログイン開始 (BFFのログインURLをシステムブラウザで開く)
    ipcMain.on('auth:login', () => {
        const configData = getConfig();
        const host = configData.serverHost || 'localhost';
        const port = configData.serverPort || 3000;
        const serverUrl = `http://${host}:${port}/api/auth/login`;
        console.log(`[IPC] opening auth URL: ${serverUrl}`);
        shell.openExternal(serverUrl);
    });
}
