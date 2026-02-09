using System;
using System.Windows.Controls;
using System.Windows.Input;

namespace DesktopAiMascot.views
{
    public partial class AngleViewControl : System.Windows.Controls.UserControl
    {
        public event MouseButtonEventHandler? LeftImageClick;
        public event MouseButtonEventHandler? RightImageClick;
        public event MouseButtonEventHandler? AboveImageClick;
        public event MouseButtonEventHandler? BelowImageClick;
        public event MouseButtonEventHandler? BehindImageClick;

        public AngleViewControl()
        {
            InitializeComponent();
        }

        public System.Windows.Controls.Image FrontImage => frontImage;
        public System.Windows.Controls.Image LeftImage => leftImage;
        public System.Windows.Controls.Image RightImage => rightImage;
        public System.Windows.Controls.Image AboveImage => aboveImage;
        public System.Windows.Controls.Image BelowImage => belowImage;
        public System.Windows.Controls.Image BehindImage => behindImage;
        public System.Windows.Controls.ComboBox ImageModelComboBox => imageModelComboBox;

        public void SetAngleStatus(string angle, string? status)
        {
            var targetName = angle switch
            {
                "left" => "leftStatusText",
                "right" => "rightStatusText",
                "above" => "aboveStatusText",
                "below" => "belowStatusText",
                "behind" => "behindStatusText",
                _ => null
            };

            if (string.IsNullOrEmpty(targetName))
            {
                return;
            }

            if (FindName(targetName) is not TextBlock target)
            {
                return;
            }

            if (string.IsNullOrWhiteSpace(status))
            {
                target.Text = string.Empty;
                target.Visibility = System.Windows.Visibility.Collapsed;
                return;
            }

            target.Text = status;
            target.Visibility = System.Windows.Visibility.Visible;
        }

        private void LeftImage_Click(object sender, MouseButtonEventArgs e)
        {
            LeftImageClick?.Invoke(this, e);
        }

        private void RightImage_Click(object sender, MouseButtonEventArgs e)
        {
            RightImageClick?.Invoke(this, e);
        }

        private void AboveImage_Click(object sender, MouseButtonEventArgs e)
        {
            AboveImageClick?.Invoke(this, e);
        }

        private void BelowImage_Click(object sender, MouseButtonEventArgs e)
        {
            BelowImageClick?.Invoke(this, e);
        }

        private void BehindImage_Click(object sender, MouseButtonEventArgs e)
        {
            BehindImageClick?.Invoke(this, e);
        }
    }
}
