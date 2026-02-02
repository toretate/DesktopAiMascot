using System;
using System.Drawing;
using System.IO;
using System.Windows.Media.Imaging;
using System.Diagnostics;

namespace DesktopAiMascot.utils
{
    /// <summary>
    /// 画像読み込みのヘルパークラス
    /// ファイルロックを発生させずに画像を読み込むためのユーティリティ
    /// </summary>
    public static class ImageLoadHelper
    {
        /// <summary>
        /// WPF用: ファイルロックを発生させずにBitmapSourceを読み込む
        /// </summary>
        /// <param name="filePath">画像ファイルのパス</param>
        /// <returns>読み込まれたBitmapSource（BitmapImageまたはBitmapFrame）、失敗時はnull</returns>
        public static BitmapSource? LoadBitmapImageWithoutLock(string filePath)
        {
            try
            {
                if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
                {
                    return null;
                }

                using (var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    // 適切なデコーダーを使用（自動判定）
                    var decoder = BitmapDecoder.Create(stream, BitmapCreateOptions.PreservePixelFormat, BitmapCacheOption.OnLoad);
                    var frame = decoder.Frames[0];
                    
                    // Freezeしてスレッドセーフにする
                    frame.Freeze();
                    return frame;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ImageLoadHelper] BitmapImage読み込みエラー ({filePath}): {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// System.Drawing用: ファイルロックを発生させずにImageを読み込む
        /// </summary>
        /// <param name="filePath">画像ファイルのパス</param>
        /// <returns>読み込まれたImage、失敗時はnull</returns>
        public static Image? LoadDrawingImageWithoutLock(string filePath)
        {
            try
            {
                if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
                {
                    return null;
                }

                // ファイルロックを避けるため、FileStreamを使用してメモリにコピー
                using (var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                using (var memoryStream = new MemoryStream())
                {
                    fileStream.CopyTo(memoryStream);
                    memoryStream.Position = 0;
                    return Image.FromStream(memoryStream);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ImageLoadHelper] Drawing.Image読み込みエラー ({filePath}): {ex.Message}");
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
                _ => "image/png"
            };
        }
    }
}
