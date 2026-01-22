using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json; // 追記: JsonContent用
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
            const int MAX_TEXT_LENGTH = 100; // OpenAPI定義のmaxLength

            // テキストが100文字以下の場合は通常通り処理
            if (text.Length <= MAX_TEXT_LENGTH)
            {
                return await SynthesizeSingleAsync(text, modelId, speakerId, style, sdpRatio, noise, noiseW, length, language, encoding);
            }

            // 100文字を超える場合は分割して処理
            Console.WriteLine($"[TTS] テキストが{text.Length}文字のため、分割して処理します。");
            var chunks = SplitText(text, MAX_TEXT_LENGTH);
            Console.WriteLine($"[TTS] {chunks.Count}個のチャンクに分割しました。");

            var audioChunks = new List<byte[]>();
            for (int i = 0; i < chunks.Count; i++)
            {
                Console.WriteLine($"[TTS] チャンク {i + 1}/{chunks.Count} を処理中...");
                var audioData = await SynthesizeSingleAsync(chunks[i], modelId, speakerId, style, sdpRatio, noise, noiseW, length, language, encoding);
                audioChunks.Add(audioData);
            }

            // 音声データを結合（簡易実装：WAVヘッダーを考慮せずに結合）
            // 注意: これは簡易実装です。完全な実装にはWAVファイルの結合ライブラリが必要です
            return CombineWavFiles(audioChunks);
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

                Console.WriteLine($"[TTS] リクエストURI: {_httpClient.BaseAddress}{requestUri}");

                // POST リクエストとして送信（クエリパラメータ付き）
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
        /// テキストを指定された最大長で適切に分割します。
        /// 句読点や改行で分割を試みます。
        /// </summary>
        private List<string> SplitText(string text, int maxLength)
        {
            var chunks = new List<string>();
            
            if (string.IsNullOrEmpty(text))
                return chunks;

            int start = 0;
            while (start < text.Length)
            {
                int remaining = text.Length - start;
                if (remaining <= maxLength)
                {
                    chunks.Add(text.Substring(start));
                    break;
                }

                // 最大長以内で、句読点や改行を探す
                int splitPos = start + maxLength;
                int bestSplit = splitPos;

                // 句読点、改行、スペースを優先的に探す
                for (int i = splitPos; i > start + maxLength / 2; i--)
                {
                    char c = text[i];
                    if (c == '\n' || c == '\r')
                    {
                        bestSplit = i + 1;
                        break;
                    }
                    if (c == '。' || c == '、' || c == '！' || c == '？' || c == '.' || c == ',' || c == '!' || c == '?')
                    {
                        bestSplit = i + 1;
                        break;
                    }
                    if (c == ' ' || c == '\t')
                    {
                        bestSplit = i + 1;
                    }
                }

                chunks.Add(text.Substring(start, bestSplit - start).Trim());
                start = bestSplit;
            }

            return chunks;
        }

        /// <summary>
        /// 複数のWAVファイルのデータを結合します。
        /// 簡易実装：WAVヘッダーを考慮せずにデータ部分のみを結合します。
        /// 注意: これは簡易実装です。完全な実装にはWAVファイルの結合ライブラリが必要です。
        /// </summary>
        private byte[] CombineWavFiles(List<byte[]> audioChunks)
        {
            if (audioChunks.Count == 0)
                return Array.Empty<byte>();

            if (audioChunks.Count == 1)
                return audioChunks[0];

            // 簡易実装: 最初のWAVファイルのヘッダーを使用し、残りのデータ部分を結合
            // 注意: これは完全な実装ではありません。サンプルレートやチャンネル数が同じであることを前提としています
            const int WAV_HEADER_SIZE = 44; // 標準的なWAVヘッダーサイズ

            int totalDataSize = 0;
            foreach (var chunk in audioChunks)
            {
                if (chunk.Length > WAV_HEADER_SIZE)
                {
                    totalDataSize += chunk.Length - WAV_HEADER_SIZE;
                }
            }

            // 最初のチャンクのヘッダーをコピー
            var result = new byte[WAV_HEADER_SIZE + totalDataSize];
            Array.Copy(audioChunks[0], 0, result, 0, Math.Min(WAV_HEADER_SIZE, audioChunks[0].Length));

            // データ部分を結合
            int offset = WAV_HEADER_SIZE;
            foreach (var chunk in audioChunks)
            {
                if (chunk.Length > WAV_HEADER_SIZE)
                {
                    int dataSize = chunk.Length - WAV_HEADER_SIZE;
                    Array.Copy(chunk, WAV_HEADER_SIZE, result, offset, dataSize);
                    offset += dataSize;
                }
            }

            // ファイルサイズを更新（リトルエンディアン）
            int fileSize = result.Length - 8;
            result[4] = (byte)(fileSize & 0xFF);
            result[5] = (byte)((fileSize >> 8) & 0xFF);
            result[6] = (byte)((fileSize >> 16) & 0xFF);
            result[7] = (byte)((fileSize >> 24) & 0xFF);

            // データサイズを更新（リトルエンディアン）
            int dataSizeTotal = totalDataSize;
            result[40] = (byte)(dataSizeTotal & 0xFF);
            result[41] = (byte)((dataSizeTotal >> 8) & 0xFF);
            result[42] = (byte)((dataSizeTotal >> 16) & 0xFF);
            result[43] = (byte)((dataSizeTotal >> 24) & 0xFF);

            return result;
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
