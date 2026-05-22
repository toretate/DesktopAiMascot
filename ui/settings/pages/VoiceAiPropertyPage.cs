using Godot;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.aiservice.voice;
using DesktopAiMascot.mascots;
using Button = Godot.Button;
using Label = Godot.Label;
using Control = Godot.Control;
using Color = Godot.Color;

namespace DesktopAiMascot.ui.settings.pages
{
    /// <summary>
    /// Voice AI 設定画面を表すクラス。
    /// デザインガイドラインに沿った、スリムなプロバイダーリストと設定パネルの2カラム構成で制御します。
    /// </summary>
    public partial class VoiceAiPropertyPage : MarginContainer
    {
        private VBoxContainer _providerListContainer = null!;
        private VBoxContainer _parametersVBox = null!;
        private PanelContainer _notImplementedPanel = null!;

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
        private bool _isUpdatingUI = false;

        // プロバイダー情報メタデータ定義
        private class ProviderInfo
        {
            public string Name { get; set; } = "";
            public string InternalName { get; set; } = "";
            public string Description { get; set; } = "";
            public string IconPath { get; set; } = "";
            public bool IsImplemented { get; set; }
        }

        // 定義されたボイスエンジンプロバイダーメタデータ
        private readonly List<ProviderInfo> _providers = new List<ProviderInfo>
        {
            new ProviderInfo { Name = "StyleBertVits2", InternalName = "StyleBertVits2", Description = "Style-Bert-VITS2 - High-quality expressive text-to-speech.", IconPath = "res://assets/icons/providers/stylebertvits2_icon.png", IsImplemented = true },
            new ProviderInfo { Name = "VoiceVox", InternalName = "VoiceVox", Description = "VOICEVOX - Free Japanese neural text-to-speech software.", IconPath = "res://assets/icons/providers/voicevox_icon.png", IsImplemented = true },
            new ProviderInfo { Name = "OpenAI TTS", InternalName = "OpenAI TTS", Description = "OpenAI TTS - Natural-sounding text-to-speech API.", IconPath = "res://assets/icons/providers/openai_tts_icon.png", IsImplemented = false },
            new ProviderInfo { Name = "ElevenLabs", InternalName = "ElevenLabs", Description = "ElevenLabs - Prime AI Text to Speech & Voice Cloning.", IconPath = "res://assets/icons/providers/elevenlabs_icon.png", IsImplemented = false }
        };

        public override void _Ready()
        {
            _providerListContainer = GetNode<VBoxContainer>("%ProviderListContainer");
            _parametersVBox = GetNode<VBoxContainer>("%ParametersVBox");
            _notImplementedPanel = GetNode<PanelContainer>("%NotImplementedPanel");

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

            // イベントハンドラーの接続
            _voiceAiUrlTextField.TextChanged += OnVoiceUrlChanged;
            _voiceAiRefreshButton.Pressed += OnRefreshPressed;

            _s2ModelComboBox.ItemSelected += OnModelSelected;
            _s2SpeakerComboBox.ItemSelected += OnSpeakerSelected;

            _vvSpeakerComboBox.ItemSelected += OnVvSpeakerSelected;
            _vvStyleComboBox.ItemSelected += OnVvStyleSelected;

            _saveVoiceToMascotButton.Pressed += SaveVoiceToMascot;

            VisibilityChanged += OnVisibilityChanged;

            if (IsVisibleInTree())
            {
                InitializeUI();
            }
        }

        private void OnVisibilityChanged()
        {
            if (Visible && !_isLoadingConfig)
            {
                InitializeUI();
            }
        }

        /// <summary>
        /// 画面初期表示時の UI 更新
        /// </summary>
        private void InitializeUI()
        {
            if (_isUpdatingUI) return;
            _isUpdatingUI = true;

            // プロバイダー固定リストの再構築
            PopulateProviderList();

            string currentVoice = SystemConfig.Instance.VoiceService;
            
            if (VoiceAiManager.Instance.VoiceAiServices.TryGetValue(currentVoice, out var service))
            {
                VoiceAiManager.Instance.CurrentService = service;
                string serviceUrl = SystemConfig.Instance.GetVoiceServiceUrl(currentVoice, service.EndPoint);
                service.Url = serviceUrl;
                _voiceAiUrlTextField.Text = serviceUrl;
            }

            UpdatePanelsVisibility();
            
            _isUpdatingUI = false;

            // 設定パラメータのロード
            _ = LoadMascotVoiceConfig();
        }

