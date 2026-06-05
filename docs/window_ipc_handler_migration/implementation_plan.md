# Window IPC ハンドラーの移行計画

`ui/electron/main.ts` に定義されているウィンドウ制御関連の IPC ハンドラー (`set-mascot-scale`, `set-ignore-mouse-events`, `drag-window`) を、新規作成する `ui/electron/ipc-handlers/window-handler.ts` に移動してモジュール化します。

## ユーザーレビューが必要な項目
特になし。

## Proposed Changes

### Electron UI

#### [NEW] [window-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/window-handler.ts)
- `set-mascot-scale`, `set-ignore-mouse-events`, `drag-window` の IPC ハンドラーを実装。
- `config` を利用するため、`registerWindowHandlers(config: AppConfig)` としてインポートできるようにする。
- 依存する各ウィンドウや位置同期用の関数 (`getMascotWindow`, `getChatWindow`, `getSettingsWindow`, `setChatOffsets`, `getChatOffsets`, `syncChatWindowPosition`, `debouncedSaveMascotPosition`) をそれぞれのモジュールからインポートして使用する。

#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
- `main.ts` から `set-mascot-scale`, `set-ignore-mouse-events`, `drag-window` のハンドラーを削除。
- `app.whenReady()` 内で `registerWindowHandlers(config)` を呼び出すように変更。

## Verification Plan

### 自動テスト
- `ui` ディレクトリでの TypeScript ビルドがエラーなく成功することを確認する。
  - コマンド: `npm run build`

### 手動確認
- マスコットのスケール変更、ウィンドウのドラッグ移動、マウス透過の切り替え機能が以前と同様に動作することを確認する。
