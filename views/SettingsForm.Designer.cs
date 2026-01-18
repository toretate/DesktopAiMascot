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
            components = new Container();
            titleLabel = new Label();
            closeButton = new Button();
            contentPanel = new Panel();
            topPanel = new Panel();
            mainPanel = new Panel();
            mascotGroupBox = new GroupBox();
            mascotChooseComboBox = new ComboBox();
            removeBackGroundButton = new Button();
            comboBox1 = new ComboBox();
            generateEmotes = new Button();
            label2 = new Label();
            llmAiEngineComboBox = new ComboBox();
            llmManagerBindingSource = new BindingSource(components);
            aiEngineLabel = new Label();
            groupBox1 = new GroupBox();
            apiKeyTextBox = new TextBox();
            contentPanel.SuspendLayout();
            topPanel.SuspendLayout();
            mainPanel.SuspendLayout();
            mascotGroupBox.SuspendLayout();
            ((ISupportInitialize)llmManagerBindingSource).BeginInit();
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
            mascotGroupBox.Controls.Add(mascotChooseComboBox);
            mascotGroupBox.Controls.Add(removeBackGroundButton);
            mascotGroupBox.Controls.Add(comboBox1);
            mascotGroupBox.Controls.Add(generateEmotes);
            mascotGroupBox.Controls.Add(label2);
            mascotGroupBox.Controls.Add(llmAiEngineComboBox);
            mascotGroupBox.Controls.Add(aiEngineLabel);
            mascotGroupBox.Location = new Point(9, 27);
            mascotGroupBox.Name = "mascotGroupBox";
            mascotGroupBox.Size = new Size(180, 165);
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
            // comboBox1
            // 
            comboBox1.FormattingEnabled = true;
            comboBox1.Location = new Point(88, 131);
            comboBox1.Name = "comboBox1";
            comboBox1.Size = new Size(85, 23);
            comboBox1.TabIndex = 18;
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
            label2.Location = new Point(9, 134);
            label2.Name = "label2";
            label2.Size = new Size(42, 15);
            label2.TabIndex = 17;
            label2.Text = "音声AI";
            label2.Click += label2_Click;
            // 
            // llmAiEngineComboBox
            // 
            llmAiEngineComboBox.DataSource = llmManagerBindingSource;
            llmAiEngineComboBox.FormattingEnabled = true;
            llmAiEngineComboBox.Location = new Point(88, 100);
            llmAiEngineComboBox.Name = "llmAiEngineComboBox";
            llmAiEngineComboBox.Size = new Size(86, 23);
            llmAiEngineComboBox.TabIndex = 8;
            llmAiEngineComboBox.SelectedIndexChanged += llmAiEngineComboBox_SelectedIndexChanged;
            // 
            // llmManagerBindingSource
            // 
            llmManagerBindingSource.DataSource = typeof(LlmManager);
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
            groupBox1.Location = new Point(6, 198);
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
            ((ISupportInitialize)llmManagerBindingSource).EndInit();
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
        private ComboBox comboBox1;
        private BindingSource llmManagerBindingSource;
        private Panel mainPanel;
        private Panel topPanel;
        private GroupBox mascotGroupBox;
    }
}
