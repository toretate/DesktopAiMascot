using System.Drawing;
using System.Windows.Forms;

namespace DesktopAiMascot.Views
{
    partial class VoiceAiPropertyPage
    {
        private System.ComponentModel.IContainer components = null;
        private GroupBox voiceAiGroupBox;
        private TextBox voiceAiUrlTextField;
        private ComboBox voiceAiComboBox;
        private Label voiceAiUrlLabel;
        private ComboBox voiceAiSpeakerComboBox;
        private Label voiceAiSpeakerLabel;
        private ComboBox voiceAiModelComboBox;
        private Label voiceAiModelLabel;

        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        private void InitializeComponent()
        {
            voiceAiGroupBox = new GroupBox();
            voiceAiUrlTextField = new TextBox();
            voiceAiComboBox = new ComboBox();
            voiceAiUrlLabel = new Label();
            voiceAiSpeakerComboBox = new ComboBox();
            voiceAiSpeakerLabel = new Label();
            voiceAiModelComboBox = new ComboBox();
            voiceAiModelLabel = new Label();

            voiceAiGroupBox.SuspendLayout();
            SuspendLayout();
            
            // 
            // voiceAiGroupBox
            // 
            voiceAiGroupBox.Controls.Add(voiceAiUrlTextField);
            voiceAiGroupBox.Controls.Add(voiceAiComboBox);
            voiceAiGroupBox.Controls.Add(voiceAiUrlLabel);
            voiceAiGroupBox.Controls.Add(voiceAiSpeakerComboBox);
            voiceAiGroupBox.Controls.Add(voiceAiSpeakerLabel);
            voiceAiGroupBox.Controls.Add(voiceAiModelComboBox);
            voiceAiGroupBox.Controls.Add(voiceAiModelLabel);
            voiceAiGroupBox.Dock = DockStyle.Fill;
            voiceAiGroupBox.Location = new Point(0, 0);
            voiceAiGroupBox.Name = "voiceAiGroupBox";
            voiceAiGroupBox.Size = new Size(480, 500);
            voiceAiGroupBox.TabIndex = 21;
            voiceAiGroupBox.TabStop = false;
            voiceAiGroupBox.Text = "Voice AI";
            // 
            // voiceAiUrlTextField
            // 
            voiceAiUrlTextField.Location = new Point(6, 64);
            voiceAiUrlTextField.Name = "voiceAiUrlTextField";
            voiceAiUrlTextField.Size = new Size(168, 23);
            voiceAiUrlTextField.TabIndex = 12;
            // 
            // voiceAiComboBox
            // 
            voiceAiComboBox.FormattingEnabled = true;
            voiceAiComboBox.Location = new Point(6, 22);
            voiceAiComboBox.Name = "voiceAiComboBox";
            voiceAiComboBox.Size = new Size(168, 23);
            voiceAiComboBox.TabIndex = 18;
            // 
            // voiceAiUrlLabel
            // 
            voiceAiUrlLabel.AutoSize = true;
            voiceAiUrlLabel.Font = new Font("Yu Gothic UI", 8.25F, FontStyle.Regular, GraphicsUnit.Point, 128);
            voiceAiUrlLabel.Location = new Point(6, 48);
            voiceAiUrlLabel.Name = "voiceAiUrlLabel";
            voiceAiUrlLabel.Size = new Size(27, 13);
            voiceAiUrlLabel.TabIndex = 11;
            voiceAiUrlLabel.Text = "URL";
            // 
            // voiceAiSpeakerComboBox
            // 
            voiceAiSpeakerComboBox.FormattingEnabled = true;
            voiceAiSpeakerComboBox.Location = new Point(6, 148);
            voiceAiSpeakerComboBox.Name = "voiceAiSpeakerComboBox";
            voiceAiSpeakerComboBox.Size = new Size(168, 23);
            voiceAiSpeakerComboBox.TabIndex = 10;
            // 
            // voiceAiSpeakerLabel
            // 
            voiceAiSpeakerLabel.AutoSize = true;
            voiceAiSpeakerLabel.Font = new Font("Yu Gothic UI", 8.25F, FontStyle.Regular, GraphicsUnit.Point, 128);
            voiceAiSpeakerLabel.Location = new Point(6, 132);
            voiceAiSpeakerLabel.Name = "voiceAiSpeakerLabel";
            voiceAiSpeakerLabel.Size = new Size(46, 13);
            voiceAiSpeakerLabel.TabIndex = 9;
            voiceAiSpeakerLabel.Text = "Speaker";
            // 
            // voiceAiModelComboBox
            // 
            voiceAiModelComboBox.FormattingEnabled = true;
            voiceAiModelComboBox.Location = new Point(6, 106);
            voiceAiModelComboBox.Name = "voiceAiModelComboBox";
            voiceAiModelComboBox.Size = new Size(168, 23);
            voiceAiModelComboBox.TabIndex = 10;
            // 
            // voiceAiModelLabel
            // 
            voiceAiModelLabel.AutoSize = true;
            voiceAiModelLabel.Font = new Font("Yu Gothic UI", 8.25F, FontStyle.Regular, GraphicsUnit.Point, 128);
            voiceAiModelLabel.Location = new Point(6, 90);
            voiceAiModelLabel.Name = "voiceAiModelLabel";
            voiceAiModelLabel.Size = new Size(51, 13);
            voiceAiModelLabel.TabIndex = 9;
            voiceAiModelLabel.Text = "AI Model";

            // 
            // VoiceAiPropertyPage
            // 
            AutoScaleDimensions = new SizeF(7F, 15F);
            AutoScaleMode = AutoScaleMode.Font;
            Controls.Add(voiceAiGroupBox);
            Name = "VoiceAiPropertyPage";
            Size = new Size(480, 500);
            voiceAiGroupBox.ResumeLayout(false);
            voiceAiGroupBox.PerformLayout();
            ResumeLayout(false);
        }
    }
}
