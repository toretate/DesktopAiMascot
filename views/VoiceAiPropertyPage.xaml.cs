using System;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.aiservice.voice;
using DesktopAiMascot.mascots;
using System.Diagnostics;
using System.Collections.Generic;

namespace DesktopAiMascot.views
{
    public partial class VoiceAiPropertyPage : System.Windows.Controls.UserControl
    {
        // VoiceVoxのSpeakerデータを保持
        private VoiceVoxSpeaker[]? _voiceVoxSpeakers = null;
        
        // マスコット設定読み込み時のStyle ID（VoiceVox用）
        private int? _pendingVoiceVoxStyleId = null;
        
        // 設定読み込み中フラグ（重複呼び出しを防ぐ）
        private bool _isLoadingConfig = false;
        
        public VoiceAiPropertyPage()
        {
            InitializeComponent();
            PopulateVoiceAiCombo();
            
            // ページの表示状態が変わった時にもVoice設定をロード
            this.IsVisibleChanged += async (s, e) =>
            {
                if (this.IsVisible && !_isLoadingConfig)
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
                    
                    // サービス固有のURLを取得（SystemConfigに保存されていればそれを使用、なければデフォルトEndPoint）
                    string serviceUrl = SystemConfig.Instance.GetVoiceServiceUrl(voiceName, service.EndPoint);
                    service.Url = serviceUrl;
                    
                    // URLフィールドに表示
                    voiceAiUrlTextField.Text = serviceUrl;
                    Debug.WriteLine($"[VoiceAiPropertyPage] {voiceName} のURL設定: {voiceAiUrlTextField.Text}");
                    
                    // サービスに応じて適切な設定グループを表示
                    UpdateSettingsVisibility(voiceName);
                    
                    await UpdateModelAndSpeakerList(service);
                }
            }
        }

