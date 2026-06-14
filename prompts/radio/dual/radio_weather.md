# 天気予報 シナリオ生成プロンプト

## 概要
このプロンプトは、天気予報情報を基に、2人のパーソナリティが会話するシナリオを生成します。
天気情報を伝えながら、日常生活に役立つアドバイスも提供します。

---

## プロンプト本文

```
あなたは、ラジオ番組の台本作家です。
天気予報を基にした会話シナリオを作成してください。

【登場人物】
- メインパーソナリティ（MC）: 天気情報を伝え、適切なアドバイスをする役割
- サポート役（アシスタント）: リスナーの立場から質問や反応をする役割

【天気情報】
- 現在の天気: {CURRENT_WEATHER}
- 現在の気温: {CURRENT_TEMP}℃
- 今日の予想最高気温: {MAX_TEMP}℃
- 今日の予想最低気温: {MIN_TEMP}℃
- 降水確率: {RAIN_PROBABILITY}%
- 明日の天気: {TOMORROW_WEATHER}
- 一週間の天気傾向: {WEEK_TREND}

【シナリオの条件】
1. 会話は8〜12ターン程度（1人あたり4〜6回発言）
2. 天気情報をわかりやすく伝える
3. 天気に応じた服装や持ち物のアドバイスを含める
4. 日常生活への影響や注意点を伝える
5. 明るく前向きなトーンを保つ
6. リスナーの行動を後押しする内容にする

【会話の流れ】
1. 現在の天気状況の紹介
2. 今日の気温と体感の説明
3. 服装や持ち物のアドバイス
4. 降水確率や天気の変化の注意喚起
5. 明日以降の天気予報
6. 週末や特別な日の天気（該当する場合）
7. 天気に合わせた過ごし方の提案

【天気別のポイント】
晴れ:
- 気持ち良い天気であることを強調
- 洗濯や外出のチャンス
- 紫外線対策の注意（春〜秋）

曇り:
- 過ごしやすさを伝える
- 折り畳み傘の携帯を推奨
- 屋内外問わず活動しやすい

雨:
- 傘や雨具の準備を促す
- 雨の日の楽しみ方を提案
- 足元の注意喚起

雪:
- 防寒対策の徹底を促す
- 路面凍結への注意
- 雪の日の特別な楽しみ

【出力形式】
以下のJSON形式で出力してください：

{
  "scenario": "weather_forecast",
  "title": "天気予報",
  "weather_data": {
    "current_weather": "{CURRENT_WEATHER}",
    "current_temp": {CURRENT_TEMP},
    "max_temp": {MAX_TEMP},
    "min_temp": {MIN_TEMP},
    "rain_probability": {RAIN_PROBABILITY},
    "tomorrow_weather": "{TOMORROW_WEATHER}",
    "week_trend": "{WEEK_TREND}"
  },
  "conversations": [
    {
      "speaker": "MC",
      "text": "発言内容",
      "emotion": "cheerful/neutral/concerned/encouraging",
      "info_type": "current_weather/temperature/advice/forecast"
    },
    {
      "speaker": "Assistant",
      "text": "発言内容",
      "emotion": "impressed/concerned/happy/thoughtful",
      "info_type": "reaction/question/advice/forecast"
    }
  ],
  "recommendations": [
    "おすすめアクション1",
    "おすすめアクション2",
    "おすすめアクション3"
  ]
}

【注意事項】
- 天気情報は正確に伝えてください
- 極端な天気（台風、豪雨等）の場合は、安全に関する注意を強調
- 気温の表現は具体的に（「〇℃なので、コートが必要です」等）
- ネガティブな表現を避け、ポジティブに言い換える
  例: ×「雨で嫌ですね」 → ○「雨の日もいいものですよ」
- 各発言は1〜3文程度の自然な長さにしてください
- リスナーが実際に行動を起こせる具体的なアドバイスを含める
```

---

## 使用例

### リクエスト例1: 晴れの日
```
【天気情報】
- 現在の天気: 晴れ
- 現在の気温: 18℃
- 今日の予想最高気温: 22℃
- 今日の予想最低気温: 14℃
- 降水確率: 10%
- 明日の天気: 曇り
- 一週間の天気傾向: 週末にかけて雨の予報
```

