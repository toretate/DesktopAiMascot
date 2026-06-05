# 認証 IPCハンドラー移行 修正内容の確認

`ui/electron/main.ts` に記述されていた認証（ログイン）関連の IPC ハンドラーを `auth-handler.ts` へ移動・整理しました。

## 変更内容

### 1. 認証ハンドラーの分離
* [auth-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/auth-handler.ts) を作成し、Googleログイン開始 (`auth:login`) ハンドラーロジックを移植しました。
* アプリケーション設定情報に依存する箇所は、直接参照によるモジュール結合度を下げるため、`getConfig` ゲッターコールバック関数を受け取る形に設計しました。

### 2. メインプロセス (Electron) のリファクタリング
* [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts) から認証関連のインライン記述を削除しました。
* `registerAuthHandlers` をインポートし、`app.whenReady()` 時に `() => config.get()` を渡して実行されるように設定しました。

## 検証結果

* `ui` フォルダで `npm run build` を実行し、正常にコンパイルおよびビルドが通ることを確認しました。
  ```bash
  npm run build
  ```
  出力：
  ```
  vite v5.4.21 building for production...
  ✓ built in 1.97s
  ...
  dist-electron/main.js  529.13 kB
  ✓ built in 828ms
  ```
  正常にビルドが成功しています。
