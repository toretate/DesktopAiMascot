using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace DesktopAiMascot
{
    public class InteractionPanel : UserControl
    {
        private readonly List<Message> messages = new();
        private readonly Padding contentPadding = new(10);
        private readonly TextBox inputBox;

        public IAiChatService ChatService { get; set; }

        public InteractionPanel()
        {
            // Enable transparent painting
            this.SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.SupportsTransparentBackColor, true);
            this.BackColor = Color.Transparent;

            // Create input box docked to bottom
            inputBox = new TextBox();
            inputBox.BorderStyle = BorderStyle.FixedSingle;
            inputBox.Multiline = true; // allow multiple lines; send on Shift+Enter
            inputBox.Height = 28;
            inputBox.Dock = DockStyle.Bottom;
            inputBox.Visible = false; // hidden until requested
            inputBox.AcceptsTab = true;
            inputBox.KeyDown += InputBox_KeyDown;
            inputBox.LostFocus += InputBox_LostFocus;
            this.Controls.Add(inputBox);

            // Default chat service
            ChatService = new LmStudioChatService();
        }

        // Make the control truly transparent so it shows the parent's content underneath.
        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                // WS_EX_TRANSPARENT (0x20) causes the control to be painted after the parent, allowing transparency
                cp.ExStyle |= 0x20;
                return cp;
            }
        }

        // Prevent default background painting so parent's background shows through.
        protected override void OnPaintBackground(PaintEventArgs e)
        {
            // Intentionally empty
        }

        public void AddMessage(string sender, string text)
        {
            if (string.IsNullOrEmpty(text)) return;
            if (this.InvokeRequired)
            {
                this.Invoke(new Action(() => AddMessage(sender, text)));
                return;
            }

            messages.Add(new Message { Sender = sender, Text = text });
            Invalidate();
        }

        public IReadOnlyList<Message> GetMessages() => messages.AsReadOnly();

        public void ClearMessages()
        {
            messages.Clear();
            Invalidate();
        }

        public void SaveToFile(string path)
        {
            try
            {
                var dir = Path.GetDirectoryName(path) ?? string.Empty;
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                var options = new JsonSerializerOptions { WriteIndented = true };
                File.WriteAllText(path, JsonSerializer.Serialize(messages, options));
            }
            catch { }
        }

        public void LoadFromFile(string path)
        {
            try
            {
                if (!File.Exists(path)) return;
                string txt = File.ReadAllText(path);
                var loaded = JsonSerializer.Deserialize<List<Message>>(txt);
                if (loaded != null)
                {
                    messages.Clear();
                    messages.AddRange(loaded);
                    Invalidate();
                }
            }
            catch { }
        }

        // Show the input box and focus it. Call this when mascot is clicked.
        public void ShowInput()
        {
            inputBox.Visible = true;
            inputBox.Focus();
            inputBox.SelectAll();
        }

        private void InputBox_LostFocus(object? sender, EventArgs e)
        {
            // commit when losing focus
            _ = CommitInputAsync();
        }

        private void InputBox_KeyDown(object? sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Enter && e.Shift)
            {
                e.SuppressKeyPress = true;
                _ = CommitInputAsync();
            }
            // else let Enter insert newline
        }

        private async Task CommitInputAsync()
        {
            if (!inputBox.Visible) return;
            string text = inputBox.Text?.Trim();
            if (!string.IsNullOrEmpty(text))
            {
                AddMessage("User", text);
                try
                {
                    var reply = await ChatService.SendMessageAsync(text).ConfigureAwait(false);
                    if (string.IsNullOrWhiteSpace(reply)) reply = "(no response)";
                    // Marshal back to UI thread
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
            }

            inputBox.Text = string.Empty;
            inputBox.Visible = false;
            this.Invalidate();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            var g = e.Graphics;
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;

            int x = contentPadding.Left;
            int y = contentPadding.Top;
            int maxWidth = this.ClientSize.Width - contentPadding.Left - contentPadding.Right;

            // Render messages top-to-bottom with bubble style; newer messages appear at bottom visually
            int availableHeight = this.ClientSize.Height - contentPadding.Top - contentPadding.Bottom - (inputBox.Visible ? inputBox.Height : 0);

            // measure total height to start drawing from top; we'll just draw from top for simplicity
            using var sf = new StringFormat();
            sf.Alignment = StringAlignment.Near;
            sf.LineAlignment = StringAlignment.Near;

            var font = this.Font;
            foreach (var msg in messages)
            {
                // bubble sizing
                var text = msg.Text;
                var measured = g.MeasureString(text, font, maxWidth - 20);
                int bw = (int)measured.Width + 16;
                int bh = (int)measured.Height + 12;

                Rectangle bubbleRect;
                bool isUser = string.Equals(msg.Sender, "User", StringComparison.OrdinalIgnoreCase);
                if (isUser)
                {
                    // right-aligned bubble
                    bubbleRect = new Rectangle(this.ClientSize.Width - contentPadding.Right - bw - 4, y, bw, bh);
                }
                else
                {
                    // left-aligned bubble
                    bubbleRect = new Rectangle(x + 4, y, bw, bh);
                }

                // draw bubble background
                using var bubbleBrush = new SolidBrush(isUser ? Color.FromArgb(220, 0, 150, 255) : Color.FromArgb(230, 255, 255, 255));
                using var borderPen = new Pen(Color.FromArgb(120, 0, 0, 0));
                using var path = CreateRoundedRectanglePath(bubbleRect, 12);
                g.FillPath(bubbleBrush, path);
                g.DrawPath(borderPen, path);

                // draw text
                var textRect = new RectangleF(bubbleRect.Left + 8, bubbleRect.Top + 6, bubbleRect.Width - 12, bubbleRect.Height - 8);
                g.DrawString(text, font, isUser ? Brushes.White : Brushes.Black, textRect);

                y += bh + 8;
                if (y > availableHeight) break;
            }
        }

        private static System.Drawing.Drawing2D.GraphicsPath CreateRoundedRectanglePath(Rectangle rect, int radius)
        {
            var path = new System.Drawing.Drawing2D.GraphicsPath();
            int diameter = radius * 2;
            var arc = new Rectangle(rect.Location, new Size(diameter, diameter));

            // top-left arc
            path.AddArc(arc, 180, 90);
            // top edge
            arc.X = rect.Right - diameter;
            path.AddArc(arc, 270, 90);
            // right edge
            arc.Y = rect.Bottom - diameter;
            path.AddArc(arc, 0, 90);
            // bottom edge
            arc.X = rect.Left;
            path.AddArc(arc, 90, 90);
            path.CloseFigure();
            return path;
        }

        public class Message
        {
            public string Sender { get; set; } = string.Empty;
            public string Text { get; set; } = string.Empty;
        }
    }
}
