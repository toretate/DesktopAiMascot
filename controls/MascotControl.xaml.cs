using System;
using System.Drawing;
using System.IO;
using System.Windows.Controls;
using System.Windows.Media.Imaging;
using DesktopAiMascot.mascots;

namespace DesktopAiMascot.Controls
{
    public partial class MascotControl : System.Windows.Controls.UserControl
    {
        private Mascot mascot;
        private bool isUpdatingImage = false;

        public MascotControl()
        {
            InitializeComponent();
        }

        public void Initialize(Mascot mascot)
        {
            this.mascot = mascot;
            UpdateMascotImage();
        }

        public void UpdateMascotImage()
        {
            if (isUpdatingImage) return;

            isUpdatingImage = true;
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
            finally
            {
                isUpdatingImage = false;
            }
        }

        public System.Drawing.Image GetCurrentImage()
        {
            return mascot?.GetCurrentImageClone();
        }

        public void ReloadMascot(MascotModel model)
        {
            mascot?.Reload(model);
            UpdateMascotImage();
        }

        private BitmapSource ConvertToBitmapSource(System.Drawing.Image image)
        {
            using (var bitmap = new Bitmap(image))
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
    }
}

