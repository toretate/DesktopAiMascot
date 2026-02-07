using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Collections.Generic;
using DesktopAiMascot.Controls;

using OpenAI;
using OpenAI.Chat;
using System.ClientModel;
using DesktopAiMascot.mascots;

namespace DesktopAiMascot.aiservice.chat
{

    public class LmStudioChatService : ChatAiServiceBase
    {
        // Local LmStudio endpoint
        private const string LOCAL_ENDPOINT = "http://127.0.0.1:1234/v1/";
        private readonly string _endpoint;

        public override string EndPoint { get; set; }



        public string? SystemPrompt { get; set; }

        public LmStudioChatService(string endpoint = LOCAL_ENDPOINT)
        {
            this.EndPoint = endpoint;
        }

        public override async Task<string?> SendMessageAsync(string message)
        {
            return await SendMessageAsync(message, SystemConfig.Instance.ModelName);
        }

        public override async Task<string?> SendMessageAsync(string message, string? modelName)
        {
            string llmModel = string.IsNullOrWhiteSpace(modelName) ? SystemConfig.Instance.ModelName : modelName;
            string endpoint = EndPoint;
            string apiKey = "NOT_NEEDED_API_KEY";

            var client = new OpenAIClient(new ApiKeyCredential(apiKey), new OpenAIClientOptions()
            {
                Endpoint = new Uri(endpoint),
            });

            var chatClient = client.GetChatClient(llmModel);

            // チャットメッセージの構築
            var systemPrompt = SystemPrompt ?? LoadSystemPrompt() ?? "You are a helpful assistant.";
            var messages = new List<OpenAI.Chat.ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
            };

            var chatHistory = ChatHistory.GetMessages();
            foreach (var m in chatHistory)
            {
                if (string.Equals(m.Sender, "Assistant", StringComparison.OrdinalIgnoreCase))
                {
                    messages.Add(new AssistantChatMessage(m.Text));
                }
                else
                {
                    messages.Add(new UserChatMessage(m.Text));
                }
            }

            // 送信ログ出力
            Debug.WriteLine("=== LmStudio 送信開始 ===");
            Debug.WriteLine($"モデル: {llmModel}");
            Debug.WriteLine($"エンドポイント: {endpoint}");
            Debug.WriteLine($"システムプロンプト: {systemPrompt}");
            Debug.WriteLine($"ユーザーメッセージ: {message}");
            Debug.WriteLine($"チャット履歴数: {chatHistory.Count()}");

            // レスポンスを取得する
            try
            {
                var response = await chatClient.CompleteChatAsync(messages);
                var text = response.Value.Content[0].Text;
                Debug.WriteLine($"レスポンス: {text}");
                Debug.WriteLine("=== LmStudio 送信完了 ===");
                return text;
            }
            catch (HttpRequestException)
            {
                Debug.WriteLine("LmStudioとの接続エラー");
                Debug.WriteLine("=== LmStudio 送信失敗 ===");
                return "Error: LmStudioとの接続に失敗しました";
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("LmStudioとの接続エラー (タイムアウト)");
                Debug.WriteLine("=== LmStudio 送信失敗 ===");
                return "Error: LmStudioとの接続がタイムアウトしました";
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"LmStudioとの接続エラー: {ex.Message}");
                Debug.WriteLine("=== LmStudio 送信失敗 ===");
                return $"Error: {ex.Message}";
            }
         }

        public override void ClearConversation()
        {

        }

        private static string? LoadSystemPrompt()
        {
            var model = MascotManager.Instance.CurrentModel;
            
            Debug.WriteLine($"[LoadSystemPrompt] CurrentModel: {model?.Name ?? "null"}");
            Debug.WriteLine($"[LoadSystemPrompt] CurrentModel is null: {model == null}");
            
            if (model == null)
            {
                Debug.WriteLine($"[LoadSystemPrompt] ERROR: CurrentModel がnullです");
                return null;
            }
            
            var promptText = model.Prompt;
            
            Debug.WriteLine($"[LoadSystemPrompt] Prompt is null: {promptText == null}");
            Debug.WriteLine($"[LoadSystemPrompt] Prompt length: {promptText?.Length ?? 0}");
            
            if (promptText != null && promptText.Length > 200)
            {
                Debug.WriteLine($"[LoadSystemPrompt] Prompt (最初の200文字): {promptText.Substring(0, 200)}...");
            }
            else if (promptText != null)
            {
                Debug.WriteLine($"[LoadSystemPrompt] Prompt: {promptText}");
            }
            
            return promptText;
        }
     }
 }
