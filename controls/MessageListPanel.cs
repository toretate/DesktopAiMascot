using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Text.Json;
using System.Windows.Forms;
using System.Drawing.Drawing2D;
using DesktopAiMascot.aiservice;
using System.ComponentModel;
using System.Media;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice.voice;
using DesktopAiMascot.mascots;

namespace DesktopAiMascot.Controls
{
    /// <summary>
    /// A list-style message control that uses a ListBox to manage items.
    /// Rendering of each message (bubble) is delegated to ChatMessage.Draw/Measure.
    /// Converted to a partial UserControl so the WinForms designer can be used.
    /// </summary>
    public partial class MessageListPanel : UserControl
    {
        private readonly Padding contentPadding = new(6);
        private const int PLAY_BUTTON_SIZE = 20;
        private const int PLAY_BUTTON_MARGIN = 4;
        private SoundPlayer? currentPlayer = null;

        public MessageListPanel()
        {
            InitializeComponent();

            // Initialize custom context menu items (not designer managed)
            var copyItem = new ToolStripMenuItem("Copy");
            copyItem.Click += (s, e) => CopySelectionToClipboard();
            this.messagesContextMenu.Items.Add(copyItem);

            this.DoubleBuffered = true;
            this.SetStyle(ControlStyles.SupportsTransparentBackColor, true);
            this.BackColor = Color.FromArgb(128, Color.White); // �������̔w�i

            // Ensure listbox has the expected modes (designer may have already set these)
            if (listBox != null)
            {
                listBox.DrawMode = DrawMode.OwnerDrawVariable;
                listBox.SelectionMode = SelectionMode.MultiExtended;
                listBox.IntegralHeight = false;

                listBox.MeasureItem += ListBox_MeasureItem;
                listBox.DrawItem += ListBox_DrawItem;
                listBox.MouseDoubleClick += ListBox_MouseDoubleClick;
                listBox.MouseClick += ListBox_MouseClick;
            }

            // Populate from ChatHistory manager
            foreach (var m in ChatHistory.GetMessages()) listBox.Items.Add(m);

            // Subscribe to future additions and bulk loads
            ChatHistory.MessageAdded += OnMessageAdded;
            ChatHistory.MessagesLoaded += OnMessagesLoaded;
        }

        private void OnMessageAdded(object? sender, ChatHistory.ChatMessageEventArgs e)
        {
            if (e == null || e.Message == null) return;
            if (this.InvokeRequired)
            {
                this.BeginInvoke(new Action(() => OnMessageAdded(sender, e)));
                return;
            }

            listBox.Items.Add(e.Message);
            ScrollToBottom();
        }

        private void OnMessagesLoaded(object? sender, ChatHistory.ChatMessagesEventArgs e)
        {
            if (e == null || e.Messages == null) return;
            if (this.InvokeRequired)
            {
                this.BeginInvoke(new Action(() => OnMessagesLoaded(sender, e)));
                return;
            }

            listBox.Items.Clear();
            foreach (var m in e.Messages) listBox.Items.Add(m);
            ScrollToBottom();
        }

        public void AddMessage(string sender, string text)
        {
            if (string.IsNullOrEmpty(text)) return;
            if (this.InvokeRequired)
            {
                this.Invoke(new Action(() => AddMessage(sender, text)));
                return;
            }

            var msg = new ChatMessage { Sender = sender, Text = text };
            // Add to manager; UI will be updated via MessageAdded event
            ChatHistory.AddMessage(msg);
        }

        public IReadOnlyList<ChatMessage> GetMessages() => ChatHistory.GetMessages();

        public void ClearMessages()
        {
            listBox.Items.Clear();
            ChatHistory.DeleteAll();
        }

        // Save messages to file. If sessionId is provided, save wrapper { sessionId, messages }.
        public void SaveToFile(string path, string? sessionId = null)
        {
            try
            {
                ChatHistory.Save(path, sessionId);
            }
            catch { }
        }

        // Load messages from file. If file contains wrapper with sessionId, return it; otherwise return null.
        public string? LoadFromFile(string path)
        {
            try
            {
                // Clear current UI first; ChatHistory.Load will raise MessagesLoaded for bulk replacement
                listBox.Items.Clear();

                var (loaded, sid) = ChatHistory.Load(path);
                // If no messages loaded, nothing to add (Load already updated in-memory store)
                ScrollToBottom();
                return sid;
            }
            catch { }

            return null;
        }

