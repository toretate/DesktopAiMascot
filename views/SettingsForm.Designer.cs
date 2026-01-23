using DesktopAiMascot.aiservice;
using DesktopAiMascot.views;
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
        private Label titleLabel;
        private Panel contentPanel;
        
        // Property Pages
        private MascotPropertyPage mascotPropertyPage;
        private ChatAiPropertyPage chatAiPropertyPage;
        private VoiceAiPropertyPage voiceAiPropertyPage;
        private ImageAiPropertyPage imageAiPropertyPage;
        private MovieAiPropertyPage movieAiPropertyPage;
        private ApiKeyPropertyPage apiKeyPropertyPage;

        private Panel topPanel;
        private Button closeButton;
        private Panel sideCategoryListPanel;
        private ListBox categorySelectionList;

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
            contentPanel = new Panel();
            sideCategoryListPanel = new Panel();
            categorySelectionList = new ListBox();
            
            mascotPropertyPage = new MascotPropertyPage();
            chatAiPropertyPage = new ChatAiPropertyPage();
            voiceAiPropertyPage = new VoiceAiPropertyPage();
            imageAiPropertyPage = new ImageAiPropertyPage();
            movieAiPropertyPage = new MovieAiPropertyPage();
            apiKeyPropertyPage = new ApiKeyPropertyPage();

            topPanel = new Panel();
            closeButton = new Button();

            contentPanel.SuspendLayout();
            sideCategoryListPanel.SuspendLayout();
            topPanel.SuspendLayout();
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
            // contentPanel
            // 
            contentPanel.AutoScroll = true;
            contentPanel.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            contentPanel.BackColor = Color.Transparent;
            contentPanel.Controls.Add(mascotPropertyPage);
            contentPanel.Controls.Add(chatAiPropertyPage);
            contentPanel.Controls.Add(voiceAiPropertyPage);
            contentPanel.Controls.Add(imageAiPropertyPage);
            contentPanel.Controls.Add(movieAiPropertyPage);
            contentPanel.Controls.Add(apiKeyPropertyPage);
            contentPanel.Controls.Add(sideCategoryListPanel);
            contentPanel.Dock = DockStyle.Fill;
            contentPanel.Location = new Point(0, 21);
            contentPanel.Name = "contentPanel";
            contentPanel.Size = new Size(580, 506);
            contentPanel.TabIndex = 2;
            
            // 
            // sideCategoryListPanel
            // 
            sideCategoryListPanel.Controls.Add(categorySelectionList);
            sideCategoryListPanel.Dock = DockStyle.Left;
            sideCategoryListPanel.Location = new Point(0, 0);
            sideCategoryListPanel.Name = "sideCategoryListPanel";
            sideCategoryListPanel.Size = new Size(100, 506);
            sideCategoryListPanel.TabIndex = 20;

            // 
            // categorySelectionList
            // 
            categorySelectionList.Dock = DockStyle.Left;
            categorySelectionList.Font = new Font("Yu Gothic UI", 9.75F, FontStyle.Regular, GraphicsUnit.Point, 128);
            categorySelectionList.FormattingEnabled = true;
            categorySelectionList.ItemHeight = 17;
            categorySelectionList.Items.AddRange(new object[] { "Mascot", "Chat AI", "Voice AI", "Image AI", "Movie AI", "API Keys" });
            categorySelectionList.Location = new Point(0, 0);
            categorySelectionList.Name = "categorySelectionList";
            categorySelectionList.Size = new Size(100, 506);
            categorySelectionList.TabIndex = 0;
            categorySelectionList.SelectedIndexChanged += categorySelectionList_SelectedIndexChanged;

            // 
            // mascotPropertyPage
            // 
            mascotPropertyPage.AutoScroll = true;
            mascotPropertyPage.Location = new Point(100, 0);
            mascotPropertyPage.Name = "mascotPropertyPage";
            mascotPropertyPage.Size = new Size(480, 506);
            mascotPropertyPage.TabIndex = 20;
            mascotPropertyPage.Visible = false;

            //
            // chatAiPropertyPage
            //
            chatAiPropertyPage.AutoScroll = true;
            chatAiPropertyPage.Location = new Point(100, 0);
            chatAiPropertyPage.Name = "chatAiPropertyPage";
            chatAiPropertyPage.Size = new Size(480, 506);
            chatAiPropertyPage.TabIndex = 21;
            chatAiPropertyPage.Visible = false;

            //
            // voiceAiPropertyPage
            //
            voiceAiPropertyPage.AutoScroll = true;
            voiceAiPropertyPage.Location = new Point(100, 0);
            voiceAiPropertyPage.Name = "voiceAiPropertyPage";
            voiceAiPropertyPage.Size = new Size(480, 506);
            voiceAiPropertyPage.TabIndex = 22;
            voiceAiPropertyPage.Visible = false;

            //
            // imageAiPropertyPage
            //
            imageAiPropertyPage.AutoScroll = true;
            imageAiPropertyPage.Location = new Point(100, 0);
            imageAiPropertyPage.Name = "imageAiPropertyPage";
            imageAiPropertyPage.Size = new Size(480, 506);
            imageAiPropertyPage.TabIndex = 23;
            imageAiPropertyPage.Visible = false;

            //
            // movieAiPropertyPage
            //
            movieAiPropertyPage.AutoScroll = true;
            movieAiPropertyPage.Location = new Point(100, 0);
            movieAiPropertyPage.Name = "movieAiPropertyPage";
            movieAiPropertyPage.Size = new Size(480, 506);
            movieAiPropertyPage.TabIndex = 24;
            movieAiPropertyPage.Visible = false;

            //
            // apiKeyPropertyPage
            //
            apiKeyPropertyPage.AutoScroll = true;
            apiKeyPropertyPage.Location = new Point(100, 0);
            apiKeyPropertyPage.Name = "apiKeyPropertyPage";
            apiKeyPropertyPage.Size = new Size(480, 506);
            apiKeyPropertyPage.TabIndex = 25;
            apiKeyPropertyPage.Visible = false;

            // 
            // topPanel
            // 
            topPanel.Controls.Add(titleLabel);
            topPanel.Dock = DockStyle.Top;
            topPanel.Location = new Point(0, 0);
            topPanel.Name = "topPanel";
            topPanel.Size = new Size(580, 21);
            topPanel.TabIndex = 19;
            // 
            // closeButton
            // 
            closeButton.AutoSize = true;
            closeButton.Dock = DockStyle.Bottom;
            closeButton.Location = new Point(0, 527);
            closeButton.Name = "closeButton";
            closeButton.Size = new Size(580, 25);
            closeButton.TabIndex = 20;
            closeButton.Text = "Close";
            closeButton.Click += closeButton_Click;

            // 
            // SettingsForm
            // 
            BackColor = SystemColors.Window;
            Controls.Add(contentPanel);
            Controls.Add(closeButton);
            Controls.Add(topPanel);
            Name = "SettingsForm";
            Size = new Size(580, 552);
            KeyDown += SettingsForm_KeyDown;
            Resize += SettingsForm_Resize;
            
            contentPanel.ResumeLayout(false);
            sideCategoryListPanel.ResumeLayout(false);
            topPanel.ResumeLayout(false);
            topPanel.PerformLayout();
            ResumeLayout(false);
            PerformLayout();
        }

        #endregion
    }
}
