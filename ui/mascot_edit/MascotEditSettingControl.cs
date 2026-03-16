using Godot;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using DesktopAiMascot.mascots;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.aiservice.image;
using DesktopAiMascot.utils;
using DesktopAiMascot.skills;
using Button = Godot.Button;
using Label = Godot.Label;
using FileDialog = Godot.FileDialog;

namespace DesktopAiMascot.ui.mascot_edit
{
    /// <summary>
    /// マスコット編集設定コントロール
    /// </summary>
    public partial class MascotEditSettingControl : VBoxContainer
    {
        public event Action? RequestReloadImageList;

        private MascotModel? _mascotModel;
        private string _mascotDirectory = string.Empty;
        private string _configPath = string.Empty;
        private MascotConfig _mascotConfig = new MascotConfig();

        private MascotImageSet? _selectedMascotImageSet;
        public MascotImageSet? SelectedMascotImageSet
        {
            get => _selectedMascotImageSet;
            set
            {
                _selectedMascotImageSet = value;
                UpdateSelectionState();
            }
        }

        private LineEdit _displayNameLineEdit = null!;
        private Label _configPathLabel = null!;
        private Button _editButton = null!;
        private LineEdit _profileFileLineEdit = null!;
        private Button _generateButton = null!;
        private OptionButton _profileModelComboBox = null!;
        private TextEdit _profileTextEdit = null!;
        private Button _removeBackgroundButton = null!;
        private OptionButton _bgRemovalServiceComboBox = null!;
        private Button _restoreBackgroundButton = null!;
        private Button _addImageButton = null!;
        private MarginContainer _angleViewContainer = null!;
        private MarginContainer _emoteGenerationContainer = null!;

        private GoogleAiStudioService? _googleAiService;
        private ComfyQwen3ImageEditService? _comfyQwen3ImageEditService;
        private RemoveBGImage? _removeBgImage;
        private GenerateAngleImage? _angleImageGenerator;

        public override void _Ready()
        {
            _displayNameLineEdit = GetNode<LineEdit>("%DisplayNameLineEdit");
            _configPathLabel = GetNode<Label>("%ConfigPathLabel");
            _editButton = GetNode<Button>("%EditButton");
            _profileFileLineEdit = GetNode<LineEdit>("%ProfileFileLineEdit");
            _generateButton = GetNode<Button>("%GenerateButton");
            _profileModelComboBox = GetNode<OptionButton>("%ProfileModelComboBox");
            _profileTextEdit = GetNode<TextEdit>("%ProfileTextEdit");
            _removeBackgroundButton = GetNode<Button>("%RemoveBackgroundButton");
            _bgRemovalServiceComboBox = GetNode<OptionButton>("%BgRemovalServiceComboBox");
            _restoreBackgroundButton = GetNode<Button>("%RestoreBackgroundButton");
            _addImageButton = GetNode<Button>("%AddImageButton");
            _angleViewContainer = GetNode<MarginContainer>("%AngleViewContainer");
            _emoteGenerationContainer = GetNode<MarginContainer>("%EmoteGenerationContainer");

            _editButton.Pressed += OnEditButtonPressed;
            _generateButton.Pressed += OnGenerateButtonPressed;
            _removeBackgroundButton.Pressed += OnRemoveBackgroundButtonPressed;
            _restoreBackgroundButton.Pressed += OnRestoreBackgroundButtonPressed;
            _addImageButton.Pressed += OnAddImageButtonPressed;
        }

        /// <summary>
        /// MascotModelで初期化
        /// </summary>
        public void Initialize(MascotModel mascotModel)
        {
            _mascotModel = mascotModel;
            _mascotDirectory = _mascotModel.DirectoryPath;
            _configPath = Path.Combine(_mascotDirectory, "config.yaml");

            _googleAiService = new GoogleAiStudioService();
            _googleAiService.Initialize();
            _comfyQwen3ImageEditService = new ComfyQwen3ImageEditService();
            _removeBgImage = new RemoveBGImage(_mascotDirectory);
            _angleImageGenerator = new GenerateAngleImage(_googleAiService, _comfyQwen3ImageEditService);

            InitializeBackgroundRemovalServices();
            InitializeGenerateProfileModelComboBox();
            LoadMascotData();
        }

        private void InitializeBackgroundRemovalServices()
        {
            try
            {
                var services = ImageAiManager.Instance.ImageAiServices.Values.ToList();

                if (services.Count > 0)
                {
                    _bgRemovalServiceComboBox.Clear();
                    foreach (var service in services)
                    {
                        _bgRemovalServiceComboBox.AddItem(service.Name);
                    }
                    _bgRemovalServiceComboBox.Selected = 0;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditSettingControl] 背景削除サービス初期化エラー: {ex.Message}");
            }
        }

