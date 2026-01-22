using System;
using System.Text;
using System.Windows.Forms;

using DesktopAiMascot.mascots;

namespace DesktopAiMascot
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            // デバッグコンソールで日本語を正しく表示するためUTF-8に設定
            Console.OutputEncoding = Encoding.UTF8;
            Console.InputEncoding = Encoding.UTF8;

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            Application.Run(new MascotForm());
        }
    }
}