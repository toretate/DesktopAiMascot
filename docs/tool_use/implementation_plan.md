# Tool Use (Function Calling) 機能の導入計画

現在設定中の LM Studio（qwen3.5-9b）および LM Studio SDK の Tool Use 機能を利用し、マスコットが自発的・あるいはユーザーの指示に応じてPCの操作や情報取得を行えるように拡張します。

## ユーザーレビュー要求事項

> [!IMPORTANT]
> **提供するツール（関数）一覧とその動作仕様**
> 1. **現在時刻の取得 (`getCurrentTime`)**: システムの現在日時を返します。
> 2. **GPS位置情報の取得 (`getGPSLocation`)**: IP位置情報API（無料の `ip-api.com` 等）から現在の大まかな位置情報（都市名、緯度・経度）を取得します。
> 3. **天気予報の取得 (`getWeather`)**: 位置情報を元に、無料の Open-Meteo API を使ってリアルタイムの天気予報を取得します。
> 4. **音量調整 (`adjustVolume`)**: PowerShell経由でシステムのマスター音量を指定されたレベル（0-100%）に設定、またはミュートします。
> 5. **アプリ起動 (`launchApp`)**: `calc`（電卓）、`notepad`（メモ帳）、ブラウザなどの主要アプリを起動します。
> 6. **Web検索 (`searchWeb`)**: DuckDuckGo等のパブリック検索を利用して簡易的なWeb検索結果を取得します。

> [!NOTE]
> **コード配置方針**
> 各ツールの定義および実装コードは、`ui/src/skills/tool-use/` ディレクトリ配下に機能ごとに分割して配置します。

## 変更内容

### 1. 新規ツールの追加 (Skills)
- **`ui/src/skills/tool-use/current-time-tool.ts`** [NEW]: 現在時刻取得ツール
- **`ui/src/skills/tool-use/gps-location-tool.ts`** [NEW]: GPS（IPベース）位置情報取得ツール
- **`ui/src/skills/tool-use/weather-tool.ts`** [NEW]: Open-Meteo APIを用いた天気予報取得ツール
- **`ui/src/skills/tool-use/volume-tool.ts`** [NEW]: PowerShell経由のPC音量調整ツール
- **`ui/src/skills/tool-use/app-launcher-tool.ts`** [NEW]: アプリケーション起動ツール
- **`ui/src/skills/tool-use/web-search-tool.ts`** [NEW]: DuckDuckGoを用いた簡易Web検索ツール
- **`ui/src/skills/tool-use/index.ts`** [NEW]: 各ツールをまとめてエクスポートするインデックスファイル

### 2. LM Studio コネクタの拡張
#### [MODIFY] [lmstudio-connector.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/connector/lmstudio-connector.ts)
- `llm.respond` の代わりに LM Studio SDK の `llm.act(chat, tools, opts)` を使用するように書き換えます。
- インポートした `lmStudioTools` 配列を `llm.act` に渡します。
- メッセージ応答およびクレンジング処理を適合させます。

## 検証計画

### 1. ビルド検証
- `npm run build` を実行し、型エラーやコンパイルエラーがないことを確認します。

### 2. 機能検証
- マスコットチャットにて以下を送信し、正しくツールが実行されて結果が得られるか確認します。
  - 「今何時？」 → 現在時刻が返ってくる
  - 「今の場所は？」 → 位置情報が返ってくる
  - 「東京の天気を教えて」 → Open-Meteoから天気を取得して教えてくれる
  - 「電卓を起動して」 → 電卓アプリが起動する
  - 「音量を50にして」 → システム音量が変更される
  - 「Googleの最新ニュースを検索して」 → Web検索結果を元に答えてくれる