        private void VoiceAiUrlTextField_LostFocus(object sender, RoutedEventArgs e)
        {
            if (VoiceAiManager.Instance.CurrentService != null)
            {
                var urlText = voiceAiUrlTextField.Text?.Trim() ?? string.Empty;
                var currentService = VoiceAiManager.Instance.CurrentService;
                
                // 空の場合はEndPointを使用
                if (string.IsNullOrEmpty(urlText))
                {
                    urlText = currentService.EndPoint;
                    voiceAiUrlTextField.Text = urlText;
                    Debug.WriteLine($"[VoiceAiPropertyPage] URL欄が空だったためEndPointを設定: {urlText}");
                }
                
                // サービスのURLを更新
                currentService.Url = urlText;
                
                // サービス固有のURLとして保存
                SystemConfig.Instance.SetVoiceServiceUrl(currentService.Name, urlText);
                SystemConfig.Instance.Save();
                
                Debug.WriteLine($"[VoiceAiPropertyPage] {currentService.Name} のURL保存: {urlText}");
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
                // StyleBertVits2用のコントロール
                voiceAiModelComboBox.IsEnabled = false;
                voiceAiSpeakerComboBox.IsEnabled = false;
                
                // VoiceVox用のコントロール
                voiceVoxSpeakerComboBox.IsEnabled = false;

                var serviceName = service.Name;

                if (serviceName == "StyleBertVits2")
                {
                    // StyleBertVits2の処理
                    var styleBertVits2Service = service as StyleBertVits2Service;
                    if (styleBertVits2Service != null)
                    {
                        // サーバー状態を確認
                        bool isServerAvailable = await styleBertVits2Service.IsServerAvailableAsync();
                        UpdateStyleBertVits2ServerStatus(isServerAvailable);
                        
                        if (!isServerAvailable)
                        {
                            Debug.WriteLine("[VoiceAiPropertyPage] StyleBertVits2サーバーが起動していません。保存された設定値を表示します。");
                            
                            // 保存された設定値を表示（サーバーからは取得しない）
                            await DisplaySavedStyleBertVits2Settings();
                            
                            // ComboBoxをDisabledにして変更を防止
                            voiceAiModelComboBox.IsEnabled = false;
                            voiceAiSpeakerComboBox.IsEnabled = false;
                            
                            return;
                        }
                        
                        // サーバーが起動している場合は通常処理
                        voiceAiModelComboBox.IsEnabled = true;
                        voiceAiSpeakerComboBox.IsEnabled = true;
                    }
                    
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
                else if (serviceName == "VoiceVox")
                {
                    // VoiceVoxの処理（SpeakerとStyleを別々に扱う）
                    var voiceVoxService = service as VoiceVoxService;
                    if (voiceVoxService != null)
                    {
                        // サーバー状態を確認
                        bool isServerAvailable = await voiceVoxService.IsServerAvailableAsync();
                        UpdateVoiceVoxServerStatus(isServerAvailable);
                        
                        if (!isServerAvailable)
                        {
                            Debug.WriteLine("[VoiceAiPropertyPage] VoiceVoxサーバーが起動していません。保存された設定値を表示します。");
                            
                            // 保存された設定値を表示（サーバーからは取得しない）
                            await DisplaySavedVoiceVoxSettings();
                            
                            // ComboBoxをDisabledにして変更を防止
                            voiceVoxSpeakerComboBox.IsEnabled = false;
                            voiceVoxStyleComboBox.IsEnabled = false;
                            
                            return;
                        }
                        
                        // サーバーが起動している場合は通常処理
                        voiceVoxSpeakerComboBox.IsEnabled = true;
                        voiceVoxStyleComboBox.IsEnabled = true;
                        
                        _voiceVoxSpeakers = await voiceVoxService.GetSpeakersAsync();
                        
                        if (_voiceVoxSpeakers != null && _voiceVoxSpeakers.Length > 0)
                        {
                            // Speakerの名前リストを作成
                            var speakerNames = _voiceVoxSpeakers.Select(s => s.Name).ToArray();
                            voiceVoxSpeakerComboBox.ItemsSource = speakerNames;
                            
                            // 現在の設定から Speaker名とStyle IDを抽出
                            string currentSpeaker = SystemConfig.Instance.VoiceServiceSpeaker;
                            string? selectedSpeakerName = null;
                            int? selectedStyleId = null;
                            
                            if (!string.IsNullOrEmpty(currentSpeaker))
                            {
                                // "キャラクター名 (スタイル名) [ID]" の形式から抽出
                                var match = System.Text.RegularExpressions.Regex.Match(
                                    currentSpeaker, 
                                    @"^(.+?)\s*\(.+?\)\s*\[(\d+)\]$");
                                
                                if (match.Success)
                                {
                                    selectedSpeakerName = match.Groups[1].Value;
                                    selectedStyleId = int.Parse(match.Groups[2].Value);
                                }
                            }
                            
                            // 抽出したStyle IDを保存（VoiceVoxSpeakerComboBox_SelectionChangedで使用）
                            _pendingVoiceVoxStyleId = selectedStyleId;
                            Debug.WriteLine($"[VoiceAiPropertyPage] VoiceVox設定読み込み: Speaker={selectedSpeakerName}, Style ID={selectedStyleId}");
                            
                            // Speakerを選択
                            if (!string.IsNullOrEmpty(selectedSpeakerName) && speakerNames.Contains(selectedSpeakerName))
                            {
                                voiceVoxSpeakerComboBox.SelectedItem = selectedSpeakerName;
                            }
                            else if (speakerNames.Length > 0)
                            {
                                voiceVoxSpeakerComboBox.SelectedIndex = 0;
                            }
                            
                            // Styleは選択されたSpeakerに応じて更新される
                        }
                        else
                        {
                            voiceVoxSpeakerComboBox.ItemsSource = null;
                            voiceVoxStyleComboBox.ItemsSource = null;
                        }
                    }
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
                voiceVoxSpeakerComboBox.IsEnabled = true;
                voiceVoxStyleComboBox.IsEnabled = true;
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
                    var currentService = VoiceAiManager.Instance.CurrentService;
                    
                    // サービス固有のURLを取得
                    string serviceUrl = SystemConfig.Instance.GetVoiceServiceUrl(currentService.Name, currentService.EndPoint);
                    currentService.Url = serviceUrl;
                    voiceAiUrlTextField.Text = serviceUrl;
                    
                    Debug.WriteLine($"[VoiceAiPropertyPage] 初期化時: {currentService.Name} のURL = {serviceUrl}");
                }
                
                voiceAiUrlTextField.LostFocus += VoiceAiUrlTextField_LostFocus;
                voiceAiModelComboBox.SelectionChanged += VoiceAiModelComboBox_SelectionChanged;
                voiceAiSpeakerComboBox.SelectionChanged += VoiceAiSpeakerComboBox_SelectionChanged;
                voiceVoxSpeakerComboBox.SelectionChanged += VoiceVoxSpeakerComboBox_SelectionChanged;
                voiceVoxStyleComboBox.SelectionChanged += VoiceVoxStyleComboBox_SelectionChanged;
                
                // 初期状態で適切な設定グループを表示
                if (!string.IsNullOrEmpty(currentVoice))
                {
                    UpdateSettingsVisibility(currentVoice);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error populating Voice AI combo: {ex.Message}");
            }
        }
        
        private void VoiceVoxSpeakerComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (voiceVoxSpeakerComboBox.SelectedItem is string speakerName && _voiceVoxSpeakers != null)
            {
                // 選択されたSpeakerを検索
                var selectedSpeaker = _voiceVoxSpeakers.FirstOrDefault(s => s.Name == speakerName);
                if (selectedSpeaker != null && selectedSpeaker.Styles != null && selectedSpeaker.Styles.Length > 0)
                {
                    // イベントハンドラーを一時的に外す
                    voiceVoxStyleComboBox.SelectionChanged -= VoiceVoxStyleComboBox_SelectionChanged;
                    
                    // Styleリストを更新
                    var styleDisplayItems = selectedSpeaker.Styles
                        .Select(style => new VoiceVoxStyleDisplayItem
                        {
                            DisplayName = $"{style.Name} [{style.Id}]",
                            Style = style
                        })
                        .ToArray();
                    
                    voiceVoxStyleComboBox.ItemsSource = styleDisplayItems;
                    voiceVoxStyleComboBox.DisplayMemberPath = "DisplayName";
                    
                    // _pendingVoiceVoxStyleIdが設定されている場合はそれを使用、なければSystemConfigから抽出
                    int? selectedStyleId = _pendingVoiceVoxStyleId;
                    
                    if (!selectedStyleId.HasValue)
                    {
                        // SystemConfigから抽出
                        string currentSpeaker = SystemConfig.Instance.VoiceServiceSpeaker;
                        
                        if (!string.IsNullOrEmpty(currentSpeaker))
                        {
                            var match = System.Text.RegularExpressions.Regex.Match(
                                currentSpeaker, 
                                @"\[(\d+)\]$");
                            
                            if (match.Success)
                            {
                                selectedStyleId = int.Parse(match.Groups[1].Value);
                            }
                        }
                    }
                    
                    // Style IDが一致するものを選択
                    if (selectedStyleId.HasValue)
                    {
                        var matchingItem = styleDisplayItems.FirstOrDefault(item => item.Style.Id == selectedStyleId.Value);
                        if (matchingItem != null)
                        {
                            voiceVoxStyleComboBox.SelectedItem = matchingItem;
                            Debug.WriteLine($"[VoiceAiPropertyPage] VoiceVox Style を復元しました: {matchingItem.DisplayName} (ID={selectedStyleId.Value})");
                        }
                        else
                        {
                            Debug.WriteLine($"[VoiceAiPropertyPage] Style ID {selectedStyleId.Value} が見つかりませんでした。デフォルトを選択します。");
                            if (styleDisplayItems.Length > 0)
                            {
                                voiceVoxStyleComboBox.SelectedIndex = 0;
                            }
                        }
                    }
                    else if (styleDisplayItems.Length > 0)
                    {
                        voiceVoxStyleComboBox.SelectedIndex = 0;
                    }
                    
                    // _pendingVoiceVoxStyleIdをクリア
                    _pendingVoiceVoxStyleId = null;
                    
                    // イベントハンドラーを再登録
                    voiceVoxStyleComboBox.SelectionChanged += VoiceVoxStyleComboBox_SelectionChanged;
                    
                    Debug.WriteLine($"[VoiceAiPropertyPage] VoiceVox Speaker を選択しました: {speakerName}");
                }
            }
        }
        
        private void VoiceVoxStyleComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (voiceVoxSpeakerComboBox.SelectedItem is string speakerName &&
                voiceVoxStyleComboBox.SelectedItem is VoiceVoxStyleDisplayItem styleItem &&
                VoiceAiManager.Instance.CurrentService != null)
            {
                // "キャラクター名 (スタイル名) [ID]" の形式で保存
                string formattedSpeaker = $"{speakerName} ({styleItem.Style.Name}) [{styleItem.Style.Id}]";
                
                VoiceAiManager.Instance.CurrentService.Speaker = formattedSpeaker;
                SystemConfig.Instance.VoiceServiceSpeaker = formattedSpeaker;
                SystemConfig.Instance.Save();
                
                Debug.WriteLine($"[VoiceAiPropertyPage] VoiceVox Style を設定しました: {formattedSpeaker}");
            }
        }
        
