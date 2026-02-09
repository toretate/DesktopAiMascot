using DesktopAiMascot.aiservice;
using DesktopAiMascot.mascots;
using DesktopAiMascot.Controls;
using DesktopAiMascot.Wpf;
using System;
using System.Drawing;
using System.IO;
using System.Windows;
using System.Windows.Forms;
using System.Windows.Input;
using System.Windows.Threading;
using System.Diagnostics;

namespace DesktopAiMascot
{
    public partial class MascotWindow : Window
    {
        private readonly string DEFAULT_MODEL_NAME = "AIアシスタント";

        private NotifyIcon notifyIcon;
        private ContextMenuStrip contextMenu;

        private SystemConfig config;
        private Mascot mascot;

        private bool isDragging = false;
        private System.Windows.Point dragStartPosition;
        private System.Windows.Point mouseDownOffset;

        private System.Windows.Point dragStartScreen;
        private bool potentialClick = false;
        private const int ClickMoveThreshold = 5;

        private readonly SystemConfig systemConfig = SystemConfig.Instance;

        private DispatcherTimer animationTimer;
        private int animationTickCount = 0;
        
        // 位置保存用のタイマー（連続的な位置変更中の保存を避ける）
        private DispatcherTimer locationSaveTimer;

        public MascotWindow()
        {
            InitializeComponent();

            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            string appDir = Path.Combine(appData, "DesktopAiMascot");
            if (!Directory.Exists(appDir))
            {
                Directory.CreateDirectory(appDir);
            }
            systemConfig.BaseDir = appDir;
            systemConfig.Load();

            int imageWidth = 768 / 3;
            int imageHeight = 1024 / 3;

            this.Width = imageWidth + 220;
            this.Height = imageHeight;

            SetupNotifyIcon();

            // マスコット初期化
            mascot = new Mascot(new System.Drawing.Point(220, 0), new System.Drawing.Size(imageWidth, imageHeight));
            this.MascotControl.Initialize(mascot);

            this.InteractionPanel.MascotChanged += (s, model) =>
            {
                this.MascotControl.ReloadMascot(model);
                MascotManager.Instance.CurrentModel = model;
                SaveModelName();
            };

            // InteractionPanelのドラッグ移動イベントを処理。ウィンドウを動かす
            this.InteractionPanel.RequestDragMove += (s, e) =>
            {
                try
                {
                    if (Mouse.LeftButton == MouseButtonState.Pressed)
                    {
                        // ドラッグ開始時にアニメーションを一時停止
                        if (animationTimer != null && animationTimer.IsEnabled)
                        {
                            animationTimer.Stop();
                        }
                        this.DragMove();
                        // ドラッグ終了後にアニメーションを再開
                        if (animationTimer != null && !animationTimer.IsEnabled)
                        {
                            animationTimer.Start();
                        }
                    }
                }
                catch { }
            };

            var modelName = LoadModelName();
            var mManager = MascotManager.Instance;
            mManager.Load();
            mManager.CurrentModel = mManager.GetMascotByName(modelName);
            if (mManager.CurrentModel != null)
            {
                mascot.Reload(mManager.CurrentModel!);
                // MascotControlにもReloadを通知してcover.pngを表示
                this.MascotControl.ReloadMascot(mManager.CurrentModel);
            }

            VoiceAiManager.Instance.Load();
            if (!string.IsNullOrEmpty(systemConfig.VoiceService) && VoiceAiManager.Instance.VoiceAiServices.ContainsKey(systemConfig.VoiceService))
            {
                VoiceAiManager.Instance.CurrentService = VoiceAiManager.Instance.VoiceAiServices[systemConfig.VoiceService];
            }

            // 起動時に現在のマスコットのVoice設定を適用
            ApplyVoiceConfigForCurrentMascot();

            this.InteractionPanel.SetSettingsMascotImageProvider(() =>
            {
                try
                {
                    return this.MascotControl?.GetCurrentImage();
                }
                catch
                {
                    return null as Image;
                }
            });

            // InteractionPanel上でマウス操作中はアニメーションを一時停止
            this.InteractionPanel.MouseEnter += (s, e) =>
            {
                MascotAnimationManager.Instance.PauseAnimation();
            };

            this.InteractionPanel.MouseLeave += (s, e) =>
            {
                MascotAnimationManager.Instance.ResumeAnimation();
            };

            animationTimer = new DispatcherTimer(DispatcherPriority.Background);
            animationTimer.Interval = TimeSpan.FromMilliseconds(150);
            animationTimer.Tick += AnimationTimer_Tick;
            
            // アニメーションを一時的にOFF（パフォーマンス改善のため）
            // animationTimer.Start();
            Debug.WriteLine("[MascotWindow] アニメーションは一時的に無効化されています");

            // アニメーションマネージャーにタイマーを登録
            MascotAnimationManager.Instance.RegisterAnimationTimer(animationTimer);

            // 位置変更時に保存するイベントを登録
            this.LocationChanged += MascotWindow_LocationChanged;

            this.Loaded += MascotWindow_Loaded;
            this.Closing += MascotWindow_Closing;
        }

