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
    /// LM Studio ChatAI サービス用の設定UI
    /// </summary>
    public partial class LmStudioChatSettingsPanel : System.Windows.Controls.UserControl
    {
        // モデル一覧更新イベント
        public event EventHandler? ModelsUpdating;
        public event EventHandler<ModelsUpdatedEventArgs>? ModelsUpdated;

        public LmStudioChatSettingsPanel()
        {
            InitializeComponent();
            
            // 起動時にサーバー状態を確認
            _ = CheckServerStatusAsync();
        }

        /// <summary>
        /// サーバー状態を確認して表示を更新する
        /// </summary>
        private async Task CheckServerStatusAsync()
        {
            try
            {
                serverStatusTextBlock.Text = "接続確認中...";
                serverStatusTextBlock.Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Colors.Gray);

                var service = new LmStudioChatService(endpointTextField.Text);
                bool isAvailable = await service.IsServerAvailableAsync();

                if (isAvailable)
                {
                    serverStatusTextBlock.Text = "✓ オンライン";
                    serverStatusTextBlock.Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Colors.Green);
                    Debug.WriteLine("[LmStudioChatSettingsPanel] Server is online");
                }
                else
                {
                    serverStatusTextBlock.Text = "✗ オフライン";
                    serverStatusTextBlock.Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Colors.Red);
                    Debug.WriteLine("[LmStudioChatSettingsPanel] Server is offline");
                }
            }
            catch (Exception ex)
            {
                serverStatusTextBlock.Text = "✗ エラー";
                serverStatusTextBlock.Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Colors.Red);
                Debug.WriteLine($"[LmStudioChatSettingsPanel] Error checking server status: {ex.Message}");
            }
        }

        /// <summary>
        /// エンドポイントが変更されたときの処理
        /// </summary>
        private void EndpointTextField_TextChanged(object sender, TextChangedEventArgs e)
        {
            // エンドポイント変更時に設定を保存
            if (!string.IsNullOrWhiteSpace(endpointTextField.Text))
            {
                SystemConfig.Instance.ChatAiEndpoint = endpointTextField.Text;
                SystemConfig.Instance.Save();
                Debug.WriteLine($"[LmStudioChatSettingsPanel] Saved endpoint: {endpointTextField.Text}");
            }
            
            // エンドポイント変更時にサーバー状態を確認
            _ = CheckServerStatusAsync();
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
                    // エンドポイントが設定されていれば適用
                    if (!string.IsNullOrWhiteSpace(endpointTextField.Text))
                    {
                        service.EndPoint = endpointTextField.Text;
                    }

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
                            Debug.WriteLine($"[LmStudioChatSettingsPanel] Selected model: {match.DisplayName} (ID: {match.Id})");
                        }
                        else 
                        {
                            chatAiModelComboBox.SelectedIndex = 0;
                            Debug.WriteLine($"[LmStudioChatSettingsPanel] Model ID '{currentModelId}' not found, selecting first model");
                        }
                        
                        // 更新完了イベントを発火
                        ModelsUpdated?.Invoke(this, new ModelsUpdatedEventArgs(true, models.Length, null));
                    }
                    else
                    {
                        chatAiModelComboBox.ItemsSource = null;
                        Debug.WriteLine($"[LmStudioChatSettingsPanel] No models available for service: {serviceName}");
                        
                        // 更新完了イベントを発火
                        ModelsUpdated?.Invoke(this, new ModelsUpdatedEventArgs(false, 0, "モデルが見つかりません"));
                    }
                }
                else
                {
                    Debug.WriteLine($"[LmStudioChatSettingsPanel] Failed to create service: {serviceName}");
                    ModelsUpdated?.Invoke(this, new ModelsUpdatedEventArgs(false, 0, "サービスの作成に失敗しました"));
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[LmStudioChatSettingsPanel] Failed to update model list: {ex.Message}");
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
                Debug.WriteLine($"[LmStudioChatSettingsPanel] Saved model ID: {modelItem.Id} (Display: {modelItem.DisplayName})");
            }
        }

        /// <summary>
        /// 更新ボタンをクリックしたときの処理
        /// サーバー状態確認とモデル一覧更新の両方を実行
        /// </summary>
        private async void UpdateButton_Click(object sender, RoutedEventArgs e)
        {
            // サーバー状態を確認
            await CheckServerStatusAsync();
            
            // モデル一覧を更新
            UpdateModelList("LM Studio");
        }
    }
}
