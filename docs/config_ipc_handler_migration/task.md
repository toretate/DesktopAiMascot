# タスクリスト: Config IPC ハンドラーの移行

- [x] `ui/electron/ipc-handlers/config-handler.ts` に `get-app-config` および `update-app-config` ハンドラーを実装する
- [x] `ui/electron/main.ts` から `get-app-config` および `update-app-config` ハンドラーを削除する
- [x] `ui/electron/main.ts` にて `registerConfigHandlers` をインポートし、`app.whenReady()` 内で呼び出すようにする
- [x] `ui/electron/ipc-handlers/config-handler.ts` に `get-mascot-prompts` および `save-mascot-prompts` ハンドラーを移行する
- [x] `ui/electron/main.ts` から `get-mascot-prompts` および `save-mascot-prompts` ハンドラーを削除する
- [x] リファクタリング後にビルド検証を行う