        public void CopySelectionToClipboard()
        {
            if (listBox.SelectedIndices.Count == 0) return;
            var sb = new System.Text.StringBuilder();
            foreach (int idx in listBox.SelectedIndices)
            {
                if (idx >= 0 && idx < listBox.Items.Count)
                {
                    if (sb.Length > 0) sb.AppendLine();
                    var m = listBox.Items[idx] as ChatMessage;
                    if (m != null) sb.AppendLine($"{m.Sender}: {m.Text}");
                }
            }
            try { Clipboard.SetText(sb.ToString()); } catch { }
        }

        // ?_?u???N???b?N??N???b?v?{?[?h????e??t
        private void ListBox_MouseDoubleClick(object? sender, MouseEventArgs e)
        {
            int idx = listBox.IndexFromPoint(e.Location);
            if (idx >= 0 && idx < listBox.Items.Count)
            {
                var m = listBox.Items[idx] as ChatMessage;
                if (m != null)
                {
                    try { Clipboard.SetText(m.Text); } catch { }
                }
            }
        }

        private void ListBox_MeasureItem(object? sender, MeasureItemEventArgs e)
        {
            if (e.Index < 0 || e.Index >= listBox.Items.Count)
            {
                e.ItemHeight = (int)(this.Font.Height + contentPadding.Vertical);
                return;
            }

            var msg = listBox.Items[e.Index] as ChatMessage;
            if (msg == null)
            {
                e.ItemHeight = (int)(this.Font.Height + contentPadding.Vertical);
                return;
            }

            // Determine max width for bubble inside the listbox client area
            int maxWidth = Math.Max(20, listBox.ClientSize.Width - contentPadding.Horizontal - 20);
            // Use the Measure helper on ChatMessage
            using (var g = listBox.CreateGraphics())
            {
                var size = msg.Measure(g, this.Font, maxWidth);
                e.ItemHeight = size.Height + 8; // include spacing between items
            }
        }

        private void ListBox_DrawItem(object? sender, DrawItemEventArgs e)
        {
            e.DrawBackground();
            if (e.Index < 0 || e.Index >= listBox.Items.Count) return;

            var msg = listBox.Items[e.Index] as ChatMessage;
            if (msg == null) return;

            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;

            // compute bubble rectangle inside the item's bounds
            Rectangle bounds = e.Bounds;
            int maxWidth = Math.Max(20, listBox.ClientSize.Width - contentPadding.Horizontal - 20);

            var size = msg.Measure(g, this.Font, maxWidth);
            int bw = size.Width;
            int bh = size.Height;

            bool isUser = msg.isUserMessage();
            Rectangle bubbleRect;
            if (isUser)
            {
                bubbleRect = new Rectangle(bounds.Right - bw - 4 - contentPadding.Right, bounds.Top + 4, bw, bh);
            }
            else
            {
                bubbleRect = new Rectangle(bounds.Left + contentPadding.Left + 4, bounds.Top + 4, bw, bh);
            }

            bool selected = (e.State & DrawItemState.Selected) == DrawItemState.Selected;
            msg.Draw(g, bubbleRect, this.Font, isUser, selected);

            // アシスタントメッセージの場合、常に再生ボタンを描画
            if (!isUser)
            {
                Rectangle playButtonRect = GetPlayButtonRect(bounds, bubbleRect, isUser);
                DrawPlayButton(g, playButtonRect, selected);
            }

            // Draw focus rectangle if needed
            if ((e.State & DrawItemState.Focus) == DrawItemState.Focus)
            {
                e.DrawFocusRectangle();
            }
        }

        private Rectangle GetPlayButtonRect(Rectangle bounds, Rectangle bubbleRect, bool isUser)
        {
            int buttonX, buttonY;
            buttonY = bounds.Top + (bounds.Height - PLAY_BUTTON_SIZE) / 2;

            if (isUser)
            {
                // ユーザーメッセージの場合、バブルの左側に配置
                buttonX = bubbleRect.Left - PLAY_BUTTON_SIZE - PLAY_BUTTON_MARGIN;
            }
            else
            {
                // アシスタントメッセージの場合、バブルの右側に配置
                buttonX = bubbleRect.Right + PLAY_BUTTON_MARGIN;
            }

            return new Rectangle(buttonX, buttonY, PLAY_BUTTON_SIZE, PLAY_BUTTON_SIZE);
        }

