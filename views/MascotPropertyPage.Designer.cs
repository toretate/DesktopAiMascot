namespace DesktopAiMascot.views
{
    partial class MascotPropertyPage
    {
        /// <summary> 
        /// 必要なデザイナー変数です。
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary> 
        /// 使用中のリソースをすべてクリーンアップします。
        /// </summary>
        /// <param name="disposing">マネージド リソースを破棄する場合は true を指定し、その他の場合は false を指定します。</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region コンポーネント デザイナーで生成されたコード

        /// <summary> 
        /// デザイナー サポートに必要なメソッドです。このメソッドの内容を 
        /// コード エディターで変更しないでください。
        /// </summary>
        private void InitializeComponent()
        {
            mascotGroupBox = new GroupBox();
            listView1 = new ListView();
            mascotChooseComboBox = new ComboBox();
            removeBackGroundButton = new Button();
            generateEmotes = new Button();
            panel1 = new Panel();
            button1 = new Button();
            mascotGroupBox.SuspendLayout();
            panel1.SuspendLayout();
            SuspendLayout();
            // 
            // mascotGroupBox
            // 
            mascotGroupBox.Controls.Add(panel1);
            mascotGroupBox.Controls.Add(mascotChooseComboBox);
            mascotGroupBox.Controls.Add(removeBackGroundButton);
            mascotGroupBox.Controls.Add(generateEmotes);
            mascotGroupBox.Dock = DockStyle.Fill;
            mascotGroupBox.Location = new Point(0, 0);
            mascotGroupBox.Name = "mascotGroupBox";
            mascotGroupBox.Size = new Size(480, 500);
            mascotGroupBox.TabIndex = 20;
            mascotGroupBox.TabStop = false;
            mascotGroupBox.Text = "マスコット";
            // 
            // listView1
            // 
            listView1.Dock = DockStyle.Fill;
            listView1.Location = new Point(0, 0);
            listView1.Name = "listView1";
            listView1.Size = new Size(100, 445);
            listView1.TabIndex = 16;
            listView1.UseCompatibleStateImageBehavior = false;
            // 
            // mascotChooseComboBox
            // 
            mascotChooseComboBox.FormattingEnabled = true;
            mascotChooseComboBox.Location = new Point(306, 22);
            mascotChooseComboBox.Name = "mascotChooseComboBox";
            mascotChooseComboBox.Size = new Size(168, 23);
            mascotChooseComboBox.TabIndex = 15;
            // 
            // removeBackGroundButton
            // 
            removeBackGroundButton.Location = new Point(306, 78);
            removeBackGroundButton.Name = "removeBackGroundButton";
            removeBackGroundButton.Size = new Size(168, 21);
            removeBackGroundButton.TabIndex = 10;
            removeBackGroundButton.Text = "背景削除";
            removeBackGroundButton.UseVisualStyleBackColor = true;
            // 
            // generateEmotes
            // 
            generateEmotes.Location = new Point(306, 51);
            generateEmotes.Name = "generateEmotes";
            generateEmotes.Size = new Size(168, 21);
            generateEmotes.TabIndex = 6;
            generateEmotes.Text = "表情差分作成";
            generateEmotes.UseVisualStyleBackColor = true;
            // 
            // panel1
            // 
            panel1.Controls.Add(listView1);
            panel1.Controls.Add(button1);
            panel1.Dock = DockStyle.Left;
            panel1.Location = new Point(3, 19);
            panel1.Name = "panel1";
            panel1.Size = new Size(100, 478);
            panel1.TabIndex = 17;
            // 
            // button1
            // 
            button1.Dock = DockStyle.Bottom;
            button1.Location = new Point(0, 445);
            button1.Name = "button1";
            button1.Size = new Size(100, 33);
            button1.TabIndex = 17;
            button1.Text = "Add";
            button1.UseVisualStyleBackColor = true;
            // 
            // MascotPropertyPage
            // 
            AutoScaleDimensions = new SizeF(7F, 15F);
            AutoScaleMode = AutoScaleMode.Font;
            Controls.Add(mascotGroupBox);
            Name = "MascotPropertyPage";
            Size = new Size(480, 500);
            mascotGroupBox.ResumeLayout(false);
            panel1.ResumeLayout(false);
            ResumeLayout(false);
        }

        #endregion

        private GroupBox mascotGroupBox;
        private ComboBox mascotChooseComboBox;
        private Button removeBackGroundButton;
        private Button generateEmotes;
        private ListView listView1;
        private Panel panel1;
        private Button button1;
    }
}
