# Lifecycle IPCハンドラー移行 修正内容の確認

`ui/electron/main.ts` に記述されていた Lifecycle（終了・再起動）関連の IPC ハンドラーを `lifecycle-handler.ts` へ移動・整理しました。

## 変更内容

### 1. Lifecycle ハンドラーの分離
* [lifecycle-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/lifecycle-handler.ts) を作成し、アプリケーションの安全な終了 (`quit-app`)、再起動 (`relaunch-app`) ハンドラーロジックを移植しました。
* ダイアログの親ウィンドウ指定に使用していた `settingsWindow` については、他のウィンドウから分離して参照可能にするために `BrowserWindow.getAllWindows()` から動的に検索して解決するように設計しました。

### 2. メインプロセス (Electron) のリファクタリング
* [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts) から Lifecycle 関連のインライン記述を削除しました。
* `registerLifecycleHandlers` をインポートし、`app.whenReady()` 時に実行されるように設定しました。

## 検証結果

* `ui` フォルダで `npm run build` を実行し、正常にコンパイルおよびビルドが通ることを確認しました。
  ```bash
  npm run build
  ```
  出力：
  ```
  vite v5.4.21 building for production...
  ✓ built in 1.94s
  ...
  dist-electron/main.js  529.10 kB
  ✓ built in 819ms
  ```
  正常にビルドが成功しています。
