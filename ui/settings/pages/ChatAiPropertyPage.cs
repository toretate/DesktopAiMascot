using Godot;
using System;
using System.Linq;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.aiservice.chat;
using Button = Godot.Button;
using CheckBox = Godot.CheckBox;
using Label = Godot.Label;

namespace DesktopAiMascot.ui.settings.pages
{
    public partial class ChatAiPropertyPage : MarginContainer
    {
        private OptionButton _serviceOptionBtn = null!;
        private OptionButton _modelOptionBtn = null!;
        private LineEdit _endpointEdit = null!;
        private Button _checkServerBtn = null!;
        private Button _refreshModelsBtn = null!;
        private Label _serverStatusLabel = null!;
        private HBoxContainer _hboxEndpoint = null!;
        private HBoxContainer _hboxServerStatus = null!;
        private CheckBox _filterChatModelsCheck = null!;

        private bool _isUpdatingUI = false;
        private ModelDisplayItem[]? _currentModels;

        public override void _Ready()
        {
            _serviceOptionBtn = GetNode<OptionButton>("%LlmServiceOptionBtn");
            _modelOptionBtn = GetNode<OptionButton>("%ModelOptionBtn");
            _endpointEdit = GetNode<LineEdit>("%EndpointEdit");
            _checkServerBtn = GetNode<Button>("%CheckServerBtn");
            _refreshModelsBtn = GetNode<Button>("%RefreshModelsBtn");
            _serverStatusLabel = GetNode<Label>("%ServerStatusLabel");
            _hboxEndpoint = GetNode<HBoxContainer>("%HBoxEndpoint");
            _hboxServerStatus = GetNode<HBoxContainer>("%HBoxServerStatus");
            _filterChatModelsCheck = GetNode<CheckBox>("%FilterChatModelsCheck");

            _serviceOptionBtn.ItemSelected += OnServiceSelected;
            _modelOptionBtn.ItemSelected += OnModelSelected;
            _endpointEdit.TextChanged += OnEndpointChanged;
            _checkServerBtn.Pressed += OnCheckServerPressed;
            _refreshModelsBtn.Pressed += OnRefreshModelsPressed;
            _filterChatModelsCheck.Toggled += OnFilterToggled;

            VisibilityChanged += OnVisibilityChanged;

            if (IsVisibleInTree())
            {
                InitializeUI();
            }
        }

        private void OnVisibilityChanged()
        {
            if (Visible)
            {
                InitializeUI();
            }
        }

        private void InitializeUI()
        {
            if (_isUpdatingUI) return;
            _isUpdatingUI = true;

            // Populate services
            _serviceOptionBtn.Clear();
            var serviceTable = LlmManager.GetAvailableLlmServices;
            for (int i = 0; i < serviceTable.Rows.Count; i++)
            {
                _serviceOptionBtn.AddItem(serviceTable.Rows[i]["Name"]?.ToString() ?? "");
            }

            // Select current service
            string currentService = SystemConfig.Instance.LlmService;
            int idx = -1;
            for (int i = 0; i < _serviceOptionBtn.ItemCount; i++)
            {
                if (_serviceOptionBtn.GetItemText(i) == currentService)
                {
                    idx = i;
                    break;
                }
            }
            if (idx >= 0)
                _serviceOptionBtn.Select(idx);
            else if (_serviceOptionBtn.ItemCount > 0)
                _serviceOptionBtn.Select(0);

            _endpointEdit.Text = SystemConfig.Instance.ChatAiEndpoint ?? "";

            UpdatePanelsVisibility();
            
            _isUpdatingUI = false;

            // Trigger model refresh for the selected service
            _ = RefreshModelsAsync();
        }

        private void OnServiceSelected(long index)
        {
            if (_isUpdatingUI) return;

            string selectedService = _serviceOptionBtn.GetItemText((int)index);
            SystemConfig.Instance.LlmService = selectedService;
            SystemConfig.Instance.Save();

            UpdatePanelsVisibility();
            _ = RefreshModelsAsync();
        }

        private void UpdatePanelsVisibility()
        {
            string service = SystemConfig.Instance.LlmService;
            bool isLocal = (service == "LM Studio" || service == "Foundry Local");
            bool isGeminiStudio = (service == "Gemini (AI Studio)");

            _hboxEndpoint.Visible = isLocal;
            _hboxServerStatus.Visible = isLocal;
            _filterChatModelsCheck.Visible = isGeminiStudio;
        }

        private void OnEndpointChanged(string newText)
        {
            if (_isUpdatingUI) return;
            
            SystemConfig.Instance.ChatAiEndpoint = newText;
            SystemConfig.Instance.Save();
        }

