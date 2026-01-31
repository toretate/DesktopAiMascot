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
