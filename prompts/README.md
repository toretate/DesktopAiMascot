# ラジオモード用 LLMプロンプト集

## 概要

このディレクトリには、ラジオモード（2人のマスコットによる会話番組）のシナリオ生成に使用するLLMプロンプトが含まれています。
各プロンプトは特定のシチュエーションに対応しており、自然で魅力的な会話シナリオを生成できます。

## プロンプトファイル一覧

| ファイル名 | シチュエーション | 用途 |
|-----------|----------------|------|
| `radio_opening.md` | 番組開始（まくら） | 番組の導入部分、挨拶と番組紹介 |
| `radio_topic.md` | ある話題について | ユーザーが指定した話題について会話 |
| `radio_freetalk.md` | フリートーク | テーマを決めない自然な雑談 |
| `radio_seasonal.md` | 季節の話題 | 季節に合わせた話題で会話 |
| `radio_weather.md` | 天気予報 | 天気情報を伝えながら会話 |

## 基本的な使い方

### 1. プロンプトの選択
シチュエーションに応じて適切なプロンプトファイルを選択します。

### 2. 変数の置換
プロンプト内の変数（`{TOPIC}`, `{SEASON}` 等）を実際の値に置換します。

### 3. LLMへのリクエスト
完成したプロンプトをLLM（Google AI Studio, OpenAI, Claude等）に送信します。

### 4. レスポンスの処理
JSON形式で返されるシナリオを解析し、音声合成とUIに反映します。

## 実装例（C#）

```csharp
using System.Text.Json;

public class RadioScenarioGenerator
{
    private readonly IAiService _aiService;
    
    public async Task<RadioScenario> GenerateOpeningScenarioAsync()
    {
        // プロンプトファイルを読み込む
        string prompt = await File.ReadAllTextAsync("prompts/radio_opening.md");
        
        // LLMに送信
        string response = await _aiService.GenerateAsync(prompt);
        
        // JSON部分を抽出
        string jsonPart = ExtractJsonFromResponse(response);
        
        // デシリアライズ
        var scenario = JsonSerializer.Deserialize<RadioScenario>(jsonPart);
        
        return scenario;
    }
    
    public async Task<RadioScenario> GenerateTopicScenarioAsync(string topic)
    {
        string prompt = await File.ReadAllTextAsync("prompts/radio_topic.md");
        prompt = prompt.Replace("{TOPIC}", topic);
        
        string response = await _aiService.GenerateAsync(prompt);
        string jsonPart = ExtractJsonFromResponse(response);
        var scenario = JsonSerializer.Deserialize<RadioScenario>(jsonPart);
        
        return scenario;
    }
    
    private string GetSeason(int month)
    {
        return month switch
        {
            3 or 4 or 5 => "春",
            6 or 7 or 8 => "夏",
            9 or 10 or 11 => "秋",
            12 or 1 or 2 => "冬",
            _ => "春"
        };
    }
    
    private string ExtractJsonFromResponse(string response)
    {
        int startIndex = response.IndexOf('{');
        int endIndex = response.LastIndexOf('}') + 1;
        
        if (startIndex >= 0 && endIndex > startIndex)
        {
            return response.Substring(startIndex, endIndex - startIndex);
        }
        
        return response;
    }
}
```

## データモデル

```csharp
public class RadioScenario
{
    public string Scenario { get; set; }
    public string Title { get; set; }
    public List<Conversation> Conversations { get; set; }
}

public class Conversation
{
    public string Speaker { get; set; }  // "MC" or "Assistant"
    public string Text { get; set; }
    public string Emotion { get; set; }
}
```

## プロンプトのカスタマイズ

各プロンプトファイルには「カスタマイズオプション」セクションがあります。
プロジェクトの要件に応じて、プロンプトを調整してください。

### カスタマイズ例

#### キャラクター性の反映
```
【キャラクター設定】
MC:
- 名前: ミク
- 性格: 明るく元気、好奇心旺盛
- 口調: カジュアルで親しみやすい
```

## 注意事項

1. **JSON形式の確認**
   - LLMの応答がJSON形式で返されることを前提としています
   - 実際の応答には説明文が含まれる場合があるため、JSON部分を抽出する処理が必要です

2. **エラーハンドリング**
   - LLMの応答が期待通りでない場合のエラー処理を実装してください
   - タイムアウトや通信エラーへの対応も必要です

3. **コスト管理**
   - LLM APIの呼び出しにはコストがかかります
   - キャッシュやプリセットシナリオの活用を検討してください

4. **コンテンツフィルタリング**
   - 不適切な内容が生成される可能性があります
   - 必要に応じてフィルタリング処理を実装してください

## テスト

並行処理テストは `DesktopAiMascotTest\aiservice\voice\StyleBertVits2ServiceConcurrencyTests.cs` を参照してください。

## 関連ドキュメント

- [並行処理テスト仕様](../DesktopAiMascotTest/CONCURRENCY_TESTS.md)
- [並行処理テスト完了報告](../DesktopAiMascotTest/CONCURRENCY_TESTS_SUMMARY.md)

## 今後の拡張

- ユーザーからのフィードバックに基づく会話
- 過去の会話履歴を考慮したシナリオ生成
- リアルタイムイベントへの対応
- 複数話者（3人以上）への対応
