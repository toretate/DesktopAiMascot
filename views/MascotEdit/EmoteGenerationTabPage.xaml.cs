using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Imaging;
using MessageBox = System.Windows.MessageBox;
using DesktopAiMascot.aiservice.chat;
using DesktopAiMascot.aiservice.image;

namespace DesktopAiMascot.views.MascotEdit
{
    /// <summary>
    /// EmoteGenerationTabPage.xaml の相互作用ロジック
    /// </summary>
    public partial class EmoteGenerationTabPage : System.Windows.Controls.UserControl
    {
        private const string ComfyQwen3ImageEditServiceName = "Comfy - Qwen3ImageEdit";
        private string _sourceImagePath = string.Empty;
        private List<EmoteItem> _emoteItems = new List<EmoteItem>();
        private GoogleAiStudioChatService? _chatService;
        private ComfyQwen3ImageEditService? _comfyQwen3Service;

        public EmoteGenerationTabPage()
        {
            InitializeComponent();
        }

        /// <summary>
        /// タブページを初期化
        /// </summary>
        public void Initialize(string sourceImagePath)
        {
            Debug.WriteLine($"[EmoteGenerationTabPage] Initialize called with: {sourceImagePath}");
            _sourceImagePath = sourceImagePath;
            
            // GoogleAiStudioChatServiceを初期化
            _chatService = new GoogleAiStudioChatService();
            _comfyQwen3Service = new ComfyQwen3ImageEditService();
            
            LoadSourceImage();
            InitializeEmoteList();
            Debug.WriteLine($"[EmoteGenerationTabPage] Initialize completed. Emote count: {_emoteItems.Count}");
        }

