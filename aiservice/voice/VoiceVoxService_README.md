# VoiceVox Service Documentation

## 概要

VoiceVoxServiceは、VoiceVox音声合成エンジンとの連携を提供するサービスクラスです。
VoiceVoxの OpenAPI 仕様に基づいて実装されています。

## VoiceVoxについて

- **公式サイト**: https://voicevox.hiroshiba.jp/
- **OpenAPI仕様**: http://127.0.0.1:50021/openapi.json
- **デフォルトエンドポイント**: http://localhost:50021

## 実装されているAPI

### 1. `/speakers` - 話者一覧の取得
```csharp
var speakers = await voiceVoxService.GetSpeakersAsync();
```
喋れるキャラクターの情報の一覧を取得します。

### 2. `/initialize_speaker` - 話者の初期化
```csharp
await voiceVoxService.InitializeSpeakerAsync(speakerId, skipReinit: true);
```
指定されたスタイルを初期化します。実行しなくても音声合成は可能ですが、初回実行時に時間がかかることがあります。

### 3. `/is_initialized_speaker` - 初期化状態の確認
```csharp
bool isInitialized = await voiceVoxService.IsInitializedSpeakerAsync(speakerId);
```
指定されたスタイルが初期化されているかどうかを確認します。

### 4. `/audio_query` - 音声合成用クエリの作成
```csharp
var audioQuery = await voiceVoxService.CreateAudioQueryAsync("こんにちは", speakerId);
```
音声合成用のクエリを作成します。このクエリはそのまま音声合成に利用できます。

### 5. `/synthesis` - 音声合成
```csharp
byte[] audioData = await voiceVoxService.SynthesisAsync(audioQuery, speakerId);
```
音声合成を実行し、WAVファイルのバイナリデータを返します。

### 6. `/speaker_info` - 話者詳細情報の取得
```csharp
var speakerInfo = await voiceVoxService.GetSpeakerInfoAsync(speakerUuid);
```
UUIDで指定された話者の詳細情報を取得します。

### 7. `/core_versions` - コアバージョン一覧の取得
```csharp
string[] versions = await voiceVoxService.GetCoreVersionsAsync();
```
利用可能なコアのバージョン一覧を取得します。

## 音声合成の基本的な流れ

VoiceVoxでは、2段階のプロセスで音声合成を行います：

```csharp
// 1. AudioQueryを作成
var audioQuery = await voiceVoxService.CreateAudioQueryAsync(text, speakerId);

// 2. AudioQueryを使用して音声合成
var audioData = await voiceVoxService.SynthesisAsync(audioQuery, speakerId);
```

## AiVoiceServiceBase実装

VoiceVoxServiceは `AiVoiceServiceBase` を継承しており、統一インターフェースを提供します：

```csharp
// 利用可能な話者の取得
string[] speakers = await voiceVoxService.GetAvailableSpeakers();

// 音声合成（シンプルインターフェース）
voiceVoxService.Speaker = "四国めたん (ノーマル) [2]";
byte[] audio = await voiceVoxService.SynthesizeAsync("こんにちは");
```

## 話者IDの形式

話者の選択は以下の形式で行います：
```
"キャラクター名 (スタイル名) [ID]"
```

例：
- `"四国めたん (ノーマル) [2]"`
- `"四国めたん (あまあま) [0]"`
- `"四国めたん (ツンツン) [6]"`
- `"四国めたん (セクシー) [4]"`

## スキーマクラス

### VoiceVoxSpeaker
話者情報を表すクラス
```csharp
public class VoiceVoxSpeaker
{
    public string Name { get; set; }
    public string Speaker_Uuid { get; set; }
    public VoiceVoxSpeakerStyle[] Styles { get; set; }
    public string Version { get; set; }
}
```

### VoiceVoxAudioQuery
音声合成用クエリを表すクラス
```csharp
public class VoiceVoxAudioQuery
{
    public VoiceVoxAccentPhrase[] Accent_Phrases { get; set; }
    public float SpeedScale { get; set; }
    public float PitchScale { get; set; }
    public float IntonationScale { get; set; }
    public float VolumeScale { get; set; }
    // ... その他のパラメータ
}
```

### その他のスキーマ
- `VoiceVoxSpeakerStyle` - スタイル情報
- `VoiceVoxAccentPhrase` - アクセント句
- `VoiceVoxMora` - モーラ（子音＋母音）
- `VoiceVoxSpeakerInfo` - 話者の詳細情報
- `VoiceVoxStyleInfo` - スタイルの追加情報

## 注意事項

1. **モデルの概念がない**
   - VoiceVoxにはStyleBertVits2のような「モデル」の概念がありません
   - `GetAvailableModels()` は空の配列を返します

2. **ストリーミング非対応**
   - VoiceVoxは現時点でストリーミング合成をサポートしていません
   - `SynthesizeStreamAsync()` は通常の合成結果を1つのチャンクとして返します

3. **並行処理の制御**
   - `SemaphoreSlim` を使用して音声合成の並行実行を制御しています
   - 同時に複数の合成リクエストが送信されないようになっています

4. **初期化**
   - 話者を初めて使用する際、自動的に初期化が行われます
   - 初期化には少し時間がかかる場合があります

## 使用例

### 基本的な使い方

```csharp
// VoiceVoxServiceのインスタンス作成
var voiceVox = new VoiceVoxService();

// URLを設定（デフォルトは http://localhost:50021）
voiceVox.Url = "http://localhost:50021";

// 利用可能な話者を取得
var speakers = await voiceVox.GetAvailableSpeakers();
foreach (var speaker in speakers)
{
    Console.WriteLine(speaker);
}

// 話者を設定
voiceVox.Speaker = "四国めたん (ノーマル) [2]";

// 音声合成
byte[] audioData = await voiceVox.SynthesizeAsync("こんにちは、世界！");

// 音声を再生またはファイルに保存
File.WriteAllBytes("output.wav", audioData);
```

### 高度な使い方（AudioQueryのカスタマイズ）

```csharp
// AudioQueryを作成
var audioQuery = await voiceVox.CreateAudioQueryAsync("こんにちは", 2);

// パラメータをカスタマイズ
audioQuery.SpeedScale = 1.2f;  // 話速を1.2倍に
audioQuery.PitchScale = 0.1f;  // 音高を少し上げる
audioQuery.VolumeScale = 1.5f; // 音量を1.5倍に

// カスタマイズしたクエリで音声合成
byte[] audioData = await voiceVox.SynthesisAsync(audioQuery, 2);
```

## トラブルシューティング

### VoiceVoxエンジンが起動していない
```
[VoiceVox] GetSpeakersAsync エラー: ....
```
- VoiceVoxエンジンが起動していることを確認してください
- デフォルトのポート（50021）が使用されていることを確認してください

### 話者IDの抽出に失敗
```
[VoiceVox] Speaker ID の抽出に失敗しました: ...
```
- Speaker文字列が正しい形式であることを確認してください
- 形式: `"キャラクター名 (スタイル名) [ID]"`

## テスト

VoiceVoxServiceのテストは `DesktopAiMascotTest` プロジェクトに含まれています。

```bash
cd DesktopAiMascotTest
dotnet test --filter "VoiceVoxService"
```

## 参考リンク

- [VoiceVox 公式サイト](https://voicevox.hiroshiba.jp/)
- [VoiceVox GitHub](https://github.com/VOICEVOX/voicevox)
- [VoiceVox Engine GitHub](https://github.com/VOICEVOX/voicevox_engine)
