using System;
using System.Drawing;
using System.Windows.Forms;
using DesktopAiMascot.aiservice;

namespace DesktopAiMascot.Views
{
    public partial class ChatAiPropertyPage : UserControl
    {
        public event EventHandler<string>? LlmServiceChanged;

        public ChatAiPropertyPage()
        {
            InitializeComponent();
            PopulateLlmEngineCombo();
        }

        private void llmAiEngineComboBox_SelectedIndexChanged(object? sender, EventArgs e)
        {
            if (llmAiEngineComboBox.SelectedValue is string llmName)
            {
                SystemConfig.Instance.LlmService = llmName;
                SystemConfig.Instance.Save();

                // 変更イベントを発行
                LlmServiceChanged?.Invoke(this, llmName);
            }
        }

        // LLMエンジンコンボボックスの初期化
        private void PopulateLlmEngineCombo()
        {
            try
            {
                // イベントハンドラを一時的に解除
                llmAiEngineComboBox.SelectedIndexChanged -= llmAiEngineComboBox_SelectedIndexChanged;

                // バインディング設定
                llmAiEngineComboBox.DataSource = LlmManager.GetAvailableLlmServices;
                llmAiEngineComboBox.DisplayMember = "Name";
                llmAiEngineComboBox.ValueMember = "Name";

                // 現在の設定を選択
                string currentLlm = SystemConfig.Instance.LlmService;
                llmAiEngineComboBox.SelectedValue = currentLlm;

                // もし選択できていなければデフォルト(0番目)を選択
                if (llmAiEngineComboBox.SelectedIndex < 0 && llmAiEngineComboBox.Items.Count > 0)
                {
                    llmAiEngineComboBox.SelectedIndex = 0;
                }

                // イベントハンドラを再設定
                llmAiEngineComboBox.SelectedIndexChanged += llmAiEngineComboBox_SelectedIndexChanged;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error populating LLM engine combo: {ex.Message}");
            }
        }
    }
}
