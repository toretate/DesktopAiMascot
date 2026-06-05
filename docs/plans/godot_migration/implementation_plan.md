# Godot移行の実装計画

WPFベースのデスクトップマスコットプロジェクトを、Godot Engine (C#/.NET) のプロジェクトとして再構築し、パフォーマンスと将来の拡張性を向上させます。

## Proposed Changes

### Godot Project Configuration (プロジェクト設定の変更)
#### [MODIFY] project.godot
以下のディスプレイ設定を有効にして、デスクトップマスコットとしての基盤を作ります。
*   `display/window/size/borderless=true` (枠なしウィンドウ)
*   `display/window/size/transparent=true` (背景透過)
*   `display/window/size/always_on_top=true` (常に最前面)
*   `display/window/per_pixel_transparency/allowed=true` (ピクセル単位の透過)

#### [MODIFY] DesktopAiMascot.csproj
C#プロジェクトファイル内で、WPFまたはWindows Formsの機能を一部継承して利用可能にします（特にタスクトレイアイコン用）。
*   `<UseWindowsForms>true</UseWindowsForms>` を付与
*   既存コード (`SystemConfig.cs`等) への参照を追加

---

### Core UI Component (コアUIノード群の実装)
#### [NEW] Main.tscn / Main.cs (旧 MascotWindow.xaml)
*   画像の表示には `Sprite2D` または `AnimatedSprite2D` を使用します。
*   OSレベルのクリックスルー (Mouse Passthrough) を実装し、マスコットの非透明ピクセル部分だけをクリック判定にする処理を組み入れます (`DisplayServer.WindowSetMousePassthrough`)。
*   ドラッグによるウィンドウ全体の位置移動ロジックを実装します。

#### [NEW] MascotTrayIcon.cs
*   `System.Windows.Forms.NotifyIcon` を用い、バックグラウンドでのタスクトレイ表示・コンテキストメニュー（表示、非表示、終了など）を実装します。

---

### Interaction & Settings GUI (設定等UI群の移行)
#### [NEW] InteractionPanel.tscn / InteractionPanel.cs
*   プロンプト入力やAPIキー設定の入り口となるUI群。Godotの `Control` ノードを用いてデザインを組み直し、既存の `InteractionPanel.xaml.cs` 内のロジック（LLM通信への橋渡し）を移植します。

#### [NEW] SettingsWindow.tscn / SettingsWindow.cs
*   `SettingsForm.xaml` や各プロパティページ（Voice, Chat, Imageなど）に相当する設定画面のGUIを構築。
*   既存の `SystemConfig.Instance` とデータバインディングさせ、設定のセーブ・ロードロジックを統合します。

## Verification Plan

### Automated Tests
*   `dotnet build` コマンドでGodotプロジェクトのC#スクリプト群が正常にコンパイルされるかを確認します。

### Manual Verification
1.  **Godotエディタから実行**し、デスクトップ上でマスコットが以下の状態になるかテストします：
    *   背景が完全に透過されていること。
    *   マスコットが表示され、マウスのドラッグ＆ドロップでウィンドウが移動できること。
    *   マスコット以外の透明部分をクリックすると、奥にあるウィンドウやブラウザにクリックがパススルーされること。
2.  **右下のタスクトレイ**にアイコンが登録され、右クリックメニューから終了などの基本操作が行えることを確認します。
3.  **入力パネルおよび設定画面**を開き、従来通りAPIキーなどの読み書きが `SystemConfig` を通じて行われるかをテストします。
