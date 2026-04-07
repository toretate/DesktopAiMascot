# マスコット設定とランタイムエラーの修正結果

## 対応内容
DesktopAiMascot プロジェクトの Godot 移植版で、マスコット画面および設定保存に関連する以下の修正を実施しました。

### 1. マスコット一覧でのカバー画像表示と切り替え
- **対象**: `MascotPropertyPage.cs`
- `Godot.ItemList` に対して `SetItemIcon` を使用し、各マスコットフォルダ内の `cover.png`（または最初の画像）を表示するように修正しました。
- リスト項目を選択した際、`MascotChanged` イベントを介して即座に画面上のマスコット `AnimatedSprite2D` へ反映されるように、`Main.cs` のイベントハンドリングに統合しました。

### 2. Config保存時の `ProtectedData` アセンブリロードエラーの解消
- **対象**: `SystemConfig.cs`
- .NET 8 / Godot C# クロスプラットフォーム環境において、Windows DPAPI (`System.Security.Cryptography.ProtectedData`) の依存関係が正しくロードされず `Config save failed` になる問題を解消しました。
- APIキーの暗号化方式を Base64 による簡単な難読化へと変更（※ローカル環境向けの回避策）。
- 以前に DPAPI で暗号化されていた設定を読み込む際は、リフレクションを通じて `Type.GetType(...)` で動的に DPAPI の復号メソッドを呼び出すようにし、古い設定ファイルとの後方互換性を維持しました。

### 3. アプリ再起動時のマスコット選択状態のリセット問題の解消
- **対象**: `Main.cs` および `SystemConfig.cs`
- **保存先パスの修正**: Godotエディタ実行時等の場合、C# の `AppDomain.CurrentDomain.BaseDirectory` では一時ビルドフォルダとなり揮発してしまうため、Godot の `user://` パス（Windowsでは `%APPDATA%/Godot/app_userdata/DesktopAiMascot/`）を設定の永続化先に修正しました。
- **UI上書きの防止**: アプリ起動後、裏で非表示のまま初期化された設定画面 (`SettingsWindow.tscn`) が、`MascotManager.CurrentModel` が `null` と誤認して一番上のマスコット (default) を強制保存してしまうバグがありました。`Main.cs` で初期化直後に `CurrentModel` へ選択状態のマスコットをセットしておくことで、この問題を解消しました。

## 確認事項
- [x] 設定画面でマスコットを切り替えた時、即座に画面へ反映されること
- [x] マスコットを選択してアプリを再起動した時、選択したマスコットが維持されていること
- [x] ログ上で `ProtectedData` の `DllNotFoundException` が発生していないこと
