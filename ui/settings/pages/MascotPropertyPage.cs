using Godot;
using System;
using System.IO;
using System.Collections.Generic;
using DesktopAiMascot.mascots;
using DesktopAiMascot.aiservice;
using Label = Godot.Label;
using Button = Godot.Button;
using Color = Godot.Color;

namespace DesktopAiMascot.ui.settings.pages
{
    public partial class MascotPropertyPage : MarginContainer
    {
        public event Action<MascotModel>? MascotChanged;

        private VBoxContainer _mascotListContainer = null!;
        private Label _nameLabel = null!;
        private Label _descLabel = null!;
        private Label _voiceLabel = null!;
        private Label _styleLabel = null!;
        private TextureRect _previewTexture = null!;

        // 生成したカードボタンを保持する辞書（マスコット名 -> ボタン）
        private readonly Dictionary<string, Button> _cardButtons = new();

        public override void _Ready()
        {
            _mascotListContainer = GetNode<VBoxContainer>("%MascotListContainer");
            _nameLabel = GetNode<Label>("%NameLabel");
            _descLabel = GetNode<Label>("%DescLabel");
            _voiceLabel = GetNode<Label>("%VoiceLabel");
            _styleLabel = GetNode<Label>("%StyleLabel");
            _previewTexture = GetNode<TextureRect>("%PreviewTexture");

            var editButton = GetNode<Button>("%EditButton");
            editButton.Pressed += OnEditButtonPressed;

            CallDeferred(MethodName.InitData);
        }

        private void InitData()
        {
            if (MascotManager.Instance.MascotModels.Count == 0)
            {
                MascotManager.Instance.Load();
            }

            PopulateMascotList();
            UpdateLabels();
        }

        private StyleBoxFlat CreateCardStyle(bool selected, bool hover)
        {
            var style = new StyleBoxFlat();
            style.CornerRadiusTopLeft = 8;
            style.CornerRadiusTopRight = 8;
            style.CornerRadiusBottomRight = 8;
            style.CornerRadiusBottomLeft = 8;

            if (selected)
            {
                // 薄い青グラデーション背景
                style.BgColor = new Color(0.93f, 0.96f, 1.0f, 1.0f);
                style.BorderWidthLeft = 1;
                style.BorderWidthTop = 1;
                style.BorderWidthRight = 1;
                style.BorderWidthBottom = 1;
                style.BorderColor = new Color(0.5f, 0.72f, 0.95f, 1.0f);
                style.ShadowColor = new Color(0.1f, 0.3f, 0.6f, 0.05f);
                style.ShadowSize = 6;
                style.ShadowOffset = new Vector2(0, 3);
            }
            else if (hover)
            {
                // ホバー時
                style.BgColor = new Color(0.97f, 0.98f, 1.0f, 1.0f);
                style.BorderWidthLeft = 1;
                style.BorderWidthTop = 1;
                style.BorderWidthRight = 1;
                style.BorderWidthBottom = 1;
                style.BorderColor = new Color(0.85f, 0.85f, 0.88f, 1.0f);
                style.ShadowColor = new Color(0, 0, 0, 0.02f);
                style.ShadowSize = 4;
                style.ShadowOffset = new Vector2(0, 2);
            }
            else
            {
                // 通常時（白いカード）
                style.BgColor = new Color(1.0f, 1.0f, 1.0f, 1.0f);
                style.BorderWidthLeft = 1;
                style.BorderWidthTop = 1;
                style.BorderWidthRight = 1;
                style.BorderWidthBottom = 1;
                style.BorderColor = new Color(0.9f, 0.9f, 0.92f, 1.0f);
                style.ShadowColor = new Color(0, 0, 0, 0.02f);
                style.ShadowSize = 4;
                style.ShadowOffset = new Vector2(0, 2);
            }
            return style;
        }

