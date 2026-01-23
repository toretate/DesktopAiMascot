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
            chatAiModelComboBox.SelectedIndexChanged += chatAiModelComboBox_SelectedIndexChanged;
            PopulateLlmEngineCombo();
        }

        private void chatAiModelComboBox_SelectedIndexChanged(object? sender, EventArgs e)
        {
            // DataSourceを使っている場合、SelectedItem は string そのものになる
            if (chatAiModelComboBox.SelectedItem is string modelName)
            {
                SystemConfig.Instance.ModelName = modelName;
                SystemConfig.Instance.Save();
            }
        }

        private void llmAiEngineComboBox_SelectedIndexChanged(object? sender, EventArgs e)
        {
            if (llmAiEngineComboBox.SelectedValue is string llmName)
            {
                SystemConfig.Instance.LlmService = llmName;
                SystemConfig.Instance.Save();

                // 変更イベントを発行
                LlmServiceChanged?.Invoke(this, llmName);
                
                // モデルリストを更新
                UpdateModelList(llmName);
            }
        }
        
        private async void UpdateModelList(string serviceName)
        {
            chatAiModelComboBox.Enabled = false;
            try
            {
                var service = LlmManager.CreateService(serviceName);
                if (service != null && !string.IsNullOrEmpty(service.EndPoint))
                {
                    chatAiUrlTextField.Text = service.EndPoint;
                    
                    var models = await service.GetAvailableModels(false);
                    
                    if (models != null && models.Length > 0)
                    {
                        chatAiModelComboBox.DataSource = models;
                        
                        string current = SystemConfig.Instance.ModelName;
                        // 大文字小文字を区別せず検索
                        var match = models.FirstOrDefault(m => string.Equals(m, current, StringComparison.OrdinalIgnoreCase));
                        if (match != null)
                        {
                            chatAiModelComboBox.SelectedItem = match;
                        }
                        else 
                        {
                             chatAiModelComboBox.SelectedIndex = 0;
                        }
                    }
                    else
                    {
                        chatAiModelComboBox.DataSource = null;
                        chatAiModelComboBox.Items.Clear();
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to update model list: {ex.Message}");
            }
            finally
            {
                chatAiModelComboBox.Enabled = true;
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
                    currentLlm = (string)llmAiEngineComboBox.SelectedValue;
                }

                // イベントハンドラを再設定
                llmAiEngineComboBox.SelectedIndexChanged += llmAiEngineComboBox_SelectedIndexChanged;
                
                // 初回モデルリスト更新
                UpdateModelList(currentLlm);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error populating LLM engine combo: {ex.Message}");
            }
        }
    }
}
