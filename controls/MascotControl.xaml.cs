using System;
using System.Drawing;
using System.IO;
using System.Windows.Controls;
using System.Windows.Media.Imaging;
using DesktopAiMascot.mascots;
using DesktopAiMascot.utils;
using System.Diagnostics;

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
            // 初期表示はReloadMascot()で行うため、ここでは何もしない
            // （MascotWindow側でmascot.Reload()後にReloadMascot()が呼ばれる）
        }

        /// <summary>
        /// cover.pngを表示する（初期表示用）
        /// </summary>
        public void UpdateCoverImage()
        {
            if (isUpdatingImage || mascot == null) return;

            isUpdatingImage = true;
            try
            {
                // cover.pngを読み込む
                var image = mascot.LoadCoverImage();
                if (image != null)
                {
                    using (image)
                    {
                        var bitmapSource = ImageLoadHelper.ConvertDrawingImageToBitmapSource(image);
                        if (bitmapSource != null)
                        {
                            MascotImage.Source = bitmapSource;
                            Debug.WriteLine($"[MascotControl] cover.png を表示しました: {mascot.Model?.Name}");
                        }
                        else
                        {
                            Debug.WriteLine($"[MascotControl] BitmapSource変換に失敗しました");
                        }
                    }
                }
                else
                {
                    Debug.WriteLine($"[MascotControl] cover.pngが見つかりません");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotControl] cover.png 読み込みエラー: {ex.Message}");
            }
            finally
            {
                isUpdatingImage = false;
            }
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
                    // using で image を確実に破棄（毎フレーム実行されるためメモリリーク防止）
                    using (image)
                    {
                        var bitmapSource = ImageLoadHelper.ConvertDrawingImageToBitmapSource(image);
                        if (bitmapSource != null)
                        {
                            MascotImage.Source = bitmapSource;
                            Debug.WriteLine($"[MascotControl] マスコット画像を更新: サイズ={image.Width}x{image.Height}, フレーム={mascot?.CurrentFrame}");
                        }
                        else
                        {
                            Debug.WriteLine($"[MascotControl] BitmapSource変換に失敗しました");
                        }
                    }
                }
                else
                {
                    Debug.WriteLine($"[MascotControl] マスコット画像がnullです");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotControl] マスコット画像更新エラー: {ex.Message}");
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
            UpdateCoverImage();
        }
    }
}

