using DesktopAiMascot.mascots;
using Godot;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;

namespace DesktopAiMascot.utils
{
    /// <summary>
    /// 画像読み込みのヘルパークラス (Godot版)
    /// </summary>
    public static class ImageLoadHelper
    {
        public static bool UseImageMagick { get; set; } = false;

        /// <summary>
        /// 画像を読み込む（Godot用）
        /// </summary>
        public static Godot.Texture2D? LoadGodotTexture(string filePath)
        {
            try
            {
                if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
                {
                    return null;
                }

                // Godot の Image で読み込む
                var img = new Godot.Image();
                var err = img.Load(filePath);
                
                if (err == Godot.Error.Ok)
                {
                    return Godot.ImageTexture.CreateFromImage(img);
                }
                
                Debug.WriteLine($"[ImageLoadHelper] 画像読み込みエラー ({filePath}): Godot.Error = {err}");
                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ImageLoadHelper] 画像読み込み例外 ({filePath}): {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 画像ファイル群を読み込む
        /// </summary>
        public static MascotImageItem[] LoadImages(string Name, string[] ImagePaths)
        {
            Debug.WriteLine($"[ImageLoadHelper] 画像読み込み開始: {Name}");

            // 画像ファイルのパスをフィルタリング（.back.*とtemp_*を除外）
            var filteredPaths = ImagePaths
                .Where(path => !System.IO.Path.GetFileName(path).Contains(".back."))
                .Where(path => !System.IO.Path.GetFileName(path).StartsWith("temp_"))
                .ToArray();

            Debug.WriteLine($"[ImageLoadHelper] フィルタリング前: {ImagePaths.Length}個, フィルタリング後: {filteredPaths.Length}個");

            var loadedList = new List<MascotImageItem>();
            
            // Godot実行時のパス解決 (エディタ実行時は .godot/mono/temp/bin/Debug 以下になるため)
            string baseDir;
            if (Godot.OS.HasFeature("editor"))
            {
                baseDir = Godot.ProjectSettings.GlobalizePath("res://");
            }
            else
            {
                baseDir = System.IO.Path.GetDirectoryName(Godot.OS.GetExecutablePath()) ?? AppDomain.CurrentDomain.BaseDirectory;
            }

            int index = 0;
            foreach (var path in filteredPaths)
            {
                string fullPath = System.IO.Path.Combine(baseDir, path);
                Debug.WriteLine($"[ImageLoadHelper] 画像[{index}]を読み込み中: {fullPath}");

                var texture = LoadGodotTexture(fullPath);
                if (texture != null)
                {
                    var item = new MascotImageItem
                    {
                        ImagePath = fullPath,
                        FileName = System.IO.Path.GetFileName(fullPath),
                    };
                    loadedList.Add(item);
                    Debug.WriteLine($"[ImageLoadHelper] 画像[{index}]読み込み成功: {System.IO.Path.GetFileName(fullPath)} (サイズ: {texture.GetWidth()}x{texture.GetHeight()})");
                }
                else
                {
                    Debug.WriteLine($"[ImageLoadHelper] 画像[{index}]読み込み失敗: {fullPath}");
                }
                index++;
            }
            return loadedList.ToArray();
        }

        // --- 旧コードの互換性のためのダミーメソッドやBase64変換など ---

        public static string? LoadImageAsBase64DataUri(string filePath)
        {
            try
            {
                if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath)) return null;
                
                byte[] imageBytes = File.ReadAllBytes(filePath);
                string base64Image = Convert.ToBase64String(imageBytes);
                string extension = Path.GetExtension(filePath).ToLowerInvariant();
                string mimeType = extension switch
                {
                    ".png" => "image/png",
                    ".jpg" or ".jpeg" => "image/jpeg",
                    ".gif" => "image/gif",
                    ".webp" => "image/webp",
                    _ => "image/png"
                };
                return $"data:{mimeType};base64,{base64Image}";
            }
            catch(Exception ex)
            {
                Debug.WriteLine($"[ImageLoadHelper] Base64変換エラー ({filePath}): {ex.Message}");
                return null;
            }
        }

        public static byte[]? ConvertBase64DataUriToBytes(string dataUri)
        {
            try
            {
                if (string.IsNullOrEmpty(dataUri)) return null;

                // "data:image/png;base64," の部分を削除してデコード
                int index = dataUri.IndexOf("base64,");
                if (index >= 0)
                {
                    dataUri = dataUri.Substring(index + 7);
                }
                return Convert.FromBase64String(dataUri);
            }
            catch
            {
                return null;
            }
        }
    }
}
