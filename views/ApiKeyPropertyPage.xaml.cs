using System;
using System.Windows;
using System.Windows.Controls;

namespace DesktopAiMascot.views
{
    public partial class ApiKeyPropertyPage : System.Windows.Controls.UserControl
    {
        public ApiKeyPropertyPage()
        {
            InitializeComponent();
            LoadApiKeysToUI();
        }

        private void SaveAiStudioButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                var apiKey = aiStudioApiKeyTextBox.Text?.Trim();
                
                if (SystemConfig.Instance.ApiKeys.ContainsKey("GoogleAiStudioApiKey"))
                {
                    SystemConfig.Instance.ApiKeys.Remove("GoogleAiStudioApiKey");
                }
                SystemConfig.Instance.ApiKeys.Add("GoogleAiStudioApiKey", apiKey ?? "");
                
                SystemConfig.Instance.Save();
                System.Windows.MessageBox.Show("Google AI Studio API key saved.", "Settings", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Failed to save API key: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void ClearAiStudioButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                aiStudioApiKeyTextBox.Text = string.Empty;
                
                if (SystemConfig.Instance.ApiKeys.ContainsKey("GoogleAiStudioApiKey"))
                {
                    SystemConfig.Instance.ApiKeys.Remove("GoogleAiStudioApiKey");
                }
                SystemConfig.Instance.Save();
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Failed to clear API key: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void SaveCloudButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                var apiKey = cloudApiKeyTextBox.Text?.Trim();
                var projectId = projectIdTextBox.Text?.Trim();
                var region = regionTextBox.Text?.Trim();
                
                if (SystemConfig.Instance.ApiKeys.ContainsKey("GoogleCloudApiKey"))
                {
                    SystemConfig.Instance.ApiKeys.Remove("GoogleCloudApiKey");
                }
                SystemConfig.Instance.ApiKeys.Add("GoogleCloudApiKey", apiKey ?? "");
                
                if (SystemConfig.Instance.ApiKeys.ContainsKey("GoogleProjectId"))
                {
                    SystemConfig.Instance.ApiKeys.Remove("GoogleProjectId");
                }
                SystemConfig.Instance.ApiKeys.Add("GoogleProjectId", projectId ?? "");
                
                if (SystemConfig.Instance.ApiKeys.ContainsKey("GoogleRegion"))
                {
                    SystemConfig.Instance.ApiKeys.Remove("GoogleRegion");
                }
                SystemConfig.Instance.ApiKeys.Add("GoogleRegion", region ?? "us-central1");
                
                SystemConfig.Instance.Save();
                System.Windows.MessageBox.Show("Google Cloud configuration saved.", "Settings", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Failed to save configuration: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void ClearCloudButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                cloudApiKeyTextBox.Text = string.Empty;
                projectIdTextBox.Text = string.Empty;
                regionTextBox.Text = "us-central1";
                
                if (SystemConfig.Instance.ApiKeys.ContainsKey("GoogleCloudApiKey"))
                {
                    SystemConfig.Instance.ApiKeys.Remove("GoogleCloudApiKey");
                }
                if (SystemConfig.Instance.ApiKeys.ContainsKey("GoogleProjectId"))
                {
                    SystemConfig.Instance.ApiKeys.Remove("GoogleProjectId");
                }
                if (SystemConfig.Instance.ApiKeys.ContainsKey("GoogleRegion"))
                {
                    SystemConfig.Instance.ApiKeys.Remove("GoogleRegion");
                }
                SystemConfig.Instance.Save();
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Failed to clear configuration: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void LoadApiKeysToUI()
        {
            try
            {
                // Load AI Studio API Key
                string aiStudioApiKey;
                SystemConfig.Instance.ApiKeys.TryGetValue("GoogleAiStudioApiKey", out aiStudioApiKey);
                aiStudioApiKeyTextBox.Text = aiStudioApiKey;
                
                // Load Google Cloud API Key
                string cloudApiKey;
                SystemConfig.Instance.ApiKeys.TryGetValue("GoogleCloudApiKey", out cloudApiKey);
                cloudApiKeyTextBox.Text = cloudApiKey;
                
                // Load Project ID
                string projectId;
                SystemConfig.Instance.ApiKeys.TryGetValue("GoogleProjectId", out projectId);
                projectIdTextBox.Text = projectId;
                
                // Load Region
                string region;
                if (SystemConfig.Instance.ApiKeys.TryGetValue("GoogleRegion", out region))
                {
                    regionTextBox.Text = region;
                }
                else
                {
                    regionTextBox.Text = "us-central1";
                }
            }
            catch
            {
                // ignore
            }
        }
    }
}



