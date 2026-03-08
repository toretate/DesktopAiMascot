using Godot;
using System;
using DesktopAiMascot.ui.settings.pages;

namespace DesktopAiMascot.ui.settings
{
    public partial class SettingsWindow : Window
    {
        private ItemList _categoryList;
        private MarginContainer _pageContainer;
        
        // Property Pages
        private MascotPropertyPage? _mascotPage;
        private ChatAiPropertyPage? _chatAiPage;
        private VoiceAiPropertyPage? _voiceAiPage;
        private ImageAiPropertyPage? _imageAiPage;
        private MovieAiPropertyPage? _movieAiPage;
        private ApiKeyPropertyPage? _apiKeyPage;

        public SettingsWindow()
        {
            Title = "設定 (Settings)";
            MinSize = new Vector2I(600, 500);
            Size = new Vector2I(600, 500);
            Exclusive = false;
            
            // Godot 4: 閉じるボタンが押されたときの処理
            CloseRequested += () => Hide();

            // 背景
            var bg = new ColorRect { Color = new Godot.Color(0.95f, 0.95f, 0.95f) };
            bg.SetAnchorsPreset(Godot.Control.LayoutPreset.FullRect);
            AddChild(bg);

            // マージンコンテナ
            var marginContainer = new MarginContainer();
            marginContainer.SetAnchorsPreset(Godot.Control.LayoutPreset.FullRect);
            marginContainer.AddThemeConstantOverride("margin_top", 10);
            marginContainer.AddThemeConstantOverride("margin_left", 10);
            marginContainer.AddThemeConstantOverride("margin_right", 10);
            marginContainer.AddThemeConstantOverride("margin_bottom", 10);
            AddChild(marginContainer);

            // HBoxレイアウト
            var layout = new HBoxContainer();
            marginContainer.AddChild(layout);

            // 左側のカテゴリリスト
            _categoryList = new ItemList();
            _categoryList.CustomMinimumSize = new Vector2(150, 0);
            _categoryList.AddItem("Mascot");
            _categoryList.AddItem("Chat AI");
            _categoryList.AddItem("Voice AI");
            _categoryList.AddItem("Image AI");
            _categoryList.AddItem("Movie AI");
            _categoryList.AddItem("API Keys");
            _categoryList.ItemSelected += OnCategorySelected;
            layout.AddChild(_categoryList);

            // 右側のページコンテナ
            _pageContainer = new MarginContainer();
            _pageContainer.SizeFlagsHorizontal = Godot.Control.SizeFlags.ExpandFill;
            _pageContainer.SizeFlagsVertical = Godot.Control.SizeFlags.ExpandFill;
            layout.AddChild(_pageContainer);

            // 初期化を遅延実行
            CallDeferred(MethodName.InitPages);
        }

        private void InitPages()
        {
            _mascotPage = new MascotPropertyPage();
            _pageContainer.AddChild(_mascotPage);

            _chatAiPage = new ChatAiPropertyPage();
            _pageContainer.AddChild(_chatAiPage);

            _voiceAiPage = new VoiceAiPropertyPage();
            _pageContainer.AddChild(_voiceAiPage);

            _imageAiPage = new ImageAiPropertyPage();
            _pageContainer.AddChild(_imageAiPage);

            _movieAiPage = new MovieAiPropertyPage();
            _pageContainer.AddChild(_movieAiPage);

            _apiKeyPage = new ApiKeyPropertyPage();
            _pageContainer.AddChild(_apiKeyPage);

            _categoryList.Select(0);
            OnCategorySelected(0);
        }

        private void OnCategorySelected(long index)
        {
            // まず全て非表示にする
            if (_mascotPage != null) _mascotPage.Hide();
            if (_chatAiPage != null) _chatAiPage.Hide();
            if (_voiceAiPage != null) _voiceAiPage.Hide();
            if (_imageAiPage != null) _imageAiPage.Hide();
            if (_movieAiPage != null) _movieAiPage.Hide();
            if (_apiKeyPage != null) _apiKeyPage.Hide();

            // 選択されたページだけ表示
            switch (index)
            {
                case 0:
                    if (_mascotPage != null) _mascotPage.Show();
                    break;
                case 1:
                    if (_chatAiPage != null) _chatAiPage.Show();
                    break;
                case 2:
                    if (_voiceAiPage != null) _voiceAiPage.Show();
                    break;
                case 3:
                    if (_imageAiPage != null) _imageAiPage.Show();
                    break;
                case 4:
                    if (_movieAiPage != null) _movieAiPage.Show();
                    break;
                case 5:
                    if (_apiKeyPage != null) _apiKeyPage.Show();
                    break;
            }
        }
    }
}
