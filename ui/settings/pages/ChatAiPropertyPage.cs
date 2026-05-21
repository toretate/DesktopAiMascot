using Godot;
using System;
using System.Linq;
using System.Collections.Generic;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.aiservice.chat;
using Button = Godot.Button;
using CheckBox = Godot.CheckBox;
using Label = Godot.Label;
using Control = Godot.Control;
using Color = Godot.Color;

namespace DesktopAiMascot.ui.settings.pages
{
    /// <summary>
    /// Chat AI 設定画面を表すクラス。
    /// リデザインされた3カラム（実質3ペイン）のモダンなレイアウトを制御します。
    /// </summary>
    public partial class ChatAiPropertyPage : MarginContainer
    {
        private VBoxContainer _providerListContainer = null!;
        private VBoxContainer _parametersVBox = null!;
        private PanelContainer _notImplementedPanel = null!;

        private OptionButton _modelOptionBtn = null!;
        private Button _refreshModelsBtn = null!;
        
        private HSlider _tempSlider = null!;
        private Label _tempValLabel = null!;
        private HSlider _topKSlider = null!;
        private Label _topKValLabel = null!;
        
        private CheckButton _topKToggleCheck = null!;
        private CheckButton _audioRandomCheck = null!;
        private CheckButton _bridgesCheck = null!;
        private CheckBox _filterChatModelsCheck = null!;
        
        private HBoxContainer _hboxEndpoint = null!;
        private LineEdit _endpointEdit = null!;
        private HBoxContainer _hboxServerStatus = null!;
        private Button _checkServerBtn = null!;
        private Label _serverStatusLabel = null!;
        
        private Button _cancelBtn = null!;
        private Button _saveBtn = null!;

        private bool _isUpdatingUI = false;
        private ModelDisplayItem[]? _currentModels;

        // プロバイダー情報メタデータ定義
        private class ProviderInfo
        {
            public string Name { get; set; } = "";
            public string InternalName { get; set; } = "";
            public string Description { get; set; } = "";
            public string IconPath { get; set; } = "";
            public bool IsImplemented { get; set; }
        }

        // 定義された6つのプロバイダーメタデータ
        private readonly List<ProviderInfo> _providers = new List<ProviderInfo>
        {
            new ProviderInfo { Name = "Gemini", InternalName = "Gemini (AI Studio)", Description = "Gemini (AI Studio) - Google's large language model.", IconPath = "res://assets/icons/providers/gemini_icon.svg", IsImplemented = true },
            new ProviderInfo { Name = "Claude", InternalName = "Claude", Description = "Claude (Anthropic) - Safety-focused large language model.", IconPath = "res://assets/icons/providers/claude_icon.svg", IsImplemented = false },
            new ProviderInfo { Name = "Codex", InternalName = "Codex", Description = "Codex (OpenAI) - Code-specific generation and analysis.", IconPath = "res://assets/icons/providers/codex_icon.png", IsImplemented = false },
            new ProviderInfo { Name = "LM Studio", InternalName = "LM Studio", Description = "LM Studio - Local model host and interface.", IconPath = "res://assets/icons/providers/lm_studio_icon.png", IsImplemented = true },
            new ProviderInfo { Name = "Ollama", InternalName = "Ollama", Description = "Ollama - Local command-line model interface.", IconPath = "res://assets/icons/providers/ollama_icon.svg", IsImplemented = false },
            new ProviderInfo { Name = "Foundry Local", InternalName = "Foundry Local", Description = "Foundry Local - Local model development and hosting.", IconPath = "res://assets/icons/providers/foundry_icon.svg", IsImplemented = true }
        };

