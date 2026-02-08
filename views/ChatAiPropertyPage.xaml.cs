using System;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.aiservice.chat;
using System.Diagnostics;

namespace DesktopAiMascot.views
{
    public partial class ChatAiPropertyPage : System.Windows.Controls.UserControl
    {
        public event EventHandler<string>? LlmServiceChanged;

        public ChatAiPropertyPage()
        {
            InitializeComponent();
            PopulateLlmEngineCombo();
        }

        private void LlmAiEngineComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            var selectedItem = llmAiEngineComboBox.SelectedItem;
            if (selectedItem != null)
            {
                var nameProperty = selectedItem.GetType().GetProperty("Name");
                if (nameProperty != null)
                {
                    var llmName = nameProperty.GetValue(selectedItem)?.ToString();
                    if (!string.IsNullOrEmpty(llmName))
                    {
                        SystemConfig.Instance.LlmService = llmName;
                        SystemConfig.Instance.Save();
                        LlmServiceChanged?.Invoke(this, llmName);
                        
                        // サービスに応じてUIを切り替え
                        SwitchServicePanel(llmName);
                    }
                }
            }
        }

        /// <summary>
        /// 選択されたサービスに応じてUIパネルを切り替える
        /// </summary>
        private void SwitchServicePanel(string serviceName)
        {
            // すべてのパネルを非表示
            lmStudioPanel.Visibility = Visibility.Collapsed;
            foundryLocalPanel.Visibility = Visibility.Collapsed;
            googleAiStudioPanel.Visibility = Visibility.Collapsed;
            googleCloudPanel.Visibility = Visibility.Collapsed;

            // 選択されたサービスに応じてパネルを表示
            switch (serviceName)
            {
                case "LM Studio":
                    lmStudioPanel.Visibility = Visibility.Visible;
                    lmStudioPanel.UpdateModelList(serviceName);
                    break;

                case "Foundry Local":
                    foundryLocalPanel.Visibility = Visibility.Visible;
                    break;

                case "Gemini (AI Studio)":
                    googleAiStudioPanel.Visibility = Visibility.Visible;
                    googleAiStudioPanel.UpdateModelList(serviceName);
                    break;

                case "Gemini (Google Cloud)":
                    googleCloudPanel.Visibility = Visibility.Visible;
                    googleCloudPanel.UpdateModelList(serviceName);
                    break;
            }
        }

        private void PopulateLlmEngineCombo()
        {
            try
            {
                llmAiEngineComboBox.SelectionChanged -= LlmAiEngineComboBox_SelectionChanged;

                var serviceTable = LlmManager.GetAvailableLlmServices;
                var services = new System.Collections.Generic.List<LlmServiceInfo>();
                foreach (System.Data.DataRow row in serviceTable.Rows)
                {
                    services.Add(new LlmServiceInfo { Name = row["Name"]?.ToString() ?? "" });
                }
                llmAiEngineComboBox.ItemsSource = services;

                string currentLlm = SystemConfig.Instance.LlmService;
                var matchingService = services.FirstOrDefault(s => s.Name == currentLlm);
                if (matchingService != null)
                {
                    llmAiEngineComboBox.SelectedItem = matchingService;
                }
                else if (services.Count > 0)
                {
                    llmAiEngineComboBox.SelectedIndex = 0;
                    currentLlm = services[0].Name;
                }

                llmAiEngineComboBox.SelectionChanged += LlmAiEngineComboBox_SelectionChanged;
                
                if (!string.IsNullOrEmpty(currentLlm))
                {
                    SwitchServicePanel(currentLlm);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error populating LLM engine combo: {ex.Message}");
            }
        }
    }

    public class LlmServiceInfo
    {
        public string Name { get; set; } = "";
    }
}

