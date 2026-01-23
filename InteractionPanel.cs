using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;

using DesktopAiMascot.aiservice;
using DesktopAiMascot.aiservice.voice;
using DesktopAiMascot.Controls;
using DesktopAiMascot.mascots;

namespace DesktopAiMascot
{
    public partial class InteractionPanel : UserControl
    {
        public event EventHandler<MascotModel>? MascotChanged;

        // Expose controls so the WinForms designer can edit them

        public ChatAiService ChatService { get; set; }

        private readonly string messagesFilePath;

        // Settings dialog helper
        private Func<Image?>? _settingsImageProvider;

        public InteractionPanel()
        {
            // Initialize designer-created controls
            InitializeComponent();

            // Enable transparent painting
            this.SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.SupportsTransparentBackColor, true);
            this.BackColor = Color.FromArgb(128, Color.White); // 半透明の背景

            // Use an emoji-capable font so emoji render correctly (Segoe UI Emoji on Windows)
            // messageFont is kept private as it's not intended to be modified by the designer
            messageFont = new Font("Segoe UI Emoji", this.Font.Size);

            // Apply font to existing controls created in InitializeComponent
            // Note: WPF MessageListPanel doesn't have Font property, font is set in XAML
            if (inputBox != null) inputBox.Font = messageFont;

            // Default chat service
            UpdateChatService(SystemConfig.Instance.LlmService);

            // messages file under AppData
            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            string appDir = Path.Combine(appData, "DesktopAiMascot");
            messagesFilePath = Path.Combine(appDir, "messages.json");

            // Try to load saved messages and session id
            try
            {
                messagesPanel.LoadFromFile(messagesFilePath);
            }
            catch { }

            // Settings overlay removed; use modal dialog when needed

            // Enable window drag from the panel and message area
            this.MouseDown += DragMove_MouseDown;
            // Note: WPF MessageListPanel handles its own drag move
            if (topToolStrip != null) topToolStrip.MouseDown += TopToolStrip_MouseDown;
        }

