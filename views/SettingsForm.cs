using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.mascots;
using System.Data;
using System.Linq;

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

            // Voice AIエンジンコンボボックスの初期化
            populateVoiceAiCombo();

            // Image AIエンジンコンボボックスの初期化
            populateImageAiCombo();

            // Movie AIエンジンコンボボックスの初期化
            populateMovieAiCombo();

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
            // スクロール可能なレイアウトの設定
            if (this.Controls.Count > 0 && this.Controls[0] is Panel panel)
            {
                panel.AutoScroll = true;
                foreach (Control control in panel.Controls)
                {
                    control.Width = panel.Width - SystemInformation.VerticalScrollBarArrowHeight;
                }

                panel.VerticalScroll.Enabled = true;
                panel.VerticalScroll.Visible = true;
                panel.HorizontalScroll.Enabled = false;
                panel.HorizontalScroll.Visible = false;
            }
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

        /** Voice AIエンジン選択コンボボックスの選択イベント */
        private void voiceAiComboBox_SelectedIndexChanged(object? sender, EventArgs e)
        {
            if (voiceAiComboBox.SelectedValue is string voiceName)
            {
                SystemConfig.Instance.VoiceService = voiceName;
                SystemConfig.Instance.Save();

                // VoiceAiManager に即時反映
                if (VoiceAiManager.Instance.VoiceAiServices.TryGetValue(voiceName, out var service))
                {
                    VoiceAiManager.Instance.CurrentService = service;
                }
            }
        }

        // Voice AIエンジンコンボボックスの初期化
        private void populateVoiceAiCombo()
        {
            try
            {
                // イベントハンドラを一時的に解除
                voiceAiComboBox.SelectedIndexChanged -= voiceAiComboBox_SelectedIndexChanged;

                // バインディング設定
                voiceAiComboBox.DataSource = VoiceAiManager.Instance.VoiceAiServices.Values.ToList();
                voiceAiComboBox.DisplayMember = "Name";
                voiceAiComboBox.ValueMember = "Name";

                // 現在の設定を選択
                string currentVoice = SystemConfig.Instance.VoiceService;
                voiceAiComboBox.SelectedValue = currentVoice;

                // もし選択できていなければデフォルト(0番目)を選択
                if (voiceAiComboBox.SelectedIndex < 0 && voiceAiComboBox.Items.Count > 0)
                {
                    voiceAiComboBox.SelectedIndex = 0;
                }

                // イベントハンドラを再設定
                voiceAiComboBox.SelectedIndexChanged += voiceAiComboBox_SelectedIndexChanged;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error populating Voice AI combo: {ex.Message}");
            }
        }

        /** Image AIエンジン選択コンボボックスの選択イベント */
        private void imageAiComboBox_SelectedIndexChanged(object? sender, EventArgs e)
        {
            if (imageAiComboBox.SelectedValue is string aiName)
            {
                SystemConfig.Instance.ImageService = aiName;
                SystemConfig.Instance.Save();

                // ImageAiManager に即時反映
                if (ImageAiManager.Instance.ImageAiServices.TryGetValue(aiName, out var service))
                {
                    ImageAiManager.Instance.CurrentService = service;
                }
            }
        }

        // Image AIエンジンコンボボックスの初期化
        private void populateImageAiCombo()
        {
            try
            {
                // イベントハンドラを一時的に解除
                imageAiComboBox.SelectedIndexChanged -= imageAiComboBox_SelectedIndexChanged;

                // バインディング設定
                imageAiComboBox.DataSource = ImageAiManager.Instance.ImageAiServices.Values.ToList();
                imageAiComboBox.DisplayMember = "Name";
                imageAiComboBox.ValueMember = "Name";

                // 現在の設定を選択
                string currentService = SystemConfig.Instance.ImageService;
                imageAiComboBox.SelectedValue = currentService;

                // もし選択できていなければデフォルト(0番目)を選択
                if (imageAiComboBox.SelectedIndex < 0 && imageAiComboBox.Items.Count > 0)
                {
                    imageAiComboBox.SelectedIndex = 0;
                }

                // イベントハンドラを再設定
                imageAiComboBox.SelectedIndexChanged += imageAiComboBox_SelectedIndexChanged;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error populating Image AI combo: {ex.Message}");
            }
        }

        /** Movie AIエンジン選択コンボボックスの選択イベント */
        private void movieAiComboBox_SelectedIndexChanged(object? sender, EventArgs e)
        {
            if (movieAiComboBox.SelectedValue is string aiName)
            {
                SystemConfig.Instance.MovieService = aiName;
                SystemConfig.Instance.Save();

                // MovieAiManager に即時反映
                if (MovieAiManager.Instance.MovieAiServices.TryGetValue(aiName, out var service))
                {
                    MovieAiManager.Instance.CurrentService = service;
                }
            }
        }

        // Movie AIエンジンコンボボックスの初期化
        private void populateMovieAiCombo()
        {
            try
            {
                // イベントハンドラを一時的に解除
                movieAiComboBox.SelectedIndexChanged -= movieAiComboBox_SelectedIndexChanged;

                // バインディング設定
                movieAiComboBox.DataSource = MovieAiManager.Instance.MovieAiServices.Values.ToList();
                movieAiComboBox.DisplayMember = "Name";
                movieAiComboBox.ValueMember = "Name";

                // 現在の設定を選択
                string currentService = SystemConfig.Instance.MovieService;
                movieAiComboBox.SelectedValue = currentService;

                // もし選択できていなければデフォルト(0番目)を選択
                if (movieAiComboBox.SelectedIndex < 0 && movieAiComboBox.Items.Count > 0)
                {
                    movieAiComboBox.SelectedIndex = 0;
                }

                // イベントハンドラを再設定
                movieAiComboBox.SelectedIndexChanged += movieAiComboBox_SelectedIndexChanged;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error populating Movie AI combo: {ex.Message}");
            }
        }

        private void SettingsForm_Resize(object? sender, EventArgs e)
        {
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
