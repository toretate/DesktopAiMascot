using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Media.Imaging;
using MessageBox = System.Windows.MessageBox;
using DesktopAiMascot.aiservice.chat;

namespace DesktopAiMascot.views.MascotEdit
{
    public partial class EmoteGenerationWindow : Window
    {
        private string _sourceImagePath;
        private List<EmoteItem> _emoteItems = new List<EmoteItem>();
        private GoogleAiStudioChatService? _chatService;

        public EmoteGenerationWindow(string sourceImagePath)
        {
            InitializeComponent();
            _sourceImagePath = sourceImagePath;
            
            // GoogleAiStudioChatServiceを初期化
            _chatService = new GoogleAiStudioChatService();
            
            LoadSourceImage();
            InitializeEmoteList();
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
                Debug.WriteLine($"[EmoteGenerationWindow] 元画像読み込みエラー: {ex.Message}");
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
            // チャットマスコットとして必要な表情の一覧
            _emoteItems = new List<EmoteItem>
            {
                new EmoteItem { EmoteName = "通常", Description = "デフォルトの表情", Prompt = "neutral expression, calm, default face" },
                new EmoteItem { EmoteName = "笑顔", Description = "嬉しい時の表情", Prompt = "happy smile, joyful, cheerful expression" },
                new EmoteItem { EmoteName = "驚き", Description = "驚いた時の表情", Prompt = "surprised expression, wide eyes, open mouth" },
                new EmoteItem { EmoteName = "悲しみ", Description = "悲しい時の表情", Prompt = "sad expression, downcast eyes, tears" },
                new EmoteItem { EmoteName = "怒り", Description = "怒った時の表情", Prompt = "angry expression, furrowed brow, intense gaze" },
                new EmoteItem { EmoteName = "照れ", Description = "照れている表情", Prompt = "blushing, shy expression, embarrassed" },
                new EmoteItem { EmoteName = "困惑", Description = "困っている表情", Prompt = "confused expression, puzzled, uncertain" },
                new EmoteItem { EmoteName = "疲労", Description = "疲れている表情", Prompt = "tired expression, exhausted, weary" },
                new EmoteItem { EmoteName = "興奮", Description = "興奮している表情", Prompt = "excited expression, energetic, enthusiastic" },
                new EmoteItem { EmoteName = "思考", Description = "考えている表情", Prompt = "thinking expression, contemplative, pensive" },
                new EmoteItem { EmoteName = "不安", Description = "不安な表情", Prompt = "anxious expression, worried, nervous" },
                new EmoteItem { EmoteName = "楽しい", Description = "楽しんでいる表情", Prompt = "playful expression, having fun, amused" }
            };

            emoteItemsControl.ItemsSource = _emoteItems;
        }

        private async void GenerateAllButton_Click(object sender, RoutedEventArgs e)
        {
            generateAllButton.IsEnabled = false;
            try
            {
                string aiService = (aiServiceComboBox.SelectedItem as System.Windows.Controls.ComboBoxItem)?.Content.ToString() ?? "Nano Banana";
                string promptAdjust = promptAdjustTextBox.Text;

                foreach (var emote in _emoteItems)
                {
                    await GenerateEmoteAsync(emote, aiService, promptAdjust);
                }

                MessageBox.Show("全ての表情の生成が完了しました。", "完了", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[EmoteGenerationWindow] 一括生成エラー: {ex.Message}");
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
                    string aiService = (aiServiceComboBox.SelectedItem as System.Windows.Controls.ComboBoxItem)?.Content.ToString() ?? "Nano Banana";
                    string promptAdjust = promptAdjustTextBox.Text;
                    _ = GenerateEmoteAsync(emote, aiService, promptAdjust);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[EmoteGenerationWindow] 表情生成エラー: {ex.Message}");
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
                if (_chatService == null)
                {
                    emote.StatusText = "エラー: サービスが初期化されていません";
                    return;
                }

                string imageBase64 = ConvertImageToBase64(_sourceImagePath);
                string fullPrompt = $"Edit this image to show: {emote.Prompt}. {promptAdjust}";
                
                Debug.WriteLine($"[EmoteGenerationWindow] {aiService}で表情「{emote.EmoteName}」を生成中");
                Debug.WriteLine($"[EmoteGenerationWindow] プロンプト: {fullPrompt}");
                
                var resultBase64 = await _chatService.SendMessageWithImagesAsync(new[] { imageBase64 }, fullPrompt);
                
                if (!string.IsNullOrEmpty(resultBase64))
                {
                    var generatedImage = ConvertBase64ToImage(resultBase64);
                    await Dispatcher.InvokeAsync(() =>
                    {
                        emote.ImagePath = _sourceImagePath;
                        emote.GeneratedImageBase64 = resultBase64;
                        emote.StatusText = "生成完了（未保存）";
                        emote.HasImage = true;
                    });
                    Debug.WriteLine($"[EmoteGenerationWindow] 表情「{emote.EmoteName}」の生成が完了しました");
                }
                else
                {
                    emote.StatusText = "生成失敗";
                    Debug.WriteLine($"[EmoteGenerationWindow] 表情「{emote.EmoteName}」の生成に失敗しました");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[EmoteGenerationWindow] 表情生成エラー: {ex.Message}");
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
                    
                    Debug.WriteLine($"[EmoteGenerationWindow] 表情「{emote.EmoteName}」を保存: {savePath}");
                    
                    emote.StatusText = "保存済み";
                    emote.ImagePath = savePath;
                    
                    MessageBox.Show($"表情「{emote.EmoteName}」を保存しました。", "保存完了", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[EmoteGenerationWindow] 保存エラー: {ex.Message}");
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
                Debug.WriteLine($"[EmoteGenerationWindow] 一括保存エラー: {ex.Message}");
                MessageBox.Show($"保存中にエラーが発生しました。\n{ex.Message}", "エラー", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void CloseButton_Click(object sender, RoutedEventArgs e)
        {
            Close();
        }
    }

    public class EmoteItem : INotifyPropertyChanged
    {
        private string _imagePath = string.Empty;
        private string _statusText = "未生成";
        private bool _hasImage = false;

        public string EmoteName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Prompt { get; set; } = string.Empty;
        public string GeneratedImageBase64 { get; set; } = string.Empty;

        public string ImagePath
        {
            get => _imagePath;
            set
            {
                _imagePath = value;
                OnPropertyChanged(nameof(ImagePath));
            }
        }

        public string StatusText
        {
            get => _statusText;
            set
            {
                _statusText = value;
                OnPropertyChanged(nameof(StatusText));
            }
        }

        public bool HasImage
        {
            get => _hasImage;
            set
            {
                _hasImage = value;
                OnPropertyChanged(nameof(HasImage));
            }
        }

        public event PropertyChangedEventHandler? PropertyChanged;

        protected void OnPropertyChanged(string propertyName)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}
