using DesktopAiMascot.utils;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DesktopAiMascot.mascots
{
    /// <summary>
    /// 画像一覧表示用のアイテム
    /// System.Drawing.ImageとWPF BitmapSourceの両方をキャッシュして提供
    /// </summary>
    public class MascotImageItem
    {
        public string ImagePath { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;

        private System.Windows.Media.Imaging.BitmapSource? _cachedImage;
        private System.Drawing.Image? _cachedDrawingImage;

        /// <summary>
        /// 画像をBitmapSourceとして取得（WPF表示用）
        /// ImageLoadHelper.LoadBitmapThumbnail()でファイルロックを避けながら読み込み
        /// </summary>
        public System.Windows.Media.Imaging.BitmapSource? ImageSource
        {
            get
            {
                // キャッシュがあればそれを返す
                if (_cachedImage != null)
                {
                    return _cachedImage;
                }

                // デザイナーモードでは null を返す
                if (System.ComponentModel.DesignerProperties.GetIsInDesignMode(new System.Windows.DependencyObject()))
                {
                    return null;
                }

                try
                {
                    // サムネイル用の軽量読み込みを使用（140x140に縮小）
                    var bitmap = ImageLoadHelper.LoadBitmapThumbnail(ImagePath, 140, 140);
                    if (bitmap != null)
                    {
                        // キャッシュに保存
                        _cachedImage = bitmap;
                        return bitmap;
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[MascotImageItem] 画像読み込みエラー ({FileName}): {ex.Message}");
                }

                return null;
            }
        }

        /// <summary>
        /// 画像をSystem.Drawing.Imageとして取得（GDI+描画用）
        /// ImageLoadHelper.LoadDrawingImageWithoutLock()でファイルロックを避けながら読み込み
        /// </summary>
        public System.Drawing.Image? Image
        {
            get
            {
                // キャッシュがあればそれを返す
                if (_cachedDrawingImage != null)
                {
                    return _cachedDrawingImage;
                }

                // デザイナーモードでは null を返す
                if (System.ComponentModel.DesignerProperties.GetIsInDesignMode(new System.Windows.DependencyObject()))
                {
                    return null;
                }

                try
                {
                    // ImageLoadHelper を使用して System.Drawing.Image を読み込む
                    var image = ImageLoadHelper.LoadDrawingImageWithoutLock(ImagePath);
                    if (image != null)
                    {
                        // キャッシュに保存
                        _cachedDrawingImage = image;
                        return image;
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[MascotImageItem] System.Drawing.Image読み込みエラー ({FileName}): {ex.Message}");
                }

                return null;
            }
        }

        /// <summary>
        /// キャッシュされたリソースを破棄
        /// </summary>
        public void Dispose()
        {
            // キャッシュされた画像を解放
            _cachedImage = null;
            _cachedDrawingImage?.Dispose();
            _cachedDrawingImage = null;
        }

        public int Width
        {
            get
            {
                return ImageSource?.PixelWidth ?? 0;
            }
        }

        public int Height
        {
            get
            {
                return ImageSource?.PixelHeight ?? 0;
            }
        }
    }
}
