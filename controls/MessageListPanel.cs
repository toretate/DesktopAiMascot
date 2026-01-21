using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Text.Json;
using System.Windows.Forms;
using System.Drawing.Drawing2D;
using DesktopAiMascot.aiservice;
using System.ComponentModel;

namespace DesktopAiMascot.Controls
{
    /// <summary>
    /// A list-style message control that uses a ListBox to manage items.
    /// Rendering of each message (bubble) is delegated to ChatMessage.Draw/Measure.
    /// Converted to a partial UserControl so the WinForms designer can be used.
    /// </summary>
    public partial class MessageListPanel : UserControl
    {
        private readonly Padding contentPadding = new(6);

        public MessageListPanel()
        {
            InitializeComponent();

            // Initialize custom context menu items (not designer managed)
            var copyItem = new ToolStripMenuItem("Copy");
            copyItem.Click += (s, e) => CopySelectionToClipboard();
            this.messagesContextMenu.Items.Add(copyItem);

            this.DoubleBuffered = true;
            this.BackColor = Color.White;

            // Ensure listbox has the expected modes (designer may have already set these)
            if (listBox != null)
            {
                listBox.DrawMode = DrawMode.OwnerDrawVariable;
                listBox.SelectionMode = SelectionMode.MultiExtended;
                listBox.IntegralHeight = false;

                listBox.MeasureItem += ListBox_MeasureItem;
                listBox.DrawItem += ListBox_DrawItem;
                listBox.MouseDoubleClick += ListBox_MouseDoubleClick;
            }

            // Populate from ChatHistory manager
            foreach (var m in ChatHistory.GetMessages()) listBox.Items.Add(m);

            // Subscribe to future additions and bulk loads
            ChatHistory.MessageAdded += OnMessageAdded;
            ChatHistory.MessagesLoaded += OnMessagesLoaded;
        }

        private void OnMessageAdded(object? sender, ChatHistory.ChatMessageEventArgs e)
        {
            if (e == null || e.Message == null) return;
            if (this.InvokeRequired)
            {
                this.BeginInvoke(new Action(() => OnMessageAdded(sender, e)));
                return;
            }

            listBox.Items.Add(e.Message);
            ScrollToBottom();
        }

        private void OnMessagesLoaded(object? sender, ChatHistory.ChatMessagesEventArgs e)
        {
            if (e == null || e.Messages == null) return;
            if (this.InvokeRequired)
            {
                this.BeginInvoke(new Action(() => OnMessagesLoaded(sender, e)));
                return;
            }

            listBox.Items.Clear();
            foreach (var m in e.Messages) listBox.Items.Add(m);
            ScrollToBottom();
        }

        public void AddMessage(string sender, string text)
        {
            if (string.IsNullOrEmpty(text)) return;
            if (this.InvokeRequired)
            {
                this.Invoke(new Action(() => AddMessage(sender, text)));
                return;
            }

            var msg = new ChatMessage { Sender = sender, Text = text };
            // Add to manager; UI will be updated via MessageAdded event
            ChatHistory.AddMessage(msg);
        }

        public IReadOnlyList<ChatMessage> GetMessages() => ChatHistory.GetMessages();

        public void ClearMessages()
        {
            listBox.Items.Clear();
            ChatHistory.DeleteAll();
        }

        // Save messages to file. If sessionId is provided, save wrapper { sessionId, messages }.
        public void SaveToFile(string path, string? sessionId = null)
        {
            try
            {
                ChatHistory.Save(path, sessionId);
            }
            catch { }
        }

        // Load messages from file. If file contains wrapper with sessionId, return it; otherwise return null.
        public string? LoadFromFile(string path)
        {
            try
            {
                // Clear current UI first; ChatHistory.Load will raise MessagesLoaded for bulk replacement
                listBox.Items.Clear();

                var (loaded, sid) = ChatHistory.Load(path);
                // If no messages loaded, nothing to add (Load already updated in-memory store)
                ScrollToBottom();
                return sid;
            }
            catch { }

            return null;
        }

