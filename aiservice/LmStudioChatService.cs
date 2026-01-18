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

namespace DesktopAiMascot.aiservice
{

    public class LmStudioChatService : IAiChatService
    {
        // Local LmStudio endpoint
        private const string LOCAL_ENDPOINT = "http://127.0.0.1:1234/v1/";
        private readonly string Endpoint;


        public string? SystemPrompt { get; set; }

        public LmStudioChatService(string endpoint = LOCAL_ENDPOINT)
        {
            this.Endpoint = endpoint;
        }

        public async Task<string?> SendMessageAsync(string message)
        {
            string llmModel = "qwen3-8b-nsfw-jp";
            string endpoint = Endpoint;
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
            } catch (Exception ex)
            {
                return $"Error: {ex.Message}";
            }
         }

        public void ClearConversation()
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
