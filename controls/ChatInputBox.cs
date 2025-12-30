using System;
using System.Drawing;
using System.Windows.Forms;

namespace DesktopAiMascot.Controls
{
    public class ChatInputBox : UserControl
    {
        private readonly TextBox textBox;
        private readonly Button clearButton;

        // Raised when the user requests sending the current text (Enter without Shift) or when focus is lost with text.
        public event Action<string>? SendRequested;
        // Raised when the user requests clearing the chat history via the clear button.
        public event Action? ClearHistoryRequested;

        public ChatInputBox()
        {
            this.textBox = new TextBox();
            this.clearButton = new Button();

            // configure clear button (icon-like appearance)
            clearButton.Dock = DockStyle.Right;
            clearButton.Width = 24;
            clearButton.Text = "✖";
            clearButton.FlatStyle = FlatStyle.Flat;
            clearButton.FlatAppearance.BorderSize = 0;
            clearButton.Cursor = Cursors.Hand;
            clearButton.TabStop = false;
            clearButton.Margin = new Padding(0);
            clearButton.Click += ClearButton_Click;

            // Ensure the clear button is painted immediately on startup when placed on a semi-transparent form.
            // Set an explicit background and enable visual styles for consistent rendering, then refresh.
            clearButton.BackColor = SystemColors.Control;
            clearButton.UseVisualStyleBackColor = true;
            clearButton.Refresh();

            textBox.BorderStyle = BorderStyle.FixedSingle;
            textBox.Multiline = true;
            textBox.AcceptsReturn = true;
            textBox.AcceptsTab = true;
            textBox.Dock = DockStyle.Fill;
            textBox.KeyDown += TextBox_KeyDown;
            textBox.LostFocus += TextBox_LostFocus;

            // add controls so the clear button stays at the right and textbox fills remaining
            this.Controls.Add(clearButton);
            this.Controls.Add(textBox);

            // keep input visible by default
            this.Visible = true;
            this.Height = 28;
        }

        private void ClearButton_Click(object? sender, EventArgs e)
        {
            // request clearing the chat history (handled by parent/owner)
            ClearHistoryRequested?.Invoke();
            textBox.Focus();
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
                if (clearButton != null) clearButton.Font = value; // keep consistent
            }
        }
    }
}
