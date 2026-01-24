using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Threading.Tasks;

namespace DesktopAiMascot.aiservice.voice
{
    /**
     * StyleBertVits2 の音声合成サービスと接続するためのクラス
     */
    internal class StyleBertVits2Service : AiVoiceServiceBase
    {
        const string SERVICE_URL = "http://127.0.0.1:5000";
        private readonly HttpClient _httpClient;

        public override string Name => "StyleBertVits2";
        public override string EndPoint => _httpClient.BaseAddress?.ToString() ?? SERVICE_URL;

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
        /// 音声合成を行い、wavデータを返します。(POST版)
        /// テキストが100文字を超える場合は自動的に分割して処理します。
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
        /// <param name="encoding">エンコーディング (日本語対応のため utf-8 を推奨)</param>
        /// <returns>WAVデータのバイト配列（複数の場合は結合されたデータ）</returns>
        public async Task<byte[]> SynthesizeAsync(
            string text,
            int modelId = 6,
            int speakerId = 0,
            string style = "Neutral",
            float sdpRatio = 0.2f,
            float noise = 0.6f,
            float noiseW = 0.8f,
            float length = 1.0f,
            string language = "JP",
            string encoding = "utf-8")
        {
            string filteredText = FilterEmotionAndActionText(text);
            Debug.WriteLine($"[TTS] フィルタ前: {text}");
            Debug.WriteLine($"[TTS] フィルタ後: {filteredText}");

            if (string.IsNullOrWhiteSpace(filteredText))
            {
                Debug.WriteLine("[TTS] フィルタ後のテキストが空のため、処理をスキップします。");
                return Array.Empty<byte>();
            }

            if (filteredText.Length <= MAX_TEXT_LENGTH)
            {
                return await SynthesizeSingleAsync(filteredText, modelId, speakerId, style, sdpRatio, noise, noiseW, length, language, encoding);
            }

            Debug.WriteLine($"[TTS] テキストが{filteredText.Length}文字のため、分割して処理します。");
            var chunks = SplitText(filteredText, MAX_TEXT_LENGTH);
            Debug.WriteLine($"[TTS] {chunks.Count}個のチャンクに分割しました。");
            
            // チャンク毎のテキストをログ出力
            for (int i = 0; i < chunks.Count; i++)
            {
                Debug.WriteLine($"[TTS] チャンク[{i + 1}/{chunks.Count}]: \"{chunks[i]}\"");
            }

            var audioChunks = new List<byte[]>();
            for (int i = 0; i < chunks.Count; i++)
            {
                Debug.WriteLine($"[TTS] チャンク {i + 1}/{chunks.Count} の音声合成を開始...");
                var audioData = await SynthesizeSingleAsync(chunks[i], modelId, speakerId, style, sdpRatio, noise, noiseW, length, language, encoding);
                audioChunks.Add(audioData);
                Debug.WriteLine($"[TTS] チャンク {i + 1}/{chunks.Count} の音声合成が完了しました。サイズ: {audioData.Length} bytes");
            }

            return CombineWavFiles(audioChunks);
        }

        /// <summary>
        /// 音声合成を行い、チャンク毎にwavデータをストリーミングで返します。
        /// テキストが100文字を超える場合は自動的に分割して、各チャンクを順次返します。
        /// </summary>
        public async IAsyncEnumerable<byte[]> SynthesizeStreamAsync(
            string text,
            int modelId = 6,
            int speakerId = 0,
            string style = "Neutral",
            float sdpRatio = 0.2f,
            float noise = 0.6f,
            float noiseW = 0.8f,
            float length = 1.0f,
            string language = "JP",
            string encoding = "utf-8")
        {
            string filteredText = FilterEmotionAndActionText(text);
            Debug.WriteLine($"[TTS] フィルタ前: {text}");
            Debug.WriteLine($"[TTS] フィルタ後: {filteredText}");

            if (string.IsNullOrWhiteSpace(filteredText))
            {
                Debug.WriteLine("[TTS] フィルタ後のテキストが空のため、処理をスキップします。");
                yield break;
            }

            if (filteredText.Length <= MAX_TEXT_LENGTH)
            {
                var audioData = await SynthesizeSingleAsync(filteredText, modelId, speakerId, style, sdpRatio, noise, noiseW, length, language, encoding);
                yield return audioData;
                yield break;
            }

            Debug.WriteLine($"[TTS] テキストが{filteredText.Length}文字のため、分割して処理します。");
            var chunks = SplitText(filteredText, MAX_TEXT_LENGTH);
            Debug.WriteLine($"[TTS] {chunks.Count}個のチャンクに分割しました。");
            
            // チャンク毎のテキストをログ出力
            for (int i = 0; i < chunks.Count; i++)
            {
                Debug.WriteLine($"[TTS] チャンク[{i + 1}/{chunks.Count}]: \"{chunks[i]}\"");
            }

            for (int i = 0; i < chunks.Count; i++)
            {
                Debug.WriteLine($"[TTS] チャンク {i + 1}/{chunks.Count} の音声合成を開始...");
                var audioData = await SynthesizeSingleAsync(chunks[i], modelId, speakerId, style, sdpRatio, noise, noiseW, length, language, encoding);
                Debug.WriteLine($"[TTS] チャンク {i + 1}/{chunks.Count} の音声合成が完了しました。サイズ: {audioData.Length} bytes");
                yield return audioData;
            }
        }

        /// <summary>
        /// 単一のテキストチャンクを音声合成します。
        /// </summary>
        private async Task<byte[]> SynthesizeSingleAsync(
            string text,
            int modelId,
            int speakerId,
            string style,
            float sdpRatio,
            float noise,
            float noiseW,
            float length,
            string language,
            string encoding)
        {
            try
            {
                // OpenAPI定義に従い、クエリパラメータとして送信
                // float値はInvariantCultureを使用して小数点を.に統一
                var queryParams = new List<string>
                {
                    $"text={Uri.EscapeDataString(text)}",
                    $"model_id={modelId}",
                    $"speaker_id={speakerId}",
                    $"style={Uri.EscapeDataString(style)}",
                    $"sdp_ratio={sdpRatio.ToString(CultureInfo.InvariantCulture)}",
                    $"noise={noise.ToString(CultureInfo.InvariantCulture)}",
                    $"noisew={noiseW.ToString(CultureInfo.InvariantCulture)}", // OpenAPI定義では "noisew" (noise_wではない)
                    $"length={length.ToString(CultureInfo.InvariantCulture)}",
                    $"language={Uri.EscapeDataString(language)}",
                    $"encoding={Uri.EscapeDataString(encoding)}" // 日本語対応のため追加
                };

                string queryString = string.Join("&", queryParams);
                string requestUri = $"voice?{queryString}";

                Debug.WriteLine($"[TTS] リクエストURI: {_httpClient.BaseAddress}{requestUri}");

                var response = await _httpClient.PostAsync(requestUri, null);
                
                if (!response.IsSuccessStatusCode)
                {
                    // エラーレスポンスの詳細を取得
                    string errorBody = await response.Content.ReadAsStringAsync();
                    throw new HttpRequestException(
                        $"HTTP {(int)response.StatusCode} {response.StatusCode}: {errorBody}");
                }
                
                return await response.Content.ReadAsByteArrayAsync();
            }
            catch (HttpRequestException ex)
            {
                throw new Exception($"TTS Service Request Failed: {ex.Message}", ex);
            }
            catch (Exception ex)
            {
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
