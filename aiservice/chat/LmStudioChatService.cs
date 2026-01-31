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
            string llmModel = SystemConfig.Instance.ModelName;
            string endpoint = EndPoint;
            string apiKey = "NOT_NEEDED_API_KEY";

            var client = new OpenAIClient(new ApiKeyCredential(apiKey), new OpenAIClientOptions()
            {
                Endpoint = new Uri(endpoint),
            });

            var chatClient = client.GetChatClient(llmModel);

            // チャットメッセージの構築
            var messages = new List<OpenAI.Chat.ChatMessage>
            {
                new SystemChatMessage(SystemPrompt ?? LoadSystemPrompt() ?? "You are a helpful assistant."),
            };

            var chatHistory = ChatHistory.GetMessages();
            foreach(var m in chatHistory)
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

            // レスポンスを取得する
            try
            {
                var response = await chatClient.CompleteChatAsync(messages);
                var text = response.Value.Content[0].Text;
                return text;
            }
            catch (HttpRequestException)
            {
                Debug.WriteLine("LmStudioとの接続エラー");
                return "Error: LmStudioとの接続に失敗しました";
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("LmStudioとの接続エラー (タイムアウト)");
                return "Error: LmStudioとの接続がタイムアウトしました";
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"LmStudioとの接続エラー: {ex.Message}");
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
     }
 }
