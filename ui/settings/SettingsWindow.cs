using Godot;
using System;
using DesktopAiMascot.ui.settings.pages;
using CheckBox = Godot.CheckBox;
using Button = Godot.Button;

namespace DesktopAiMascot.ui.settings
{
	public partial class SettingsWindow : Window
	{
		private VerticalNavigationList _categoryList = null!;
		private MarginContainer _pageContainer = null!;
		private CheckBox _alwaysOnTopCheck = null!;
		private Button _exitAppButton = null!;
		
		// Property Pages
		private MascotPropertyPage _mascotPage = null!;
		private ChatAiPropertyPage _chatAiPage = null!;
		private VoiceAiPropertyPage _voiceAiPage = null!;
		private ImageAiPropertyPage _imageAiPage = null!;
		private MovieAiPropertyPage _movieAiPage = null!;
		private ApiKeyPropertyPage _apiKeyPage = null!;
		public event Action<DesktopAiMascot.mascots.MascotModel>? MascotChanged;

		public override void _Ready()
		{
			CloseRequested += () => Hide();

			_categoryList = GetNode<VerticalNavigationList>("%CategoryList");
			_pageContainer = GetNode<MarginContainer>("%PageContainer");
			_alwaysOnTopCheck = GetNode<CheckBox>("%AlwaysOnTopCheck");
			_exitAppButton = GetNode<Button>("%ExitAppButton");

			_mascotPage = GetNode<MascotPropertyPage>("%MascotPropertyPage");
			_chatAiPage = GetNode<ChatAiPropertyPage>("%ChatAiPropertyPage");
			_voiceAiPage = GetNode<VoiceAiPropertyPage>("%VoiceAiPropertyPage");
			_imageAiPage = GetNode<ImageAiPropertyPage>("%ImageAiPropertyPage");
			_movieAiPage = GetNode<MovieAiPropertyPage>("%MovieAiPropertyPage");
			_apiKeyPage = GetNode<ApiKeyPropertyPage>("%ApiKeyPropertyPage");

			_mascotPage.MascotChanged += (model) => MascotChanged?.Invoke(model);

			// 左側のカテゴリリスト設定
			_categoryList.AddItem("Mascot");
			_categoryList.AddItem("Chat AI");
			_categoryList.AddItem("Voice AI");
			_categoryList.AddItem("Image AI");
			_categoryList.AddItem("Movie AI");
			_categoryList.AddItem("API Keys");
			_categoryList.ItemSelected += OnCategorySelected;

			// 初期選択状態
			_categoryList.Select(0);
			OnCategorySelected(0);

			// 最前面チェックボックスと終了ボタンの初期化・接続
			_alwaysOnTopCheck.ButtonPressed = SystemConfig.Instance.AlwaysOnTop;
			_alwaysOnTopCheck.Toggled += OnAlwaysOnTopToggled;
			_exitAppButton.Pressed += OnExitAppPressed;
		}

		private void OnCategorySelected(long index)
		{
			// まず全て非表示にする
			_mascotPage.Hide();
			_chatAiPage.Hide();
			_voiceAiPage.Hide();
			_imageAiPage.Hide();
			_movieAiPage.Hide();
			_apiKeyPage.Hide();

			// 選択されたページだけ表示
			switch (index)
			{
				case 0:
					_mascotPage.Show();
					break;
				case 1:
					_chatAiPage.Show();
					break;
				case 2:
					_voiceAiPage.Show();
					break;
				case 3:
					_imageAiPage.Show();
					break;
				case 4:
					_movieAiPage.Show();
					break;
				case 5:
					_apiKeyPage.Show();
					break;
			}
		}

		private void OnAlwaysOnTopToggled(bool buttonPressed)
		{
			SystemConfig.Instance.AlwaysOnTop = buttonPressed;
			SystemConfig.Instance.Save();
			DisplayServer.WindowSetFlag(DisplayServer.WindowFlags.AlwaysOnTop, buttonPressed);
		}

		private void OnExitAppPressed()
		{
			GetTree().Quit();
		}
	}
}
