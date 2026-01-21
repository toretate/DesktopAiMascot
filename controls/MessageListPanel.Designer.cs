namespace DesktopAiMascot.Controls
{
    partial class MessageListPanel
    {
        /// <summary> 
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        #region Component Designer generated code

        /// <summary> 
        /// Required method for Designer support - do not modify 
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.components = new System.ComponentModel.Container();
            this.listBox = new System.Windows.Forms.ListBox();
            this.messagesContextMenu = new System.Windows.Forms.ContextMenuStrip(this.components);
            this.SuspendLayout();
            // 
            // listBox
            // 
            this.listBox.Dock = System.Windows.Forms.DockStyle.Fill;
            this.listBox.FormattingEnabled = true;
            this.listBox.IntegralHeight = false;
            this.listBox.Name = "listBox";
            this.listBox.Size = new System.Drawing.Size(200, 150);
            this.listBox.TabIndex = 0;
            this.listBox.ContextMenuStrip = this.messagesContextMenu;
            // 
            // messagesContextMenu
            // 
            this.messagesContextMenu.Name = "messagesContextMenu";
            this.messagesContextMenu.Size = new System.Drawing.Size(61, 4);
            // 
            // MessageListPanel
            // 
            this.Controls.Add(this.listBox);
            this.Name = "MessageListPanel";
            this.Size = new System.Drawing.Size(200, 150);
            this.ResumeLayout(false);
        }

        #endregion

        private System.Windows.Forms.ListBox listBox;
        private System.Windows.Forms.ContextMenuStrip messagesContextMenu;
    }
}
