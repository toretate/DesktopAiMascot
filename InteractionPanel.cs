using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;

using DesktopAiMascot.aiservice;
using DesktopAiMascot.Controls;

namespace DesktopAiMascot
{
    public class InteractionPanel : UserControl
    {
        private readonly ChatInputBox inputBox;
        private readonly Font messageFont;
        private readonly MessageListPanel messagesPanel;

        public IAiChatService ChatService { get; set; }

        private readonly string messagesFilePath;

        public InteractionPanel()
        {
            // Enable transparent painting
            this.SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.SupportsTransparentBackColor, true);
            this.BackColor = Color.Transparent;

            // Use an emoji-capable font so emoji render correctly (Segoe UI Emoji on Windows)
            messageFont = new Font("Segoe UI Emoji", this.Font.Size);

            // Create input box (extracted control) docked to bottom
            inputBox = new ChatInputBox();
            inputBox.Font = messageFont;
            inputBox.Height = 28;
            inputBox.Dock = DockStyle.Bottom;
            inputBox.SendRequested += InputBox_SendRequested;

            // Create messages panel above the input area
            messagesPanel = new MessageListPanel();
            messagesPanel.Dock = DockStyle.Fill;
            messagesPanel.Font = messageFont;

            // Add controls: messages panel fills, input at bottom
            this.Controls.Add(messagesPanel);
            this.Controls.Add(inputBox);

            // Default chat service
            ChatService = new LmStudioChatService();

            // messages file under AppData
            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            string appDir = Path.Combine(appData, "DesktopAiMascot");
            messagesFilePath = Path.Combine(appDir, "messages.json");

            // Try to load saved messages and session id
            try
            {
                string? sid = messagesPanel.LoadFromFile(messagesFilePath);
                if (!string.IsNullOrEmpty(sid) && ChatService is aiservice.LmStudioChatService lm)
                {
                    lm.SessionId = sid;
                }

                // If we loaded messages, populate the chat service conversation so requests include history
                if (ChatService is aiservice.LmStudioChatService lm2)
                {
                    var msgs = messagesPanel.GetMessages();
                    if (msgs != null && msgs.Count > 0) lm2.Conversation = msgs;
                }
            }
            catch { }
        }

        public void AddMessage(string sender, string text)
        {
            messagesPanel.AddMessage(sender, text);
        }

        public IReadOnlyList<ChatMessage> GetMessages() => messagesPanel.GetMessages();

        public void ClearMessages()
        {
            messagesPanel.ClearMessages();
        }

        public void SaveToFile(string path)
        {
            // Pass current session id when saving so file stores it
            string? sid = null;
            if (ChatService is aiservice.LmStudioChatService lm) sid = lm.SessionId;
            messagesPanel.SaveToFile(path, sid);
        }

        public void LoadFromFile(string path)
        {
            string? sid = messagesPanel.LoadFromFile(path);
            if (!string.IsNullOrEmpty(sid) && ChatService is aiservice.LmStudioChatService lm)
            {
                lm.SessionId = sid;
            }

            // update conversation on the chat service when loading
            if (ChatService is aiservice.LmStudioChatService lm2)
            {
                var msgs = messagesPanel.GetMessages();
                if (msgs != null && msgs.Count > 0) lm2.Conversation = msgs;
            }
        }

        // Show the input box and focus it. Call this when mascot is clicked.
        public void ShowInput()
        {
            inputBox.ShowInput();
        }

        private void InputBox_SendRequested(string text)
        {
            // handle send from input control (user pressed Enter or lost focus)
            _ = HandleSendFromInputAsync(text);
        }

        private async Task HandleSendFromInputAsync(string text)
        {
            AddMessage("User", text);

            // ensure the chat service has up-to-date conversation history so LMStudio receives the full context
            if (ChatService is aiservice.LmStudioChatService lm)
            {
                lm.Conversation = messagesPanel.GetMessages();
            }

            try
            {
                var reply = await ChatService.SendMessageAsync(text);
                if (string.IsNullOrWhiteSpace(reply)) reply = "(no response)";
                if (this.IsHandleCreated)
                {
                    this.BeginInvoke(new Action(() => AddMessage("Assistant", reply)));
                }
                else
                {
                    AddMessage("Assistant", reply);
                }
            }
            catch (Exception ex)
            {
                if (this.IsHandleCreated)
                {
                    this.BeginInvoke(new Action(() => AddMessage("Assistant", $"Error: {ex.Message}")));
                }
                else
                {
                    AddMessage("Assistant", $"Error: {ex.Message}");
                }
            }

            // after each send, persist messages and session id
            try
            {
                SaveToFile(messagesFilePath);
            }
            catch { }

            // clear input
            inputBox.Clear();
            messagesPanel.Focus();
            messagesPanel.Invalidate();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                messageFont?.Dispose();
                // persist messages on dispose
                try { SaveToFile(messagesFilePath); } catch { }
            }
            base.Dispose(disposing);
        }
    }
}
