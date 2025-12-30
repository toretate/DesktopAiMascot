using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Text.Json;
using System.Windows.Forms;
using System.Drawing.Drawing2D;
using DesktopAiMascot.aiservice;

namespace DesktopAiMascot.Controls
{
    /// <summary>
    /// A list-style message control that uses a ListBox to manage items.
    /// Rendering of each message (bubble) is delegated to ChatMessage.Draw/Measure.
    /// </summary>
    public class MessageListPanel : Panel
    {
        private readonly List<ChatMessage> messages = new();
        private readonly ListBox listBox;
        private readonly ContextMenuStrip messagesContextMenu;
        private readonly Padding contentPadding = new(6);

        public MessageListPanel()
        {
            this.DoubleBuffered = true;
            this.BackColor = Color.White;

            listBox = new ListBox
            {
                Dock = DockStyle.Fill,
                DrawMode = DrawMode.OwnerDrawVariable,
                SelectionMode = SelectionMode.MultiExtended,
                IntegralHeight = false
            };

            listBox.MeasureItem += ListBox_MeasureItem;
            listBox.DrawItem += ListBox_DrawItem;
            listBox.MouseDoubleClick += ListBox_MouseDoubleClick;

            this.Controls.Add(listBox);

            // Context menu
            messagesContextMenu = new ContextMenuStrip();
            var copyItem = new ToolStripMenuItem("Copy");
            copyItem.Click += (s, e) => CopySelectionToClipboard();
            messagesContextMenu.Items.Add(copyItem);
            listBox.ContextMenuStrip = messagesContextMenu;
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
            messages.Add(msg);
            listBox.Items.Add(msg);
            ScrollToBottom();
        }

        public IReadOnlyList<ChatMessage> GetMessages() => messages.AsReadOnly();

        public void ClearMessages()
        {
            messages.Clear();
            listBox.Items.Clear();
        }

        // Save messages to file. If sessionId is provided, save wrapper { sessionId, messages }.
        public void SaveToFile(string path, string? sessionId = null)
        {
            try
            {
                ChatHistory.Save(path, messages, sessionId);
            }
            catch { }
        }

        // Load messages from file. If file contains wrapper with sessionId, return it; otherwise return null.
        public string? LoadFromFile(string path)
        {
            try
            {
                var (loaded, sid) = ChatHistory.Load(path);
                if (loaded != null && loaded.Count > 0)
                {
                    messages.Clear();
                    messages.AddRange(loaded);
                    listBox.Items.Clear();
                    foreach (var m in messages) listBox.Items.Add(m);
                    ScrollToBottom();
                }

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
                if (idx >= 0 && idx < messages.Count)
                {
                    if (sb.Length > 0) sb.AppendLine();
                    sb.AppendLine($"{messages[idx].Sender}: {messages[idx].Text}");
                }
            }
            try { Clipboard.SetText(sb.ToString()); } catch { }
        }

        // ダブルクリックでクリップボードに内容を送付
        private void ListBox_MouseDoubleClick(object? sender, MouseEventArgs e)
        {
            int idx = listBox.IndexFromPoint(e.Location);
            if (idx >= 0 && idx < messages.Count)
            {
                try { Clipboard.SetText(messages[idx].Text); } catch { }
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

            bool isUser = string.Equals(msg.Sender, "User", StringComparison.OrdinalIgnoreCase);
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
                messagesContextMenu?.Dispose();
                listBox.MeasureItem -= ListBox_MeasureItem;
                listBox.DrawItem -= ListBox_DrawItem;
                listBox.MouseDoubleClick -= ListBox_MouseDoubleClick;
                listBox?.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