        private void PopulateMascotList()
        {
            // 古い子ノードを削除してクリア
            foreach (Node child in _mascotListContainer.GetChildren())
            {
                child.QueueFree();
            }
            _cardButtons.Clear();

            // 実行時パスの取得（エディタ実行時とビルド後で分ける）
            string baseDir;
            if (Godot.OS.HasFeature("editor"))
            {
                baseDir = Godot.ProjectSettings.GlobalizePath("res://");
            }
            else
            {
                baseDir = System.IO.Path.GetDirectoryName(Godot.OS.GetExecutablePath()) ?? AppDomain.CurrentDomain.BaseDirectory;
            }

            string? currentName = MascotManager.Instance.CurrentModel?.Name;

            foreach (var model in MascotManager.Instance.MascotModels.Values)
            {
                bool isSelected = !string.IsNullOrEmpty(currentName) && model.Name == currentName;

                // カバー画像の読み込みと設定
                string mascotDir = Path.Combine(baseDir, "assets", "mascots", model.Name);
                string coverPath = Path.Combine(mascotDir, "cover.png");

                if (!File.Exists(coverPath) && model.GetPrimaryImage() != null)
                {
                    coverPath = model.GetPrimaryImage()!.ImagePath;
                }

                Texture2D? texture = null;
                if (File.Exists(coverPath))
                {
                    texture = DesktopAiMascot.utils.ImageLoadHelper.LoadGodotTexture(coverPath);
                }

                // カードボタンの生成
                var button = new Button();
                button.CustomMinimumSize = new Vector2(0, 96);
                button.ClipChildren = CanvasItem.ClipChildrenMode.Disabled;
                button.FocusMode = FocusModeEnum.None;

                // スタイルを動的適用
                UpdateCardButtonStyle(button, model.Name, isSelected);

                // レイアウト設定用のMarginContainer
                var margin = new MarginContainer();
                margin.Name = "MarginContainer";
                margin.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect, LayoutPresetMode.Minsize, 0);
                margin.AddThemeConstantOverride("margin_left", 12);
                margin.AddThemeConstantOverride("margin_top", 12);
                margin.AddThemeConstantOverride("margin_right", 12);
                margin.AddThemeConstantOverride("margin_bottom", 12);
                margin.MouseFilter = MouseFilterEnum.Ignore;

                var hbox = new HBoxContainer();
                hbox.Name = "HBoxContainer";
                hbox.AddThemeConstantOverride("separation", 16);
                hbox.MouseFilter = MouseFilterEnum.Ignore;

                // 丸みのあるアバターコンテナ
                var avatarPanel = new PanelContainer();
                avatarPanel.CustomMinimumSize = new Vector2(72, 72);
                avatarPanel.Size = new Vector2(72, 72);
                // AND_CLIP (2) をキャストして指定することで、環境ごとの Enum 定義名ゆらぎを回避
                avatarPanel.ClipChildren = (CanvasItem.ClipChildrenMode)2;
                avatarPanel.MouseFilter = MouseFilterEnum.Ignore;

                var avatarStyle = new StyleBoxFlat();
                avatarStyle.CornerRadiusTopLeft = 8;
                avatarStyle.CornerRadiusTopRight = 8;
                avatarStyle.CornerRadiusBottomRight = 8;
                avatarStyle.CornerRadiusBottomLeft = 8;
                // AndClip は親のアルファ値でマスクするため不透明 (1.0) に設定
                // 画像がない場合のプレースホルダーを兼ねて薄いブルーグレーにする
                avatarStyle.BgColor = new Color(0.9f, 0.92f, 0.94f, 1.0f);
                avatarPanel.AddThemeStyleboxOverride("panel", avatarStyle);

                // アバター画像 (TextureRect)
                var textureRect = new TextureRect();
                textureRect.CustomMinimumSize = new Vector2(72, 72);
                textureRect.ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize;
                textureRect.StretchMode = TextureRect.StretchModeEnum.KeepAspectCovered;
                textureRect.Texture = texture;
                textureRect.MouseFilter = MouseFilterEnum.Ignore;
                avatarPanel.AddChild(textureRect);

                hbox.AddChild(avatarPanel);

                // 名前 (Label)
                var label = new Label();
                label.Name = "Label";
                label.Text = model.Name;
                label.MouseFilter = MouseFilterEnum.Ignore;

                // ラベルのフォント設定を美しく
                var labelSettings = new LabelSettings();
                labelSettings.FontSize = 18;
                labelSettings.FontColor = isSelected ? new Color(0.1f, 0.45f, 0.85f, 1.0f) : new Color(0.15f, 0.15f, 0.2f, 1.0f);
                label.LabelSettings = labelSettings;

                hbox.AddChild(label);
                margin.AddChild(hbox);
                button.AddChild(margin);

                // クリックイベント
                string name = model.Name;
                button.Pressed += () => OnMascotCardPressed(name);

                _mascotListContainer.AddChild(button);
                _cardButtons[model.Name] = button;
            }

            // 初期選択状態の処理
            if (!string.IsNullOrEmpty(currentName) && MascotManager.Instance.MascotModels.ContainsKey(currentName))
            {
                OnMascotCardPressed(currentName);
            }
            else if (MascotManager.Instance.MascotModels.Count > 0)
            {
                var firstKey = new List<string>(MascotManager.Instance.MascotModels.Keys)[0];
                OnMascotCardPressed(firstKey);
            }
        }

        private void UpdateCardButtonStyle(Button button, string mascotName, bool isSelected)
        {
            var normalStyle = CreateCardStyle(isSelected, false);
            var hoverStyle = CreateCardStyle(isSelected, true);

            button.AddThemeStyleboxOverride("normal", normalStyle);
            button.AddThemeStyleboxOverride("hover", hoverStyle);
            button.AddThemeStyleboxOverride("pressed", normalStyle);
            button.AddThemeStyleboxOverride("focus", normalStyle);

            // ラベルの文字色を更新
            var margin = button.GetNodeOrNull<MarginContainer>("MarginContainer");
            if (margin != null)
            {
                var hbox = margin.GetNodeOrNull<HBoxContainer>("HBoxContainer");
                if (hbox != null)
                {
                    var label = hbox.GetNodeOrNull<Label>("Label");
                    if (label != null)
                    {
                        var labelSettings = new LabelSettings();
                        labelSettings.FontSize = 18;
                        labelSettings.FontColor = isSelected ? new Color(0.1f, 0.45f, 0.85f, 1.0f) : new Color(0.15f, 0.15f, 0.2f, 1.0f);
                        label.LabelSettings = labelSettings;
                    }
                }
            }
        }

