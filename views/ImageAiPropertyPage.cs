using System;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;
using DesktopAiMascot.aiservice;

namespace DesktopAiMascot.Views
{
    public partial class ImageAiPropertyPage : UserControl
    {
        public ImageAiPropertyPage()
        {
            InitializeComponent();
            PopulateImageAiCombo();
        }

        private void imageAiComboBox_SelectedIndexChanged(object? sender, EventArgs e)
        {
            if (imageAiComboBox.SelectedValue is string aiName)
            {
                SystemConfig.Instance.ImageService = aiName;
                SystemConfig.Instance.Save();

                // ImageAiManager に即時反映
                if (ImageAiManager.Instance.ImageAiServices.TryGetValue(aiName, out var service))
                {
                    ImageAiManager.Instance.CurrentService = service;
                }
            }
        }

        // Image AIエンジンコンボボックスの初期化
        private void PopulateImageAiCombo()
        {
            try
            {
                // イベントハンドラを一時的に解除
                imageAiComboBox.SelectedIndexChanged -= imageAiComboBox_SelectedIndexChanged;

                // バインディング設定
                imageAiComboBox.DataSource = ImageAiManager.Instance.ImageAiServices.Values.ToList();
                imageAiComboBox.DisplayMember = "Name";
                imageAiComboBox.ValueMember = "Name";

                // 現在の設定を選択
                string currentService = SystemConfig.Instance.ImageService;
                imageAiComboBox.SelectedValue = currentService;

                // もし選択できていなければデフォルト(0番目)を選択
                if (imageAiComboBox.SelectedIndex < 0 && imageAiComboBox.Items.Count > 0)
                {
                    imageAiComboBox.SelectedIndex = 0;
                }

                // イベントハンドラを再設定
                imageAiComboBox.SelectedIndexChanged += imageAiComboBox_SelectedIndexChanged;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error populating Image AI combo: {ex.Message}");
            }
        }
    }
}
