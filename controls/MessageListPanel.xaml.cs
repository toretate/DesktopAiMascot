using DesktopAiMascot.aiservice;
using DesktopAiMascot.aiservice.voice;
using DesktopAiMascot.Controls;
using DesktopAiMascot.mascots;
using System;
using System.Collections.Generic;
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
        private SoundPlayer? currentPlayer = null;

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
            if (e.LeftButton == MouseButtonState.Pressed)
            {
                var window = Window.GetWindow(this);
                if (window != null)
                {
                    try
                    {
                        window.DragMove();
                    }
                    catch { }
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
                Console.WriteLine($"保存エラー: {ex.Message}");
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
                Console.WriteLine($"読み込みエラー: {ex.Message}");
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
                Console.WriteLine($"クリップボードコピーエラー: {ex.Message}");
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
                    Console.WriteLine($"クリップボードコピーエラー: {ex.Message}");
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
                if (!string.IsNullOrEmpty(msg.VoiceFilePath) && File.Exists(msg.VoiceFilePath))
                {
                    PlayVoiceFileInternal(msg.VoiceFilePath);
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
                    Dispatcher.Invoke(() => PlayVoiceFileInternal(filePath));
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"音声再生エラー: {ex.Message}");
            }
        }

        /// <summary>
        /// 音声ファイルを再生（内部処理）
        /// </summary>
        private void PlayVoiceFileInternal(string filePath)
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
                    currentPlayer.Play();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"音声再生エラー: {ex.Message}");
                if (currentPlayer != null)
                {
                    try
                    {
                        currentPlayer.Dispose();
                    }
                    catch { }
                    currentPlayer = null;
                }
            }
        }

        /// <summary>
        /// TTSを生成して再生
        /// </summary>
        private async Task GenerateTTSAndPlayAsync(ChatMessage msg)
        {
            try
            {
                Console.WriteLine($"[TTS] 再生ボタンクリック: TTS生成を開始します。テキスト: {msg.Text}");

                // マスコット名を取得
                var mascotName = MascotManager.Instance.CurrentModel?.Name ?? "default";
                Console.WriteLine($"[TTS] マスコット名: {mascotName}");

                // 音声ファイルの保存先を決定
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string voiceDir = Path.Combine(baseDir, "tmp", "voice", mascotName);
                if (!Directory.Exists(voiceDir))
                {
                    Directory.CreateDirectory(voiceDir);
                    Console.WriteLine($"[TTS] ディレクトリを作成しました: {voiceDir}");
                }

                // ファイル名を生成（タイムスタンプベース）
                string fileName = $"voice_{DateTime.Now:yyyyMMddHHmmssfff}.wav";
                string voiceFilePath = Path.Combine(voiceDir, fileName);
                Console.WriteLine($"[TTS] 音声ファイル保存先: {voiceFilePath}");

                // StyleBertVits2Serviceを使用してTTSを実行
                Console.WriteLine($"[TTS] StyleBertVits2Serviceにリクエストを送信します...");
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
                PlayVoiceFileInternal(voiceFilePath);

                Console.WriteLine($"[TTS] TTS生成と再生が正常に完了しました");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TTS] TTS生成エラー: {ex.Message}");
                Console.WriteLine($"[TTS] スタックトレース: {ex.StackTrace}");
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
                Console.WriteLine($"スクロールエラー: {ex.Message}");
            }
        }

        /// <summary>
        /// リソース解放
        /// </summary>
        ~MessageListPanel()
        {
            ChatHistory.MessageAdded -= OnMessageAdded;
            ChatHistory.MessagesLoaded -= OnMessagesLoaded;

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
        }
    }
}
