using System.Drawing;
using System.Windows.Forms;

namespace DesktopAiMascot.Views
{
    partial class ImageAiPropertyPage
    {
        private System.ComponentModel.IContainer components = null;
        private GroupBox imageAiGroupBox;
        private TextBox imageAiUrlTextField;
        private Label imageAiUrlLabel;
        private ComboBox imageAiComboBox;
        private ComboBox imageAiModelComboBox;
        private Label imageAiModelLabel;

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
            imageAiGroupBox = new GroupBox();
            imageAiUrlTextField = new TextBox();
            imageAiUrlLabel = new Label();
            imageAiComboBox = new ComboBox();
            imageAiModelComboBox = new ComboBox();
            imageAiModelLabel = new Label();

            imageAiGroupBox.SuspendLayout();
            SuspendLayout();
            
            // 
            // imageAiGroupBox
            // 
            imageAiGroupBox.Controls.Add(imageAiUrlTextField);
            imageAiGroupBox.Controls.Add(imageAiUrlLabel);
            imageAiGroupBox.Controls.Add(imageAiComboBox);
            imageAiGroupBox.Controls.Add(imageAiModelComboBox);
            imageAiGroupBox.Controls.Add(imageAiModelLabel);
            imageAiGroupBox.Dock = DockStyle.Fill;
            imageAiGroupBox.Location = new Point(0, 0);
            imageAiGroupBox.Name = "imageAiGroupBox";
            imageAiGroupBox.Size = new Size(480, 500);
            imageAiGroupBox.TabIndex = 22;
            imageAiGroupBox.TabStop = false;
            imageAiGroupBox.Text = "Image AI";
            // 
            // imageAiUrlTextField
            // 
            imageAiUrlTextField.Location = new Point(6, 64);
            imageAiUrlTextField.Name = "imageAiUrlTextField";
            imageAiUrlTextField.Size = new Size(168, 23);
            imageAiUrlTextField.TabIndex = 12;
            // 
            // imageAiUrlLabel
            // 
            imageAiUrlLabel.AutoSize = true;
            imageAiUrlLabel.Font = new Font("Yu Gothic UI", 8.25F, FontStyle.Regular, GraphicsUnit.Point, 128);
            imageAiUrlLabel.Location = new Point(6, 48);
            imageAiUrlLabel.Name = "imageAiUrlLabel";
            imageAiUrlLabel.Size = new Size(27, 13);
            imageAiUrlLabel.TabIndex = 11;
            imageAiUrlLabel.Text = "URL";
            // 
            // imageAiComboBox
            // 
            imageAiComboBox.FormattingEnabled = true;
            imageAiComboBox.Location = new Point(6, 22);
            imageAiComboBox.Name = "imageAiComboBox";
            imageAiComboBox.Size = new Size(168, 23);
            imageAiComboBox.TabIndex = 20;
            // 
            // imageAiModelComboBox
            // 
            imageAiModelComboBox.FormattingEnabled = true;
            imageAiModelComboBox.Location = new Point(6, 106);
            imageAiModelComboBox.Name = "imageAiModelComboBox";
            imageAiModelComboBox.Size = new Size(168, 23);
            imageAiModelComboBox.TabIndex = 10;
            // 
            // imageAiModelLabel
            // 
            imageAiModelLabel.AutoSize = true;
            imageAiModelLabel.Font = new Font("Yu Gothic UI", 8.25F, FontStyle.Regular, GraphicsUnit.Point, 128);
            imageAiModelLabel.Location = new Point(6, 90);
            imageAiModelLabel.Name = "imageAiModelLabel";
            imageAiModelLabel.Size = new Size(61, 13);
            imageAiModelLabel.TabIndex = 9;
            imageAiModelLabel.Text = "Checkpoint";
            
            // 
            // ImageAiPropertyPage
            // 
            AutoScaleDimensions = new SizeF(7F, 15F);
            AutoScaleMode = AutoScaleMode.Font;
            Controls.Add(imageAiGroupBox);
            Name = "ImageAiPropertyPage";
            Size = new Size(480, 500);
            imageAiGroupBox.ResumeLayout(false);
            imageAiGroupBox.PerformLayout();
            ResumeLayout(false);
        }
    }
}
