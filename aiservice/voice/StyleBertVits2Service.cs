using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

namespace DesktopAiMascot.aiservice.voice
{
    /**
     * StyleBertVits2 の音声合成サービスと接続するためのクラス
     */
    internal class StyleBertVits2Service
    {
        const string SERVICE_URL = "http://127.0.0.1:5000";
        private readonly HttpClient _httpClient;

        public StyleBertVits2Service(string? baseUrl = null)
        {
            _httpClient = new HttpClient();
            if (string.IsNullOrEmpty(baseUrl))
            {
                baseUrl = SERVICE_URL;
            }
            _httpClient.BaseAddress = new Uri(baseUrl);
        }

        /// <summary>
        /// 音声合成を行い、wavデータを返します。
        /// </summary>
        /// <param name="text">読み上げるテキスト</param>
        /// <param name="modelId">モデルID</param>
        /// <param name="speakerId">話者ID</param>
        /// <param name="style">スタイル (Neutral, Angry, etc.)</param>
        /// <param name="sdpRatio">SDP比率</param>
        /// <param name="noise">ノイズ</param>
        /// <param name="noiseW">ノイズW</param>
        /// <param name="length">話速</param>
        /// <param name="language">言語 (JP)</param>
        /// <returns>WAVデータのバイト配列</returns>
        public async Task<byte[]> SynthesizeAsync(
            string text,
            int modelId = 0,
            int speakerId = 0,
            string style = "Neutral",
            float sdpRatio = 0.2f,
            float noise = 0.6f,
            float noiseW = 0.8f,
            float length = 1.0f,
            string language = "JP")
        {
            var parameters = new Dictionary<string, string>
            {
                { "text", text },
                { "model_id", modelId.ToString() },
                { "speaker_id", speakerId.ToString() },
                { "style", style },
                { "sdp_ratio", sdpRatio.ToString() },
                { "noise", noise.ToString() },
                { "noise_w", noiseW.ToString() },
                { "length", length.ToString() },
                { "language", language }
            };

            var queryString = string.Join("&", parameters.Select(p => $"{p.Key}={Uri.EscapeDataString(p.Value)}"));
            var requestUrl = $"/voice?{queryString}";

            try
            {
                var response = await _httpClient.GetAsync(requestUrl);
                response.EnsureSuccessStatusCode();
                return await response.Content.ReadAsByteArrayAsync();
            }
            catch (Exception ex)
            {
                // エラーログ出力などはここで行うか、呼び出し元に任せる
                // 今回はthrow
                throw new Exception($"TTS Service Request Failed: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// サーバーの情報を取得します。 (/info)
        /// </summary>
        /// <returns>JSON形式のサーバー情報</returns>
        public async Task<string> GetInfoAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync("/info");
                response.EnsureSuccessStatusCode();
                return await response.Content.ReadAsStringAsync();
            }
            catch (Exception ex)
            {
                throw new Exception($"GetInfo Failed: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// モデルの再読み込みを行います。 (/refresh)
        /// </summary>
        /// <returns>JSON形式のレスポンス</returns>
        public async Task<string> RefreshAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync("/refresh");
                response.EnsureSuccessStatusCode();
                return await response.Content.ReadAsStringAsync();
            }
            catch (Exception ex)
            {
                throw new Exception($"Refresh Failed: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// サーバーの状態を取得します。 (/status)
        /// </summary>
        /// <returns>JSON形式のステータス情報</returns>
        public async Task<string> GetStatusAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync("/status");
                response.EnsureSuccessStatusCode();
                return await response.Content.ReadAsStringAsync();
            }
            catch (Exception ex)
            {
                throw new Exception($"GetStatus Failed: {ex.Message}", ex);
            }
        }
    }
}
