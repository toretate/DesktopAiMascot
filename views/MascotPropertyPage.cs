using DesktopAiMascot.mascots;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace DesktopAiMascot.views
{
    public partial class MascotPropertyPage : UserControl
    {
        public event EventHandler<MascotModel>? MascotChanged;  //!< マスコット変更イベント

        public MascotPropertyPage()
        {
            InitializeComponent();

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

            // 表示されたときに最新の状態を反映する
            this.VisibleChanged += (s, e) =>
            {
                if (this.Visible)
                {
                    PopulateMascotCombo();
                }
            };
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
    }
}
