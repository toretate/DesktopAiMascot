# タスクリスト: Timer/Scheduler IPC ハンドラーの移行

- [x] `ui/electron/ipc-handlers/schedule-handler.ts` にタイマー関連の IPC ハンドラーを実装する
- [x] `ui/electron/main.ts` からタイマー関連のハンドラーおよび `triggerTimerNotifications` 関数を削除する
- [x] `ui/electron/main.ts` にて `registerScheduleHandlers` をインポートし、`app.whenReady()` 内で呼び出すようにする
- [x] リファクタリング後にビルド検証を行う
