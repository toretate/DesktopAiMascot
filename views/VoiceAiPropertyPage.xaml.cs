using System;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using DesktopAiMascot.aiservice;
using System.Diagnostics;

namespace DesktopAiMascot.views
{
    public partial class VoiceAiPropertyPage : System.Windows.Controls.UserControl
    {
        public VoiceAiPropertyPage()
        {
            InitializeComponent();
            PopulateVoiceAiCombo();
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
    }
}
