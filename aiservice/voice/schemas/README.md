# StyleBertVits2 API Schemas

このディレクトリには、StyleBertVits2 API の JSON Schema に対応する C# クラスが含まれています。

## スキーマ一覧

### リクエストスキーマ

#### VoiceRequest
音声合成APIのリクエストパラメータ

**エンドポイント**: `GET/POST /voice`

**主要プロパティ**:
- `Text` (string, 必須): セリフ (1-100文字)
- `ModelId` (int, デフォルト: 0): モデルID
- `SpeakerId` (int, デフォルト: 0): 話者ID
- `SdpRatio` (float, デフォルト: 0.2): SDP/DP混合比
- `Noise` (float, デフォルト: 0.6): サンプルノイズの割合
- `Noisew` (float, デフォルト: 0.8): SDPノイズ
- `Length` (float, デフォルト: 1.0): 話速
- `Language` (string, デフォルト: "JP"): 言語 (JP, EN, ZH)
- `Style` (string, デフォルト: "Neutral"): スタイル

#### G2PRequest
G2P (Grapheme to Phoneme) APIのリクエストパラメータ

**エンドポイント**: `POST /g2p`

**プロパティ**:
- `Text` (string, 必須): テキスト

#### GetAudioRequest
音声ファイル取得APIのリクエストパラメータ

**エンドポイント**: `GET /tools/get_audio`

**プロパティ**:
- `Path` (string, 必須): ローカルWAVファイルパス

### レスポンススキーマ

#### StatusResponse
ステータスAPIのレスポンス

**エンドポイント**: `GET /status`

**プロパティ**:
- `Devices` (List<string>): 利用可能なデバイスリスト
- `CpuPercent` (float): CPU使用率 (%)
- `MemoryTotal` (long): メモリ総容量 (バイト)
- `MemoryAvailable` (long): メモリ使用可能容量 (バイト)
- `MemoryUsed` (long): メモリ使用量 (バイト)
- `MemoryPercent` (float): メモリ使用率 (%)
- `Gpu` (List<GpuInfo>): GPU情報リスト

**実際のレスポンス例**:
```json
{
  "devices": ["cpu", "cuda:0"],
  "cpu_percent": 9.7,
  "memory_total": 34121367552,
  "memory_available": 5537951744,
  "memory_used": 28583415808,
  "memory_percent": 83.8,
  "gpu": [
    {
      "gpu_id": 0,
      "gpu_load": 0.22,
      "gpu_memory": {
        "total": 12288,
        "used": 5808,
        "free": 6306
      }
    }
  ]
}
```

#### GpuInfo
GPU情報

**プロパティ**:
- `GpuId` (int): GPU ID
- `GpuLoad` (float): GPU負荷 (0.0-1.0)
- `GpuMemory` (GpuMemory): GPUメモリ情報

#### GpuMemory
GPUメモリ情報

**プロパティ**:
- `Total` (float): 総メモリ容量 (MB)
- `Used` (float): 使用中のメモリ (MB)
- `Free` (float): 空きメモリ (MB)

#### RefreshResponse
モデルリフレッシュAPIのレスポンス

**エンドポイント**: `POST /models/refresh`

**プロパティ**:
- `Status` (string): ステータスメッセージ
- `Message` (string): 詳細メッセージ

#### ModelInfo
モデル情報 (各モデルの詳細)

**エンドポイント**: `GET /models/info`

**プロパティ**:
- `ConfigPath` (string): config.jsonのパス
- `ModelPath` (string): モデルファイルのパス (.safetensors)
- `Device` (string): デバイス (cpu/cuda)
- `Spk2Id` (Dictionary<string, int>): 話者名→ID のマッピング
- `Id2Spk` (Dictionary<string, string>): ID→話者名 のマッピング
- `Style2Id` (Dictionary<string, int>): スタイル名→ID のマッピング

