using System;
using System.Diagnostics;
using System.Threading.Tasks;

namespace DesktopAiMascot.aiservice.image
{
    /// <summary>
    /// ImageMagickを使用した画像背景削除サービス (Local)
    /// </summary>
    internal class ImageMagickService : ImageAiServiceBase
    {
        public override string Name => "ImageMagick";
        public override string EndPoint => "Local";

        public ImageMagickService()
        {
            Url = "Local";
        }

        public override async Task<string?> RemoveBackgroundAsync(string imageData)
        {
            try
            {
                Debug.WriteLine("[ImageMagickService] 背景削除処理を開始");

                // TODO: ImageMagickを使用した実際の背景削除処理を実装
                // magick convert コマンドを使用した背景削除処理
                // 例: magick convert input.png -fuzz 10% -transparent white output.png
                await Task.Delay(500); // 処理をシミュレート

                Debug.WriteLine("[ImageMagickService] 背景削除処理が完了しました");
                return imageData; // ダミー: 入力をそのまま返す
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ImageMagickService] エラー: {ex.Message}");
                return null;
            }
        }

        public override async Task<string[]> GetAvailableModels()
        {
            // ImageMagickは機械学習モデルを使用しないため、処理方法のリストを返す
            await Task.CompletedTask;
            return new[]
            {
                "透明化(Fuzz 10%)",
                "透明化(Fuzz 20%)",
                "クロマキー(白背景)",
                "クロマキー(緑背景)"
            };
        }

        /// <summary>
        /// ImageMagickがインストールされているか確認する
        /// </summary>
        public async Task<bool> IsInstalledAsync()
        {
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "magick",
                        Arguments = "--version",
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                await process.WaitForExitAsync();

                return process.ExitCode == 0;
            }
            catch
            {
                return false;
            }
        }
    }
}
