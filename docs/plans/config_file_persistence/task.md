# タスクリスト：アプリケーション設定のローカルファイル永続化

設定画面のすべての情報（APIキー、モデル名、LM Studio や VOICEVOX のエンドポイント、話者IDなど）をローカルファイル（`config.json`）で永続化し、再起動耐性を持たせるタスクリストです。

## タスク一覧

- [x] メインプロセスの設定管理拡張
    - [x] `main.ts` に設定データインターフェース `ConfigData` へのパラメータ拡張
    - [x] `AppConfig` の `load()` メソッドへのデフォルト値追加
    - [x] `get-app-config` および `update-app-config` IPC ハンドラーの実装
- [x] プリロードおよび型定義の登録
    - [x] `preload.ts` での `getAppConfig`/`updateAppConfig` 公開
    - [x] `electron.d.ts` への型アノテーション登録
- [x] フロントエンド側同期処理の刷新
    - [x] `SettingsWindow.vue` の `onMounted` ロードの非同期化とファイル同期
    - [x] `SettingsWindow.vue` の `saveSettings` 保存の非同期化とファイル同期
    - [x] `ChatPanel.vue` における非同期設定ロードの統合
    - [x] `ChatPanel.vue` の音声再生時の話者・エンドポイント動的反映の適用
    - [x] Webブラウザでのモック動作を考慮した `localStorage` 二重化フォールバック設計の徹底
- [x] ビルド確認と型チェックの実行
    - [x] `cmd.exe /c npm run build` によるビルド・型チェックの通過確認
- [x] 動作確認・検証 (再起動耐久テスト)
    - [x] 設定画面を起動し、設定変更と保存が正常に行えることを確認
    - [x] アプリケーションを一度終了（アプリ終了ボタン）し、再起動する
    - [x] 再起動後、設定した値（LM Studioエンドポイントなど）が「忘れることなく」完全に読み込まれることを確認
    - [x] VOICEVOX サーバー起動時に、起動時自動疎通確認によって118件のスタイル一覧が正常にロードされることを検証
- [x] ドキュメント更新とコミット
    - [x] 検証結果をまとめた `walkthrough.md` の作成
    - [x] 変更内容を Git にコミット
