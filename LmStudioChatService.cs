using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace DesktopAiMascot
{

    public class LmStudioChatService : IAiChatService
    {
        // Local LmStudio endpoint
        private const string LOCAL_ENDPOINT = "http://127.0.0.1:1234/v1/chat/completions";

        private static readonly HttpClient httpClient = new HttpClient();
        private readonly string endpoint;


        public LmStudioChatService(string endpoint = LOCAL_ENDPOINT)
        {
            this.endpoint = endpoint;
        }

        public async Task<string?> SendMessageAsync(string message)
        {
            try
            {
                var requestObj = new
                {
                    model = "qwen3-v1-8b",
                    messages = new[]
                    {
                        new { role = "system", content = "You are a helpful assistant." },
                        new { role = "user", content = message }
                    }
                };

                var json = JsonSerializer.Serialize(requestObj);

                using var content = new StringContent(json, Encoding.UTF8, "application/json");
                httpClient.Timeout = TimeSpan.FromSeconds(30);
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
    }
}
