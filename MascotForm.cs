using Microsoft.VisualBasic.Logging;
using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace DesktopAiMascot
{
    public partial class MascotForm : Form
    {
        private NotifyIcon notifyIcon;
        private ContextMenuStrip contextMenu;
        private Mascot mascot;
        private bool isDragging = false;
        private Point dragOffset;
        private Point mouseDownOffset; // offset of mouse within the form when starting drag

        private readonly string settingsPath;

        // Click vs drag detection
        private Point dragStartScreen;
        private bool potentialClick = false;
        private const int ClickMoveThreshold = 5; // pixels

        // Speech bubble / input is handled by InteractionPanel
        private string bubbleText = string.Empty;
        private bool bubbleVisible = false;

        private InteractionPanel interactionPanel;

        public MascotForm()
        {
            // settings file in AppData
            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            string appDir = Path.Combine(appData, "DesktopAiMascot");
            settingsPath = Path.Combine(appDir, "settings.txt");

            // Enable double buffering and reduce background erasing to prevent flicker
            this.SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint, true);
            this.UpdateStyles();

            // Display mascot image at 1024x768 (use one-third size here)
            int imageWidth = 768 /3;
            int imageHeight = 1024 /3;

            this.ClientSize = new System.Drawing.Size(imageWidth + 220, imageHeight); // extra width for interaction panel
            this.Name = "MascotForm";
            this.Text = "Desktop Mascot";
            this.MouseDown += new MouseEventHandler(this.MascotForm_MouseDown);
            this.MouseMove += new MouseEventHandler(this.MascotForm_MouseMove);
            this.MouseUp += new MouseEventHandler(this.MascotForm_MouseUp);

            SetupNotifyIcon();
            // Place mascot at top-right area of the form and size it
            mascot = new Mascot(new Point(220, 0), new Size(imageWidth, imageHeight));
            this.ShowInTaskbar = false;
            this.WindowState = FormWindowState.Normal;
            this.FormBorderStyle = FormBorderStyle.None;
            this.TopMost = true;
            // Use painting for semi-transparent background instead of whole-window Opacity
            // this.Opacity = 0.5;
            this.Size = new Size(imageWidth + 220, imageHeight);

            // Ensure Windows doesn't override our Location when the form is first shown
            this.StartPosition = FormStartPosition.Manual;

            // Create interaction panel on the left side
            interactionPanel = new InteractionPanel();
            interactionPanel.Size = new Size(210, imageHeight);
            interactionPanel.Location = new Point(4, 0);
            interactionPanel.Anchor = AnchorStyles.Left | AnchorStyles.Top | AnchorStyles.Bottom;
            this.Controls.Add(interactionPanel);

            this.BackColor = Color.LimeGreen;
            this.TransparencyKey = this.BackColor;

            // Do not set Location here; OnLoad will apply saved location so it's not overwritten by framework.
        }

        protected override void OnLoad(EventArgs e)
        {
            base.OnLoad(e);

            // Try to load saved location; if not present, position at bottom-right of the screen that currently contains the mouse cursor
            Point? saved = LoadSavedLocation();
            Rectangle virtualBounds = SystemInformation.VirtualScreen;
            if (saved.HasValue)
            {
                Point loc = saved.Value;
                // Clamp to virtual screen so window remains visible
                if (loc.X < virtualBounds.Left) loc.X = virtualBounds.Left;
                if (loc.Y < virtualBounds.Top) loc.Y = virtualBounds.Top;
                if (loc.X + this.Width > virtualBounds.Right) loc.X = virtualBounds.Right - this.Width;
                if (loc.Y + this.Height > virtualBounds.Bottom) loc.Y = virtualBounds.Bottom - this.Height;

                this.Location = loc;
                Console.WriteLine($"Applied saved location to form: {loc.X},{loc.Y}");
            }
            else
            {
                Screen targetScreen;
                try
                {
                    targetScreen = Screen.FromPoint(Cursor.Position);
                }
                catch
                {
                    targetScreen = Screen.PrimaryScreen;
                }

                Rectangle wa = targetScreen.WorkingArea;
                int x = wa.Right - this.Width;
                int y = wa.Bottom - this.Height;
                // Clamp to ensure the form is at least partially visible
                if (x < wa.Left) x = wa.Left;
                if (y < wa.Top) y = wa.Top;

                this.Location = new Point(x, y);
                Console.WriteLine($"Applied default location to form: {this.Location.X},{this.Location.Y}");
            }
        }

        private void SetupNotifyIcon()
        {
            notifyIcon = new NotifyIcon();
            notifyIcon.Icon = SystemIcons.Application; // Replace with actual mascot icon
            notifyIcon.Text = "Desktop Mascot";
            contextMenu = new ContextMenuStrip();
            contextMenu.Items.Add("Show", null, ShowMascot);
            contextMenu.Items.Add("Hide", null, HideMascot);
            contextMenu.Items.Add("Exit", null, ExitApplication);
            notifyIcon.ContextMenuStrip = contextMenu;
            notifyIcon.Visible = true;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            mascot.Draw(e.Graphics);
        }


        private void ShowMascot(object sender, EventArgs e)
        {
            this.WindowState = FormWindowState.Normal;
            this.Show();
        }

        private void HideMascot(object sender, EventArgs e)
        {
            this.WindowState = FormWindowState.Minimized;
            this.Hide();
        }

        private void ExitApplication(object sender, EventArgs e)
        {
            // Close the form so OnFormClosing runs and disposes resources
            this.Close();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            // Save location and dispose mascot and notify icon resources
            try
            {
                SaveLocation(this.Location);
            }
            catch { }

            try
            {
                mascot?.Dispose();
            }
            catch { }

            try
            {
                if (notifyIcon != null)
                {
                    notifyIcon.Visible = false;
                    notifyIcon.Dispose();
                }
            }
            catch { }

            base.OnFormClosing(e);
        }

        private void MascotForm_MouseDown(object sender, MouseEventArgs e)
        {
            if (mascot.IsClicked(e.Location))
            {
                // prepare for possible click; record starting screen position
                potentialClick = true;
                dragStartScreen = Control.MousePosition;
                // store offset of mouse inside the form for dragging
                mouseDownOffset = new Point(e.X, e.Y);
                // capture mouse so we receive MouseUp even if released outside the form
                this.Capture = true;
            }
        }

        private void MascotForm_MouseMove(object sender, MouseEventArgs e)
        {
            if (!isDragging && potentialClick)
            {
                // if mouse moved more than threshold since MouseDown, it's a drag
                Point current = Control.MousePosition;
                if (Math.Abs(current.X - dragStartScreen.X) > ClickMoveThreshold || Math.Abs(current.Y - dragStartScreen.Y) > ClickMoveThreshold)
                {
                    isDragging = true;
                    potentialClick = false;
                }
            }

            if (isDragging)
            {
                // Move the whole form so the mascot can be placed anywhere on the desktop
                Point mouseScreen = Control.MousePosition;
                Point newLocation = new Point(mouseScreen.X - mouseDownOffset.X, mouseScreen.Y - mouseDownOffset.Y);

                // Allow moving across monitors. Optionally clamp to the virtual screen bounds so the form doesn't go completely off-screen.
                Rectangle virtualBounds = SystemInformation.VirtualScreen;
                if (newLocation.X < virtualBounds.Left) newLocation.X = virtualBounds.Left;
                if (newLocation.Y < virtualBounds.Top) newLocation.Y = virtualBounds.Top;
                if (newLocation.X + this.Width > virtualBounds.Right) newLocation.X = virtualBounds.Right - this.Width;
                if (newLocation.Y + this.Height > virtualBounds.Bottom) newLocation.Y = virtualBounds.Bottom - this.Height;

                this.Location = newLocation;
                // Invalidate to redraw the mascot in new location
                this.Invalidate();
            }
        }

        private void MascotForm_MouseUp(object sender, MouseEventArgs e)
        {
            if (potentialClick && !isDragging)
            {
                // treat as click: show interaction panel input box
                interactionPanel?.ShowInput();
            }

            if (isDragging)
            {
                isDragging = false;
                // release capture and save location
                this.Capture = false;
                try
                {
                    SaveLocation(this.Location);
                }
                catch { }
            }
            potentialClick = false;
        }

        protected override void OnMouseCaptureChanged(EventArgs e)
        {
            base.OnMouseCaptureChanged(e);
            // If capture was lost while dragging (mouse released outside), ensure we stop dragging and save
            if (isDragging && !this.Capture)
            {
                isDragging = false;
                try { SaveLocation(this.Location); } catch { }
            }
        }

        private Point? LoadSavedLocation()
        {
            try
            {
                if (!File.Exists(settingsPath)) return null;
                string txt = File.ReadAllText(settingsPath).Trim();
                if (string.IsNullOrEmpty(txt)) return null;
                var parts = txt.Split(',');
                if (parts.Length != 2) return null;
                if (int.TryParse(parts[0], out int x) && int.TryParse(parts[1], out int y))
                {
                    Console.WriteLine($"Loaded saved location: {x},{y}");
                    return new Point(x, y);
                }
            }
            catch { }
            return null;
        }

        private void SaveLocation(Point p)
        {
            try
            {
                string dir = Path.GetDirectoryName(settingsPath) ?? string.Empty;
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                File.WriteAllText(settingsPath, $"{p.X},{p.Y}");
                Console.WriteLine($"Saved location: {p.X},{p.Y} to {settingsPath}");
            }
            catch { }
        }

    }
}