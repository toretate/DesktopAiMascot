using Godot;
using System;
using Button = Godot.Button;
using Label = Godot.Label;
using Control = Godot.Control;

namespace DesktopAiMascot.ui.mascot_edit
{
    /// <summary>
    /// 角度画像表示・編集コントロール
    /// </summary>
    public partial class AngleViewControl : Control
    {
        [Signal]
        public delegate void LeftImageClickEventHandler();
        
        [Signal]
        public delegate void RightImageClickEventHandler();
        
        [Signal]
        public delegate void AboveImageClickEventHandler();
        
        [Signal]
        public delegate void BelowImageClickEventHandler();
        
        [Signal]
        public delegate void BehindImageClickEventHandler();

        private TextureRect _frontImage = null!;
        private TextureRect _leftImage = null!;
        private TextureRect _rightImage = null!;
        private TextureRect _aboveImage = null!;
        private TextureRect _belowImage = null!;
        private TextureRect _behindImage = null!;
        
        private Button _leftButton = null!;
        private Button _rightButton = null!;
        private Button _aboveButton = null!;
        private Button _belowButton = null!;
        private Button _behindButton = null!;
        
        private Label _leftStatusLabel = null!;
        private Label _rightStatusLabel = null!;
        private Label _aboveStatusLabel = null!;
        private Label _belowStatusLabel = null!;
        private Label _behindStatusLabel = null!;
        
        private OptionButton _imageModelComboBox = null!;

        public override void _Ready()
        {
            _frontImage = GetNode<TextureRect>("%FrontImage");
            _leftImage = GetNode<TextureRect>("%LeftImage");
            _rightImage = GetNode<TextureRect>("%RightImage");
            _aboveImage = GetNode<TextureRect>("%AboveImage");
            _belowImage = GetNode<TextureRect>("%BelowImage");
            _behindImage = GetNode<TextureRect>("%BehindImage");
            
            _leftButton = GetNode<Button>("%LeftButton");
            _rightButton = GetNode<Button>("%RightButton");
            _aboveButton = GetNode<Button>("%AboveButton");
            _belowButton = GetNode<Button>("%BelowButton");
            _behindButton = GetNode<Button>("%BehindButton");
            
            _leftStatusLabel = GetNode<Label>("%LeftStatusLabel");
            _rightStatusLabel = GetNode<Label>("%RightStatusLabel");
            _aboveStatusLabel = GetNode<Label>("%AboveStatusLabel");
            _belowStatusLabel = GetNode<Label>("%BelowStatusLabel");
            _behindStatusLabel = GetNode<Label>("%BehindStatusLabel");
            
            _imageModelComboBox = GetNode<OptionButton>("%ImageModelComboBox");
            
            _leftButton.Pressed += () => EmitSignal(SignalName.LeftImageClick);
            _rightButton.Pressed += () => EmitSignal(SignalName.RightImageClick);
            _aboveButton.Pressed += () => EmitSignal(SignalName.AboveImageClick);
            _belowButton.Pressed += () => EmitSignal(SignalName.BelowImageClick);
            _behindButton.Pressed += () => EmitSignal(SignalName.BehindImageClick);
        }

        public TextureRect FrontImage => _frontImage;
        public TextureRect LeftImage => _leftImage;
        public TextureRect RightImage => _rightImage;
        public TextureRect AboveImage => _aboveImage;
        public TextureRect BelowImage => _belowImage;
        public TextureRect BehindImage => _behindImage;
        public OptionButton ImageModelComboBox => _imageModelComboBox;

        /// <summary>
        /// 角度画像のステータステキストを設定
        /// </summary>
        public void SetAngleStatus(string angle, string? status)
        {
            Label? targetLabel = angle switch
            {
                "left" => _leftStatusLabel,
                "right" => _rightStatusLabel,
                "above" => _aboveStatusLabel,
                "below" => _belowStatusLabel,
                "behind" => _behindStatusLabel,
                _ => null
            };

            if (targetLabel == null)
            {
                return;
            }

            if (string.IsNullOrWhiteSpace(status))
            {
                targetLabel.Text = string.Empty;
                targetLabel.Visible = false;
                return;
            }

            targetLabel.Text = status;
            targetLabel.Visible = true;
        }
    }
}
