using System;
using System.Drawing;
using System.Windows.Forms;

namespace DesktopAiMascot.Views
{
    public partial class ApiKeyPropertyPage : UserControl
    {
        public ApiKeyPropertyPage()
        {
            InitializeComponent();
            LoadApiKeyToUI();
        }

        private void saveApiKeyButton_Click(object? sender, EventArgs e)
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
                MessageBox.Show("API key saved.", "Settings", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to save API key: {ex.Message}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void clearApiKeyButton_Click(object? sender, EventArgs e)
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
                MessageBox.Show($"Failed to clear API key: {ex.Message}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
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
