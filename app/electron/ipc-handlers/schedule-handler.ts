import { ipcMain, Notification } from 'electron';
import { getMascotWindow } from '../window/mascot-window';
import { getIntegratedWindow } from '../window/integrated-window';
import { getCompactWindow } from '../window/compact-window';

interface TimerNotificationOptions {
    notificationId?: string;
    speak?: boolean;
}

const recentNotificationIds = new Map<string, number>();
const NOTIFICATION_DEDUPLICATION_MS = 60_000;

/**
 * タイマー通知のトリガー処理（OS通知および現在のマスコット表示画面への配信）
 */
function triggerTimerNotifications(memo: string, options: TimerNotificationOptions = {}) {
    const now = Date.now();
    if (options.notificationId) {
        const lastTriggeredAt = recentNotificationIds.get(options.notificationId);
        if (lastTriggeredAt !== undefined && now - lastTriggeredAt < NOTIFICATION_DEDUPLICATION_MS) {
            console.log(`[Timer] Duplicate notification ignored: ${options.notificationId}`);
            return;
        }
        recentNotificationIds.set(options.notificationId, now);
        for (const [notificationId, triggeredAt] of recentNotificationIds) {
            if (now - triggeredAt >= NOTIFICATION_DEDUPLICATION_MS) {
                recentNotificationIds.delete(notificationId);
            }
        }
    }

    // TTSと吹き出しは、現在のウィンドウモードでマスコットを所有する1画面だけへ配信する。
    const notificationWindow = [getMascotWindow(), getIntegratedWindow(), getCompactWindow()]
        .find(window => window && !window.isDestroyed());
    if (notificationWindow) {
        notificationWindow.webContents.send('timer-trigger', memo, options);
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
    ipcMain.on('trigger-timer-notification', (event, memo: string, options?: TimerNotificationOptions) => {
        console.log(`[Timer] Trigger timer notification requested. Memo: ${memo}`);
        triggerTimerNotifications(memo, options);
    });
}
