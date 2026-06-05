# Chat AI設定画面のUIリデザイン実装計画

このドキュメントは、提供されたレイアウト指示書（`implementation_plan_from_gemini.txt`）およびデザイン画像に基づき、**Chat AI設定画面 (`ChatAiPropertyPage`)** をモダンな3カラム（ナビゲーションを含む実質3ペイン）デザインへ再構築するための技術的実装計画を記述したものです。

---

## ユーザーレビューが必要な内容

> [!IMPORTANT]
> 1. **未実装のAIエンジンのフォールバック挙動**
>    - `Claude`、`Codex`、`Ollama` は現在のアプリケーションでバックエンド処理が実装されていません。
>    - これらがリストで選択された場合、右ペイン（パラメータ設定）の各コントロールを無効化（Disabled）にし、「**このエンジンは現在未実装です (This engine is not implemented yet.)**」というメッセージを表示する安全設計にします。
> 2. **パラメータ設定の保存タイミング (随時保存)**
>    - ユーザーからの指示に基づき、既存のUIロジックを踏襲し、**値が変更された瞬間に `SystemConfig.Instance.Save()` を実行して随時保存**します。
>    - フッターに配置する **Cancel** および **Save** ボタンは、すでに値が保存されているため、**ウィンドウを閉じる (Hide) 処理** として動作させます。
> 3. **アイコン画像の取得と配置**
>    - 指示書に記載されている各プロバイダー公式URL（および特定したWikipedia Commons直リンク）から直接アイコン画像（SVG/PNG）をダウンロードし、`assets/icons/providers/` 配下に配置します。

---

## オープン質問

> [!NOTE]
> 既存の `SystemConfig` には `Temperature` や `Top-K` などのパラメータが定義されていないため、本実装に合わせて `SystemConfig.cs` に設定フィールドを追加します。これらのデフォルト値は、指示書に合わせて `Temperature = 1.0`（可変範囲 0.0〜2.0、デフォルト 1.0、指示書例は1.5）、`Top-K = 20`（可変範囲 1〜100、デフォルト 20）としますが、これで問題ないでしょうか？

---

## 提案される変更

### 1. 設定情報の拡張

#### [MODIFY] [SystemConfig.cs](file:///c:/workspace/workspace-win/DesktopAiMascot/SystemConfig.cs)
- `ChatAiTemperature` (double, デフォルト 1.0)
- `ChatAiTopK` (int, デフォルト 20)
- `ChatAiTopKToggle` (bool, デフォルト false)
- `ChatAiAudioRandomElititors` (bool, デフォルト false)
- `ChatAiBridgesRopherlyModels` (bool, デフォルト true)
- `ChatAiFilterChatOnlyModels` (bool, デフォルト true)
以上のパラメータフィールドをシリアライズ可能なプロパティとして追加し、`Load()` および `Save()` メソッドでのロード・セーブ処理を組み込みます。

---

### 2. アイコンアセットの追加

#### [NEW] `assets/icons/providers/` 配下の画像ファイル
- `gemini_icon.svg` (Gemini用 Google公式SVG)
- `claude_icon.svg` (Claude用 Wikimedia Commons SVG)
- `codex_icon.png` (Codex用 OpenAI公式PNG)
- `lm_studio_icon.png` (LM Studio公式PNG)
- `ollama_icon.svg` (Ollama公式SVG)
- `foundry_icon.svg` (Foundry Local公式SVG)

---

### 3. UIシーンの再構成

#### [MODIFY] [ChatAiPropertyPage.tscn](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/settings/pages/ChatAiPropertyPage.tscn)
既存の垂直レイアウトを、マージンを適切に取った 2カラム（`HBoxContainer`）のモダンなスタイルへと刷新します。
- **中央カラム (AI Engine選択リスト)**:
  - タイトルとエリア見出し。
  - プロバイダーを選択できる縦型のスクロールリスト (`ScrollContainer` + `VBoxContainer`)。
  - 各リスト項目は、アイコン、名称、説明文を垂直・水平に整列させた角丸カード（ホバー・選択フィードバック付きの `PanelContainer` + `Button` 構成）。
  - 現在選択中の項目にはライトブルーのハイライトと右端のチェックマークを表示。
- **右端カラム (モデル＆パラメータ詳細)**:
  - 白背景、角丸 `8px`、薄いボーダー。
  - `Model` 選択ComboBoxと `Refresh` ボタン（横並び）。
  - `Temperature` スライダー (現在値表示)。
  - `Top-K` スライダー (現在値表示)。
  - トグルスイッチ群 (3つ: `CheckButton` をカスタマイズ)。
  - `Filter Chat-only Models` チェックボックス。
  - **未実装エンジン用オーバーレイ**: Claudeなどが選ばれた際に、操作不可であることを明示するメッセージを表示。
  - **フッターアクション**: `Cancel`（赤い✕、ダークグレー）と `Save`（💾、薄青背景、ダークブルー）ボタンを右下に配置。

---

### 4. コントロールロジックの実装

#### [MODIFY] [ChatAiPropertyPage.cs](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/settings/pages/ChatAiPropertyPage.cs)
- 中央のプロバイダーリストクリック時の選択制御（選択されたプロバイダーの即時保存とUIの切り替え）。
- 各パラメータ（スライダー、トグル、チェックボックスなど）変更時の `SystemConfig` への即時反映および `Save()` の実行。
- `Save` ボタンおよび `Cancel` ボタン押下時：親ウィンドウを閉じる処理（Hide）の呼び出し。
- 未実装エンジン選択時に、右ペインのコンポーネントの `Editable` または `Disabled` をトグル切り替えし、「未実装」警告ラベルを表示する処理。
- プロバイダーの項目コンポーネント化（内部のヘルパークラスまたは動的ノード生成で対応）。

---

## 検証計画

### 自動テスト / コンパイル確認
- `dotnet build` を実行し、コンパイルエラーがないことを確認。
- 警告や例外がログ（`godot_run.log`）に出力されないかを確認。

### 手動検証
- 設定ウィンドウを開き、左側で「Chat AI」を選択した際に、新デザインの3カラム（実質3ペイン）が正しく配置されることを確認。
- 各プロバイダーを選択し、ハイライト表示およびチェックマークが正しく切り替わることを確認。
- 未実装プロバイダー（Claude等）を選択した際に、右ペインがグレーアウトし、「このエンジンは現在未実装です」と表示されることを確認。
- 実装済プロバイダー（Gemini、LM Studio、Foundry Local）を選択した際に、モデル一覧が正しくロードされ、スライダーやトグルの操作ができることを確認。
- 値を変更した後に「Save」または「Cancel」をクリックすると設定ウィンドウが閉じることを確認。
- 変更した値が設定ファイルに即座に反映され、アプリ再起動時にも正しく保持されていることを確認。
