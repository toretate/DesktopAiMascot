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
    public class GoogleCloudChatService : ChatAiServiceBase
    {
        private const string DEFAULT_MODEL = "gemini-2.0-flash-exp";
        private const string DEFAULT_REGION = "us-central1";
        private readonly Google.GenAI.Client? _client;
        
        public override string EndPoint { get; set; }

        public GoogleCloudChatService()
        {
            var apiKey = LoadApiKey();
            var projectId = LoadProjectId();
            var region = LoadRegion() ?? DEFAULT_REGION;
            
            if (!string.IsNullOrWhiteSpace(apiKey) && !string.IsNullOrWhiteSpace(projectId))
            {
                _client = new Google.GenAI.Client(
                    apiKey: apiKey,
                    project: projectId,
                    location: region,
                    vertexAI: true
                );
            }
            
            EndPoint = $"https://{region}-aiplatform.googleapis.com/v1/";
        }

        public override async Task<ModelDisplayItem[]> GetAvailableModels(bool reload)
        {
            if (_client == null)
            {
                Debug.WriteLine("Google Cloud Client is not initialized. API key or Project ID may be missing. Returning default model.");
                return new[] { new ModelDisplayItem(DEFAULT_MODEL) };
            }

            // Vertex AI では動的なモデル一覧取得が制限されているため、固定リストを返す
            return new[]
            {
                new ModelDisplayItem("gemini-2.0-flash-exp"),
                new ModelDisplayItem("gemini-1.5-flash"),
                new ModelDisplayItem("gemini-1.5-pro"),
                new ModelDisplayItem("gemini-pro")
            };
        }

        public override async Task<string?> SendMessageAsync(string message)
        {
            if (_client == null)
            {
                return "Error: Google Cloud configuration is incomplete. Please set API key and Project ID in settings.";
            }

            try
            {
                var systemPrompt = LoadSystemPrompt() ?? "You are a helpful assistant.";
                var modelName = SystemConfig.Instance.ModelName ?? DEFAULT_MODEL;

                Debug.WriteLine($"GoogleCloud request with model: {modelName}");

                // システムプロンプトとメッセージを結合
                var fullMessage = $"{systemPrompt}\n\n{message}";
                
                // チャット履歴がある場合は考慮する必要があるが、
                // シンプルな実装として現在のメッセージのみを送信
                var response = await _client.Models.GenerateContentAsync(modelName, fullMessage);
                
                if (response?.Candidates != null && response.Candidates.Count > 0)
                {
                    var candidate = response.Candidates[0];
                    if (candidate?.Content?.Parts != null && candidate.Content.Parts.Count > 0)
                    {
                        return candidate.Content.Parts[0].Text;
                    }
                }
                
                return "Error: No response content from Google Cloud";
            }
            catch (HttpRequestException)
            {
                Debug.WriteLine("Google Cloudとの接続エラー");
                return "Error: Google Cloudとの接続に失敗しました";
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("Google Cloudとの接続エラー (タイムアウト)");
                return "Error: Google Cloudとの接続がタイムアウトしました";
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Google Cloudとの接続エラー: {ex.Message}");
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
                // Google Cloud専用のAPIキーを優先
                if (SystemConfig.Instance.ApiKeys.TryGetValue("GoogleCloudApiKey", out var apiKey))
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

        private static string? LoadProjectId()
        {
            try
            {
                if (SystemConfig.Instance.ApiKeys.TryGetValue("GoogleProjectId", out var projectId))
                {
                    return string.IsNullOrWhiteSpace(projectId) ? null : projectId;
                }

                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to load Project ID: {ex.Message}");
                return null;
            }
        }

        private static string? LoadRegion()
        {
            try
            {
                if (SystemConfig.Instance.ApiKeys.TryGetValue("GoogleRegion", out var region))
                {
                    return string.IsNullOrWhiteSpace(region) ? null : region;
                }

                return DEFAULT_REGION;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to load Region: {ex.Message}");
                return DEFAULT_REGION;
            }
        }
    }
}
