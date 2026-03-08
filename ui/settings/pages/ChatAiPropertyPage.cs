using Godot;

namespace DesktopAiMascot.ui.settings.pages
{
    public partial class ChatAiPropertyPage : MarginContainer
    {
        public ChatAiPropertyPage()
        {
            SetAnchorsPreset(Godot.Control.LayoutPreset.FullRect);
            AddChild(new Godot.Label { Text = "Chat AI Settings (WIP)", HorizontalAlignment = Godot.HorizontalAlignment.Center });
        }
    }
}
