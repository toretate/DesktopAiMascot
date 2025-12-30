using System;
using System.Drawing;
using System.Windows.Forms;

namespace DesktopAiMascot.Controls
{
    public class ChatInputBox : UserControl
    {
        private readonly TextBox textBox;

        // Raised when the user requests sending the current text (Enter without Shift) or when focus is lost with text.
        public event Action<string>? SendRequested;

        public ChatInputBox()
        {
            this.textBox = new TextBox();
            textBox.BorderStyle = BorderStyle.FixedSingle;
            textBox.Multiline = true;
            textBox.AcceptsReturn = true;
            textBox.AcceptsTab = true;
            textBox.Dock = DockStyle.Fill;
            textBox.KeyDown += TextBox_KeyDown;
            textBox.LostFocus += TextBox_LostFocus;

            this.Controls.Add(textBox);

            // keep input visible by default
            this.Visible = true;
            this.Height = 28;
        }

        private void TextBox_KeyDown(object? sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Enter && !e.Shift)
            {
                e.SuppressKeyPress = true;
                e.Handled = true;
                var txt = textBox.Text?.Trim();
                if (!string.IsNullOrEmpty(txt))
                {
                    SendRequested?.Invoke(txt);
                }
            }
        }

        private void TextBox_LostFocus(object? sender, EventArgs e)
        {
            var txt = textBox.Text?.Trim();
            if (!string.IsNullOrEmpty(txt))
            {
                SendRequested?.Invoke(txt);
            }
        }

        public void ShowInput()
        {
            // keep visible; just focus and select
            this.Visible = true;
            textBox.Focus();
            textBox.SelectAll();
        }

        public void Clear()
        {
            textBox.Text = string.Empty;
        }

        // kept for compatibility but no longer hides
        public void ClearAndHide()
        {
            Clear();
            // do not hide to keep input always visible
        }

        public string Text => textBox.Text;

        public new Font Font
        {
            get => base.Font;
            set
            {
                base.Font = value;
                if (textBox != null) textBox.Font = value;
            }
        }
    }
}
