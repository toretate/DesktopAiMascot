# DesktopAiMascotTest

このディレクトリには、DesktopAiMascot プロジェクトのテストコードが含まれています。

## テストプロジェクトの構成

- **単体テスト (Unit Tests)**: モック・スタブを使用して、個別のコンポーネントをテストします
- **統合テスト (Integration Tests)**: 実際のサービスとの接続をテストします（Skip 属性付き）

## テストの実行

### すべてのテストを実行

```powershell
cd ..\DesktopAiMascotTest
dotnet test
```

### Visual Studioから実行

1. ソリューションエクスプローラーでテストプロジェクトを右クリック
2. 「テストの実行」を選択

### 特定のテストクラスを実行

```powershell
dotnet test --filter "FullyQualifiedName~StyleBertVits2ServiceTests"
```

## カバレッジレポートの生成

```powershell
dotnet test --collect:"XPlat Code Coverage"
```

## StyleBertVits2Service のテスト

### 単体テスト (`StyleBertVits2ServiceTests.cs`)

以下の機能をテストします:

- コンストラクタとURL設定
- モデルとスピーカーの取得
- サーバー情報、ステータス、リフレッシュAPI
- 音声合成 (短いテキスト、感情フィルタリング)
- ストリーミング音声合成
- エラーハンドリング
- モデルIDとスピーカーIDのパース

### 統合テスト (`StyleBertVits2ServiceIntegrationTests.cs`)

実際のStyleBertVits2サーバーとの通信をテストします:

- サーバー情報の取得
- 実際の音声合成
- 長いテキストの分割処理
- ストリーミング合成
- カスタムパラメータでの合成

**注意**: 統合テストはデフォルトでスキップされます。

### 統合テストを実行する方法

統合テストを実行するには、環境変数 `RUN_INTEGRATION_TESTS=true` を設定してください。

#### Windows (PowerShell)
```powershell
# 環境変数を設定
$env:RUN_INTEGRATION_TESTS="true"

# テストを実行
dotnet test
```

#### Windows (コマンドプロンプト)
```cmd
set RUN_INTEGRATION_TESTS=true
dotnet test
```

#### Visual Studio から実行
1. テストエクスプローラーを開く
2. 環境変数を設定:
   - `ツール` → `オプション` → `テスト` → `環境変数`
   - または、プロジェクトの起動設定で環境変数を設定
3. StyleBertVits2サーバーを `http://127.0.0.1:5000` で起動
4. テストを実行

統合テスト実行の**前提条件**:
- StyleBertVits2サーバーが `http://127.0.0.1:5000` で起動していること
- サーバーが正常に動作していること

## 使用しているテストフレームワーク

- **xUnit**: テストフレームワーク
- **Moq**: モックライブラリ
- **coverlet**: コードカバレッジツール

## テストの追加方法

1. 適切なディレクトリにテストクラスファイルを作成
2. `[Fact]` 属性を使用してテストメソッドを定義
3. `dotnet test` でテストを実行

### テストメソッドの命名規則

```
[テスト対象メソッド]_[テスト条件]_[期待される結果]
```

例:
```csharp
[Fact]
public async Task SynthesizeAsync_WithShortText_ReturnsAudioData()
{
    // テストコード
}
```

## トラブルシューティング

### 統合テストを実行したい場合

1. StyleBertVits2サーバーを起動
2. サーバーのURLが `http://127.0.0.1:5000` であることを確認
3. テストコードの `Skip` 属性を削除または `Skip = null` に変更
4. テストを実行

### ビルドエラーが発生する場合

```powershell
dotnet clean
dotnet restore
dotnet build
```

## テストの実行結果例

```
単体テスト: 20個 すべて成功
統合テスト: スキップ
カバレッジ: 80%以上
```
