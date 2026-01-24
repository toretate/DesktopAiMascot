using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

using DesktopAiMascot.aiservice;
using DesktopAiMascot.aiservice.voice;
using DesktopAiMascot.Controls;
using DesktopAiMascot.mascots;

namespace DesktopAiMascot.Wpf
{
    /// <summary>
    /// InteractionPanel.xaml の相互作用ロジック
    /// WPF版のインタラクションパネル
    /// </summary>
    public partial class InteractionPanel : System.Windows.Controls.UserControl
    {
        public event EventHandler<MascotModel>? MascotChanged;
        public event EventHandler? RequestDragMove;

        public ChatAiService ChatService { get; set; }

        private readonly string messagesFilePath;

        private Func<System.Drawing.Image?>? _settingsImageProvider;

        public InteractionPanel()
        {
            InitializeComponent();

            UpdateChatService(SystemConfig.Instance.LlmService);

            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            string appDir = Path.Combine(appData, "DesktopAiMascot");
            messagesFilePath = Path.Combine(appDir, "messages.json");

            try
            {
                messagesPanel.LoadFromFile(messagesFilePath);
            }
            catch { }

            clearBtn.Click += ClearMessages;
            settingsButton.Click += OnSettingsButtonClicked;
        }

        private void SendButton_Click(object sender, RoutedEventArgs e)
        {
            SendMessage();
        }

        private void InputTextBox_KeyDown(object sender, System.Windows.Input.KeyEventArgs e)
        {
            if (e.Key == Key.Enter && Keyboard.Modifiers != ModifierKeys.Shift)
            {
                e.Handled = true;
                SendMessage();
            }
        }

        private void SendMessage()
        {
            var text = inputTextBox.Text?.Trim();
            if (!string.IsNullOrEmpty(text))
            {
                _ = HandleSendFromInputAsync(text);
            }
        }

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
                    // ElementHost内でホストされている場合、親Formに通知
                    RequestDragMove?.Invoke(this, EventArgs.Empty);
                }
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
                ChatService = new LmStudioChatService();
            }
        }

        private void ShowSettingsDialog()
        {
            try
            {
                var dialogContent = new DesktopAiMascot.Views.SettingsForm();
                
                dialogContent.MascotChanged += (s, m) => MascotChanged?.Invoke(this, m);
                dialogContent.LlmServiceChanged += (s, name) => UpdateChatService(name);
                if (_settingsImageProvider != null)
                {
                    dialogContent.GetMascotImage = _settingsImageProvider;
                }

                var dlg = new DesktopAiMascot.Views.SettingsDialog(dialogContent);
                var parentForm = System.Windows.Forms.Application.OpenForms.Count > 0 
                    ? System.Windows.Forms.Application.OpenForms[0] 
                    : null;

                if (parentForm != null)
                {
                    dlg.StartPosition = System.Windows.Forms.FormStartPosition.CenterParent;
                    dlg.ShowDialog(parentForm);
                }
                else
                {
                    dlg.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
                    dlg.ShowDialog();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"設定ダイアログエラー: {ex.Message}");
            }
        }

        public void AddMessage(string sender, string text)
        {
            messagesPanel.AddMessage(sender, text);
        }

        public IReadOnlyList<ChatMessage> GetMessages() => messagesPanel.GetMessages();

        private void ClearMessages(object? sender, RoutedEventArgs e)
        {
            messagesPanel.ClearMessages();
            if (ChatService != null)
            {
                ChatService.ClearConversation();
            }
        }

        private void OnSettingsButtonClicked(object? sender, RoutedEventArgs e)
        {
            ShowSettingsDialog();
        }

        public void SetSettingsMascotImageProvider(Func<System.Drawing.Image?> provider)
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
                var sid = messagesPanel.LoadFromFile(path);
            }
            catch { }
        }

        public void ShowInput()
        {
            inputTextBox.Visibility = Visibility.Visible;
            inputTextBox.Focus();
            inputTextBox.SelectAll();
        }

        public void Clear()
        {
            inputTextBox.Text = string.Empty;
        }

        private async Task HandleSendFromInputAsync(string text)
        {
            AddMessage("User", text);

            try
            {
                var reply = await ChatService.SendMessageAsync(text);
                if (string.IsNullOrWhiteSpace(reply)) reply = "(no response)";
                
                await Dispatcher.InvokeAsync(() => AddMessage("Assistant", reply));

                _ = GenerateTTSForAssistantMessageAsync(reply);
            }
            catch (Exception ex)
            {
                await Dispatcher.InvokeAsync(() => AddMessage("Assistant", $"Error: {ex.Message}"));
            }

            try
            {
                SaveToFile(messagesFilePath);
            }
            catch { }

            Clear();
        }

        private async Task GenerateTTSForAssistantMessageAsync(string text)
        {
            try
            {
                Console.WriteLine($"[TTS] TTS生成を開始します。テキスト長: {text.Length}文字");

                var mascotName = MascotManager.Instance.CurrentModel?.Name ?? "default";
                Console.WriteLine($"[TTS] マスコット名: {mascotName}");

                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string voiceDir = Path.Combine(baseDir, "tmp", "voice", mascotName);
                if (!Directory.Exists(voiceDir))
                {
                    Directory.CreateDirectory(voiceDir);
                    Console.WriteLine($"[TTS] ディレクトリを作成しました: {voiceDir}");
                }

                string fileName = $"voice_{DateTime.Now:yyyyMMddHHmmssfff}.wav";
                string voiceFilePath = Path.Combine(voiceDir, fileName);
                Console.WriteLine($"[TTS] 音声ファイル保存先: {voiceFilePath}");

                Console.WriteLine($"[TTS] StyleBertVits2Serviceにリクエストを送信します...");
                var ttsService = new StyleBertVits2Service();
                byte[] audioData = await ttsService.SynthesizeAsync(text);
                Console.WriteLine($"[TTS] 音声データを受信しました。サイズ: {audioData.Length} bytes ({audioData.Length / 1024.0:F2} KB)");

                await File.WriteAllBytesAsync(voiceFilePath, audioData);
                Console.WriteLine($"[TTS] 音声ファイルを保存しました: {voiceFilePath}");

                await Dispatcher.InvokeAsync(() =>
                {
                    var messages = messagesPanel.GetMessages();
                    for (int i = messages.Count - 1; i >= 0; i--)
                    {
                        var msg = messages[i];
                        if (!msg.isUserMessage() && string.IsNullOrEmpty(msg.VoiceFilePath))
                        {
                            msg.VoiceFilePath = voiceFilePath;
                            Console.WriteLine($"[TTS] メッセージに音声ファイルパスを設定しました");
                            break;
                        }
                    }

                    messagesPanel.PlayVoiceFile(voiceFilePath);
                    Console.WriteLine($"[TTS] 音声を自動再生しました");
                });

                Console.WriteLine($"[TTS] TTS生成が正常に完了しました");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TTS] TTS生成エラー: {ex.Message}");
                Console.WriteLine($"[TTS] スタックトレース: {ex.StackTrace}");
            }
        }

        private void inputTextBox_TextChanged(object sender, TextChangedEventArgs e)
        {

        }
    }
}
