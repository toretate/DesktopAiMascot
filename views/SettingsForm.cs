using System;
using System.Drawing;
using System.Windows.Forms;

namespace DesktopAiMascot.Views
{
    public partial class SettingsForm : UserControl
    {
        public event EventHandler? CloseRequested;

        public SettingsForm()
        {
            InitializeComponent();
        }

        private void SettingsForm_Resize(object? sender, EventArgs e)
        {
            LayoutControls();
        }

        private void LayoutControls()
        {
            int margin = 8;
            if (closeButton != null)
            {
                closeButton.Location = new Point(Math.Max(margin, this.ClientSize.Width - closeButton.Width - margin), margin);
            }

            if (contentPanel != null)
            {
                contentPanel.Size = new Size(Math.Max(0, this.ClientSize.Width - 24), Math.Max(0, this.ClientSize.Height - 56));
            }
        }

        private void SettingsForm_KeyDown(object? sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Escape)
            {
                CloseRequested?.Invoke(this, EventArgs.Empty);
            }
        }

        private void closeButton_Click(object? sender, EventArgs e)
        {
            CloseRequested?.Invoke(this, EventArgs.Empty);
        }

        // 表情差分などを生成するボタンのクリックイベントハンドラ
        private void OnGenerateEmotes_Click(object sender, EventArgs e)
        {

        }
    }
}
