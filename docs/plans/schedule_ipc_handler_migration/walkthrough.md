# Timer/Scheduler IPC ハンドラーの移行結果

`ui/electron/main.ts` に定義されていたタイマー/スケジューラー関連の IPC ハンドラーおよび通知処理を、新規作成した [schedule-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/schedule-handler.ts) に移行しました。

## 修正内容

### [schedule-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/schedule-handler.ts) (新規)
- `start-timer` および `trigger-timer-notification` の IPC イベントハンドラーを実装。
- OS通知と各ウィンドウへの配信を行う `triggerTimerNotifications` を実装し、[mascot-window.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/mascot-window.ts) と [chat-window.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/chat-window.ts) からウィンドウ参照を取得して同期イベントを送信するよう調整。

### [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
- タイマー関連のイベントハンドラーおよび `triggerTimerNotifications` 関数を削除。
- `app.whenReady()` 内で `registerScheduleHandlers()` を呼び出すように変更。

## 動作確認結果
- `ui` ディレクトリでのビルドが正常に完了することを確認しました。
