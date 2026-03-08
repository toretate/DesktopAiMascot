using System;

namespace DesktopAiMascot.ui.chat
{
    public class ChatMessage
    {
        public string Sender { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public string? VoiceFilePath { get; set; } = null;

        public bool isUserMessage()
        {
            return string.Equals(Sender, "User", StringComparison.OrdinalIgnoreCase);
        }
    }
}
