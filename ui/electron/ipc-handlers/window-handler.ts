import { ipcMain, BrowserWindow } from 'electron';
import { AppConfig } from '../app-config';
import { getMascotWindow, debouncedSaveMascotPosition } from '../window/mascot-window';
import { getChatWindow, setChatOffsets, getChatOffsets, syncChatWindowPosition } from '../window/chat-window';
import { getSettingsWindow } from '../window/settings-window';
import { getIntegratedWindow } from '../window/integrated-window';
import { getCompactWindow } from '../window/compact-window';

/**
 * Window 操作関連の IPC ハンドラーを登録する
 */
export function registerWindowHandlers(config: AppConfig) {
    // マスコットのサイズ（スケール）調整
    ipcMain.on('set-mascot-scale', (event, scale: number) => {
        const mascotWin = getMascotWindow();
        if (!mascotWin) return;

        console.log(`[IPC] Set Mascot Scale: ${scale}`);
        config.update({ mascotScale: scale });

        const defaultMascotW = 600;
        const defaultMascotH = 800;
        const newW = Math.round(defaultMascotW * scale);
        const newH = Math.round(defaultMascotH * scale);

        // ウィンドウサイズの変更
        mascotWin.setSize(newW, newH);

        // チャットウィンドウ位置の再計算と同期
        setChatOffsets(newW, getChatOffsets().chatOffsetY);
        syncChatWindowPosition();

        // 全ウィンドウへ設定更新のブロードキャスト
        const updatedConfig = config.get();
        mascotWin.webContents.send('config-updated', updatedConfig);
        const chatWin = getChatWindow();
        if (chatWin && !chatWin.isDestroyed()) {
            chatWin.webContents.send('config-updated', updatedConfig);
        }
        const integratedWin = getIntegratedWindow();
        if (integratedWin && !integratedWin.isDestroyed()) {
            integratedWin.webContents.send('config-updated', updatedConfig);
        }
        const compactWin = getCompactWindow();
        if (compactWin && !compactWin.isDestroyed()) {
            compactWin.webContents.send('config-updated', updatedConfig);
        }
        const settingsWin = getSettingsWindow();
        if (settingsWin && !settingsWin.isDestroyed()) {
            settingsWin.webContents.send('config-updated', updatedConfig);
        }
    });

    // 3. マウススルー（イベント無視）の制御
    // ignore: true の場合はクリックを透過させ、false の場合はウィンドウを通常クリック可能にする
    ipcMain.on('set-ignore-mouse-events', (event, ignore: boolean) => {
        const webContents = event.sender;
        const win = BrowserWindow.fromWebContents(webContents);
        if (win) {
            // forward: true にすることで、マウスイベントを透過しつつも
            // マウス移動（mousemove）イベント自体はレンダープロセス側で検知可能にする
            win.setIgnoreMouseEvents(ignore, { forward: true });
        }
    });

    let dragStartSize: { width: number; height: number } | null = null;

    // 4. アプリ内ドラッグ移動の実装 (HTML要素をドラッグ可能にする場合のサポート)
    ipcMain.on('drag-window', (event, offset: { dx: number; dy: number; isStart?: boolean; isEnd?: boolean }) => {
        const webContents = event.sender;
        const win = BrowserWindow.fromWebContents(webContents);
        if (win) {
            if (offset.isEnd) {
                dragStartSize = null;
                return;
            }

            if (offset.isStart || !dragStartSize) {
                const size = win.getSize();
                dragStartSize = { width: size[0], height: size[1] };
                if (offset.isStart) {
                    return;
                }
            }

            const bounds = win.getBounds();
            const mascotWin = getMascotWindow();

            const targetW = dragStartSize.width;
            const targetH = dragStartSize.height;

            // setPositionの代わりにsetBoundsを使用し、DPIスケーリングによるサイズ肥大化バグを防ぐ
            // 統合ウィンドウやコンパクトウィンドウなどの通常窓も含め、ドラッグ開始時の正確なサイズを強制維持する
            const newBounds: any = {
                x: Math.round(bounds.x + offset.dx),
                y: Math.round(bounds.y + offset.dy),
                width: targetW,
                height: targetH
            };
            win.setBounds(newBounds);

            if (win === mascotWin) {
                debouncedSaveMascotPosition();
            }
        }
    });
}
