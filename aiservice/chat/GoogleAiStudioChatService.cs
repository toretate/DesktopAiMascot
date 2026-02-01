using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using System.Diagnostics;
using DesktopAiMascot.mascots;
using DesktopAiMascot.Controls;
using Google.GenAI;

namespace DesktopAiMascot.aiservice.chat
{
    public class GoogleAiStudioChatService : ChatAiServiceBase
    {
        private const string DEFAULT_MODEL = "gemini-2.0-flash-exp";
        private const string IMAGE_MODEL = "imagen-3.0-generate-001"; // Gemini 画像生成モデル
        private readonly Google.GenAI.Client? _client;
        
        public override string EndPoint { get; set; }

        public GoogleAiStudioChatService()
        {
            var apiKey = LoadApiKey();
            
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                _client = new Google.GenAI.Client(apiKey: apiKey);
            }
            
            EndPoint = "https://generativelanguage.googleapis.com/v1beta/";
        }

        public override async Task<ModelDisplayItem[]> GetAvailableModels(bool reload)
        {
            try
            {
                if (_client == null)
                {
                    Debug.WriteLine("[GoogleAiStudio] Client is not initialized. API key may be missing.");
                    return new[] { new ModelDisplayItem(DEFAULT_MODEL) };
                }

                Debug.WriteLine("[GoogleAiStudio] Fetching available models...");

                var models = new List<ModelDisplayItem>();
                
                var pager = await _client.Models.ListAsync();
                
                await foreach (var model in pager)
                {
                    if (model.SupportedActions != null && model.SupportedActions.Contains("generateContent"))
                    {
                        if (!string.IsNullOrEmpty(model.Name))
                        {
                            var cleanId = model.Name.StartsWith("models/") ? model.Name.Substring(7) : model.Name;
                            
                            // ModelDisplayItemを作成（IDと表示名を保持）
                            var displayItem = new ModelDisplayItem(cleanId, model.Thinking == true);
                            models.Add(displayItem);
                            
                            //Debug.WriteLine($"[GoogleAiStudio] Found model: {displayItem.DisplayName} (ID: {cleanId})");
                        }
                    }
                }

                if (models.Count == 0)
                {
                    Debug.WriteLine("[GoogleAiStudio] No models found, returning default model.");
                    return new[] { new ModelDisplayItem(DEFAULT_MODEL) };
                }

                Debug.WriteLine($"[GoogleAiStudio] Successfully retrieved {models.Count} models");
                return models.OrderBy(m => m.DisplayName).ToArray();
            }
            catch (HttpRequestException)
            {
                Debug.WriteLine("Google AI Studioとの接続エラー");
                return new[] { new ModelDisplayItem(DEFAULT_MODEL) };
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("Google AI Studioとの接続エラー (タイムアウト)");
                return new[] { new ModelDisplayItem(DEFAULT_MODEL) };
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Google AI Studioとの接続エラー: {ex.Message}");
                return new[] { new ModelDisplayItem(DEFAULT_MODEL) };
            }
        }

        public override async Task<string?> SendMessageAsync(string message)
        {
            try
            {
                if (_client == null)
                {
                    Debug.WriteLine("[GoogleAiStudio] Client is not initialized.");
                    return "Error: Google AI API key is not configured. Please set the API key in settings.";
                }

                var systemPrompt = LoadSystemPrompt() ?? "You are a helpful assistant.";
                var modelName = SystemConfig.Instance.ModelName ?? DEFAULT_MODEL;

                Debug.WriteLine($"[GoogleAiStudio] Model ID from config: {modelName}");
                Debug.WriteLine($"[GoogleAiStudio] Sending request to API with model: {modelName}");

                // システムプロンプトとメッセージを結合
                var fullMessage = $"{systemPrompt}\n\n{message}";
                
                var response = await _client.Models.GenerateContentAsync(modelName, fullMessage);
                
                if (response?.Candidates != null && response.Candidates.Count > 0)
                {
                    var candidate = response.Candidates[0];
                    if (candidate?.Content?.Parts != null && candidate.Content.Parts.Count > 0)
                    {
                        return candidate.Content.Parts[0].Text;
                    }
                }
                
                Debug.WriteLine("[GoogleAiStudio] No response content from API");
                return "Error: No response content from Google AI Studio";
            }
            catch (HttpRequestException)
            {
                Debug.WriteLine("Google AI Studioとの接続エラー");
                return "Error: Google AI Studioとの接続に失敗しました";
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("Google AI Studioとの接続エラー (タイムアウト)");
                return "Error: Google AI Studioとの接続がタイムアウトしました";
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Google AI Studioとの接続エラー: {ex.Message}");
                
                if (ex.Message.Contains("429") || ex.Message.Contains("Rate limit"))
                {
                    return "Error: Rate limit exceeded. Please wait a moment and try again.";
                }
                else if (ex.Message.Contains("400"))
                {
                    return $"Error: Invalid request. The model may not be available.";
                }
                else if (ex.Message.Contains("404"))
                {
                    return $"Error: Model not found.";
                }
                
                return $"Error: {ex.Message}";
            }
        }

