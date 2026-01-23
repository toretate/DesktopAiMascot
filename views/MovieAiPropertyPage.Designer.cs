using System.Drawing;
using System.Windows.Forms;

namespace DesktopAiMascot.Views
{
    partial class MovieAiPropertyPage
    {
        private System.ComponentModel.IContainer components = null;
        private GroupBox movieAiGroupBox;
        private ComboBox movieAiComboBox;
        private TextBox movieAiUrlTextField;
        private Label movieAiUrlLabel;
        private ComboBox movieAiModelComboBox;
        private Label moveiAiModelLabel;

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
            movieAiGroupBox = new GroupBox();
            movieAiComboBox = new ComboBox();
            movieAiUrlTextField = new TextBox();
            movieAiUrlLabel = new Label();
            movieAiModelComboBox = new ComboBox();
            moveiAiModelLabel = new Label();

            movieAiGroupBox.SuspendLayout();
            SuspendLayout();
            // 
            // movieAiGroupBox
            // 
            movieAiGroupBox.Controls.Add(movieAiComboBox);
            movieAiGroupBox.Controls.Add(movieAiUrlTextField);
            movieAiGroupBox.Controls.Add(movieAiUrlLabel);
            movieAiGroupBox.Controls.Add(movieAiModelComboBox);
            movieAiGroupBox.Controls.Add(moveiAiModelLabel);
            movieAiGroupBox.Dock = DockStyle.Fill;
            movieAiGroupBox.Location = new Point(0, 0);
            movieAiGroupBox.Name = "movieAiGroupBox";
            movieAiGroupBox.Size = new Size(480, 500);
            movieAiGroupBox.TabIndex = 23;
            movieAiGroupBox.TabStop = false;
            movieAiGroupBox.Text = "Movie AI";
            // 
            // movieAiComboBox
            // 
            movieAiComboBox.FormattingEnabled = true;
            movieAiComboBox.Location = new Point(6, 22);
            movieAiComboBox.Name = "movieAiComboBox";
            movieAiComboBox.Size = new Size(168, 23);
            movieAiComboBox.TabIndex = 22;
            // 
            // movieAiUrlTextField
            // 
            movieAiUrlTextField.Location = new Point(6, 64);
            movieAiUrlTextField.Name = "movieAiUrlTextField";
            movieAiUrlTextField.Size = new Size(168, 23);
            movieAiUrlTextField.TabIndex = 12;
            // 
            // movieAiUrlLabel
            // 
            movieAiUrlLabel.AutoSize = true;
            movieAiUrlLabel.Font = new Font("Yu Gothic UI", 8.25F, FontStyle.Regular, GraphicsUnit.Point, 128);
            movieAiUrlLabel.Location = new Point(6, 48);
            movieAiUrlLabel.Name = "movieAiUrlLabel";
            movieAiUrlLabel.Size = new Size(27, 13);
            movieAiUrlLabel.TabIndex = 11;
            movieAiUrlLabel.Text = "URL";
            // 
            // movieAiModelComboBox
            // 
            movieAiModelComboBox.FormattingEnabled = true;
            movieAiModelComboBox.Location = new Point(6, 106);
            movieAiModelComboBox.Name = "movieAiModelComboBox";
            movieAiModelComboBox.Size = new Size(168, 23);
            movieAiModelComboBox.TabIndex = 10;
            // 
            // moveiAiModelLabel
            // 
            moveiAiModelLabel.AutoSize = true;
            moveiAiModelLabel.Font = new Font("Yu Gothic UI", 8.25F, FontStyle.Regular, GraphicsUnit.Point, 128);
            moveiAiModelLabel.Location = new Point(6, 90);
            moveiAiModelLabel.Name = "moveiAiModelLabel";
            moveiAiModelLabel.Size = new Size(61, 13);
            moveiAiModelLabel.TabIndex = 9;
            moveiAiModelLabel.Text = "Checkpoint";
            
            // 
            // MovieAiPropertyPage
            // 
            AutoScaleDimensions = new SizeF(7F, 15F);
            AutoScaleMode = AutoScaleMode.Font;
            Controls.Add(movieAiGroupBox);
            Name = "MovieAiPropertyPage";
            Size = new Size(480, 500);
            movieAiGroupBox.ResumeLayout(false);
            movieAiGroupBox.PerformLayout();
            ResumeLayout(false);
        }
    }
}
