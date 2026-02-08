using System;
using System.Windows;
using System.Windows.Controls;
using DesktopAiMascot.aiservice;
using System.Diagnostics;

namespace DesktopAiMascot.views.aiservice
{
    /// <summary>
    /// Foundry Local ChatAI サービス用の設定UI
    /// </summary>
    public partial class FoundryLocalChatSettingsPanel : System.Windows.Controls.UserControl
    {
        public FoundryLocalChatSettingsPanel()
        {
            InitializeComponent();
            
            // 保存済みの設定を読み込む
            if (!string.IsNullOrWhiteSpace(SystemConfig.Instance.ChatAiEndpoint))
            {
                endpointTextField.Text = SystemConfig.Instance.ChatAiEndpoint;
            }
            if (!string.IsNullOrWhiteSpace(SystemConfig.Instance.ModelName))
            {
                modelNameTextField.Text = SystemConfig.Instance.ModelName;
            }
        }

        /// <summary>
        /// エンドポイント URL が変更されたときの処理
        /// </summary>
        private void EndpointTextField_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!string.IsNullOrWhiteSpace(endpointTextField.Text))
            {
                SystemConfig.Instance.ChatAiEndpoint = endpointTextField.Text;
                SystemConfig.Instance.Save();
                Debug.WriteLine($"[FoundryLocalChatSettingsPanel] Saved endpoint: {endpointTextField.Text}");
            }
        }

        /// <summary>
        /// モデル名 / エンドポイントが変更されたときの処理
        /// </summary>
        private void ModelNameTextField_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!string.IsNullOrWhiteSpace(modelNameTextField.Text))
            {
                SystemConfig.Instance.ModelName = modelNameTextField.Text;
                SystemConfig.Instance.Save();
                Debug.WriteLine($"[FoundryLocalChatSettingsPanel] Saved model/endpoint: {modelNameTextField.Text}");
            }
        }
    }
}
