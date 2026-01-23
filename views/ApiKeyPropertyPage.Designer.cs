using System.Drawing;
using System.Windows.Forms;

namespace DesktopAiMascot.Views
{
    partial class ApiKeyPropertyPage
    {
        private System.ComponentModel.IContainer components = null;
        private GroupBox groupBox1;
        private TextBox apiKeyTextBox;
        private Button saveApiKeyButton;
        private Button clearApiKeyButton;

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
            groupBox1 = new GroupBox();
            apiKeyTextBox = new TextBox();
            saveApiKeyButton = new Button();
            clearApiKeyButton = new Button();

            groupBox1.SuspendLayout();
            SuspendLayout();
            // 
            // groupBox1
            // 
            groupBox1.Controls.Add(apiKeyTextBox);
            groupBox1.Controls.Add(saveApiKeyButton);
            groupBox1.Controls.Add(clearApiKeyButton);
            groupBox1.Dock = DockStyle.Fill;
            groupBox1.Location = new Point(0, 0);
            groupBox1.Name = "groupBox1";
            groupBox1.Size = new Size(480, 500);
            groupBox1.TabIndex = 16;
            groupBox1.TabStop = false;
            groupBox1.Text = "API Key";
            // 
            // apiKeyTextBox
            // 
            apiKeyTextBox.AllowDrop = true;
            apiKeyTextBox.Location = new Point(6, 22);
            apiKeyTextBox.Name = "apiKeyTextBox";
            apiKeyTextBox.PlaceholderText = "Google API KEY";
            apiKeyTextBox.Size = new Size(168, 23);
            apiKeyTextBox.TabIndex = 12;
            // 
            // saveApiKeyButton
            // 
            saveApiKeyButton.Location = new Point(6, 52);
            saveApiKeyButton.Name = "saveApiKeyButton";
            saveApiKeyButton.Size = new Size(75, 23);
            saveApiKeyButton.TabIndex = 13;
            saveApiKeyButton.Text = "Save";
            saveApiKeyButton.UseVisualStyleBackColor = true;
            saveApiKeyButton.Click += saveApiKeyButton_Click;
            // 
            // clearApiKeyButton
            // 
            clearApiKeyButton.Location = new Point(99, 52);
            clearApiKeyButton.Name = "clearApiKeyButton";
            clearApiKeyButton.Size = new Size(75, 23);
            clearApiKeyButton.TabIndex = 14;
            clearApiKeyButton.Text = "Clear";
            clearApiKeyButton.UseVisualStyleBackColor = true;
            clearApiKeyButton.Click += clearApiKeyButton_Click;
            
            // 
            // ApiKeyPropertyPage
            // 
            AutoScaleDimensions = new SizeF(7F, 15F);
            AutoScaleMode = AutoScaleMode.Font;
            Controls.Add(groupBox1);
            Name = "ApiKeyPropertyPage";
            Size = new Size(480, 500);
            groupBox1.ResumeLayout(false);
            groupBox1.PerformLayout();
            ResumeLayout(false);
        }
    }
}
