import { ipcMain, Notification } from 'electron';
import { getMascotWindow } from '../window/mascot-window';
import { getChatWindow } from '../window/chat-window';

/**
 * タイマー通知のトリガー処理（OSの通知およびマスコットウィンドウ・チャットウィンドウへの配信）
 */
function triggerTimerNotifications(memo: string) {
    const mascotWin = getMascotWindow();
    if (mascotWin && !mascotWin.isDestroyed()) {
        mascotWin.webContents.send('timer-trigger', memo);
    }

    const chatWin = getChatWindow();
    if (chatWin && !chatWin.isDestroyed()) {
        chatWin.webContents.send('timer-trigger', memo);
    }

    if (Notification.isSupported()) {
        const notification = new Notification({
            title: 'デスクトップマスコットのお知らせ',
            body: memo,
            silent: false
        });
        notification.show();
    }
}

/**
 * Timer/Scheduler 関連の IPC ハンドラーを登録する
 */
export function registerScheduleHandlers() {
    // ローカルタイマーの開始
    ipcMain.on('start-timer', (event, seconds: number, memo: string) => {
        const durationMs = seconds * 1000;
        console.log(`[Timer] Local timer started: ${seconds} seconds. Memo: ${memo}`);

        setTimeout(() => {
            console.log(`[Timer] Local timer triggered: ${memo}`);
            triggerTimerNotifications(memo);
        }, durationMs);
    });

    // タイマー発火の通知を要求する（サーバー側でのタイマー満了時など）
    ipcMain.on('trigger-timer-notification', (event, memo: string) => {
        console.log(`[Timer] Trigger timer notification requested. Memo: ${memo}`);
        triggerTimerNotifications(memo);
    });
}
