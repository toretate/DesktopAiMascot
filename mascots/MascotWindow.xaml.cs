using DesktopAiMascot.aiservice;
using System;
using System.Drawing;
using System.IO;
using System.Windows;
using System.Windows.Forms;
using System.Windows.Input;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

namespace DesktopAiMascot.mascots
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
        private BitmapSource cachedBitmapSource;

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

            mascot = new Mascot(new System.Drawing.Point(220, 0), new System.Drawing.Size(imageWidth, imageHeight));

            InteractionPanel.MascotChanged += (s, model) =>
            {
                mascot.Reload(model);
                MascotManager.Instance.CurrentModel = model;
                SaveModelName();
                UpdateMascotImage();
            };

            InteractionPanel.RequestDragMove += (s, e) =>
            {
                try
                {
                    this.DragMove();
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
            }

            if (!string.IsNullOrEmpty(systemConfig.VoiceService) && VoiceAiManager.Instance.VoiceAiServices.ContainsKey(systemConfig.VoiceService))
            {
                VoiceAiManager.Instance.CurrentService = VoiceAiManager.Instance.VoiceAiServices[systemConfig.VoiceService];
            }

            InteractionPanel.SetSettingsMascotImageProvider(() =>
            {
                try
                {
                    return mascot?.GetCurrentImageClone();
                }
                catch
                {
                    return null as Image;
                }
            });

            animationTimer = new DispatcherTimer();
            animationTimer.Interval = TimeSpan.FromMilliseconds(100);
            animationTimer.Tick += AnimationTimer_Tick;
            animationTimer.Start();

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
                Console.WriteLine($"Applied saved location to window: {loc.X},{loc.Y}");
            }
            else
            {
                var workArea = SystemParameters.WorkArea;
                this.Left = workArea.Right - this.Width;
                this.Top = workArea.Bottom - this.Height;
                Console.WriteLine($"Applied default location to window: {this.Left},{this.Top}");
            }

            UpdateMascotImage();
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
            UpdateMascotImage();
        }

        private void UpdateMascotImage()
        {
            try
            {
                var image = mascot?.GetCurrentImageClone();
                if (image != null)
                {
                    MascotImage.Source = ConvertToBitmapSource(image);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error updating mascot image: {ex.Message}");
            }
        }

        private BitmapSource ConvertToBitmapSource(Image image)
        {
            using (var bitmap = new System.Drawing.Bitmap(image))
            {
                using (var memoryStream = new MemoryStream())
                {
                    // PNGフォーマットで保存してアルファチャンネルと品質を保持
                    bitmap.Save(memoryStream, System.Drawing.Imaging.ImageFormat.Png);
                    memoryStream.Position = 0;

                    var bitmapImage = new BitmapImage();
                    bitmapImage.BeginInit();
                    bitmapImage.CacheOption = BitmapCacheOption.OnLoad;
                    bitmapImage.StreamSource = memoryStream;
                    // 高品質なデコーディングを有効化
                    bitmapImage.CreateOptions = BitmapCreateOptions.PreservePixelFormat;
                    bitmapImage.EndInit();
                    
                     
                     // Freeze to improve performance by making the bitmap immutable
                     bitmapImage.Freeze();
                     return bitmapImage;
                 }
             }
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
            try
            {
                SaveLocation(new System.Windows.Point(this.Left, this.Top));
            }
            catch { }

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
                    animationTimer?.Stop();
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
                    InteractionPanel?.ShowInput();
                }

                if (isDragging)
                {
                    isDragging = false;
                    this.ReleaseMouseCapture();
                    // ドラッグ終了後、アニメーションを再開
                    animationTimer?.Start();
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
                Console.WriteLine($"Saved model name: {systemConfig.MascotName}");
            }
        }

        private System.Windows.Point? LoadSavedLocation()
        {
            System.Drawing.Point point = systemConfig.WindowPosition;
            if (point.X != 100 || point.Y != 100)
            {
                return new System.Windows.Point(point.X, point.Y);
            }
            return null;
        }

        private void SaveLocation(System.Windows.Point p)
        {
            systemConfig.WindowPosition = new System.Drawing.Point((int)p.X, (int)p.Y);
            systemConfig.Save();
            Console.WriteLine($"Saved location: {p.X},{p.Y}");
        }
    }
}
