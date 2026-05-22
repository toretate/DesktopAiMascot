using Godot;
using System;
using DesktopAiMascot;
using Button = Godot.Button;
using Label = Godot.Label;
using LinkButton = Godot.LinkButton;
using Color = Godot.Color;

namespace DesktopAiMascot.ui.settings.pages
{
    public partial class ApiKeyPropertyPage : MarginContainer
    {
        private LineEdit _aiStudioApiKeyEdit = null!;
        private LineEdit _cloudApiKeyEdit = null!;
        private LineEdit _projectIdEdit = null!;
        private LineEdit _regionEdit = null!;
        
        private Label _aiStudioStatusLabel = null!;
        private Label _cloudStatusLabel = null!;

        public override void _Ready()
        {
            _aiStudioApiKeyEdit = GetNode<LineEdit>("%AiStudioApiKeyEdit");
            _cloudApiKeyEdit = GetNode<LineEdit>("%CloudApiKeyEdit");
            _projectIdEdit = GetNode<LineEdit>("%ProjectIdEdit");
            _regionEdit = GetNode<LineEdit>("%RegionEdit");

            _aiStudioStatusLabel = GetNode<Label>("%AiStudioStatusLabel");
            _cloudStatusLabel = GetNode<Label>("%CloudStatusLabel");

            GetNode<Button>("%SaveAiStudioBtn").Pressed += SaveAiStudio;
            GetNode<Button>("%ClearAiStudioBtn").Pressed += ClearAiStudio;
            
            GetNode<Button>("%SaveCloudBtn").Pressed += SaveCloud;
            GetNode<Button>("%ClearCloudBtn").Pressed += ClearCloud;

            GetNode<LinkButton>("%GetAiStudioKeyLink").Pressed += () => OS.ShellOpen("https://aistudio.google.com/app/apikey");
            GetNode<LinkButton>("%GetCloudKeyLink").Pressed += () => OS.ShellOpen("https://console.cloud.google.com/");

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
                _aiStudioStatusLabel.Text = "";
                _cloudStatusLabel.Text = "";
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

        private async void ShowStatusFeedback(Label label, string message, string colorHtml)
        {
            label.Text = message;
            label.AddThemeColorOverride("font_color", Color.FromHtml(colorHtml));
            
            // 3秒後にメッセージを消去
            await ToSignal(GetTree().CreateTimer(3.0f), SceneTreeTimer.SignalName.Timeout);
            
            // メッセージ内容が現在の表示と一致している場合のみクリア (他の操作で上書きされていなければ)
            if (label.Text == message)
            {
                label.Text = "";
            }
        }

        private void SaveAiStudio()
        {
            var apiKey = _aiStudioApiKeyEdit.Text.Trim();
            
            SystemConfig.Instance.ApiKeys["GoogleAiStudioApiKey"] = apiKey;
            SystemConfig.Instance.Save();
            
            GD.Print("Google AI Studio API key saved.");
            ShowStatusFeedback(_aiStudioStatusLabel, "設定を保存しました", "#26a69a");
        }

        private void ClearAiStudio()
        {
            _aiStudioApiKeyEdit.Text = "";
            SystemConfig.Instance.ApiKeys["GoogleAiStudioApiKey"] = "";
            SystemConfig.Instance.Save();
            
            GD.Print("Google AI Studio API key cleared.");
            ShowStatusFeedback(_aiStudioStatusLabel, "設定をクリアしました", "#ef5350");
        }

        private void SaveCloud()
        {
            SystemConfig.Instance.ApiKeys["GoogleCloudApiKey"] = _cloudApiKeyEdit.Text.Trim();
            SystemConfig.Instance.ApiKeys["GoogleProjectId"] = _projectIdEdit.Text.Trim();
            SystemConfig.Instance.ApiKeys["GoogleRegion"] = string.IsNullOrEmpty(_regionEdit.Text.Trim()) ? "us-central1" : _regionEdit.Text.Trim();
            
            SystemConfig.Instance.Save();
            GD.Print("Google Cloud configuration saved.");
            ShowStatusFeedback(_cloudStatusLabel, "設定を保存しました", "#26a69a");
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
            
            GD.Print("Google Cloud configuration cleared.");
            ShowStatusFeedback(_cloudStatusLabel, "設定をクリアしました", "#ef5350");
        }
    }
}
