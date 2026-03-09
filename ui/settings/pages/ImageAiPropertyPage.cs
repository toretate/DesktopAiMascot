using Godot;
using System;
using System.Linq;
using DesktopAiMascot.aiservice;

namespace DesktopAiMascot.ui.settings.pages
{
    public partial class ImageAiPropertyPage : MarginContainer
    {
        private OptionButton _imageAiComboBox = null!;
        private bool _isLoadingConfig = false;

        public override void _Ready()
        {
            _imageAiComboBox = GetNode<OptionButton>("%ImageAiComboBox");
            _imageAiComboBox.ItemSelected += OnImageAiSelected;

            VisibilityChanged += OnVisibilityChanged;

            PopulateImageAiCombo();
        }

        private void OnVisibilityChanged()
        {
            if (Visible && !_isLoadingConfig)
            {
                // Reload on visibility change if required, though for Image AI it's very simple
            }
        }

        private void PopulateImageAiCombo()
        {
            _isLoadingConfig = true;
            try
            {
                _imageAiComboBox.Clear();
                var services = ImageAiManager.Instance.ImageAiServices.Values.ToList();
                foreach (var svc in services)
                {
                    _imageAiComboBox.AddItem(svc.Name);
                }

                string currentService = SystemConfig.Instance.ImageService;
                int idx = -1;
                for (int i = 0; i < _imageAiComboBox.ItemCount; i++)
                {
                    if (_imageAiComboBox.GetItemText(i) == currentService)
                    {
                        idx = i;
                        break;
                    }
                }

                if (idx >= 0) _imageAiComboBox.Select(idx);
                else if (_imageAiComboBox.ItemCount > 0) _imageAiComboBox.Select(0);

                if (ImageAiManager.Instance.ImageAiServices.TryGetValue(currentService, out var mappedService))
                {
                    ImageAiManager.Instance.CurrentService = mappedService;
                }
            }
            finally
            {
                _isLoadingConfig = false;
            }
        }

        private void OnImageAiSelected(long index)
        {
            if (_isLoadingConfig) return;

            string aiName = _imageAiComboBox.GetItemText((int)index);
            SystemConfig.Instance.ImageService = aiName;
            SystemConfig.Instance.Save();

            if (ImageAiManager.Instance.ImageAiServices.TryGetValue(aiName, out var service))
            {
                ImageAiManager.Instance.CurrentService = service;
            }
        }
    }
}
