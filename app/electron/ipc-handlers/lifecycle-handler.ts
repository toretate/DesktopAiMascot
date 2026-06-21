import { app, ipcMain, dialog, BrowserWindow } from 'electron';

export function registerLifecycleHandlers() {
    // アプリケーションを安全に終了する
    ipcMain.on('quit-app', () => {
        console.log('[IPC] Quit App request received');
        app.quit();
    });

    // アプリケーションを再起動する
    ipcMain.on('relaunch-app', () => {
        console.log('[IPC] Relaunch App request received');
        if (process.env.VITE_DEV_SERVER_URL) {
            // 開発環境（Vite）では再起動時に元のプロセス監視が切れてクラッシュするため警告を表示
            const settingsWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.getTitle().includes('設定'));
            const parentWin = settingsWindow || null;
            const choice = dialog.showMessageBoxSync(parentWin!, {
                type: 'info',
                buttons: ['OK', 'キャンセル'],
                title: 'アプリ再起動',
                message: '開発環境（Vite）では自動再起動に対応していません。\n\nアプリを一旦終了しますので、手動で再度 `npm run dev` などを実行してください。',
                defaultId: 0,
                cancelId: 1
            });
            if (choice === 0) {
                app.quit();
            }
        } else {
            // 本番環境では安全に自動再起動
            app.relaunch();
            app.exit(0);
        }
    });
}
