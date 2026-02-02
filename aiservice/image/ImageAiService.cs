using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DesktopAiMascot.aiservice.image
{
    /// <summary>
    /// 画像処理AIサービスのインターフェース
    /// </summary>
    public interface ImageAiService
    {
        /// <summary>
        /// 画像の背景を削除する
        /// </summary>
        /// <param name="imageData">入力画像データ（Base64エンコード文字列）</param>
        /// <returns>背景削除後の画像データ（Base64エンコード文字列）</returns>
        Task<string?> RemoveBackgroundAsync(string imageData);

        /// <summary>
        /// 利用可能なモデルリストを取得する
        /// </summary>
        /// <returns>モデル名の配列</returns>
        Task<string[]> GetAvailableModels();

        /// <summary>
        /// サービス名
        /// </summary>
        string Name { get; }

        /// <summary>
        /// エンドポイントURL
        /// </summary>
        string EndPoint { get; }
    }

    /// <summary>
    /// 画像処理AIサービスの基底クラス
    /// </summary>
    public abstract class ImageAiServiceBase : ImageAiService
    {
        public abstract string Name { get; }
        public abstract string EndPoint { get; }

        public string Url { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;

        public abstract Task<string?> RemoveBackgroundAsync(string imageData);

        public virtual Task<string[]> GetAvailableModels()
        {
            return Task.FromResult(Array.Empty<string>());
        }

        /// <summary>
        /// Base64文字列から画像バイナリデータを取得する
        /// </summary>
        protected byte[] GetImageBytesFromBase64(string base64String)
        {
            // data:image/png;base64, のようなプレフィックスを削除
            if (base64String.Contains(","))
            {
                base64String = base64String.Split(',')[1];
            }
            return Convert.FromBase64String(base64String);
        }

        /// <summary>
        /// 画像バイナリデータをBase64文字列に変換する
        /// </summary>
        protected string ConvertImageToBase64(byte[] imageBytes, string mimeType = "image/png")
        {
            string base64 = Convert.ToBase64String(imageBytes);
            return $"data:{mimeType};base64,{base64}";
        }
    }
}
