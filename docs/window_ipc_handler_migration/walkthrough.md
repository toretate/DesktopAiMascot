# Window IPC ハンドラーの移行結果

`ui/electron/main.ts` に直接定義されていたウィンドウ制御関連の IPC ハンドラー (`set-mascot-scale`, `set-ignore-mouse-events`, `drag-window`) を、新規作成した [window-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/window-handler.ts) に移行しました。

## 修正内容

### [window-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/window-handler.ts) (新規)
- サイズ変更の `set-mascot-scale`、マウス透過切り替えの `set-ignore-mouse-events`、ドラッグ移動の `drag-window` ハンドラーを実装しました。
- 依存する各ウィンドウ参照取得や設定更新の伝達処理をこちらに集約しました。
- `main.ts` で初期化した `AppConfig` のインスタンスを `registerWindowHandlers(config)` の引数として受け取る設計にしました。

### [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
- `main.ts` から `set-mascot-scale`, `set-ignore-mouse-events`, `drag-window` ハンドラーの定義を削除しました。
- `app.whenReady()` 内で `registerWindowHandlers(config)` を呼び出すように変更しました。

## 動作確認結果
- `ui` ディレクトリでの `npm run build` によるビルドが正常に完了することを確認しました。
