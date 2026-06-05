# チャット履歴 IPCハンドラー移行実装計画

UI（Electron）側のチャット履歴に関連する IPC ハンドラーを `ui/electron/ipc-handlers/history-handler.ts` に移動し、メインプロセスコードの可読性を向上させ、コードベースをクリーンに保ちます。

## ユーザー確認事項

> [!NOTE]
> この変更はリファクタリング（コードの移動と整理）であり、アプリ上でのチャット履歴読み込み、保存、エディタ展開の挙動に影響はありません。

## 予定される変更点

### 1. IPCハンドラーの新規作成・移動
#### [NEW] [history-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/history-handler.ts)
* チャット履歴の取得 (`get-chat-history`)、保存 (`save-chat-history`)、エディタで開く (`open-chat-history`) ハンドラーの実装をこのファイルに移動します。

### 2. メインプロセス (Electron) の修正
#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
* `main.ts` からチャット履歴関連の3つのハンドラーのインライン記述を削除します。
* `registerHistoryHandlers` をインポートし、`app.whenReady()` のコールバック内で実行してハンドラーを登録するように修正します。

## 検証計画

### コンパイルチェック
* UIプロジェクトが正常にビルドできることを検証します。
  ```bash
  cd ui
  npm run build
  ```