        private async void OnCheckServerPressed()
        {
            _serverStatusLabel.Text = "Checking...";
            _serverStatusLabel.Modulate = Colors.Gray;

            string serviceName = SystemConfig.Instance.LlmService;
            if (serviceName == "LM Studio" || serviceName == "Foundry Local")
            {
                try
                {
                    // LmStudioChatService uses similar endpoint logic for both conceptually here for ping
                    var service = new LmStudioChatService(_endpointEdit.Text);
                    bool isAvailable = await service.IsServerAvailableAsync();
                    
                    if (isAvailable)
                    {
                        _serverStatusLabel.Text = "✓ Online";
                        _serverStatusLabel.Modulate = Colors.Green;
                    }
                    else
                    {
                        _serverStatusLabel.Text = "✗ Offline";
                        _serverStatusLabel.Modulate = Colors.Red;
                    }
                }
                catch (Exception ex)
                {
                    _serverStatusLabel.Text = "✗ Error";
                    _serverStatusLabel.Modulate = Colors.Red;
                    GD.PrintErr($"Server check error: {ex.Message}");
                }
            }
        }

        private void OnRefreshModelsPressed()
        {
            _ = RefreshModelsAsync();
        }

        private async Task RefreshModelsAsync()
        {
            _refreshModelsBtn.Disabled = true;
            _modelOptionBtn.Disabled = true;
            _modelOptionBtn.Clear();
            _modelOptionBtn.AddItem("Loading...");

            try
            {
                string serviceName = SystemConfig.Instance.LlmService;
                var service = LlmManager.CreateService(serviceName);
                if (service != null)
                {
                    if (serviceName == "LM Studio" || serviceName == "Foundry Local")
                    {
                        service.EndPoint = _endpointEdit.Text;
                    }

                    _currentModels = await service.GetAvailableModels(false);

                    PopulateModelsCombo();
                }
                else
                {
                    _modelOptionBtn.Clear();
                    _modelOptionBtn.AddItem("Failed to create service");
                }
            }
            catch (Exception ex)
            {
                _modelOptionBtn.Clear();
                _modelOptionBtn.AddItem("Error loading models");
                GD.PrintErr($"Failed to update model list: {ex.Message}");
            }
            finally
            {
                _refreshModelsBtn.Disabled = false;
                _modelOptionBtn.Disabled = false;
            }
        }

        private void PopulateModelsCombo()
        {
            _isUpdatingUI = true;
            _modelOptionBtn.Clear();

            if (_currentModels == null || _currentModels.Length == 0)
            {
                _modelOptionBtn.AddItem("No models available");
                _isUpdatingUI = false;
                return;
            }

            var modelsToShow = _currentModels;
            
            if (SystemConfig.Instance.LlmService == "Gemini (AI Studio)" && _filterChatModelsCheck.ButtonPressed)
            {
                modelsToShow = _currentModels.Where(m => !IsChatExclusiveModel(m)).ToArray();
            }

            if (modelsToShow.Length == 0)
            {
                _modelOptionBtn.AddItem("No models match filter");
                _isUpdatingUI = false;
                return;
            }

            for (int i = 0; i < modelsToShow.Length; i++)
            {
                _modelOptionBtn.AddItem(modelsToShow[i].DisplayName);
            }

            string currentModelId = SystemConfig.Instance.ModelName;
            int matchIdx = Array.FindIndex(modelsToShow, m => string.Equals(m.Id, currentModelId, StringComparison.OrdinalIgnoreCase));
            
            if (matchIdx >= 0)
            {
                _modelOptionBtn.Select(matchIdx);
            }
            else
            {
                _modelOptionBtn.Select(0);
                SystemConfig.Instance.ModelName = modelsToShow[0].Id;
                SystemConfig.Instance.Save();
            }

            _isUpdatingUI = false;
        }

        private bool IsChatExclusiveModel(ModelDisplayItem model)
        {
            var displayName = model.DisplayName;
            return displayName.Contains("[音声]") || displayName.Contains("[埋込]") || displayName.Contains("[画像]") || displayName.Contains("[画像生成]");
        }

        private void OnModelSelected(long index)
        {
            if (_isUpdatingUI || _currentModels == null) return;

            // We need to map the selected index back to the filtered models to get the ID
            var modelsToShow = _currentModels;
            if (SystemConfig.Instance.LlmService == "Gemini (AI Studio)" && _filterChatModelsCheck.ButtonPressed)
            {
                modelsToShow = _currentModels.Where(m => !IsChatExclusiveModel(m)).ToArray();
            }

            if (index >= 0 && index < modelsToShow.Length)
            {
                SystemConfig.Instance.ModelName = modelsToShow[index].Id;
                SystemConfig.Instance.Save();
                GD.Print($"Saved model ID: {modelsToShow[index].Id}");
            }
        }

        private void OnFilterToggled(bool toggledOn)
        {
            PopulateModelsCombo();
        }
    }
}
