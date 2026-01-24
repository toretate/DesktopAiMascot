using DesktopAiMascot.aiservice;
using DesktopAiMascot.aiservice.voice;
using DesktopAiMascot.Controls;
using DesktopAiMascot.mascots;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Media;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;

namespace DesktopAiMascot.controls
{
    /// <summary>
    /// MessageListPanel.xaml の相互作用ロジック
    /// WPF版のメッセージリストコントロール
    /// </summary>
    public partial class MessageListPanel : System.Windows.Controls.UserControl
    {
        public event EventHandler? RequestDragMove;
        
        private SoundPlayer? currentPlayer = null;
        private ChatMessage? currentPlayingMessage = null;

        public MessageListPanel()
        {
            InitializeComponent();

            // ChatHistoryからメッセージを読み込み
            foreach (var m in ChatHistory.GetMessages())
            {
                chatMessageListBox.Items.Add(m);
            }

            // メッセージの追加・読み込みイベントを購読
            ChatHistory.MessageAdded += OnMessageAdded;
            ChatHistory.MessagesLoaded += OnMessagesLoaded;

            // ウィンドウドラッグを有効化
            this.MouseDown += DragMove_MouseDown;
            chatMessageListBox.MouseDown += DragMove_MouseDown;
        }

        /// <summary>
        /// ウィンドウドラッグ処理
        /// </summary>
        private void DragMove_MouseDown(object? sender, MouseButtonEventArgs e)
        {
            if (e.ChangedButton == MouseButton.Left)
            {
                // WPFウィンドウ内の場合
                var window = Window.GetWindow(this);
                if (window != null)
                {
                    try
                    {
                        window.DragMove();
                    }
                    catch (InvalidOperationException)
                    {
                        // DragMoveは左ボタンが押されている間のみ有効
                    }
                }
                else
                {
                    // ElementHost内でホストされている場合、親に通知
                    RequestDragMove?.Invoke(this, EventArgs.Empty);
                }
            }
        }

        /// <summary>
        /// メッセージ追加イベントハンドラ
        /// </summary>
        private void OnMessageAdded(object? sender, ChatHistory.ChatMessageEventArgs e)
        {
            if (e?.Message == null) return;

            Dispatcher.Invoke(() =>
            {
                chatMessageListBox.Items.Add(e.Message);
                ScrollToBottom();
            });
        }

        /// <summary>
        /// メッセージ一括読み込みイベントハンドラ
        /// </summary>
        private void OnMessagesLoaded(object? sender, ChatHistory.ChatMessagesEventArgs e)
        {
            if (e?.Messages == null) return;

            Dispatcher.Invoke(() =>
            {
                chatMessageListBox.Items.Clear();
                foreach (var m in e.Messages)
                {
                    chatMessageListBox.Items.Add(m);
                }
                ScrollToBottom();
            });
        }

        /// <summary>
        /// メッセージを追加
        /// </summary>
        public void AddMessage(string sender, string text)
        {
            if (string.IsNullOrEmpty(text)) return;

            Dispatcher.Invoke(() =>
            {
                var msg = new ChatMessage { Sender = sender, Text = text };
                ChatHistory.AddMessage(msg);
            });
        }

        /// <summary>
        /// 全メッセージを取得
        /// </summary>
        public IReadOnlyList<ChatMessage> GetMessages() => ChatHistory.GetMessages();

        /// <summary>
        /// メッセージをクリア
        /// </summary>
        public void ClearMessages()
        {
            chatMessageListBox.Items.Clear();
            ChatHistory.DeleteAll();
        }

        /// <summary>
        /// メッセージをファイルに保存
        /// </summary>
        public void SaveToFile(string path, string? sessionId = null)
        {
            try
            {
                ChatHistory.Save(path, sessionId);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"保存エラー: {ex.Message}");
            }
        }

        /// <summary>
        /// メッセージをファイルから読み込み
        /// </summary>
        public string? LoadFromFile(string path)
        {
            try
            {
                chatMessageListBox.Items.Clear();
                var (loaded, sid) = ChatHistory.Load(path);
                ScrollToBottom();
                return sid;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"読み込みエラー: {ex.Message}");
            }

