using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Diagnostics;
using System.Diagnostics;

namespace DesktopAiMascot.aiservice
{
    public class FoundryLocalChatService : ChatAiServiceBase
    {
        private static readonly HttpClient httpClient = new HttpClient();
        public override string EndPoint { get; set; }
        private string _chatEndpoint;
        private string _modelName;

        public FoundryLocalChatService(string modelPath)
        {
            // The caller provides either a model identifier or a local endpoint URL.
            // Treat the string as the model id if it looks like a short name, otherwise treat it as an endpoint URL.
            var endpointOrModel = modelPath ?? string.Empty;

            if (endpointOrModel.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || endpointOrModel.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                EndPoint = endpointOrModel;
                _chatEndpoint = endpointOrModel;
                _modelName = endpointOrModel;
            }
            else
            {
                EndPoint = "http://127.0.0.1:49834/v1";
                _chatEndpoint = "http://127.0.0.1:49834/v1/chat/completions";
                _modelName = endpointOrModel;
            }
        }


        public override async Task<string?> SendMessageAsync(string message)
        {
            try
            {
                var systemPrompt = LoadSystemPrompt() ?? "You are a helpful assistant.";

                // Build a generic OpenAI-style chat request. Many Foundry Local deployments accept this shape.
                var requestObj = new
                {
                    model = _modelName,
                    messages = new[]
                    {
                        new { role = "system", content = systemPrompt },
                        new { role = "user", content = message }
                    }
                };

                var json = JsonSerializer.Serialize(requestObj);
                Debug.WriteLine("FoundryLocal request JSON:\n" + json);
                Debug.WriteLine("FoundryLocal request JSON:\n" + json);

                using var content = new StringContent(json, Encoding.UTF8, "application/json");

                // If the provided string looks like a URL, POST to it. Otherwise assume a local default endpoint.
                
                httpClient.Timeout = TimeSpan.FromSeconds(30);
                var resp = await httpClient.PostAsync(_chatEndpoint, content).ConfigureAwait(false);
                var txt = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);

                // try to extract text from JSON response (similar approach as LmStudioChatService)
                try
                {
                    using var doc = JsonDocument.Parse(txt);
                    var root = doc.RootElement;

                    if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("choices", out var choices) && choices.ValueKind == JsonValueKind.Array && choices.GetArrayLength() > 0)
                    {
                        var first = choices[0];
                        if (first.ValueKind == JsonValueKind.Object)
                        {
                            if (first.TryGetProperty("message", out var messageElem) && messageElem.ValueKind == JsonValueKind.Object && messageElem.TryGetProperty("content", out var contentElem) && contentElem.ValueKind == JsonValueKind.String)
                            {
                                return contentElem.GetString();
                            }

                            if (first.TryGetProperty("text", out var textElem) && textElem.ValueKind == JsonValueKind.String)
                            {
                                return textElem.GetString();
                            }
                        }
                    }

                    if (root.ValueKind == JsonValueKind.Object)
                    {
                        if (root.TryGetProperty("output", out var outp) && outp.ValueKind == JsonValueKind.String) return outp.GetString();
                        if (root.TryGetProperty("response", out var respv) && respv.ValueKind == JsonValueKind.String) return respv.GetString();
                        if (root.TryGetProperty("text", out var textv) && textv.ValueKind == JsonValueKind.String) return textv.GetString();

                        foreach (var prop in root.EnumerateObject())
                        {
                            if (prop.Value.ValueKind == JsonValueKind.String) return prop.Value.GetString();
                            if (prop.Value.ValueKind == JsonValueKind.Object && prop.Value.TryGetProperty("text", out var t) && t.ValueKind == JsonValueKind.String) return t.GetString();
                        }
                    }
                }
                catch { }

                return txt;
            }
            catch (Exception ex)
            {
                return $"Error: {ex.Message}";
            }
        }

        public override void ClearConversation()
        {
            // No conversation state to clear in this simple implementation.
        }

        private static string? LoadSystemPrompt()
        {
            try
            {
                var baseDir = AppDomain.CurrentDomain.BaseDirectory;
                var path = Path.Combine(baseDir, "prompts", "system.yaml");
                if (!File.Exists(path)) return null;
                var lines = File.ReadAllLines(path);
                int idx = -1;
                for (int i = 0; i < lines.Length; i++)
                {
                    if (lines[i].TrimStart().StartsWith("prompt:", StringComparison.OrdinalIgnoreCase))
                    {
                        idx = i;
                        break;
                    }
                }
                if (idx < 0) return null;

                var contentLines = lines.Skip(idx + 1).ToArray();
                if (contentLines.Length == 0) return null;

                int start = 0;
                while (start < contentLines.Length && string.IsNullOrWhiteSpace(contentLines[start])) start++;
                if (start >= contentLines.Length) return null;

                int minIndent = int.MaxValue;
                for (int i = start; i < contentLines.Length; i++)
                {
                    var line = contentLines[i];
                    if (string.IsNullOrWhiteSpace(line)) continue;
                    int indent = line.TakeWhile(ch => ch == ' ').Count();
                    if (indent < minIndent) minIndent = indent;
                }
                if (minIndent == int.MaxValue) minIndent = 0;

                var trimmed = contentLines.Skip(start).Select(l => l.Length >= minIndent ? l.Substring(minIndent) : l).ToArray();
                var result = string.Join("\n", trimmed).TrimEnd();
                return result;
            }
            catch
            {
                return null;
            }
        }
    }
}
