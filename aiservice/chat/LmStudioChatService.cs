using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Collections.Generic;
using DesktopAiMascot.ui.chat;

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

        private string _endPoint = LOCAL_ENDPOINT;
        public override string EndPoint
        {
            get => _endPoint;
            set
            {
                if (string.IsNullOrWhiteSpace(value))
                {
                    _endPoint = LOCAL_ENDPOINT;
                }
                else
                {
                    _endPoint = value.EndsWith("/") ? value : value + "/";
                }
            }
        }

        public string? SystemPrompt { get; set; }

        public LmStudioChatService(string? endpoint = null)
        {
            this.EndPoint = endpoint ?? string.Empty;
        }

        public override async Task<string?> SendMessageAsync(string message)
        {
            return await SendMessageAsync(message, SystemConfig.Instance.ModelName);
        }

        private static readonly HttpClient httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };

        public override async Task<string?> SendMessageAsync(string message, string? modelName)
        {
            string llmModel = string.IsNullOrWhiteSpace(modelName) ? SystemConfig.Instance.ModelName : modelName;
            
            // エンドポイントの構築 (例: http://192.168.10.103:1234/v1/chat/completions)
            string endpoint = EndPoint.EndsWith("/") ? EndPoint + "chat/completions" : EndPoint + "/chat/completions";

            // チャットメッセージの構築
            var systemPrompt = EmotionTagPromptHelper.AppendEmotionTagInstruction(SystemPrompt ?? LoadSystemPrompt() ?? "You are a helpful assistant.");
            
            var messages = new List<object>
            {
                new { role = "system", content = systemPrompt }
            };

            var chatHistory = ChatHistory.GetMessages();
            foreach (var m in chatHistory)
            {
                if (string.Equals(m.Sender, "Assistant", StringComparison.OrdinalIgnoreCase))
                {
                    messages.Add(new { role = "assistant", content = m.Text });
                }
                else
                {
                    messages.Add(new { role = "user", content = m.Text });
                }
            }

            // 現在のユーザーメッセージが履歴の末尾にない場合は明示的に追加する
            if (chatHistory.Count == 0 || !string.Equals(chatHistory[chatHistory.Count - 1].Text, message, StringComparison.Ordinal))
            {
                messages.Add(new { role = "user", content = message });
            }

            // 送信ログ出力
            Debug.WriteLine("=== LmStudio 送信開始 ===");
            Debug.WriteLine($"モデル: {llmModel}");
            Debug.WriteLine($"エンドポイント: {endpoint}");
            Debug.WriteLine($"ユーザーメッセージ: {message}");

            var requestObj = new
            {
                model = llmModel,
                messages = messages
            };

            var json = JsonSerializer.Serialize(requestObj);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");

            try
            {
                var resp = await httpClient.PostAsync(endpoint, content).ConfigureAwait(false);
                var responseText = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);

                if (!resp.IsSuccessStatusCode)
                {
                    Debug.WriteLine($"LmStudio HTTPエラー: {resp.StatusCode}");
                    Debug.WriteLine($"レスポンス本文: {responseText}");
                    Debug.WriteLine("=== LmStudio 送信失敗 ===");
                    return $"Error: サーバーがエラーを返しました ({resp.StatusCode})";
                }

                try
                {
                    using var doc = JsonDocument.Parse(responseText);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
                    {
                        var first = choices[0];
                        if (first.TryGetProperty("message", out var msg) && msg.TryGetProperty("content", out var textContent))
                        {
                            var text = textContent.GetString();
                            Debug.WriteLine($"レスポンス: {text}");
                            Debug.WriteLine("=== LmStudio 送信完了 ===");
                            return text;
                        }
                    }
                }
                catch { }

                Debug.WriteLine("レスポンスのパースに失敗しました");
                return "Error: レスポンスのパースに失敗しました";
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

        /// <summary>
        /// サーバーが起動しているか確認する
        /// </summary>
        public async Task<bool> IsServerAvailableAsync()
        {
            try
            {
                using (var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(5) })
                {
                    // モデル一覧を取得して、サーバーの応答性を確認
                    var response = await httpClient.GetAsync($"{EndPoint}models");
                    return response.IsSuccessStatusCode;
                }
            }
            catch (HttpRequestException)
            {
                Debug.WriteLine("[LmStudioChatService] Server not available: HttpRequestException");
                return false;
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("[LmStudioChatService] Server not available: TaskCanceledException (timeout)");
                return false;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[LmStudioChatService] Server check failed: {ex.Message}");
                return false;
            }
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
