using System;
using System.Drawing;
using System.Windows.Forms;

namespace DesktopAiMascot.Controls
{
    public partial class ChatInputBox : UserControl
    {
        private TextBox textBox;
        private Button sendMessageButton;

        // メッセージ送信イベント
        public event Action<string>? SendRequested;

        // Designer-based constructor: initialize components and configure behavior
        public ChatInputBox()
        {
            InitializeComponent();
        }

        // テキストボックスの内容を取得
        public string GetText() => textBox.Text;

        private void SendMessage()
        {
            var text = textBox.Text?.Trim();
            if (!string.IsNullOrEmpty(text))
            {
                SendRequested?.Invoke(text);
            }
        }

        // 送信ボタンのクリックイベントハンドラ
        private void OnSendMessageButton_Click(object? sender, EventArgs e)
        {
            SendMessage();
        }

        // テキストボックスのKeyDownイベントハンドラ。 Enterキーで送信
        private void TextBox_KeyDown(object? sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Enter && !e.Shift)
            {
                e.SuppressKeyPress = true;
                e.Handled = true;
                SendMessage();
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
            sendMessageButton = new Button();
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
            // 
            // sendMessageButton
            // 
            sendMessageButton.Dock = DockStyle.Right;
            sendMessageButton.FlatStyle = FlatStyle.System;
            sendMessageButton.Location = new Point(218, 0);
            sendMessageButton.Name = "sendMessageButton";
            sendMessageButton.Size = new Size(20, 18);
            sendMessageButton.TabIndex = 1;
            sendMessageButton.Text = "➡";
            sendMessageButton.UseVisualStyleBackColor = true;
            sendMessageButton.Click += OnSendMessageButton_Click;
            // 
            // ChatInputBox
            // 
            BorderStyle = BorderStyle.FixedSingle;
            Controls.Add(textBox);
            Controls.Add(sendMessageButton);
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

        public new Font Font
        {
            get => base.Font;
            set
            {
                base.Font = value;
                if (textBox != null) textBox.Font = value;
                if (sendMessageButton != null) sendMessageButton.Font = value; // keep consistent
            }
        }
    }
}
