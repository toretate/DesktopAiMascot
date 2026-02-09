using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Media.Imaging;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.aiservice.image;
using DesktopAiMascot.mascots;
using DesktopAiMascot.skills;
using DesktopAiMascot.utils;
using Microsoft.Win32;
using MessageBox = System.Windows.MessageBox;

namespace DesktopAiMascot.views.MascotEdit
{
    public partial class MascotEditSettingControl : System.Windows.Controls.UserControl
    {
        // 依存関係プロパティ: 選択された画像
        public static readonly DependencyProperty SelectedMascotImageProperty =
            DependencyProperty.Register("SelectedMascotImage", typeof(MascotImageItem), typeof(MascotEditSettingControl),
                new PropertyMetadata(null, OnSelectedMascotImageChanged));

        public MascotImageItem? SelectedMascotImage
        {
            get { return (MascotImageItem)GetValue(SelectedMascotImageProperty); }
            set { SetValue(SelectedMascotImageProperty, value); }
        }

        // イベント: 画像リストの再読み込みリクエスト
        public event EventHandler? RequestReloadImageList;

        private MascotModel? _mascotModel;
        private string _mascotDirectory = string.Empty;
        private string _configPath = string.Empty;
        private MascotConfig _mascotConfig = new MascotConfig();

        private GoogleAiStudioService? _googleAiService;
        private ComfyQwen3ImageEditService? _comfyQwen3ImageEditService;
        private RemoveBGImage? _removeBgImage;
        private GenerateAngleImage? _angleImageGenerator;

        public MascotEditSettingControl()
        {
            InitializeComponent();
        }

        public void Initialize(MascotModel mascotModel)
        {
            _mascotModel = mascotModel;
            _mascotDirectory = _mascotModel.DirectoryPath;
            _configPath = Path.Combine(_mascotDirectory, "config.yaml");

            // GoogleAiStudioService を初期化
            _googleAiService = new GoogleAiStudioService();
            _googleAiService.Initialize();
            _comfyQwen3ImageEditService = new ComfyQwen3ImageEditService();
            _removeBgImage = new RemoveBGImage(_mascotDirectory);
            _angleImageGenerator = new GenerateAngleImage(_googleAiService, _comfyQwen3ImageEditService);

            InitializeAngleViewControl();
            InitializeBackgroundRemovalServices();
            InitializeGenerateProfileModelComboBox();
            LoadMascotData();
        }

        private void InitializeAngleViewControl()
        {
            angleViewControl.LeftImageClick += LeftImage_Click;
            angleViewControl.RightImageClick += RightImage_Click;
            angleViewControl.AboveImageClick += AboveImage_Click;
            angleViewControl.BelowImageClick += BelowImage_Click;
            angleViewControl.BehindImageClick += BehindImage_Click;
            angleViewControl.ImageModelComboBox.SelectionChanged += AngleImageModelComboBox_SelectionChanged;

            if (SystemConfig.Instance.AngleImageModelIndex >= 0 &&
                SystemConfig.Instance.AngleImageModelIndex < angleViewControl.ImageModelComboBox.Items.Count)
            {
                angleViewControl.ImageModelComboBox.SelectedIndex = SystemConfig.Instance.AngleImageModelIndex;
            }
        }

