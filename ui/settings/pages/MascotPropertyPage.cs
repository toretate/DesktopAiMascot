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

        private void PopulateMascotList()
        {
            _mascotList.Clear();
            _mascotList.FixedIconSize = new Vector2I(80, 80);
            
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
            int selectedIndex = 0;
            int index = 0;

            foreach (var model in MascotManager.Instance.MascotModels.Values)
            {
                _mascotList.AddItem(model.Name);
                
                // カバー画像の読み込みと設定
                string mascotDir = Path.Combine(baseDir, "assets", "mascots", model.Name);
                string coverPath = Path.Combine(mascotDir, "cover.png");
                
                if (!File.Exists(coverPath) && model.ImagePaths.Length > 0)
                {
                    coverPath = Path.Combine(baseDir, model.ImagePaths[0]);
                }
                
                if (File.Exists(coverPath))
                {
                    var texture = DesktopAiMascot.utils.ImageLoadHelper.LoadGodotTexture(coverPath);
                    if (texture != null)
                    {
                        _mascotList.SetItemIcon(index, texture);
                    }
                }

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
                mascotEditWindow.PopupCentered();
            }
            else
            {
                GD.PrintErr("MascotEditWindow.tscnのロードに失敗しました。");
            }
        }
    }
}
