# VOICEVOX IPCハンドラー移行実装計画

UI（Electron）側の VOICEVOX 関連の IPC ハンドラーを `ui/electron/ipc-handlers/voicevox-handler.ts` に移動し、メインプロセスコードの可読性を向上させ、コードベースをクリーンに保ちます。

## ユーザー確認事項

> [!NOTE]
> この変更はリファクタリング（コードの移動と整理）であり、アプリ上での VOICEVOX 音声合成やスタイル一覧取得の挙動に影響はありません。

## 予定される変更点

### 1. IPCハンドラーの新規作成・移動
#### [NEW] [voicevox-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/voicevox-handler.ts)
* `synthesize-voicevox` および `get-voicevox-speakers` ハンドラーの実装をこのファイルに移動します。

### 2. メインプロセス (Electron) の修正
#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
* `main.ts` から `synthesize-voicevox` と `get-voicevox-speakers` のインライン記述を削除します。
* `registerVoicevoxHandlers` をインポートし、`app.whenReady()` のコールバック内で実行してハンドラーを登録するように修正します。

## 検証計画

### コンパイルチェック
* UIプロジェクトが正常にビルドできることを検証します。
  ```bash
  cd ui
  npm run build
  ```
