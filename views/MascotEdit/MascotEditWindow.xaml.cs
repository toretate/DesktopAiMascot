using DesktopAiMascot.mascots;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice;
using MessageBox = System.Windows.MessageBox;
using OpenFileDialog = Microsoft.Win32.OpenFileDialog;

namespace DesktopAiMascot.views
{
    public partial class MascotEditWindow : Window
    {
        private MascotModel _mascotModel;
        private string _mascotDirectory;
        private List<MascotImageItem> _imageItems = new List<MascotImageItem>();
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
            
            LoadMascotData();
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
                
                if (File.Exists(coverPath))
                {
                    var bitmap = new System.Windows.Media.Imaging.BitmapImage();
                    bitmap.BeginInit();
                    bitmap.CacheOption = System.Windows.Media.Imaging.BitmapCacheOption.OnLoad;
                    bitmap.CreateOptions = System.Windows.Media.Imaging.BitmapCreateOptions.IgnoreImageCache;
                    bitmap.UriSource = new Uri(coverPath, UriKind.Absolute);
                    bitmap.EndInit();
                    bitmap.Freeze();
                    
                    coverImage.Source = bitmap;
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
                
                // マスコットディレクトリ内のすべてのファイルを取得
                var allFiles = Directory.GetFiles(_mascotDirectory);
                Debug.WriteLine($"[MascotEditWindow] マスコットディレクトリ内のファイル数: {allFiles.Length}");
                
                foreach (var file in allFiles)
                {
                    Debug.WriteLine($"[MascotEditWindow] ファイル: {Path.GetFileName(file)}");
                }
                
                // 画像ファイルをフィルタリング
                var imageFiles = allFiles
                    .Where(f => imageExtensions.Contains(Path.GetExtension(f).ToLowerInvariant()))
                    .OrderBy(f => f)
                    .ToArray();
                
                Debug.WriteLine($"[MascotEditWindow] 画像ファイル数: {imageFiles.Length}");

                foreach (var imagePath in imageFiles)
                {
                    var fileName = Path.GetFileName(imagePath);
                    _imageItems.Add(new MascotImageItem
                    {
                        ImagePath = imagePath,
                        FileName = fileName
                    });
                    
                    Debug.WriteLine($"[MascotEditWindow] 画像アイテム追加: {fileName} ({imagePath})");
                }

                mascotImageListView.ItemsSource = null; // バインディングをリセット
                mascotImageListView.ItemsSource = _imageItems;
                
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
        private void RemoveBackgroundButton_Click(object sender, RoutedEventArgs e)
        {
            if (mascotImageListView.SelectedItem is MascotImageItem selectedItem)
            {
                // TODO: 背景削除処理を実装
                MessageBox.Show($"背景削除機能は将来実装予定です。\n選択画像: {selectedItem.FileName}", "情報", MessageBoxButton.OK, MessageBoxImage.Information);
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
            
            // 選択された画像をfrontImageに表示
            if (isSelected && mascotImageListView.SelectedItem is MascotImageItem selectedItem)
            {
                try
                {
                    var bitmap = new System.Windows.Media.Imaging.BitmapImage();
                    bitmap.BeginInit();
                    bitmap.CacheOption = System.Windows.Media.Imaging.BitmapCacheOption.OnLoad;
                    bitmap.CreateOptions = System.Windows.Media.Imaging.BitmapCreateOptions.IgnoreImageCache;
                    bitmap.UriSource = new Uri(selectedItem.ImagePath, UriKind.Absolute);
                    bitmap.EndInit();
                    bitmap.Freeze();
                    
                    frontImage.Source = bitmap;
                    Debug.WriteLine($"[MascotEditWindow] frontImageに画像を表示: {selectedItem.FileName}");
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[MascotEditWindow] frontImage表示エラー: {ex.Message}");
                }
            }
            else
            {
                frontImage.Source = null;
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

    /// <summary>
    /// 画像一覧表示用のアイテム
    /// </summary>
    public class MascotImageItem
    {
        public string ImagePath { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        
        /// <summary>
        /// 画像をBitmapImageとして取得
        /// </summary>
        public System.Windows.Media.Imaging.BitmapImage? ImageSource
        {
            get
            {
                // デザイナーモードでは null を返す
                if (System.ComponentModel.DesignerProperties.GetIsInDesignMode(new System.Windows.DependencyObject()))
                {
                    return null;
                }
                
                try
                {
                    if (!string.IsNullOrEmpty(ImagePath) && File.Exists(ImagePath))
                    {
                        var bitmap = new System.Windows.Media.Imaging.BitmapImage();
                        bitmap.BeginInit();
                        bitmap.CacheOption = System.Windows.Media.Imaging.BitmapCacheOption.OnLoad;
                        bitmap.CreateOptions = System.Windows.Media.Imaging.BitmapCreateOptions.IgnoreImageCache;
                        bitmap.UriSource = new Uri(ImagePath, UriKind.Absolute);
                        bitmap.EndInit();
                        bitmap.Freeze(); // メモリリークを防ぐ
                        
                        return bitmap;
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[MascotImageItem] 画像読み込みエラー: {ex.Message}");
                }
                
                return null;
            }
        }
    }
}
