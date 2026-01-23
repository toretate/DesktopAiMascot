using System;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;
using DesktopAiMascot.aiservice;

namespace DesktopAiMascot.Views
{
    public partial class VoiceAiPropertyPage : UserControl
    {
        public VoiceAiPropertyPage()
        {
            InitializeComponent();
            PopulateVoiceAiCombo();
        }

        private void voiceAiComboBox_SelectedIndexChanged(object? sender, EventArgs e)
        {
            if (voiceAiComboBox.SelectedValue is string voiceName)
            {
                SystemConfig.Instance.VoiceService = voiceName;
                SystemConfig.Instance.Save();

                // VoiceAiManager に即時反映
                if (VoiceAiManager.Instance.VoiceAiServices.TryGetValue(voiceName, out var service))
                {
                    VoiceAiManager.Instance.CurrentService = service;
                }
            }
        }

        // Voice AIエンジンコンボボックスの初期化
        private void PopulateVoiceAiCombo()
        {
            try
            {
                // イベントハンドラを一時的に解除
                voiceAiComboBox.SelectedIndexChanged -= voiceAiComboBox_SelectedIndexChanged;

                // バインディング設定
                voiceAiComboBox.DataSource = VoiceAiManager.Instance.VoiceAiServices.Values.ToList();
                voiceAiComboBox.DisplayMember = "Name";
                voiceAiComboBox.ValueMember = "Name";

                // 現在の設定を選択
                string currentVoice = SystemConfig.Instance.VoiceService;
                voiceAiComboBox.SelectedValue = currentVoice;

                // もし選択できていなければデフォルト(0番目)を選択
                if (voiceAiComboBox.SelectedIndex < 0 && voiceAiComboBox.Items.Count > 0)
                {
                    voiceAiComboBox.SelectedIndex = 0;
                }

                // イベントハンドラを再設定
                voiceAiComboBox.SelectedIndexChanged += voiceAiComboBox_SelectedIndexChanged;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error populating Voice AI combo: {ex.Message}");
            }
        }
    }
}
