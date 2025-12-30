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

namespace DesktopAiMascot.aiservice
{

    public class LmStudioChatService : IAiChatService
    {
        // Local LmStudio endpoint
        private const string LOCAL_ENDPOINT = "http://127.0.0.1:1234/v1/chat/completions";

        // Configure shared HttpClient once. Do not modify its properties after requests have started.
        private static readonly HttpClient httpClient = new HttpClient() { Timeout = TimeSpan.FromSeconds(30) };
        private readonly string endpoint;

        // Session id used by LMStudio for automatic context saving. Auto-generated but can be overridden when loading saved state.
        public string SessionId { get; set; }

        // Conversation history captured from UI; if set, SendMessageAsync will include these messages in the 'messages' array.
        public IReadOnlyList<ChatMessage>? Conversation { get; set; }

        public LmStudioChatService(string endpoint = LOCAL_ENDPOINT)
        {
            this.endpoint = endpoint;
            // generate a session id by default
            this.SessionId = Guid.NewGuid().ToString();
        }

        public async Task<string?> SendMessageAsync(string message)
        {
            try
            {
                var systemPrompt = LoadSystemPrompt() ?? "You are a helpful assistant.";

                // Build messages array: always include system prompt, then include conversation history if available.
                var msgs = new List<object>();
                msgs.Add(new { role = "system", content = systemPrompt });

                if (Conversation != null && Conversation.Count > 0)
                {
                    foreach (var m in Conversation)
                    {
                        string role = "user";
                        if (string.Equals(m.Sender, "Assistant", StringComparison.OrdinalIgnoreCase)) role = "assistant";
                        else if (string.Equals(m.Sender, "System", StringComparison.OrdinalIgnoreCase)) role = "system";
                        // otherwise treat as user
                        msgs.Add(new { role = role, content = m.Text });
                    }
                }
                else
                {
                    // fallback: include the single user message passed in
                    msgs.Add(new { role = "user", content = message });
                }

                var requestObj = new
                {
                    model = "qwen3-v1-8b",
                    // include session id as before (may be ignored by servers that don't support it)
                    session = this.SessionId,
                    messages = msgs
                };

                var json = JsonSerializer.Serialize(requestObj);

                // Output the request JSON to debug console and standard output for troubleshooting
                Debug.WriteLine("LMStudio request JSON:\n" + json);
                Console.WriteLine("LMStudio request JSON:\n" + json);

                using var content = new StringContent(json, Encoding.UTF8, "application/json");
                 var resp = await httpClient.PostAsync(endpoint, content).ConfigureAwait(false);
                 var txt = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);

                 // try to extract text from JSON
                 try
                 {
                     using var doc = JsonDocument.Parse(txt);
                     var root = doc.RootElement;

                     // OpenAI-style: choices[0].message.content
                     if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("choices", out var choices) && choices.ValueKind == JsonValueKind.Array && choices.GetArrayLength() > 0)
                     {
                         var first = choices[0];
                         if (first.ValueKind == JsonValueKind.Object)
                         {
                             if (first.TryGetProperty("message", out var messageElem) && messageElem.ValueKind == JsonValueKind.Object && messageElem.TryGetProperty("content", out var contentElem) && contentElem.ValueKind == JsonValueKind.String)
                             {
                                 return contentElem.GetString();
                             }

                             // some servers use 'text' field on choice
                             if (first.TryGetProperty("text", out var textElem) && textElem.ValueKind == JsonValueKind.String)
                             {
                                 return textElem.GetString();
                             }
                         }
                     }

                     // fallback: common keys
                     if (root.ValueKind == JsonValueKind.Object)
                     {
                         if (root.TryGetProperty("output", out var outp) && outp.ValueKind == JsonValueKind.String) return outp.GetString();
                         if (root.TryGetProperty("response", out var respv) && respv.ValueKind == JsonValueKind.String) return respv.GetString();
                         if (root.TryGetProperty("text", out var textv) && textv.ValueKind == JsonValueKind.String) return textv.GetString();

                         // explore nested
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

                 // collect the block scalar lines after the 'prompt:' line
                 var contentLines = lines.Skip(idx + 1).ToArray();
                 if (contentLines.Length == 0) return null;

                 // remove any leading empty lines
                 int start = 0;
                 while (start < contentLines.Length && string.IsNullOrWhiteSpace(contentLines[start])) start++;
                 if (start >= contentLines.Length) return null;

                 // determine minimal indent of non-empty lines
                 int minIndent = int.MaxValue;
                 for (int i = start; i < contentLines.Length; i++)
                 {
                     var line = contentLines[i];
                     if (string.IsNullOrWhiteSpace(line)) continue;
                     int indent = line.TakeWhile(ch => ch == ' ').Count();
                     if (indent < minIndent) minIndent = indent;
                 }
                 if (minIndent == int.MaxValue) minIndent = 0;

                 // trim the common indent
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
