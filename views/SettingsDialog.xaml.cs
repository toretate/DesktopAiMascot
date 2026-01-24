using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using DesktopAiMascot.mascots;

namespace DesktopAiMascot.views
{
    /// <summary>
    /// SettingsDialog.xaml の相互作用ロジック
    /// </summary>
    public partial class SettingsDialog : Window
    {
        private readonly SettingsForm settingsForm;

        public SettingsDialog(SettingsForm content)
        {
            InitializeComponent();
            
            settingsForm = content;

            // SettingsFormをWPF Windowに埋め込む
            ContentGrid.Children.Add(settingsForm);

            // SettingsFormからのクローズ要求を処理
            settingsForm.CloseRequested += (s, e) => this.Close();
        }
    }
}





