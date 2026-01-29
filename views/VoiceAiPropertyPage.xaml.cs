using System;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.mascots;
using System.Diagnostics;

namespace DesktopAiMascot.views
{
    public partial class VoiceAiPropertyPage : System.Windows.Controls.UserControl
    {
        public VoiceAiPropertyPage()
        {
            InitializeComponent();
            PopulateVoiceAiCombo();
            
            // ページの表示状態が変わった時にもVoice設定をロード
            this.IsVisibleChanged += async (s, e) =>
            {
                if (this.IsVisible)
                {
                    Debug.WriteLine("[VoiceAiPropertyPage] ページが表示されました。Voice設定を読み込みます。");
                    await LoadMascotVoiceConfig();
                }
            };
        }

        private async void VoiceAiPropertyPage_Loaded(object sender, RoutedEventArgs e)
        {
            await LoadMascotVoiceConfig();
        }

        private async void VoiceAiComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (voiceAiComboBox.SelectedValue is string voiceName)
            {
                SystemConfig.Instance.VoiceService = voiceName;
                SystemConfig.Instance.Save();

                if (VoiceAiManager.Instance.VoiceAiServices.TryGetValue(voiceName, out var service))
                {
                    VoiceAiManager.Instance.CurrentService = service;
                    
                    voiceAiUrlTextField.Text = !string.IsNullOrEmpty(service.Url) ? service.Url : service.EndPoint;
                    
                    await UpdateModelAndSpeakerList(service);
                }
            }
        }

        private void VoiceAiUrlTextField_LostFocus(object sender, RoutedEventArgs e)
        {
            if (VoiceAiManager.Instance.CurrentService != null)
            {
                VoiceAiManager.Instance.CurrentService.Url = voiceAiUrlTextField.Text;
                SystemConfig.Instance.VoiceServiceUrl = voiceAiUrlTextField.Text;
                SystemConfig.Instance.Save();
            }
        }

