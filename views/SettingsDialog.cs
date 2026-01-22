using System;
using System.Drawing;
using System.Windows.Forms;

namespace DesktopAiMascot.Views
{
    public class SettingsDialog : Form
    {
        private readonly SettingsForm settingsForm;

        public SettingsDialog(SettingsForm content)
        {
            settingsForm = content;
            this.Text = "Settings";
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.StartPosition = FormStartPosition.CenterParent;
            this.MinimizeBox = false;
            this.MaximizeBox = false;
            this.ShowInTaskbar = false;
            this.Size = new Size(500, 600);
            this.TopMost = true; // ensure dialog stays above mascot form

            settingsForm.Dock = DockStyle.Fill;
            this.Controls.Add(settingsForm);

            // Close when the embedded control requests closing
            settingsForm.CloseRequested += (s, e) => this.Close();

            // Bring to front and activate on show
            this.Shown += (s, e) =>
            {
                try { this.BringToFront(); this.Activate(); } catch { }
            };
        }
    }
}