        /// <summary>
        /// 元画像を読み込む
        /// </summary>
        private void LoadSourceImage()
        {
            try
            {
                if (File.Exists(_sourceImagePath))
                {
                    var bitmap = new BitmapImage();
                    bitmap.BeginInit();
                    bitmap.UriSource = new Uri(_sourceImagePath, UriKind.Absolute);
                    bitmap.CacheOption = BitmapCacheOption.OnLoad;
                    bitmap.EndInit();
                    sourceImage.Source = bitmap;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[EmoteGenerationTabPage] 元画像読み込みエラー: {ex.Message}");
            }
        }

        /// <summary>
        /// 画像をBase64文字列に変換
        /// </summary>
        private string ConvertImageToBase64(string imagePath)
        {
            byte[] imageBytes = File.ReadAllBytes(imagePath);
            return Convert.ToBase64String(imageBytes);
        }

        /// <summary>
        /// Base64文字列を画像に変換してBitmapImageを作成
        /// </summary>
        private BitmapImage ConvertBase64ToImage(string base64String)
        {
            byte[] imageBytes = Convert.FromBase64String(base64String);
            
            var bitmap = new BitmapImage();
            using (var ms = new MemoryStream(imageBytes))
            {
                bitmap.BeginInit();
                bitmap.CacheOption = BitmapCacheOption.OnLoad;
                bitmap.StreamSource = ms;
                bitmap.EndInit();
            }
            bitmap.Freeze();
            
            return bitmap;
        }

        /// <summary>
        /// 表情一覧を初期化
        /// </summary>
        private void InitializeEmoteList()
        {
            Debug.WriteLine("[EmoteGenerationTabPage] InitializeEmoteList called");
            
            const string promptTemplate = "ONLY change the facial expression, {0}, 1girl, solo, same character, same hairstyle, same outfit, front view, standing, high quality anime illustration";
            
            // チャットマスコットとして必要な表情の一覧
            _emoteItems = new List<EmoteItem>
            {
                // === アニメーションベース（必須） ===
                new EmoteItem { GroupName = "アニメーションベース", EmoteName = "通常", Description = "デフォルトの表情", Prompt = string.Format(promptTemplate, "neutral expression, calm face") },
                new EmoteItem { GroupName = "アニメーションベース", EmoteName = "目閉じ", Description = "目を閉じた表情", Prompt = string.Format(promptTemplate, "eyes closed, peaceful expression") },
                new EmoteItem { GroupName = "アニメーションベース", EmoteName = "口閉じ", Description = "口を閉じた表情", Prompt = string.Format(promptTemplate, "mouth closed, gentle smile") },
                
                // === 基本表情（感情表現） ===
                new EmoteItem { GroupName = "基本表情", EmoteName = "笑顔", Description = "嬉しい時の表情", Prompt = string.Format(promptTemplate, "happy smile, joyful, bright eyes") },
                new EmoteItem { GroupName = "基本表情", EmoteName = "悲しみ", Description = "悲しい時の表情", Prompt = string.Format(promptTemplate, "sad expression, downcast eyes, teary") },
                new EmoteItem { GroupName = "基本表情", EmoteName = "怒り", Description = "怒った時の表情", Prompt = string.Format(promptTemplate, "angry expression, furrowed brow, intense gaze") },
                new EmoteItem { GroupName = "基本表情", EmoteName = "驚き", Description = "驚いた時の表情", Prompt = string.Format(promptTemplate, "surprised expression, wide eyes, open mouth") },
                
                // === 追加表情（会話用） ===
                new EmoteItem { GroupName = "会話用表情", EmoteName = "照れ", Description = "恥ずかしい表情", Prompt = string.Format(promptTemplate, "blushing, shy expression, embarrassed, red cheeks") },
                new EmoteItem { GroupName = "会話用表情", EmoteName = "困惑", Description = "困っている表情", Prompt = string.Format(promptTemplate, "confused expression, puzzled, uncertain") },
                new EmoteItem { GroupName = "会話用表情", EmoteName = "疲労", Description = "疲れている表情", Prompt = string.Format(promptTemplate, "tired expression, exhausted, sleepy eyes") },
                new EmoteItem { GroupName = "会話用表情", EmoteName = "興奮", Description = "興奮している表情", Prompt = string.Format(promptTemplate, "excited expression, energetic, sparkling eyes") },
                new EmoteItem { GroupName = "会話用表情", EmoteName = "思考", Description = "考えている表情", Prompt = string.Format(promptTemplate, "thinking expression, contemplative, hand on chin") },
                new EmoteItem { GroupName = "会話用表情", EmoteName = "ウインク", Description = "片目をつぶった表情", Prompt = string.Format(promptTemplate, "wink, one eye closed, playful smile") }
            };

            Debug.WriteLine($"[EmoteGenerationTabPage] Created {_emoteItems.Count} emote items");

            // グループ化されたビューを作成
            var groupedView = System.Windows.Data.CollectionViewSource.GetDefaultView(_emoteItems);
            groupedView.GroupDescriptions.Add(new System.Windows.Data.PropertyGroupDescription("GroupName"));

            emoteItemsControl.ItemsSource = groupedView;
            Debug.WriteLine($"[EmoteGenerationTabPage] ItemsSource set. Group count: {groupedView.Groups?.Count ?? 0}");
        }

        private async void GenerateAllButton_Click(object sender, RoutedEventArgs e)
        {
            generateAllButton.IsEnabled = false;
            try
            {
                string aiService = (aiServiceComboBox.SelectedItem as ComboBoxItem)?.Content.ToString() ?? "Nano Banana";
                string promptAdjust = promptAdjustTextBox.Text;

                foreach (var emote in _emoteItems)
                {
                    await GenerateEmoteAsync(emote, aiService, promptAdjust);
                }

                MessageBox.Show("全ての表情の生成が完了しました。", "完了", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[EmoteGenerationTabPage] 一括生成エラー: {ex.Message}");
                MessageBox.Show($"表情の生成中にエラーが発生しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                generateAllButton.IsEnabled = true;
            }
        }

        private void GenerateEmoteButton_Click(object sender, RoutedEventArgs e)
        {
            if (sender is System.Windows.Controls.Button button && button.Tag is EmoteItem emote)
            {
                button.IsEnabled = false;
                try
                {
                    string aiService = (aiServiceComboBox.SelectedItem as ComboBoxItem)?.Content.ToString() ?? "Nano Banana";
                    string promptAdjust = promptAdjustTextBox.Text;
                    _ = GenerateEmoteAsync(emote, aiService, promptAdjust);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[EmoteGenerationTabPage] 表情生成エラー: {ex.Message}");
                    MessageBox.Show($"表情の生成に失敗しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
                }
                finally
                {
                    button.IsEnabled = true;
                }
            }
        }

        private async System.Threading.Tasks.Task GenerateEmoteAsync(EmoteItem emote, string aiService, string promptAdjust)
        {
            emote.StatusText = "生成中...";
            try
            {
                string imageBase64 = ConvertImageToBase64(_sourceImagePath);
                string fullPrompt = $"Edit this image to show: {emote.Prompt}. {promptAdjust}";
                
                Debug.WriteLine($"[EmoteGenerationTabPage] {aiService}で表情「{emote.EmoteName}」を生成中");
                Debug.WriteLine($"[EmoteGenerationTabPage] プロンプト: {fullPrompt}");

                string? resultBase64;
                if (aiService == ComfyQwen3ImageEditServiceName)
                {
                    if (_comfyQwen3Service == null)
                    {
                        emote.StatusText = "エラー: サービスが初期化されていません";
                        return;
                    }

                    // 表情差分作成用のメソッドを使用（角度LoRAをOFF）
                    resultBase64 = await _comfyQwen3Service.EditImageForEmoteAsync(imageBase64, fullPrompt);
                }
                else
                {
                    if (_chatService == null)
                    {
                        emote.StatusText = "エラー: サービスが初期化されていません";
                        return;
                    }

                    resultBase64 = await _chatService.SendMessageWithImagesAsync(new[] { imageBase64 }, fullPrompt);
                }
                
                if (!string.IsNullOrEmpty(resultBase64))
                {
                    // 生成された画像をBase64で保存
                    emote.GeneratedImageBase64 = resultBase64;
                    
                    // UIスレッドで画像を更新
                    await Dispatcher.InvokeAsync(() =>
                    {
                        try
                        {
                            var bitmap = new BitmapImage();
                            bitmap.BeginInit();
                            byte[] imageBytes = Convert.FromBase64String(resultBase64);
                            using (var ms = new MemoryStream(imageBytes))
                            {
                                bitmap.CacheOption = BitmapCacheOption.OnLoad;
                                bitmap.StreamSource = ms;
                                bitmap.EndInit();
                            }
                            bitmap.Freeze();
                            
                            emote.ImagePath = "generated";
                            emote.GeneratedBitmapImage = bitmap;
                            emote.StatusText = "生成完了（未保存）";
                            emote.HasImage = true;
                        }
                        catch (Exception ex)
                        {
                            Debug.WriteLine($"[EmoteGenerationTabPage] 画像変換エラー: {ex.Message}");
                            emote.StatusText = "生成完了（表示失敗）";
                            emote.HasImage = true;
                        }
                    });
                    Debug.WriteLine($"[EmoteGenerationTabPage] 表情「{emote.EmoteName}」の生成が完了しました");
                }
                else
                {
                    emote.StatusText = "生成失敗";
                    Debug.WriteLine($"[EmoteGenerationTabPage] 表情「{emote.EmoteName}」の生成に失敗しました");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[EmoteGenerationTabPage] 表情生成エラー: {ex.Message}");
                emote.StatusText = $"エラー: {ex.Message}";
            }
        }

        private void SaveEmoteButton_Click(object sender, RoutedEventArgs e)
        {
            if (sender is System.Windows.Controls.Button button && button.Tag is EmoteItem emote)
            {
                try
                {
                    if (string.IsNullOrEmpty(emote.GeneratedImageBase64))
                    {
                        MessageBox.Show("保存する画像がありません。", "エラー", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }

                    string mascotDir = Path.GetDirectoryName(_sourceImagePath) ?? "";
                    string fileName = $"emote_{emote.EmoteName.ToLowerInvariant()}.png";
                    string savePath = Path.Combine(mascotDir, fileName);
                    
                    byte[] imageBytes = Convert.FromBase64String(emote.GeneratedImageBase64);
                    File.WriteAllBytes(savePath, imageBytes);
                    
                    Debug.WriteLine($"[EmoteGenerationTabPage] 表情「{emote.EmoteName}」を保存: {savePath}");
                    
                    emote.StatusText = "保存済み";
                    emote.ImagePath = savePath;
                    
                    MessageBox.Show($"表情「{emote.EmoteName}」を保存しました。", "保存完了", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[EmoteGenerationTabPage] 保存エラー: {ex.Message}");
                    MessageBox.Show($"保存に失敗しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }

        private void SaveAllButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                int savedCount = 0;
                
                foreach (var emote in _emoteItems.Where(e => e.HasImage && !string.IsNullOrEmpty(e.GeneratedImageBase64)))
                {
                    string mascotDir = Path.GetDirectoryName(_sourceImagePath) ?? "";
                    string fileName = $"emote_{emote.EmoteName.ToLowerInvariant()}.png";
                    string savePath = Path.Combine(mascotDir, fileName);
                    
                    byte[] imageBytes = Convert.FromBase64String(emote.GeneratedImageBase64);
                    File.WriteAllBytes(savePath, imageBytes);
                    
                    emote.StatusText = "保存済み";
                    emote.ImagePath = savePath;
                    
                    savedCount++;
                }

                MessageBox.Show($"{savedCount}個の表情を保存しました。", "保存完了", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[EmoteGenerationTabPage] 一括保存エラー: {ex.Message}");
                MessageBox.Show($"保存中にエラーが発生しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
