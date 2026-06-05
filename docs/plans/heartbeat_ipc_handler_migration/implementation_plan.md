# Heartbeat IPCハンドラー移行実装計画

UI（Electron）側のサーバー疎通確認（Heartbeat/Ping）に関連する IPC ハンドラーを `ui/electron/ipc-handlers/heartbeat-handler.ts` に移動し、メインプロセスコードの可読性を向上させ、コードベースをクリーンに保ちます。

## ユーザー確認事項

> [!NOTE]
> この変更はリファクタリング（コードの移動と整理）であり、アプリ上でのサーバー疎通確認機能の挙動に影響はありません。

## 予定される変更点

### 1. IPCハンドラーの新規作成・移動
#### [NEW] [heartbeat-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/heartbeat-handler.ts)
* サーバー疎通確認を行う `test-server-connection` ハンドラーの実装をこのファイルに移動します。

### 2. メインプロセス (Electron) の修正
#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
* `main.ts` から `test-server-connection` のインライン記述を削除します。
* `registerHeartbeatHandlers` をインポートし、`app.whenReady()` のコールバック内で実行してハンドラーを登録するように修正します。

## 検証計画

### コンパイルチェック
* UIプロジェクトが正常にビルドできることを検証します。
  ```bash
  cd ui
  npm run build
  ```
