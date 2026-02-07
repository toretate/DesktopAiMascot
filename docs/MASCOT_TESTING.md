# マスコットテストの実行方法

このドキュメントでは、プライベートマスコットをローカルでテストし、GitHub CI環境では公開マスコットのみテストする方法を説明します。

## 環境変数の設定

### ローカル開発環境でのテスト（全マスコット）

プライベートマスコット (misogi, miyako, miku, metan) を含めてテストしたい場合、環境変数を設定してテストを実行します。

**PowerShell の場合：**
```powershell
$env:MASCOT_TEST_LOCAL = "1"
dotnet test
```

**コマンドプロンプト (cmd) の場合：**
```cmd
set MASCOT_TEST_LOCAL=1
dotnet test
```

**Bash/Linux/macOS の場合：**
```bash
export MASCOT_TEST_LOCAL=1
dotnet test
```

### CI環境（GitHub Actions）でのテスト（公開マスコットのみ）

環境変数を設定しないで実行すると、公開マスコット (default) のみがテスト対象になります。

```bash
# CI環境では MASCOT_TEST_LOCAL を設定しない
dotnet test
```

## テスト構造

### MascotManagerTests.cs

マスコット管理システムのテスト：
- `Load_すべてのマスコットがロードされる` - マスコット読み込みの確認
- `Load_マスコットのPromptが空でない` - システムプロンプト生成の確認
- `Load_マスコットのConfigが解析されている` - 設定解析の確認
- `Load_マスコットのPromptにキャラクター情報が含まれている` - キャラクター情報の確認

### MascotConfigIOTests.cs

YAML パース機能のテスト：
- `ParseFromYaml_すべてのマスコットで正しくパースできる` - YAML パース確認
- `ParseFromYaml_SystemPromptが正しく解析される` - SystemPrompt 解析確認
- `ParseFromYaml_プロンプトが人間が読める形式で生成される` - プロンプト形式確認
- その他のテスト

### LmStudioChatServiceTests.cs

LmStudio チャットサービスのテスト：
- SystemPrompt の読み込みと設定の確認

## GitHub Actions での設定

`.github/workflows/` に CI 設定ファイルを作成する場合、環境変数を設定しないようにしてください：

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-dotnet@v3
        with:
          dotnet-version: '8.0.x'
      - run: dotnet test
        # 環境変数 MASCOT_TEST_LOCAL を設定しない
```

## まとめ

| 環境 | 環境変数設定 | テスト対象マスコット |
|------|-----------|-------------------|
| ローカル開発 | `MASCOT_TEST_LOCAL=1` | misogi, miyako, miku, metan, default |
| ローカル開発（最小限） | 設定なし | default のみ |
| GitHub Actions (CI) | 設定なし | default のみ |

この方法により、GitHub リポジトリには公開マスコットのみを含め、ローカル開発環境ではプライベートマスコットもテストできます。
