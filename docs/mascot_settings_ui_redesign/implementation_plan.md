# マスコット設定画面のUIデザイン再設計・実装計画 (新レイアウト対応)

ユーザーから提供された新しいレイアウト指示書（画像）に基づいて、マスコット設定画面（`MascotPropertyPage`）を3ペイン構成（リスト・プレビュー・詳細）へ拡張し、よりプレミアムなデザインへと再設計します。

## ユーザーレビュー要求

以下の詳細なレイアウト仕様についてご確認をお願いします：
- **ウィンドウのサイズ拡張**: デフォルトサイズおよび最小サイズを `1024x768` に拡張します。
- **中央プレビューペインの追加**: 
  - 画面中央にマスコットの全身画像（プレビュー）を表示する伸縮主体の `PreviewPanel` を新設します。
- **左メニュー（カテゴリ選択）のスタイリング**:
  - `CategoryList` の選択項目に対し、淡い青色背景と**左端アクセント線（テーマカラー `#3478F6`）**を適用します。
- **右詳細ペインの固定幅化**:
  - `DetailsPanel` の幅を `360px` 固定とし、プライマリボタン（Edit）を鮮やかな青（`#3478F6`）で塗りつぶしたスタイルに更新します。セカンダリボタン（Generate, Remove）はアウトライン＋薄いカラーの洗練されたスタイルにします。
- **角丸の統一**:
  - すべてのパネル、カード、ボタンの角丸を `8px` に統一します。

---

## 提案する変更

変更は大きく3つのファイル（設定ウィンドウ全体、マスコットプロパティページシーン、C#コード）に分かれます。

### 1. 設定ウィンドウ全体のサイズとナビゲーションの調整

#### [MODIFY] [SettingsWindow.tscn](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/settings/SettingsWindow.tscn)
- デフォルトおよび最小サイズを `1024x768` に拡張します：
  - `size = Vector2i(1024, 768)`
  - `min_size = Vector2i(1024, 768)`
- ナビゲーションメニュー（`CategoryList`）の幅を `180px` に設定し、淡い青色背景と左端アクセント線（`#3478F6`、太さ `4px`）を持つ `StyleBoxFlat` を `selected` および `selected_focus` スタイルに適用します。

---

### 2. マスコットプロパティページの3ペイン化（シーン改修）

#### [MODIFY] [MascotPropertyPage.tscn](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/settings/pages/MascotPropertyPage.tscn)
- 全体の `HBoxContainer` を **3カラム構成** に変更します。
  1. **左カラム: `LeftVBox` (マスコットカードリスト)**:
     - 幅を調整し、下部に白背景＋グレー枠線＋角丸 `8px` の `AddButton` を固定配置します。
  2. **中央カラム: `PreviewPanel` (新設・全身プレビュー)**:
     - `size_flags_horizontal = SizeFlags.ExpandFill` (伸縮主体) とします。
     - 白または非常に薄いグレーの背景、角丸 `8px`、ソフトなドロップシャドウを適用します。
     - 内部に `ScrollContainer`（縦スクロールのみ）を配置し、その中に `TextureRect` (Mascot) を `Keep Aspect Centered` (アスペクト比維持) で中央配置します。
  3. **右カラム: `RightVBox` (詳細＆操作パネル)**:
     - 幅を `360px` 固定 (`custom_minimum_size = Vector2(360, 0)`) にします。
     - `InfoPanel` に角丸 `8px`、白いカード背景、ソフトなシャドウを適用します。
     - テキスト：
       - `Current Voice Settings`（中サイズ太字）
       - マスコット名 `name`（大サイズ太字）
       - `Voice Style`（見出し）と `voice settings`（小文字/薄い色）
     - ボタン群：
       - **EditButton (Primary)**: `#3478F6` で塗りつぶした青背景、白文字、角丸 `8px`、左アイコン（📝）付き。
       - **GenerateEmotesBtn / RemoveBgBtn (Secondary)**: アウトライン境界線と非常に薄いカラー背景、角丸 `8px`。

---

### 3. 全身プレビュー画像の表示対応（C#ロジック追加）

#### [MODIFY] [MascotPropertyPage.cs](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/settings/pages/MascotPropertyPage.cs)
- マスコットカードの生成時、角丸を `12px` から指示書指定の `8px` に更新します。
- `%PreviewTexture` をメンバー変数 `_previewTexture` としてバインドします。
- `UpdateLabels()` やマスコット切り替え時に、選択されたマスコットの正面全身画像（`cover.png` もしくは `GetFrontImage()`）をロードし、`_previewTexture.Texture` に設定する表示ロジックを実装します。

---

## 検証計画

### 自動テスト
- `dotnet build` を実行し、C#コードがビルドエラーなく完了することを確認します。

### 手動検証
- `dotnet run` でアプリを起動し、設定画面を開きます。
- **ウィンドウサイズ変更時の挙動**: ウィンドウ幅を広げたり縮めたりしたときに、中央の `PreviewPanel` が伸縮主体として滑らかにサイズ変更され、マスコット全身画像がアスペクト比を維持したまま拡大縮小することを確認します。
- **左メニューと各ボタンのスタイル**: 指示書通りのカラー（Primary Blue、アウトライン、淡い青の選択線など）が正しく適用されているか確認します。
- マスコットを切り替えた際、中央の全身画像が瞬時に対応するマスコットの画像に更新されることを確認します。
