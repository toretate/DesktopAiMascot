using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using DesktopAiMascot.Controls;

namespace DesktopAiMascot.aiservice
{
    internal static class ChatHistory
    {
        // Save messages to file. If sessionId provided, save wrapper { sessionId, messages }.
        public static void Save(string path, IEnumerable<ChatMessage> messages, string? sessionId = null)
        {
            try
            {
                var dir = Path.GetDirectoryName(path) ?? string.Empty;
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                var options = new JsonSerializerOptions { WriteIndented = true };

                if (string.IsNullOrEmpty(sessionId))
                {
                    File.WriteAllText(path, JsonSerializer.Serialize(messages, options));
                }
                else
                {
                    var wrapper = new { sessionId = sessionId, messages = messages };
                    File.WriteAllText(path, JsonSerializer.Serialize(wrapper, options));
                }
            }
            catch { }
        }

        // Load messages from file. Returns tuple of messages list (may be empty) and sessionId if present.
        public static (List<ChatMessage>?, string?) Load(string path)
        {
            try
            {
                if (!File.Exists(path)) return (null, null);
                string txt = File.ReadAllText(path);

                using (var doc = JsonDocument.Parse(txt))
                {
                    var root = doc.RootElement;
                    if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("messages", out var msgs))
                    {
                        string? sid = null;
                        if (root.TryGetProperty("sessionId", out var sidElem) && sidElem.ValueKind == JsonValueKind.String)
                        {
                            sid = sidElem.GetString();
                        }

                        if (msgs.ValueKind == JsonValueKind.Array)
                        {
                            var loaded = JsonSerializer.Deserialize<List<ChatMessage>>(msgs.GetRawText());
                            return (loaded, sid);
                        }
                    }
                }

                var plain = JsonSerializer.Deserialize<List<ChatMessage>>(txt);
                if (plain != null) return (plain, null);
            }
            catch { }

            return (null, null);
        }
    }
}
