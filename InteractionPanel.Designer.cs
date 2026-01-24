using DesktopAiMascot.Controls;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms.Integration;

namespace DesktopAiMascot
{
    partial class InteractionPanel
    {
        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                messageFont?.Dispose();
                topToolStrip?.Dispose();
                // persist messages on dispose
                try { SaveToFile(messagesFilePath); } catch { }
            }
            base.Dispose(disposing);
        }

        #region Component Designer generated code
        private void InitializeComponent()
        {
            topToolStrip = new ToolStrip();
            clearBtn = new ToolStripButton();
            settingsButton = new ToolStripButton();
            messagesPanelHost = new ElementHost();
            inputBox = new ChatInputBox();
            topToolStrip.SuspendLayout();
            SuspendLayout();
            // 
            // topToolStrip
            // 
            topToolStrip.GripStyle = ToolStripGripStyle.Hidden;
            topToolStrip.Items.AddRange(new ToolStripItem[] { clearBtn, settingsButton });
            topToolStrip.Location = new Point(0, 0);
            topToolStrip.Name = "topToolStrip";
            topToolStrip.Size = new Size(205, 25);
            topToolStrip.TabIndex = 0;
            // 
            // clearBtn
            // 
            clearBtn.Alignment = ToolStripItemAlignment.Right;
            clearBtn.Name = "clearBtn";
            clearBtn.Size = new Size(37, 22);
            clearBtn.Text = "Clear";
            clearBtn.ToolTipText = "Clear messages";
            clearBtn.Click += ClearMessages;
            // 
            // settingsButton
            // 
            settingsButton.DisplayStyle = ToolStripItemDisplayStyle.Text;
            settingsButton.ImageTransparentColor = Color.Magenta;
            settingsButton.Name = "settingsButton";
            settingsButton.Size = new Size(23, 22);
            settingsButton.Text = "⚙";
            settingsButton.Click += OnSettingsButtonCliecked;
            // 
            // messagesPanelHost
            // 
            messagesPanelHost.BackColor = Color.Transparent;
            messagesPanelHost.BackColorTransparent = true;
            messagesPanelHost.Dock = DockStyle.Fill;
            messagesPanelHost.Location = new Point(0, 25);
            messagesPanelHost.Name = "messagesPanelHost";
            messagesPanelHost.Size = new Size(205, 283);
            messagesPanelHost.TabIndex = 1;
            messagesPanelHost.ChildChanged += messagesPanelHost_ChildChanged;
            // 
            // inputBox
            // 
            inputBox.BorderStyle = BorderStyle.FixedSingle;
            inputBox.Dock = DockStyle.Bottom;
            inputBox.Location = new Point(0, 308);
            inputBox.Name = "inputBox";
            inputBox.Size = new Size(205, 20);
            inputBox.TabIndex = 2;
            inputBox.SendRequested += InputBox_SendRequested;
            // 
            // InteractionPanel
            // 
            BackColor = Color.Transparent;
            BorderStyle = BorderStyle.FixedSingle;
            Controls.Add(messagesPanelHost);
            Controls.Add(topToolStrip);
            Controls.Add(inputBox);
            Name = "InteractionPanel";
            Size = new Size(205, 328);
            topToolStrip.ResumeLayout(false);
            topToolStrip.PerformLayout();
            ResumeLayout(false);
            PerformLayout();
        }
        #endregion

        public ChatInputBox inputBox;
        private readonly Font messageFont;
        private ElementHost messagesPanelHost;
        private DesktopAiMascot.controls.MessageListPanel wpfMessagesPanel;
        public ToolStrip topToolStrip;
        private ToolStripButton clearBtn;
        private ToolStripButton settingsButton;
        
        // WPF MessageListPanel へのアクセスを提供
        public DesktopAiMascot.controls.MessageListPanel messagesPanel => wpfMessagesPanel;
    }
}

