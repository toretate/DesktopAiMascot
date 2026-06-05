# チャットAI設定へのモデル指定機能追加の実装計画

チャットAIの設定画面において、選択された各AIエンジン（Gemini, LM Studio, OpenAI, Claude）に対して、個別にモデル名を指定・保存できるフォームを追加します。また、チャット送信コンポーネント（`ChatPanel.vue`）がその保存されたモデル名を参照してAPIリクエストを送信するように連携します。

## ユーザーレビュー要求事項

> [!NOTE]
> 各AIエンジンで頻繁に利用される標準的なモデル名をプレースホルダーや初期値としてセットし、ユーザーが自由に入力・編集できるように設計します。

## オープンクエスチョン

特にありません。

---

## 提案される変更

### フロントエンド（Vue.js）

#### [MODIFY] [SettingsWindow.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/SettingsWindow.vue)
- 各AIエンジン向けのリアクティブなモデル変数を追加します：
    - Gemini 用: `geminiModel` (初期値: `gemini-2.0-flash-exp`)
    - OpenAI 用: `openaiModel` (初期値: `gpt-4o`)
    - Claude 用: `anthropicModel` (初期値: `claude-3-5-sonnet-latest`)
    - LM Studio 用: `lmstudioModel` (既存の変数を流用)
- `onMounted` ライフサイクルフックにて、`localStorage` からそれぞれのモデル名を取得してロードします。
- `saveSettings` 処理にて、それぞれのモデル名を `localStorage` に保存します。
- 「パネル2: チャットAI」設定パネルに、「使用モデル名」入力欄（`InputText`）を追加します。選択されたエンジン（`selectedEngine`）に応じて、適切な変数とバインドされた入力欄が動的に表示されるようにします。
- LM Studio 選択時は、エンドポイントの入力欄も「チャットAI」設定パネル側に配置することで、設定項目の整理整頓を図ります。
- 「パネル6: APIキー」パネルからは、LM Studio の設定項目（エンドポイントとモデル名）を除去し、純粋な API キーの管理画面に簡素化します。

#### [MODIFY] [ChatPanel.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/ChatPanel.vue)
- メッセージ送信処理（`sendMessage`）において、`localStorage` から `geminiModel`, `openaiModel`, `anthropicModel` を読み出すように拡張します。
- Gemini API呼び出しの際、ハードコードされていた `'gemini-2.0-flash-exp'` の代わりに `localStorage` から取得した `geminiModel` を指定します。
- 将来的な拡張性を見据え、他のエンジン（OpenAI, Claude）が選択された際も、それぞれのモデル名を `askGemini` 等のモック呼び出しに動的に渡せるようにマッピング処理を更新します。

---

## 検証計画

### 自動テスト / ビルド確認
- `cmd.exe /c npm run build` を実行し、TypeScriptのコンパイルエラーおよびビルドエラーがないことを検証します。

### 手動検証
- 設定画面を直接起動（`START_SETTINGS=true`）し、「チャットAI」設定パネルで使用AIエンジンを切り替えた際、対応するモデル名入力欄（Gemini, LM Studio, OpenAI, Claude 用）が綺麗に切り替わって表示されることを確認します。
- モデル名を変更して「設定を保存」をクリックした際、`localStorage` に正しく書き込まれることを確認します。
- チャットウィンドウ（通常起動）にて、Gemini または LM Studio を使った対話を実行し、指定したモデル名がAPIリクエストに正しく適用されて通信が成功することを確認します。
