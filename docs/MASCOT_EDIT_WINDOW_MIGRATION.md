# MascotEditWindow Godotマイグレーション完了報告

## 概要
MascotEditWindowをWPFからGodotへマイグレーションしました。

## マイグレーション日時
2024年（実施日）

## 作成されたファイル

### 1. MascotEditWindow
- **シーンファイル**: `ui/mascot_edit/MascotEditWindow.tscn`
- **スクリプト**: `ui/mascot_edit/MascotEditWindow.cs`
- **UIDファイル**: 
  - `ui/mascot_edit/MascotEditWindow.tscn.uid`
  - `ui/mascot_edit/MascotEditWindow.cs.uid`

### 2. MascotEditSettingControl
- **シーンファイル**: `ui/mascot_edit/MascotEditSettingControl.tscn`
- **スクリプト**: `ui/mascot_edit/MascotEditSettingControl.cs`
- **UIDファイル**: 
  - `ui/mascot_edit/MascotEditSettingControl.tscn.uid`
  - `ui/mascot_edit/MascotEditSettingControl.cs.uid`

## 更新されたファイル

### MascotPropertyPage
- **ファイル**: `ui/settings/pages/MascotPropertyPage.cs`
- **変更内容**: `OnEditButtonPressed`メソッドを追加し、MascotEditWindowを開く処理を実装

## 実装された機能

### MascotEditWindow
- ✅ マスコット基本情報の表示
- ✅ カバー画像の表示（180x180ピクセル）
- ✅ 画像一覧の表示（ItemListで実装）
- ✅ 画像選択機能
- ✅ 保存ボタン
- ✅ キャンセルボタン

### MascotEditSettingControl
- ✅ 名前の編集（LineEdit）
- ✅ プロフィール編集（TextEdit）
- ✅ 設定ファイル（config.yaml）の表示と編集
- ✅ 外部エディタで設定ファイルを開く機能
- ✅ ファイルからプロフィールを生成する機能
- ✅ LLMサービス選択（OptionButton）
- ✅ タブコントロール（TabContainer）
  - 角度タブ
  - 背景削除タブ
  - 画像追加タブ
  - 表情差分作成タブ
- ✅ 背景削除機能
  - 背景削除ボタン
  - 背景削除サービス選択
  - 背景削除前に戻すボタン
- ✅ 画像追加機能（FileDialogを使用）

## 未実装機能（将来の実装予定）

### AngleViewControl
- ⏳ 角度画像の表示と編集機能
  - 元のWPF版には`AngleViewControl.xaml`が存在
  - Godot版は`_angleViewContainer`として準備済み
  - 実装が必要

### EmoteGenerationTabPage
- ⏳ 表情差分生成機能
  - 元のWPF版には`EmoteGenerationTabPage.xaml`が存在
  - Godot版は`_emoteGenerationContainer`として準備済み
  - 実装が必要

### その他の細かい機能
- ⏳ ドラッグ&ドロップでのファイル指定（プロフィール生成）
- ⏳ 確認ダイアログ（背景削除前に戻す処理）
- ⏳ 進捗表示（背景削除中など）

## 技術的な注意事項

### 型の曖昧性解消
WPFとGodotの両方が同じ名前の型を持っているため、以下のusingエイリアスを使用：
```csharp
using Button = Godot.Button;
using Label = Godot.Label;
using FileDialog = Godot.FileDialog;
```

### イベント処理の違い
- **WPF**: `Click`イベント
- **Godot**: `Pressed`シグナル

### ファイルダイアログの違い
- **WPF**: `Microsoft.Win32.OpenFileDialog`
- **Godot**: `Godot.FileDialog`（シーンツリーに追加する必要がある）

### 画像読み込み
- `ImageLoadHelper.LoadGodotTexture()`を使用してGodot用のテクスチャを読み込み
- WPF版の`BitmapImage`から変更

## テスト方法

1. Godotエディタでプロジェクトを開く
2. 設定ウィンドウを開く
3. マスコットタブを選択
4. マスコットを選択して「Edit」ボタンをクリック
5. MascotEditWindowが開くことを確認
6. 各種機能（名前編集、プロフィール編集、画像選択など）をテスト

## 元のWPFファイルの場所

元のWPFファイルは`_legacy_views/MascotEdit/`ディレクトリに移動済み：
- `_legacy_views/MascotEdit/MascotEditWindow.xaml`
- `_legacy_views/MascotEdit/MascotEditWindow.xaml.cs`
- `_legacy_views/MascotEdit/MascotEditSettingControl.xaml`
- `_legacy_views/MascotEdit/MascotEditSettingControl.xaml.cs`
- `_legacy_views/MascotEdit/AngleViewControl.xaml`
- `_legacy_views/MascotEdit/AngleViewControl.xaml.cs`
- `_legacy_views/MascotEdit/EmoteGenerationTabPage.xaml`
- `_legacy_views/MascotEdit/EmoteGenerationTabPage.xaml.cs`
- `_legacy_views/MascotEdit/EmoteItem.cs`

## 次のステップ

1. ✅ MascotEditWindowの基本機能実装
2. ⏳ AngleViewControlのGodot版実装
3. ⏳ EmoteGenerationTabPageのGodot版実装
4. ⏳ 確認ダイアログなどのUI改善
5. ⏳ 実機テストとバグ修正

## ビルド状態

✅ ビルド成功（エラーなし）

## 参考情報

- Godot C# APIドキュメント: https://docs.godotengine.org/en/stable/classes/
- プロジェクトのcopilot-instructions: `.github/copilot-instructions.md`