        private void InitializeGenerateProfileModelComboBox()
        {
            try
            {
                var serviceTable = LlmManager.GetAvailableLlmServices;
                var services = new List<string>();
                
                foreach (System.Data.DataRow row in serviceTable.Rows)
                {
                    var name = row["Name"]?.ToString() ?? string.Empty;
                    if (!string.IsNullOrEmpty(name))
                    {
                        services.Add(name);
                    }
                }

                _profileModelComboBox.Clear();
                foreach (var service in services)
                {
                    _profileModelComboBox.AddItem(service);
                }

                if (services.Count > 0)
                {
                    string currentLlm = SystemConfig.Instance.LlmService;
                    int index = services.IndexOf(currentLlm);
                    _profileModelComboBox.Selected = index >= 0 ? index : 0;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditSettingControl] プロフィール生成LLM初期化エラー: {ex.Message}");
            }
        }

        private void LoadMascotData()
        {
            if (_mascotModel == null) return;

            _displayNameLineEdit.Text = _mascotModel.Name;
            LoadSystemPrompt();
        }

        private void LoadSystemPrompt()
        {
            try
            {
                if (File.Exists(_configPath))
                {
                    _mascotConfig = MascotConfigIO.LoadFromFile(_configPath);
                    _profileTextEdit.Text = MascotConfigIO.SaveSystemPrompt(_mascotConfig.SystemPrompt);
                    _configPathLabel.Text = Path.GetFileName(_configPath);
                }
                else
                {
                    _mascotConfig = new MascotConfig();
                    _profileTextEdit.Text = MascotConfigIO.SaveSystemPrompt(_mascotConfig.SystemPrompt);
                    _configPathLabel.Text = Path.GetFileName(_configPath);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditSettingControl] システムプロンプト読み込みエラー: {ex.Message}");
                _profileTextEdit.Text = string.Empty;
            }
        }

        private void UpdateSelectionState()
        {
            bool isSelected = SelectedMascotImageSet != null && SelectedMascotImageSet.Image != null;
            _removeBackgroundButton.Disabled = !isSelected;

            if (isSelected && SelectedMascotImageSet != null && SelectedMascotImageSet.Image != null)
            {
                try
                {
                    var imageItem = SelectedMascotImageSet.Image;
                    string directory = Path.GetDirectoryName(imageItem.ImagePath) ?? "";
                    string fileNameWithoutExt = Path.GetFileNameWithoutExtension(imageItem.ImagePath);
                    string extension = Path.GetExtension(imageItem.ImagePath);

                    var backupFiles = Directory.GetFiles(directory, $"{fileNameWithoutExt}.*.back{extension}");
                    _restoreBackgroundButton.Disabled = backupFiles.Length == 0;

                    // TODO: AngleViewControlの更新
                    // TODO: 表情差分作成タブの初期化
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[MascotEditSettingControl] Image selection update error: {ex.Message}");
                    _restoreBackgroundButton.Disabled = true;
                }
            }
            else
            {
                _restoreBackgroundButton.Disabled = true;
            }
        }

        public string GetDisplayName()
        {
            return _displayNameLineEdit.Text.Trim();
        }

        public void SaveConfig()
        {
            try
            {
                _mascotConfig.SystemPrompt = MascotConfigIO.LoadSystemPrompt(_profileTextEdit.Text);
                MascotConfigIO.SaveToYaml(_mascotConfig, _configPath);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditSettingControl] システムプロンプト保存エラー: {ex.Message}");
                throw;
            }
        }

        private void OnEditButtonPressed()
        {
            try
            {
                if (!File.Exists(_configPath))
                {
                    GD.PrintErr($"config.yamlが見つかりません。\n\nパス: {_configPath}");
                    return;
                }

                OS.ShellOpen(_configPath);
            }
            catch (Exception ex)
            {
                GD.PrintErr($"外部エディタの起動に失敗しました。\n{ex.Message}");
            }
        }

        private async void OnGenerateButtonPressed()
        {
            string filePath = _profileFileLineEdit.Text?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(filePath))
            {
                GD.PrintErr("ファイルパスを指定してください。");
                return;
            }

            if (!File.Exists(filePath))
            {
                GD.PrintErr("指定されたファイルが見つかりません。");
                return;
            }

            int selectedIndex = _profileModelComboBox.Selected;
            if (selectedIndex < 0)
            {
                GD.PrintErr("LLMサービスを選択してください。");
                return;
            }

