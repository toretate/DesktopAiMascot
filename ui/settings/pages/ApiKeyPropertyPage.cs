using Godot;

namespace DesktopAiMascot.ui.settings.pages
{
    public partial class ApiKeyPropertyPage : MarginContainer
    {
        public ApiKeyPropertyPage()
        {
            SetAnchorsPreset(Godot.Control.LayoutPreset.FullRect);
            AddChild(new Godot.Label { Text = "API Key Settings (WIP)", HorizontalAlignment = Godot.HorizontalAlignment.Center });
        }
    }
}
