# LM Studio IPCハンドラー移行実装計画

UI（Electron）側の LM Studio 関連の IPC ハンドラーを `ui/electron/ipc-handlers/lmstudio-handler.ts` に移動し、メインプロセスコードの可読性を向上させ、コードベースをクリーンに保ちます。

## ユーザー確認事項

> [!NOTE]
> この変更はリファクタリング（コードの移動と整理）であり、アプリ上で LM Studio 経由での対話処理やモデル取得処理の挙動に影響はありません。

## 予定される変更点

### 1. IPCハンドラーの新規作成・移動
#### [NEW] [lmstudio-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/lmstudio-handler.ts)
* `ask-lmstudio` および `get-lmstudio-models` ハンドラーの実装をこのファイルに移動します。

### 2. メインプロセス (Electron) の修正
#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
* `main.ts` から `ask-lmstudio` と `get-lmstudio-models` のインライン記述を削除します。
* `registerLmStudioHandlers` をインポートし、`app.whenReady()` のコールバック内で実行してハンドラーを登録するように修正します。

## 検証計画

### コンパイルチェック
* UIプロジェクトが正常にビルドできることを検証します。
  ```bash
  cd ui
  npm run build
  ```
