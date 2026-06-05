# Godot 移行完了報告 (Walkthrough)

DesktopAiMascot プロジェクトの Windows Forms (WPF系) から Godot Engine (C#) への主要な移行タスクがすべて完了しました。以下に実装内容と検証結果をまとめます。

## 実施内容サマリー

### 第一段階: Godotプロジェクトの基盤構築
- `project.godot` を設定し、背景透過・枠なしウィンドウ・最前面表示・マウスパススルー許可などのデスクトップマスコットに必要なウィンドウプロパティを設定しました。
- `DesktopAiMascot.csproj` を改修し、Godotのビルドプロセスに既存のWinForms/WPFライブラリ参照を統合しました。

### 第二段階: マスコット表示と基本イベント
- `Main.tscn` を作成し、マスコット表示用の基底シーンを構築しました。
- `Main.cs` において、`DisplayServer.WindowSetMousePassthrough` を用いてマスコットのピクセル領域以外のマウスクリックを透過する処理を実装しました。
- ドラッグ＆ドロップによるマスコット（ウィンドウ全体）の移動処理を実装しました。

### 第三段階: 既存機能の統合
- `SystemConfig` クラスを利用した設定ファイルの読み書き処理を Godot の実行フロー (`_Ready` 内など) と統合しました。
- `NotifyIcon` を用いたタスクトレイアイコンとコンテキストメニューを再実装し、Godot 環境から安全に呼び出せるよう調整しました。

### 第四段階: UI群の移行（シーン化とデータバインディング）
WPFで実装されていた既存のUIコンポーネントを、GodotのGUIシステム (Controlノード等) と `.tscn` シーンに完全に移行しました。
- **対象シーン**: 
  - `SettingsWindow.tscn` (設定ウインドウ本体)
  - `ApiKeyPropertyPage.tscn` (APIキー設定)
  - `ChatAiPropertyPage.tscn` (チャットAIのエンジン・モデル設定)
  - `VoiceAiPropertyPage.tscn` (音声AIの設定、StyleBertVits2/VoiceVox対応)
  - `ImageAiPropertyPage.tscn`, `MovieAiPropertyPage.tscn` (その他のAI設定)
  - `MascotPropertyPage.tscn` (マスコット管理・選択)
  - `InteractionPanel.tscn`, `MessageListPanel.tscn` (会話用チャットUI)
- **データバインディング**: `SystemConfig` や Manager クラス群に対する設定の読み書き、イベントフックをGodotのC#スクリプト側で再実装しました。これによりエディタで配置したノードとコードのロジックが正常に連携します。

### 第五段階: アニメーション最適化
- `Main.tscn` におけるマスコットの単一画像表示 (`Sprite2D`) を `AnimatedSprite2D` に統合しました。
- `Main.cs` にて、マスコットのディレクトリに存在する複数の画像リソースから動的に `SpriteFrames` を生成し、パラパラ漫画のようにアニメーション（初期設定 5 FPS、ループ再生）させる処理を実装しました。

## 実装・検証結果

- **ビルドの成功**: `dotnet build` コマンドがエラーなく通ることを確認。型の競合（Godot側の `Label` や `Button` と WinForms 側の型の衝突）はすべて名前空間の明示（`using Label = Godot.Label;`等）で解消しています。
- **マスコットのアニメーション再生**: アプリケーション起動時に複数ファイルからフレームを組み立て、アニメーションが再生される状態になりました。
- **UIとの連携**: 設定画面、チャット画面がマスコットと連動して起動・動作可能な構造に置き換わりました。

## 今後について
これにて現状の移行ロードマップはすべて達成しました。引き続き機能拡張を行う場合は、構築された各種 `.tscn` と C# スクリプトを連携させたアプローチで開発を進めることができます。
