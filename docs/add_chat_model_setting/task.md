# タスクリスト：チャットAI設定へのモデル指定追加

チャットAIの設定画面において、選択された各AIエンジン（Gemini, LM Studio, OpenAI, Claude）に対して、個別にモデル名を指定・保存できる機能の実装タスクリストです。

## タスク一覧

- [x] `SettingsWindow.vue` の修正
    - [x] `geminiModel`, `openaiModel`, `anthropicModel` の状態変数追加
    - [x] `onMounted` でのロード処理追加
    - [x] `saveSettings` での保存処理追加
    - [x] 「チャットAI」設定パネルにおける、モデル指定インプットフォーム（`InputText`）の追加（エンジン選択連動）
    - [x] 「チャットAI」設定パネルへの LM Studio エンドポイント入力欄の移植
    - [x] 「APIキー」設定パネルから LM Studio の設定欄を削除
- [x] `ChatPanel.vue` の修正
    - [x] `sendMessage` における `geminiModel` 等の `localStorage` ロード追加
    - [x] Gemini API 呼び出しパラメータのハードコード値（`gemini-2.0-flash-exp`）を、ロードしたモデル名変数に置換
- [x] ビルド確認と型チェックの実行
    - [x] `cmd.exe /c npm run build` によるビルド通過の確認
- [x] 動作確認・検証
    - [x] 設定画面を起動し、エンジンごとに適切なモデル名入力欄が表示されることを確認
    - [x] モデル名を変更・保存し、`localStorage` に正しく反映されることを確認
    - [x] チャットを送信し、設定したモデル名が API リクエストに適用されて対話が成功することを確認
- [x] ドキュメント更新とコミット
    - [x] 検証結果をまとめた `walkthrough.md` の作成
    - [x] 変更内容を Git にコミット
