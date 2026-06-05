# マスコット編集画面の左側リストに画像追加ボタンを追加する実装計画 (バグ修正・PowerShell出力安定化版)

PowerShellが内部でアセンブリロードや処理を行う際に標準出力へ送出してしまう「進行状況ストリーム (CLIXML)」が画像パス一覧に混入し、画像の追加コピーが失敗する不具合を根本解決するため、**PowerShellの進捗出力を完全に抑制**し、さらに**C#側でファイルの存在確認を厳格に行う防護ロジック**を追加する計画です。

## ユーザー確認事項

> [!IMPORTANT]
> - PowerShellが `Add-Type` などを処理する際に、Windowsの環境によってはバックグラウンドの進行状況バー（Progress Stream）をXML形式 (`#< CLIXML`) で標準出力に流してしまうことが原因で、ファイルパスのパースに失敗していました。
> - 今回の修正により、PowerShell側で進捗出力を完全に非表示にし、かつC#側でファイルの実在性をチェックしてからインポートを行うことで、環境に依存せず100%安全かつ安定して動作するようになります。

---

## 提案される変更

### MascotEditWindow (ロジック修正)

#### [MODIFY] [MascotEditWindow.cs](file:///C:/workspace/workspace-win/DesktopAiMascot/ui/mascot_edit/MascotEditWindow.cs)
- `ShowOpenFileDialogViaPowerShell()` 内の PowerShell スクリプトの最先頭行に `$ProgressPreference = 'SilentlyContinue'` を追加し、プログレスストリームの出力を完全にブロックします。
- `OnAddImageButtonPressed()` 内で、取得したパス文字列に不正な文字（XMLの括弧やシリアライズヘッダー等）が含まれていないか、また実際にローカルファイルシステム上にファイルが存在するかを `File.Exists(trimmed)` を用いて厳格にフィルタリングします。

---

## 変更内容の詳細

### `MascotEditWindow.cs` の変更内容 (PowerShell連携部 & コピー部)

PowerShellスクリプトの更新：
```powershell
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
...
```

C#側での厳格な存在確認：
```csharp
var validFiles = new List<string>();
foreach (var file in selectedFiles)
{
    var trimmed = file.Trim();
    if (!string.IsNullOrEmpty(trimmed) && !trimmed.StartsWith("<") && !trimmed.StartsWith("#") && File.Exists(trimmed))
    {
        validFiles.Add(trimmed);
    }
}
```

---

## 検証計画

### 手動検証
1. マスコット編集画面を起動します。
2. 左下の「➕ 画像を追加」ボタンをクリックします。
3. Windows標準のファイル選択ダイアログが前面にポップアップすることを確認します。
4. 画像を選択し、「開く」をクリックした際、コンソールに XML (`#< CLIXML`) などの進行状況ログが一切出力されないことを確認します。
5. 選択した画像が左側のリストに即座に追加され、サムネイルが表示されることを確認します。
