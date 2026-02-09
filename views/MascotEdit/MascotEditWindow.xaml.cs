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
using DesktopAiMascot.views.MascotEdit;
using MessageBox = System.Windows.MessageBox;

namespace DesktopAiMascot.views
{
    public partial class MascotEditWindow : Window
    {
        private MascotModel _mascotModel;
        private string _mascotDirectory;
        private ObservableCollection<MascotImageItem> _imageItems = new ObservableCollection<MascotImageItem>();


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

            // UserControlの初期化
            mascotEditSettingControl.Initialize(_mascotModel);
            mascotEditSettingControl.RequestReloadImageList += (s, e) => LoadImageList();

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
                        return fileNameWithoutExt.Equals("cover", StringComparison.OrdinalIgnoreCase)
                            ? ""
                            : item.FileName;
                    })
                    .ToList();

                foreach (var item in sortedItems)
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
        /// 画像選択変更イベント
        /// </summary>
        private void ImageListView_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (mascotImageListView.SelectedItem is MascotImageItem selectedItem)
            {
                mascotEditSettingControl.SelectedMascotImage = selectedItem;
            }
            else
            {
                mascotEditSettingControl.SelectedMascotImage = null;
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
                string newName = mascotEditSettingControl.GetDisplayName();

                if (string.IsNullOrEmpty(newName))
                {
                    MessageBox.Show("表示名を入力してください。", "入力エラー", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                // システムプロンプトを保存
                mascotEditSettingControl.SaveConfig();

                // TODO: 表示名の変更処理（config.yamlの更新など、必要であれば実装）

                Debug.WriteLine($"[MascotEditWindow] マスコット情報を保存しました: {newName}");
                MessageBox.Show("マスコット情報を保存しました。", "保存完了", MessageBoxButton.OK, MessageBoxImage.Information);

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
            Close();
        }
    }
}

