# チャット画面関連コードのリファクタリング結果

`ui/electron/main.ts` からチャット画面（ウィンドウ作成、位置追従、トグルなど）に関するロジックを [chat-window.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/chat-window.ts) に移行しました。

## 修正内容

### [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
- グローバル変数 `chatWindow`, `chatOffsetX`, `chatOffsetY`, `isSyncingChatPosition`, `characterBounds` を削除し、[chat-window.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/chat-window.ts) が管理するように変更。
- チャット画面の位置調整関数 `adjustChatWindowPosition` や追従関数 `syncChatWindowPosition` を削除し、モジュールからインポートして使用するように修正。
- `createWindows()` でのチャットウィンドウ生成コードを簡素化し、`chat-window.ts` 経由で行うように修正。
- 不要になった IPC イベントハンドラー (`toggle-chat`, `update-character-bounds`) を削除（`chat-window.ts` 内で登録済み）。
- `set-mascot-scale` ハンドラーや `update-app-config` 内の `chatWindow` 参照を `getChatWindow()` やインポートしたヘルパー関数を使用するように変更。

## 動作確認結果
- `ui` ディレクトリで `npm run build` を実行し、TypeScript の型エラーおよび Vite によるビルドが正常に完了することを確認しました。
