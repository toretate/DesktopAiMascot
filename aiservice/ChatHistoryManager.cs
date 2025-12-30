using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using DesktopAiMascot.Controls;

namespace DesktopAiMascot.aiservice
{
    internal static class ChatHistory
    {
        // In-memory messages store managed by this class
        private static readonly List<ChatMessage> messages = new();

        // EventArgs for message added
        public class ChatMessageEventArgs : EventArgs
        {
            public ChatMessage Message { get; }
            public ChatMessageEventArgs(ChatMessage message) => Message = message;
        }

        // EventArgs for bulk messages loaded/replaced
        public class ChatMessagesEventArgs : EventArgs
        {
            public IReadOnlyList<ChatMessage> Messages { get; }
            public ChatMessagesEventArgs(IReadOnlyList<ChatMessage> messages) => Messages = messages;
        }

        // Raised when a message is added to the in-memory store
        public static event EventHandler<ChatMessageEventArgs>? MessageAdded;

        // Raised when messages are loaded/replaced in bulk
        public static event EventHandler<ChatMessagesEventArgs>? MessagesLoaded;

        // Expose read-only view of messages
        public static IReadOnlyList<ChatMessage> GetMessages() => messages.AsReadOnly();

        // Add a message to in-memory store
        public static void AddMessage(ChatMessage msg)
        {
            if (msg == null) return;
            messages.Add(msg);
            // Raise event
            try
            {
                MessageAdded?.Invoke(null, new ChatMessageEventArgs(msg));
            }
            catch { }
        }

        // Clear in-memory messages (does not persist). Use ClearAll to also persist an empty file.
        public static void Clear()
        {
            messages.Clear();
        }

        // Save messages to file. If sessionId provided, save wrapper { sessionId, messages }.
        // This overload saves the provided sequence and updates the in-memory store to match it.
        public static void Save(string path, IEnumerable<ChatMessage> msgs, string? sessionId = null)
        {
            try
            {
                var dir = Path.GetDirectoryName(path) ?? string.Empty;
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                var options = new JsonSerializerOptions { WriteIndented = true };

                if (string.IsNullOrEmpty(sessionId))
                {
                    File.WriteAllText(path, JsonSerializer.Serialize(msgs, options));
                }
                else
                {
                    var wrapper = new { sessionId = sessionId, messages = msgs };
                    File.WriteAllText(path, JsonSerializer.Serialize(wrapper, options));
                }

                // Update in-memory store to match saved messages
                messages.Clear();
                if (msgs != null)
                {
                    foreach (var m in msgs)
                    {
                        if (m != null) messages.Add(m);
                    }
                }
            }
            catch { }
        }

        // Save current in-memory messages to file
        public static void Save(string path, string? sessionId = null)
        {
            Save(path, messages, sessionId);
        }

        // Load messages from file. Returns tuple of messages list (may be empty) and sessionId if present.
        // Also updates the in-memory store when loading succeeds.
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
                            if (loaded != null)
                            {
                                messages.Clear();
                                messages.AddRange(loaded);
                                // raise a single bulk event for loaded messages
                                try
                                {
                                    MessagesLoaded?.Invoke(null, new ChatMessagesEventArgs(messages.AsReadOnly()));
                                }
                                catch { }
                            }
                            return (loaded, sid);
                        }
                    }
                }

                var plain = JsonSerializer.Deserialize<List<ChatMessage>>(txt);
                if (plain != null)
                {
                    messages.Clear();
                    messages.AddRange(plain);
                    try
                    {
                        MessagesLoaded?.Invoke(null, new ChatMessagesEventArgs(messages.AsReadOnly()));
                    }
                    catch { }
                    return (plain, null);
                }
            }
            catch { }

            return (null, null);
        }

        /**
         * チャット履歴をすべて削除します。
         * AppData\DesktopAiMascot\messages.json を空のメッセージ配列で上書きして保存します。
         */
        public static void DeleteAll()
        {
            try
            {
                // AppData にある既定の保存先を使用して空の配列で保存する
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                string appDir = Path.Combine(appData, "DesktopAiMascot");
                string path = Path.Combine(appDir, "messages.json");

                var dir = Path.GetDirectoryName(path) ?? string.Empty;
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

                // 空のメッセージリストで上書き保存する
                Save(path, new List<ChatMessage>(), null);

                // Also clear the in-memory messages
                messages.Clear();

                // notify listeners that messages have been replaced with an empty set
                try
                {
                    MessagesLoaded?.Invoke(null, new ChatMessagesEventArgs(messages.AsReadOnly()));
                }
                catch { }
            }
            catch { }
        }

        // Clear in-memory messages and persist empty history
        public static void ClearAll()
        {
            messages.Clear();
            DeleteAll();
        }
    }
}