        private void InitializeBackgroundRemovalServices()
        {
            try
            {
                var services = ImageAiManager.Instance.ImageAiServices.Values.ToList();

                if (services.Count > 0)
                {
                    backgroundRemovalServiceComboBox.ItemsSource = services;
                    backgroundRemovalServiceComboBox.SelectedIndex = 0;
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
                var services = new List<LlmServiceInfo>();
                foreach (System.Data.DataRow row in serviceTable.Rows)
                {
                    services.Add(new LlmServiceInfo { Name = row["Name"]?.ToString() ?? string.Empty });
                }

                generateProfileModelComboBox.ItemsSource = services;

                if (services.Count > 0)
                {
                    string currentLlm = SystemConfig.Instance.LlmService;
                    var matchingService = services.FirstOrDefault(s => s.Name == currentLlm);
                    generateProfileModelComboBox.SelectedItem = matchingService ?? services[0];
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

            displayNameTextBox.Text = _mascotModel.Name;
            LoadSystemPrompt();
            LoadCoverImage();
        }

        private void LoadSystemPrompt()
        {
            try
            {
                if (File.Exists(_configPath))
                {
                    _mascotConfig = MascotConfigIO.LoadFromFile(_configPath);
                    profileTextBlock.Text = MascotConfigIO.SaveSystemPrompt(_mascotConfig.SystemPrompt);
                    mascotConfigTextBox.Text = Path.GetFileName(_configPath);
                    editPromptButton.Content = _configPath;
                }
                else
                {
                    _mascotConfig = new MascotConfig();
                    profileTextBlock.Text = MascotConfigIO.SaveSystemPrompt(_mascotConfig.SystemPrompt);
                    mascotConfigTextBox.Text = Path.GetFileName(_configPath);
                    editPromptButton.Content = _configPath;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditSettingControl] システムプロンプト読み込みエラー: {ex.Message}");
                profileTextBlock.Text = string.Empty;
            }
        }

        private void LoadCoverImage()
        {
            try
            {
                string coverPath = Path.Combine(_mascotDirectory, "cover.png");
                // angleViewControlのFrontImageにcover.pngを設定（120x120ピクセル）
                var frontImage = ImageLoadHelper.LoadBitmapThumbnail(coverPath, 120, 120);
                if (frontImage != null)
                {
                    angleViewControl.FrontImage.Source = frontImage;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditSettingControl] カバー画像読み込みエラー: {ex.Message}");
            }
        }

        // SelectedMascotImageが変更されたときの処理
        private static void OnSelectedMascotImageChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        {
            if (d is MascotEditSettingControl control)
            {
                control.UpdateSelectionState();
            }
        }

        private void UpdateSelectionState()
        {
            bool isSelected = SelectedMascotImage != null;
            removeBackgroundButton.IsEnabled = isSelected;
            generateEmotesButton.IsEnabled = isSelected;

            if (isSelected && SelectedMascotImage != null)
            {
                try
                {
                    string directory = Path.GetDirectoryName(SelectedMascotImage.ImagePath) ?? "";
                    string fileNameWithoutExt = Path.GetFileNameWithoutExtension(SelectedMascotImage.ImagePath);
                    string extension = Path.GetExtension(SelectedMascotImage.ImagePath);

                    var backupFiles = Directory.GetFiles(directory, $"{fileNameWithoutExt}.*.back{extension}");
                    restoreBackgroundButton.IsEnabled = backupFiles.Length > 0;

                    // 選択された画像をfrontImageに表示
                    var image = ImageLoadHelper.LoadBitmapThumbnail(SelectedMascotImage.ImagePath, 120, 120);
                    if (image != null)
                    {
                        angleViewControl.FrontImage.Source = image;
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[MascotEditSettingControl] Image selection update error: {ex.Message}");
                    restoreBackgroundButton.IsEnabled = false;
                }
            }
            else
            {
                // 選択解除時はカバー画像に戻すか、nullにするか？
                // 元の動作ではnullになるようだが、LoadCoverImageでセットされていたはず。
                // ここではとりあえず何もしないか、LoadCoverImageを呼ぶ。
                // ユーザー体験的にはカバー画像に戻るのが良いかも。
                LoadCoverImage();
                restoreBackgroundButton.IsEnabled = false;
            }
        }

        public string GetDisplayName()
        {
            return displayNameTextBox.Text.Trim();
        }

        // 外部から呼ばれる保存処理
        public void SaveConfig()
        {
            try
            {
                _mascotConfig.SystemPrompt = MascotConfigIO.LoadSystemPrompt(profileTextBlock.Text);
                MascotConfigIO.SaveToYaml(_mascotConfig, _configPath);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditSettingControl] システムプロンプト保存エラー: {ex.Message}");
                throw;
            }
        }

        // イベントハンドラ実装...

        private void EditPromptButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (!File.Exists(_configPath))
                {
                    MessageBox.Show($"config.yamlが見つかりません。\n\nパス: {_configPath}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
                    return;
                }

                Process.Start(new ProcessStartInfo
                {
                    FileName = _configPath,
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                MessageBox.Show($"外部エディタの起動に失敗しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void GenerateProfileFileChooserButton_Click(object sender, RoutedEventArgs e)
        {
            // (MascotEditWindow.xaml.cs から GenerateProfileFileChooserButton_Click のロジックをコピー)
            string filePath = generateProfileFromFileTextField.Text?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(filePath))
            {
                MessageBox.Show("ファイルパスを指定してください。", "入力エラー", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (!File.Exists(filePath))
            {
                MessageBox.Show("指定されたファイルが見つかりません。", "入力エラー", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (generateProfileModelComboBox.SelectedItem is not LlmServiceInfo selectedService)
            {
                MessageBox.Show("LLMサービスを選択してください。", "入力エラー", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            try
            {
                if (string.Equals(selectedService.Name, "LM Studio", StringComparison.OrdinalIgnoreCase))
                {
                    SystemConfig.Instance.ModelName = "qwen/qwen3-vl-8b";
                    SystemConfig.Instance.Save();
                }

                var service = LlmManager.CreateService(selectedService.Name);
                if (service == null)
                {
                    MessageBox.Show("LLMサービスの初期化に失敗しました。", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
                    return;
                }

                generateProfileFileChooserButton.IsEnabled = false;
                Mouse.OverrideCursor = System.Windows.Input.Cursors.Wait;

                var skill = new GenerateProfileSkill(service);
                var result = await skill.GenerateProfileFromTextAsync(filePath, "expand");

                if (!string.IsNullOrWhiteSpace(result))
                {
                    profileTextBlock.Text = result;
                }
                else
                {
                    MessageBox.Show("プロフィール生成に失敗しました。", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"プロフィール生成に失敗しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                Mouse.OverrideCursor = null;
                generateProfileFileChooserButton.IsEnabled = true;
            }
        }

        private void GenerateProfileFromFileTextField_PreviewDragOver(object sender, System.Windows.DragEventArgs e)
        {
            e.Handled = true;
            e.Effects = e.Data.GetDataPresent(System.Windows.DataFormats.FileDrop)
                ? System.Windows.DragDropEffects.Copy
                : System.Windows.DragDropEffects.None;
        }

        private void GenerateProfileFromFileTextField_Drop(object sender, System.Windows.DragEventArgs e)
        {
            try
            {
                if (e.Data.GetDataPresent(System.Windows.DataFormats.FileDrop))
                {
                    var files = e.Data.GetData(System.Windows.DataFormats.FileDrop) as string[];
                    if (files != null && files.Length > 0)
                    {
                        generateProfileFromFileTextField.Text = files[0];
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditSettingControl] ファイルドロップエラー: {ex.Message}");
            }
        }

        private async void RemoveBackgroundButton_Click(object sender, RoutedEventArgs e)
        {
            if (SelectedMascotImage == null) return;
            // ロジックコピー（SelectedMascotImageを使用）
            try
            {
                var imageService = backgroundRemovalServiceComboBox.SelectedItem as ImageAiServiceBase;
                if (imageService == null)
                {
                    MessageBox.Show("背景削除サービスが選択されていません。", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
                    return;
                }

                Mouse.OverrideCursor = System.Windows.Input.Cursors.Wait;
                removeBackgroundButton.IsEnabled = false;

                if (_removeBgImage == null) return;

                string? backupFileName = await _removeBgImage.ExecuteAsync(SelectedMascotImage.ImagePath, imageService);

                if (!string.IsNullOrEmpty(backupFileName))
                {
                    // 画像リスト再読み込みをリクエスト
                    RequestReloadImageList?.Invoke(this, EventArgs.Empty);

                    MessageBox.Show($"背景を削除しました。\n元のファイルは {backupFileName} としてバックアップされました。", "完了", MessageBoxButton.OK, MessageBoxImage.Information);

                    // 選択状態の更新 (バックアップができたので復元ボタンが有効になるはず)
                    UpdateSelectionState();
                }
                else
                {
                    MessageBox.Show("背景削除処理に失敗しました。", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"背景削除処理に失敗しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                Mouse.OverrideCursor = null;
                removeBackgroundButton.IsEnabled = true;
            }
        }

        private void RestoreBackgroundButton_Click(object sender, RoutedEventArgs e)
        {
            if (SelectedMascotImage == null) return;
            // ロジックコピー
            try
            {
                string directory = Path.GetDirectoryName(SelectedMascotImage.ImagePath) ?? "";
                string fileNameWithoutExt = Path.GetFileNameWithoutExtension(SelectedMascotImage.ImagePath);
                string extension = Path.GetExtension(SelectedMascotImage.ImagePath);

                var backupFiles = Directory.GetFiles(directory, $"{fileNameWithoutExt}.*.back{extension}")
                    .OrderByDescending(f => f)
                    .ToArray();

                if (backupFiles.Length == 0)
                {
                    MessageBox.Show("バックアップファイルが見つかりませんでした。", "情報", MessageBoxButton.OK, MessageBoxImage.Information);
                    return;
                }

                string latestBackup = backupFiles[0];
                string backupFileName = Path.GetFileName(latestBackup);

                var result = MessageBox.Show(
                    $"背景削除前の画像に戻しますか？\n\nバックアップファイル: {backupFileName}\n\n現在の画像は失われます。",
                    "確認",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Question);

                if (result == MessageBoxResult.Yes)
                {
                    angleViewControl.FrontImage.Source = null;
                    // coverImageはWindow側なので触らない、UserControl内ではangleViewControlのFrontImageのみ管理

                    GC.Collect();
                    GC.WaitForPendingFinalizers();
                    GC.Collect();

                    System.Threading.Thread.Sleep(100);

                    File.Copy(latestBackup, SelectedMascotImage.ImagePath, true);
                    File.Delete(latestBackup);

                    RequestReloadImageList?.Invoke(this, EventArgs.Empty);
                    MessageBox.Show("背景削除前の画像に戻しました。", "完了", MessageBoxButton.OK, MessageBoxImage.Information);

                    UpdateSelectionState();
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"画像の復元に失敗しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void AddImageButton_Click(object sender, RoutedEventArgs e)
        {
            // ロジックコピー
            try
            {
                var openFileDialog = new Microsoft.Win32.OpenFileDialog
                {
                    Title = "画像を選択",
                    Filter = "画像ファイル (*.png;*.jpg;*.jpeg;*.gif;*.webp)|*.png;*.jpg;*.jpeg;*.gif;*.webp",
                    Multiselect = true
                };

                if (openFileDialog.ShowDialog() == true)
                {
                    foreach (var sourceFile in openFileDialog.FileNames)
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

                    RequestReloadImageList?.Invoke(this, EventArgs.Empty);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"画像の追加に失敗しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void GenerateEmotesButton_Click(object sender, RoutedEventArgs e)
        {
            if (SelectedMascotImage == null) return;

            // ロジックコピー
            // EmoteGenerationWindowはWindowなので、OwnerをWindowにする必要がある。
            // Window.GetWindow(this) で親ウィンドウを取得
            var window = Window.GetWindow(this);
            var emoteWindow = new EmoteGenerationWindow(SelectedMascotImage.ImagePath);
            emoteWindow.Owner = window;
            emoteWindow.ShowDialog();

            RequestReloadImageList?.Invoke(this, EventArgs.Empty);
        }

        private void LeftImage_Click(object sender, MouseButtonEventArgs e) => GenerateAngleImageWrapper("left", angleViewControl.LeftImage);
        private void RightImage_Click(object sender, MouseButtonEventArgs e) => GenerateAngleImageWrapper("right", angleViewControl.RightImage);
        private void AboveImage_Click(object sender, MouseButtonEventArgs e) => GenerateAngleImageWrapper("above", angleViewControl.AboveImage);
        private void BelowImage_Click(object sender, MouseButtonEventArgs e) => GenerateAngleImageWrapper("below", angleViewControl.BelowImage);
        private void BehindImage_Click(object sender, MouseButtonEventArgs e) => GenerateAngleImageWrapper("behind", angleViewControl.BehindImage);

        private void GenerateAngleImageWrapper(string from, System.Windows.Controls.Image targetImageControl)
        {
            if (angleViewControl.FrontImage.Source == null)
            {
                MessageBox.Show("先に画像一覧から画像を選択してください。", "情報", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            // frontImageはSelectedImageまたはCoverImage。
            // 選択されていない場合は処理しないか、CoverImageを使うか。
            // 元のコードでは、SelectedMascotImageかfrontImagePath（CoverImageへのパス）を使っていた。

            string frontImageFileName = "cover.png";
            string frontImagePath = Path.Combine(_mascotDirectory, "cover.png");

            if (SelectedMascotImage != null)
            {
                frontImageFileName = SelectedMascotImage.FileName;
                frontImagePath = SelectedMascotImage.ImagePath;
            }
            else
            {
                // SelectedUserImageがnullでも、FrontImage.Sourceがnullでなければcover.pngが表示されている状態とみなせる
                if (!File.Exists(frontImagePath)) return;
            }

            GenerateAngleImage(from, frontImageFileName, frontImagePath, targetImageControl);
        }

        private async void GenerateAngleImage(string from, string frontImageFileName, string frontImagePath, System.Windows.Controls.Image targetImageControl)
        {
            // ロジックコピー
            // ...
            try
            {
                Mouse.OverrideCursor = System.Windows.Input.Cursors.Wait;
                angleViewControl.SetAngleStatus(from, "生成中...");

                string selectedModel = GetSelectedModel();

                if (_angleImageGenerator == null) return;

                var outputPath = await _angleImageGenerator.ExecuteAsync(
                   from,
                   selectedModel,
                   frontImagePath,
                   _mascotDirectory,
                   frontImageFileName);

                if (!string.IsNullOrEmpty(outputPath))
                {
                    // BitmapImage作成コード
                    var bitmap = new BitmapImage();
                    bitmap.BeginInit();
                    bitmap.CacheOption = BitmapCacheOption.OnLoad;
                    bitmap.CreateOptions = BitmapCreateOptions.IgnoreImageCache;
                    bitmap.UriSource = new Uri(outputPath, UriKind.Absolute);
                    bitmap.EndInit();
                    bitmap.Freeze();

                    targetImageControl.Source = bitmap;

                    RequestReloadImageList?.Invoke(this, EventArgs.Empty);
                    MessageBox.Show($"{from}方向の画像を生成しました。", "完了", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else
                {
                    MessageBox.Show("画像生成に失敗しました。", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"画像生成に失敗しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                angleViewControl.SetAngleStatus(from, null);
                Mouse.OverrideCursor = null;
            }
        }

        private string GetSelectedModel()
        {
            var selected = angleViewControl.ImageModelComboBox.SelectedIndex;
            return selected switch
            {
                0 => "gemini-2.5-flash-image",
                1 => "gemini-3-pro-image-preview",
                2 => "qwen3-image-edit",
                _ => "gemini-2.5-flash-image"
            };
        }

        private void AngleImageModelComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            SystemConfig.Instance.AngleImageModelIndex = angleViewControl.ImageModelComboBox.SelectedIndex;
            SystemConfig.Instance.Save();
        }
    }
}
