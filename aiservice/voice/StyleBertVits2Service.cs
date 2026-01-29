using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Threading.Tasks;
using System.Text.Json.Serialization;
using DesktopAiMascot.aiservice.voice.schemas;

namespace DesktopAiMascot.aiservice.voice
{
    /**
     * StyleBertVits2 の音声合成サービスと接続するためのクラス
     */
    internal class StyleBertVits2Service : AiVoiceServiceBase
    {
        const string SERVICE_URL = "http://127.0.0.1:5000";
        private HttpClient _httpClient;
        private StyleBertVits2Info? _cachedModelsInfo;
        private Dictionary<string, string> _modelNameToId = new Dictionary<string, string>();
        private Dictionary<string, string> _speakerNameToId = new Dictionary<string, string>();

        public override string Name => "StyleBertVits2";
        public override string EndPoint => _httpClient.BaseAddress?.ToString() ?? SERVICE_URL;

        private string _url = string.Empty;
        public new string Url
        {
            get => _url;
            set
            {
                _url = value;
                if (!string.IsNullOrEmpty(value))
                {
                    try
                    {
                        _httpClient.BaseAddress = new Uri(value);
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"Failed to set base address: {ex.Message}");
                    }
                }
            }
        }

        public StyleBertVits2Service(string? baseUrl = null)
        {
            _httpClient = new HttpClient();
            _httpClient.DefaultRequestHeaders.Accept.Clear();
            _httpClient.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));
            
            if (string.IsNullOrEmpty(baseUrl))
            {
                baseUrl = SERVICE_URL;
            }
            _httpClient.BaseAddress = new Uri(baseUrl);
            _url = baseUrl;
        }

        public override async Task<byte[]> SynthesizeAsync(string text)
        {
            int modelId = 6;
            int speakerId = 0;
            
            if (!string.IsNullOrEmpty(Model))
            {
                modelId = ParseModelId(Model);
            }
            if (!string.IsNullOrEmpty(Speaker))
            {
                speakerId = ParseSpeakerId(Speaker);
            }
            
            Debug.WriteLine($"[TTS] 音声合成開始 - モデル: {Model} (ID: {modelId}), スピーカー: {Speaker} (ID: {speakerId})");
            
            return await SynthesizeAsync(text, modelId, speakerId);
        }

        public override async IAsyncEnumerable<byte[]> SynthesizeStreamAsync(string text)
        {
            int modelId = 6;
            int speakerId = 0;
            
            if (!string.IsNullOrEmpty(Model))
            {
                modelId = ParseModelId(Model);
            }
            if (!string.IsNullOrEmpty(Speaker))
            {
                speakerId = ParseSpeakerId(Speaker);
            }
            
            Debug.WriteLine($"[TTS] ストリーミング音声合成開始 - モデル: {Model} (ID: {modelId}), スピーカー: {Speaker} (ID: {speakerId})");
            
            await foreach (var chunk in SynthesizeStreamAsync(text, modelId, speakerId))
            {
                yield return chunk;
            }
        }

        public override async Task<string[]> GetAvailableModels()
        {
            try
            {
                var info = await GetServerInfoAsync();
                if (info != null && info.Count > 0)
                {
                    _cachedModelsInfo = info;
                    _modelNameToId.Clear();
                    var models = new List<string>();
                    
                    foreach (var kvp in info)
                    {
                        var modelId = kvp.Key;
                        var modelInfo = kvp.Value;
                        
                        // model_pathからmodel_assets直下のディレクトリ名を抽出
                        string modelName = ExtractModelName(modelInfo.ModelPath);
                        
                        // マッピングを保存
                        _modelNameToId[modelName] = modelId;
                        
                        // モデル名のみを追加
                        models.Add(modelName);
                    }
                    
                    return models.ToArray();
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to get models: {ex.Message}");
            }
            return Array.Empty<string>();
        }

        public override async Task<string[]> GetAvailableSpeakers()
        {
            try
            {
                // 現在選択されているモデルのIDを取得
                int currentModelId = 0;
                if (!string.IsNullOrEmpty(Model))
                {
                    currentModelId = ParseModelId(Model);
                }
                
                // キャッシュがない場合は取得
                if (_cachedModelsInfo == null)
                {
                    _cachedModelsInfo = await GetServerInfoAsync();
                }
                
                if (_cachedModelsInfo != null && _cachedModelsInfo.ContainsKey(currentModelId.ToString()))
                {
                    var modelInfo = _cachedModelsInfo[currentModelId.ToString()];
                    _speakerNameToId.Clear();
                    var speakers = new List<string>();
                    
                    // id2spkのkeyを使用してスピーカーリストを作成
                    foreach (var kvp in modelInfo.Id2Spk.OrderBy(k => int.Parse(k.Key)))
                    {
                        var speakerId = kvp.Key;
                        var speakerName = kvp.Value;
                        
                        // マッピングを保存
                        _speakerNameToId[speakerName] = speakerId;
                        
                        // スピーカー名のみを追加
                        speakers.Add(speakerName);
                    }
                    
                    return speakers.ToArray();
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to get speakers: {ex.Message}");
            }
            return Array.Empty<string>();
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
        /// モデル情報の取得を行います。 (/models/info)
        /// </summary>
        /// <returns>モデル情報</returns>
        public async Task<StyleBertVits2Info?> GetModelInfoAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync("/models/info");
                if (response.IsSuccessStatusCode)
                {
                    var info = await response.Content.ReadFromJsonAsync<StyleBertVits2Info>();
                    return info;
                }
                else
                {
                    Debug.WriteLine($"[TTS] /models/info request failed: {response.StatusCode}");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[TTS] /models/info error: {ex.Message}");
            }
            return null;
        }

        /// <summary>
        /// モデルの再読み込みを行います。 (/models/refresh)
        /// </summary>
        /// <returns>JSON形式のレスポンス</returns>
        public async Task<string> ModelRefreshAsync()
        {
            try
            {
                var response = await _httpClient.PostAsync("/models/refresh", null);
                response.EnsureSuccessStatusCode();
                return await response.Content.ReadAsStringAsync();
            }
            catch (Exception ex)
            {
                throw new Exception($"Refresh Failed: {ex.Message}", ex);
            }
        }


        private int ParseModelId(string modelStr)
        {
            if (string.IsNullOrEmpty(modelStr)) return 0;
            
            // マッピングから検索
            if (_modelNameToId.TryGetValue(modelStr, out string? modelId))
            {
                if (int.TryParse(modelId, out int id))
                    return id;
            }
            
            // 後方互換性のため、"0: モデル名" の形式にも対応
            var parts = modelStr.Split(':');
            if (parts.Length > 0 && int.TryParse(parts[0].Trim(), out int parsedId))
                return parsedId;
            
            // 直接数値の場合
            if (int.TryParse(modelStr, out int directId))
                return directId;
            
            return 0;
        }

        private int ParseSpeakerId(string speakerStr)
        {
            if (string.IsNullOrEmpty(speakerStr)) return 0;
            
            // マッピングから検索
            if (_speakerNameToId.TryGetValue(speakerStr, out string? speakerId))
            {
                if (int.TryParse(speakerId, out int id))
                    return id;
            }
            
            // 後方互換性のため、"0: スピーカー名" の形式にも対応
            var parts = speakerStr.Split(':');
            if (parts.Length > 0 && int.TryParse(parts[0].Trim(), out int parsedId))
                return parsedId;
            
            // 直接数値の場合
            if (int.TryParse(speakerStr, out int directId))
                return directId;
            
            return 0;
        }

        /// <summary>
        /// model_pathからmodel_assets直下のディレクトリ名を抽出します。
        /// 例: "model_assets/jvnv-F1-jp/jvnv-F1-jp_e160_s14000.safetensors" → "jvnv-F1-jp"
        /// </summary>
        private string ExtractModelName(string modelPath)
        {
            if (string.IsNullOrEmpty(modelPath))
                return "Unknown";
            
            try
            {
                // パスの区切り文字を統一（Windows/Linuxの両方に対応）
                var normalizedPath = modelPath.Replace('\\', '/');
                
                // model_assetsの位置を探す
                var modelAssetsIndex = normalizedPath.IndexOf("model_assets/", StringComparison.OrdinalIgnoreCase);
                if (modelAssetsIndex >= 0)
                {
                    // model_assets/ の後ろからディレクトリ名を取得
                    var afterModelAssets = normalizedPath.Substring(modelAssetsIndex + "model_assets/".Length);
                    var firstSlashIndex = afterModelAssets.IndexOf('/');
                    
                    if (firstSlashIndex > 0)
                    {
                        return afterModelAssets.Substring(0, firstSlashIndex);
                    }
                    else
                    {
                        // スラッシュがない場合はそのまま返す
                        return afterModelAssets;
                    }
                }
                
                // model_assetsが見つからない場合は、最後のディレクトリ名を返す
                var parts = normalizedPath.Split('/');
                if (parts.Length >= 2)
                {
                    // ファイル名の前のディレクトリ名を返す
                    return parts[parts.Length - 2];
                }
                
                return Path.GetFileNameWithoutExtension(modelPath);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to extract model name from path: {modelPath}, Error: {ex.Message}");
                return "Unknown";
            }
        }

        private async Task<StyleBertVits2Info?> GetServerInfoAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync("/models/info");
                if (response.IsSuccessStatusCode)
                {
                    var options = new System.Text.Json.JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    };
                    
                    var info = await response.Content.ReadFromJsonAsync<StyleBertVits2Info>(options);
                    return info;
                }
                else
                {
                    Debug.WriteLine($"[TTS] /models/info request failed: {response.StatusCode}");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[TTS] /models/info error: {ex.Message}");
                Debug.WriteLine($"[TTS] Exception: {ex}");
            }
            return null;
        }

        /// <summary>
        /// VoiceRequestスキーマを使用して音声合成を行います。
        /// </summary>
        /// <param name="request">音声合成リクエスト</param>
        /// <returns>WAVデータのバイト配列</returns>
        public async Task<byte[]> SynthesizeAsync(VoiceRequest request)
        {
            return await SynthesizeAsync(
                text: request.Text,
                modelId: request.ModelId,
                speakerId: request.SpeakerId,
                style: request.Style ?? "Neutral",
                sdpRatio: request.SdpRatio,
                noise: request.Noise,
                noiseW: request.Noisew,
                length: request.Length,
                language: request.Language,
                encoding: request.Encoding ?? "utf-8"
            );
        }

        /// <summary>
        /// VoiceRequestスキーマを使用してストリーミング音声合成を行います。
        /// </summary>
        /// <param name="request">音声合成リクエスト</param>
        /// <returns>WAVデータのチャンク</returns>
        public async IAsyncEnumerable<byte[]> SynthesizeStreamAsync(VoiceRequest request)
        {
            await foreach (var chunk in SynthesizeStreamAsync(
                text: request.Text,
                modelId: request.ModelId,
                speakerId: request.SpeakerId,
                style: request.Style ?? "Neutral",
                sdpRatio: request.SdpRatio,
                noise: request.Noise,
                noiseW: request.Noisew,
                length: request.Length,
                language: request.Language,
                encoding: request.Encoding ?? "utf-8"
            ))
            {
                yield return chunk;
            }
        }

        /// <summary>
        /// サーバーのステータスを取得します（型付きレスポンス）。
        /// </summary>
        /// <returns>ステータス情報</returns>
        public async Task<StatusResponse?> GetStatusTypedAsync()
        {
            try
            {
                Debug.WriteLine("[TTS] Requesting /status...");
                var response = await _httpClient.GetAsync("/status");
                Debug.WriteLine($"[TTS] Status code: {response.StatusCode}");
                
                response.EnsureSuccessStatusCode();
                
                var content = await response.Content.ReadAsStringAsync();
                Debug.WriteLine($"[TTS] Response content: {content}");
                
                var options = new System.Text.Json.JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };
                
                var result = await response.Content.ReadFromJsonAsync<StatusResponse>(options);
                Debug.WriteLine($"[TTS] Deserialized result is null: {result == null}");
                
                return result;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"GetStatus Failed: {ex.Message}");
                Debug.WriteLine($"Exception: {ex}");
                return null;
            }
        }

        /// <summary>
        /// モデルの再読み込みを行います（型付きレスポンス）。
        /// </summary>
        /// <returns>リフレッシュ結果</returns>
        public async Task<RefreshResponse?> RefreshTypedAsync()
        {
            try
            {
                var response = await _httpClient.PostAsync("/models/refresh", null);
                response.EnsureSuccessStatusCode();
                
                var options = new System.Text.Json.JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };
                
                return await response.Content.ReadFromJsonAsync<RefreshResponse>(options);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Refresh Failed: {ex.Message}");
                Debug.WriteLine($"Exception: {ex}");
                return null;
            }
        }

        /// <summary>
        /// ロードされたモデル情報を取得します（型付きレスポンス）。
        /// </summary>
        /// <returns>モデル情報</returns>
        public async Task<StyleBertVits2Info?> GetModelsInfoTypedAsync()
        {
            return await GetServerInfoAsync();
        }
    }
}
