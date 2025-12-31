using System;
using System.ComponentModel;
using System.Drawing;
using System.Windows.Forms;

namespace DesktopAiMascot.Views
{
    partial class SettingsForm
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private IContainer components = null;

        private Button closeButton;
        private Label titleLabel;
        private Panel contentPanel;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Component Designer generated code

        private void InitializeComponent()
        {
            titleLabel = new Label();
            closeButton = new Button();
            contentPanel = new Panel();
            comboBox1 = new ComboBox();
            label4 = new Label();
            generateEmotes = new Button();
            label3 = new Label();
            button1 = new Button();
            label2 = new Label();
            label1 = new Label();
            contentPanel.SuspendLayout();
            SuspendLayout();
            // 
            // titleLabel
            // 
            titleLabel.AutoSize = true;
            titleLabel.Dock = DockStyle.Top;
            titleLabel.Font = new Font("Segoe UI", 12F, FontStyle.Bold);
            titleLabel.Location = new Point(0, 0);
            titleLabel.Name = "titleLabel";
            titleLabel.Size = new Size(72, 21);
            titleLabel.TabIndex = 0;
            titleLabel.Text = "Settings";
            // 
            // closeButton
            // 
            closeButton.AutoSize = true;
            closeButton.Dock = DockStyle.Bottom;
            closeButton.Location = new Point(0, 264);
            closeButton.Name = "closeButton";
            closeButton.Size = new Size(198, 25);
            closeButton.TabIndex = 1;
            closeButton.Text = "Close";
            closeButton.Click += closeButton_Click;
            // 
            // contentPanel
            // 
            contentPanel.BackColor = Color.Transparent;
            contentPanel.Controls.Add(comboBox1);
            contentPanel.Controls.Add(label4);
            contentPanel.Controls.Add(generateEmotes);
            contentPanel.Controls.Add(label3);
            contentPanel.Controls.Add(button1);
            contentPanel.Controls.Add(label2);
            contentPanel.Controls.Add(label1);
            contentPanel.Controls.Add(closeButton);
            contentPanel.Dock = DockStyle.Fill;
            contentPanel.Location = new Point(0, 0);
            contentPanel.Name = "contentPanel";
            contentPanel.Size = new Size(198, 289);
            contentPanel.TabIndex = 2;
            // 
            // comboBox1
            // 
            comboBox1.FormattingEnabled = true;
            comboBox1.Items.AddRange(new object[] { "LM Studio", "Foundry Local", "Open AI (未実装)", "Chat GPT (未実装)" });
            comboBox1.Location = new Point(109, 91);
            comboBox1.Name = "comboBox1";
            comboBox1.Size = new Size(86, 23);
            comboBox1.TabIndex = 8;
            // 
            // label4
            // 
            label4.AutoSize = true;
            label4.Location = new Point(11, 94);
            label4.Name = "label4";
            label4.Size = new Size(54, 15);
            label4.TabIndex = 7;
            label4.Text = "接続先AI";
            // 
            // generateEmotes
            // 
            generateEmotes.Location = new Point(109, 58);
            generateEmotes.Name = "generateEmotes";
            generateEmotes.Size = new Size(86, 21);
            generateEmotes.TabIndex = 6;
            generateEmotes.Text = "実行";
            generateEmotes.UseVisualStyleBackColor = true;
            generateEmotes.Click += OnGenerateEmotes_Click;
            // 
            // label3
            // 
            label3.AutoSize = true;
            label3.Location = new Point(9, 61);
            label3.Name = "label3";
            label3.Size = new Size(89, 15);
            label3.TabIndex = 5;
            label3.Text = "表情差分の作成";
            // 
            // button1
            // 
            button1.Location = new Point(109, 28);
            button1.Name = "button1";
            button1.Size = new Size(86, 21);
            button1.TabIndex = 4;
            button1.Text = "参照";
            button1.UseVisualStyleBackColor = true;
            // 
            // label2
            // 
            label2.AutoSize = true;
            label2.Location = new Point(9, 31);
            label2.Name = "label2";
            label2.Size = new Size(55, 15);
            label2.TabIndex = 3;
            label2.Text = "画像変更";
            // 
            // label1
            // 
            label1.AutoSize = true;
            label1.Location = new Point(9, 34);
            label1.Name = "label1";
            label1.Size = new Size(0, 15);
            label1.TabIndex = 2;
            // 
            // SettingsForm
            // 
            BackColor = SystemColors.Window;
            Controls.Add(titleLabel);
            Controls.Add(contentPanel);
            Name = "SettingsForm";
            Size = new Size(198, 289);
            KeyDown += SettingsForm_KeyDown;
            Resize += SettingsForm_Resize;
            contentPanel.ResumeLayout(false);
            contentPanel.PerformLayout();
            ResumeLayout(false);
            PerformLayout();
        }

        #endregion

        private Label label1;
        private Label label3;
        private Button button1;
        private Label label2;
        private ComboBox comboBox1;
        private Label label4;
        private Button generateEmotes;
    }
}
