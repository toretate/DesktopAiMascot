using System;
using System.Collections.Generic;
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

namespace DesktopAiMascot.views
{
    /// <summary>
    /// SettingsDialog.xaml の相互作用ロジック
    /// </summary>
    public partial class SettingsDialog : Window
    {
        private readonly SettingsForm settingsForm;
        private bool isDragging = false;

        public SettingsDialog(SettingsForm content)
        {
            InitializeComponent();
            
            settingsForm = content;

            // SettingsFormをWPF Windowに埋め込む
            ContentGrid.Children.Add(settingsForm);

            // SettingsFormからのクローズ要求を処理
            settingsForm.CloseRequested += (s, e) => this.Close();

            // ドラッグ検出
            this.LocationChanged += SettingsDialog_LocationChanged;
            this.PreviewMouseLeftButtonDown += SettingsDialog_PreviewMouseLeftButtonDown;
            this.PreviewMouseLeftButtonUp += SettingsDialog_PreviewMouseLeftButtonUp;

            // ウィンドウ表示時に前面に表示してアクティブ化（一度だけ）
            this.Loaded += (s, e) =>
            {
                try 
                { 
                    this.Activate(); 
                } 
                catch { }
            };
        }

        private void SettingsDialog_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            // タイトルバーをクリックしたらドラッグ開始
            var position = e.GetPosition(this);
            if (position.Y < 30) // タイトルバーの高さ
            {
                isDragging = true;
            }
        }

        private void SettingsDialog_PreviewMouseLeftButtonUp(object sender, MouseButtonEventArgs e)
        {
            if (isDragging)
            {
                isDragging = false;
                // ドラッグ終了後、強制的に再描画
                this.InvalidateVisual();
                settingsForm.InvalidateVisual();
            }
        }

        private void SettingsDialog_LocationChanged(object? sender, EventArgs e)
        {
            if (isDragging)
            {
                // ドラッグ中は不要な再描画を抑制
                // WPFのデフォルト動作に任せる
            }
        }
    }
}