            return null;
        }

        /// <summary>
        /// 選択中のメッセージをクリップボードにコピー
        /// </summary>
        public void CopySelectionToClipboard()
        {
            if (chatMessageListBox.SelectedItems.Count == 0) return;

            var messages = chatMessageListBox.SelectedItems
                .OfType<ChatMessage>()
                .Select(m => $"{m.Sender}: {m.Text}");

            string text = string.Join(Environment.NewLine + Environment.NewLine, messages);

            try
            {
                System.Windows.Clipboard.SetText(text);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"クリップボードコピーエラー: {ex.Message}");
            }
        }

        /// <summary>
        /// コンテキストメニュー: コピー
        /// </summary>
        private void CopyMenuItem_Click(object sender, RoutedEventArgs e)
        {
            CopySelectionToClipboard();
        }

        /// <summary>
        /// ダブルクリックでメッセージをクリップボードにコピー
        /// </summary>
        private void ListBox_MouseDoubleClick(object sender, MouseButtonEventArgs e)
        {
            if (chatMessageListBox.SelectedItem is ChatMessage msg)
            {
                try
                {
                    System.Windows.Clipboard.SetText(msg.Text);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"クリップボードコピーエラー: {ex.Message}");
                }
            }
        }

        /// <summary>
        /// 再生ボタンのクリックイベント
        /// </summary>
        private void PlayButton_Click(object sender, RoutedEventArgs e)
        {
            if (sender is System.Windows.Controls.Button button && button.Tag is ChatMessage msg)
            {
                // 再生中のメッセージと同じ場合は停止
                if (currentPlayingMessage == msg && currentPlayer != null)
                {
                    StopCurrentPlayback();
                    return;
                }

                // 異なるメッセージの場合は、現在の再生を停止してから新しいメッセージを再生
                if (currentPlayer != null)
                {
                    StopCurrentPlayback();
                }

                if (!string.IsNullOrEmpty(msg.VoiceFilePath) && File.Exists(msg.VoiceFilePath))
                {
                    PlayVoiceFileInternal(msg.VoiceFilePath, msg);
                }
                else
                {
                    _ = GenerateTTSAndPlayAsync(msg);
                }
            }
        }

        /// <summary>
        /// 音声ファイルを再生（外部から呼び出し可能）
        /// </summary>
        public void PlayVoiceFile(string filePath)
        {
            try
            {
                if (File.Exists(filePath))
                {
                    Dispatcher.Invoke(() =>
                    {
                        // ファイルパスから該当するメッセージを検索
                        ChatMessage? targetMessage = null;
                        foreach (var item in chatMessageListBox.Items)
                        {
                            if (item is ChatMessage msg && msg.VoiceFilePath == filePath)
                            {
                                targetMessage = msg;
                                break;
                            }
                        }
                        
                        PlayVoiceFileInternal(filePath, targetMessage);
                    });
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"音声再生エラー: {ex.Message}");
            }
        }

        /// <summary>
        /// 音声ファイルを再生（内部処理）
        /// </summary>
        private void PlayVoiceFileInternal(string filePath, ChatMessage? message)
        {
            try
            {
                if (File.Exists(filePath))
                {
                    // 前の再生を停止
                    if (currentPlayer != null)
                    {
                        try
                        {
                            currentPlayer.Stop();
                            currentPlayer.Dispose();
                        }
                        catch { }
                    }

                    currentPlayer = new SoundPlayer(filePath);
                    currentPlayingMessage = message;
                    
                    // 同期的に読み込んで再生
                    currentPlayer.Load();
                    
                    // ボタンの画像を停止ボタンに変更（読み込み完了後に確実に更新）
                    Dispatcher.Invoke(() =>
                    {
                        UpdatePlayButtonImage(message, true);
                    }, System.Windows.Threading.DispatcherPriority.Render);
                    
                    // 再生開始
                    currentPlayer.Play();
                    
                    // WAVファイルの長さを取得して、再生完了後にボタンを戻す
                    Task.Run(async () =>
                    {
                        try
                        {
                            // WAVファイルの長さを推定（簡易版）
                            var fileInfo = new FileInfo(filePath);
                            int estimatedDurationMs = (int)(fileInfo.Length / 44.1); // 44.1kHz, 16bit, stereo の場合の概算
                            
                            await Task.Delay(estimatedDurationMs);
                            
                            Dispatcher.Invoke(() =>
                            {
                                if (currentPlayingMessage == message)
                                {
                                    StopCurrentPlayback();
                                }
                            });
                        }
                        catch { }
                    });
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"音声再生エラー: {ex.Message}");
                if (currentPlayer != null)
                {
                    try
                    {
                        currentPlayer.Dispose();
                    }
                    catch { }
                    currentPlayer = null;
                }
                currentPlayingMessage = null;
                UpdatePlayButtonImage(message, false);
            }
        }

        /// <summary>
        /// 現在の再生を停止
        /// </summary>
        private void StopCurrentPlayback()
        {
            if (currentPlayer != null)
            {
                try
                {
                    currentPlayer.Stop();
                    currentPlayer.Dispose();
                }
                catch { }
                currentPlayer = null;
            }

            var message = currentPlayingMessage;
            currentPlayingMessage = null;
            
            // ボタンの画像を再生ボタンに戻す
            UpdatePlayButtonImage(message, false);
        }

        /// <summary>
        /// 再生ボタンの画像を更新
        /// </summary>
        private void UpdatePlayButtonImage(ChatMessage? message, bool isPlaying)
        {
            if (message == null) return;

            try
            {
                // ListBoxの全アイテムをスキャンして該当するボタンを見つける
                foreach (var item in chatMessageListBox.Items)
                {
                    if (item == message)
                    {
                        var container = chatMessageListBox.ItemContainerGenerator.ContainerFromItem(item) as System.Windows.Controls.ListBoxItem;
                        if (container != null)
                        {
                            var button = FindVisualChild<System.Windows.Controls.Button>(container, "PlayButton");
                            if (button != null)
                            {
                                var template = button.Template;
                                if (template != null)
                                {
                                    var image = template.FindName("ButtonImage", button) as System.Windows.Controls.Image;
                                    if (image != null)
                                    {
                                        string imagePath = isPlaying 
                                            ? "/assets/icons/PlayStopButton_x2.png" 
                                            : "/assets/icons/PlayButton_x2.png";
                                        image.Source = new System.Windows.Media.Imaging.BitmapImage(new Uri(imagePath, UriKind.Relative));
                                    }
                                }
                            }
                        }
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"ボタン画像更新エラー: {ex.Message}");
            }
        }

        /// <summary>
        /// ビジュアルツリーから指定した名前の子要素を検索
        /// </summary>
        private static T? FindVisualChild<T>(System.Windows.DependencyObject parent, string childName) where T : System.Windows.DependencyObject
        {
            if (parent == null) return null;

            int childCount = System.Windows.Media.VisualTreeHelper.GetChildrenCount(parent);
            for (int i = 0; i < childCount; i++)
            {
                var child = System.Windows.Media.VisualTreeHelper.GetChild(parent, i);
                
                if (child is T typedChild && (child as System.Windows.FrameworkElement)?.Name == childName)
                {
                    return typedChild;
                }

                var foundChild = FindVisualChild<T>(child, childName);
                if (foundChild != null)
                {
                    return foundChild;
                }
            }

            return null;
        }

        /// <summary>
        /// TTSを生成して再生
        /// </summary>
        private async Task GenerateTTSAndPlayAsync(ChatMessage msg)
        {
            try
            {
                Debug.WriteLine($"[TTS] 再生ボタンクリック: TTS生成を開始します。テキスト: {msg.Text}");

                // マスコット名を取得
                var mascotName = MascotManager.Instance.CurrentModel?.Name ?? "default";
                Console.WriteLine($"[TTS] マスコット名: {mascotName}");

                // 音声ファイルの保存先を決定
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string voiceDir = Path.Combine(baseDir, "tmp", "voice", mascotName);
                if (!Directory.Exists(voiceDir))
                {
                    Directory.CreateDirectory(voiceDir);
                    Debug.WriteLine($"[TTS] ディレクトリを作成しました: {voiceDir}");
                }

                // StyleBertVits2Serviceを使用してTTSをストリーミングで実行
                Debug.WriteLine($"[TTS] StyleBertVits2Serviceにリクエストを送信します...");
                var ttsService = new StyleBertVits2Service();
                byte[] audioData = await ttsService.SynthesizeAsync(msg.Text);
                Console.WriteLine($"[TTS] 音声データを受信しました。サイズ: {audioData.Length} bytes ({audioData.Length / 1024.0:F2} KB)");

                // 音声ファイルを保存
                await File.WriteAllBytesAsync(voiceFilePath, audioData);
                Console.WriteLine($"[TTS] 音声ファイルを保存しました: {voiceFilePath}");

                // メッセージに音声ファイルパスを設定
                msg.VoiceFilePath = voiceFilePath;

                // UIを更新
                Dispatcher.Invoke(() =>
                {
                    chatMessageListBox.Items.Refresh();
                });

                // 音声を再生
                PlayVoiceFileInternal(voiceFilePath, msg);

                Console.WriteLine($"[TTS] TTS生成と再生が正常に完了しました");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[TTS] WAVファイル解析エラー: {ex.Message}");
            }
        }

        /// <summary>
        /// 最下部までスクロール
        /// </summary>
        private void ScrollToBottom()
        {
            if (chatMessageListBox.Items.Count == 0) return;

            try
            {
                // 最後のアイテムまでスクロール
                chatMessageListBox.ScrollIntoView(chatMessageListBox.Items[chatMessageListBox.Items.Count - 1]);
                
                // ScrollViewerを取得して完全に最下部までスクロール
                Dispatcher.BeginInvoke(new Action(() =>
                {
                    if (System.Windows.Media.VisualTreeHelper.GetChildrenCount(chatMessageListBox) > 0)
                    {
                        var border = System.Windows.Media.VisualTreeHelper.GetChild(chatMessageListBox, 0) as System.Windows.Controls.Border;
                        var scrollViewer = border?.Child as System.Windows.Controls.ScrollViewer;
                        if (scrollViewer != null)
                        {
                            scrollViewer.ScrollToEnd();
                        }
                    }
                }), System.Windows.Threading.DispatcherPriority.Loaded);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"スクロールエラー: {ex.Message}");
            }
        }

        /// <summary>
        /// リソース解放
        /// </summary>
        ~MessageListPanel()
        {
            ChatHistory.MessageAdded -= OnMessageAdded;
            ChatHistory.MessagesLoaded -= OnMessagesLoaded;

            StopCurrentPlayback();
        }
    }
}
