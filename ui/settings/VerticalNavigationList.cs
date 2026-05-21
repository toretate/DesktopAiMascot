using Godot;
using System;
using System.Collections.Generic;
using Button = Godot.Button;
using Color = Godot.Color;
using HorizontalAlignment = Godot.HorizontalAlignment;

namespace DesktopAiMascot.ui.settings
{
    /// <summary>
    /// デザインガイドラインに準拠した左側バーティカルナビゲーションリストコンポーネント。
    /// </summary>
    public partial class VerticalNavigationList : VBoxContainer
    {
        [Signal]
        public delegate void ItemSelectedEventHandler(long index);

        private readonly List<Button> _items = new();
        private int _selectedIndex = -1;

        // フォント定義
        private SystemFont _fontNormal = null!;
        private SystemFont _fontBold = null!;

        // 状態別スタイルボックス
        private StyleBoxEmpty _styleDefault = null!;
        private StyleBoxFlat _styleHover = null!;
        private StyleBoxFlat _styleSelected = null!;
        private StyleBoxFlat _styleSelectedHover = null!;
        private StyleBoxFlat _stylePressed = null!;
        private StyleBoxFlat _styleFocus = null!;

        public override void _Ready()
        {
            // ノード間の隙間を設定（トークン構成に合わせる）
            AddThemeConstantOverride("separation", 4);

            InitializeResources();
        }

        /// <summary>
        /// ガイドラインで定義されたデザインリソース（カラー、パディング、角丸など）の初期化。
        /// </summary>
        private void InitializeResources()
        {
            // 1. システムフォントの初期化
            _fontNormal = new SystemFont();
            _fontNormal.FontNames = new string[] { "Segoe UI", "Helvetica Neue", "Arial", "Sans-Serif" };
            _fontNormal.FontWeight = 400; // Normal

            _fontBold = new SystemFont();
            _fontBold.FontNames = new string[] { "Segoe UI", "Helvetica Neue", "Arial", "Sans-Serif" };
            _fontBold.FontWeight = 700; // Bold

            // 2. 基本スタイルボックスの作成
            _styleDefault = new StyleBoxEmpty();

            // 3. ホバースタイル (#E4EBF7, 85% opacity)
            _styleHover = new StyleBoxFlat();
            _styleHover.BgColor = Color.FromHtml("#D2E3FC"); // 85% opacity = D9 in hex
            _styleHover.SetCornerRadiusAll(4); // 4px border radius
            _styleHover.ContentMarginLeft = 12; // 12px padding
            _styleHover.ContentMarginRight = 12;

            // 4. 選択状態スタイル (#D2E3FC, 100% opacity)
            _styleSelected = new StyleBoxFlat();
            _styleSelected.BgColor = Color.FromHtml("#D2E3FC");
            _styleSelected.SetCornerRadiusAll(4);
            _styleSelected.ContentMarginLeft = 12;
            _styleSelected.ContentMarginRight = 12;

            // 5. 選択状態ホバースタイル (#C2D9FA)
            _styleSelectedHover = new StyleBoxFlat();
            _styleSelectedHover.BgColor = Color.FromHtml("#D2E3FC");
            _styleSelectedHover.SetCornerRadiusAll(4);
            _styleSelectedHover.ContentMarginLeft = 12;
            _styleSelectedHover.ContentMarginRight = 12;

            // 6. プレス状態スタイル (#B2D1F9)
            _stylePressed = new StyleBoxFlat();
            _stylePressed.BgColor = Color.FromHtml("#B2D1F9");
            _stylePressed.SetCornerRadiusAll(4);
            _stylePressed.ContentMarginLeft = 12;
            _stylePressed.ContentMarginRight = 12;

            // 7. フォーカス状態スタイル（輪郭線のみ描画）
            _styleFocus = new StyleBoxFlat();
            _styleFocus.DrawCenter = false;
            _styleFocus.BorderWidthLeft = 1;
            _styleFocus.BorderWidthTop = 1;
            _styleFocus.BorderWidthRight = 1;
            _styleFocus.BorderWidthBottom = 1;
            _styleFocus.BorderColor = Color.FromHtml("#1A73E8");
            _styleFocus.SetCornerRadiusAll(4);
        }

