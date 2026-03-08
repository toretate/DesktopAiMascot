using Godot;

namespace DesktopAiMascot.ui.settings.pages
{
    public partial class ImageAiPropertyPage : MarginContainer
    {
        public ImageAiPropertyPage()
        {
            SetAnchorsPreset(Godot.Control.LayoutPreset.FullRect);
            AddChild(new Godot.Label { Text = "Image AI Settings (WIP)", HorizontalAlignment = Godot.HorizontalAlignment.Center });
        }
    }
}
