# タスクリスト (Task List) - Tool Use (Function Calling) 機能の実装

- [x] 新規ツールファイルの作成 (`ui/src/skills/tool-use/`)
  - [x] `current-time-tool.ts` の作成 (現在時刻)
  - [x] `gps-location-tool.ts` の作成 (位置情報)
  - [x] `weather-tool.ts` の作成 (天気予報)
  - [x] `volume-tool.ts` の作成 (音量調整)
  - [x] `app-launcher-tool.ts` の作成 (アプリ起動)
  - [x] `web-search-tool.ts` の作成 (Web検索)
  - [x] `index.ts` の作成 (ツールまとめエクスポート)
- [x] `lmstudio-connector.ts` の修正
  - [x] `llm.act` を利用したツール呼び出しと対話ループの実装
  - [x] 取得メッセージのクレンジング処理の適合
- [x] 動作確認・ビルド検証
  - [x] TypeScriptビルド検証 (`npm run build` にて追加モジュールにエラーがないことを確認)
- [x] ドキュメント更新
  - [x] `walkthrough.md` の作成
