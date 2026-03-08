using Godot;
using System;

public partial class Main : Node2D
{
    private bool _isDragging = false;
    private Vector2I _dragOffset;
    private IDisposable? _trayIcon;
    private DesktopAiMascot.ui.settings.SettingsWindow? _settingsWindow;

    private bool _hasMovedSinceClick = false;
    private DesktopAiMascot.ui.chat.InteractionPanel? _interactionPanel;
    private Vector2[]? _mascotPolygon;

    public override void _Ready()
    {
        // プロジェクト設定が効かない場合のために、コードから強制的にウィンドウフラグを設定
        DisplayServer.WindowSetFlag(DisplayServer.WindowFlags.Borderless, true);
        DisplayServer.WindowSetFlag(DisplayServer.WindowFlags.AlwaysOnTop, true);
        DisplayServer.WindowSetFlag(DisplayServer.WindowFlags.Transparent, true);

        // 背景透過を有効化
        GetTree().Root.TransparentBg = true;
        
        // サブウィンドウ（設定画面など）をOSの独立したウィンドウとして表示する
        GetTree().Root.GuiEmbedSubwindows = false;

        var sprite = GetNode<Sprite2D>("Sprite2D");
        if (sprite.Texture != null)
        {
            var size = sprite.Texture.GetSize();
            var pos = sprite.Position;
            var halfSize = size / 2;
            
            // ピクセル完全な四角形の領域を定義
            _mascotPolygon = new Vector2[]
            {
                new Vector2(pos.X - halfSize.X, pos.Y - halfSize.Y),
                new Vector2(pos.X + halfSize.X, pos.Y - halfSize.Y),
                new Vector2(pos.X + halfSize.X, pos.Y + halfSize.Y),
                new Vector2(pos.X - halfSize.X, pos.Y + halfSize.Y)
            };
            
            DisplayServer.WindowSetMousePassthrough(_mascotPolygon);
        }

        // SettingsWindowの初期化
        _settingsWindow = new DesktopAiMascot.ui.settings.SettingsWindow();
        _settingsWindow.Hide(); // 初期状態は非表示
        AddChild(_settingsWindow);

        // タスクトレイアイコンの初期化 (Godotエディタ実行時等の WinForms ロードエラー対策)
        try
        {
            TryInitTrayIcon();
        }
        catch (Exception ex)
        {
            GD.PrintErr($"[Mascot] トレイアイコンの初期化に失敗しました (Godotエディタ実行時の WinForms 制約のため無視します): {ex.Message}");
        }
        
        // C#コアクラス (SystemConfig) の呼び出しテスト
        DesktopAiMascot.SystemConfig.Instance.Load();

        // InteractionPanelの追加
        _interactionPanel = new DesktopAiMascot.ui.chat.InteractionPanel();
        _interactionPanel.Visible = false;
        _interactionPanel.Size = new Vector2(350, 500);
        
        // マスコットの横に配置 (仮のオフセットとサイズ)
        if (sprite.Texture != null)
        {
            var panelPos = sprite.Position + new Vector2(sprite.Texture.GetSize().X / 2 + 20, -200);
            _interactionPanel.Position = panelPos;
        }
        else
        {
            _interactionPanel.Position = new Vector2(100, 100);
        }

        AddChild(_interactionPanel);
    }

    public override void _Notification(int what)
    {
        if (what == NotificationWMCloseRequest)
        {
            _trayIcon?.Dispose();
        }
    }

    public override void _UnhandledInput(InputEvent @event)
    {
        if (@event is InputEventMouseButton mouseButton)
        {
            if (mouseButton.ButtonIndex == MouseButton.Left)
            {
                if (mouseButton.Pressed)
                {
                    _isDragging = true;
                    _hasMovedSinceClick = false;
                    // ドラッグ開始時のマウス位置とウィンドウ位置の差分を記録
                    _dragOffset = DisplayServer.MouseGetPosition() - DisplayServer.WindowGetPosition();
                }
                else
                {
                    _isDragging = false;
                    if (!_hasMovedSinceClick)
                    {
                        // クリック判定（ドラッグされなかった場合）
                        ToggleInteractionPanel();
                    }
                }
            }
            else if (mouseButton.ButtonIndex == MouseButton.Right && mouseButton.Pressed)
            {
                // 右クリックで設定画面を開く (トレイアイコンが使えない環境用のフォールバック兼ショートカット)
                _settingsWindow?.PopupCentered();
            }
        }
        else if (@event is InputEventMouseMotion mouseMotion)
        {
            if (_isDragging)
            {
                _hasMovedSinceClick = true;
                // マウスの現在位置からオフセットを引いた値を新しいウィンドウ位置とする
                DisplayServer.WindowSetPosition(DisplayServer.MouseGetPosition() - _dragOffset);
            }
        }
    }

    private void ToggleInteractionPanel()
    {
        if (_interactionPanel == null) return;

        _interactionPanel.Visible = !_interactionPanel.Visible;

        if (_interactionPanel.Visible)
        {
            // パネル表示時はウィンドウ全体のクリックスルーを解除（パネル操作可能にする）
            DisplayServer.WindowSetMousePassthrough(new Vector2[] {});
        }
        else
        {
            // 非表示時は再びマスコット部分のみクリック可能にする
            if (_mascotPolygon != null)
            {
                DisplayServer.WindowSetMousePassthrough(_mascotPolygon);
            }
        }
    }

    [System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.NoInlining)]
    private void TryInitTrayIcon()
    {
        _trayIcon = new DesktopAiMascot.MascotTrayIcon(() => {
            _settingsWindow?.CallDeferred(Godot.Window.MethodName.PopupCentered);
        });
    }
}