        private void MascotWindow_Loaded(object sender, RoutedEventArgs e)
        {
            System.Windows.Point? saved = LoadSavedLocation();
            
            if (saved.HasValue)
            {
                System.Windows.Point loc = saved.Value;
                
                double virtualLeft = SystemParameters.VirtualScreenLeft;
                double virtualTop = SystemParameters.VirtualScreenTop;
                double virtualWidth = SystemParameters.VirtualScreenWidth;
                double virtualHeight = SystemParameters.VirtualScreenHeight;

                if (loc.X < virtualLeft) loc.X = virtualLeft;
                if (loc.Y < virtualTop) loc.Y = virtualTop;
                if (loc.X + this.Width > virtualLeft + virtualWidth) loc.X = virtualLeft + virtualWidth - this.Width;
                if (loc.Y + this.Height > virtualTop + virtualHeight) loc.Y = virtualTop + virtualHeight - this.Height;

                this.Left = loc.X;
                this.Top = loc.Y;
                Debug.WriteLine($"Applied saved location to window: {loc.X},{loc.Y}");
            }
            else
            {
                var workArea = SystemParameters.WorkArea;
                this.Left = workArea.Right - this.Width;
                this.Top = workArea.Bottom - this.Height;
                Debug.WriteLine($"Applied default location to window: {this.Left},{this.Top}");
            }

            // UpdateMascotImage()の呼び出しを削除
            // cover.pngを表示し続ける（アニメーションが開始されると自動的に切り替わる）
        }

        private void MascotWindow_LocationChanged(object sender, EventArgs e)
        {
            // 位置変更が連続的に発生するため、タイマーで遅延保存
            // ドラッグ中は何度も発火するが、停止後1秒経過してから保存
            locationSaveTimer?.Stop();
            
            locationSaveTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromSeconds(1)
            };
            
            locationSaveTimer.Tick += (s, args) =>
            {
                locationSaveTimer.Stop();
                
                var currentLocation = new System.Windows.Point(this.Left, this.Top);
                Debug.WriteLine($"[MascotWindow] 位置が変更されました: ({currentLocation.X}, {currentLocation.Y})");
                SaveLocation(currentLocation);
            };
            
            locationSaveTimer.Start();
        }

        private void SetupNotifyIcon()
        {
            notifyIcon = new NotifyIcon();
            notifyIcon.Icon = System.Drawing.SystemIcons.Application;
            notifyIcon.Text = "Desktop Mascot";
            contextMenu = new ContextMenuStrip();
            contextMenu.Items.Add("Show", null, ShowMascot);
            contextMenu.Items.Add("Hide", null, HideMascot);
            contextMenu.Items.Add("Exit", null, ExitApplication);
            notifyIcon.ContextMenuStrip = contextMenu;
            notifyIcon.Visible = true;
        }

        private void AnimationTimer_Tick(object sender, EventArgs e)
        {
            this.MascotControl?.UpdateMascotImage();
        }

        private void ShowMascot(object sender, EventArgs e)
        {
            this.Show();
            this.WindowState = WindowState.Normal;
        }

        private void HideMascot(object sender, EventArgs e)
        {
            this.Hide();
        }

