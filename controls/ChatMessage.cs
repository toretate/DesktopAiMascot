using System;

namespace DesktopAiMascot.Controls
{
    public class ChatMessage
    {
        public string Sender { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public string? VoiceFilePath { get; set; } = null;

        /// <summary>
        /// 利用者のメッセージかどうかを判定する
        /// </summary>
        /// <returns>true: 利用者のメッセージ</returns>
        public bool isUserMessage()
        {
            return string.Equals(Sender, "User", StringComparison.OrdinalIgnoreCase);
        }
    }
}
