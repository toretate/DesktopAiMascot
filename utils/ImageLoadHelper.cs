using DesktopAiMascot.mascots;
using ImageMagick;
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Media.Imaging;
using System.Xml.Linq;

namespace DesktopAiMascot.utils
{
    /// <summary>
    /// 画像読み込みのヘルパークラス
    /// ファイルロックを発生させずに画像を読み込むためのユーティリティ
    /// </summary>
    public static class ImageLoadHelper
    {
        /// <summary>
        /// ImageMagickを使用するかどうか（falseの場合はSystem.Drawingを使用）
        /// </summary>
        public static bool UseImageMagick { get; set; } = false; // デフォルトは高速なSystem.Drawing版
        
        /// <summary>
        /// WPF用: サムネイル用の高速な画像読み込み（軽量版）
        /// フォールバックメソッドを直接使用してパフォーマンスを向上
        /// </summary>
        /// <param name="filePath">画像ファイルのパス</param>
        /// <param name="maxWidth">最大幅（デフォルト: 200px）</param>
        /// <param name="maxHeight">最大高さ（デフォルト: 200px）</param>
        /// <returns>読み込まれたBitmapSource、失敗時はnull</returns>
        public static BitmapSource? LoadBitmapThumbnail(string filePath, int maxWidth = 200, int maxHeight = 200)
        {
            try
            {
                if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
                {
                    return null;
                }

                using (var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    var bitmapImage = new BitmapImage();
                    bitmapImage.BeginInit();
                    bitmapImage.CacheOption = BitmapCacheOption.OnLoad;
                    bitmapImage.DecodePixelWidth = maxWidth; // サムネイルサイズに縮小
                    bitmapImage.StreamSource = stream;
                    bitmapImage.EndInit();
                    bitmapImage.Freeze();
                    return bitmapImage;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ImageLoadHelper] サムネイル読み込みエラー ({filePath}): {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// WPF用: ファイルロックを発生させずにBitmapSourceを読み込む（DPI対応）
        /// UseImageMagickフラグに応じて、ImageMagick版またはWPFネイティブ版を使用
        /// </summary>
        /// <param name="filePath">画像ファイルのパス</param>
        /// <returns>読み込まれたBitmapSource（DPI調整済み）、失敗時はnull</returns>
        public static BitmapSource? LoadBitmapImageWithoutLock(string filePath)
        {
            if (UseImageMagick)
            {
                return LoadBitmapImageWithImageMagick(filePath);
            }
            else
            {
                return LoadBitmapImageWithoutLockFallback(filePath);
            }
        }

        /// <summary>
        /// ImageMagick版: 透過保持、WebP/HEIF/AVIF対応、DPI正規化
        /// </summary>
        private static BitmapSource? LoadBitmapImageWithImageMagick(string filePath)
        {
            try
            {
                if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
                {
                    return null;
                }

                const double standardDpi = 96.0;
                
                // Magick.NETを使用して画像を読み込み
                using (var magickImage = new MagickImage(filePath))
                {
                    // アルファチャンネルがある場合のみ、明示的に有効化
                    if (magickImage.HasAlpha)
                    {
                        magickImage.Alpha(AlphaOption.On);
                        Debug.WriteLine($"[ImageLoadHelper] ImageMagick: アルファチャンネルあり ({Path.GetFileName(filePath)})");
                    }
                    else
                    {
                        Debug.WriteLine($"[ImageLoadHelper] ImageMagick: アルファチャンネルなし ({Path.GetFileName(filePath)})");
                    }
                    
                    // DPIを96に正規化
                    magickImage.Density = new Density(standardDpi, standardDpi);
                    
                    // PNG形式でMemoryStreamに書き出し（ファイルロックを避ける）
                    using (var memoryStream = new MemoryStream())
                    {
                        // PNG32形式で書き出し（透過対応、32bit = RGBA）
                        magickImage.Format = MagickFormat.Png32;
                        magickImage.Write(memoryStream);
                        memoryStream.Position = 0;
                        
                        // WPFのBitmapImageに変換
                        var bitmapImage = new BitmapImage();
                        bitmapImage.BeginInit();
                        bitmapImage.CacheOption = BitmapCacheOption.OnLoad;
                        bitmapImage.StreamSource = memoryStream;
                        bitmapImage.EndInit();
                        bitmapImage.Freeze();
                        
                        Debug.WriteLine($"[ImageLoadHelper] ImageMagick版 BitmapSource読み込み成功: {filePath}");
                        return bitmapImage;
                    }
                }
            }
            catch (MagickException ex)
            {
                Debug.WriteLine($"[ImageLoadHelper] Magick.NET読み込みエラー ({filePath}): {ex.Message}");
                
                // Magick.NETで失敗した場合、フォールバックとして標準のBitmapDecoderを試す
                return LoadBitmapImageWithoutLockFallback(filePath);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ImageLoadHelper] ImageMagick版 BitmapImage読み込みエラー ({filePath}): {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// フォールバック: 標準のBitmapDecoderを使用した読み込み
        /// </summary>
        private static BitmapSource? LoadBitmapImageWithoutLockFallback(string filePath)
        {
            try
            {
                using (var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    // 適切なデコーダーを使用（自動判定）
                    var decoder = BitmapDecoder.Create(stream, BitmapCreateOptions.PreservePixelFormat, BitmapCacheOption.OnLoad);
                    BitmapSource frame = decoder.Frames[0];

                    // 【重要】ここで Pbgra32 に強制変換する
                    if (frame.Format != System.Windows.Media.PixelFormats.Pbgra32)
                    {
                        frame = new FormatConvertedBitmap(frame, System.Windows.Media.PixelFormats.Pbgra32, null, 0);
                    }

                    // DPIを96に正規化（高DPI環境対応）
                    const double standardDpi = 96.0;
                    if (Math.Abs(frame.DpiX - standardDpi) > 0.01 || Math.Abs(frame.DpiY - standardDpi) > 0.01)
                    {
                        // DPIが標準と異なる場合、96DPIに変換
                        int width = frame.PixelWidth;
                        int height = frame.PixelHeight;
                        int stride = width * ((frame.Format.BitsPerPixel + 7) / 8);
                        byte[] pixelData = new byte[stride * height];
                        frame.CopyPixels(pixelData, stride, 0);

                        var normalizedFrame = BitmapSource.Create(
                            width, height,
                            standardDpi, standardDpi,
                            frame.Format,
                            frame.Palette,
                            pixelData,
                            stride);

                        normalizedFrame.Freeze();
                        return normalizedFrame;
                    }

                    // DPIが既に標準の場合はそのまま返す
                    frame.Freeze();
                    return frame;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ImageLoadHelper] フォールバック読み込みエラー ({filePath}): {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// System.Drawing用: ファイルロックを発生させずにImageを読み込む
        /// UseImageMagickフラグに応じて、ImageMagick版またはSystem.Drawing版を使用
        /// </summary>
        /// <param name="filePath">画像ファイルのパス</param>
        /// <returns>読み込まれたImage、失敗時はnull</returns>
        public static Image? LoadDrawingImageWithoutLock(string filePath)
        {
            if (UseImageMagick)
            {
                return LoadDrawingImageWithImageMagick(filePath);
            }
            else
            {
                return LoadDrawingImageWithoutLockFallback(filePath);
            }
        }

        /// <summary>
        /// ImageMagick版: 透過保持、WebP/HEIF/AVIF対応
        /// </summary>
        private static Image? LoadDrawingImageWithImageMagick(string filePath)
        {
            try
            {
                if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
                {
                    return null;
                }

                // Magick.NETを使用して画像を読み込み（透過保持）
                using (var magickImage = new MagickImage(filePath))
                {
                    // アルファチャンネルがある場合のみ、明示的に有効化
                    if (magickImage.HasAlpha)
                    {
                        magickImage.Alpha(AlphaOption.On);
                        Debug.WriteLine($"[ImageLoadHelper] ImageMagick: アルファチャンネルあり ({Path.GetFileName(filePath)})");
                    }
                    else
                    {
                        Debug.WriteLine($"[ImageLoadHelper] ImageMagick: アルファチャンネルなし ({Path.GetFileName(filePath)})");
                    }
                    
                    // PNG32形式でMemoryStreamに書き出し
                    using (var memoryStream = new MemoryStream())
                    {
                        magickImage.Format = MagickFormat.Png32;
                        magickImage.Write(memoryStream);
                        memoryStream.Position = 0;
                        
                        // System.Drawing.Imageとして読み込み
                        var image = Image.FromStream(memoryStream);
                        Debug.WriteLine($"[ImageLoadHelper] ImageMagick版 Drawing.Image読み込み成功: {filePath} (サイズ: {image.Width}x{image.Height})");
                        return image;
                    }
                }
            }
            catch (MagickException ex)
            {
                Debug.WriteLine($"[ImageLoadHelper] Magick.NET Drawing.Image読み込みエラー ({filePath}): {ex.Message}");
                
                // フォールバック: 従来の方法
                return LoadDrawingImageWithoutLockFallback(filePath);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ImageLoadHelper] ImageMagick版 Drawing.Image読み込みエラー ({filePath}): {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// フォールバック: 従来のFileStreamを使用した読み込み
        /// </summary>
        private static Image? LoadDrawingImageWithoutLockFallback(string filePath)
        {
            try
            {
                using (var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                using (var memoryStream = new MemoryStream())
                {
                    fileStream.CopyTo(memoryStream);
                    memoryStream.Position = 0;
                    var image = Image.FromStream(memoryStream);
                    Debug.WriteLine($"[ImageLoadHelper] フォールバック Drawing.Image読み込み成功: {filePath} (サイズ: {image.Width}x{image.Height})");
                    return image;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ImageLoadHelper] フォールバック Drawing.Image読み込みエラー ({filePath}): {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 画像ファイルをBase64 Data URI形式で読み込む
        /// </summary>
        /// <param name="filePath">画像ファイルのパス</param>
        /// <returns>Base64 Data URI文字列（例: "data:image/png;base64,..."）、失敗時はnull</returns>
        public static string? LoadImageAsBase64DataUri(string filePath)
        {
            try
            {
                if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
                {
                    return null;
                }

                byte[] imageBytes;
                using (var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    imageBytes = new byte[fileStream.Length];
                    fileStream.Read(imageBytes, 0, imageBytes.Length);
                }

                string base64Image = Convert.ToBase64String(imageBytes);
                string mimeType = GetMimeTypeFromExtension(filePath);
                return $"data:{mimeType};base64,{base64Image}";
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ImageLoadHelper] Base64変換エラー ({filePath}): {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Base64 Data URI文字列からバイト配列に変換
        /// </summary>
        /// <param name="dataUri">Base64 Data URI文字列（例: "data:image/png;base64,..."）</param>
        /// <returns>画像のバイト配列、失敗時はnull</returns>
        public static byte[]? ConvertBase64DataUriToBytes(string dataUri)
        {
            try
            {
                if (string.IsNullOrEmpty(dataUri))
                {
                    return null;
                }

                // Data URIからBase64部分を抽出
                string base64Data = dataUri;
                if (dataUri.Contains(","))
                {
                    base64Data = dataUri.Split(',')[1];
                }

                return Convert.FromBase64String(base64Data);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ImageLoadHelper] Base64デコードエラー: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// System.Drawing.ImageをWPFのBitmapSourceに変換
        /// </summary>
        /// <param name="image">変換元のSystem.Drawing.Image</param>
        /// <returns>変換されたBitmapSource、失敗時はnull</returns>
        public static BitmapSource? ConvertDrawingImageToBitmapSource(Image image)
        {
            try
            {
                if (image == null)
                {
                    return null;
                }

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
            catch (Exception ex)
            {
                Debug.WriteLine($"[ImageLoadHelper] System.Drawing.Image -> BitmapSource変換エラー: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// ファイル拡張子からMIMEタイプを取得
        /// </summary>
        /// <param name="filePath">ファイルパス</param>
        /// <returns>MIMEタイプ</returns>
        private static string GetMimeTypeFromExtension(string filePath)
        {
            string extension = Path.GetExtension(filePath).ToLowerInvariant();
            return extension switch
            {
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".gif" => "image/gif",
                ".webp" => "image/webp",
                ".heif" or ".heic" => "image/heif",
                ".avif" => "image/avif",
                ".tiff" or ".tif" => "image/tiff",
                _ => "image/png"
            };
        }

        /** 画像をロードする */
        public static MascotImageItem[] LoadImages(string Name, string[] ImagePaths)
        {
            Debug.WriteLine($"[ImageLoadHelper] 画像読み込み開始: {Name}");

            // 画像ファイルのパスをフィルタリング（.back.*とtemp_*を除外）
            var filteredPaths = ImagePaths
                .Where(path => !Path.GetFileName(path).Contains(".back."))
                .Where(path => !Path.GetFileName(path).StartsWith("temp_"))
                .ToArray();

            Debug.WriteLine($"[ImageLoadHelper] フィルタリング前: {ImagePaths.Length}個, フィルタリング後: {filteredPaths.Length}個");

            // 画像をロードしてキャッシュに保存する
            var loadedList = new List<MascotImageItem>();
            int index = 0;
            foreach (var path in filteredPaths)
            {
                string fullPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, path);
                Debug.WriteLine($"[ImageLoadHelper] 画像[{index}]を読み込み中: {fullPath}");

                var img = ImageLoadHelper.LoadDrawingImageWithoutLock(fullPath);
                if (img != null)
                {
                    loadedList.Add(new MascotImageItem
                    {
                        ImagePath = fullPath,
                        FileName = System.IO.Path.GetFileName(fullPath),
                    });
                    Debug.WriteLine($"[ImageLoadHelper] 画像[{index}]読み込み成功: {System.IO.Path.GetFileName(fullPath)} (サイズ: {img.Width}x{img.Height})");
                }
                else
                {
                    Debug.WriteLine($"[ImageLoadHelper] 画像[{index}]読み込み失敗: {fullPath}");
                }
                index++;
            }
            return loadedList.ToArray();
        }
    }
}