        /// <summary>
        /// 画像とプロンプトを使用して画像を編集・生成する（NanoBanana対応）
        /// HTTP APIを直接使用して実装
        /// </summary>
        /// <param name="images">入力画像のBase64エンコード文字列配列</param>
        /// <param name="prompt">編集指示プロンプト</param>
        /// <returns>生成された画像のBase64文字列</returns>
        public override async Task<string?> SendMessageWithImagesAsync(string[] images, string prompt)
        {
            try
            {
                var apiKey = LoadApiKey();
                if (string.IsNullOrWhiteSpace(apiKey))
                {
                    Debug.WriteLine("[GoogleAiStudio] API key is not configured.");
                    return null;
                }

                Debug.WriteLine($"[GoogleAiStudio] 画像編集リクエスト開始 - 画像数: {images.Length}");
                Debug.WriteLine($"[GoogleAiStudio] プロンプト: {prompt}");

                // Gemini imagen-3.0-generate-001を使用
                var modelName = IMAGE_MODEL;
                var url = $"{EndPoint}models/{modelName}:generateContent?key={apiKey}";
                
                Debug.WriteLine($"[GoogleAiStudio] 使用モデル: {modelName}");

                // リクエストボディを構築
                var parts = new List<object>();
                
                // 画像を追加
                foreach (var imageBase64 in images)
                {
                    parts.Add(new
                    {
                        inline_data = new
                        {
                            mime_type = "image/png",
                            data = imageBase64
                        }
                    });
                }
                
                // プロンプトを追加
                parts.Add(new { text = prompt });
                
                var requestBody = new
                {
                    contents = new[]
                    {
                        new
                        {
                            parts = parts.ToArray()
                        }
                    }
                };

                var jsonRequest = System.Text.Json.JsonSerializer.Serialize(requestBody);
                Debug.WriteLine($"[GoogleAiStudio] Request size: {jsonRequest.Length} bytes");

                using var httpClient = new HttpClient { Timeout = TimeSpan.FromMinutes(2) };
                var content = new StringContent(jsonRequest, System.Text.Encoding.UTF8, "application/json");
                
                var response = await httpClient.PostAsync(url, content);
                var jsonResponse = await response.Content.ReadAsStringAsync();
                
                if (!response.IsSuccessStatusCode)
                {
                    Debug.WriteLine($"[GoogleAiStudio] API Error ({response.StatusCode}): {jsonResponse}");
                    return null;
                }

                Debug.WriteLine($"[GoogleAiStudio] Response received: {jsonResponse.Length} bytes");

                // レスポンスから画像データを抽出
                using var doc = System.Text.Json.JsonDocument.Parse(jsonResponse);
                var root = doc.RootElement;
                
                if (root.TryGetProperty("candidates", out var candidates) && candidates.GetArrayLength() > 0)
                {
                    var firstCandidate = candidates[0];
                    if (firstCandidate.TryGetProperty("content", out var contentObj))
                    {
                        if (contentObj.TryGetProperty("parts", out var partsArray) && partsArray.GetArrayLength() > 0)
                        {
                            foreach (var part in partsArray.EnumerateArray())
                            {
                                if (part.TryGetProperty("inline_data", out var inlineData))
                                {
                                    if (inlineData.TryGetProperty("data", out var data))
                                    {
                                        var imageBase64 = data.GetString();
                                        Debug.WriteLine("[GoogleAiStudio] 画像生成成功");
                                        return imageBase64;
                                    }
                                }
                            }
                        }
                    }
                }
                
                Debug.WriteLine("[GoogleAiStudio] 画像生成失敗: レスポンスに画像データがありません");
                return null;
            }
            catch (HttpRequestException)
            {
                Debug.WriteLine("Google AI Studioとの接続エラー");
                return null;
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("Google AI Studioとの接続エラー (タイムアウト)");
                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Google AI Studioとの接続エラー: {ex.Message}");
                return null;
            }
        }

        public override void ClearConversation()
        {
        }

        private static string? LoadSystemPrompt()
        {
            var model = MascotManager.Instance.CurrentModel;
            var promptText = model?.Prompt;
            return promptText;
        }

        private static string? LoadApiKey()
        {
            try
            {
                // 新しいキー名を優先
                if (SystemConfig.Instance.ApiKeys.TryGetValue("GoogleAiStudioApiKey", out var apiKey))
                {
                    return string.IsNullOrWhiteSpace(apiKey) ? null : apiKey;
                }
                
                // 後方互換性のため、古いキー名もチェック
                if (SystemConfig.Instance.ApiKeys.TryGetValue("GoogleApiKey", out var oldApiKey))
                {
                    return string.IsNullOrWhiteSpace(oldApiKey) ? null : oldApiKey;
                }

                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to load API key: {ex.Message}");
                return null;
            }
        }
    }
}

