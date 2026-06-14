# 修正内容の確認 (Walkthrough) - Tool Use (Function Calling) 機能の実装

LM Studio SDK の Tool Use (Function Calling) 機能を利用し、マスコットが各種PC操作やシステム情報の取得、Web情報の検索などを行えるように機能を追加しました。また、それらを検証するための自動テストを追加しました。

---

## 変更内容の概要

### 1. 新規ツールの追加（Skills）
以下のディレクトリに必要なツール関数ファイルを個別に作成しました：
- **`ui/src/skills/tool-use/`**
  - [current-time-tool.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/tool-use/current-time-tool.ts) [NEW]: 現在システム時刻を取得するツール (`getCurrentTime`)。
  - [gps-location-tool.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/tool-use/gps-location-tool.ts) [NEW]: IPアドレスから大まかな位置情報（緯度経度、都市）を取得するツール (`getGPSLocation`)。
  - [weather-tool.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/tool-use/weather-tool.ts) [NEW]: 位置情報を元に Open-Meteo API を叩いて天気を取得するツール (`getWeather`)。
  - [volume-tool.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/tool-use/volume-tool.ts) [NEW]: PowerShellを用いてPC音量を指定値（0-100%）に変更するツール (`adjustVolume`)。
  - [app-launcher-tool.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/tool-use/app-launcher-tool.ts) [NEW]: `calc`（電卓）や `notepad`（メモ帳）などのアプリを起動するツール (`launchApp`)。
  - [web-search-tool.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/tool-use/web-search-tool.ts) [NEW]: DuckDuckGoを用いて最新情報を検索するツール (`searchWeb`)。
  - [index.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/tool-use/index.ts) [NEW]: 定義したすべてのツールをエクスポートするインデックス。

### 2. LM Studio コネクタの拡張
- [lmstudio-connector.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/connector/lmstudio-connector.ts)
  - `llm.respond` から `llm.act(chat, tools, opts)` に呼び出しを切り替え、作成したツールの配列を渡すように変更しました。
  - `onMessage` コールバックを監視し、最終的にアシスタントが生成したテキストをクレンジング処理に回して返却します。

### 3. 自動テストの追加
- [tool-use.test.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/tool-use/__tests__/tool-use.test.ts) [NEW]
  - 各ツールが正常系および異常系（APIエラーやShell実行エラーなど）で正しく動作するかを網羅する 11 個のテストケースを Vitest で実装しました。
  - テストがNode.jsのネイティブAPIを正しく解決できるように `@vitest-environment node` の指定および `vite.config.ts` でのテスト時条件分岐を導入しました。

---

## 検証結果

### 1. 自動テスト結果
以下のコマンドで追加したツールの単体テストを実行し、すべて成功（11/11 Passed）することを確認しました。

```bash
npx vitest run src/skills/tool-use
```

**出力ログ抜粋:**
```text
 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  01:54:53
   Duration  602ms (transform 48ms, setup 0ms, collect 124ms, tests 23ms, environment 0ms, prepare 73ms)
```

### 2. 手動テスト
LM Studio が起動しており、`qwen3.5-9b` などの Tool Use 対応モデルがロードされていることを確認の上、マスコットとのチャットにて以下を送信し、動作を確認してください。

1. **現在時刻取得**:
   - 「今何時？」と送信し、現在の正確な時間が返ってくることを確認。
2. **位置情報の取得**:
   - 「現在の私の場所はどこ？」と送信し、都道府県名や市区町村名が返ってくることを確認。
3. **天気予報の取得**:
   - 「今の場所の天気を教えて」または「東京の天気を調べて」と送信し、温度や湿度が取得されることを確認。
4. **音量の調整**:
   - 「音量を30にして」「音量を50に設定して」と送信し、PCのマスター音量が実際に変化することを確認。
5. **アプリ起動**:
   - 「電卓を開いて」「メモ帳を起動して」と送信し、対象のプログラムがデスクトップ上で起動することを確認。
6. **Web検索**:
   - 「今日のニュースについて検索して」「〇〇という言葉についてWeb検索して」と送信し、検索内容に沿った回答が返ってくることを確認。
