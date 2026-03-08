using Godot;
using System;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice.chat;
using DesktopAiMascot.aiservice;
using Button = Godot.Button;
using Control = Godot.Control;
using Color = Godot.Color;
using Panel = Godot.Panel;

namespace DesktopAiMascot.ui.chat
{
    public partial class InteractionPanel : Control
    {
        private MessageListPanel? _messageList;
        private TextEdit? _inputBox;
        private Button? _sendButton;
        
        public ChatAiService? ChatService { get; set; }

        public override void _Ready()
        {
            // Panel背景
            var bgPanel = new Panel();
            bgPanel.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
            var styleBox = new StyleBoxFlat();
            styleBox.BgColor = new Color(0.95f, 0.95f, 0.95f, 1.0f);
            bgPanel.AddThemeStyleboxOverride("panel", styleBox);
            AddChild(bgPanel);

            var vbox = new VBoxContainer();
            vbox.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
            AddChild(vbox);

            // ツールバー
            var toolbar = new HBoxContainer();
            toolbar.CustomMinimumSize = new Vector2(0, 30);
            vbox.AddChild(toolbar);

            var settingsBtn = new Button { Text = "⚙" };
            settingsBtn.Pressed += OnSettingsPressed;
            toolbar.AddChild(settingsBtn);

            var spacer = new Control { SizeFlagsHorizontal = SizeFlags.ExpandFill };
            toolbar.AddChild(spacer);

            var clearBtn = new Button { Text = "✖" };
            clearBtn.Pressed += OnClearPressed;
            toolbar.AddChild(clearBtn);

            // メッセージリスト
            _messageList = new MessageListPanel();
            _messageList.SizeFlagsVertical = SizeFlags.ExpandFill;
            _messageList.TtsRequested += OnTtsRequested;
            vbox.AddChild(_messageList);

            // 入力エリア
            var inputArea = new HBoxContainer();
            inputArea.CustomMinimumSize = new Vector2(0, 60);
            vbox.AddChild(inputArea);

            _inputBox = new TextEdit();
            _inputBox.SizeFlagsHorizontal = SizeFlags.ExpandFill;
            _inputBox.WrapMode = TextEdit.LineWrappingMode.Boundary;
            inputArea.AddChild(_inputBox);

            _sendButton = new Button { Text = "送信" };
            _sendButton.CustomMinimumSize = new Vector2(60, 0);
            _sendButton.Pressed += OnSendPressed;
            inputArea.AddChild(_sendButton);

            UpdateChatService(SystemConfig.Instance.LlmService);
        }

        private void OnSettingsPressed()
        {
            GD.Print("設定ボタンが押されました (Settingダイアログは未実装)");
        }

        private void OnClearPressed()
        {
            _messageList?.ClearMessages();
            ChatService?.ClearConversation();
        }

        private void OnSendPressed()
        {
            var text = _inputBox?.Text.Trim() ?? "";
            if (!string.IsNullOrEmpty(text))
            {
                _ = HandleSendAsync(text);
                if (_inputBox != null) _inputBox.Text = "";
            }
        }

        private async Task HandleSendAsync(string text)
        {
            if (_messageList == null) return;

            _messageList.AddMessage(new ChatMessage { Sender = "User", Text = text });

            if (ChatService == null)
            {
                _messageList.AddMessage(new ChatMessage { Sender = "System", Text = "ChatServiceが設定されていません。" });
                return;
            }

            try
            {
                var reply = await ChatService.SendMessageAsync(text);
                if (string.IsNullOrWhiteSpace(reply)) reply = "(no response)";
                
                CallDeferred(MethodName.AddAssistanceMessage, reply);
            }
            catch (Exception ex)
            {
                CallDeferred(MethodName.AddAssistanceMessage, $"Error: {ex.Message}");
            }
        }

        private void AddAssistanceMessage(string text)
        {
            _messageList?.AddMessage(new ChatMessage { Sender = "Assistant", Text = text });
        }

        private void OnTtsRequested(MessageBubble bubble)
        {
            GD.Print($"TTS生成リクエスト: {bubble.Message?.Text} (未実装)");
            // TODO: TTS生成処理
        }

        public void UpdateChatService(string serviceName)
        {
            if (serviceName == "Foundry Local")
            {
                ChatService = new FoundryLocalChatService(SystemConfig.Instance.ModelName);
            }
            else if (serviceName == "Gemini (AI Studio)" || serviceName == "Google AI Studio")
            {
                ChatService = new GoogleAiStudioChatService();
            }
            else if (serviceName == "Gemini (Google Cloud)")
            {
                ChatService = new GoogleCloudChatService();
            }
            else
            {
                ChatService = new LmStudioChatService();
            }
        }
    }
}
