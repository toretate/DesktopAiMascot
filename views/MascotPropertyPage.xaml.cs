using DesktopAiMascot.mascots;
using System;
using System.Windows;
using System.Windows.Controls;
using System.Diagnostics;

namespace DesktopAiMascot.views
{
    public partial class MascotPropertyPage : System.Windows.Controls.UserControl
    {
        public event EventHandler<MascotModel>? MascotChanged;

        public MascotPropertyPage()
        {
            InitializeComponent();

            try
            {
                if (MascotManager.Instance.MascotModels.Count == 0)
                {
                    MascotManager.Instance.Load();
                }
                PopulateMascotCombo();
            }
            catch { }

            this.IsVisibleChanged += (s, e) =>
            {
                if (this.IsVisible)
                {
                    PopulateMascotCombo();
                }
            };
        }

        private void MascotChooseComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (mascotChooseComboBox?.SelectedItem is string name)
            {
                SystemConfig.Instance.MascotName = name;
                SystemConfig.Instance.Save();

                var model = MascotManager.Instance.GetMascotByName(name);
                if (model != null)
                {
                    MascotChanged?.Invoke(this, model);
                }
            }
        }

        private void PopulateMascotCombo()
        {
            try
            {
                if (mascotChooseComboBox == null) return;

                mascotChooseComboBox.SelectionChanged -= MascotChooseComboBox_SelectionChanged;

                mascotChooseComboBox.Items.Clear();

                string? currentName = MascotManager.Instance.CurrentModel?.Name;
                int selectedIndex = 0;
                int index = 0;

                foreach (var model in MascotManager.Instance.MascotModels.Values)
                {
                    mascotChooseComboBox.Items.Add(model.Name);

                    if (!string.IsNullOrEmpty(currentName) && model.Name == currentName)
                    {
                        selectedIndex = index;
                    }
                    index++;
                }

                if (mascotChooseComboBox.Items.Count > 0)
                {
                    mascotChooseComboBox.SelectedIndex = selectedIndex;
                }

                mascotChooseComboBox.SelectionChanged += MascotChooseComboBox_SelectionChanged;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error populating mascot combo: {ex.Message}");
            }
        }
    }
}
