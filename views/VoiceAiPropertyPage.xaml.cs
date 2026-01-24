using System;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using DesktopAiMascot.aiservice;

namespace DesktopAiMascot.views
{
    public partial class VoiceAiPropertyPage : System.Windows.Controls.UserControl
    {
        public VoiceAiPropertyPage()
        {
            InitializeComponent();
            PopulateVoiceAiCombo();
        }

        private void VoiceAiComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (voiceAiComboBox.SelectedValue is string voiceName)
            {
                SystemConfig.Instance.VoiceService = voiceName;
                SystemConfig.Instance.Save();

                if (VoiceAiManager.Instance.VoiceAiServices.TryGetValue(voiceName, out var service))
                {
                    VoiceAiManager.Instance.CurrentService = service;
                }
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
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error populating Voice AI combo: {ex.Message}");
            }
        }
    }
}
