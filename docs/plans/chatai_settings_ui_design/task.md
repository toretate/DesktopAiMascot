# タスクリスト

## 設計・調査
- [x] ユーザー要求（指示書）および既存コードの調査
- [x] 実装計画書 (`implementation_plan.md`) の作成

## 準備作業
- [x] 指示書に記載されている各プロバイダー公式URLからアイコン画像を直接取得して配置 (`assets/icons/providers/`)
  - [x] Gemini (`gemini_icon.svg` - Google公式)
  - [x] Claude (`claude_icon.svg` - Wikimedia Commons)
  - [x] Codex (`codex_icon.png` - OpenAI公式)
  - [x] LM Studio (`lm_studio_icon.png` - LM Studio公式)
  - [x] Ollama (`ollama_icon.svg` - Ollama公式)
  - [x] Foundry Local (`foundry_icon.svg` - Foundry Local公式)

## データ層・設定の実装
- [x] `SystemConfig.cs` に以下の新規設定パラメータを追加
  - [x] `ChatAiTemperature` (double)
  - [x] `ChatAiTopK` (int)
  - [x] `ChatAiTopKToggle` (bool)
  - [x] `ChatAiAudioRandomElititors` (bool)
  - [x] `ChatAiBridgesRopherlyModels` (bool)
  - [x] `ChatAiFilterChatOnlyModels` (bool)
  - [x] `Load()` および `Save()` メソッドへのマッピング追記と初期値設定

## UIシーン (`ChatAiPropertyPage.tscn`) の大改修
- [x] 既存の垂直レイアウトを `HBoxContainer`（中央ペインと右ペイン）に再構築
- [x] **中央ペイン (AI Engine選択リスト)**:
  - [x] タイトル「Chat AI Settings」とエリア見出しラベルの配置
  - [x] スクロール可能なコンテナ (`ScrollContainer`) と、リスト並び用の `VBoxContainer` の定義
  - [x] リストのアイテムテンプレート（または動的スクリプト構築用のスタイル設定）
- [x] **右ペイン (モデル＆パラメータ詳細)**:
  - [x] 角丸白背景スタイルボックスの設定
  - [x] `Model` 選択ComboBoxと `Refresh` ボタンの横並び配置
  - [x] `Temperature` スライダーと現在値ラベル
  - [x] `Top-K` スライダーと現在値ラベル
  - [x] トグルスイッチ群 (3つ: `CheckButton` または独自スタイル)
  - [x] `Filter Chat-only Models` チェックボックス
  - [x] 未実装エンジン表示用のオーバーレイと警告メッセージラベル
  - [x] フッターの `Cancel` / `Save` ボタンの配置（アイコン画像または絵文字付き）

## 制御ロジック (`ChatAiPropertyPage.cs`) の実装
- [x] `SystemConfig` から各パラメータの初期値を読み込み、UIコントロールに反映する処理
- [x] 中央ペインのプロバイダー固定リストの動的生成ロジックの実装（アイコン読み込み、ホバー効果、選択時ハイライト、チェックマーク表示）
- [x] プロバイダー切り替えイベントの処理：
  - [x] 実装済エンジンの場合：対応するコントロールを有効化、モデル一覧を非同期ロード、`SystemConfig.Instance.LlmService` に保存
  - [x] 未実装エンジンの場合：右ペインをグレーアウトし、未実装警告オーバーレイを表示
- [x] 各コントロール（スライダー、チェックボックス、トグルなど）の値変更時に即座に `SystemConfig` を更新して `Save()` し、必要に応じて現在値ラベルを更新するイベント処理
- [x] `Save` ボタンおよび `Cancel` ボタン押下時に設定ウィンドウを閉じる (Hide) 処理の実装

## 検証・調整
- [x] プロジェクトのビルド (`dotnet build`) とエラー修正
- [x] Godot上での動作確認とUIの微調整（余白、色合い、角丸、スクロール挙動など）
- [x] 設定ファイルの保存と復元（アプリ再起動時）の動作確認
- [x] `walkthrough.md` の作成
