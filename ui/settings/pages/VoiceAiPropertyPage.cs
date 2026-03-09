using Godot;
using System;
using System.Linq;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.aiservice.voice;
using DesktopAiMascot.mascots;
using Button = Godot.Button;
using Label = Godot.Label;

namespace DesktopAiMascot.ui.settings.pages
{
    public partial class VoiceAiPropertyPage : MarginContainer
    {
        private OptionButton _voiceAiComboBox = null!;
        private LineEdit _voiceAiUrlTextField = null!;
        private Button _voiceAiRefreshButton = null!;
        private Label _serverStatusLabel = null!;

        private VBoxContainer _styleBertVits2Group = null!;
        private OptionButton _s2ModelComboBox = null!;
        private OptionButton _s2SpeakerComboBox = null!;

        private VBoxContainer _voiceVoxGroup = null!;
        private OptionButton _vvSpeakerComboBox = null!;
        private OptionButton _vvStyleComboBox = null!;

        private Button _saveVoiceToMascotButton = null!;

        private VoiceVoxSpeaker[]? _voiceVoxSpeakers = null;
        private int? _pendingVoiceVoxStyleId = null;
        private bool _isLoadingConfig = false;

        public override void _Ready()
        {
            _voiceAiComboBox = GetNode<OptionButton>("%VoiceAiComboBox");
            _voiceAiUrlTextField = GetNode<LineEdit>("%VoiceAiUrlTextField");
            _voiceAiRefreshButton = GetNode<Button>("%VoiceAiRefreshButton");
            _serverStatusLabel = GetNode<Label>("%ServerStatusLabel");
            
            _styleBertVits2Group = GetNode<VBoxContainer>("%StyleBertVits2SettingsGroup");
            _s2ModelComboBox = GetNode<OptionButton>("%VoiceAiModelComboBox");
            _s2SpeakerComboBox = GetNode<OptionButton>("%VoiceAiSpeakerComboBox");

            _voiceVoxGroup = GetNode<VBoxContainer>("%VoiceVoxSettingsGroup");
            _vvSpeakerComboBox = GetNode<OptionButton>("%VoiceVoxSpeakerComboBox");
            _vvStyleComboBox = GetNode<OptionButton>("%VoiceVoxStyleComboBox");

            _saveVoiceToMascotButton = GetNode<Button>("%SaveVoiceToMascotButton");

            _voiceAiComboBox.ItemSelected += OnVoiceAiSelected;
            _voiceAiUrlTextField.TextChanged += OnVoiceUrlChanged;
            _voiceAiRefreshButton.Pressed += OnRefreshPressed;

            _s2ModelComboBox.ItemSelected += OnModelSelected;
            _s2SpeakerComboBox.ItemSelected += OnSpeakerSelected;

            _vvSpeakerComboBox.ItemSelected += OnVvSpeakerSelected;
            _vvStyleComboBox.ItemSelected += OnVvStyleSelected;

            _saveVoiceToMascotButton.Pressed += SaveVoiceToMascot;

            VisibilityChanged += OnVisibilityChanged;

            PopulateVoiceAiCombo();

            if (IsVisibleInTree())
            {
                _ = LoadMascotVoiceConfig();
            }
        }

        private async void OnVisibilityChanged()
        {
            if (Visible && !_isLoadingConfig)
            {
                await LoadMascotVoiceConfig();
            }
        }

        private void PopulateVoiceAiCombo()
        {
            _voiceAiComboBox.Clear();
            var services = VoiceAiManager.Instance.VoiceAiServices.Values.ToList();
            foreach (var svc in services)
            {
                _voiceAiComboBox.AddItem(svc.Name);
            }

            string currentVoice = SystemConfig.Instance.VoiceService;
            for (int i = 0; i < _voiceAiComboBox.ItemCount; i++)
            {
                if (_voiceAiComboBox.GetItemText(i) == currentVoice)
                {
                    _voiceAiComboBox.Select(i);
                    break;
                }
            }

            if (VoiceAiManager.Instance.CurrentService != null)
            {
                var currentService = VoiceAiManager.Instance.CurrentService;
                string serviceUrl = SystemConfig.Instance.GetVoiceServiceUrl(currentService.Name, currentService.EndPoint);
                currentService.Url = serviceUrl;
                _voiceAiUrlTextField.Text = serviceUrl;
            }

            if (!string.IsNullOrEmpty(currentVoice))
            {
                UpdateSettingsVisibility(currentVoice);
            }
        }

