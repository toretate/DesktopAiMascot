using System;
using System.Text;

using DesktopAiMascot.mascots;

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

            var app = new System.Windows.Application();
            app.Run(new MascotWindow());
        }
    }
}
