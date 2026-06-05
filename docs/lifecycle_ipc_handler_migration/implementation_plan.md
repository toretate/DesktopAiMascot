# Lifecycle IPCハンドラー移行実装計画

UI（Electron）側の Lifecycle（アプリ終了や再起動）に関連する IPC ハンドラーを `ui/electron/ipc-handlers/lifecycle-handler.ts` に移動し、メインプロセスコードの可読性を向上させ、コードベースをクリーンに保ちます。

## ユーザー確認事項

> [!NOTE]
> この変更はリファクタリング（コードの移動と整理）であり、アプリの終了や再起動時のダイアログ表示を含め、挙動に影響はありません。

## 予定される変更点

### 1. IPCハンドラーの新規作成・移動
#### [NEW] [lifecycle-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/lifecycle-handler.ts)
* アプリケーションの安全な終了 (`quit-app`)、再起動 (`relaunch-app`) ハンドラーの実装をこのファイルに移動します。
* メインプロセスの `settingsWindow` 変数に依存する箇所は、`BrowserWindow.getAllWindows()` から動的に検索してウィンドウの参照を特定するように修正します。

### 2. メインプロセス (Electron) の修正
#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
* `main.ts` からアプリ終了・再起動ハンドラーのインライン記述を削除します。
* `registerLifecycleHandlers` をインポートし、`app.whenReady()` のコールバック内で実行してハンドラーを登録するように修正します。

## 検証計画

### コンパイルチェック
* UIプロジェクトが正常にビルドできることを検証します。
  ```bash
  cd ui
  npm run build
  ```
