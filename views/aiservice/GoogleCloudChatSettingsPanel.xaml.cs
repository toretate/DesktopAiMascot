using System;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.aiservice.chat;
using System.Diagnostics;

namespace DesktopAiMascot.views.aiservice
{
    /// <summary>
    /// Google Cloud (Vertex AI) ChatAI サービス用の設定UI
    /// </summary>
    public partial class GoogleCloudChatSettingsPanel : System.Windows.Controls.UserControl
    {
        // モデル一覧更新イベント
        public event EventHandler? ModelsUpdating;
        public event EventHandler<ModelsUpdatedEventArgs>? ModelsUpdated;

        public GoogleCloudChatSettingsPanel()
        {
            InitializeComponent();
            
            // 保存済みの設定を読み込む
            LoadApiKey();
            if (!string.IsNullOrWhiteSpace(SystemConfig.Instance.GoogleCloudProjectId))
            {
                projectIdTextField.Text = SystemConfig.Instance.GoogleCloudProjectId;
            }
            if (!string.IsNullOrWhiteSpace(SystemConfig.Instance.GoogleCloudRegion))
            {
                regionTextField.Text = SystemConfig.Instance.GoogleCloudRegion;
            }
        }

        /// <summary>
        /// 保存済みの API Key を TextBox に読み込む
        /// </summary>
        private void LoadApiKey()
        {
            try
            {
                if (SystemConfig.Instance.ApiKeys.ContainsKey("GoogleCloudApiKey"))
                {
                    var apiKey = SystemConfig.Instance.ApiKeys["GoogleCloudApiKey"];
                    apiKeyTextBox.Text = apiKey ?? "";
                    Debug.WriteLine("[GoogleCloudChatSettingsPanel] API Key loaded from SystemConfig");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[GoogleCloudChatSettingsPanel] Error loading API Key: {ex.Message}");
            }
        }

        /// <summary>
        /// Project ID が変更されたときの処理
        /// </summary>
        private void ProjectIdTextField_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!string.IsNullOrWhiteSpace(projectIdTextField.Text))
            {
                SystemConfig.Instance.GoogleCloudProjectId = projectIdTextField.Text;
                SystemConfig.Instance.Save();
                Debug.WriteLine($"[GoogleCloudChatSettingsPanel] Saved Project ID: {projectIdTextField.Text}");
            }
        }

        /// <summary>
        /// リージョンが変更されたときの処理
        /// </summary>
        private void RegionTextField_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!string.IsNullOrWhiteSpace(regionTextField.Text))
            {
                SystemConfig.Instance.GoogleCloudRegion = regionTextField.Text;
                SystemConfig.Instance.Save();
                Debug.WriteLine($"[GoogleCloudChatSettingsPanel] Saved Region: {regionTextField.Text}");
            }
        }

        /// <summary>
        /// 利用可能なモデルを非同期で読み込み、コンボボックスを更新する
        /// </summary>
        public async void UpdateModelList(string serviceName)
        {
            chatAiModelComboBox.IsEnabled = false;

            // 更新開始イベントを発火
            ModelsUpdating?.Invoke(this, EventArgs.Empty);

            try
            {
                var service = LlmManager.CreateService(serviceName);
                if (service != null)
                {
                    var models = await service.GetAvailableModels(false);
                    
                    if (models != null && models.Length > 0)
                    {
                        chatAiModelComboBox.ItemsSource = models;
                        
                        string currentModelId = SystemConfig.Instance.ModelName;
                        
                        // IDで一致するモデルを探す
                        var match = models.FirstOrDefault(m => string.Equals(m.Id, currentModelId, StringComparison.OrdinalIgnoreCase));
                        if (match != null)
                        {
                            chatAiModelComboBox.SelectedItem = match;
                            Debug.WriteLine($"[GoogleCloudChatSettingsPanel] Selected model: {match.DisplayName} (ID: {match.Id})");
                        }
                        else 
                        {
                            chatAiModelComboBox.SelectedIndex = 0;
                            Debug.WriteLine($"[GoogleCloudChatSettingsPanel] Model ID '{currentModelId}' not found, selecting first model");
                        }
                        
                        // 更新完了イベントを発火
                        ModelsUpdated?.Invoke(this, new ModelsUpdatedEventArgs(true, models.Length, null));
                    }
                    else
                    {
                        chatAiModelComboBox.ItemsSource = null;
                        Debug.WriteLine($"[GoogleCloudChatSettingsPanel] No models available for service: {serviceName}");
                        ModelsUpdated?.Invoke(this, new ModelsUpdatedEventArgs(false, 0, "モデルが見つかりません"));
                    }
                }
                else
                {
                    Debug.WriteLine($"[GoogleCloudChatSettingsPanel] Failed to create service: {serviceName}");
                    ModelsUpdated?.Invoke(this, new ModelsUpdatedEventArgs(false, 0, "サービスの作成に失敗しました"));
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[GoogleCloudChatSettingsPanel] Failed to update model list: {ex.Message}");
                System.Windows.MessageBox.Show($"モデル一覧の取得に失敗しました。\nAPI キー、Project ID、リージョンが正しいか確認してください。\n\n{ex.Message}", 
                    "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
                ModelsUpdated?.Invoke(this, new ModelsUpdatedEventArgs(false, 0, ex.Message));
            }
            finally
            {
                chatAiModelComboBox.IsEnabled = true;
            }
        }

        private void ChatAiModelComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (chatAiModelComboBox.SelectedItem is ModelDisplayItem modelItem)
            {
                // IDを保存（表示名ではなくモデルIDを保存）
                SystemConfig.Instance.ModelName = modelItem.Id;
                SystemConfig.Instance.Save();
                Debug.WriteLine($"[GoogleCloudChatSettingsPanel] Saved model ID: {modelItem.Id} (Display: {modelItem.DisplayName})");
            }
        }

        /// <summary>
        /// 更新ボタンをクリックしたときの処理
        /// </summary>
        private void RefreshModelsButton_Click(object sender, RoutedEventArgs e)
        {
            UpdateModelList("Gemini (Google Cloud)");
        }

        /// <summary>
        /// API Key TextBox がフォーカスを失ったときの処理
        /// </summary>
        private void ApiKeyTextBox_LostFocus(object sender, RoutedEventArgs e)
        {
            try
            {
                var apiKey = apiKeyTextBox.Text?.Trim();
                
                // SystemConfig に保存
                if (SystemConfig.Instance.ApiKeys.ContainsKey("GoogleCloudApiKey"))
                {
                    SystemConfig.Instance.ApiKeys["GoogleCloudApiKey"] = apiKey ?? "";
                }
                else
                {
                    SystemConfig.Instance.ApiKeys.Add("GoogleCloudApiKey", apiKey ?? "");
                }
                
                SystemConfig.Instance.Save();
                Debug.WriteLine("[GoogleCloudChatSettingsPanel] API Key saved to SystemConfig");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[GoogleCloudChatSettingsPanel] Error saving API Key: {ex.Message}");
            }
        }
    }
}