        private void DrawPlayButton(Graphics g, Rectangle rect, bool selected)
        {
            // ボタンの背景を描画
            using (var brush = new SolidBrush(selected ? Color.FromArgb(200, 100, 150, 255) : Color.FromArgb(200, 100, 150, 255)))
            {
                using (var path = CreateRoundedRectanglePath(rect, 4))
                {
                    g.FillPath(brush, path);
                }
            }

            // 再生アイコン（三角形）を描画
            Point[] playTriangle = new Point[]
            {
                new Point(rect.Left + 6, rect.Top + 5),
                new Point(rect.Left + 6, rect.Bottom - 5),
                new Point(rect.Right - 6, rect.Top + rect.Height / 2)
            };

            using (var brush = new SolidBrush(Color.White))
            {
                g.FillPolygon(brush, playTriangle);
            }
        }

        private static GraphicsPath CreateRoundedRectanglePath(Rectangle rect, int radius)
        {
            var path = new GraphicsPath();
            int diameter = radius * 2;
            var arc = new Rectangle(rect.Location, new Size(diameter, diameter));

            // top-left arc
            path.AddArc(arc, 180, 90);
            // top-right arc
            arc.X = rect.Right - diameter;
            path.AddArc(arc, 270, 90);
            // bottom-right arc
            arc.Y = rect.Bottom - diameter;
            path.AddArc(arc, 0, 90);
            // bottom-left arc
            arc.X = rect.Left;
            path.AddArc(arc, 90, 90);
            path.CloseFigure();
            return path;
        }

        private void ListBox_MouseClick(object? sender, MouseEventArgs e)
        {
            int idx = listBox.IndexFromPoint(e.Location);
            if (idx >= 0 && idx < listBox.Items.Count)
            {
                var msg = listBox.Items[idx] as ChatMessage;
                if (msg != null && !msg.isUserMessage())
                {
                    // メッセージのバブル矩形を計算
                    Rectangle bounds = listBox.GetItemRectangle(idx);
                    int maxWidth = Math.Max(20, listBox.ClientSize.Width - contentPadding.Horizontal - 20);
                    using (var g = listBox.CreateGraphics())
                    {
                        var size = msg.Measure(g, this.Font, maxWidth);
                        int bw = size.Width;
                        int bh = size.Height;
                        Rectangle bubbleRect = new Rectangle(bounds.Left + contentPadding.Left + 4, bounds.Top + 4, bw, bh);
                        Rectangle playButtonRect = GetPlayButtonRect(bounds, bubbleRect, false);

                        // 再生ボタンがクリックされたかチェック
                        if (playButtonRect.Contains(e.Location))
                        {
                            // 音声ファイルが存在する場合は再生、存在しない場合はTTSを生成してから再生
                            if (!string.IsNullOrEmpty(msg.VoiceFilePath) && File.Exists(msg.VoiceFilePath))
                            {
                                PlayVoiceFileInternal(msg.VoiceFilePath);
                            }
                            else
                            {
                                // 音声ファイルが存在しない場合、TTSを生成してから再生
                                _ = GenerateTTSAndPlayAsync(msg);
                            }
                        }
                    }
                }
            }
        }

        /// <summary>
        /// 音声ファイルを再生します。外部から呼び出し可能です。
        /// </summary>
        /// <param name="filePath">再生する音声ファイルのパス</param>
        public void PlayVoiceFile(string filePath)
        {
            try
            {
                if (File.Exists(filePath))
                {
                    if (this.InvokeRequired)
                    {
                        this.Invoke(new Action(() => PlayVoiceFileInternal(filePath)));
                    }
                    else
                    {
                        PlayVoiceFileInternal(filePath);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"音声再生エラー: {ex.Message}");
            }
        }

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
                    // Play()は非同期で再生され、UIをブロックしません
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
                if (this.InvokeRequired)
                {
                    this.Invoke(new Action(() => this.Invalidate()));
                }
                else
                {
                    this.Invalidate();
                }

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

        private void ScrollToBottom()
        {
            if (listBox.Items.Count == 0) return;
            try
            {
                listBox.TopIndex = Math.Max(0, listBox.Items.Count - 1);
            }
            catch { }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                ChatHistory.MessageAdded -= OnMessageAdded;
                ChatHistory.MessagesLoaded -= OnMessagesLoaded;
                if (listBox != null)
                {
                    listBox.MeasureItem -= ListBox_MeasureItem;
                    listBox.DrawItem -= ListBox_DrawItem;
                    listBox.MouseDoubleClick -= ListBox_MouseDoubleClick;
                    listBox.MouseClick -= ListBox_MouseClick;
                }

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

                if (components != null)
                {
                    components.Dispose();
                }
            }
            base.Dispose(disposing);
        }
    }
}
