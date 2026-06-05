# タスクリスト: Window IPC ハンドラーの移行

- [x] `ui/electron/ipc-handlers/window-handler.ts` にウィンドウ関連の IPC ハンドラーを実装する
- [x] `ui/electron/main.ts` からウィンドウ関連のハンドラー (`set-mascot-scale`, `set-ignore-mouse-events`, `drag-window`) を削除する
- [x] `ui/electron/main.ts` にて `registerWindowHandlers` をインポートし、`app.whenReady()` 内で呼び出すようにする
- [x] リファクタリング後にビルド検証を行う