**実際のレスポンス例**:
```json
{
  "0": {
    "config_path": "model_assets\\amitaro\\config.json",
    "model_path": "model_assets\\amitaro\\amitaro.safetensors",
    "device": "cuda",
    "spk2id": { "あみたろ": 0 },
    "id2spk": { "0": "あみたろ" },
    "style2id": {
      "Neutral": 0,
      "01": 1,
      "02": 2,
      "03": 3,
      "04": 4
    }
  },
  "1": {
    "config_path": "model_assets\\jvnv-F1-jp\\config.json",
    "model_path": "model_assets\\jvnv-F1-jp\\jvnv-F1-jp_e160_s14000.safetensors",
    "device": "cuda",
    "spk2id": { "jvnv-F1-jp": 0 },
    "id2spk": { "0": "jvnv-F1-jp" },
    "style2id": {
      "Neutral": 0,
      "Angry": 1,
      "Happy": 4,
      "Sad": 5
    }
  }
}
```

#### StyleBertVits2Info
モデル情報のコレクション (Dictionary<string, ModelInfo>)

**エンドポイント**: `GET /models/info`

キーはモデルID（"0", "1", "2"...）、値は ModelInfo オブジェクト

### エラースキーマ

#### HttpValidationError
HTTPバリデーションエラー

**プロパティ**:
- `Detail` (List<ValidationError>): エラー詳細リスト

#### ValidationError
個別のバリデーションエラー

**プロパティ**:
- `Loc` (List<object>): エラー位置
- `Msg` (string): エラーメッセージ
- `Type` (string): エラータイプ

### 列挙型

#### Languages
サポートされている言語

**値**:
- `JP`: 日本語
- `EN`: 英語
- `ZH`: 中国語

## 使用例

### 音声合成リクエストの作成

```csharp
var request = new VoiceRequest
{
    Text = "こんにちは",
    ModelId = 0,
    SpeakerId = 0,
    Style = "Neutral",
    SdpRatio = 0.2f,
    Noise = 0.6f,
    Noisew = 0.8f,
    Length = 1.0f,
    Language = "JP"
};
```

### レスポンスの解析

```csharp
// ステータスレスポンスの解析
var status = await service.GetStatusTypedAsync();
if (status != null)
{
    Console.WriteLine($"デバイス: {string.Join(", ", status.Devices)}");
    Console.WriteLine($"CPU使用率: {status.CpuPercent}%");
    Console.WriteLine($"メモリ使用率: {status.MemoryPercent}%");
    
    foreach (var gpu in status.Gpu)
    {
        Console.WriteLine($"GPU {gpu.GpuId}:");
        Console.WriteLine($"  負荷: {gpu.GpuLoad * 100}%");
        Console.WriteLine($"  メモリ: {gpu.GpuMemory.Used}MB / {gpu.GpuMemory.Total}MB");
    }
}

// モデル情報の解析
var modelsInfo = await service.GetModelsInfoTypedAsync();
if (modelsInfo != null)
{
    foreach (var kvp in modelsInfo)
    {
        var modelId = kvp.Key;
        var modelInfo = kvp.Value;
        
        Console.WriteLine($"Model {modelId}:");
        Console.WriteLine($"  Device: {modelInfo.Device}");
        Console.WriteLine($"  Speakers: {string.Join(", ", modelInfo.Spk2Id.Keys)}");
        Console.WriteLine($"  Styles: {string.Join(", ", modelInfo.Style2Id.Keys)}");
    }
}

// リフレッシュの実行
var refreshResponse = await service.RefreshTypedAsync();
if (refreshResponse != null)
{
    Console.WriteLine($"Status: {refreshResponse.Status}");
}
```

## 注意事項

- `VoiceRequest.Text` は1-100文字の制限があります
- `ModelName` と `SpeakerName` は対応するIDより優先されます
- すべての数値パラメータにはデフォルト値が設定されています
- すべてのAPIリクエストには `Accept: application/json` ヘッダーが自動的に追加されます
- `/models/refresh` は POST リクエストです
- `/models/info` はモデル情報を取得します（エンドポイント: `/models/info`）
- 統合テストで実際のAPIの動作を確認できます

## 参考

- OpenAPI仕様: `aiservice/voice/StyleBertVits2_json_schema.json`
- 実装: `aiservice/voice/StyleBertVits2Service.cs`
- テスト: `../DesktopAiMascotTest/aiservice/voice/StyleBertVits2ServiceTests.cs`
