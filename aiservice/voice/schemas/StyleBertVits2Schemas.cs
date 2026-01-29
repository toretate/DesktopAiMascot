using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace DesktopAiMascot.aiservice.voice.schemas
{
    #region Request Schemas

    /// <summary>
    /// /voice API のリクエストパラメータ
    /// </summary>
    public class VoiceRequest
    {
        /// <summary>
        /// セリフ (必須, 1-100文字)
        /// </summary>
        [JsonPropertyName("text")]
        public string Text { get; set; } = string.Empty;

        /// <summary>
        /// textをURLデコードする (ex, utf-8)
        /// </summary>
        [JsonPropertyName("encoding")]
        public string? Encoding { get; set; }

        /// <summary>
        /// モデル名 (model_idより優先)。model_assets内のディレクトリ名を指定
        /// </summary>
        [JsonPropertyName("model_name")]
        public string? ModelName { get; set; }

        /// <summary>
        /// モデルID。GET /models/info のkeyの値を指定
        /// </summary>
        [JsonPropertyName("model_id")]
        public int ModelId { get; set; } = 0;

        /// <summary>
        /// 話者名 (speaker_idより優先)。esd.listの2列目の文字列を指定
        /// </summary>
        [JsonPropertyName("speaker_name")]
        public string? SpeakerName { get; set; }

        /// <summary>
        /// 話者ID。model_assets>[model]>config.json内のspk2idを確認
        /// </summary>
        [JsonPropertyName("speaker_id")]
        public int SpeakerId { get; set; } = 0;

        /// <summary>
        /// SDP(Stochastic Duration Predictor)/DP混合比。比率が高くなるほどトーンのばらつきが大きくなる
        /// </summary>
        [JsonPropertyName("sdp_ratio")]
        public float SdpRatio { get; set; } = 0.2f;

        /// <summary>
        /// サンプルノイズの割合。大きくするほどランダム性が高まる
        /// </summary>
        [JsonPropertyName("noise")]
        public float Noise { get; set; } = 0.6f;

        /// <summary>
        /// SDPノイズ。大きくするほど発音の間隔にばらつきが出やすくなる
        /// </summary>
        [JsonPropertyName("noisew")]
        public float Noisew { get; set; } = 0.8f;

        /// <summary>
        /// 話速。基準は1で大きくするほど音声は長くなり読み上げが遅まる
        /// </summary>
        [JsonPropertyName("length")]
        public float Length { get; set; } = 1.0f;

        /// <summary>
        /// textの言語
        /// </summary>
        [JsonPropertyName("language")]
        public string Language { get; set; } = "JP";

        /// <summary>
        /// 改行で分けて生成
        /// </summary>
        [JsonPropertyName("auto_split")]
        public bool AutoSplit { get; set; } = true;

        /// <summary>
        /// 分けた場合に挟む無音の長さ（秒）
        /// </summary>
        [JsonPropertyName("split_interval")]
        public float SplitInterval { get; set; } = 0.5f;

        /// <summary>
        /// このテキストの読み上げと似た声音・感情になりやすくなる。ただし抑揚やテンポ等が犠牲になる傾向がある
        /// </summary>
        [JsonPropertyName("assist_text")]
        public string? AssistText { get; set; }

        /// <summary>
        /// assist_textの強さ
        /// </summary>
        [JsonPropertyName("assist_text_weight")]
        public float AssistTextWeight { get; set; } = 1.0f;

        /// <summary>
        /// スタイル
        /// </summary>
        [JsonPropertyName("style")]
        public string? Style { get; set; } = "Neutral";

        /// <summary>
        /// スタイルの強さ
        /// </summary>
        [JsonPropertyName("style_weight")]
        public float StyleWeight { get; set; } = 1.0f;

        /// <summary>
        /// スタイルを音声ファイルで行う
        /// </summary>
        [JsonPropertyName("reference_audio_path")]
        public string? ReferenceAudioPath { get; set; }
    }

    /// <summary>
    /// /g2p API のリクエストパラメータ
    /// </summary>
    public class G2PRequest
    {
        /// <summary>
        /// テキスト
        /// </summary>
        [JsonPropertyName("text")]
        public string Text { get; set; } = string.Empty;
    }

    /// <summary>
    /// /tools/get_audio API のリクエストパラメータ
    /// </summary>
    public class GetAudioRequest
    {
        /// <summary>
        /// ローカルWAVファイルパス
        /// </summary>
        [JsonPropertyName("path")]
        public string Path { get; set; } = string.Empty;
    }

    #endregion

    #region Response Schemas

    /// <summary>
    /// /models/info API のレスポンス
    /// キーはモデルID（"0", "1", "2"...）、値はモデル情報
    /// </summary>
    public class StyleBertVits2Info : Dictionary<string, ModelInfo>
    {
    }

    /// <summary>
    /// モデル情報
    /// </summary>
    public class ModelInfo
    {
        /// <summary>
        /// config.jsonのパス
        /// </summary>
        [JsonPropertyName("config_path")]
        public string ConfigPath { get; set; } = string.Empty;

        /// <summary>
        /// モデルファイルのパス (.safetensors)
        /// </summary>
        [JsonPropertyName("model_path")]
        public string ModelPath { get; set; } = string.Empty;

        /// <summary>
        /// デバイス (cpu/cuda)
        /// </summary>
        [JsonPropertyName("device")]
        public string Device { get; set; } = string.Empty;

        /// <summary>
        /// 話者名→ID のマッピング
        /// 例: { "あみたろ": 0, "小春音アミ": 0 }
        /// </summary>
        [JsonPropertyName("spk2id")]
        public Dictionary<string, int> Spk2Id { get; set; } = new Dictionary<string, int>();

        /// <summary>
        /// ID→話者名 のマッピング
        /// 例: { "0": "あみたろ" }
        /// </summary>
        [JsonPropertyName("id2spk")]
        public Dictionary<string, string> Id2Spk { get; set; } = new Dictionary<string, string>();

        /// <summary>
        /// スタイル名→ID のマッピング
        /// 例: { "Neutral": 0, "Happy": 4, "Sad": 5 }
        /// </summary>
        [JsonPropertyName("style2id")]
        public Dictionary<string, int> Style2Id { get; set; } = new Dictionary<string, int>();
    }

    /// <summary>
    /// /status API のレスポンス
    /// </summary>
    public class StatusResponse
    {
        /// <summary>
        /// 利用可能なデバイスリスト (例: ["cpu", "cuda:0"])
        /// </summary>
        [JsonPropertyName("devices")]
        public List<string> Devices { get; set; } = new List<string>();

        /// <summary>
        /// CPU使用率 (%)
        /// </summary>
        [JsonPropertyName("cpu_percent")]
        public float CpuPercent { get; set; }

        /// <summary>
        /// メモリ総容量 (バイト)
        /// </summary>
        [JsonPropertyName("memory_total")]
        public long MemoryTotal { get; set; }

        /// <summary>
        /// メモリ使用可能容量 (バイト)
        /// </summary>
        [JsonPropertyName("memory_available")]
        public long MemoryAvailable { get; set; }

        /// <summary>
        /// メモリ使用量 (バイト)
        /// </summary>
        [JsonPropertyName("memory_used")]
        public long MemoryUsed { get; set; }

        /// <summary>
        /// メモリ使用率 (%)
        /// </summary>
        [JsonPropertyName("memory_percent")]
        public float MemoryPercent { get; set; }

        /// <summary>
        /// GPU情報リスト
        /// </summary>
        [JsonPropertyName("gpu")]
        public List<GpuInfo> Gpu { get; set; } = new List<GpuInfo>();
    }

    /// <summary>
    /// GPU情報
    /// </summary>
    public class GpuInfo
    {
        /// <summary>
        /// GPU ID
        /// </summary>
        [JsonPropertyName("gpu_id")]
        public int GpuId { get; set; }

        /// <summary>
        /// GPU負荷 (0.0-1.0)
        /// </summary>
        [JsonPropertyName("gpu_load")]
        public float GpuLoad { get; set; }

        /// <summary>
        /// GPUメモリ情報
        /// </summary>
        [JsonPropertyName("gpu_memory")]
        public GpuMemory GpuMemory { get; set; } = new GpuMemory();
    }

    /// <summary>
    /// GPUメモリ情報
    /// </summary>
    public class GpuMemory
    {
        /// <summary>
        /// 総メモリ容量 (MB)
        /// </summary>
        [JsonPropertyName("total")]
        public float Total { get; set; }

        /// <summary>
        /// 使用中のメモリ (MB)
        /// </summary>
        [JsonPropertyName("used")]
        public float Used { get; set; }

        /// <summary>
        /// 空きメモリ (MB)
        /// </summary>
        [JsonPropertyName("free")]
        public float Free { get; set; }
    }

    /// <summary>
    /// /models/refresh API のレスポンス
    /// </summary>
    public class RefreshResponse
    {
        /// <summary>
        /// ステータスメッセージ
        /// </summary>
        [JsonPropertyName("status")]
        public string Status { get; set; } = string.Empty;

        /// <summary>
        /// 詳細メッセージ
        /// </summary>
        [JsonPropertyName("message")]
        public string? Message { get; set; }
    }

    #endregion

    #region Enums

    /// <summary>
    /// 言語の列挙型
    /// </summary>
    public enum Languages
    {
        /// <summary>
        /// 日本語
        /// </summary>
        JP,

        /// <summary>
        /// 英語
        /// </summary>
        EN,

        /// <summary>
        /// 中国語
        /// </summary>
        ZH
    }

    #endregion

    #region Error Schemas

    /// <summary>
    /// HTTPバリデーションエラー
    /// </summary>
    public class HttpValidationError
    {
        /// <summary>
        /// エラー詳細
        /// </summary>
        [JsonPropertyName("detail")]
        public List<ValidationError>? Detail { get; set; }
    }

    /// <summary>
    /// バリデーションエラー
    /// </summary>
    public class ValidationError
    {
        /// <summary>
        /// エラー位置
        /// </summary>
        [JsonPropertyName("loc")]
        public List<object> Loc { get; set; } = new List<object>();

        /// <summary>
        /// エラーメッセージ
        /// </summary>
        [JsonPropertyName("msg")]
        public string Msg { get; set; } = string.Empty;

        /// <summary>
        /// エラータイプ
        /// </summary>
        [JsonPropertyName("type")]
        public string Type { get; set; } = string.Empty;
    }

    #endregion
}
