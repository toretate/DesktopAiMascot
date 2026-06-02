# C#およびGodot関連コード・アセットの全削除 実装計画

現在の開発スタックである Electron + Vite + Vue3 + TypeScript への完全移行に伴い、不要となった古い C# 実装および Godot Editor 関連のすべてのコード、設定ファイル、ログ、インポート設定などを完全に削除し、リポジトリをクリーンアップします。

## 変更の目的

- 不要なレガシーコードおよびアセットの削除による、リポジトリ容量の削減と可読性の向上。
- C# や Godot への誤った依存の混入防止。
- 新しい Electron + Vue スタックへの完全な一元化。

## 提案される変更点

### [DELETE] 関連ファイルおよびディレクトリ

#### [DELETE] [ルート直下の C# / Godot 関連ファイル](file:///c:/workspace/workspace-win/DesktopAiMascot/)
- `DesktopAiMascot.csproj` (および `.old`, `.user`)
- `DesktopAiMascot.sln`
- `Main.cs` / `Main.cs.uid` / `Main.tscn`
- `MascotTrayIcon.cs` / `MascotTrayIcon.cs.uid`
- `MascotWindow.xaml.legacy` / `MascotWindow.xaml.cs.legacy`
- `Program.cs.legacy`
- `SystemConfig.cs` / `SystemConfig.cs.uid`
- `project.godot` / `title.tres`
- `godot_crash.log` / `godot_run.log` / `godot_run2.log` / `godot_run3.log`

#### [DELETE] [C# / Godot 関連のディレクトリ](file:///c:/workspace/workspace-win/DesktopAiMascot/)
- `.godot/` (Godot キャッシュ・メタデータ)
- `DesktopAiMascotTest/` (C# ユニットテスト)
- `Properties/` (C# アセンブリ・リソース設定)
- `_legacy_controls/` (旧 WPF/Forms コントロール)
- `_legacy_views/` (旧 WPF/Forms ビュー)
- `Animation/` (旧 C# アニメーション管理)
- `skills/` (旧 C# スキルコード)
- `utils/` (旧 C# ユーティリティコード)
- `ui/` (旧 C# UI)

#### [DELETE] [アセットディレクトリ配下のインポート設定ファイル](file:///c:/workspace/workspace-win/DesktopAiMascot/assets/)
- `assets/**/*.png.import` (Godot 由来のインポート設定ファイル)

## 検証計画

### 自動テスト・ビルド確認
- `npm run build` を実行し、余計なファイルが削除されたクリーンな環境下で Electron/Vue のプロダクションビルドが正常に動作することを確認します。