        private async void VoiceAiRefreshButton_Click(object sender, RoutedEventArgs e)
        {
            if (VoiceAiManager.Instance.CurrentService == null)
            {
                Debug.WriteLine("[Voice AI] サービスが選択されていません。");
                return;
            }

            try
            {
                voiceAiRefreshButton.IsEnabled = false;
                voiceAiRefreshButton.Content = "更新中...";

                var urlText = voiceAiUrlTextField.Text;
                if (!string.IsNullOrEmpty(urlText) && urlText != VoiceAiManager.Instance.CurrentService.Url)
                {
                    VoiceAiManager.Instance.CurrentService.Url = urlText;
                    SystemConfig.Instance.VoiceServiceUrl = urlText;
                    SystemConfig.Instance.Save();
                }

                await UpdateModelAndSpeakerList(VoiceAiManager.Instance.CurrentService);
                
                Debug.WriteLine("[Voice AI] モデルと話者のリストを更新しました。");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Voice AI] 更新中にエラーが発生しました: {ex.Message}");
            }
            finally
            {
                voiceAiRefreshButton.Content = "更新";
                voiceAiRefreshButton.IsEnabled = true;
            }
        }

        private async void VoiceAiModelComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (voiceAiModelComboBox.SelectedItem is string model && VoiceAiManager.Instance.CurrentService != null)
            {
                VoiceAiManager.Instance.CurrentService.Model = model;
                SystemConfig.Instance.VoiceServiceModel = model;
                SystemConfig.Instance.Save();
                
                await UpdateSpeakerList(VoiceAiManager.Instance.CurrentService);
            }
        }

        private void VoiceAiSpeakerComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (voiceAiSpeakerComboBox.SelectedItem is string speaker && VoiceAiManager.Instance.CurrentService != null)
            {
                VoiceAiManager.Instance.CurrentService.Speaker = speaker;
                SystemConfig.Instance.VoiceServiceSpeaker = speaker;
                SystemConfig.Instance.Save();
            }
        }

        private async System.Threading.Tasks.Task UpdateModelAndSpeakerList(aiservice.voice.AiVoiceServiceBase service)
        {
            try
            {
                voiceAiModelComboBox.IsEnabled = false;
                voiceAiSpeakerComboBox.IsEnabled = false;

                var models = await service.GetAvailableModels();
                if (models != null && models.Length > 0)
                {
                    voiceAiModelComboBox.ItemsSource = models;
                    
                    string currentModel = SystemConfig.Instance.VoiceServiceModel;
                    if (!string.IsNullOrEmpty(currentModel) && models.Contains(currentModel))
                    {
                        voiceAiModelComboBox.SelectedItem = currentModel;
                    }
                    else if (models.Length > 0)
                    {
                        voiceAiModelComboBox.SelectedIndex = 0;
                    }
                }
                else
                {
                    voiceAiModelComboBox.ItemsSource = null;
                }

                var speakers = await service.GetAvailableSpeakers();
                if (speakers != null && speakers.Length > 0)
                {
                    voiceAiSpeakerComboBox.ItemsSource = speakers;
                    
                    string currentSpeaker = SystemConfig.Instance.VoiceServiceSpeaker;
                    if (!string.IsNullOrEmpty(currentSpeaker) && speakers.Contains(currentSpeaker))
                    {
                        voiceAiSpeakerComboBox.SelectedItem = currentSpeaker;
                    }
                    else if (speakers.Length > 0)
                    {
                        voiceAiSpeakerComboBox.SelectedIndex = 0;
                    }
                }
                else
                {
                    voiceAiSpeakerComboBox.ItemsSource = null;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to update model and speaker list: {ex.Message}");
            }
            finally
            {
                voiceAiModelComboBox.IsEnabled = true;
                voiceAiSpeakerComboBox.IsEnabled = true;
            }
        }

        private async System.Threading.Tasks.Task UpdateSpeakerList(aiservice.voice.AiVoiceServiceBase service)
        {
            try
            {
                voiceAiSpeakerComboBox.IsEnabled = false;

                var speakers = await service.GetAvailableSpeakers();
                if (speakers != null && speakers.Length > 0)
                {
                    voiceAiSpeakerComboBox.ItemsSource = speakers;
                    
                    string currentSpeaker = SystemConfig.Instance.VoiceServiceSpeaker;
                    if (!string.IsNullOrEmpty(currentSpeaker) && speakers.Contains(currentSpeaker))
                    {
                        voiceAiSpeakerComboBox.SelectedItem = currentSpeaker;
                    }
                    else if (speakers.Length > 0)
                    {
                        voiceAiSpeakerComboBox.SelectedIndex = 0;
                    }
                }
                else
                {
                    voiceAiSpeakerComboBox.ItemsSource = null;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to update speaker list: {ex.Message}");
            }
            finally
            {
                voiceAiSpeakerComboBox.IsEnabled = true;
            }
        }

        private void PopulateVoiceAiCombo()
        {
            try
            {
                voiceAiComboBox.SelectionChanged -= VoiceAiComboBox_SelectionChanged;

                voiceAiComboBox.ItemsSource = VoiceAiManager.Instance.VoiceAiServices.Values.ToList();

                string currentVoice = SystemConfig.Instance.VoiceService;
                voiceAiComboBox.SelectedValue = currentVoice;

                if (voiceAiComboBox.SelectedIndex < 0 && voiceAiComboBox.Items.Count > 0)
                {
                    voiceAiComboBox.SelectedIndex = 0;
                }

                voiceAiComboBox.SelectionChanged += VoiceAiComboBox_SelectionChanged;

                if (VoiceAiManager.Instance.CurrentService != null)
                {
                    voiceAiUrlTextField.Text = !string.IsNullOrEmpty(SystemConfig.Instance.VoiceServiceUrl) 
                        ? SystemConfig.Instance.VoiceServiceUrl 
                        : VoiceAiManager.Instance.CurrentService.EndPoint;
                }
                
                voiceAiUrlTextField.LostFocus += VoiceAiUrlTextField_LostFocus;
                voiceAiModelComboBox.SelectionChanged += VoiceAiModelComboBox_SelectionChanged;
                voiceAiSpeakerComboBox.SelectionChanged += VoiceAiSpeakerComboBox_SelectionChanged;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error populating Voice AI combo: {ex.Message}");
            }
        }

        private void SaveVoiceToMascotButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                // 現在のマスコットを取得
                var currentMascot = MascotManager.Instance.CurrentModel;
                if (currentMascot == null)
                {
                    System.Windows.MessageBox.Show("マスコットが選択されていません。", "エラー", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                // 現在のVoice AIサービスを取得
                var currentService = VoiceAiManager.Instance.CurrentService;
                if (currentService == null)
                {
                    System.Windows.MessageBox.Show("Voice AIサービスが選択されていません。", "エラー", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                // 現在のモデルとスピーカーを取得
                string model = currentService.Model;
                string speaker = currentService.Speaker;

                if (string.IsNullOrEmpty(model) || string.IsNullOrEmpty(speaker))
                {
                    System.Windows.MessageBox.Show("モデルとスピーカーを選択してください。", "エラー", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                // マスコットの設定に保存
                currentMascot.SaveVoiceConfig(currentService.Name, model, speaker);

                System.Windows.MessageBox.Show($"マスコット「{currentMascot.Name}」にVoice設定を保存しました。\n\nサービス: {currentService.Name}\nモデル: {model}\nスピーカー: {speaker}", 
                    "保存完了", MessageBoxButton.OK, MessageBoxImage.Information);

                Debug.WriteLine($"[VoiceAiPropertyPage] Voice設定を保存しました: マスコット={currentMascot.Name}, サービス={currentService.Name}, モデル={model}, スピーカー={speaker}");
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Voice設定の保存に失敗しました。\n\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
                Debug.WriteLine($"[VoiceAiPropertyPage] Voice設定の保存エラー: {ex.Message}");
            }
        }

        /// <summary>
        /// 現在のマスコットに保存されているVoice設定を読み込んでUIに反映します
        /// </summary>
        private async System.Threading.Tasks.Task LoadMascotVoiceConfig()
        {
            try
            {
                Debug.WriteLine("[VoiceAiPropertyPage] ========== LoadMascotVoiceConfig 開始 ==========");
                
                var currentMascot = MascotManager.Instance.CurrentModel;
                if (currentMascot == null)
                {
                    Debug.WriteLine("[VoiceAiPropertyPage] マスコットが選択されていません。");
                    return;
                }
                
                Debug.WriteLine($"[VoiceAiPropertyPage] 現在のマスコット: {currentMascot.Name}");
                Debug.WriteLine($"[VoiceAiPropertyPage] ConfigPath: {currentMascot.ConfigPath}");

                var currentService = VoiceAiManager.Instance.CurrentService;
                if (currentService == null)
                {
                    Debug.WriteLine("[VoiceAiPropertyPage] Voice AIサービスが選択されていません。");
                    return;
                }
                
                Debug.WriteLine($"[VoiceAiPropertyPage] 現在のVoice AIサービス: {currentService.Name}");
                Debug.WriteLine($"[VoiceAiPropertyPage] サービスの現在のモデル: {currentService.Model}");
                Debug.WriteLine($"[VoiceAiPropertyPage] サービスの現在のスピーカー: {currentService.Speaker}");

                // マスコットのVoice設定を取得
                Debug.WriteLine($"[VoiceAiPropertyPage] Config.Voice is null: {currentMascot.Config.Voice == null}");
                if (currentMascot.Config.Voice != null)
                {
                    Debug.WriteLine($"[VoiceAiPropertyPage] Config.Voiceの要素数: {currentMascot.Config.Voice.Count}");
                    foreach (var kvp in currentMascot.Config.Voice)
                    {
                        Debug.WriteLine($"[VoiceAiPropertyPage] Config.Voice[{kvp.Key}]: Model={kvp.Value.Model}, Speaker={kvp.Value.Speaker}");
                    }
                }
                
                if (currentMascot.Config.Voice != null &&
                    currentMascot.Config.Voice.TryGetValue(currentService.Name, out var voiceConfig))
                {
                    Debug.WriteLine($"[VoiceAiPropertyPage] ✓ マスコットに{currentService.Name}のVoice設定が見つかりました");
                    Debug.WriteLine($"[VoiceAiPropertyPage]   - モデル: {voiceConfig.Model}");
                    Debug.WriteLine($"[VoiceAiPropertyPage]   - スピーカー: {voiceConfig.Speaker}");

                    // モデルとスピーカーを設定
                    if (!string.IsNullOrEmpty(voiceConfig.Model))
                    {
                        Debug.WriteLine($"[VoiceAiPropertyPage] サービスのモデルを '{currentService.Model}' から '{voiceConfig.Model}' に変更");
                        currentService.Model = voiceConfig.Model;
                        SystemConfig.Instance.VoiceServiceModel = voiceConfig.Model;
                    }

                    if (!string.IsNullOrEmpty(voiceConfig.Speaker))
                    {
                        Debug.WriteLine($"[VoiceAiPropertyPage] サービスのスピーカーを '{currentService.Speaker}' から '{voiceConfig.Speaker}' に変更");
                        currentService.Speaker = voiceConfig.Speaker;
                        SystemConfig.Instance.VoiceServiceSpeaker = voiceConfig.Speaker;
                    }

                    SystemConfig.Instance.Save();
                    Debug.WriteLine($"[VoiceAiPropertyPage] SystemConfigに保存しました");

                    // UIを更新（イベントハンドラーを一時的に外して、無限ループを防ぐ）
                    Debug.WriteLine($"[VoiceAiPropertyPage] UIの更新を開始...");
                    voiceAiModelComboBox.SelectionChanged -= VoiceAiModelComboBox_SelectionChanged;
                    voiceAiSpeakerComboBox.SelectionChanged -= VoiceAiSpeakerComboBox_SelectionChanged;

                    await UpdateModelAndSpeakerList(currentService);

                    voiceAiModelComboBox.SelectionChanged += VoiceAiModelComboBox_SelectionChanged;
                    voiceAiSpeakerComboBox.SelectionChanged += VoiceAiSpeakerComboBox_SelectionChanged;

                    Debug.WriteLine($"[VoiceAiPropertyPage] ✓ マスコットのVoice設定をUIに反映しました");
                    Debug.WriteLine($"[VoiceAiPropertyPage]   - UIのモデル選択: {voiceAiModelComboBox.SelectedItem}");
                    Debug.WriteLine($"[VoiceAiPropertyPage]   - UIのスピーカー選択: {voiceAiSpeakerComboBox.SelectedItem}");
                }
                else
                {
                    Debug.WriteLine($"[VoiceAiPropertyPage] ✗ マスコット「{currentMascot.Name}」には「{currentService.Name}」のVoice設定がありません");
                }
                
                Debug.WriteLine("[VoiceAiPropertyPage] ========== LoadMascotVoiceConfig 終了 ==========");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[VoiceAiPropertyPage] ✗ マスコットのVoice設定の読み込みエラー: {ex.Message}");
                Debug.WriteLine($"[VoiceAiPropertyPage] スタックトレース: {ex.StackTrace}");
            }
        }

        /// <summary>
        /// Voice設定を再読み込みします（マスコット切り替え時に呼ばれます）
        /// </summary>
        public async System.Threading.Tasks.Task ReloadVoiceConfig()
        {
            Debug.WriteLine("[VoiceAiPropertyPage] ========================================");
            Debug.WriteLine("[VoiceAiPropertyPage] マスコット切り替えによるVoice設定の再読み込みを開始");
            Debug.WriteLine("[VoiceAiPropertyPage] ========================================");
            await LoadMascotVoiceConfig();
        }
    }
}
