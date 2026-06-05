# UI側 LM Studio コネクタ移行実装計画

UI（Electronのメインプロセス）側の LM Studio 関連コードを `ui/src/connector/lmstudio-connector.ts` に移動し、処理の共通化とコードの可読性を向上させます。

## ユーザー確認事項

> [!NOTE]
> この変更はリファクタリング（コードの移動と整理）であり、Electron から LM Studio への通信の挙動や画面の表示には一切影響しません。

## 予定される変更点

### 1. LM Studio コネクタの新規作成
#### [NEW] [lmstudio-connector.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/connector/lmstudio-connector.ts)
* `LMStudioClient` を用いた接続、WebSocket形式へのエンドポイント変換処理（`getSdkEndpoint`）、対話レスポンス生成、モデル一覧取得ロジックを集約します。

### 2. メインプロセス (Electron) の修正
#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
* 重複していた `LMStudioClient` や `getSdkEndpoint` 関連ロジックを削除します。
* `ipcMain.handle('ask-lmstudio')` と `ipcMain.handle('get-lmstudio-models')` のハンドラー処理にて、`LmStudioConnector` を経由して処理を実行するように修正します。

## 検証計画

### コンパイルチェック
* UIプロジェクトが正常にビルドできることを検証します。
  ```bash
  cd ui
  npm run build
  ```
