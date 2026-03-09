using Godot;
using System;
using DesktopAiMascot;
using Button = Godot.Button;

namespace DesktopAiMascot.ui.settings.pages
{
    public partial class ApiKeyPropertyPage : MarginContainer
    {
        private LineEdit _aiStudioApiKeyEdit = null!;
        private LineEdit _cloudApiKeyEdit = null!;
        private LineEdit _projectIdEdit = null!;
        private LineEdit _regionEdit = null!;

        public override void _Ready()
        {
            _aiStudioApiKeyEdit = GetNode<LineEdit>("%AiStudioApiKeyEdit");
            _cloudApiKeyEdit = GetNode<LineEdit>("%CloudApiKeyEdit");
            _projectIdEdit = GetNode<LineEdit>("%ProjectIdEdit");
            _regionEdit = GetNode<LineEdit>("%RegionEdit");

            GetNode<Button>("%SaveAiStudioBtn").Pressed += SaveAiStudio;
            GetNode<Button>("%ClearAiStudioBtn").Pressed += ClearAiStudio;
            
            GetNode<Button>("%SaveCloudBtn").Pressed += SaveCloud;
            GetNode<Button>("%ClearCloudBtn").Pressed += ClearCloud;

            VisibilityChanged += OnVisibilityChanged;

            if (IsVisibleInTree())
            {
                LoadApiKeysToUI();
            }
        }

        private void OnVisibilityChanged()
        {
            if (Visible)
            {
                LoadApiKeysToUI();
            }
        }

        private void LoadApiKeysToUI()
        {
            try
            {
                if (SystemConfig.Instance.ApiKeys.TryGetValue("GoogleAiStudioApiKey", out var aiStudioApiKey))
                    _aiStudioApiKeyEdit.Text = aiStudioApiKey;
                else
                    _aiStudioApiKeyEdit.Text = "";

                if (SystemConfig.Instance.ApiKeys.TryGetValue("GoogleCloudApiKey", out var cloudApiKey))
                    _cloudApiKeyEdit.Text = cloudApiKey;
                else
                    _cloudApiKeyEdit.Text = "";
                
                if (SystemConfig.Instance.ApiKeys.TryGetValue("GoogleProjectId", out var projectId))
                    _projectIdEdit.Text = projectId;
                else
                    _projectIdEdit.Text = "";
                
                if (SystemConfig.Instance.ApiKeys.TryGetValue("GoogleRegion", out var region))
                    _regionEdit.Text = region;
                else
                    _regionEdit.Text = "us-central1";
            }
            catch (Exception ex)
            {
                GD.PrintErr($"Failed to load API keys to UI: {ex.Message}");
            }
        }

        private void SaveAiStudio()
        {
            var apiKey = _aiStudioApiKeyEdit.Text.Trim();
            
            SystemConfig.Instance.ApiKeys["GoogleAiStudioApiKey"] = apiKey;
            SystemConfig.Instance.Save();
            
            GD.Print("Google AI Studio API key saved.");
        }

        private void ClearAiStudio()
        {
            _aiStudioApiKeyEdit.Text = "";
            SystemConfig.Instance.ApiKeys["GoogleAiStudioApiKey"] = "";
            SystemConfig.Instance.Save();
        }

        private void SaveCloud()
        {
            SystemConfig.Instance.ApiKeys["GoogleCloudApiKey"] = _cloudApiKeyEdit.Text.Trim();
            SystemConfig.Instance.ApiKeys["GoogleProjectId"] = _projectIdEdit.Text.Trim();
            SystemConfig.Instance.ApiKeys["GoogleRegion"] = string.IsNullOrEmpty(_regionEdit.Text.Trim()) ? "us-central1" : _regionEdit.Text.Trim();
            
            SystemConfig.Instance.Save();
            GD.Print("Google Cloud configuration saved.");
        }

        private void ClearCloud()
        {
            _cloudApiKeyEdit.Text = "";
            _projectIdEdit.Text = "";
            _regionEdit.Text = "us-central1";

            SystemConfig.Instance.ApiKeys["GoogleCloudApiKey"] = "";
            SystemConfig.Instance.ApiKeys["GoogleProjectId"] = "";
            SystemConfig.Instance.ApiKeys["GoogleRegion"] = "us-central1";
            SystemConfig.Instance.Save();
        }
    }
}
