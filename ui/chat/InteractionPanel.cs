using Godot;
using System;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice.chat;
using DesktopAiMascot.aiservice;
using Button = Godot.Button;
using Control = Godot.Control;
using Color = Godot.Color;
using Panel = Godot.Panel;
using LayoutPreset = Godot.Control.LayoutPreset;
using SizeFlags = Godot.Control.SizeFlags;

namespace DesktopAiMascot.ui.chat
{
	public partial class InteractionPanel : Window
	{
		private MessageListPanel _messageList = null!;
		private TextEdit _inputBox = null!;
		private Button _sendButton = null!;
		
		public ChatAiService? ChatService { get; set; }

		public override void _Ready()
		{
			CloseRequested += () => Hide();

			_messageList = GetNode<MessageListPanel>("%MessageListPanel");
			_inputBox = GetNode<TextEdit>("%InputBox");
			_sendButton = GetNode<Button>("%SendButton");

			var settingsBtn = GetNode<Button>("%SettingsButton");
			settingsBtn.Pressed += OnSettingsPressed;

			var clearBtn = GetNode<Button>("%ClearButton");
			clearBtn.Pressed += OnClearPressed;

			_messageList.TtsRequested += OnTtsRequested;
			_sendButton.Pressed += OnSendPressed;

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