        private async void OnVoiceAiSelected(long index)
        {
            string voiceName = _voiceAiComboBox.GetItemText((int)index);
            SystemConfig.Instance.VoiceService = voiceName;
            SystemConfig.Instance.Save();

            if (VoiceAiManager.Instance.VoiceAiServices.TryGetValue(voiceName, out var service))
            {
                VoiceAiManager.Instance.CurrentService = service;
                
                string serviceUrl = SystemConfig.Instance.GetVoiceServiceUrl(voiceName, service.EndPoint);
                service.Url = serviceUrl;
                _voiceAiUrlTextField.Text = serviceUrl;
                
                UpdateSettingsVisibility(voiceName);
                
                await UpdateModelAndSpeakerList(service);
            }
        }

        private void OnVoiceUrlChanged(string newText)
        {
            var urlText = newText.Trim();
            var currentService = VoiceAiManager.Instance.CurrentService;
            if (currentService != null)
            {
                if (string.IsNullOrEmpty(urlText)) urlText = currentService.EndPoint;

                currentService.Url = urlText;
                SystemConfig.Instance.SetVoiceServiceUrl(currentService.Name, urlText);
                SystemConfig.Instance.Save();
            }
        }

        private async void OnRefreshPressed()
        {
            if (VoiceAiManager.Instance.CurrentService == null) return;

            _voiceAiRefreshButton.Disabled = true;
            _voiceAiRefreshButton.Text = "Refreshing...";

            try
            {
                var urlText = _voiceAiUrlTextField.Text;
                if (!string.IsNullOrEmpty(urlText) && urlText != VoiceAiManager.Instance.CurrentService.Url)
                {
                    VoiceAiManager.Instance.CurrentService.Url = urlText;
                    SystemConfig.Instance.Save();
                }

                await UpdateModelAndSpeakerList(VoiceAiManager.Instance.CurrentService);
            }
            finally
            {
                _voiceAiRefreshButton.Text = "Refresh Models & Speakers";
                _voiceAiRefreshButton.Disabled = false;
            }
        }

        private async void OnModelSelected(long index)
        {
            if (VoiceAiManager.Instance.CurrentService != null && index >= 0)
            {
                string model = _s2ModelComboBox.GetItemText((int)index);
                VoiceAiManager.Instance.CurrentService.Model = model;
                SystemConfig.Instance.VoiceServiceModel = model;
                SystemConfig.Instance.Save();
                
                await UpdateSpeakerList(VoiceAiManager.Instance.CurrentService);
            }
        }

        private void OnSpeakerSelected(long index)
        {
            if (VoiceAiManager.Instance.CurrentService != null && index >= 0)
            {
                string speaker = _s2SpeakerComboBox.GetItemText((int)index);
                VoiceAiManager.Instance.CurrentService.Speaker = speaker;
                SystemConfig.Instance.VoiceServiceSpeaker = speaker;
                SystemConfig.Instance.Save();
            }
        }

        private void UpdateSettingsVisibility(string serviceName)
        {
            _styleBertVits2Group.Visible = false;
            _voiceVoxGroup.Visible = false;

            if (serviceName == "StyleBertVits2") _styleBertVits2Group.Visible = true;
            else if (serviceName == "VoiceVox") _voiceVoxGroup.Visible = true;
        }

