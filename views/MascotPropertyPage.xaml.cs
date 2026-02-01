using System;
using System.Windows.Controls;
using DesktopAiMascot.mascots;

namespace DesktopAiMascot.views
{
    public partial class MascotPropertyPage : System.Windows.Controls.UserControl
    {
        // マスコット変更時のイベント
        public event EventHandler<MascotModel>? MascotChanged;

        public MascotPropertyPage()
        {
            InitializeComponent();
        }

        protected virtual void OnMascotChanged(MascotModel mascotModel)
        {
            MascotChanged?.Invoke(this, mascotModel);
        }
    }
}