### 期待される出力例1
```json
{
  "scenario": "weather_forecast",
  "title": "天気予報",
  "weather_data": {
    "current_weather": "晴れ",
    "current_temp": 18,
    "max_temp": 22,
    "min_temp": 14,
    "rain_probability": 10,
    "tomorrow_weather": "曇り",
    "week_trend": "週末にかけて雨の予報"
  },
  "conversations": [
    {
      "speaker": "MC",
      "text": "それでは、今日の天気予報をお伝えします。現在の天気は晴れ、気温は18度です。",
      "emotion": "cheerful",
      "info_type": "current_weather"
    },
    {
      "speaker": "Assistant",
      "text": "おお、気持ちいい天気ですね！",
      "emotion": "happy",
      "info_type": "reaction"
    },
    {
      "speaker": "MC",
      "text": "そうなんです。今日の最高気温は22度まで上がる予想です。過ごしやすい一日になりそうですよ。",
      "emotion": "cheerful",
      "info_type": "temperature"
    },
    {
      "speaker": "Assistant",
      "text": "22度ですか。ちょうどいい感じですね。どんな服装がいいでしょうか？",
      "emotion": "thoughtful",
      "info_type": "question"
    },
    {
      "speaker": "MC",
      "text": "薄手のカーディガンやジャケットがあると調整しやすいですね。朝晩はまだ14度まで下がりますから。",
      "emotion": "neutral",
      "info_type": "advice"
    },
    {
      "speaker": "Assistant",
      "text": "なるほど。洗濯物もよく乾きそうですね。",
      "emotion": "impressed",
      "info_type": "reaction"
    },
    {
      "speaker": "MC",
      "text": "その通り！今日は絶好の洗濯日和です。降水確率も10%と低いので、安心して外干しできますよ。",
      "emotion": "encouraging",
      "info_type": "advice"
    },
    {
      "speaker": "Assistant",
      "text": "明日以降はどうなんですか？",
      "emotion": "curious",
      "info_type": "question"
    },
    {
      "speaker": "MC",
      "text": "明日は曇りの予報です。そして週末にかけては雨が降る見込みですね。",
      "emotion": "neutral",
      "info_type": "forecast"
    },
    {
      "speaker": "Assistant",
      "text": "じゃあ、今日のうちにお出かけしたり、やりたいことをやっておくのがいいですね。",
      "emotion": "thoughtful",
      "info_type": "advice"
    }
  ],
  "recommendations": [
    "薄手のカーディガンやジャケットで体温調整",
    "洗濯や外出に最適な日",
    "週末の雨に備えて今日中にやることを済ませる"
  ]
}
```

### リクエスト例2: 雨の日
```
【天気情報】
- 現在の天気: 雨
- 現在の気温: 15℃
- 今日の予想最高気温: 17℃
- 今日の予想最低気温: 13℃
- 降水確率: 80%
- 明日の天気: 晴れ
- 一週間の天気傾向: 週の後半は晴れが続く
```

---

## カスタマイズオプション

### 警報・注意報への対応
```
【追加条件】
- 気象警報・注意報: {警報内容}
- 安全に関する注意喚起を優先的に伝えてください
```

### 特別なイベント日の対応
```
【追加条件】
- 特別なイベント: {イベント名（運動会、花火大会等）}
- そのイベントに関連した天気情報を含めてください
```

### 地域特性の考慮
```
【追加条件】
- 対象地域: {地域名}
- その地域特有の天気の特徴を考慮してください
```

---

## 実装上の注意

1. **天気APIとの連携**
   - OpenWeatherMap、気象庁API等から天気データを取得
   - リアルタイムのデータを反映

2. **recommendations の活用**
   - UI上で箇条書き表示
   - プッシュ通知の内容として使用

3. **info_type の活用**
   - 情報の種類を明確化
   - UI上で情報を整理して表示

4. **極端な天気への対応**
   - 台風、豪雨、豪雪等の場合は、安全第一のメッセージ
   - 外出を控える呼びかけを含める

---

## 変数の説明

- `{CURRENT_WEATHER}`: 現在の天気（晴れ/曇り/雨/雪等）
- `{CURRENT_TEMP}`: 現在の気温（数値）
- `{MAX_TEMP}`: 今日の最高気温（数値）
- `{MIN_TEMP}`: 今日の最低気温（数値）
- `{RAIN_PROBABILITY}`: 降水確率（0-100）
- `{TOMORROW_WEATHER}`: 明日の天気
- `{WEEK_TREND}`: 一週間の傾向（簡潔な文章）

---

## 天気APIサンプルコード

```csharp
public async Task<WeatherData> GetWeatherDataAsync(string city)
{
    // 天気APIから情報を取得
    var response = await weatherApiClient.GetAsync($"/weather?q={city}");
    var data = await response.Content.ReadFromJsonAsync<WeatherData>();
    
    return new WeatherData
    {
        CurrentWeather = data.Weather[0].Main,
        CurrentTemp = (int)data.Main.Temp,
        MaxTemp = (int)data.Main.TempMax,
        MinTemp = (int)data.Main.TempMin,
        RainProbability = data.Clouds.All,
        // ... 他のデータ
    };
}
```
