# ローカル画像選択ハンドラー移行実装計画

UI（Electron）側の `select-local-image` IPCハンドラー処理を `ui/electron/ipc-handlers/select-local-image-handler.ts` に移動し、メインプロセスの肥大化を防ぎ、関心の分離を進めます。

## ユーザー確認事項

> [!NOTE]
> この変更はリファクタリング（コードの移動と整理）であり、アプリ上でローカル画像ファイルを選択する動作に影響はありません。

## 予定される変更点

### 1. IPCハンドラーの新規作成・移動
#### [NEW] [select-local-image-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/select-local-image-handler.ts)
* `select-local-image` に関わるダイアログ表示、ファイルの読み込み、Base64への変換処理をこのファイルに移動します。

### 2. メインプロセス (Electron) の修正
#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
* `main.ts` から `select-local-image` の記述を削除します。
* `registerSelectLocalImageHandler` をインポートし、`app.whenReady()` のコールバック内で実行してハンドラーを登録するように修正します。

## 検証計画

### コンパイルチェック
* UIプロジェクトが正常にビルドできることを検証します。
  ```bash
  cd ui
  npm run build
  ```
