using DesktopAiMascot.mascots;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.aiservice.image;
using DesktopAiMascot.utils;
using DesktopAiMascot.controls;
using MessageBox = System.Windows.MessageBox;
using OpenFileDialog = Microsoft.Win32.OpenFileDialog;
using DesktopAiMascot.views.MascotEdit;

namespace DesktopAiMascot.views
{
    public partial class MascotEditWindow : Window
    {
        private MascotModel _mascotModel;
        private string _mascotDirectory;
        private ObservableCollection<MascotImageItem> _imageItems = new ObservableCollection<MascotImageItem>();
        private GoogleAiStudioService _googleAiService;

        public MascotEditWindow(MascotModel mascotModel)
        {
            InitializeComponent();
            _mascotModel = mascotModel;
            
            // MascotModel から保存されているディレクトリパスを使用
            _mascotDirectory = _mascotModel.DirectoryPath;
            
            // GoogleAiStudioService を初期化
            _googleAiService = new GoogleAiStudioService();
            _googleAiService.Initialize();
            
            Debug.WriteLine($"[MascotEditWindow] MascotModel.DirectoryPath から取得: {_mascotDirectory}");
            
            if (string.IsNullOrEmpty(_mascotDirectory))
            {
                Debug.WriteLine($"[MascotEditWindow] エラー: MascotModel.DirectoryPath が空です");
            }
            
            // 背景削除サービスのコンボボックスを初期化
            InitializeBackgroundRemovalServices();
            
            LoadMascotData();
        }

        /// <summary>
        /// 背景削除サービスのコンボボックスを初期化
        /// </summary>
        private void InitializeBackgroundRemovalServices()
        {
            try
            {
                var services = ImageAiManager.Instance.ImageAiServices.Values.ToList();
                
                if (services.Count > 0)
                {
                    backgroundRemovalServiceComboBox.ItemsSource = services;
                    backgroundRemovalServiceComboBox.SelectedIndex = 0;
                    Debug.WriteLine($"[MascotEditWindow] {services.Count}個の背景削除サービスを読み込みました");
                }
                else
                {
                    Debug.WriteLine("[MascotEditWindow] 利用可能な背景削除サービスがありません");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditWindow] 背景削除サービス初期化エラー: {ex.Message}");
            }
        }