        private void ExitApplication(object sender, EventArgs e)
        {
            this.Close();
        }

        private void MascotWindow_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            Debug.WriteLine("[MascotWindow] ========== Closing イベント開始 ==========");
            
            try
            {
                // 位置保存タイマーを停止
                locationSaveTimer?.Stop();
                
                // 最終位置を保存
                var currentLocation = new System.Windows.Point(this.Left, this.Top);
                Debug.WriteLine($"[MascotWindow] 現在の位置: ({currentLocation.X}, {currentLocation.Y})");
                SaveLocation(currentLocation);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotWindow] 位置保存エラー: {ex.Message}");
            }

            try
            {
                animationTimer?.Stop();
                mascot?.Dispose();
            }
            catch { }

            try
            {
                if (notifyIcon != null)
                {
                    notifyIcon.Visible = false;
                    notifyIcon.Dispose();
                }
            }
            catch { }
            
            Debug.WriteLine("[MascotWindow] ========== Closing イベント終了 ==========");
        }

        private void Window_MouseDown(object sender, MouseButtonEventArgs e)
        {
            if (e.ChangedButton == MouseButton.Left)
            {
                var position = e.GetPosition(this);
                
                if (position.X >= 220)
                {
                    potentialClick = true;
                    dragStartScreen = PointToScreen(position);
                    mouseDownOffset = position;
                    this.CaptureMouse();
                }
            }
        }

        private void Window_MouseMove(object sender, System.Windows.Input.MouseEventArgs e)
        {
            if (!isDragging && potentialClick && e.LeftButton == MouseButtonState.Pressed)
            {
                var current = PointToScreen(e.GetPosition(this));
                if (Math.Abs(current.X - dragStartScreen.X) > ClickMoveThreshold || 
                    Math.Abs(current.Y - dragStartScreen.Y) > ClickMoveThreshold)
                {
                    isDragging = true;
                    potentialClick = false;
                    // ドラッグ中はアニメーションを一時停止してパフォーマンスを向上
                    if (animationTimer != null && animationTimer.IsEnabled)
                    {
                        animationTimer.Stop();
                        Debug.WriteLine("Animation stopped during drag");
                    }
                }
            }

            if (isDragging && e.LeftButton == MouseButtonState.Pressed)
            {
                var mouseScreen = PointToScreen(e.GetPosition(this));
                var newLocation = new System.Windows.Point(
                    mouseScreen.X - mouseDownOffset.X, 
                    mouseScreen.Y - mouseDownOffset.Y);

                double virtualLeft = SystemParameters.VirtualScreenLeft;
                double virtualTop = SystemParameters.VirtualScreenTop;
                double virtualWidth = SystemParameters.VirtualScreenWidth;
                double virtualHeight = SystemParameters.VirtualScreenHeight;

                if (newLocation.X < virtualLeft) newLocation.X = virtualLeft;
                if (newLocation.Y < virtualTop) newLocation.Y = virtualTop;
                if (newLocation.X + this.Width > virtualLeft + virtualWidth) 
                    newLocation.X = virtualLeft + virtualWidth - this.Width;
                if (newLocation.Y + this.Height > virtualTop + virtualHeight) 
                    newLocation.Y = virtualTop + virtualHeight - this.Height;

                this.Left = newLocation.X;
                this.Top = newLocation.Y;
            }
        }

        private void Window_MouseUp(object sender, MouseButtonEventArgs e)
        {
            if (e.ChangedButton == MouseButton.Left)
            {
                if (potentialClick && !isDragging)
                {
                    this.InteractionPanel?.ShowInput();
                }

                if (isDragging)
                {
                    isDragging = false;
                    this.ReleaseMouseCapture();
                    MascotAnimationManager.Instance.ResumeAnimation();
                    try
                    {
                        SaveLocation(new System.Windows.Point(this.Left, this.Top));
                    }
                    catch { }
                }
                potentialClick = false;
            }
        }

        private String LoadModelName()
        {
            return systemConfig.MascotName;
        }

        private void SaveModelName()
        {
            if (MascotManager.Instance.CurrentModel != null)
            {
                systemConfig.MascotName = MascotManager.Instance.CurrentModel.Name;
                systemConfig.Save();
                Debug.WriteLine($"Saved model name: {systemConfig.MascotName}");
            }
        }

        private System.Windows.Point? LoadSavedLocation()
        {
            System.Drawing.Point point = systemConfig.WindowPosition;
            
            // -1 は未設定を表す（初回起動時）
            if (point.X >= 0 && point.Y >= 0)
            {
                Debug.WriteLine($"[MascotWindow] 保存された位置を読み込みました: ({point.X}, {point.Y})");
                return new System.Windows.Point(point.X, point.Y);
            }
            
            Debug.WriteLine($"[MascotWindow] 保存された位置がありません。デフォルト位置を使用します。");
            return null;
        }

        private void SaveLocation(System.Windows.Point p)
        {
            systemConfig.WindowPosition = new System.Drawing.Point((int)p.X, (int)p.Y);
            systemConfig.Save();
            Debug.WriteLine($"Saved location: {p.X},{p.Y}");
        }

        /// <summary>
        /// 現在のマスコットに保存されているVoice設定を適用します
        /// </summary>
        private void ApplyVoiceConfigForCurrentMascot()
        {
            try
            {
                var currentMascot = MascotManager.Instance.CurrentModel;
                if (currentMascot == null)
                {
                    Debug.WriteLine("[MascotWindow] CurrentModelがnullのため、Voice設定の適用をスキップ");
                    return;
                }
                
                Debug.WriteLine($"[MascotWindow] ========== Voice設定の適用開始（起動時） ==========");
                Debug.WriteLine($"[MascotWindow] マスコット: {currentMascot.Name}");
                
                var currentService = VoiceAiManager.Instance.CurrentService;
                if (currentService == null)
                {
                    Debug.WriteLine("[MascotWindow] Voice AIサービスが選択されていません");
                    return;
                }
                
                Debug.WriteLine($"[MascotWindow] 現在のVoice AIサービス: {currentService.Name}");
                
                // マスコットのVoice設定を取得
                if (currentMascot.Config.Voice != null &&
                    currentMascot.Config.Voice.TryGetValue(currentService.Name, out var voiceConfig))
                {
                    Debug.WriteLine($"[MascotWindow] ✓ マスコットに{currentService.Name}のVoice設定が見つかりました");
                    Debug.WriteLine($"[MascotWindow]   - モデル: {voiceConfig.Model}");
                    Debug.WriteLine($"[MascotWindow]   - スピーカー: {voiceConfig.Speaker}");

                    // モデルとスピーカーを設定
                    if (!string.IsNullOrEmpty(voiceConfig.Model))
                    {
                        Debug.WriteLine($"[MascotWindow] サービスのモデルを '{currentService.Model}' から '{voiceConfig.Model}' に変更");
                        currentService.Model = voiceConfig.Model;
                        SystemConfig.Instance.VoiceServiceModel = voiceConfig.Model;
                    }

                    if (!string.IsNullOrEmpty(voiceConfig.Speaker))
                    {
                        Debug.WriteLine($"[MascotWindow] サービスのスピーカーを '{currentService.Speaker}' から '{voiceConfig.Speaker}' に変更");
                        currentService.Speaker = voiceConfig.Speaker;
                        SystemConfig.Instance.VoiceServiceSpeaker = voiceConfig.Speaker;
                    }

                    SystemConfig.Instance.Save();
                    Debug.WriteLine($"[MascotWindow] ✓ Voice設定をSystemConfigに保存しました");
                }
                else
                {
                    Debug.WriteLine($"[MascotWindow] ✗ マスコット「{currentMascot.Name}」には「{currentService.Name}」のVoice設定がありません");
                    Debug.WriteLine($"[MascotWindow] デフォルトのVoice設定を使用します");
                }
                
                Debug.WriteLine($"[MascotWindow] ========== Voice設定の適用完了（起動時） ==========");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotWindow] ✗ Voice設定の適用エラー: {ex.Message}");
                Debug.WriteLine($"[MascotWindow] 스택 추적: {ex.StackTrace}");
            }
        }
    }
}