        private void OnMascotCardPressed(string name)
        {
            SystemConfig.Instance.MascotName = name;
            SystemConfig.Instance.Save();

            var model = MascotManager.Instance.GetMascotByName(name);
            if (model != null)
            {
                MascotManager.Instance.CurrentModel = model;
                // Apply voice
                ApplyVoiceConfig(model);
                UpdateLabels();

                // すべてのカードボタンのスタイルを更新
                foreach (var kvp in _cardButtons)
                {
                    bool isSelected = kvp.Key == name;
                    UpdateCardButtonStyle(kvp.Value, kvp.Key, isSelected);
                }

                MascotChanged?.Invoke(model);
            }
        }

        private void ApplyVoiceConfig(MascotModel mascot)
        {
            var currentService = VoiceAiManager.Instance.CurrentService;
            if (currentService == null) return;

            if (mascot.Config.Voice != null && mascot.Config.Voice.TryGetValue(currentService.Name, out var vconf))
            {
                if (!string.IsNullOrEmpty(vconf.Model))
                {
                    currentService.Model = vconf.Model;
                    SystemConfig.Instance.VoiceServiceModel = vconf.Model;
                }
                if (!string.IsNullOrEmpty(vconf.Speaker))
                {
                    currentService.Speaker = vconf.Speaker;
                    SystemConfig.Instance.VoiceServiceSpeaker = vconf.Speaker;
                }
                SystemConfig.Instance.Save();
            }
        }

        private void UpdateLabels()
        {
            var currentModel = MascotManager.Instance.CurrentModel;
            _nameLabel.Text = currentModel?.Name ?? "未選択";
            _descLabel.Text = currentModel?.Name?.ToLower() ?? "未選択"; // デザインに合わせて小文字などを表示

            // プレビュー画像の更新
            if (currentModel != null)
            {
                var previewImage = currentModel.GetFrontImage() ?? currentModel.GetPrimaryImage();
                if (previewImage != null && File.Exists(previewImage.ImagePath))
                {
                    try
                    {
                        var texture = DesktopAiMascot.utils.ImageLoadHelper.LoadGodotTexture(previewImage.ImagePath);
                        _previewTexture.Texture = texture;
                    }
                    catch (Exception ex)
                    {
                        GD.PrintErr($"[MascotPropertyPage] プレビュー画像のロードに失敗しました: {ex.Message}");
                        _previewTexture.Texture = null;
                    }
                }
                else
                {
                    _previewTexture.Texture = null;
                }
            }
            else
            {
                _previewTexture.Texture = null;
            }

            var currentService = VoiceAiManager.Instance.CurrentService;
            if (currentService != null)
            {
                string info = currentService.Name;
                if (!string.IsNullOrEmpty(currentService.Model)) info += $"\nモデル: {currentService.Model}";
                if (!string.IsNullOrEmpty(currentService.Speaker)) info += $"\nスピーカー: {currentService.Speaker}";
                _voiceLabel.Text = info;
            }
            else
            {
                _voiceLabel.Text = "未設定";
            }

            if (currentModel?.Config.Voice != null && currentService != null && 
                currentModel.Config.Voice.TryGetValue(currentService.Name, out var vconf))
            {
                string style = $"{currentService.Name} 設定:";
                if (!string.IsNullOrEmpty(vconf.Model)) style += $"\nモデル: {vconf.Model}";
                if (!string.IsNullOrEmpty(vconf.Speaker)) style += $"\nスピーカー: {vconf.Speaker}";
                _styleLabel.Text = style;
            }
            else
            {
                _styleLabel.Text = "未設定";
            }
        }

        private void OnEditButtonPressed()
        {
            var currentModel = MascotManager.Instance.CurrentModel;
            if (currentModel == null)
            {
                GD.PrintErr("マスコットが選択されていません。");
                return;
            }

            // MascotEditWindowをロードして表示
            var mascotEditWindowScene = GD.Load<PackedScene>("res://ui/mascot_edit/MascotEditWindow.tscn");
            if (mascotEditWindowScene != null)
            {
                var mascotEditWindow = mascotEditWindowScene.Instantiate<ui.mascot_edit.MascotEditWindow>();
                GetTree().Root.AddChild(mascotEditWindow);
                mascotEditWindow.Initialize(currentModel);

                // ウィンドウを最前面に表示
                mascotEditWindow.AlwaysOnTop = true;
                mascotEditWindow.PopupCentered();

                // 明示的にフォーカスを設定
                mascotEditWindow.GrabFocus();
            }
            else
            {
                GD.PrintErr("MascotEditWindow.tscnのロードに失敗しました。");
            }
        }
    }
}