        /// <summary>
        /// プロバイダーの固定縦型リストを動的に生成します。
        /// </summary>
        private void PopulateProviderList()
        {
            // 既存のリストアイテムをクリア
            foreach (Node child in _providerListContainer.GetChildren())
            {
                child.QueueFree();
            }

            string currentVoice = SystemConfig.Instance.VoiceService;

            foreach (var prov in _providers)
            {
                bool isSelected = prov.InternalName == currentVoice;

                // 各プロバイダー用のパネルコンテナを作成（これがリストの1行分になる）
                var itemPanel = new PanelContainer();
                itemPanel.CustomMinimumSize = new Vector2(0, 48); // 48pxのスリムな固定高で均一にする
                itemPanel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
                
                // パネルのスタイル設定（丸角と余白）
                var styleBoxNormal = new StyleBoxFlat();
                styleBoxNormal.CornerRadiusTopLeft = 8;
                styleBoxNormal.CornerRadiusTopRight = 8;
                styleBoxNormal.CornerRadiusBottomLeft = 8;
                styleBoxNormal.CornerRadiusBottomRight = 8;
                styleBoxNormal.ContentMarginLeft = 12;
                styleBoxNormal.ContentMarginRight = 12;
                styleBoxNormal.ContentMarginTop = 6;
                styleBoxNormal.ContentMarginBottom = 6;

                if (isSelected)
                {
                    // 選択時のライトブルー背景とボーダー
                    styleBoxNormal.BgColor = new Color(0.85f, 0.92f, 0.98f, 1.0f);
                    styleBoxNormal.BorderWidthLeft = 2;
                    styleBoxNormal.BorderWidthTop = 2;
                    styleBoxNormal.BorderWidthRight = 2;
                    styleBoxNormal.BorderWidthBottom = 2;
                    styleBoxNormal.BorderColor = new Color(0.20f, 0.47f, 0.96f, 1.0f); // アクセントソフトブルー
                }
                else
                {
                    // 通常時は透明背景
                    styleBoxNormal.BgColor = new Color(1.0f, 1.0f, 1.0f, 0.0f);
                }

                itemPanel.AddThemeStyleboxOverride("panel", styleBoxNormal);

                // パネル内のレイアウト (HBox)
                var hbox = new HBoxContainer();
                hbox.AddThemeConstantOverride("separation", 12);
                hbox.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
                hbox.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
                hbox.MouseFilter = Control.MouseFilterEnum.Ignore;
                itemPanel.AddChild(hbox);

                // アイコン
                var iconRect = new TextureRect();
                iconRect.CustomMinimumSize = new Vector2(28, 28); // スリムな28px四方に変更
                iconRect.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
                iconRect.ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize;
                iconRect.StretchMode = TextureRect.StretchModeEnum.KeepAspectCentered;
                iconRect.MouseFilter = Control.MouseFilterEnum.Ignore;
                
                try
                {
                    if (!string.IsNullOrEmpty(prov.IconPath))
                    {
                        if (ResourceLoader.Exists(prov.IconPath))
                        {
                            try
                            {
                                iconRect.Texture = ResourceLoader.Load<Texture2D>(prov.IconPath);
                            }
                            catch
                            {
                                var image = Godot.Image.LoadFromFile(prov.IconPath);
                                if (image != null)
                                {
                                    iconRect.Texture = ImageTexture.CreateFromImage(image);
                                }
                            }
                        }
                        else
                        {
                            var image = Godot.Image.LoadFromFile(prov.IconPath);
                            if (image != null)
                            {
                                iconRect.Texture = ImageTexture.CreateFromImage(image);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    GD.PrintErr($"Failed to load provider icon ({prov.IconPath}): {ex.Message}");
                }
                hbox.AddChild(iconRect);

                // プロバイダー名
                var nameLabel = new Label();
                nameLabel.Text = prov.Name;
                nameLabel.AddThemeColorOverride("font_color", new Color(0.1f, 0.1f, 0.15f));
                nameLabel.AddThemeFontSizeOverride("font_size", 14);
                nameLabel.AddThemeFontOverride("font", ThemeDB.FallbackFont); // フォントフォールバック
                nameLabel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill; // チェックマークとの幅調整
                nameLabel.MouseFilter = Control.MouseFilterEnum.Ignore;
                hbox.AddChild(nameLabel);

                // 選択時チェックマーク
                if (isSelected)
                {
                    var checkLabel = new Label();
                    checkLabel.Text = "✓";
                    checkLabel.AddThemeColorOverride("font_color", new Color(0.20f, 0.47f, 0.96f)); // アクセントブルー
                    checkLabel.AddThemeFontSizeOverride("font_size", 16);
                    checkLabel.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
                    checkLabel.MouseFilter = Control.MouseFilterEnum.Ignore;
                    hbox.AddChild(checkLabel);
                }

                // クリック用の透明なボタンを上に重ねる
                var itemBtn = new Button();
                itemBtn.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
                itemBtn.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
                itemBtn.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect);
                
                // ボタンの背景スタイルを透明にする
                var styleBoxEmpty = new StyleBoxEmpty();
                itemBtn.AddThemeStyleboxOverride("normal", styleBoxEmpty);
                itemBtn.AddThemeStyleboxOverride("pressed", styleBoxEmpty);
                itemBtn.AddThemeStyleboxOverride("focus", styleBoxEmpty);

                // ホバー時のみ少し薄いグレーを重ねる
                var styleBoxHover = new StyleBoxFlat();
                styleBoxHover.BgColor = new Color(0.0f, 0.0f, 0.0f, 0.05f); // 非常に薄い黒を重ねる
                styleBoxHover.CornerRadiusTopLeft = 8;
                styleBoxHover.CornerRadiusTopRight = 8;
                styleBoxHover.CornerRadiusBottomLeft = 8;
                styleBoxHover.CornerRadiusBottomRight = 8;
                itemBtn.AddThemeStyleboxOverride("hover", styleBoxHover);

                // クリックイベントのバインド
                string internalName = prov.InternalName;
                itemBtn.Pressed += () => OnProviderSelected(internalName);
                
                itemPanel.AddChild(itemBtn);

                _providerListContainer.AddChild(itemPanel);
            }
        }

        /// <summary>
        /// プロバイダーが選択されたときの処理
        /// </summary>
        private async void OnProviderSelected(string internalName)
        {
            if (_isUpdatingUI) return;

            // 即時保存
            SystemConfig.Instance.VoiceService = internalName;
            SystemConfig.Instance.Save();

            // UIの再構成
            PopulateProviderList();
            UpdatePanelsVisibility();

            var prov = _providers.FirstOrDefault(p => p.InternalName == internalName);
            if (prov != null && prov.IsImplemented)
            {
                if (VoiceAiManager.Instance.VoiceAiServices.TryGetValue(internalName, out var service))
                {
                    VoiceAiManager.Instance.CurrentService = service;
                    
                    string serviceUrl = SystemConfig.Instance.GetVoiceServiceUrl(internalName, service.EndPoint);
                    service.Url = serviceUrl;
                    _voiceAiUrlTextField.Text = serviceUrl;
                    
                    UpdateSettingsVisibility(internalName);
                    
                    await UpdateModelAndSpeakerList(service);
                }
            }
        }

        /// <summary>
        /// 各カラムパネル・コントロールの表示制御
        /// </summary>
        private void UpdatePanelsVisibility()
        {
            string serviceName = SystemConfig.Instance.VoiceService;
            var prov = _providers.FirstOrDefault(p => p.InternalName == serviceName);

            var scrollContainer = _parametersVBox.GetParent<Control>();

            if (prov == null || !prov.IsImplemented)
            {
                // 未実装エンジンの場合は右ペインを未実装画面にする
                if (scrollContainer != null)
                {
                    scrollContainer.Visible = false;
                }
                _notImplementedPanel.Visible = true;
            }
            else
            {
                // 実装済みの場合はパラメータ画面を表示
                if (scrollContainer != null)
                {
                    scrollContainer.Visible = true;
                }
                _notImplementedPanel.Visible = false;

                UpdateSettingsVisibility(serviceName);
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
