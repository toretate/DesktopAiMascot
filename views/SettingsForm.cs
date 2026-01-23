using System;
using System.Drawing;
using System.Windows.Forms;
using DesktopAiMascot.mascots;

namespace DesktopAiMascot.Views
{
    public partial class SettingsForm : UserControl
    {
        public event EventHandler? CloseRequested;
        public event EventHandler<string>? LlmServiceChanged;   //!< LLMサービス変更イベント
        public event EventHandler<MascotModel> MascotChanged;

        // Callback that returns a clone of the current mascot image when requested
        public Func<Image?>? GetMascotImage { get; set; }

        public SettingsForm()
        {
            InitializeComponent();

            // リスナの設定
            mascotPropertyPage.MascotChanged += (s, e) => MascotChanged?.Invoke(this, e);
            chatAiPropertyPage.LlmServiceChanged += (s, e) => LlmServiceChanged?.Invoke(this, e);

            // Select the first item by default to ensure a page is shown
             if (categorySelectionList.Items.Count > 0)
            {
                categorySelectionList.SelectedIndex = 0;
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

        private void SettingsForm_Resize(object? sender, EventArgs e)
        {
        }

        /// <summary>
        /// 設定リスト：現在選択項目の変更イベント
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        private void categorySelectionList_SelectedIndexChanged(object sender, EventArgs e)
        {
            var list = (ListBox)sender;
            
            // Hide all pages first
            mascotPropertyPage.Visible = false;
            chatAiPropertyPage.Visible = false;
            voiceAiPropertyPage.Visible = false;
            imageAiPropertyPage.Visible = false;
            movieAiPropertyPage.Visible = false;
            apiKeyPropertyPage.Visible = false;

            mascotPropertyPage.Dock = DockStyle.None;
            chatAiPropertyPage.Dock = DockStyle.None;
            voiceAiPropertyPage.Dock = DockStyle.None;
            imageAiPropertyPage.Dock = DockStyle.None;
            movieAiPropertyPage.Dock = DockStyle.None;
            apiKeyPropertyPage.Dock = DockStyle.None;

            Control? visibleControl = null;

            switch (list.SelectedIndex)
            {
                case 0: visibleControl = mascotPropertyPage; break;
                case 1: visibleControl = chatAiPropertyPage; break;
                case 2: visibleControl = voiceAiPropertyPage; break;
                case 3: visibleControl = imageAiPropertyPage; break;
                case 4: visibleControl = movieAiPropertyPage; break;
                case 5: visibleControl = apiKeyPropertyPage; break;
            }

            if (visibleControl != null)
            {
                visibleControl.Visible = true;
                visibleControl.Dock = DockStyle.Fill;
            }
        }
    }
}
