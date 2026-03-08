using Godot;

namespace DesktopAiMascot.ui.settings.pages
{
    public partial class VoiceAiPropertyPage : MarginContainer
    {
        public VoiceAiPropertyPage()
        {
            SetAnchorsPreset(Godot.Control.LayoutPreset.FullRect);
            AddChild(new Godot.Label { Text = "Voice AI Settings (WIP)", HorizontalAlignment = Godot.HorizontalAlignment.Center });
        }
    }
}
