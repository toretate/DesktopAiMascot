using Godot;

namespace DesktopAiMascot.ui.settings.pages
{
    public partial class MovieAiPropertyPage : MarginContainer
    {
        public MovieAiPropertyPage()
        {
            SetAnchorsPreset(Godot.Control.LayoutPreset.FullRect);
            AddChild(new Godot.Label { Text = "Movie AI Settings (WIP)", HorizontalAlignment = Godot.HorizontalAlignment.Center });
        }
    }
}
