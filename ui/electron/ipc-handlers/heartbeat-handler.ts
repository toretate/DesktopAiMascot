import { ipcMain } from 'electron';

export function registerHeartbeatHandlers() {
    // サーバーの疎通確認(ping)を行うハンドラー
    ipcMain.handle('test-server-connection', async (event, host: string, port: number) => {
        const url = `http://${host}:${port}/api/ping`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒タイムアウト

        try {
            console.log(`[IPC] Test Server Connection URL: ${url}`);
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }

            const data: any = await response.json();
            return {
                success: true,
                message: data.message || 'pong'
            };
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.warn('サーバーとの接続エラー (タイムアウト)');
                return { success: false, error: 'サーバーとの接続がタイムアウトしました。' };
            } else {
                console.warn('サーバーとの接続エラー:', error.message);
                return { success: false, error: `サーバーとの接続に失敗しました。` };
            }
        }
    });
}