        public void CopySelectionToClipboard()
        {
            if (listBox.SelectedIndices.Count == 0) return;
            var sb = new System.Text.StringBuilder();
            foreach (int idx in listBox.SelectedIndices)
            {
                if (idx >= 0 && idx < listBox.Items.Count)
                {
                    if (sb.Length > 0) sb.AppendLine();
                    var m = listBox.Items[idx] as ChatMessage;
                    if (m != null) sb.AppendLine($"{m.Sender}: {m.Text}");
                }
            }
            try { Clipboard.SetText(sb.ToString()); } catch { }
        }

        // ダブルクリックでクリップボードに内容を送付
        private void ListBox_MouseDoubleClick(object? sender, MouseEventArgs e)
        {
            int idx = listBox.IndexFromPoint(e.Location);
            if (idx >= 0 && idx < listBox.Items.Count)
            {
                var m = listBox.Items[idx] as ChatMessage;
                if (m != null)
                {
                    try { Clipboard.SetText(m.Text); } catch { }
                }
            }
        }

        private void ListBox_MeasureItem(object? sender, MeasureItemEventArgs e)
        {
            if (e.Index < 0 || e.Index >= listBox.Items.Count)
            {
                e.ItemHeight = (int)(this.Font.Height + contentPadding.Vertical);
                return;
            }

            var msg = listBox.Items[e.Index] as ChatMessage;
            if (msg == null)
            {
                e.ItemHeight = (int)(this.Font.Height + contentPadding.Vertical);
                return;
            }

            // Determine max width for bubble inside the listbox client area
            int maxWidth = Math.Max(20, listBox.ClientSize.Width - contentPadding.Horizontal - 20);
            // Use the Measure helper on ChatMessage
            using (var g = listBox.CreateGraphics())
            {
                var size = msg.Measure(g, this.Font, maxWidth);
                e.ItemHeight = size.Height + 8; // include spacing between items
            }
        }

        private void ListBox_DrawItem(object? sender, DrawItemEventArgs e)
        {
            e.DrawBackground();
            if (e.Index < 0 || e.Index >= listBox.Items.Count) return;

            var msg = listBox.Items[e.Index] as ChatMessage;
            if (msg == null) return;

            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;

            // compute bubble rectangle inside the item's bounds
            Rectangle bounds = e.Bounds;
            int maxWidth = Math.Max(20, listBox.ClientSize.Width - contentPadding.Horizontal - 20);

            var size = msg.Measure(g, this.Font, maxWidth);
            int bw = size.Width;
            int bh = size.Height;

            bool isUser = msg.isUserMessage();
            Rectangle bubbleRect;
            if (isUser)
            {
                bubbleRect = new Rectangle(bounds.Right - bw - 4 - contentPadding.Right, bounds.Top + 4, bw, bh);
            }
            else
            {
                bubbleRect = new Rectangle(bounds.Left + contentPadding.Left + 4, bounds.Top + 4, bw, bh);
            }

            bool selected = (e.State & DrawItemState.Selected) == DrawItemState.Selected;
            msg.Draw(g, bubbleRect, this.Font, isUser, selected);

            // Draw focus rectangle if needed
            if ((e.State & DrawItemState.Focus) == DrawItemState.Focus)
            {
                e.DrawFocusRectangle();
            }
        }

        private void ScrollToBottom()
        {
            if (listBox.Items.Count == 0) return;
            try
            {
                listBox.TopIndex = Math.Max(0, listBox.Items.Count - 1);
            }
            catch { }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                ChatHistory.MessageAdded -= OnMessageAdded;
                ChatHistory.MessagesLoaded -= OnMessagesLoaded;
                if (listBox != null)
                {
                    listBox.MeasureItem -= ListBox_MeasureItem;
                    listBox.DrawItem -= ListBox_DrawItem;
                    listBox.MouseDoubleClick -= ListBox_MouseDoubleClick;
                }

                if (components != null)
                {
                    components.Dispose();
                }
            }
            base.Dispose(disposing);
        }
    }
}
