using System;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using DesktopAiMascot.aiservice;
using System.Diagnostics;

namespace DesktopAiMascot.views
{
    public partial class ImageAiPropertyPage : System.Windows.Controls.UserControl
    {
        public ImageAiPropertyPage()
        {
            InitializeComponent();
            PopulateImageAiCombo();
        }

        private void ImageAiComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (imageAiComboBox.SelectedValue is string aiName)
            {
                SystemConfig.Instance.ImageService = aiName;
                SystemConfig.Instance.Save();

                if (ImageAiManager.Instance.ImageAiServices.TryGetValue(aiName, out var service))
                {
                    ImageAiManager.Instance.CurrentService = service;
                }
            }
        }

        private void PopulateImageAiCombo()
        {
            try
            {
                imageAiComboBox.SelectionChanged -= ImageAiComboBox_SelectionChanged;

                imageAiComboBox.ItemsSource = ImageAiManager.Instance.ImageAiServices.Values.ToList();

                string currentService = SystemConfig.Instance.ImageService;
                imageAiComboBox.SelectedValue = currentService;

                if (imageAiComboBox.SelectedIndex < 0 && imageAiComboBox.Items.Count > 0)
                {
                    imageAiComboBox.SelectedIndex = 0;
                }

                imageAiComboBox.SelectionChanged += ImageAiComboBox_SelectionChanged;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error populating Image AI combo: {ex.Message}");
            }
        }
    }
}