        /// <summary>
        /// 選択されたVoice AIサービスに応じて、適切な設定グループを表示します
        /// </summary>
        private void UpdateSettingsVisibility(string serviceName)
        {
            // すべての設定グループを非表示にする
            styleBertVits2SettingsGroup.Visibility = Visibility.Collapsed;
            voiceVoxSettingsGroup.Visibility = Visibility.Collapsed;
            
            // サービスに応じて適切なグループを表示
            switch (serviceName)
            {
                case "StyleBertVits2":
                    styleBertVits2SettingsGroup.Visibility = Visibility.Visible;
                    Debug.WriteLine("[VoiceAiPropertyPage] StyleBertVits2設定グループを表示しました");
                    break;
                    
                case "VoiceVox":
                    voiceVoxSettingsGroup.Visibility = Visibility.Visible;
                    Debug.WriteLine("[VoiceAiPropertyPage] VoiceVox設定グループを表示しました");
                    break;
                    
                default:
                    Debug.WriteLine($"[VoiceAiPropertyPage] 不明なサービス: {serviceName}");
                    break;
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

                string serviceName = currentService.Name;
                string model = currentService.Model;
                string speaker = currentService.Speaker;

                // サービスごとのバリデーション
                if (serviceName == "StyleBertVits2")
                {
                    // StyleBertVits2はモデルとスピーカーの両方が必要
                    if (string.IsNullOrEmpty(model) || string.IsNullOrEmpty(speaker))
                    {
                        System.Windows.MessageBox.Show("モデルとスピーカーを選択してください。", "エラー", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                }
                else if (serviceName == "VoiceVox")
                {
                    // VoiceVoxはスピーカーのみ必要（モデルの概念がない）
                    if (string.IsNullOrEmpty(speaker))
                    {
                        System.Windows.MessageBox.Show("スピーカーを選択してください。", "エラー", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                    // VoiceVoxの場合、modelは空文字列でOK
                    model = string.Empty;
                }
                else
                {
                    // その他のサービス
                    if (string.IsNullOrEmpty(speaker))
                    {
                        System.Windows.MessageBox.Show("スピーカーを選択してください。", "エラー", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                }

                // マスコットの設定に保存
                currentMascot.SaveVoiceConfig(serviceName, model, speaker);

                // 成功メッセージ（VoiceVoxの場合はモデル情報を表示しない）
                string message = $"マスコット「{currentMascot.Name}」にVoice設定を保存しました。\n\nサービス: {serviceName}";
                if (!string.IsNullOrEmpty(model))
                {
                    message += $"\nモデル: {model}";
                }
                message += $"\nスピーカー: {speaker}";

                System.Windows.MessageBox.Show(message, "保存完了", MessageBoxButton.OK, MessageBoxImage.Information);

                Debug.WriteLine($"[VoiceAiPropertyPage] Voice設定を保存しました: マスコット={currentMascot.Name}, サービス={serviceName}, モデル={model}, スピーカー={speaker}");
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
            // 重複呼び出しを防ぐ
            if (_isLoadingConfig)
            {
                Debug.WriteLine("[VoiceAiPropertyPage] 設定読み込み中のため、スキップします。");
                return;
            }
            
            _isLoadingConfig = true;
            
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
                    voiceVoxSpeakerComboBox.SelectionChanged -= VoiceVoxSpeakerComboBox_SelectionChanged;
                    voiceVoxStyleComboBox.SelectionChanged -= VoiceVoxStyleComboBox_SelectionChanged;

                    await UpdateModelAndSpeakerList(currentService);

                    voiceAiModelComboBox.SelectionChanged += VoiceAiModelComboBox_SelectionChanged;
                    voiceAiSpeakerComboBox.SelectionChanged += VoiceAiSpeakerComboBox_SelectionChanged;
                    voiceVoxSpeakerComboBox.SelectionChanged += VoiceVoxSpeakerComboBox_SelectionChanged;
                    voiceVoxStyleComboBox.SelectionChanged += VoiceVoxStyleComboBox_SelectionChanged;

                    Debug.WriteLine($"[VoiceAiPropertyPage] ✓ マスコットのVoice設定をUIに反映しました");
                    if (currentService.Name == "StyleBertVits2")
                    {
                        Debug.WriteLine($"[VoiceAiPropertyPage]   - UIのモデル選択: {voiceAiModelComboBox.SelectedItem}");
                        Debug.WriteLine($"[VoiceAiPropertyPage]   - UIのスピーカー選択: {voiceAiSpeakerComboBox.SelectedItem}");
                    }
                    else if (currentService.Name == "VoiceVox")
                    {
                        Debug.WriteLine($"[VoiceAiPropertyPage]   - _pendingVoiceVoxStyleId: {_pendingVoiceVoxStyleId}");
                        Debug.WriteLine($"[VoiceAiPropertyPage]   - UIのスピーカー選択: {voiceVoxSpeakerComboBox.SelectedItem}");
                        
                        if (voiceVoxStyleComboBox.SelectedItem is VoiceVoxStyleDisplayItem selectedStyle)
                        {
                            Debug.WriteLine($"[VoiceAiPropertyPage]   - UIのスタイル選択: {selectedStyle.DisplayName}");
                        }
                        else
                        {
                            Debug.WriteLine($"[VoiceAiPropertyPage]   - UIのスタイル選択: (null or not VoiceVoxStyleDisplayItem)");
                        }
                    }
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
            finally
            {
                _isLoadingConfig = false;
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
        
        /// <summary>
        /// VoiceVoxサーバーの状態を表示します
        /// </summary>
        private void UpdateVoiceVoxServerStatus(bool isAvailable)
        {
            if (voiceVoxServerStatusLabel != null)
            {
                if (isAvailable)
                {
                    voiceVoxServerStatusLabel.Content = "✓ 起動中";
                    voiceVoxServerStatusLabel.Foreground = System.Windows.Media.Brushes.Green;
                }
                else
                {
                    voiceVoxServerStatusLabel.Content = "✗ 停止中";
                    voiceVoxServerStatusLabel.Foreground = System.Windows.Media.Brushes.Red;
                }
            }
        }
        
        /// <summary>
        /// StyleBertVits2サーバーの状態を表示します
        /// </summary>
        private void UpdateStyleBertVits2ServerStatus(bool isAvailable)
        {
            if (styleBertVits2ServerStatusLabel != null)
            {
                if (isAvailable)
                {
                    styleBertVits2ServerStatusLabel.Content = "✓ 起動中";
                    styleBertVits2ServerStatusLabel.Foreground = System.Windows.Media.Brushes.Green;
                }
                else
                {
                    styleBertVits2ServerStatusLabel.Content = "✗ 停止中";
                    styleBertVits2ServerStatusLabel.Foreground = System.Windows.Media.Brushes.Red;
                }
            }
        }
        
        /// <summary>
        /// 保存されたVoiceVox設定値を表示します（サーバーが起動していない場合）
        /// </summary>
        private async System.Threading.Tasks.Task DisplaySavedVoiceVoxSettings()
        {
            string currentSpeaker = SystemConfig.Instance.VoiceServiceSpeaker;
            
            if (string.IsNullOrEmpty(currentSpeaker))
            {
                Debug.WriteLine("[VoiceAiPropertyPage] 保存されたVoiceVox設定がありません");
                voiceVoxSpeakerComboBox.ItemsSource = new[] { "(設定なし)" };
                voiceVoxStyleComboBox.ItemsSource = null;
                return;
            }
            
            // "キャラクター名 (スタイル名) [ID]" の形式から抽出
            var match = System.Text.RegularExpressions.Regex.Match(
                currentSpeaker, 
                @"^(.+?)\s*\((.+?)\)\s*\[(\d+)\]$");
            
            if (match.Success)
            {
                string speakerName = match.Groups[1].Value;
                string styleName = match.Groups[2].Value;
                string styleId = match.Groups[3].Value;
                
                Debug.WriteLine($"[VoiceAiPropertyPage] 保存された設定: Speaker={speakerName}, Style={styleName} [{styleId}]");
                
                // SpeakerとStyleを表示（変更不可）
                voiceVoxSpeakerComboBox.ItemsSource = new[] { speakerName };
                voiceVoxSpeakerComboBox.SelectedIndex = 0;
                
                voiceVoxStyleComboBox.ItemsSource = new[] { $"{styleName} [{styleId}]" };
                voiceVoxStyleComboBox.SelectedIndex = 0;
            }
            else
            {
                Debug.WriteLine($"[VoiceAiPropertyPage] 設定値のフォーマットが不正: {currentSpeaker}");
                voiceVoxSpeakerComboBox.ItemsSource = new[] { currentSpeaker };
                voiceVoxSpeakerComboBox.SelectedIndex = 0;
                voiceVoxStyleComboBox.ItemsSource = null;
            }
            
            
            await System.Threading.Tasks.Task.CompletedTask;
        }
        
        /// <summary>
        /// 保存されたStyleBertVits2設定値を表示します（サーバーが起動していない場合）
        /// </summary>
        private async System.Threading.Tasks.Task DisplaySavedStyleBertVits2Settings()
        {
            string currentModel = SystemConfig.Instance.VoiceServiceModel;
            string currentSpeaker = SystemConfig.Instance.VoiceServiceSpeaker;
            
            if (string.IsNullOrEmpty(currentModel) && string.IsNullOrEmpty(currentSpeaker))
            {
                Debug.WriteLine("[VoiceAiPropertyPage] 保存されたStyleBertVits2設定がありません");
                voiceAiModelComboBox.ItemsSource = new[] { "(設定なし)" };
                voiceAiSpeakerComboBox.ItemsSource = new[] { "(設定なし)" };
                return;
            }
            
            Debug.WriteLine($"[VoiceAiPropertyPage] 保存された設定: Model={currentModel}, Speaker={currentSpeaker}");
            
            // 保存された値を表示（変更不可）
            if (!string.IsNullOrEmpty(currentModel))
            {
                voiceAiModelComboBox.ItemsSource = new[] { currentModel };
                voiceAiModelComboBox.SelectedIndex = 0;
            }
            else
            {
                voiceAiModelComboBox.ItemsSource = new[] { "(設定なし)" };
                voiceAiModelComboBox.SelectedIndex = 0;
            }
            
            if (!string.IsNullOrEmpty(currentSpeaker))
            {
                voiceAiSpeakerComboBox.ItemsSource = new[] { currentSpeaker };
                voiceAiSpeakerComboBox.SelectedIndex = 0;
            }
            else
            {
                voiceAiSpeakerComboBox.ItemsSource = new[] { "(設定なし)" };
                voiceAiSpeakerComboBox.SelectedIndex = 0;
            }
            
            await System.Threading.Tasks.Task.CompletedTask;
        }
    }
    
    /// <summary>
    /// VoiceVoxのStyleをComboBoxに表示するためのヘルパークラス
    /// </summary>
    internal class VoiceVoxStyleDisplayItem
    {
        public string DisplayName { get; set; } = string.Empty;
        public VoiceVoxSpeakerStyle Style { get; set; } = new VoiceVoxSpeakerStyle();
    }
}

