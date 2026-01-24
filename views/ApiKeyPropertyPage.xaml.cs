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
            LoadApiKeyToUI();
        }

        private void SaveApiKeyButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                var apiKey = apiKeyTextBox.Text?.Trim();
                if (SystemConfig.Instance.ApiKeys.ContainsKey("GoogleApiKey"))
                {
                    SystemConfig.Instance.ApiKeys.Remove("GoogleApiKey");
                }
                SystemConfig.Instance.ApiKeys.Add("GoogleApiKey", apiKey ?? "");
                SystemConfig.Instance.Save();
                System.Windows.MessageBox.Show("API key saved.", "Settings", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Failed to save API key: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void ClearApiKeyButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                apiKeyTextBox.Text = string.Empty;
                if (SystemConfig.Instance.ApiKeys.ContainsKey("GoogleApiKey"))
                {
                    SystemConfig.Instance.ApiKeys.Remove("GoogleApiKey");
                }
                SystemConfig.Instance.Save();
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Failed to clear API key: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void LoadApiKeyToUI()
        {
            try
            {
                string apiKey;
                SystemConfig.Instance.ApiKeys.TryGetValue("GoogleApiKey", out apiKey);
                apiKeyTextBox.Text = apiKey;
            }
            catch
            {
                // ignore
            }
        }
    }
}

