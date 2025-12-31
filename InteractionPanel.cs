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
        // Expose controls so the WinForms designer can edit them
        public ChatInputBox inputBox;
        private readonly Font messageFont;
        public MessageListPanel messagesPanel;
        public ToolStrip topToolStrip;
        private ToolStripButton clearBtn;
        private ToolStripButton settingsButton;

        public IAiChatService ChatService { get; set; }

        private readonly string messagesFilePath;

        // overlay for showing settings inside the panel
        private Panel overlayPanel;
        private DesktopAiMascot.Views.SettingsForm settingsControl;

        public InteractionPanel()
        {
            // Initialize designer-created controls
            InitializeComponent();

            // Enable transparent painting
            this.SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.SupportsTransparentBackColor, true);
            this.BackColor = Color.White;

            // Use an emoji-capable font so emoji render correctly (Segoe UI Emoji on Windows)
            // messageFont is kept private as it's not intended to be modified by the designer
            messageFont = new Font("Segoe UI Emoji", this.Font.Size);

            // Apply font to existing controls created in InitializeComponent
            if (messagesPanel != null) messagesPanel.Font = messageFont;
            if (inputBox != null) inputBox.Font = messageFont;

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
                // If we loaded messages, populate the chat service conversation so requests include history
                if (ChatService is aiservice.LmStudioChatService lm2)
                {
                    var msgs = messagesPanel.GetMessages();
                    if (msgs != null && msgs.Count > 0) lm2.Conversation = msgs;
                }
            }
            catch { }

            // prepare overlay and settings control
            overlayPanel = new Panel();
            overlayPanel.Visible = false;
            overlayPanel.BackColor = Color.FromArgb(200, Color.Gray);
            overlayPanel.Dock = DockStyle.Fill;
            overlayPanel.TabStop = true;

            settingsControl = new DesktopAiMascot.Views.SettingsForm();
            settingsControl.Visible = false;
            settingsControl.Dock = DockStyle.Fill;
            settingsControl.CloseRequested += SettingsControl_CloseRequested;

            overlayPanel.Controls.Add(settingsControl);
            Controls.Add(overlayPanel);
        }

        private void SettingsControl_CloseRequested(object? sender, EventArgs e)
        {
            HideSettingsOverlay();
        }

        private void ShowSettingsOverlay()
        {
            try
            {
                // show overlay above other controls
                overlayPanel.BringToFront();
                overlayPanel.Visible = true;
                settingsControl.Visible = true;
                overlayPanel.Focus();
            }
            catch { }
        }

        private void HideSettingsOverlay()
        {
            try
            {
                settingsControl.Visible = false;
                overlayPanel.Visible = false;
                // restore focus to messages panel
                messagesPanel.Focus();
            }
            catch { }
        }

        public void AddMessage(string sender, string text)
        {
            messagesPanel.AddMessage(sender, text);
        }

        public IReadOnlyList<ChatMessage> GetMessages() => messagesPanel.GetMessages();

        // Make ClearMessages compatible with EventHandler so the WinForms designer can wire it up directly.
        private void ClearMessages(object? sender = null, EventArgs? e = null)
        {
            messagesPanel.ClearMessages();
            if (ChatService != null)
            {
                ChatService.ClearConversation();
            }
        }

        private void OnSettingsButtonCliecked(object? sender, EventArgs e)
        {
            ShowSettingsOverlay();
        }

        public void SaveToFile(string path)
        {
            try
            {
                var dir = Path.GetDirectoryName(path);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) Directory.CreateDirectory(dir);
                messagesPanel.SaveToFile(path);
            }
            catch { }
        }

        public void LoadFromFile(string path)
        {
            try
            {
                // Load into messages panel (which will raise events to update UI)
                var sid = messagesPanel.LoadFromFile(path);

                // update conversation on the chat service when loading
                if (ChatService is aiservice.LmStudioChatService lm2)
                {
                    var msgs = messagesPanel.GetMessages();
                    if (msgs != null && msgs.Count > 0) lm2.Conversation = msgs;
                }
            }
            catch { }
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
                    // Use Invoke so the assistant message is added to the in-memory history before we save to disk
                    this.Invoke(new Action(() => AddMessage("Assistant", reply)));
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
                    // Use Invoke for consistency when reporting errors as messages
                    this.Invoke(new Action(() => AddMessage("Assistant", $"Error: {ex.Message}")));
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

        private void InitializeComponent()
        {
            topToolStrip = new ToolStrip();
            clearBtn = new ToolStripButton();
            settingsButton = new ToolStripButton();
            messagesPanel = new MessageListPanel();
            inputBox = new ChatInputBox();
            topToolStrip.SuspendLayout();
            SuspendLayout();
            // 
            // topToolStrip
            // 
            topToolStrip.GripStyle = ToolStripGripStyle.Hidden;
            topToolStrip.Items.AddRange(new ToolStripItem[] { clearBtn, settingsButton });
            topToolStrip.Location = new Point(0, 0);
            topToolStrip.Name = "topToolStrip";
            topToolStrip.Size = new Size(205, 25);
            topToolStrip.TabIndex = 0;
            // 
            // clearBtn
            // 
            clearBtn.Alignment = ToolStripItemAlignment.Right;
            clearBtn.Name = "clearBtn";
            clearBtn.Size = new Size(37, 22);
            clearBtn.Text = "Clear";
            clearBtn.ToolTipText = "Clear messages";
            clearBtn.Click += ClearMessages;
            // 
            // settingsButton
            // 
            settingsButton.DisplayStyle = ToolStripItemDisplayStyle.Text;
            settingsButton.ImageTransparentColor = Color.Magenta;
            settingsButton.Name = "settingsButton";
            settingsButton.Size = new Size(23, 22);
            settingsButton.Text = "⚙";
            settingsButton.Click += OnSettingsButtonCliecked;
            // 
            // messagesPanel
            // 
            messagesPanel.BackColor = Color.White;
            messagesPanel.Dock = DockStyle.Fill;
            messagesPanel.Location = new Point(0, 25);
            messagesPanel.Name = "messagesPanel";
            messagesPanel.Size = new Size(205, 303);
            messagesPanel.TabIndex = 1;
            // 
            // inputBox
            // 
            inputBox.BorderStyle = BorderStyle.FixedSingle;
            inputBox.Dock = DockStyle.Bottom;
            inputBox.Location = new Point(0, 308);
            inputBox.Name = "inputBox";
            inputBox.Size = new Size(205, 20);
            inputBox.TabIndex = 2;
            inputBox.SendRequested += InputBox_SendRequested;
            // 
            // InteractionPanel
            // 
            BackColor = SystemColors.Control;
            BorderStyle = BorderStyle.FixedSingle;
            Controls.Add(inputBox);
            Controls.Add(messagesPanel);
            Controls.Add(topToolStrip);
            Name = "InteractionPanel";
            Size = new Size(205, 328);
            topToolStrip.ResumeLayout(false);
            topToolStrip.PerformLayout();
            ResumeLayout(false);
            PerformLayout();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                messageFont?.Dispose();
                topToolStrip?.Dispose();
                // persist messages on dispose
                try { SaveToFile(messagesFilePath); } catch { }
            }
            base.Dispose(disposing);
        }
    }
}
