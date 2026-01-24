using System;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using DesktopAiMascot.aiservice;
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

        private void ChatAiModelComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (chatAiModelComboBox.SelectedItem is string modelName)
            {
                SystemConfig.Instance.ModelName = modelName;
                SystemConfig.Instance.Save();
            }
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
                        UpdateModelList(llmName);
                    }
                }
            }
        }
        
        private async void UpdateModelList(string serviceName)
        {
            chatAiModelComboBox.IsEnabled = false;
            try
            {
                var service = LlmManager.CreateService(serviceName);
                if (service != null && !string.IsNullOrEmpty(service.EndPoint))
                {
                    chatAiUrlTextField.Text = service.EndPoint;
                    
                    var models = await service.GetAvailableModels(false);
                    
                    if (models != null && models.Length > 0)
                    {
                        chatAiModelComboBox.ItemsSource = models;
                        
                        string current = SystemConfig.Instance.ModelName;
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
                        chatAiModelComboBox.ItemsSource = null;
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to update model list: {ex.Message}");
            }
            finally
            {
                chatAiModelComboBox.IsEnabled = true;
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
                    UpdateModelList(currentLlm);
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
