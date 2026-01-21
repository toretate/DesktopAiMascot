using System;
using System.Drawing;
using System.Drawing.Drawing2D;

namespace DesktopAiMascot.Controls
{
    public class ChatMessage
    {
        public string Sender { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;

        // Measure bubble size (including padding)
        public Size Measure(Graphics g, Font font, int maxWidth)
        {
            var measured = g.MeasureString(Text, font, Math.Max(4, maxWidth - 20));
            int bw = (int)measured.Width + 16; // horizontal padding
            int bh = (int)measured.Height + 12; // vertical padding
            return new Size(bw, bh);
        }

        // Draw the message bubble inside given rectangle
        public void Draw(Graphics g, Rectangle bubbleRect, Font font, bool isUser, bool selected)
        {
            // selection background
            if (selected)
            {
                using var selBrush = new SolidBrush(Color.FromArgb(80, Color.LightGray));
                using var selPath = CreateRoundedRectanglePath(bubbleRect, 12);
                g.FillPath(selBrush, selPath);
            }

            using var bubbleBrush = new SolidBrush(isUser ? Color.FromArgb(220, 0, 150, 255) : Color.FromArgb(230, 255, 255, 255));
            using var borderPen = new Pen(Color.FromArgb(120, 0, 0, 0));
            using var path = CreateRoundedRectanglePath(bubbleRect, 12);
            g.FillPath(bubbleBrush, path);
            g.DrawPath(borderPen, path);

            var textRect = new RectangleF(bubbleRect.Left + 8, bubbleRect.Top + 6, bubbleRect.Width - 12, bubbleRect.Height - 8);
            g.DrawString(Text, font, isUser ? Brushes.White : Brushes.Black, textRect);
        }

        /// <summary>
        /// ユーザー（利用者）が送信したメッセージかどうかを判定します。
        /// </summary>
        /// <returns>true: 利用者のメッセージ</returns>
        public bool isUserMessage()
        {
            return string.Equals(Sender, "User", StringComparison.OrdinalIgnoreCase);
        }


        private static GraphicsPath CreateRoundedRectanglePath(Rectangle rect, int radius)
        {
            var path = new GraphicsPath();
            int diameter = radius * 2;
            var arc = new Rectangle(rect.Location, new Size(diameter, diameter));

            // top-left arc
            path.AddArc(arc, 180, 90);
            // top-right arc
            arc.X = rect.Right - diameter;
            path.AddArc(arc, 270, 90);
            // bottom-right arc
            arc.Y = rect.Bottom - diameter;
            path.AddArc(arc, 0, 90);
            // bottom-left arc
            arc.X = rect.Left;
            path.AddArc(arc, 90, 90);
            path.CloseFigure();
            return path;
        }
    }
}
