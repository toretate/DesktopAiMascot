# Electron チャット画面関連コードの chat-window.ts への移行計画

`ui/electron/main.ts` からチャット画面（ウィンドウの生成、表示制御、トグル、位置同期など）に関するロジックを `ui/electron/chat-window.ts` に移動し、コードの保守性とモジュール性を高めます。

## ユーザーレビューが必要な項目
特になし。既存の挙動（位置同期や表示トグル）を損なわずにリファクタリングを行います。

## Proposed Changes

### Electron UI

#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
- `chatWindow` グローバル変数および関連する位置調整・同期ロジック (`adjustChatWindowPosition`, `syncChatWindowPosition`, `getEffectiveChatAlwaysOnTop`) を削除。
- `chat-window.ts` から必要な関数 (`initChatWindow`, `getChatWindow`, `createChatWindow`, `syncChatWindowPosition`, `adjustChatWindowPosition`, `getEffectiveChatAlwaysOnTop`, `setChatOffsets`, `getChatOffsets`) をインポート。
- `createWindows()` 内でチャットウィンドウの初期化と生成を `chat-window.ts` 経由で行うように変更。
- `ipcMain.on('toggle-chat', ...)` と `ipcMain.on('update-character-bounds', ...)` を削除。
- その他の `chatWindow` 参照箇所（マスコットのスケール変更、設定更新、タイマー発火）を `getChatWindow()` を使用するように修正。

## Verification Plan

### 自動テスト
- リファクタリング後、`ui` ディレクトリでの TypeScript ビルドがエラーなく成功することを確認する。
  - コマンド: `npm run build` (もしくは `tsc` による型チェック)

### 手動確認
- アプリケーションを起動し、チャットウィンドウの表示/非表示（マスコットクリックによるトグル）が正常に機能すること。
- マスコットの移動に伴い、チャットウィンドウが追従すること。
- マスコットのスケールを変更した際、チャットウィンドウの位置が正しくオフセットされること。
- 設定変更（常に手前に表示など）がチャットウィンドウに正しく連動すること。
