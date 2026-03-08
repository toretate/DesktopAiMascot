# Godot移行タスクリスト

- [x] 第一段階: Godotプロジェクトの基盤構築
  - [x] `project.godot` の設定（背景透過、枠なし、最前面表示、マウスパススルー許可）
  - [x] `.csproj` の設定（Windows Formsの利用許可など）

- [x] 第二段階: マスコットの表示と基本イベント
  - [x] メインシーン (`Main.tscn`) の作成と、スプライトノードの配置
  - [x] `Main.cs` の実装（マウスクリック透過処理の適用）
  - [x] `Main.cs` の実装（ドラッグ＆ドロップによるウィンドウ移動処理）

- [x] 第三段階: 既存機能の統合
  - [x] `SystemConfig` などのコアC#クラスの呼び出し確認
  - [x] タスクトレイアイコン（`NotifyIcon`）の再実装とメニュー配置

- [x] 第四段階: UI群の移行
  - [x] 入力パネル（旧 `InteractionPanel`）のGodot UIリプレイス
  - [x] 設定画面（旧 `SettingsForm` の各プロパティページ）のGodot UIリプレイス
    - [x] `SettingsWindow` (ベースウィンドウ) の作成
    - [x] `MascotPropertyPage` の作成
    - [x] `ChatAiPropertyPage` の作成
    - [x] `VoiceAiPropertyPage` の作成
    - [x] `ImageAiPropertyPage` 等のその他ページの作成
  - [/] ユーザー設定のデータ・バインディング処理の復元

- [ ] 第五段階: アニメーション最適化
  - [ ] `AnimatedSprite2D` などを活用したアニメーション再生の構築
  - [ ] （必要に応じた）アセットの再構成
