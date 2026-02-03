using DesktopAiMascot.mascots;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.utils;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Diagnostics;

namespace DesktopAiMascot.views
{
    public partial class MascotPropertyPage : System.Windows.Controls.UserControl
    {
        public event EventHandler<MascotModel>? MascotChanged;

        public MascotPropertyPage()
        {
            InitializeComponent();

            try
            {
                if (MascotManager.Instance.MascotModels.Count == 0)
                {
                    MascotManager.Instance.Load();
                }
                PopulateMascotListView();
                UpdateMascotInfoLabels();
            }
            catch { }

            this.IsVisibleChanged += (s, e) =>
            {
                if (this.IsVisible)
                {
                    PopulateMascotListView();
                    UpdateMascotInfoLabels();
                }
            };

            // Editボタンのイベントハンドラを追加
            editMascot.Click += EditMascot_Click;
        }

        /// <summary>
        /// マスコット編集ボタンクリックイベント
        /// </summary>
        private void EditMascot_Click(object sender, RoutedEventArgs e)
        {
            var currentModel = MascotManager.Instance.CurrentModel;
            
            if (currentModel == null)
            {
                System.Windows.MessageBox.Show("マスコットが選択されていません。", "エラー", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            try
            {
                var editWindow = new MascotEditWindow(currentModel);
                editWindow.Owner = Window.GetWindow(this);
                
                if (editWindow.ShowDialog() == true)
                {
                    // 編集後、マスコット一覧を再読み込み
                    MascotManager.Instance.Load();
                    PopulateMascotListView();
                    UpdateMascotInfoLabels();
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotPropertyPage] マスコット編集ウィンドウ起動エラー: {ex.Message}");
                System.Windows.MessageBox.Show($"マスコット編集ウィンドウの起動に失敗しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        /// <summary>
        /// マスコットに保存されているVoice設定を即座に適用します
        /// </summary>
        private void ApplyVoiceConfigForMascot(MascotModel mascot)
        {
            try
            {
                Debug.WriteLine($"[MascotPropertyPage] ========== Voice設定の適用開始 ==========");
                Debug.WriteLine($"[MascotPropertyPage] マスコット: {mascot.Name}");
                
                var currentService = VoiceAiManager.Instance.CurrentService;
                if (currentService == null)
                {
                    Debug.WriteLine("[MascotPropertyPage] Voice AIサービスが選択されていません");
                    return;
                }
                
                Debug.WriteLine($"[MascotPropertyPage] 現在のVoice AIサービス: {currentService.Name}");
                
                // マスコットのVoice設定を取得
                if (mascot.Config.Voice != null &&
                    mascot.Config.Voice.TryGetValue(currentService.Name, out var voiceConfig))
                {
                    Debug.WriteLine($"[MascotPropertyPage] ✓ マスコットに{currentService.Name}のVoice設定が見つかりました");
                    Debug.WriteLine($"[MascotPropertyPage]   - モデル: {voiceConfig.Model}");
                    Debug.WriteLine($"[MascotPropertyPage]   - スピーカー: {voiceConfig.Speaker}");

                    // モデルとスピーカーを設定
                    if (!string.IsNullOrEmpty(voiceConfig.Model))
                    {
                        Debug.WriteLine($"[MascotPropertyPage] サービスのモデルを '{currentService.Model}' から '{voiceConfig.Model}' に変更");
                        currentService.Model = voiceConfig.Model;
                        SystemConfig.Instance.VoiceServiceModel = voiceConfig.Model;
                    }

                    if (!string.IsNullOrEmpty(voiceConfig.Speaker))
                    {
                        Debug.WriteLine($"[MascotPropertyPage] サービスのスピーカーを '{currentService.Speaker}' から '{voiceConfig.Speaker}' に変更");
                        currentService.Speaker = voiceConfig.Speaker;
                        SystemConfig.Instance.VoiceServiceSpeaker = voiceConfig.Speaker;
                    }

                    SystemConfig.Instance.Save();
                    Debug.WriteLine($"[MascotPropertyPage] ✓ Voice設定をSystemConfigに保存しました");
                }
                else
                {
                    Debug.WriteLine($"[MascotPropertyPage] ✗ マスコット「{mascot.Name}」には「{currentService.Name}」のVoice設定がありません");
                    Debug.WriteLine($"[MascotPropertyPage] デフォルトのVoice設定を使用します");
                }
                
                // ラベルを更新
                UpdateMascotInfoLabels();
                
                Debug.WriteLine($"[MascotPropertyPage] ========== Voice設定の適用完了 ==========");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotPropertyPage] ✗ Voice設定の適用エラー: {ex.Message}");
                Debug.WriteLine($"[MascotPropertyPage] スタックトレース: {ex.StackTrace}");
            }
        }

        /// <summary>
        /// mascotListViewにマスコット画像一覧を表示する
        /// </summary>
        private void PopulateMascotListView()
        {
            try
            {
                if (mascotListView == null) return;

                mascotListView.SelectionChanged -= MascotListView_SelectionChanged;
                mascotListView.Items.Clear();

                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string? currentName = MascotManager.Instance.CurrentModel?.Name;
                int selectedIndex = 0;
                int index = 0;

                foreach (var model in MascotManager.Instance.MascotModels.Values)
                {
                    // cover.pngのパスを検索
                    string mascotDir = Path.Combine(baseDir, "assets", "mascots", model.Name);
                    string coverPath = Path.Combine(mascotDir, "cover.png");
                    
                    // cover.pngが存在しない場合、最初の画像を使用
                    if (!File.Exists(coverPath) && model.ImagePaths.Length > 0)
                    {
                        coverPath = Path.Combine(baseDir, model.ImagePaths[0]);
                    }

                    var displayItem = new MascotDisplayItem
                    {
                        Name = model.Name,
                        CoverImagePath = File.Exists(coverPath) ? coverPath : string.Empty
                    };

                    mascotListView.Items.Add(displayItem);

                    if (!string.IsNullOrEmpty(currentName) && model.Name == currentName)
                    {
                        selectedIndex = index;
                    }
                    index++;
                }

                if (mascotListView.Items.Count > 0)
                {
                    mascotListView.SelectedIndex = selectedIndex;
                }

                mascotListView.SelectionChanged += MascotListView_SelectionChanged;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotPropertyPage] mascotListViewの読み込みエラー: {ex.Message}");
            }
        }

        /// <summary>
        /// mascotListViewの選択変更イベント
        /// </summary>
        private void MascotListView_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (mascotListView?.SelectedItem is MascotDisplayItem displayItem)
            {
                Debug.WriteLine($"[MascotPropertyPage] ListViewでマスコットが選択されました: {displayItem.Name}");
                
                SystemConfig.Instance.MascotName = displayItem.Name;
                SystemConfig.Instance.Save();

                var model = MascotManager.Instance.GetMascotByName(displayItem.Name);
                if (model != null)
                {
                    Debug.WriteLine($"[MascotPropertyPage] MascotManager.Instance.CurrentModelを更新: {model.Name}");
                    MascotManager.Instance.CurrentModel = model;
                    
                    // Voice設定を即座に適用
                    ApplyVoiceConfigForMascot(model);
                    
                    // ラベルを更新
                    UpdateMascotInfoLabels();
                    
                    Debug.WriteLine($"[MascotPropertyPage] MascotChangedイベントを発火します: {model.Name}");
                    MascotChanged?.Invoke(this, model);
                }
                else
                {
                    Debug.WriteLine($"[MascotPropertyPage] マスコット '{displayItem.Name}' が見つかりませんでした");
                }
            }
        }

        /// <summary>
        /// マスコット情報ラベルを更新する
        /// </summary>
        private void UpdateMascotInfoLabels()
        {
            try
            {
                var currentModel = MascotManager.Instance.CurrentModel;
                
                // マスコット名
                if (mascotNameLabel != null)
                {
                    mascotNameLabel.Text = currentModel?.Name ?? "未選択";
                }

                // 現在設定中の音声
                if (currentVoiceLabel != null)
                {
                    var currentService = VoiceAiManager.Instance.CurrentService;
                    if (currentService != null)
                    {
                        string voiceInfo = $"{currentService.Name}";
                        
                        if (!string.IsNullOrEmpty(currentService.Model))
                        {
                            voiceInfo += $"\nモデル: {currentService.Model}";
                        }
                        
                        if (!string.IsNullOrEmpty(currentService.Speaker))
                        {
                            voiceInfo += $"\nスピーカー: {currentService.Speaker}";
                        }
                        
                        currentVoiceLabel.Text = voiceInfo;
                    }
                    else
                    {
                        currentVoiceLabel.Text = "未設定";
                    }
                }

                // スタイル（マスコットのConfig情報）
                if (currentStyleLabel != null)
                {
                    if (currentModel != null && currentModel.Config.Voice != null)
                    {
                        var currentService = VoiceAiManager.Instance.CurrentService;
                        if (currentService != null && 
                            currentModel.Config.Voice.TryGetValue(currentService.Name, out var voiceConfig))
                        {
                            string styleInfo = $"{currentService.Name} 設定:";
                            
                            if (!string.IsNullOrEmpty(voiceConfig.Model))
                            {
                                styleInfo += $"\nモデル: {voiceConfig.Model}";
                            }
                            
                            if (!string.IsNullOrEmpty(voiceConfig.Speaker))
                            {
                                styleInfo += $"\nスピーカー: {voiceConfig.Speaker}";
                            }
                            
                            currentStyleLabel.Text = styleInfo;
                        }
                        else
                        {
                            currentStyleLabel.Text = "このマスコットには音声設定がありません";
                        }
                    }
                    else
                    {
                        currentStyleLabel.Text = "未設定";
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotPropertyPage] ラベル更新エラー: {ex.Message}");
            }
        }
    }

    /// <summary>
    /// mascotListViewに表示するマスコット情報
    /// </summary>
    public class MascotDisplayItem
    {
        public string Name { get; set; } = string.Empty;
        public string CoverImagePath { get; set; } = string.Empty;
        
        private System.Windows.Media.Imaging.BitmapSource? _cachedCoverImage;

        /// <summary>
        /// cover.pngをBitmapSourceとして取得（WPFのFileSource直接参照ではなく、ファイルロック防止）
        /// </summary>
        public System.Windows.Media.Imaging.BitmapSource? CoverImage
        {
            get
            {
                // キャッシュがあればそれを返す
                if (_cachedCoverImage != null)
                {
                    return _cachedCoverImage;
                }

                // デザイナーモードでは null を返す
                if (System.ComponentModel.DesignerProperties.GetIsInDesignMode(new System.Windows.DependencyObject()))
                {
                    return null;
                }

                try
                {
                    // ImageLoadHelper を使用してサムネイル版の BitmapSource を読み込む
                    var bitmap = ImageLoadHelper.LoadBitmapThumbnail(CoverImagePath, 80, 80);
                    if (bitmap != null)
                    {
                        // キャッシュに保存
                        _cachedCoverImage = bitmap;
                        return bitmap;
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[MascotDisplayItem] Cover画像読み込みエラー ({Name}): {ex.Message}");
                }

                return null;
            }
        }

        public void Dispose()
        {
            // キャッシュされた画像を解放
            _cachedCoverImage = null;
        }
    }
}
