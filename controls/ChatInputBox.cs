using System;
using System.Drawing;
using System.Windows.Forms;

namespace DesktopAiMascot.Controls
{
    public partial class ChatInputBox : UserControl
    {
        private TextBox textBox;
        private Button clearButton;

        // Raised when the user requests sending the current text (Enter without Shift) or when focus is lost with text.
        public event Action<string>? SendRequested;
        // Raised when the user requests clearing the chat history via the clear button.
        public event Action? ClearHistoryRequested;

        // Designer-based constructor: initialize components and configure behavior
        public ChatInputBox()
        {
            InitializeComponent();
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

        private void InitializeComponent()
        {
            textBox = new TextBox();
            clearButton = new Button();
            SuspendLayout();
            // 
            // textBox
            // 
            textBox.AcceptsReturn = true;
            textBox.BorderStyle = BorderStyle.None;
            textBox.Dock = DockStyle.Fill;
            textBox.Location = new Point(0, 0);
            textBox.Multiline = true;
            textBox.Name = "textBox";
            textBox.Size = new Size(218, 18);
            textBox.TabIndex = 0;
            textBox.KeyDown += TextBox_KeyDown;
            textBox.LostFocus += TextBox_LostFocus;
            // 
            // clearButton
            // 
            clearButton.Dock = DockStyle.Right;
            clearButton.FlatStyle = FlatStyle.System;
            clearButton.Location = new Point(218, 0);
            clearButton.Name = "clearButton";
            clearButton.Size = new Size(20, 18);
            clearButton.TabIndex = 1;
            clearButton.Text = "✖";
            clearButton.UseVisualStyleBackColor = true;
            clearButton.Click += ClearButton_Click;
            // 
            // ChatInputBox
            // 
            BorderStyle = BorderStyle.FixedSingle;
            Controls.Add(textBox);
            Controls.Add(clearButton);
            Name = "ChatInputBox";
            Size = new Size(238, 18);
            ResumeLayout(false);
            PerformLayout();

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
