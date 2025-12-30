using System;
using System.Windows.Forms;

namespace DesktopAiMascot
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MascotForm());
        }
    }
}