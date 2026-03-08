using Godot;
using System;
using System.IO;
using DesktopAiMascot.mascots;
using DesktopAiMascot.aiservice;
using Label = Godot.Label;
using Button = Godot.Button;

namespace DesktopAiMascot.ui.settings.pages
{
    public partial class MascotPropertyPage : MarginContainer
    {
        public event Action<MascotModel>? MascotChanged;

        private ItemList _mascotList;
        private Label _nameLabel;
        private Label _voiceLabel;
        private Label _styleLabel;

        public MascotPropertyPage()
        {
            SetAnchorsPreset(Godot.Control.LayoutPreset.FullRect);
            
            var mainHBox = new HBoxContainer();
            mainHBox.SizeFlagsHorizontal = Godot.Control.SizeFlags.ExpandFill;
            mainHBox.SizeFlagsVertical = Godot.Control.SizeFlags.ExpandFill;
            AddChild(mainHBox);

            // Left side
            var leftVBox = new VBoxContainer();
            leftVBox.CustomMinimumSize = new Vector2(150, 0);
            leftVBox.SizeFlagsVertical = Godot.Control.SizeFlags.ExpandFill;
            mainHBox.AddChild(leftVBox);

            _mascotList = new ItemList();
            _mascotList.SizeFlagsVertical = Godot.Control.SizeFlags.ExpandFill;
            _mascotList.ItemSelected += OnMascotSelected;
            leftVBox.AddChild(_mascotList);

            var addButton = new Button { Text = "Add" };
            leftVBox.AddChild(addButton);

            // Right side
            var rightVBox = new VBoxContainer();
            rightVBox.SizeFlagsHorizontal = Godot.Control.SizeFlags.ExpandFill;
            rightVBox.SizeFlagsVertical = Godot.Control.SizeFlags.ExpandFill;
            rightVBox.AddThemeConstantOverride("separation", 10);
            mainHBox.AddChild(rightVBox);

            var infoPanel = new PanelContainer();
            rightVBox.AddChild(infoPanel);

            var infoVBox = new VBoxContainer();
            infoVBox.AddThemeConstantOverride("separation", 5);
            infoPanel.AddChild(infoVBox);

            infoVBox.AddChild(new Label { Text = "名前", ThemeTypeVariation = "HeaderLarge" });
            _nameLabel = new Label { Text = "未選択", CustomMinimumSize = new Vector2(0, 30) };
            infoVBox.AddChild(_nameLabel);

            infoVBox.AddChild(new Label { Text = "現在設定中の音声", ThemeTypeVariation = "HeaderLarge" });
            _voiceLabel = new Label { Text = "未設定", AutowrapMode = TextServer.AutowrapMode.Word };
            infoVBox.AddChild(_voiceLabel);

            infoVBox.AddChild(new Label { Text = "音声スタイル", ThemeTypeVariation = "HeaderLarge" });
            _styleLabel = new Label { Text = "未設定", AutowrapMode = TextServer.AutowrapMode.Word };
            infoVBox.AddChild(_styleLabel);

            // Action Buttons
            var editButton = new Button { Text = "Edit" };
            editButton.Pressed += () => GD.Print("MascotEditWindow is not migrated yet.");
            rightVBox.AddChild(editButton);

            var generateEmotesBtn = new Button { Text = "Generate Emotes" };
            rightVBox.AddChild(generateEmotesBtn);

            var removeBgBtn = new Button { Text = "Remove Background" };
            rightVBox.AddChild(removeBgBtn);

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

        private void PopulateMascotList()
        {
            _mascotList.Clear();
            
            string? currentName = MascotManager.Instance.CurrentModel?.Name;
            int selectedIndex = 0;
            int index = 0;

            foreach (var model in MascotManager.Instance.MascotModels.Values)
            {
                _mascotList.AddItem(model.Name);
                
                // Set cover image later if needed with _mascotList.SetItemIcon
                if (!string.IsNullOrEmpty(currentName) && model.Name == currentName)
                {
                    selectedIndex = index;
                }
                index++;
            }

            if (_mascotList.ItemCount > 0)
            {
                _mascotList.Select(selectedIndex);
                OnMascotSelected(selectedIndex);
            }
        }

        private void OnMascotSelected(long index)
        {
            var name = _mascotList.GetItemText((int)index);
            SystemConfig.Instance.MascotName = name;
            SystemConfig.Instance.Save();

            var model = MascotManager.Instance.GetMascotByName(name);
            if (model != null)
            {
                MascotManager.Instance.CurrentModel = model;
                // Apply voice
                ApplyVoiceConfig(model);
                UpdateLabels();
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
    }
}
