using System;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using DesktopAiMascot.aiservice;

namespace DesktopAiMascot.views
{
    public partial class MovieAiPropertyPage : System.Windows.Controls.UserControl
    {
        public MovieAiPropertyPage()
        {
            InitializeComponent();
            PopulateMovieAiCombo();
        }

        private void MovieAiComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (movieAiComboBox.SelectedValue is string aiName)
            {
                SystemConfig.Instance.MovieService = aiName;
                SystemConfig.Instance.Save();

                if (MovieAiManager.Instance.MovieAiServices.TryGetValue(aiName, out var service))
                {
                    MovieAiManager.Instance.CurrentService = service;
                }
            }
        }

        private void PopulateMovieAiCombo()
        {
            try
            {
                movieAiComboBox.SelectionChanged -= MovieAiComboBox_SelectionChanged;

                movieAiComboBox.ItemsSource = MovieAiManager.Instance.MovieAiServices.Values.ToList();

                string currentService = SystemConfig.Instance.MovieService;
                movieAiComboBox.SelectedValue = currentService;

                if (movieAiComboBox.SelectedIndex < 0 && movieAiComboBox.Items.Count > 0)
                {
                    movieAiComboBox.SelectedIndex = 0;
                }

                movieAiComboBox.SelectionChanged += MovieAiComboBox_SelectionChanged;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error populating Movie AI combo: {ex.Message}");
            }
        }
    }
}
