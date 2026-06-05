# 認証 IPCハンドラー移行実装計画

UI（Electron）側の認証（Googleログインなど）に関連する IPC ハンドラーを `ui/electron/ipc-handlers/auth-handler.ts` に移動し、メインプロセスコードの可読性を向上させ、コードベースをクリーンに保ちます。

## ユーザー確認事項

> [!NOTE]
> この変更はリファクタリング（コードの移動と整理）であり、アプリのGoogleログインなど認証処理の挙動に影響はありません。

## 予定される変更点

### 1. IPCハンドラーの新規作成・移動
#### [NEW] [auth-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/auth-handler.ts)
* Googleログイン開始 (`auth:login`) ハンドラーの実装をこのファイルに移動します。
* メインプロセスの `config` 変数に依存する箇所は、安全に取得するためにゲッター関数 `getConfig()` を受け取る形で実装します。

### 2. メインプロセス (Electron) の修正
#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
* `main.ts` から認証ハンドラーのインライン記述を削除します。
* `registerAuthHandlers` をインポートし、`app.whenReady()` のコールバック内で実行（ゲッター関数として `() => config.get()` を渡す）してハンドラーを登録するように修正します。

## 検証計画

### コンパイルチェック
* UIプロジェクトが正常にビルドできることを検証します。
  ```bash
  cd ui
  npm run build
  ```