        private async Task UpdateModelAndSpeakerList(AiVoiceServiceBase service)
        {
            try
            {
                _s2ModelComboBox.Disabled = true;
                _s2SpeakerComboBox.Disabled = true;
                _vvSpeakerComboBox.Disabled = true;

                var serviceName = service.Name;

                if (serviceName == "StyleBertVits2" && service is StyleBertVits2Service styleBertSvc)
                {
                    bool isServerAvailable = await styleBertSvc.IsServerAvailableAsync();
                    UpdateServerStatus(isServerAvailable);
                        
                    if (!isServerAvailable)
                    {
                        DisplaySavedStyleBertVits2Settings();
                        return;
                    }
                    
                    _s2ModelComboBox.Disabled = false;
                    _s2SpeakerComboBox.Disabled = false;
                    
                    var models = await service.GetAvailableModels();
                    if (models != null && models.Length > 0)
                    {
                        _s2ModelComboBox.Clear();
                        foreach (var m in models) _s2ModelComboBox.AddItem(m);
                        
                        string currentModel = SystemConfig.Instance.VoiceServiceModel;
                        int idx = Array.IndexOf(models, currentModel);
                        if (idx >= 0) _s2ModelComboBox.Select(idx);
                        else _s2ModelComboBox.Select(0);
                    }

                    await UpdateSpeakerList(service);
                }
                else if (serviceName == "VoiceVox" && service is VoiceVoxService vvSvc)
                {
                    bool isServerAvailable = await vvSvc.IsServerAvailableAsync();
                    UpdateServerStatus(isServerAvailable);
                    
                    if (!isServerAvailable)
                    {
                        DisplaySavedVoiceVoxSettings();
                        _vvSpeakerComboBox.Disabled = true;
                        _vvStyleComboBox.Disabled = true;
                        return;
                    }
                    
                    _vvSpeakerComboBox.Disabled = false;
                    _vvStyleComboBox.Disabled = false;
                    
                    _voiceVoxSpeakers = await vvSvc.GetSpeakersAsync();
                    
                    if (_voiceVoxSpeakers != null && _voiceVoxSpeakers.Length > 0)
                    {
                        _vvSpeakerComboBox.Clear();
                        var speakerNames = _voiceVoxSpeakers.Select(s => s.Name).ToArray();
                        foreach (var name in speakerNames) _vvSpeakerComboBox.AddItem(name);
                        
                        string currentSpeaker = SystemConfig.Instance.VoiceServiceSpeaker;
                        string? selectedSpeakerName = null;
                        
                        if (!string.IsNullOrEmpty(currentSpeaker))
                        {
                            var match = System.Text.RegularExpressions.Regex.Match(currentSpeaker, @"^(.+?)\s*\(.+?\)\s*\[(\d+)\]$");
                            if (match.Success)
                            {
                                selectedSpeakerName = match.Groups[1].Value;
                                _pendingVoiceVoxStyleId = int.Parse(match.Groups[2].Value);
                            }
                        }
                        
                        int idx = Array.IndexOf(speakerNames, selectedSpeakerName);
                        if (idx >= 0) _vvSpeakerComboBox.Select(idx);
                        else _vvSpeakerComboBox.Select(0);
                        
                        // Manually trigger
                        OnVvSpeakerSelected(_vvSpeakerComboBox.Selected);
                    }
                }
            }
            finally
            {
                _s2ModelComboBox.Disabled = false;
                _s2SpeakerComboBox.Disabled = false;
                _vvSpeakerComboBox.Disabled = false;
                _vvStyleComboBox.Disabled = false;
            }
        }

        private async Task UpdateSpeakerList(AiVoiceServiceBase service)
        {
            _s2SpeakerComboBox.Disabled = true;
            try
            {
                var speakers = await service.GetAvailableSpeakers();
                _s2SpeakerComboBox.Clear();
                if (speakers != null && speakers.Length > 0)
                {
                    foreach (var s in speakers) _s2SpeakerComboBox.AddItem(s);
                    
                    string currentSpeaker = SystemConfig.Instance.VoiceServiceSpeaker;
                    int idx = Array.IndexOf(speakers, currentSpeaker);
                    if (idx >= 0) _s2SpeakerComboBox.Select(idx);
                    else _s2SpeakerComboBox.Select(0);
                }
            }
            finally
            {
                _s2SpeakerComboBox.Disabled = false;
            }
        }

        private void OnVvSpeakerSelected(long index)
        {
            if (index < 0 || _voiceVoxSpeakers == null) return;
            string speakerName = _vvSpeakerComboBox.GetItemText((int)index);
            
            var selectedSpeaker = _voiceVoxSpeakers.FirstOrDefault(s => s.Name == speakerName);
            if (selectedSpeaker != null && selectedSpeaker.Styles != null && selectedSpeaker.Styles.Length > 0)
            {
                _vvStyleComboBox.Clear();
                foreach (var style in selectedSpeaker.Styles)
                {
                    _vvStyleComboBox.AddItem($"{style.Name} [{style.Id}]");
                }
                
                int? selectedStyleId = _pendingVoiceVoxStyleId;
                if (!selectedStyleId.HasValue)
                {
                    string currentSpeaker = SystemConfig.Instance.VoiceServiceSpeaker;
                    if (!string.IsNullOrEmpty(currentSpeaker))
                    {
                        var match = System.Text.RegularExpressions.Regex.Match(currentSpeaker, @"\[(\d+)\]$");
                        if (match.Success) selectedStyleId = int.Parse(match.Groups[1].Value);
                    }
                }
                
                int matchIdx = -1;
                if (selectedStyleId.HasValue)
                {
                    for (int i = 0; i < selectedSpeaker.Styles.Length; i++)
                    {
                        if (selectedSpeaker.Styles[i].Id == selectedStyleId.Value)
                        {
                            matchIdx = i;
                            break;
                        }
                    }
                }
                
                if (matchIdx >= 0) _vvStyleComboBox.Select(matchIdx);
                else if (_vvStyleComboBox.ItemCount > 0) _vvStyleComboBox.Select(0);
                
                _pendingVoiceVoxStyleId = null;

                // Sync current choice immediately if available
                OnVvStyleSelected(_vvStyleComboBox.Selected);
            }
        }

