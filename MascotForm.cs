using System;
using System.Drawing;
using System.Windows.Forms;

namespace DesktopAiMascot
{
    public partial class MascotForm : Form
    {
        private NotifyIcon notifyIcon;
        private ContextMenuStrip contextMenu;
        private System.Windows.Forms.Timer animationTimer;
        private Mascot mascot;
        private bool isDragging = false;
        private Point dragOffset;

        public MascotForm()
        {
            this.ClientSize = new System.Drawing.Size(200, 200);
            this.Name = "MascotForm";
            this.Text = "Desktop Mascot";
            this.MouseDown += new MouseEventHandler(this.MascotForm_MouseDown);
            this.MouseMove += new MouseEventHandler(this.MascotForm_MouseMove);
            this.MouseUp += new MouseEventHandler(this.MascotForm_MouseUp);

            SetupNotifyIcon();
            SetupAnimation();
            mascot = new Mascot(new Point(50, 50), new Size(50, 50));
            this.ShowInTaskbar = false;
            this.WindowState = FormWindowState.Normal;
            this.FormBorderStyle = FormBorderStyle.None;
            this.BackColor = Color.Magenta;
            this.TransparencyKey = Color.Magenta;
            this.TopMost = true;
            this.Size = new Size(200, 200);
            this.Location = new Point(Screen.PrimaryScreen.WorkingArea.Width - 200, Screen.PrimaryScreen.WorkingArea.Height - 200);
            this.Show();
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

        private void SetupAnimation()
        {
            animationTimer = new System.Windows.Forms.Timer();
            animationTimer.Interval = 500; // Animation speed
            animationTimer.Tick += AnimationTimer_Tick;
            animationTimer.Start();
        }

        private void AnimationTimer_Tick(object sender, EventArgs e)
        {
            mascot.UpdateAnimation();
            this.Invalidate();
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
            notifyIcon.Visible = false;
            Application.Exit();
        }

        private void MascotForm_MouseDown(object sender, MouseEventArgs e)
        {
            if (mascot.IsClicked(e.Location))
            {
                isDragging = true;
                dragOffset = new Point(e.X - mascot.Position.X, e.Y - mascot.Position.Y);
            }
        }

        private void MascotForm_MouseMove(object sender, MouseEventArgs e)
        {
            if (isDragging)
            {
                mascot.MoveTo(new Point(e.X - dragOffset.X, e.Y - dragOffset.Y));
                this.Invalidate();
            }
        }

        private void MascotForm_MouseUp(object sender, MouseEventArgs e)
        {
            isDragging = false;
        }
    }
}