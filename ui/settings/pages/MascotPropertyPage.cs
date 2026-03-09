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

        private ItemList _mascotList = null!;
        private Label _nameLabel = null!;
        private Label _voiceLabel = null!;
        private Label _styleLabel = null!;

        public override void _Ready()
        {
            _mascotList = GetNode<ItemList>("%MascotList");
            _nameLabel = GetNode<Label>("%NameLabel");
            _voiceLabel = GetNode<Label>("%VoiceLabel");
            _styleLabel = GetNode<Label>("%StyleLabel");

            _mascotList.ItemSelected += OnMascotSelected;
            
            var editButton = GetNode<Button>("%EditButton");
            editButton.Pressed += () => GD.Print("MascotEditWindow is not migrated yet.");

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