        public override void _Ready()
        {
            _providerListContainer = GetNode<VBoxContainer>("%ProviderListContainer");
            _parametersVBox = GetNode<VBoxContainer>("%ParametersVBox");
            _notImplementedPanel = GetNode<PanelContainer>("%NotImplementedPanel");

            _modelOptionBtn = GetNode<OptionButton>("%ModelOptionBtn");
            _refreshModelsBtn = GetNode<Button>("%RefreshModelsBtn");
            
            _tempSlider = GetNode<HSlider>("%TempSlider");
            _tempValLabel = GetNode<Label>("%TempValLabel");
            _topKSlider = GetNode<HSlider>("%TopKSlider");
            _topKValLabel = GetNode<Label>("%TopKValLabel");
            
            _topKToggleCheck = GetNode<CheckButton>("%TopKToggleCheck");
            _audioRandomCheck = GetNode<CheckButton>("%AudioRandomCheck");
            _bridgesCheck = GetNode<CheckButton>("%BridgesCheck");
            _filterChatModelsCheck = GetNode<CheckBox>("%FilterChatModelsCheck");
            
            _hboxEndpoint = GetNode<HBoxContainer>("%HBoxEndpoint");
            _endpointEdit = GetNode<LineEdit>("%EndpointEdit");
            _hboxServerStatus = GetNode<HBoxContainer>("%HBoxServerStatus");
            _checkServerBtn = GetNode<Button>("%CheckServerBtn");
            _serverStatusLabel = GetNode<Label>("%ServerStatusLabel");
            
            _cancelBtn = GetNode<Button>("%CancelBtn");
            _saveBtn = GetNode<Button>("%SaveBtn");

            // イベントハンドラーの接続
            _modelOptionBtn.ItemSelected += OnModelSelected;
            _refreshModelsBtn.Pressed += OnRefreshModelsPressed;
            
            _tempSlider.ValueChanged += OnTemperatureChanged;
            _topKSlider.ValueChanged += OnTopKChanged;
            
            _topKToggleCheck.Toggled += OnTopKToggleToggled;
            _audioRandomCheck.Toggled += OnAudioRandomToggled;
            _bridgesCheck.Toggled += OnBridgesToggled;
            _filterChatModelsCheck.Toggled += OnFilterToggled;
            
            _endpointEdit.TextChanged += OnEndpointChanged;
            _checkServerBtn.Pressed += OnCheckServerPressed;
            
            _cancelBtn.Pressed += OnClosePressed;
            _saveBtn.Pressed += OnClosePressed;

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

        /// <summary>
        /// 画面初期表示時の UI 更新
        /// </summary>
        private void InitializeUI()
        {
            if (_isUpdatingUI) return;
            _isUpdatingUI = true;

            // プロバイダー固定リストの再構築
            PopulateProviderList();

            // 設定パラメータのロード
            _tempSlider.Value = SystemConfig.Instance.ChatAiTemperature;
            _tempValLabel.Text = SystemConfig.Instance.ChatAiTemperature.ToString("0.0");
            
            _topKSlider.Value = SystemConfig.Instance.ChatAiTopK;
            _topKValLabel.Text = SystemConfig.Instance.ChatAiTopK.ToString();
            
            _topKToggleCheck.ButtonPressed = SystemConfig.Instance.ChatAiTopKToggle;
            _audioRandomCheck.ButtonPressed = SystemConfig.Instance.ChatAiAudioRandomElititors;
            _bridgesCheck.ButtonPressed = SystemConfig.Instance.ChatAiBridgesRopherlyModels;
            _filterChatModelsCheck.ButtonPressed = SystemConfig.Instance.ChatAiFilterChatOnlyModels;
            
            _endpointEdit.Text = SystemConfig.Instance.ChatAiEndpoint ?? "";

            UpdatePanelsVisibility();
            
            _isUpdatingUI = false;

            // 現在のプロバイダーが実装済みの場合は、モデル一覧を取得
            var prov = _providers.FirstOrDefault(p => p.InternalName == SystemConfig.Instance.LlmService);
            if (prov != null && prov.IsImplemented)
            {
                _ = RefreshModelsAsync();
            }
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

            string currentService = SystemConfig.Instance.LlmService;

            foreach (var prov in _providers)
            {
                bool isSelected = prov.InternalName == currentService;

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
                    if (!string.IsNullOrEmpty(prov.IconPath) && ResourceLoader.Exists(prov.IconPath))
                    {
                        iconRect.Texture = ResourceLoader.Load<Texture2D>(prov.IconPath);
                    }
                }
                catch (Exception ex)
                {
                    GD.PrintErr($"Failed to load provider icon: {ex.Message}");
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
        private void OnProviderSelected(string internalName)
        {
            if (_isUpdatingUI) return;

            // 即時保存
            SystemConfig.Instance.LlmService = internalName;
            SystemConfig.Instance.Save();

            // UIの再構成
            PopulateProviderList();
            UpdatePanelsVisibility();

            // 実装済みエンジンの場合はモデルリストをリフレッシュ
            var prov = _providers.FirstOrDefault(p => p.InternalName == internalName);
            if (prov != null && prov.IsImplemented)
            {
                _ = RefreshModelsAsync();
            }
        }

        /// <summary>
        /// 各カラムパネル・コントロールの表示制御
        /// </summary>
        private void UpdatePanelsVisibility()
        {
            string service = SystemConfig.Instance.LlmService;
            var prov = _providers.FirstOrDefault(p => p.InternalName == service);

            // _parametersVBox の親である ScrollContainer を取得して表示・非表示を制御
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

                bool isLocal = (service == "LM Studio" || service == "Foundry Local");
                bool isGeminiStudio = (service == "Gemini (AI Studio)");

                _hboxEndpoint.Visible = isLocal;
                _hboxServerStatus.Visible = isLocal;
                _filterChatModelsCheck.Visible = isGeminiStudio;
            }
        }

        #region 設定パラメータ変更時のイベントハンドラー

        private void OnTemperatureChanged(double value)
        {
            if (_isUpdatingUI) return;
            
            _tempValLabel.Text = value.ToString("0.0");
            SystemConfig.Instance.ChatAiTemperature = value;
            SystemConfig.Instance.Save();
        }

        private void OnTopKChanged(double value)
        {
            if (_isUpdatingUI) return;

            int intVal = (int)value;
            _topKValLabel.Text = intVal.ToString();
            SystemConfig.Instance.ChatAiTopK = intVal;
            SystemConfig.Instance.Save();
        }

        private void OnTopKToggleToggled(bool toggledOn)
        {
            if (_isUpdatingUI) return;

            SystemConfig.Instance.ChatAiTopKToggle = toggledOn;
            SystemConfig.Instance.Save();
        }

        private void OnAudioRandomToggled(bool toggledOn)
        {
            if (_isUpdatingUI) return;

            SystemConfig.Instance.ChatAiAudioRandomElititors = toggledOn;
            SystemConfig.Instance.Save();
        }

        private void OnBridgesToggled(bool toggledOn)
        {
            if (_isUpdatingUI) return;

            SystemConfig.Instance.ChatAiBridgesRopherlyModels = toggledOn;
            SystemConfig.Instance.Save();
        }

        private void OnEndpointChanged(string newText)
        {
            if (_isUpdatingUI) return;
            
            SystemConfig.Instance.ChatAiEndpoint = newText;
            SystemConfig.Instance.Save();
        }

        private void OnFilterToggled(bool toggledOn)
        {
            if (_isUpdatingUI) return;

            SystemConfig.Instance.ChatAiFilterChatOnlyModels = toggledOn;
            SystemConfig.Instance.Save();

            PopulateModelsCombo();
        }

        #endregion

        #region サーバー接続確認 & モデルリフレッシュロジック

        private async void OnCheckServerPressed()
        {
            _serverStatusLabel.Text = "Checking...";
            _serverStatusLabel.Modulate = Colors.Gray;

            string serviceName = SystemConfig.Instance.LlmService;
            if (serviceName == "LM Studio" || serviceName == "Foundry Local")
            {
                try
                {
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
                catch (System.Net.Http.HttpRequestException)
                {
                    // RULE[user_global] に従い、接続エラーのシンプルなデバッグメッセージを出力
                    _serverStatusLabel.Text = "✗ Error";
                    _serverStatusLabel.Modulate = Colors.Red;
                    System.Diagnostics.Debug.WriteLine($"[ChatAiPropertyPage] {serviceName}との接続エラー (HttpRequestException)");
                }
                catch (System.Threading.Tasks.TaskCanceledException)
                {
                    _serverStatusLabel.Text = "✗ Timeout";
                    _serverStatusLabel.Modulate = Colors.Red;
                    System.Diagnostics.Debug.WriteLine($"[ChatAiPropertyPage] {serviceName}との接続エラー (TaskCanceledException)");
                }
                catch (Exception ex)
                {
                    _serverStatusLabel.Text = "✗ Error";
                    _serverStatusLabel.Modulate = Colors.Red;
                    System.Diagnostics.Debug.WriteLine($"[ChatAiPropertyPage] 予期せぬエラー: {ex.Message}");
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
            
            // Gemini の場合かつチャット専用フィルターが ON の場合
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

        #endregion

        #region ウィンドウクローズ処理

        /// <summary>
        /// 親ウィンドウを見つけて閉じる (Hide) 処理
        /// </summary>
        private void OnClosePressed()
        {
            Node parent = GetParent();
            while (parent != null)
            {
                if (parent is Window window)
                {
                    window.Hide();
                    break;
                }
                parent = parent.GetParent();
            }
        }

        #endregion
    }
}
