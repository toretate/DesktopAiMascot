using DesktopAiMascot.aiservice;
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
            topPanel = new Panel();
            mainPanel = new Panel();
            mascotGroupBox = new GroupBox();
            mascotChooseComboBox = new ComboBox();
            removeBackGroundButton = new Button();
            voiceAiComboBox = new ComboBox();
            generateEmotes = new Button();
            label2 = new Label();
            llmAiEngineComboBox = new ComboBox();
            aiEngineLabel = new Label();
            groupBox1 = new GroupBox();
            apiKeyTextBox = new TextBox();
            imageAiLabel = new Label();
            imageAiComboBox = new ComboBox();
            movieAiLabel = new Label();
            movieAiComboBox = new ComboBox();
            contentPanel.SuspendLayout();
            topPanel.SuspendLayout();
            mainPanel.SuspendLayout();
            mascotGroupBox.SuspendLayout();
            groupBox1.SuspendLayout();
            SuspendLayout();
            // 
            // titleLabel
            // 
            titleLabel.AutoSize = true;
            titleLabel.Font = new Font("Segoe UI", 12F, FontStyle.Bold);
            titleLabel.Location = new Point(0, 0);
            titleLabel.Margin = new Padding(0);
            titleLabel.Name = "titleLabel";
            titleLabel.Size = new Size(72, 21);
            titleLabel.TabIndex = 0;
            titleLabel.Text = "Settings";
            // 
            // closeButton
            // 
            closeButton.AutoSize = true;
            closeButton.Dock = DockStyle.Bottom;
            closeButton.Location = new Point(0, 324);
            closeButton.Name = "closeButton";
            closeButton.Size = new Size(198, 25);
            closeButton.TabIndex = 1;
            closeButton.Text = "Close";
            closeButton.Click += closeButton_Click;
            // 
            // contentPanel
            // 
            contentPanel.AutoScroll = true;
            contentPanel.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            contentPanel.BackColor = Color.Transparent;
            contentPanel.Controls.Add(topPanel);
            contentPanel.Controls.Add(mainPanel);
            contentPanel.Controls.Add(closeButton);
            contentPanel.Dock = DockStyle.Fill;
            contentPanel.Location = new Point(0, 0);
            contentPanel.Name = "contentPanel";
            contentPanel.Size = new Size(198, 349);
            contentPanel.TabIndex = 2;
            // 
            // topPanel
            // 
            topPanel.Controls.Add(titleLabel);
            topPanel.Dock = DockStyle.Top;
            topPanel.Location = new Point(0, 0);
            topPanel.Name = "topPanel";
            topPanel.Size = new Size(198, 21);
            topPanel.TabIndex = 19;
            // 
            // mainPanel
            // 
            mainPanel.AutoScroll = true;
            mainPanel.Controls.Add(mascotGroupBox);
            mainPanel.Controls.Add(groupBox1);
            mainPanel.Dock = DockStyle.Fill;
            mainPanel.Location = new Point(0, 0);
            mainPanel.Name = "mainPanel";
            mainPanel.Size = new Size(198, 324);
            mainPanel.TabIndex = 19;
            // 
            // mascotGroupBox
            // 
            mascotGroupBox.Controls.Add(movieAiComboBox);
            mascotGroupBox.Controls.Add(movieAiLabel);
            mascotGroupBox.Controls.Add(imageAiComboBox);
            mascotGroupBox.Controls.Add(imageAiLabel);
            mascotGroupBox.Controls.Add(mascotChooseComboBox);
            mascotGroupBox.Controls.Add(removeBackGroundButton);
            mascotGroupBox.Controls.Add(voiceAiComboBox);
            mascotGroupBox.Controls.Add(generateEmotes);
            mascotGroupBox.Controls.Add(label2);
            mascotGroupBox.Controls.Add(llmAiEngineComboBox);
            mascotGroupBox.Controls.Add(aiEngineLabel);
            mascotGroupBox.Location = new Point(9, 27);
            mascotGroupBox.Name = "mascotGroupBox";
            mascotGroupBox.Size = new Size(180, 230);
            mascotGroupBox.TabIndex = 19;
            mascotGroupBox.TabStop = false;
            mascotGroupBox.Text = "マスコット";
            // 
            // mascotChooseComboBox
            // 
            mascotChooseComboBox.FormattingEnabled = true;
            mascotChooseComboBox.Location = new Point(6, 20);
            mascotChooseComboBox.Name = "mascotChooseComboBox";
            mascotChooseComboBox.Size = new Size(168, 23);
            mascotChooseComboBox.TabIndex = 15;
            mascotChooseComboBox.SelectedIndexChanged += MascotChooseComboBox_SelectedIndexChanged;
            // 
            // removeBackGroundButton
            // 
            removeBackGroundButton.Location = new Point(6, 76);
            removeBackGroundButton.Name = "removeBackGroundButton";
            removeBackGroundButton.Size = new Size(168, 21);
            removeBackGroundButton.TabIndex = 10;
            removeBackGroundButton.Text = "背景削除";
            removeBackGroundButton.UseVisualStyleBackColor = true;
            removeBackGroundButton.Click += OnRemoveBackgound_Click;
            // 
            // voiceAiComboBox
            // 
            voiceAiComboBox.FormattingEnabled = true;
            voiceAiComboBox.Location = new Point(57, 131);
            voiceAiComboBox.Name = "voiceAiComboBox";
            voiceAiComboBox.Size = new Size(116, 23);
            voiceAiComboBox.TabIndex = 18;
            // 
            // generateEmotes
            // 
            generateEmotes.Location = new Point(6, 49);
            generateEmotes.Name = "generateEmotes";
            generateEmotes.Size = new Size(168, 21);
            generateEmotes.TabIndex = 6;
            generateEmotes.Text = "表情差分作成";
            generateEmotes.UseVisualStyleBackColor = true;
            generateEmotes.Click += OnGenerateEmotes_Click;
            // 
            // label2
            // 
            label2.AutoSize = true;
            label2.Location = new Point(6, 134);
            label2.Name = "label2";
            label2.Size = new Size(42, 15);
            label2.TabIndex = 17;
            label2.Text = "音声AI";
            label2.Click += label2_Click;
            // 
            // llmAiEngineComboBox
            // 
            llmAiEngineComboBox.DisplayMember = "Name";
            llmAiEngineComboBox.FormattingEnabled = true;
            llmAiEngineComboBox.Location = new Point(57, 100);
            llmAiEngineComboBox.Name = "llmAiEngineComboBox";
            llmAiEngineComboBox.Size = new Size(117, 23);
            llmAiEngineComboBox.TabIndex = 8;
            llmAiEngineComboBox.SelectedIndexChanged += llmAiEngineComboBox_SelectedIndexChanged;
            // 
            // aiEngineLabel
            // 
            aiEngineLabel.AutoSize = true;
            aiEngineLabel.Location = new Point(6, 103);
            aiEngineLabel.Name = "aiEngineLabel";
            aiEngineLabel.Size = new Size(45, 15);
            aiEngineLabel.TabIndex = 7;
            aiEngineLabel.Text = "Chat AI";
            // 
            // groupBox1
            // 
            groupBox1.Controls.Add(apiKeyTextBox);
            groupBox1.Location = new Point(6, 263);
            groupBox1.Name = "groupBox1";
            groupBox1.Size = new Size(183, 55);
            groupBox1.TabIndex = 16;
            groupBox1.TabStop = false;
            groupBox1.Text = "Google API Key";
            // 
            // apiKeyTextBox
            // 
            apiKeyTextBox.AllowDrop = true;
            apiKeyTextBox.Location = new Point(6, 22);
            apiKeyTextBox.Name = "apiKeyTextBox";
            apiKeyTextBox.PlaceholderText = "Google API KEY";
            apiKeyTextBox.Size = new Size(174, 23);
            apiKeyTextBox.TabIndex = 12;
            // 
            // imageAiLabel
            // 
            imageAiLabel.AutoSize = true;
            imageAiLabel.Location = new Point(6, 165);
            imageAiLabel.Name = "imageAiLabel";
            imageAiLabel.Size = new Size(42, 15);
            imageAiLabel.TabIndex = 19;
            imageAiLabel.Text = "画像AI";
            // 
            // imageAiComboBox
            // 
            imageAiComboBox.FormattingEnabled = true;
            imageAiComboBox.Location = new Point(58, 162);
            imageAiComboBox.Name = "imageAiComboBox";
            imageAiComboBox.Size = new Size(114, 23);
            imageAiComboBox.TabIndex = 20;
            // 
            // movieAiLabel
            // 
            movieAiLabel.AutoSize = true;
            movieAiLabel.Location = new Point(6, 195);
            movieAiLabel.Name = "movieAiLabel";
            movieAiLabel.Size = new Size(42, 15);
            movieAiLabel.TabIndex = 21;
            movieAiLabel.Text = "動画AI";
            // 
            // movieAiComboBox
            // 
            movieAiComboBox.FormattingEnabled = true;
            movieAiComboBox.Location = new Point(57, 196);
            movieAiComboBox.Name = "movieAiComboBox";
            movieAiComboBox.Size = new Size(115, 23);
            movieAiComboBox.TabIndex = 22;
            // 
            // SettingsForm
            // 
            BackColor = SystemColors.Window;
            Controls.Add(contentPanel);
            Name = "SettingsForm";
            Size = new Size(198, 349);
            KeyDown += SettingsForm_KeyDown;
            Resize += SettingsForm_Resize;
            contentPanel.ResumeLayout(false);
            contentPanel.PerformLayout();
            topPanel.ResumeLayout(false);
            topPanel.PerformLayout();
            mainPanel.ResumeLayout(false);
            mascotGroupBox.ResumeLayout(false);
            mascotGroupBox.PerformLayout();
            groupBox1.ResumeLayout(false);
            groupBox1.PerformLayout();
            ResumeLayout(false);
        }

        #endregion
        private ComboBox llmAiEngineComboBox;
        private Label aiEngineLabel;
        private Button generateEmotes;
        private Button removeBackGroundButton;
        private TextBox apiKeyTextBox;
        private ComboBox mascotChooseComboBox;
        private GroupBox groupBox1;
        private Label label2;
        private ComboBox voiceAiComboBox;
        private Panel mainPanel;
        private Panel topPanel;
        private GroupBox mascotGroupBox;
        private Label movieAiLabel;
        private ComboBox imageAiComboBox;
        private Label imageAiLabel;
        private ComboBox movieAiComboBox;
    }
}