        private void OnVvStyleSelected(long index)
        {
            if (index < 0 || _vvSpeakerComboBox.GetItemCount() == 0 || VoiceAiManager.Instance.CurrentService == null) return;

            string speakerName = _vvSpeakerComboBox.GetItemText(_vvSpeakerComboBox.Selected);
            var selectedSpeaker = _voiceVoxSpeakers?.FirstOrDefault(s => s.Name == speakerName);
            if (selectedSpeaker == null || selectedSpeaker.Styles == null || index >= selectedSpeaker.Styles.Length) return;

            var style = selectedSpeaker.Styles[(int)index];
            string formattedSpeaker = $"{speakerName} ({style.Name}) [{style.Id}]";
            
            VoiceAiManager.Instance.CurrentService.Speaker = formattedSpeaker;
            SystemConfig.Instance.VoiceServiceSpeaker = formattedSpeaker;
            SystemConfig.Instance.Save();
        }

        private void UpdateServerStatus(bool isAvailable)
        {
            if (isAvailable)
            {
                _serverStatusLabel.Text = "Status: ✓ Online";
                _serverStatusLabel.Modulate = Colors.Green;
            }
            else
            {
                _serverStatusLabel.Text = "Status: ✗ Offline";
                _serverStatusLabel.Modulate = Colors.Red;
            }
        }

        private void DisplaySavedStyleBertVits2Settings()
        {
            string currentModel = SystemConfig.Instance.VoiceServiceModel;
            string currentSpeaker = SystemConfig.Instance.VoiceServiceSpeaker;
            
            _s2ModelComboBox.Clear();
            if (!string.IsNullOrEmpty(currentModel)) _s2ModelComboBox.AddItem(currentModel);
            
            _s2SpeakerComboBox.Clear();
            if (!string.IsNullOrEmpty(currentSpeaker)) _s2SpeakerComboBox.AddItem(currentSpeaker);
        }

        private void DisplaySavedVoiceVoxSettings()
        {
            string currentSpeaker = SystemConfig.Instance.VoiceServiceSpeaker;
            
            _vvSpeakerComboBox.Clear();
            _vvStyleComboBox.Clear();
            
            if (!string.IsNullOrEmpty(currentSpeaker))
            {
                var match = System.Text.RegularExpressions.Regex.Match(currentSpeaker, @"^(.+?)\s*\((.+?)\)\s*\[(\d+)\]$");
                if (match.Success)
                {
                    _vvSpeakerComboBox.AddItem(match.Groups[1].Value);
                    _vvStyleComboBox.AddItem($"{match.Groups[2].Value} [{match.Groups[3].Value}]");
                }
                else
                {
                    _vvSpeakerComboBox.AddItem(currentSpeaker);
                }
            }
        }

        public async Task ReloadVoiceConfig()
        {
            await LoadMascotVoiceConfig();
        }

        private async Task LoadMascotVoiceConfig()
        {
            if (_isLoadingConfig) return;
            _isLoadingConfig = true;
            
            try
            {
                var currentMascot = MascotManager.Instance.CurrentModel;
                var currentService = VoiceAiManager.Instance.CurrentService;
                
                if (currentMascot == null || currentService == null) return;
                
                if (currentMascot.Config.Voice != null && currentMascot.Config.Voice.TryGetValue(currentService.Name, out var voiceConfig))
                {
                    if (!string.IsNullOrEmpty(voiceConfig.Model))
                    {
                        currentService.Model = voiceConfig.Model;
                        SystemConfig.Instance.VoiceServiceModel = voiceConfig.Model;
                    }

                    if (!string.IsNullOrEmpty(voiceConfig.Speaker))
                    {
                        currentService.Speaker = voiceConfig.Speaker;
                        SystemConfig.Instance.VoiceServiceSpeaker = voiceConfig.Speaker;
                    }
                    SystemConfig.Instance.Save();

                    await UpdateModelAndSpeakerList(currentService);
                }
            }
            finally
            {
                _isLoadingConfig = false;
            }
        }

        private void SaveVoiceToMascot()
        {
            var currentMascot = MascotManager.Instance.CurrentModel;
            var currentService = VoiceAiManager.Instance.CurrentService;

            if (currentMascot == null || currentService == null)
            {
                GD.PrintErr("Mascot or VoiceService not selected.");
                return;
            }

            string serviceName = currentService.Name;
            string model = currentService.Model;
            string speaker = currentService.Speaker;

            if (serviceName == "StyleBertVits2" && (string.IsNullOrEmpty(model) || string.IsNullOrEmpty(speaker)))
            {
                GD.PrintErr("Model or speaker not valid.");
                return;
            }
            if (serviceName == "VoiceVox") model = string.Empty;

            currentMascot.SaveVoiceConfig(serviceName, model, speaker);
            GD.Print($"Voice setup saved to {currentMascot.Name}.");
        }
    }
}
