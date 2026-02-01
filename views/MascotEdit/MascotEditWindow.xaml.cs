using DesktopAiMascot.mascots;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using MessageBox = System.Windows.MessageBox;
using OpenFileDialog = Microsoft.Win32.OpenFileDialog;

namespace DesktopAiMascot.views.MascotEdit
{
    public partial class MascotEditWindow : Window
    {
        private MascotModel _mascotModel;
        private string _mascotDirectory;
        private List<MascotImageItem> _imageItems = new List<MascotImageItem>();

        public MascotEditWindow(MascotModel mascotModel)
        {
            InitializeComponent();
            _mascotModel = mascotModel;
            
            // MascotModel から保存されているディレクトリパスを使用
            _mascotDirectory = _mascotModel.DirectoryPath;
            
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

                imageListView.ItemsSource = null; // バインディングをリセット
                imageListView.ItemsSource = _imageItems;
                
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
            // TODO: 視点画像生成ウィンドウを実装
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
            if (imageListView.SelectedItem is MascotImageItem selectedItem)
            {
                // TODO: 背景削除ウィンドウを実装
                MessageBox.Show($"背景削除機能は将来実装予定です。\n選択画像: {selectedItem.FileName}", "情報", MessageBoxButton.OK, MessageBoxImage.Information);
            }
        }

        /// <summary>
        /// 表情差分作成
        /// </summary>
        private void GenerateEmotesButton_Click(object sender, RoutedEventArgs e)
        {
            if (imageListView.SelectedItem is MascotImageItem selectedItem)
            {
                // 表情差分作成ウィンドウを開く
                var emoteWindow = new MascotEdit.EmoteGenerationWindow(selectedItem.ImagePath);
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
            bool isSelected = imageListView.SelectedItem != null;
            removeBackgroundButton.IsEnabled = isSelected;
            generateEmotesButton.IsEnabled = isSelected;
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
        /// キャセルボタン
        /// </summary>
        private void CancelButton_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
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