            try
            {
                string selectedService = _profileModelComboBox.GetItemText(selectedIndex);

                if (string.Equals(selectedService, "LM Studio", StringComparison.OrdinalIgnoreCase))
                {
                    SystemConfig.Instance.ModelName = "qwen/qwen3-vl-8b";
                    SystemConfig.Instance.Save();
                }

                var service = LlmManager.CreateService(selectedService);
                if (service == null)
                {
                    GD.PrintErr("LLMサービスの初期化に失敗しました。");
                    return;
                }

                _generateButton.Disabled = true;

                var skill = new GenerateProfileSkill(service);
                var result = await skill.GenerateProfileFromTextAsync(filePath, "expand");

                if (!string.IsNullOrWhiteSpace(result))
                {
                    _profileTextEdit.Text = result;
                }
                else
                {
                    GD.PrintErr("プロフィール生成に失敗しました。");
                }
            }
            catch (Exception ex)
            {
                GD.PrintErr($"プロフィール生成に失敗しました。\n{ex.Message}");
            }
            finally
            {
                _generateButton.Disabled = false;
            }
        }

        private async void OnRemoveBackgroundButtonPressed()
        {
            if (SelectedMascotImageSet == null || SelectedMascotImageSet.Image == null) return;
            var targetImage = SelectedMascotImageSet.Image;

            try
            {
                int selectedIndex = _bgRemovalServiceComboBox.Selected;
                if (selectedIndex < 0)
                {
                    GD.PrintErr("背景削除サービスが選択されていません。");
                    return;
                }

                var services = ImageAiManager.Instance.ImageAiServices.Values.ToList();
                if (selectedIndex >= services.Count)
                {
                    GD.PrintErr("無効な背景削除サービスです。");
                    return;
                }

                var imageService = services[selectedIndex];

                _removeBackgroundButton.Disabled = true;

                if (_removeBgImage == null) return;

                string? backupFileName = await _removeBgImage.ExecuteAsync(targetImage.ImagePath, imageService);

                if (!string.IsNullOrEmpty(backupFileName))
                {
                    RequestReloadImageList?.Invoke();

                    GD.Print($"背景を削除しました。\n元のファイルは {backupFileName} としてバックアップされました。");

                    UpdateSelectionState();
                }
                else
                {
                    GD.PrintErr("背景削除処理に失敗しました。");
                }
            }
            catch (Exception ex)
            {
                GD.PrintErr($"背景削除処理に失敗しました。\n{ex.Message}");
            }
            finally
            {
                _removeBackgroundButton.Disabled = false;
            }
        }

        private void OnRestoreBackgroundButtonPressed()
        {
            if (SelectedMascotImageSet == null || SelectedMascotImageSet.Image == null) return;
            var targetImage = SelectedMascotImageSet.Image;

            try
            {
                string directory = Path.GetDirectoryName(targetImage.ImagePath) ?? "";
                string fileNameWithoutExt = Path.GetFileNameWithoutExtension(targetImage.ImagePath);
                string extension = Path.GetExtension(targetImage.ImagePath);

                var backupFiles = Directory.GetFiles(directory, $"{fileNameWithoutExt}.*.back{extension}")
                    .OrderByDescending(f => f)
                    .ToArray();

                if (backupFiles.Length == 0)
                {
                    GD.Print("バックアップファイルが見つかりませんでした。");
                    return;
                }

                string latestBackup = backupFiles[0];
                string backupFileName = Path.GetFileName(latestBackup);

                // TODO: 確認ダイアログの実装
                GD.Print($"背景削除前の画像に戻します。バックアップファイル: {backupFileName}");

                GC.Collect();
                GC.WaitForPendingFinalizers();
                GC.Collect();

                System.Threading.Thread.Sleep(100);

                File.Copy(latestBackup, targetImage.ImagePath, true);
                File.Delete(latestBackup);

                RequestReloadImageList?.Invoke();
                GD.Print("背景削除前の画像に戻しました。");

                UpdateSelectionState();
            }
            catch (Exception ex)
            {
                GD.PrintErr($"画像の復元に失敗しました。\n{ex.Message}");
            }
        }

        private void OnAddImageButtonPressed()
        {
            try
            {
                var fileDialog = new FileDialog();
                fileDialog.Title = "画像を選択";
                fileDialog.Filters = new[] { "*.png,*.jpg,*.jpeg,*.gif,*.webp ; 画像ファイル" };
                fileDialog.FileMode = FileDialog.FileModeEnum.OpenFiles;
                fileDialog.Access = FileDialog.AccessEnum.Filesystem;

                fileDialog.FilesSelected += (files) =>
                {
                    try
                    {
                        foreach (var sourceFile in files)
                        {
                            string fileName = Path.GetFileName(sourceFile);
                            string destPath = Path.Combine(_mascotDirectory, fileName);

                            if (File.Exists(destPath))
                            {
                                string nameWithoutExt = Path.GetFileNameWithoutExtension(fileName);
                                string extension = Path.GetExtension(fileName);
                                int counter = 1;

                                while (File.Exists(destPath))
                                {
                                    fileName = $"{nameWithoutExt}_{counter}{extension}";
                                    destPath = Path.Combine(_mascotDirectory, fileName);
                                    counter++;
                                }
                            }

                            File.Copy(sourceFile, destPath);
                        }

                        RequestReloadImageList?.Invoke();
                    }
                    catch (Exception ex)
                    {
                        GD.PrintErr($"画像の追加に失敗しました。\n{ex.Message}");
                    }
                };

                AddChild(fileDialog);
                fileDialog.PopupCentered(new Vector2I(800, 600));
            }
            catch (Exception ex)
            {
                GD.PrintErr($"画像の追加に失敗しました。\n{ex.Message}");
            }
        }
    }

    internal class LlmServiceInfo
    {
        public string Name { get; set; } = string.Empty;
    }
}
