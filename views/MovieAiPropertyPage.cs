using System;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;
using DesktopAiMascot.aiservice;

namespace DesktopAiMascot.Views
{
    public partial class MovieAiPropertyPage : UserControl
    {
        public MovieAiPropertyPage()
        {
            InitializeComponent();
            PopulateMovieAiCombo();
        }

        private void movieAiComboBox_SelectedIndexChanged(object? sender, EventArgs e)
        {
            if (movieAiComboBox.SelectedValue is string aiName)
            {
                SystemConfig.Instance.MovieService = aiName;
                SystemConfig.Instance.Save();

                // MovieAiManager に即時反映
                if (MovieAiManager.Instance.MovieAiServices.TryGetValue(aiName, out var service))
                {
                    MovieAiManager.Instance.CurrentService = service;
                }
            }
        }

        // Movie AIエンジンコンボボックスの初期化
        private void PopulateMovieAiCombo()
        {
            try
            {
                // イベントハンドラを一時的に解除
                movieAiComboBox.SelectedIndexChanged -= movieAiComboBox_SelectedIndexChanged;

                // バインディング設定
                movieAiComboBox.DataSource = MovieAiManager.Instance.MovieAiServices.Values.ToList();
                movieAiComboBox.DisplayMember = "Name";
                movieAiComboBox.ValueMember = "Name";

                // 現在の設定を選択
                string currentService = SystemConfig.Instance.MovieService;
                movieAiComboBox.SelectedValue = currentService;

                // もし選択できていなければデフォルト(0番目)を選択
                if (movieAiComboBox.SelectedIndex < 0 && movieAiComboBox.Items.Count > 0)
                {
                    movieAiComboBox.SelectedIndex = 0;
                }

                // イベントハンドラを再設定
                movieAiComboBox.SelectedIndexChanged += movieAiComboBox_SelectedIndexChanged;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error populating Movie AI combo: {ex.Message}");
            }
        }
    }
}
