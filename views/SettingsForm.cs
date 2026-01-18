using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.mascots;
using System.Data;

namespace DesktopAiMascot.Views
{
    public partial class SettingsForm : UserControl
    {
        public event EventHandler? CloseRequested;
        public event EventHandler<MascotModel>? MascotChanged;  //!< マスコット変更イベント
        public event EventHandler<string>? LlmServiceChanged;   //!< LLMサービス変更イベント

        // Callback that returns a clone of the current mascot image when requested
        public Func<Image?>? GetMascotImage { get; set; }

        public SettingsForm()
        {
            InitializeComponent();
            LoadApiKeyToUI();

            // マスコット一覧を読み込み、コンボボックスを更新する
            try
            {
                if (MascotManager.Instance.MascotModels.Count == 0)
                {
                    MascotManager.Instance.Load();
                }
                PopulateMascotCombo();
            }
            catch { }

            // LLMエンジンコンボボックスの初期化
            populateLlmEngineCombo();

            // 表示されたときに最新の状態を反映する
            this.VisibleChanged += (s, e) =>
            {
                if (this.Visible)
                {
                    PopulateMascotCombo();
                }
            };
            
            SetupScrollableLayout();
        }

        private void SetupScrollableLayout()
        {
            // titleLabelをcontentPanelに移動（一緒にスクロールさせるため）
            //if (titleLabel.Parent != contentPanel)
            //{
            //    titleLabel.Parent = contentPanel;
            //    titleLabel.Dock = DockStyle.Top;
            //    titleLabel.SendToBack(); // 最背面に移動（上部に配置されるように）
            //}

            // closeButtonの設定調整
            //if (closeButton != null)
            //{
            //    closeButton.Dock = DockStyle.None; // Dockを解除してスクロールコンテンツの一部にする
            //    closeButton.Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top;
                
            //    // 配置位置の調整（コンテンツの一番下に配置）
            //    int maxY = 0;
            //    foreach (Control c in contentPanel.Controls)
            //    {
            //        if (c != closeButton && c.Bottom > maxY)
            //        {
            //            maxY = c.Bottom;
            //        }
            //    }
                
            //    // 少し余白を空けて配置
            //    closeButton.Location = new Point(0, maxY + 20);
            //    closeButton.Width = contentPanel.ClientSize.Width;
            //}
        }

        /** マスコットコンボボックスの選択イベント */
        private void MascotChooseComboBox_SelectedIndexChanged(object? sender, EventArgs e)
        {
            if (mascotChooseComboBox?.SelectedItem is string name)
            {
                SystemConfig.Instance.MascotName = name;
                SystemConfig.Instance.Save();

                var model = MascotManager.Instance.GetMascotByName(name);
                if (model != null)
                {
                    // 変更イベントを発行
                    MascotChanged?.Invoke(this, model);
                }
            }
        }

        // MascotManager のモデルを元にコンボボックスを更新する
        private void PopulateMascotCombo()
        {
            try
            {
                if (mascotChooseComboBox == null) return;

                // イベントループ回避のため一時的にイベントを解除
                mascotChooseComboBox.SelectedIndexChanged -= MascotChooseComboBox_SelectedIndexChanged;

                mascotChooseComboBox.Items.Clear();

                // 現在選択中のマスコット名を取得
                string? currentName = MascotManager.Instance.CurrentModel?.Name;
                int selectedIndex = 0;
                int index = 0;

                // 辞書の値（MascotModel）を列挙
                foreach (var model in MascotManager.Instance.MascotModels.Values)
                {
                    mascotChooseComboBox.Items.Add(model.Name);

                    if (!string.IsNullOrEmpty(currentName) && model.Name == currentName)
                    {
                        selectedIndex = index;
                    }
                    index++;
                }

                if (mascotChooseComboBox.Items.Count > 0)
                {
                    // 見つかったインデックス、またはデフォルト(0)を選択
                    mascotChooseComboBox.SelectedIndex = selectedIndex;
                }

                // イベントを再設定
                mascotChooseComboBox.SelectedIndexChanged += MascotChooseComboBox_SelectedIndexChanged;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error populating mascot combo: {ex.Message}");
            }
        }

