using Godot;
using System;
using Label = Godot.Label;
using Button = Godot.Button;
using Color = Godot.Color;
using Control = Godot.Control;
using HorizontalAlignment = Godot.HorizontalAlignment;

namespace DesktopAiMascot.ui.chat
{
    public partial class MessageBubble : MarginContainer
    {
        private Label? _senderLabel;
        private Label? _messageLabel;
        private Button? _playButton;
        private PanelContainer? _bubblePanel;

        public ChatMessage? Message { get; private set; }

        [Signal]
        public delegate void PlayRequestedEventHandler(MessageBubble bubble);

        public override void _Ready()
        {
            AddThemeConstantOverride("margin_left", 10);
            AddThemeConstantOverride("margin_top", 5);
            AddThemeConstantOverride("margin_right", 10);
            AddThemeConstantOverride("margin_bottom", 5);

            var vbox = new VBoxContainer();
            AddChild(vbox);

            _senderLabel = new Label();
            _senderLabel.AddThemeColorOverride("font_color", new Color(0.4f, 0.4f, 0.4f));
            _senderLabel.AddThemeFontSizeOverride("font_size", 12);
            vbox.AddChild(_senderLabel);

            _bubblePanel = new PanelContainer();
            _bubblePanel.SizeFlagsHorizontal = SizeFlags.ShrinkBegin;
            
            var styleBox = new StyleBoxFlat();
            styleBox.BgColor = new Color(0.9f, 0.9f, 0.9f);
            styleBox.SetCornerRadiusAll(8);
            styleBox.ContentMarginLeft = 10;
            styleBox.ContentMarginTop = 8;
            styleBox.ContentMarginRight = 10;
            styleBox.ContentMarginBottom = 8;
            _bubblePanel.AddThemeStyleboxOverride("panel", styleBox);
            vbox.AddChild(_bubblePanel);

            var hbox = new HBoxContainer();
            _bubblePanel.AddChild(hbox);

            _messageLabel = new Label();
            _messageLabel.AddThemeColorOverride("font_color", new Color(0, 0, 0));
            _messageLabel.AutowrapMode = TextServer.AutowrapMode.Word;
            // 吹き出しの最大幅を設定
            _messageLabel.CustomMinimumSize = new Vector2(250, 0); 
            hbox.AddChild(_messageLabel);

            _playButton = new Button();
            _playButton.Text = "▶";
            _playButton.Visible = false;
            _playButton.Pressed += OnPlayButtonPressed;
            hbox.AddChild(_playButton);
        }

        public void SetMessage(ChatMessage msg)
        {
            Message = msg;
            if (_senderLabel != null && _messageLabel != null && _bubblePanel != null)
            {
                _senderLabel.Text = msg.Sender;
                _messageLabel.Text = msg.Text;

                if (msg.isUserMessage())
                {
                    _bubblePanel.SizeFlagsHorizontal = SizeFlags.ShrinkEnd;
                    _senderLabel.HorizontalAlignment = HorizontalAlignment.Right;
                    var styleBox = (StyleBoxFlat)_bubblePanel.GetThemeStylebox("panel");
                    styleBox.BgColor = new Color(0.85f, 0.95f, 0.85f); // ユーザー：淡い緑色
                }
                else
                {
                    _bubblePanel.SizeFlagsHorizontal = SizeFlags.ShrinkBegin;
                    _senderLabel.HorizontalAlignment = HorizontalAlignment.Left;
                    var styleBox = (StyleBoxFlat)_bubblePanel.GetThemeStylebox("panel");
                    styleBox.BgColor = new Color(1.0f, 1.0f, 1.0f); // AI：白
                }

                UpdatePlayButtonState(false);
            }
        }

        public void UpdatePlayButtonState(bool isPlaying)
        {
            if (_playButton == null || Message == null) return;
            
            if (!Message.isUserMessage() || !string.IsNullOrEmpty(Message.VoiceFilePath))
            {
                _playButton.Visible = true;
                _playButton.Text = isPlaying ? "■" : "▶";
            }
            else
            {
                _playButton.Visible = false;
            }
        }

        private void OnPlayButtonPressed()
        {
            EmitSignal(SignalName.PlayRequested, this);
        }
    }
}
