using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace DesktopAiMascot.aiservice.voice
{
    /// <summary>
    /// Style Bert Vits 2 の /info エンドポイントのレスポンス
    /// キーはモデルID（"0", "1", "2"...）
    /// </summary>
    internal class StyleBertVits2Info : Dictionary<string, ModelInfo>
    {
    }

    internal class ModelInfo
    {
        [JsonPropertyName("config_path")]
        public string ConfigPath { get; set; } = string.Empty;

        [JsonPropertyName("model_path")]
        public string ModelPath { get; set; } = string.Empty;

        [JsonPropertyName("device")]
        public string Device { get; set; } = string.Empty;

        [JsonPropertyName("spk2id")]
        public Dictionary<string, int> Spk2Id { get; set; } = new Dictionary<string, int>();

        [JsonPropertyName("id2spk")]
        public Dictionary<string, string> Id2Spk { get; set; } = new Dictionary<string, string>();

        [JsonPropertyName("style2id")]
        public Dictionary<string, int> Style2Id { get; set; } = new Dictionary<string, int>();
    }
}