        /// <summary>
        /// マスコットデータを読み込む
        /// </summary>
        private void LoadMascotData()
        {
            try
            {
                Debug.WriteLine($"[MascotEditWindow] ========== マスコットデータ読み込み開始 ==========");
                Debug.WriteLine($"[MascotEditWindow] マスコット名: {_mascotModel.Name}");
                Debug.WriteLine($"[MascotEditWindow] マスコットディレクトリ: {_mascotDirectory}");
                Debug.WriteLine($"[MascotEditWindow] ディレクトリ存在確認: {Directory.Exists(_mascotDirectory)}");
                
                // 表示名を設定
                displayNameTextBox.Text = _mascotModel.Name;

                // カバー画像を読み込み
                LoadCoverImage();

                // 画像一覧を読み込み
                LoadImageList();
                
                Debug.WriteLine($"[MascotEditWindow] ========== マスコットデータ読み込み完了 ==========");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditWindow] データ読み込みエラー: {ex.Message}");
                Debug.WriteLine($"[MascotEditWindow] スタックトレース: {ex.StackTrace}");
                MessageBox.Show($"マスコットデータの読み込みに失敗しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        /// <summary>
        /// カバー画像を読み込む（cover.png固定）
        /// </summary>
        private void LoadCoverImage()
        {
            try
            {
                string coverPath = Path.Combine(_mascotDirectory, "cover.png");
                
                Debug.WriteLine($"[MascotEditWindow] カバー画像パス: {coverPath}");
                
                // サムネイル版を使用（180x180ピクセル）
                var image = ImageLoadHelper.LoadBitmapThumbnail(coverPath, 180, 180);
                if (image != null)
                {
                    coverImage.Source = image;
                    Debug.WriteLine("[MascotEditWindow] カバー画像を読み込みました");
                }
                else
                {
                    Debug.WriteLine("[MascotEditWindow] カバー画像（cover.png）が見つかりません");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditWindow] カバー画像読み込みエラー: {ex.Message}");
            }
        }

        /// <summary>
        /// 画像一覧を読み込む
        /// </summary>
        private void LoadImageList()
        {
            try
            {
                _imageItems.Clear();
                
                if (!Directory.Exists(_mascotDirectory))
                {
                    Debug.WriteLine($"[MascotEditWindow] マスコットディレクトリが存在しません: {_mascotDirectory}");
                    return;
                }

                Debug.WriteLine($"[MascotEditWindow] 画像一覧を読み込み中: {_mascotDirectory}");

                var imageExtensions = new[] { ".png", ".jpg", ".jpeg", ".gif", ".webp" };
                
                // MascotModel側のフィルタリング処理を使用してディレクトリ内のファイルを取得
                var allFiles = Directory.GetFiles(_mascotDirectory);
                var imageItems = ImageLoadHelper.LoadImages(_mascotModel.Name, allFiles);
                
                // 画像を並び替え: cover.* が先頭、その他はファイル名順
                var sortedItems = imageItems
                    .OrderBy(item => 
                    {
                        string fileNameWithoutExt = Path.GetFileNameWithoutExtension(item.FileName);
                        // cover.* を先頭にするため、coverの場合は空文字列を返す
                        return fileNameWithoutExt.Equals("cover", StringComparison.OrdinalIgnoreCase) 
                            ? "" 
                            : item.FileName;
                    })
                    .ToList();
                
                foreach(var item in sortedItems)
                {
                    _imageItems.Add(item);
                }

                // ObservableCollectionを使用しているので、一度だけ設定すればよい
                if (mascotImageListView.ItemsSource == null)
                {
                    mascotImageListView.ItemsSource = _imageItems;
                }
                
                Debug.WriteLine($"[MascotEditWindow] {_imageItems.Count}個の画像をListViewに設定しました");

            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditWindow] 画像一覧読み込みエラー: {ex.Message}");
                Debug.WriteLine($"[MascotEditWindow] スタックトレース: {ex.StackTrace}");
            }
        }

        /// <summary>
        /// 外部エディタでシステムプロンプトを編集
        /// </summary>
        private void EditPromptButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                string configPath = Path.Combine(_mascotDirectory, "config.yaml");
                
                Debug.WriteLine($"[MascotEditWindow] config.yaml パス: {configPath}");
                Debug.WriteLine($"[MascotEditWindow] ディレクトリ: {_mascotDirectory}");
                Debug.WriteLine($"[MascotEditWindow] ディレクトリ存在確認: {Directory.Exists(_mascotDirectory)}");
                
                if (!File.Exists(configPath))
                {
                    Debug.WriteLine($"[MascotEditWindow] config.yaml が見つかりません");
                    
                    // ディレクトリ内のファイルを表示
                    if (Directory.Exists(_mascotDirectory))
                    {
                        var files = Directory.GetFiles(_mascotDirectory);
                        Debug.WriteLine($"[MascotEditWindow] ディレクトリ内のファイル:");
                        foreach (var file in files)
                        {
                            Debug.WriteLine($"  - {Path.GetFileName(file)}");
                        }
                    }
                    
                    MessageBox.Show($"config.yamlが見つかりません。\n\nパス: {configPath}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
                    return;
                }

                Debug.WriteLine($"[MascotEditWindow] config.yaml を外部エディタで開きます");
                
                // デフォルトのテキストエディタで開く
                Process.Start(new ProcessStartInfo
                {
                    FileName = configPath,
                    UseShellExecute = true
                });

                Debug.WriteLine($"[MascotEditWindow] config.yamlを外部エディタで開きました: {configPath}");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditWindow] 外部エディタ起動エラー: {ex.Message}");
                Debug.WriteLine($"[MascotEditWindow] スタックトレース: {ex.StackTrace}");
                MessageBox.Show($"外部エディタの起動に失敗しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        /// <summary>
        /// キャラクター視点画像を生成
        /// </summary>
        private void GenerateViewsButton_Click(object sender, RoutedEventArgs e)
        {
            // TODO: 画像生成AIを使用してキャラクター視点画像を生成
            MessageBox.Show("この機能は将来実装予定です。", "情報", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        /// <summary>
        /// 画像を追加
        /// </summary>
        private void AddImageButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                var openFileDialog = new OpenFileDialog
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

                        // ファイル名の重複を避ける
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

                        // ファイルをコピー
                        File.Copy(sourceFile, destPath);
                        Debug.WriteLine($"[MascotEditWindow] 画像を追加: {destPath}");
                    }

                    // 画像一覧を再読み込み
                    LoadImageList();
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditWindow] 画像追加エラー: {ex.Message}");
                MessageBox.Show($"画像の追加に失敗しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        /// <summary>
        /// 背景を削除
        /// </summary>
        private async void RemoveBackgroundButton_Click(object sender, RoutedEventArgs e)
        {
            if (mascotImageListView.SelectedItem is MascotImageItem selectedItem)
            {
                string selectedImagePath = selectedItem.ImagePath;
                string selectedFileName = selectedItem.FileName;
                
                try
                {
                    // 選択されたサービスを取得
                    var imageService = backgroundRemovalServiceComboBox.SelectedItem as ImageAiServiceBase;
                    if (imageService == null)
                    {
                        MessageBox.Show("背景削除サービスが選択されていません。", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
                        return;
                    }
                    
                    Debug.WriteLine($"[MascotEditWindow] 選択されたサービス: {imageService.Name}");
                    
                    // カーソルを待機状態に
                    System.Windows.Input.Mouse.OverrideCursor = System.Windows.Input.Cursors.Wait;
                    removeBackgroundButton.IsEnabled = false;

                    Debug.WriteLine($"[MascotEditWindow] 背景削除処理を開始: {selectedFileName}");

                    // 画像をBase64 Data URI形式で読み込み
                    string? imageData = ImageLoadHelper.LoadImageAsBase64DataUri(selectedImagePath);
                    if (imageData == null)
                    {
                        throw new InvalidOperationException("画像の読み込みに失敗しました.");
                    }

                    Debug.WriteLine($"[MascotEditWindow] 画像データサイズ: {imageData.Length} 文字");

                    // 背景削除処理を実行
                    ImageAiManager.Instance.CurrentService = imageService;
                    var result = await ImageAiManager.Instance.RemoveBackgroundAsync(imageData);

                    if (result != null)
                    {
                        // Base64 Data URIからバイト配列に変換
                        byte[]? resultBytes = ImageLoadHelper.ConvertBase64DataUriToBytes(result);
                        if (resultBytes == null)
                        {
                            throw new InvalidOperationException("背景削除結果の変換に失敗しました。");
                        }

                        // バックアップファイル名を生成
                        string backupFileName = FileOperationHelper.GenerateBackupFileName(selectedImagePath);
                        string backupPath = Path.Combine(_mascotDirectory, backupFileName);

                        // ファイルハンドルを解放（念のため短時間待機）
                        await FileOperationHelper.ReleaseFileHandlesAsync(500);
                        
                        // 一時ファイルに書き込む
                        string tempFilePath = Path.Combine(_mascotDirectory, $"temp_{Guid.NewGuid()}.png");
                        File.WriteAllBytes(tempFilePath, resultBytes);
                        await Task.Delay(200);
                        
                        Debug.WriteLine($"[MascotEditWindow] 一時ファイルを作成: {tempFilePath}");
                        
                        // ファイルを置き換え（リトライロジック付き）
                        bool replaceSuccess = await FileOperationHelper.ReplaceFileWithRetryAsync(
                            tempFilePath, 
                            selectedImagePath, 
                            backupPath);
                        
                        // 一時ファイルのクリーンアップ
                        FileOperationHelper.CleanupTempFile(tempFilePath);

                        if (!replaceSuccess)
                        {
                            throw new IOException("ファイルの置き換えに失敗しました。ファイルが他のプロセスによって使用されているか、アクセス権限がありません。");
                        }

                        // 画像一覧を再読み込み
                        LoadImageList();

                        MessageBox.Show($"背景を削除しました。\n元のファイルは {backupFileName} としてバックアップされました。", "完了", MessageBoxButton.OK, MessageBoxImage.Information);
                    }
                    else
                    {
                        MessageBox.Show("背景削除処理に失敗しました。", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[MascotEditWindow] 背景削除エラー: {ex.Message}");
                    Debug.WriteLine($"[MascotEditWindow] スタックトレース: {ex.StackTrace}");
                    MessageBox.Show($"背景削除処理に失敗しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
                }
                finally
                {
                    // カーソルを元に戻す
                    System.Windows.Input.Mouse.OverrideCursor = null;
                    removeBackgroundButton.IsEnabled = true;
                }
            }
        }

        /// <summary>
        /// 背景削除前の画像に戻す
        /// </summary>
        private void RestoreBackgroundButton_Click(object sender, RoutedEventArgs e)
        {
            if (mascotImageListView.SelectedItem is MascotImageItem selectedItem)
            {
                try
                {
                    string directory = Path.GetDirectoryName(selectedItem.ImagePath) ?? "";
                    string fileNameWithoutExt = Path.GetFileNameWithoutExtension(selectedItem.ImagePath);
                    string extension = Path.GetExtension(selectedItem.ImagePath);

                    // 最新のバックアップファイルを検索
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

                    // 確認ダイアログ
                    var result = MessageBox.Show(
                        $"背景削除前の画像に戻しますか？\n\nバックアップファイル: {backupFileName}\n\n現在の画像は失われます。",
                        "確認",
                        MessageBoxButton.YesNo,
                        MessageBoxImage.Question);

                    if (result == MessageBoxResult.Yes)
                    {
                        // 画像のロックを解放
                        frontImage.Source = null;
                        coverImage.Source = null;
                        
                        // ガベージコレクションを実行
                        GC.Collect();
                        GC.WaitForPendingFinalizers();
                        GC.Collect();
                        
                        // 少し待機
                        System.Threading.Thread.Sleep(100);
                        
                        // バックアップファイルで元のファイルを上書き
                        File.Copy(latestBackup, selectedItem.ImagePath, true);
                        Debug.WriteLine($"[MascotEditWindow] バックアップファイルで復元: {latestBackup} -> {selectedItem.ImagePath}");

                        // バックアップファイルを削除
                        File.Delete(latestBackup);
                        Debug.WriteLine($"[MascotEditWindow] バックアップファイルを削除: {latestBackup}");

                        // 画像一覧を再読み込み
                        LoadImageList();

                        MessageBox.Show("背景削除前の画像に戻しました。", "完了", MessageBoxButton.OK, MessageBoxImage.Information);
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[MascotEditWindow] 画像復元エラー: {ex.Message}");
                    MessageBox.Show($"画像の復元に失敗しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }

        /// <summary>
        /// 表情差分作成
        /// </summary>
        private void GenerateEmotesButton_Click(object sender, RoutedEventArgs e)
        {
            if (mascotImageListView.SelectedItem is MascotImageItem selectedItem)
            {
                // 表情差分作成ウィンドウを開く
                var emoteWindow = new EmoteGenerationWindow(selectedItem.ImagePath);
                emoteWindow.Owner = this;
                emoteWindow.ShowDialog();
                
                // ウィンドウを閉じた後、画像一覧を再読み込み
                LoadImageList();
            }
        }

        /// <summary>
        /// 画像選択変更イベント
        /// </summary>
        private void ImageListView_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            bool isSelected = mascotImageListView.SelectedItem != null;
            removeBackgroundButton.IsEnabled = isSelected;
            generateEmotesButton.IsEnabled = isSelected;
            
            // 選択された画像にバックアップファイルが存在するか確認
            if (isSelected && mascotImageListView.SelectedItem is MascotImageItem selectedItem)
            {
                try
                {
                    string directory = Path.GetDirectoryName(selectedItem.ImagePath) ?? "";
                    string fileNameWithoutExt = Path.GetFileNameWithoutExtension(selectedItem.ImagePath);
                    string extension = Path.GetExtension(selectedItem.ImagePath);
                    
                    var backupFiles = Directory.GetFiles(directory, $"{fileNameWithoutExt}.*.back{extension}");
                    restoreBackgroundButton.IsEnabled = backupFiles.Length > 0;
                    
                    // 選択された画像をfrontImageに表示（サムネイル版、120x120ピクセル）
                    var image = ImageLoadHelper.LoadBitmapThumbnail(selectedItem.ImagePath, 120, 120);
                    if (image != null)
                    {
                        frontImage.Source = image;
                        Debug.WriteLine($"[MascotEditWindow] frontImageに画像を表示: {selectedItem.FileName}");
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[MascotEditWindow] frontImage表示エラー: {ex.Message}");
                    restoreBackgroundButton.IsEnabled = false;
                }
            }
            else
            {
                frontImage.Source = null;
                restoreBackgroundButton.IsEnabled = false;
            }
        }

        /// <summary>
        /// 保存ボタン
        /// </summary>
        private void SaveButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                // 表示名が変更された場合の処理
                string newName = displayNameTextBox.Text.Trim();
                
                if (string.IsNullOrEmpty(newName))
                {
                    MessageBox.Show("表示名を入力してください。", "入力エラー", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                // TODO: 表示名の変更処理（config.yamlの更新など）
                
                Debug.WriteLine($"[MascotEditWindow] マスコット情報を保存しました: {newName}");
                MessageBox.Show("マスコット情報を保存しました。", "保存完了", MessageBoxButton.OK, MessageBoxImage.Information);
                
                DialogResult = true;
                Close();
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditWindow] 保存エラー: {ex.Message}");
                MessageBox.Show($"保存に失敗しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        /// <summary>
        /// キャンセルボタン
        /// </summary>
        private void CancelButton_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

        /// <summary>
        /// 左側画像クリック
        /// </summary>
        private void LeftImage_Click(object sender, MouseButtonEventArgs e)
        {
            if (frontImage.Source == null)
            {
                MessageBox.Show("先に画像一覧から画像を選択してください。", "情報", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }
            
            var selectedItem = mascotImageListView.SelectedItem as MascotImageItem;
            if (selectedItem == null) return;
            
            GenerateAngleImage("left", selectedItem.FileName, selectedItem.ImagePath, leftImage);
        }

        /// <summary>
        /// 右側画像クリック
        /// </summary>
        private void RightImage_Click(object sender, MouseButtonEventArgs e)
        {
            if (frontImage.Source == null)
            {
                MessageBox.Show("先に画像一覧から画像を選択してください。", "情報", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }
            
            var selectedItem = mascotImageListView.SelectedItem as MascotImageItem;
            if (selectedItem == null) return;
            
            GenerateAngleImage("right", selectedItem.FileName, selectedItem.ImagePath, rightImage);
        }

        /// <summary>
        /// 上側画像クリック
        /// </summary>
        private void AboveImage_Click(object sender, MouseButtonEventArgs e)
        {
            if (frontImage.Source == null)
            {
                MessageBox.Show("先に画像一覧から画像を選択してください。", "情報", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }
            
            var selectedItem = mascotImageListView.SelectedItem as MascotImageItem;
            if (selectedItem == null) return;
            
            GenerateAngleImage("above", selectedItem.FileName, selectedItem.ImagePath, aboveImage);
        }

        /// <summary>
        /// 下側画像クリック
        /// </summary>
        private void BelowImage_Click(object sender, MouseButtonEventArgs e)
        {
            if (frontImage.Source == null)
            {
                MessageBox.Show("先に画像一覧から画像を選択してください。", "情報", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }
            
            var selectedItem = mascotImageListView.SelectedItem as MascotImageItem;
            if (selectedItem == null) return;
            
            GenerateAngleImage("below", selectedItem.FileName, selectedItem.ImagePath, belowImage);
        }

        /// <summary>
        /// 背面画像クリック
        /// </summary>
        private void BehindImage_Click(object sender, MouseButtonEventArgs e)
        {
            if (frontImage.Source == null)
            {
                MessageBox.Show("先に画像一覧から画像を選択してください。", "情報", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }
            
            var selectedItem = mascotImageListView.SelectedItem as MascotImageItem;
            if (selectedItem == null) return;
            
            GenerateAngleImage("behind", selectedItem.FileName, selectedItem.ImagePath, behindImage);
        }

        /// <summary>
        /// 指定された方角から見た画像を生成
        /// </summary>
        /// <param name="from">方角 (left, right, above, below, behind)</param>
        /// <param name="frontImageFileName">基準となる画像のファイル名</param>
        /// <param name="frontImagePath">基準となる画像のフルパス</param>
        /// <param name="targetImageControl">結果を表示するImageコントロール</param>
        private async void GenerateAngleImage(string from, string frontImageFileName, string frontImagePath, System.Windows.Controls.Image targetImageControl)
        {
            try
            {
                // カーソルを待機状態に
                System.Windows.Input.Mouse.OverrideCursor = System.Windows.Input.Cursors.Wait;
                
                Debug.WriteLine($"[MascotEditWindow] 画像生成開始: from={from}, frontImage={frontImageFileName}");
                
                // 選択されたモデルを取得
                string selectedModel = GetSelectedModel();
                Debug.WriteLine($"[MascotEditWindow] 使用モデル: {selectedModel}");
                
                // Qwen3が選択されている場合はエラー
                if (selectedModel == "qwen3-image-edit")
                {
                    MessageBox.Show("Qwen3 Image Editは現在サポートされていません。", "情報", MessageBoxButton.OK, MessageBoxImage.Information);
                    return;
                }
                
                // 方角に応じたプロンプトを生成
                string prompt = GeneratePromptForAngle(from);
                Debug.WriteLine($"[MascotEditWindow] プロンプト: {prompt}");
                
                // 基準画像を読み込み
                System.Drawing.Image sourceImage;
                using (var stream = new FileStream(frontImagePath, FileMode.Open, FileAccess.Read))
                {
                    sourceImage = System.Drawing.Image.FromStream(stream);
                }
                
                // 画像生成を非同期実行
                var resultImage = await Task.Run(() =>
                {
                    return _googleAiService.sendImageEditRequest(prompt, sourceImage, selectedModel);
                });
                
                if (resultImage != null)
                {
                    // 生成された画像を保存
                    string outputFileName = $"{Path.GetFileNameWithoutExtension(frontImageFileName)}_{from}.png";
                    string outputPath = Path.Combine(_mascotDirectory, outputFileName);
                    
                    resultImage.Save(outputPath, System.Drawing.Imaging.ImageFormat.Png);
                    Debug.WriteLine($"[MascotEditWindow] 画像を保存: {outputPath}");
                    
                    // 生成された画像を表示
                    var bitmap = new System.Windows.Media.Imaging.BitmapImage();
                    bitmap.BeginInit();
                    bitmap.CacheOption = System.Windows.Media.Imaging.BitmapCacheOption.OnLoad;
                    bitmap.CreateOptions = System.Windows.Media.Imaging.BitmapCreateOptions.IgnoreImageCache;
                    bitmap.UriSource = new Uri(outputPath, UriKind.Absolute);
                    bitmap.EndInit();
                    bitmap.Freeze();
                    
                    targetImageControl.Source = bitmap;
                    
                    // 画像一覧を更新
                    LoadImageList();
                    
                    MessageBox.Show($"{from}方向の画像を生成しました。", "完了", MessageBoxButton.OK, MessageBoxImage.Information);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditWindow] 画像生成エラー: {ex.Message}");
                MessageBox.Show($"画像生成に失敗しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                // カーソルを元に戻す
                System.Windows.Input.Mouse.OverrideCursor = null;
            }
        }

        /// <summary>
        /// 選択されたモデルを取得
        /// </summary>
        private string GetSelectedModel()
        {
            var selected = imageModelComboBox.SelectedIndex;
            return selected switch
            {
                0 => "gemini-2.5-flash-image",  // NanoBanana - 画像生成対応の無料モデル
                1 => "gemini-3-pro-image-preview",  // NanaBanana Pro - 高性能な画像生成モデル
                2 => "qwen3-image-edit",
                _ => "gemini-2.5-flash-image"
            };
        }

        /// <summary>
        /// 方角に応じたプロンプトを生成
        /// </summary>
        private string GeneratePromptForAngle(string from)
        {
            return from switch
            {
                "left" => "このキャラクターを左側から見た画像を生成してください。キャラクターの特徴（髪型、服装、色など）を維持し、自然な角度で左側面が見えるように描いてください。",
                "right" => "このキャラクターを右側から見た画像を生成してください。キャラクターの特徴（髪型、服装、色など）を維持し、自然な角度で右側面が見えるように描いてください。",
                "above" => "このキャラクターを上から見下ろした画像を生成してください。キャラクターの特徴（髪型、服装、色など）を維持し、頭頂部や肩が見えるように描いてください。",
                "below" => "このキャラクターを下から見上げた画像を生成してください。キャラクターの特徴（髪型、服装、色など）を維持し、顎や下側が見えるように描いてください。",
                "behind" => "このキャラクターを背面から見た画像を生成してください。キャラクターの特徴（髪型、服装、色など）を維持し、後ろ姿が見えるように描いてください。",
                _ => "このキャラクターの別の角度からの画像を生成してください。"
            };
        }
    }

}
