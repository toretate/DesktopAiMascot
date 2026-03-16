using Godot;
using System;
using System.Diagnostics;
using System.IO;
using Button = Godot.Button;
using Label = Godot.Label;

namespace DesktopAiMascot.ui.mascot_edit
{
    /// <summary>
    /// 表情差分生成タブページ
    /// </summary>
    public partial class EmoteGenerationTabPage : ScrollContainer
    {
        private string _sourceImagePath = string.Empty;

        private TextureRect _sourceImage = null!;
        private OptionButton _aiServiceComboBox = null!;
        private TextEdit _promptTextEdit = null!;
        private Button _generateAllButton = null!;
        private VBoxContainer _emoteItemsContainer = null!;

        public override void _Ready()
        {
            _sourceImage = GetNode<TextureRect>("%SourceImage");
            _aiServiceComboBox = GetNode<OptionButton>("%AiServiceComboBox");
            _promptTextEdit = GetNode<TextEdit>("%PromptTextEdit");
            _generateAllButton = GetNode<Button>("%GenerateAllButton");
            _emoteItemsContainer = GetNode<VBoxContainer>("%EmoteItemsContainer");

            _generateAllButton.Pressed += OnGenerateAllButtonPressed;
        }

        /// <summary>
        /// タブページを初期化
        /// </summary>
        public void Initialize(string sourceImagePath)
        {
            Debug.WriteLine($"[EmoteGenerationTabPage] Initialize called with: {sourceImagePath}");
            _sourceImagePath = sourceImagePath;

            LoadSourceImage();
            // TODO: InitializeEmoteList();
        }

        /// <summary>
        /// 元画像を読み込む
        /// </summary>
        private void LoadSourceImage()
        {
            try
            {
                if (File.Exists(_sourceImagePath))
                {
                    var texture = utils.ImageLoadHelper.LoadGodotTexture(_sourceImagePath);
                    if (texture != null)
                    {
                        _sourceImage.Texture = texture;
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[EmoteGenerationTabPage] 元画像読み込みエラー: {ex.Message}");
            }
        }

        /// <summary>
        /// 全ての表情を生成
        /// </summary>
        private void OnGenerateAllButtonPressed()
        {
            GD.Print("Generate all emotions - not yet implemented");
            // TODO: Implement emotion generation
            GD.PrintErr("表情差分生成機能は未実装です。");
        }
    }
}
