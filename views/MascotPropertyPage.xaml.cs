using DesktopAiMascot.mascots;
using DesktopAiMascot.aiservice;
using System;
using System.Windows;
using System.Windows.Controls;
using System.Diagnostics;

namespace DesktopAiMascot.views
{
    public partial class MascotPropertyPage : System.Windows.Controls.UserControl
    {
        public event EventHandler<MascotModel>? MascotChanged;

        public MascotPropertyPage()
        {
            InitializeComponent();

            try
            {
                if (MascotManager.Instance.MascotModels.Count == 0)
                {
                    MascotManager.Instance.Load();
                }
                PopulateMascotCombo();
            }
            catch { }

            this.IsVisibleChanged += (s, e) =>
            {
                if (this.IsVisible)
                {
                    PopulateMascotCombo();
                }
            };
        }

        private void MascotChooseComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (mascotChooseComboBox?.SelectedItem is string name)
            {
                Debug.WriteLine($"[MascotPropertyPage] マスコットが選択されました: {name}");
                
                SystemConfig.Instance.MascotName = name;
                SystemConfig.Instance.Save();

                var model = MascotManager.Instance.GetMascotByName(name);
                if (model != null)
                {
                    Debug.WriteLine($"[MascotPropertyPage] MascotManager.Instance.CurrentModelを更新: {model.Name}");
                    MascotManager.Instance.CurrentModel = model;
                    
                    // Voice設定を即座に適用
                    ApplyVoiceConfigForMascot(model);
                    
                    Debug.WriteLine($"[MascotPropertyPage] MascotChangedイベントを発火します: {model.Name}");
                    MascotChanged?.Invoke(this, model);
                }
                else
                {
                    Debug.WriteLine($"[MascotPropertyPage] マスコット '{name}' が見つかりませんでした");
                }
            }
        }

        /// <summary>
        /// マスコットに保存されているVoice設定を即座に適用します
        /// </summary>
        private void ApplyVoiceConfigForMascot(MascotModel mascot)
        {
            try
            {
                Debug.WriteLine($"[MascotPropertyPage] ========== Voice設定の適用開始 ==========");
                Debug.WriteLine($"[MascotPropertyPage] マスコット: {mascot.Name}");
                
                var currentService = VoiceAiManager.Instance.CurrentService;
                if (currentService == null)
                {
                    Debug.WriteLine("[MascotPropertyPage] Voice AIサービスが選択されていません");
                    return;
                }
                
                Debug.WriteLine($"[MascotPropertyPage] 現在のVoice AIサービス: {currentService.Name}");
                
                // マスコットのVoice設定を取得
                if (mascot.Config.Voice != null &&
                    mascot.Config.Voice.TryGetValue(currentService.Name, out var voiceConfig))
                {
                    Debug.WriteLine($"[MascotPropertyPage] ✓ マスコットに{currentService.Name}のVoice設定が見つかりました");
                    Debug.WriteLine($"[MascotPropertyPage]   - モデル: {voiceConfig.Model}");
                    Debug.WriteLine($"[MascotPropertyPage]   - スピーカー: {voiceConfig.Speaker}");

                    // モデルとスピーカーを設定
                    if (!string.IsNullOrEmpty(voiceConfig.Model))
                    {
                        Debug.WriteLine($"[MascotPropertyPage] サービスのモデルを '{currentService.Model}' から '{voiceConfig.Model}' に変更");
                        currentService.Model = voiceConfig.Model;
                        SystemConfig.Instance.VoiceServiceModel = voiceConfig.Model;
                    }

                    if (!string.IsNullOrEmpty(voiceConfig.Speaker))
                    {
                        Debug.WriteLine($"[MascotPropertyPage] サービスのスピーカーを '{currentService.Speaker}' から '{voiceConfig.Speaker}' に変更");
                        currentService.Speaker = voiceConfig.Speaker;
                        SystemConfig.Instance.VoiceServiceSpeaker = voiceConfig.Speaker;
                    }

                    SystemConfig.Instance.Save();
                    Debug.WriteLine($"[MascotPropertyPage] ✓ Voice設定をSystemConfigに保存しました");
                }
                else
                {
                    Debug.WriteLine($"[MascotPropertyPage] ✗ マスコット「{mascot.Name}」には「{currentService.Name}」のVoice設定がありません");
                    Debug.WriteLine($"[MascotPropertyPage] デフォルトのVoice設定を使用します");
                }
                
                Debug.WriteLine($"[MascotPropertyPage] ========== Voice設定の適用完了 ==========");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotPropertyPage] ✗ Voice設定の適用エラー: {ex.Message}");
                Debug.WriteLine($"[MascotPropertyPage] スタックトレース: {ex.StackTrace}");
            }
        }

        private void PopulateMascotCombo()
        {
            try
            {
                if (mascotChooseComboBox == null) return;

                mascotChooseComboBox.SelectionChanged -= MascotChooseComboBox_SelectionChanged;

                mascotChooseComboBox.Items.Clear();

                string? currentName = MascotManager.Instance.CurrentModel?.Name;
                int selectedIndex = 0;
                int index = 0;

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
                    mascotChooseComboBox.SelectedIndex = selectedIndex;
                }

                mascotChooseComboBox.SelectionChanged += MascotChooseComboBox_SelectionChanged;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error populating mascot combo: {ex.Message}");
            }
        }
    }
}
