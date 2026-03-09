using Godot;
using System;
using System.Linq;
using DesktopAiMascot.aiservice;

namespace DesktopAiMascot.ui.settings.pages
{
    public partial class MovieAiPropertyPage : MarginContainer
    {
        private OptionButton _movieAiComboBox = null!;
        private bool _isLoadingConfig = false;

        public override void _Ready()
        {
            _movieAiComboBox = GetNode<OptionButton>("%MovieAiComboBox");
            _movieAiComboBox.ItemSelected += OnMovieAiSelected;

            VisibilityChanged += OnVisibilityChanged;

            PopulateMovieAiCombo();
        }

        private void OnVisibilityChanged()
        {
            if (Visible && !_isLoadingConfig)
            {
                // Reload on visibility change if required
            }
        }

        private void PopulateMovieAiCombo()
        {
            _isLoadingConfig = true;
            try
            {
                _movieAiComboBox.Clear();
                var services = MovieAiManager.Instance.MovieAiServices.Values.ToList();
                foreach (var svc in services)
                {
                    _movieAiComboBox.AddItem(svc.Name);
                }

                string currentService = SystemConfig.Instance.MovieService;
                int idx = -1;
                for (int i = 0; i < _movieAiComboBox.ItemCount; i++)
                {
                    if (_movieAiComboBox.GetItemText(i) == currentService)
                    {
                        idx = i;
                        break;
                    }
                }

                if (idx >= 0) _movieAiComboBox.Select(idx);
                else if (_movieAiComboBox.ItemCount > 0) _movieAiComboBox.Select(0);

                if (MovieAiManager.Instance.MovieAiServices.TryGetValue(currentService, out var mappedService))
                {
                    MovieAiManager.Instance.CurrentService = mappedService;
                }
            }
            finally
            {
                _isLoadingConfig = false;
            }
        }

        private void OnMovieAiSelected(long index)
        {
            if (_isLoadingConfig) return;

            string aiName = _movieAiComboBox.GetItemText((int)index);
            SystemConfig.Instance.MovieService = aiName;
            SystemConfig.Instance.Save();

            if (MovieAiManager.Instance.MovieAiServices.TryGetValue(aiName, out var service))
            {
                MovieAiManager.Instance.CurrentService = service;
            }
        }
    }
}
