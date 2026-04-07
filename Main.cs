using Godot;
using System;
using System.Linq;
using System.Reflection;
using System.IO;

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
        // アセンブリ解決ハンドラを登録（System.Drawing.Common等のアセンブリ読み込み問題の回避）
        AppDomain.CurrentDomain.AssemblyResolve += OnAssemblyResolve;

        // System.Drawing.Commonを明示的にロード（Godot実行時のアセンブリ読み込み問題の回避）
        try
        {
            // Godot実行時はLocation が空の場合があるので、複数の方法でパスを取得
            var executingAssemblyPath = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            
            // Locationが空の場合は BaseDirectory を使用
            if (string.IsNullOrEmpty(executingAssemblyPath))
            {
                executingAssemblyPath = AppDomain.CurrentDomain.BaseDirectory;
                GD.Print($"[Main] Using BaseDirectory: {executingAssemblyPath}");
            }
            
            if (!string.IsNullOrEmpty(executingAssemblyPath))
            {
                var systemDrawingCommonPath = Path.Combine(executingAssemblyPath, "System.Drawing.Common.dll");
                
                if (File.Exists(systemDrawingCommonPath))
                {
                    Assembly.LoadFrom(systemDrawingCommonPath);
                    GD.Print($"[Main] System.Drawing.Common loaded from: {systemDrawingCommonPath}");
                }
                else
                {
                    GD.PrintErr($"[Main] System.Drawing.Common.dll not found at: {systemDrawingCommonPath}");
                }
            }
            else
            {
                GD.PrintErr("[Main] Cannot determine assembly directory");
            }
        }
        catch (Exception ex)
        {
            GD.PrintErr($"[Main] Failed to load System.Drawing.Common: {ex.Message}");
        }

        // プロジェクト設定が効かない場合のために、コードから強制的にウィンドウフラグを設定
        DisplayServer.WindowSetFlag(DisplayServer.WindowFlags.Borderless, true);
        DisplayServer.WindowSetFlag(DisplayServer.WindowFlags.AlwaysOnTop, true);
        DisplayServer.WindowSetFlag(DisplayServer.WindowFlags.Transparent, true);

        // 背景透過を有効化
        GetTree().Root.TransparentBg = true;

        // サブウィンドウ（設定画面など）をOSの独立したウィンドウとして表示する
        GetTree().Root.GuiEmbedSubwindows = false;

        // メインウィンドウも埋め込みを無効化する（エディタ実行時の Embedded window can't be moved 対策）
        GetWindow().GuiEmbedSubwindows = false;

        // C#コアクラス (SystemConfig) の呼び出し
        DesktopAiMascot.SystemConfig.Instance.Load();

        // マスコットの読み込みと表示
        DesktopAiMascot.mascots.MascotManager.Instance.Load();
        var sysConfig = DesktopAiMascot.SystemConfig.Instance;
        
        string configMascotName = sysConfig.MascotName;
        var model = DesktopAiMascot.mascots.MascotManager.Instance.GetMascotByName(configMascotName);

        // 設定されたマスコットが見つからなかった場合、最初に見つかったマスコットをデフォルトとして読み込む
        if (model == null && DesktopAiMascot.mascots.MascotManager.Instance.MascotModels.Count > 0)
        {
            model = DesktopAiMascot.mascots.MascotManager.Instance.MascotModels.Values.First();
            GD.Print($"[Main] Configured mascot '{configMascotName}' not found. Falling back to '{model.Name}'.");
            sysConfig.MascotName = model.Name;
            sysConfig.Save(); // フォールバックした場合は保存しておく
        }
        else if (model != null)
        {
             GD.Print($"[Main] Successfully loaded configured mascot '{model.Name}'.");
        }

        // GUI（設定画面）の初期化時に未選択扱いにならないように CurrentModel にセットする
        if (model != null)
        {
            DesktopAiMascot.mascots.MascotManager.Instance.CurrentModel = model;
        }

        UpdateMascotDisplay(model);

        // SettingsWindowの初期化
        var settingsScene = GD.Load<PackedScene>("res://ui/settings/SettingsWindow.tscn");
        _settingsWindow = settingsScene.Instantiate<DesktopAiMascot.ui.settings.SettingsWindow>();
        _settingsWindow.Hide(); // 初期状態は非表示
        _settingsWindow.MascotChanged += OnMascotChanged;
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

        // InteractionPanelの追加
        var interactionScene = GD.Load<PackedScene>("res://ui/chat/InteractionPanel.tscn");
        _interactionPanel = interactionScene.Instantiate<DesktopAiMascot.ui.chat.InteractionPanel>();
        _interactionPanel.Hide();
        // 配置はToggleInteractionPanelにて決定する
        AddChild(_interactionPanel);
    }

    private Assembly? OnAssemblyResolve(object? sender, ResolveEventArgs args)
    {
        try
        {
            var assemblyName = new AssemblyName(args.Name);
            GD.Print($"[Main] Resolving assembly: {assemblyName.Name}");

            if (assemblyName.Name == "System.Drawing.Common")
            {
                // Godot実行時はLocationが空の場合があるので、複数の方法でパスを取得
                var executingAssemblyPath = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
                
                // Locationが空の場合は BaseDirectory を使用
                if (string.IsNullOrEmpty(executingAssemblyPath))
                {
                    executingAssemblyPath = AppDomain.CurrentDomain.BaseDirectory;
                    GD.Print($"[Main] Using BaseDirectory for resolve: {executingAssemblyPath}");
                }

                if (!string.IsNullOrEmpty(executingAssemblyPath))
                {
                    var dllPath = Path.Combine(executingAssemblyPath, "System.Drawing.Common.dll");

                    if (File.Exists(dllPath))
                    {
                        GD.Print($"[Main] Loading System.Drawing.Common from: {dllPath}");
                        return Assembly.LoadFrom(dllPath);
                    }
                    else
                    {
                        GD.PrintErr($"[Main] System.Drawing.Common.dll not found at: {dllPath}");
                    }
                }
                else
                {
                    GD.PrintErr("[Main] Cannot determine assembly directory for resolve");
                }
            }
        }
        catch (Exception ex)
        {
            GD.PrintErr($"[Main] Assembly resolve error: {ex.Message}");
        }

        return null;
    }

    public override void _Notification(int what)
    {
        if (what == NotificationWMCloseRequest)
        {
            _trayIcon?.Dispose();
        }
    }

    public override void _Process(double delta)
    {
        if (_isDragging)
        {
            var mousePos = DisplayServer.MouseGetPosition();
            var window = GetWindow();

            // WindowがEmbedded（Godotエディタ内サブウィンドウ扱い等）かどうか判定
            if (!window.IsEmbedded())
            {
                // OSレベルで独立したウィンドウの場合
                window.Position = mousePos - _dragOffset;
            }
            else
            {
                // エディタ埋め込み等で通常のPosition変更が効かない場合のフォールバック
                DisplayServer.WindowSetPosition(mousePos - _dragOffset, (int)DisplayServer.MainWindowId);
            }
        }
    }

    public override void _Input(InputEvent @event)
    {
        if (@event is InputEventMouseButton mouseButton)
        {
            if (mouseButton.ButtonIndex == MouseButton.Left)
            {
                if (mouseButton.Pressed)
                {
                    _isDragging = true;
                    _hasMovedSinceClick = false;

                    var window = GetWindow();
                    if (!window.IsEmbedded())
                    {
                        _dragOffset = DisplayServer.MouseGetPosition() - window.Position;
                    }
                    else
                    {
                        _dragOffset = DisplayServer.MouseGetPosition() - DisplayServer.WindowGetPosition((int)DisplayServer.MainWindowId);
                    }
                }
                else
                {
                    _isDragging = false;
                    if (!_hasMovedSinceClick)
                    {
                        // クリック判定（ドラッグされなかった場合）
                        ToggleInteractionPanel();
                    }
                    else
                    {
                        // ドラッグ終了時に位置を保存
                        var window = GetWindow();
                        Vector2I newPos;
                        if (!window.IsEmbedded())
                        {
                            newPos = window.Position;
                        }
                        else
                        {
                            newPos = DisplayServer.WindowGetPosition((int)DisplayServer.MainWindowId);
                        }
                        var sysConfig = DesktopAiMascot.SystemConfig.Instance;
                        sysConfig.WindowPositionX = newPos.X;
                        sysConfig.WindowPositionY = newPos.Y;
                        sysConfig.Save();
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
                // 移動処理自体は _Process で1フレームごとに実行
            }
        }
    }

    private void ToggleInteractionPanel()
    {
        if (_interactionPanel == null) return;

        if (_interactionPanel.Visible)
        {
            _interactionPanel.Hide();
        }
        else
        {
            // メインウィンドウの隣（右側）にチャットパネルを表示する
            var win = GetWindow();
            _interactionPanel.Position = win.Position + new Vector2I(win.Size.X, 0);
            _interactionPanel.Show();
        }
    }

    [System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.NoInlining)]
    private void TryInitTrayIcon()
    {
        _trayIcon = new DesktopAiMascot.MascotTrayIcon(() =>
        {
            _settingsWindow?.CallDeferred(Godot.Window.MethodName.PopupCentered);
        });
    }

    private void OnMascotChanged(DesktopAiMascot.mascots.MascotModel model)
    {
        UpdateMascotDisplay(model);
    }

    private void UpdateMascotDisplay(DesktopAiMascot.mascots.MascotModel? model)
    {
        var sprite = GetNode<AnimatedSprite2D>("AnimatedSprite2D");
        Vector2? firstFrameSize = null;

        if (model != null)
        {
            var image = model.GetFrontImage() ?? model.GetPrimaryImage();
            if (image?.ImageSource != null)
            {
                var spriteFrames = new SpriteFrames();
                spriteFrames.AddAnimation("default");
                spriteFrames.SetAnimationSpeed("default", 5.0f); // 初期設定 5FPS
                spriteFrames.SetAnimationLoop("default", true);
                spriteFrames.AddFrame("default", image.ImageSource);
                firstFrameSize = image.ImageSource.GetSize();
                sprite.SpriteFrames = spriteFrames;
                sprite.Play("default");
            }
        }

        if (firstFrameSize.HasValue)
        {
            var size = firstFrameSize.Value;

            // 1024x1280の領域に収まるようにスケールを計算（アスペクト比維持）
            float maxWidth = 512f;
            float maxHeight = 640f;
            float scaleX = maxWidth / size.X;
            float scaleY = maxHeight / size.Y;
            float scale = Math.Min(scaleX, scaleY);

            // 縮小のみ行う（元画像が小さい場合は拡大しない）
            if (scale < 1.0f)
            {
                sprite.Scale = new Vector2(scale, scale);
            }
            else
            {
                sprite.Scale = new Vector2(1.0f, 1.0f);
            }

            var scaledSize = size * sprite.Scale;

            // OS側のメインウィンドウサイズをマスコットの表示サイズに合わせてリサイズする
            DisplayServer.WindowSetSize(new Vector2I((int)Math.Ceiling(scaledSize.X), (int)Math.Ceiling(scaledSize.Y)), (int)DisplayServer.MainWindowId);

            // スプライトをウィンドウの中央に配置
            var pos = new Vector2(scaledSize.X / 2f, scaledSize.Y / 2f);
            sprite.Position = pos;

            var halfSize = scaledSize / 2f;

            // ピクセル完全な四角形の領域を定義
            _mascotPolygon = new Vector2[]
            {
                new Vector2(pos.X - halfSize.X, pos.Y - halfSize.Y),
                new Vector2(pos.X + halfSize.X, pos.Y - halfSize.Y),
                new Vector2(pos.X + halfSize.X, pos.Y + halfSize.Y),
                new Vector2(pos.X - halfSize.X, pos.Y + halfSize.Y)
            };

            DisplayServer.WindowSetMousePassthrough(_mascotPolygon);
            
            // SystemConfigから位置を復元
            var sysConfig = DesktopAiMascot.SystemConfig.Instance;
            if (sysConfig.WindowPositionX != -1 && sysConfig.WindowPositionY != -1)
            {
                var window = GetWindow();
                if (!window.IsEmbedded())
                {
                    window.Position = new Vector2I(sysConfig.WindowPositionX, sysConfig.WindowPositionY);
                }
                else
                {
                    DisplayServer.WindowSetPosition(new Vector2I(sysConfig.WindowPositionX, sysConfig.WindowPositionY), (int)DisplayServer.MainWindowId);
                }
            }
        }
    }
}