        /// <summary>
        /// ナビゲーションリストに新しい項目を追加します。
        /// </summary>
        public void AddItem(string text)
        {
            var button = new Button();
            button.Text = text;
            
            // Constraint 1: 1行で表示し、はみ出た部分は省略表示
            button.ClipText = true;
            button.Alignment = HorizontalAlignment.Left;
            
            // 指標およびインタラクションの設定
            button.MouseDefaultCursorShape = CursorShape.PointingHand; // カーソル形状: ポインター
            button.CustomMinimumSize = new Vector2(0, 34); // 高さ 34px
            button.SizeFlagsHorizontal = SizeFlags.ExpandFill; // 横幅100%インタラクティブ（Constraint 2）

            // フォントおよびサイズの適用
            button.AddThemeFontOverride("font", _fontNormal);
            button.AddThemeFontSizeOverride("font_size", 14); // 14px

            // カラー設定（3.1, 3.2, 3.3）
            button.AddThemeColorOverride("font_color", Color.FromHtml("#333333CC")); // 80% opacity
            button.AddThemeColorOverride("font_hover_color", Color.FromHtml("#000000"));
            button.AddThemeColorOverride("font_pressed_color", Color.FromHtml("#1A73E8"));
            button.AddThemeColorOverride("font_focus_color", Color.FromHtml("#1A73E8"));

            // 基本スタイルの割り当て
            button.AddThemeStyleboxOverride("normal", _styleDefault);
            button.AddThemeStyleboxOverride("hover", _styleHover);
            button.AddThemeStyleboxOverride("pressed", _stylePressed);
            button.AddThemeStyleboxOverride("focus", _styleFocus);

            int index = _items.Count;
            button.Pressed += () => Select(index);

            // 動的なスタイル制御のためのシグナル接続
            button.MouseEntered += () => UpdateItemStyle(button, index, isHovered: true);
            button.MouseExited += () => UpdateItemStyle(button, index, isHovered: false);

            AddChild(button);
            _items.Add(button);

            // 初期のスタイリング更新
            UpdateItemStyle(button, index, isHovered: false);
        }

        /// <summary>
        /// 指定されたインデックスの項目を選択状態にします。
        /// </summary>
        public void Select(int index)
        {
            if (index < 0 || index >= _items.Count) return;

            int oldIndex = _selectedIndex;
            _selectedIndex = index;

            // 古い選択項目のスタイルを戻す
            if (oldIndex >= 0 && oldIndex < _items.Count)
            {
                UpdateItemStyle(_items[oldIndex], oldIndex, isHovered: false);
            }

            // 新しい選択項目のスタイルを適用
            UpdateItemStyle(_items[_selectedIndex], _selectedIndex, isHovered: false);

            EmitSignal(SignalName.ItemSelected, (long)index);
        }

        /// <summary>
        /// 項目の状態（選択・ホバー・通常）に応じて動的にテーマスタイルを更新します。
        /// </summary>
        private void UpdateItemStyle(Button button, int index, bool isHovered)
        {
            bool isSelected = (index == _selectedIndex);

            if (isSelected)
            {
                // 選択状態 (Selected)
                button.AddThemeFontOverride("font", _fontBold); // 太字
                button.AddThemeColorOverride("font_color", Color.FromHtml("#1A73E8")); // 青
                button.AddThemeColorOverride("font_hover_color", Color.FromHtml("#1A73E8"));

                // 選択済み項目に対してはホバー時のスタイル変更を行わず、常に選択中スタイルを維持
                button.AddThemeStyleboxOverride("normal", _styleSelected);
            }
            else
            {
                // 非選択状態 (Default / Hover)
                button.AddThemeFontOverride("font", _fontNormal); // 通常フォント
                button.AddThemeColorOverride("font_color", Color.FromHtml("#333333CC")); // 80% opacity
                button.AddThemeColorOverride("font_hover_color", Color.FromHtml("#000000")); // 黒

                button.AddThemeStyleboxOverride("normal", _styleDefault);
            }
        }
    }
}
