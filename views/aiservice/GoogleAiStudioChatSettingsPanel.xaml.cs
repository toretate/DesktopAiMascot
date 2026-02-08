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
    /// Google AI Studio (Gemini) ChatAI サービス用の設定UI
    /// </summary>
    public partial class GoogleAiStudioChatSettingsPanel : System.Windows.Controls.UserControl
    {
        // モデル一覧更新イベント
        public event EventHandler? ModelsUpdating;
        public event EventHandler<ModelsUpdatedEventArgs>? ModelsUpdated;

        public GoogleAiStudioChatSettingsPanel()
        {
            InitializeComponent();
            
            // 保存済みの API Key を読み込む
            LoadApiKey();
        }

        /// <summary>
        /// 保存済みの API Key を TextBox に読み込む
        /// </summary>
        private void LoadApiKey()
        {
            try
            {
                if (SystemConfig.Instance.ApiKeys.ContainsKey("GoogleAiStudioApiKey"))
                {
                    var apiKey = SystemConfig.Instance.ApiKeys["GoogleAiStudioApiKey"];
                    apiKeyTextBox.Text = apiKey ?? "";
                    Debug.WriteLine("[GoogleAiStudioChatSettingsPanel] API Key loaded from SystemConfig");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[GoogleAiStudioChatSettingsPanel] Error loading API Key: {ex.Message}");
            }
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
                if (SystemConfig.Instance.ApiKeys.ContainsKey("GoogleAiStudioApiKey"))
                {
                    SystemConfig.Instance.ApiKeys["GoogleAiStudioApiKey"] = apiKey ?? "";
                }
                else
                {
                    SystemConfig.Instance.ApiKeys.Add("GoogleAiStudioApiKey", apiKey ?? "");
                }
                
                SystemConfig.Instance.Save();
                Debug.WriteLine("[GoogleAiStudioChatSettingsPanel] API Key saved to SystemConfig");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[GoogleAiStudioChatSettingsPanel] Error saving API Key: {ex.Message}");
            }
        }

        /// <summary>
        /// 利用可能なモデルを非同期で読み込み、コンボボックスを更新する
        /// </summary>
        public async void UpdateModelList(string serviceName)
        {
            chatAiModelComboBox.IsEnabled = false;
            refreshModelsButton.IsEnabled = false;

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
                        // フィルタリングを適用
                        var filteredModels = FilterModelsCheckBox.IsChecked == true
                            ? FilterChatModels(models)
                            : models;
                        
                        chatAiModelComboBox.ItemsSource = filteredModels;
                        
                        string currentModelId = SystemConfig.Instance.ModelName;
                        
                        // IDで一致するモデルを探す
                        var match = filteredModels.FirstOrDefault(m => string.Equals(m.Id, currentModelId, StringComparison.OrdinalIgnoreCase));
                        if (match != null)
                        {
                            chatAiModelComboBox.SelectedItem = match;
                            Debug.WriteLine($"[GoogleAiStudioChatSettingsPanel] Selected model: {match.DisplayName} (ID: {match.Id})");
                        }
                        else 
                        {
                            chatAiModelComboBox.SelectedIndex = 0;
                            Debug.WriteLine($"[GoogleAiStudioChatSettingsPanel] Model ID '{currentModelId}' not found, selecting first model");
                        }
                        
                        // 更新完了イベントを発火
                        ModelsUpdated?.Invoke(this, new ModelsUpdatedEventArgs(true, filteredModels.Length, null));
                    }
                    else
                    {
                        chatAiModelComboBox.ItemsSource = null;
                        Debug.WriteLine($"[GoogleAiStudioChatSettingsPanel] No models available for service: {serviceName}");
                        ModelsUpdated?.Invoke(this, new ModelsUpdatedEventArgs(false, 0, "モデルが見つかりません"));
                    }
                }
                else
                {
                    Debug.WriteLine($"[GoogleAiStudioChatSettingsPanel] Failed to create service: {serviceName}");
                    ModelsUpdated?.Invoke(this, new ModelsUpdatedEventArgs(false, 0, "サービスの作成に失敗しました"));
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[GoogleAiStudioChatSettingsPanel] Failed to update model list: {ex.Message}");
                System.Windows.MessageBox.Show($"モデル一覧の取得に失敗しました。\nAPI キーが正しいか確認してください。\n\n{ex.Message}", 
                    "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
                ModelsUpdated?.Invoke(this, new ModelsUpdatedEventArgs(false, 0, ex.Message));
            }
            finally
            {
                chatAiModelComboBox.IsEnabled = true;
                refreshModelsButton.IsEnabled = true;
            }
        }

        /// <summary>
        /// チャット以外のモデル（画像生成、TTS等）をフィルタリング
        /// </summary>
        private ModelDisplayItem[] FilterChatModels(ModelDisplayItem[] allModels)
        {
            var chatOnlyModels = allModels
                .Where(m => !IsChatExclusiveModel(m.Id))
                .ToArray();
            
            Debug.WriteLine($"[GoogleAiStudioChatSettingsPanel] Filtered models: {allModels.Length} → {chatOnlyModels.Length}");
            return chatOnlyModels;
        }

        /// <summary>
        /// チャット用途ではないモデルを判定
        /// </summary>
        private bool IsChatExclusiveModel(string modelId)
        {
            var lowerModelId = modelId.ToLower();
            
            // 画像生成モデル
            if (lowerModelId.Contains("imagen"))
                return true;
            
            // テキスト音声変換モデル
            if (lowerModelId.Contains("speech") || lowerModelId.Contains("tts"))
                return true;
            
            // 埋め込みモデル
            if (lowerModelId.Contains("embedding"))
                return true;
            
            // その他のマルチモーダルモデル（生成以外）
            if (lowerModelId.Contains("retrieval") || lowerModelId.Contains("indexing"))
                return true;
            
            return false;
        }

        private void ChatAiModelComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (chatAiModelComboBox.SelectedItem is ModelDisplayItem modelItem)
            {
                // IDを保存（表示名ではなくモデルIDを保存）
                SystemConfig.Instance.ModelName = modelItem.Id;
                SystemConfig.Instance.Save();
                Debug.WriteLine($"[GoogleAiStudioChatSettingsPanel] Saved model ID: {modelItem.Id} (Display: {modelItem.DisplayName})");
            }
        }

        private void RefreshModelsButton_Click(object sender, RoutedEventArgs e)
        {
            UpdateModelList("Gemini (AI Studio)");
        }

        /// <summary>
        /// フィルタリングチェックボックスが変更されたときの処理
        /// </summary>
        private void FilterModelsCheckBox_Changed(object sender, RoutedEventArgs e)
        {
            // InitializeComponent() 中にイベントが発火した場合、chatAiModelComboBox はまだ null なのでスキップ
            if (chatAiModelComboBox == null)
            {
                return;
            }

            // 現在のモデルソースを再フィルタリング
            if (chatAiModelComboBox.ItemsSource is ModelDisplayItem[] allModels)
            {
                var filteredModels = FilterModelsCheckBox.IsChecked == true
                    ? FilterChatModels(allModels)
                    : allModels;
                
                chatAiModelComboBox.ItemsSource = filteredModels;
                
                // 現在選択されているモデルが残っていない場合は最初のモデルを選択
                if (chatAiModelComboBox.SelectedItem == null && filteredModels.Length > 0)
                {
                    chatAiModelComboBox.SelectedIndex = 0;
                }
                
                Debug.WriteLine($"[GoogleAiStudioChatSettingsPanel] Filter changed: {(FilterModelsCheckBox.IsChecked == true ? "enabled" : "disabled")}");
            }
        }
    }
}