        private void DragMove_MouseDown(object? sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                DragMoveHelper.BeginDragFrom(this);
            }
        }

        private void TopToolStrip_MouseDown(object? sender, MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left) return;
            try
            {
                // Avoid interfering with toolbar button clicks: only drag when clicking empty area
                var item = topToolStrip.GetItemAt(e.Location);
                if (item == null)
                {
                    DragMoveHelper.BeginDragFrom(this);
                }
            }
            catch
            {
                // Fallback: still attempt drag
                DragMoveHelper.BeginDragFrom(this);
            }
        }

        private void UpdateChatService(string serviceName)
        {
            if (serviceName == "Foundry Local")
            {
                ChatService = new FoundryLocalChatService(SystemConfig.Instance.ModelName);
            }
            else
            {
                // Default to LM Studio
                ChatService = new LmStudioChatService();
            }
        }

        private void ShowSettingsDialog()
        {
            // Show settings as a modal dialog instead of overlay
            try
            {
                using (var dialogContent = new DesktopAiMascot.Views.SettingsForm())
                {
                    // propagate important event handlers and providers
                    dialogContent.MascotChanged += (s, m) => MascotChanged?.Invoke(this, m);
                    dialogContent.LlmServiceChanged += (s, name) => UpdateChatService(name);
                    if (_settingsImageProvider != null)
                    {
                        dialogContent.GetMascotImage = _settingsImageProvider;
                    }

                    using (var dlg = new DesktopAiMascot.Views.SettingsDialog(dialogContent))
                    {
                        var owner = this.FindForm();
                        if (owner != null)
                        {
                            dlg.StartPosition = FormStartPosition.CenterParent;
                            dlg.ShowDialog(owner);
                        }
                        else
                        {
                            dlg.StartPosition = FormStartPosition.CenterScreen;
                            dlg.ShowDialog();
                        }
                    }
                }
            }
            catch { }
        }

        // (Removed: HideSettingsOverlay) Modal dialog flow does not need it.

        public void AddMessage(string sender, string text)
        {
            messagesPanel.AddMessage(sender, text);
        }

        public IReadOnlyList<ChatMessage> GetMessages() => messagesPanel.GetMessages();

        // Make ClearMessages compatible with EventHandler so the WinForms designer can wire it up directly.
        private void ClearMessages(object? sender = null, EventArgs? e = null)
        {
            messagesPanel.ClearMessages();
            if (ChatService != null)
            {
                ChatService.ClearConversation();
            }
        }

        private void OnSettingsButtonCliecked(object? sender, EventArgs e)
        {
            ShowSettingsDialog();
        }

        // Allow external callers (e.g., MascotForm) to register a provider for the mascot image
        public void SetSettingsMascotImageProvider(Func<Image?> provider)
        {
            _settingsImageProvider = provider;
        }

        public void SaveToFile(string path)
        {
            try
            {
                var dir = Path.GetDirectoryName(path);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) Directory.CreateDirectory(dir);
                messagesPanel.SaveToFile(path);
            }
            catch { }
        }

        public void LoadFromFile(string path)
        {
            try
            {
                // Load into messages panel (which will raise events to update UI)
                var sid = messagesPanel.LoadFromFile(path);
            }
            catch { }
        }

        // Show the input box and focus it. Call this when mascot is clicked.
        public void ShowInput()
        {
            inputBox.ShowInput();
        }

        private void InputBox_SendRequested(string text)
        {
            // handle send from input control (user pressed Enter or lost focus)
            _ = HandleSendFromInputAsync(text);
        }


        private async Task HandleSendFromInputAsync(string text)
        {
            AddMessage("User", text);


            try
            {
                var reply = await ChatService.SendMessageAsync(text);
                if (string.IsNullOrWhiteSpace(reply)) reply = "(no response)";
                if (this.IsHandleCreated)
                {
                    // Use Invoke so the assistant message is added to the in-memory history before we save to disk
                    this.Invoke(new Action(() => AddMessage("Assistant", reply)));
                }
                else
                {
                    AddMessage("Assistant", reply);
                }

                // アシスタントからのメッセージに対して自動的にTTSを実行
                _ = GenerateTTSForAssistantMessageAsync(reply);
            }
            catch (Exception ex)
            {
                if (this.IsHandleCreated)
                {
                    // Use Invoke for consistency when reporting errors as messages
                    this.Invoke(new Action(() => AddMessage("Assistant", $"Error: {ex.Message}")));
                }
                else
                {
                    AddMessage("Assistant", $"Error: {ex.Message}");
                }
            }

            // after each send, persist messages and session id
            try
            {
                SaveToFile(messagesFilePath);
            }
            catch { }

            // clear input
            inputBox.Clear();
            // Note: WPF control doesn't need explicit Focus() and Invalidate() calls
        }

        private async Task GenerateTTSForAssistantMessageAsync(string text)
        {
            try
            {
                Console.WriteLine($"[TTS] TTS生成を開始します。テキスト長: {text.Length}文字");

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
                byte[] audioData = await ttsService.SynthesizeAsync(text);
                Console.WriteLine($"[TTS] 音声データを受信しました。サイズ: {audioData.Length} bytes ({audioData.Length / 1024.0:F2} KB)");

                // 音声ファイルを保存
                await File.WriteAllBytesAsync(voiceFilePath, audioData);
                Console.WriteLine($"[TTS] 音声ファイルを保存しました: {voiceFilePath}");

                // 最新のアシスタントメッセージに音声ファイルパスを設定
                if (this.IsHandleCreated)
                {
                    this.Invoke(new Action(() =>
                    {
                        var messages = messagesPanel.GetMessages();
                        for (int i = messages.Count - 1; i >= 0; i--)
                        {
                            var msg = messages[i];
                            if (!msg.isUserMessage() && string.IsNullOrEmpty(msg.VoiceFilePath))
                            {
                                msg.VoiceFilePath = voiceFilePath;
                                // Note: WPF control doesn't need explicit Invalidate() call
                                Console.WriteLine($"[TTS] メッセージに音声ファイルパスを設定しました");
                                break;
                            }
                        }

                        // TTS生成完了時に音声を自動再生
                        messagesPanel.PlayVoiceFile(voiceFilePath);
                        Console.WriteLine($"[TTS] 音声を自動再生しました");
                    }));
                }

                Console.WriteLine($"[TTS] TTS生成が正常に完了しました");
            }
            catch (Exception ex)
            {
                // TTSエラーは静かに処理（ログ出力のみ）
                Console.WriteLine($"[TTS] TTS生成エラー: {ex.Message}");
                Console.WriteLine($"[TTS] スタックトレース: {ex.StackTrace}");
            }
        }

        private void messagesPanelHost_ChildChanged(object sender, System.Windows.Forms.Integration.ChildChangedEventArgs e)
        {

        }
    }
}