        /** LLMエンジン選択コンボボックスの選択イベント */
        private void llmAiEngineComboBox_SelectedIndexChanged(object? sender, EventArgs e)
        {
            if (llmAiEngineComboBox.SelectedValue is string llmName)
            {
                SystemConfig.Instance.LlmService = llmName;
                SystemConfig.Instance.Save();

                // 変更イベントを発行
                LlmServiceChanged?.Invoke(this, llmName);
            }
        }

        // LLMエンジンコンボボックスの初期化
        private void populateLlmEngineCombo()
        {
            try
            {
                // イベントハンドラを一時的に解除
                llmAiEngineComboBox.SelectedIndexChanged -= llmAiEngineComboBox_SelectedIndexChanged;

                // バインディング設定
                llmAiEngineComboBox.DataSource = LlmManager.GetAvailableLlmServices;
                llmAiEngineComboBox.DisplayMember = "Name";
                llmAiEngineComboBox.ValueMember = "Name";

                // 現在の設定を選択
                string currentLlm = SystemConfig.Instance.LlmService;
                llmAiEngineComboBox.SelectedValue = currentLlm;

                // もし選択できていなければデフォルト(0番目)を選択
                if (llmAiEngineComboBox.SelectedIndex < 0 && llmAiEngineComboBox.Items.Count > 0)
                {
                    llmAiEngineComboBox.SelectedIndex = 0;
                }

                // イベントハンドラを再設定
                llmAiEngineComboBox.SelectedIndexChanged += llmAiEngineComboBox_SelectedIndexChanged;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error populating LLM engine combo: {ex.Message}");
            }
        }


        private void SettingsForm_Resize(object? sender, EventArgs e)
        {
            LayoutControls();
        }

        private void LayoutControls()
        {
            // AutoScrollによる自動レイアウトを使用するため、手動配置ロジックは無効化
            /*
            int margin = 8;
            if (closeButton != null)
            {
                closeButton.Location = new Point(Math.Max(margin, this.ClientSize.Width - closeButton.Width - margin), margin);
            }

            if (contentPanel != null)
            {
                contentPanel.Size = new Size(Math.Max(0, this.ClientSize.Width - 24), Math.Max(0, this.ClientSize.Height - 56));
            }
            */
        }

        private void SettingsForm_KeyDown(object? sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Escape)
            {
                CloseRequested?.Invoke(this, EventArgs.Empty);
            }
        }

        private void closeButton_Click(object? sender, EventArgs e)
        {
            CloseRequested?.Invoke(this, EventArgs.Empty);
        }


        private void OnGenerateEmotes_Click(object sender, EventArgs e)
        {
        }

        // 背景削除処理
        private async void OnRemoveBackgound_Click(object sender, EventArgs e)
        {
        }

        private void saveApiKeyButton_Click(object? sender, EventArgs e)
        {
            try
            {
                var apiKey = apiKeyTextBox.Text?.Trim();
                SystemConfig.Instance.ApiKeys.Add("GoogleApiKey", apiKey ?? "");
                SystemConfig.Instance.Save();
                MessageBox.Show("API key saved.", "Settings", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to save API key: {ex.Message}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void clearApiKeyButton_Click(object? sender, EventArgs e)
        {
            try
            {
                apiKeyTextBox.Text = string.Empty;
                SystemConfig.Instance.ApiKeys.Remove("GoogleApiKey");
                SystemConfig.Instance.Save();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to clear API key: {ex.Message}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void LoadApiKeyToUI()
        {
            try
            {
                string apiKey;
                SystemConfig.Instance.ApiKeys.TryGetValue("GoogleApiKey", out apiKey);
                apiKeyTextBox.Text = apiKey;
            }
            catch
            {
                // ignore
            }
        }

        private void label2_Click(object sender, EventArgs e)
        {

        }
    }
}
