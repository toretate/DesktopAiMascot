using System.Drawing;
using System.Windows.Forms;

namespace DesktopAiMascot.Views
{
    partial class ChatAiPropertyPage
    {
        private System.ComponentModel.IContainer components = null;
        private GroupBox chatAiGroupBox;
        private TextBox chatAiUrlTextField;
        private Label chatAiUrlLabel;
        private ComboBox chatAiModelComboBox;
        private Label chatAiModelLabel;
        private ComboBox llmAiEngineComboBox;

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
            chatAiGroupBox = new GroupBox();
            chatAiUrlTextField = new TextBox();
            chatAiUrlLabel = new Label();
            chatAiModelComboBox = new ComboBox();
            chatAiModelLabel = new Label();
            llmAiEngineComboBox = new ComboBox();

            chatAiGroupBox.SuspendLayout();
            SuspendLayout();
            // 
            // chatAiGroupBox
            // 
            chatAiGroupBox.Controls.Add(chatAiUrlTextField);
            chatAiGroupBox.Controls.Add(chatAiUrlLabel);
            chatAiGroupBox.Controls.Add(chatAiModelComboBox);
            chatAiGroupBox.Controls.Add(chatAiModelLabel);
            chatAiGroupBox.Controls.Add(llmAiEngineComboBox);
            chatAiGroupBox.Dock = DockStyle.Fill;
            chatAiGroupBox.Location = new Point(0, 0);
            chatAiGroupBox.Name = "chatAiGroupBox";
            chatAiGroupBox.Size = new Size(480, 500);
            chatAiGroupBox.TabIndex = 20;
            chatAiGroupBox.TabStop = false;
            chatAiGroupBox.Text = "Chat AI";
            // 
            // chatAiUrlTextField
            // 
            chatAiUrlTextField.Location = new Point(6, 64);
            chatAiUrlTextField.Name = "chatAiUrlTextField";
            chatAiUrlTextField.Size = new Size(168, 23);
            chatAiUrlTextField.TabIndex = 12;
            // 
            // chatAiUrlLabel
            // 
            chatAiUrlLabel.AutoSize = true;
            chatAiUrlLabel.Font = new Font("Yu Gothic UI", 8.25F, FontStyle.Regular, GraphicsUnit.Point, 128);
            chatAiUrlLabel.Location = new Point(6, 48);
            chatAiUrlLabel.Name = "chatAiUrlLabel";
            chatAiUrlLabel.Size = new Size(27, 13);
            chatAiUrlLabel.TabIndex = 11;
            chatAiUrlLabel.Text = "URL";
            // 
            // chatAiModelComboBox
            // 
            chatAiModelComboBox.FormattingEnabled = true;
            chatAiModelComboBox.Location = new Point(6, 106);
            chatAiModelComboBox.Name = "chatAiModelComboBox";
            chatAiModelComboBox.Size = new Size(168, 23);
            chatAiModelComboBox.TabIndex = 10;
            // 
            // chatAiModelLabel
            // 
            chatAiModelLabel.AutoSize = true;
            chatAiModelLabel.Font = new Font("Yu Gothic UI", 8.25F, FontStyle.Regular, GraphicsUnit.Point, 128);
            chatAiModelLabel.Location = new Point(6, 90);
            chatAiModelLabel.Name = "chatAiModelLabel";
            chatAiModelLabel.Size = new Size(51, 13);
            chatAiModelLabel.TabIndex = 9;
            chatAiModelLabel.Text = "AI Model";
            // 
            // llmAiEngineComboBox
            // 
            llmAiEngineComboBox.DisplayMember = "Name";
            llmAiEngineComboBox.FormattingEnabled = true;
            llmAiEngineComboBox.Location = new Point(6, 22);
            llmAiEngineComboBox.Name = "llmAiEngineComboBox";
            llmAiEngineComboBox.Size = new Size(168, 23);
            llmAiEngineComboBox.TabIndex = 8;
            llmAiEngineComboBox.SelectedIndexChanged += llmAiEngineComboBox_SelectedIndexChanged;
            
            // 
            // ChatAiPropertyPage
            // 
            AutoScaleDimensions = new SizeF(7F, 15F);
            AutoScaleMode = AutoScaleMode.Font;
            Controls.Add(chatAiGroupBox);
            Name = "ChatAiPropertyPage";
            Size = new Size(480, 500);
            chatAiGroupBox.ResumeLayout(false);
            chatAiGroupBox.PerformLayout();
            ResumeLayout(false);
        }
    }
}
