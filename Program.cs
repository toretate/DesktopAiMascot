using System;
using System.Text;

using DesktopAiMascot.mascots;
using DesktopAiMascot.utils;

namespace DesktopAiMascot
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            // デバッグコンソールで日本語を正しく表示するためUTF-8に設定
            try
            {
                Console.OutputEncoding = Encoding.UTF8;
                Console.InputEncoding = Encoding.UTF8;
            }
            catch (Exception)
            {
                // コンソールが利用できない環境では無視
            }

            // 画像読み込み設定
            // false: System.Drawing版（高速、起動が速い）
            // true: ImageMagick版（高品質、WebP/HEIF/AVIF対応、透過確実、起動が遅い）
            ImageLoadHelper.UseImageMagick = false; // ★ここを変更してImageMagick版に切り替え可能

            var app = new System.Windows.Application();
            app.Run(new MascotWindow());
        }
    }
}
