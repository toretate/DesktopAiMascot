# タスクリスト (Task List) - ラジオモードでの能動的発話（アクティブトーク）

- [x] `useChatConnection.ts` の修正
  - [x] 能動トーク用リクエストメソッド `sendActiveTalkMessage()` の実装（`sendMessage(isActiveTalk: true)` として引数拡張で統合実装）
  - [x] 戻り値として `sendMessage` をエクスポート（引数対応済み）
- [x] `ChatPanel.vue` の修正
  - [x] 自動おしゃべりタイマー制御ロジックの実装（30秒間入力・発話なしで発火）
  - [x] ラジオモード変更時, マスコットの発話状態変更時, 入力テキスト変更時のタイマーリセット/再始動ロジック
- [x] 動作確認・ビルド検証
  - [x] TypeScriptのビルド検証 (`npm run build` にて該当部分にビルドエラーがないことを確認)
- [x] ドキュメント更新
  - [x] `walkthrough.md` の作成
