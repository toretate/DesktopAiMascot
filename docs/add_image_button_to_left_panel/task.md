# タスクリスト: PowerShell出力安定化とC#側フィルタリングの実装

- [x] `MascotEditWindow.tscn` の UI 編集 (完了)
- [x] `MascotEditWindow.cs` のロジック修正
    - [x] `ShowOpenFileDialogViaPowerShell()` の先頭に `$ProgressPreference = 'SilentlyContinue'` を追加
    - [x] `OnAddImageButtonPressed()` に `File.Exists` を用いたファイルパスフィルタリングを追加
- [x] ビルド検証
    - [x] `dotnet build` によるコンパイル確認
- [x] 修正内容のドキュメント作成
    - [x] `walkthrough.md` の更新
