# タスクリスト: チャット画面関連コードのリファクタリング

- [x] `ui/electron/main.ts` にて `chat-window.ts` から必要な関数・状態取得用関数をインポートする
- [x] `ui/electron/main.ts` 内のチャット関連のグローバル変数および関数 (`adjustChatWindowPosition`, `syncChatWindowPosition`, `getEffectiveChatAlwaysOnTop`) を削除する
- [x] `createWindows()` 内でのチャットウィンドウ作成処理を `chat-window.ts` の `createChatWindow` や `setChatOffsets` を使用するように置き換える
- [x] `main.ts` の `ipcMain.on('toggle-chat', ...)` および `ipcMain.on('update-character-bounds', ...)` を削除する
- [x] `main.ts` 内のその他の `chatWindow` 参照箇所を `getChatWindow()` に置き換える
- [x] リファクタリング後にビルド検証を行う
