using System;
using System.Threading;
using System.Windows.Forms;
using Godot;
using Application = System.Windows.Forms.Application;

namespace DesktopAiMascot
{
    public class MascotTrayIcon : IDisposable
    {
        private NotifyIcon? _notifyIcon;
        private ContextMenuStrip? _contextMenu;
        private Thread? _trayThread;
        private bool _isDisposed = false;
        private Action? _onSettingsRequested;

        public MascotTrayIcon(Action? onSettingsRequested = null)
        {
            _onSettingsRequested = onSettingsRequested;

            // Godotエディタ実行時はWinFormsライブラリがロードされずクラッシュするためスキップ
            if (Godot.OS.HasFeature("editor"))
            {
                Godot.GD.Print("[MascotTrayIcon] エディタ実行時のためトレイアイコンの起動をスキップします。");
                return;
            }

            // WinForms のメッセージループを専用のスレッド (STA) で起動
            _trayThread = new Thread(RunTrayIcon);
            _trayThread.SetApartmentState(ApartmentState.STA);
            _trayThread.IsBackground = true;
            _trayThread.Start();
        }

        private void RunTrayIcon()
        {
            _notifyIcon = new NotifyIcon();
            _notifyIcon.Icon = System.Drawing.SystemIcons.Application;
            _notifyIcon.Text = "Desktop Mascot";

            _contextMenu = new ContextMenuStrip();
            _contextMenu.Items.Add("表示", null, (s, e) => CallDeferredShow());
            _contextMenu.Items.Add("非表示", null, (s, e) => CallDeferredHide());
            _contextMenu.Items.Add("設定", null, (s, e) => CallDeferredSettings());
            _contextMenu.Items.Add(new ToolStripSeparator());
            _contextMenu.Items.Add("終了", null, (s, e) => CallDeferredExit());

            _notifyIcon.ContextMenuStrip = _contextMenu;
            _notifyIcon.Visible = true;

            Application.Run();
        }

        private void CallDeferredShow()
        {
            Callable.From(() => {
                var root = ((SceneTree)Engine.GetMainLoop()).Root;
                root.GetWindow().Show();
                DisplayServer.WindowSetMode(DisplayServer.WindowMode.Windowed);
            }).CallDeferred();
        }

        private void CallDeferredHide()
        {
            Callable.From(() => {
                var root = ((SceneTree)Engine.GetMainLoop()).Root;
                root.GetWindow().Hide();
            }).CallDeferred();
        }

        private void CallDeferredSettings()
        {
            Callable.From(() => {
                _onSettingsRequested?.Invoke();
            }).CallDeferred();
        }

        private void CallDeferredExit()
        {
            Callable.From(() => {
                if (Engine.GetMainLoop() is SceneTree tree)
                    tree.Quit();
            }).CallDeferred();
        }

        public void Dispose()
        {
            if (!_isDisposed)
            {
                _isDisposed = true;
                if (_notifyIcon != null)
                {
                    _notifyIcon.Visible = false;
                    _notifyIcon.Dispose();
                }
                if (_contextMenu != null)
                {
                    _contextMenu.Dispose();
                }
                Application.ExitThread();
            }
        }
    }
}
