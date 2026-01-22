using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace DesktopAiMascot
{
    internal static class DragMoveHelper
    {
        [DllImport("user32.dll")] private static extern bool ReleaseCapture();
        [DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr hWnd, int msg, int wParam, int lParam);
        private const int WM_NCLBUTTONDOWN = 0xA1;
        private const int HTCAPTION = 0x2;

        public static void BeginDragFrom(Control? source)
        {
            if (source == null) return;
            var form = source.FindForm();
            if (form == null) return;
            try
            {
                ReleaseCapture();
                SendMessage(form.Handle, WM_NCLBUTTONDOWN, HTCAPTION, 0);
            }
            catch { }
        }
    }
}
