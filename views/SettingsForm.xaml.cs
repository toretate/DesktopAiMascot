using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;
using DesktopAiMascot.mascots;
using WpfUserControl = System.Windows.Controls.UserControl;

namespace DesktopAiMascot.views
{
    /// <summary>
    /// SettingsForm.xaml の相互作用ロジック
    /// </summary>
    public partial class SettingsForm : WpfUserControl
    {
        public event EventHandler? CloseRequested;
        public event EventHandler<string>? LlmServiceChanged;
        public event EventHandler<MascotModel> MascotChanged;

        public Func<System.Drawing.Image?>? GetMascotImage { get; set; }

        private MascotPropertyPage? mascotPropertyPage;
        private ChatAiPropertyPage? chatAiPropertyPage;
        private VoiceAiPropertyPage? voiceAiPropertyPage;
        private ImageAiPropertyPage? imageAiPropertyPage;
        private MovieAiPropertyPage? movieAiPropertyPage;
        private ApiKeyPropertyPage? apiKeyPropertyPage;

        public SettingsForm()
        {
            InitializeComponent();

            // デフォルトで最初のアイテムを選択
            if (categorySelectionList.Items.Count > 0)
            {
                categorySelectionList.SelectedIndex = 0;
            }
        }

        private void UserControl_KeyDown(object sender, System.Windows.Input.KeyEventArgs e)
        {
            if (e.Key == Key.Escape)
            {
                CloseRequested?.Invoke(this, EventArgs.Empty);
            }
        }

        private void CloseButton_Click(object sender, RoutedEventArgs e)
        {
            CloseRequested?.Invoke(this, EventArgs.Empty);
        }

        private void CategorySelectionList_SelectionChanged(object sender, System.Windows.Controls.SelectionChangedEventArgs e)
        {
            // すべてのページを非表示にする
            if (mascotPropertyPage != null) mascotPropertyPage.Visibility = Visibility.Collapsed;
            if (chatAiPropertyPage != null) chatAiPropertyPage.Visibility = Visibility.Collapsed;
            if (voiceAiPropertyPage != null) voiceAiPropertyPage.Visibility = Visibility.Collapsed;
            if (imageAiPropertyPage != null) imageAiPropertyPage.Visibility = Visibility.Collapsed;
            if (movieAiPropertyPage != null) movieAiPropertyPage.Visibility = Visibility.Collapsed;
            if (apiKeyPropertyPage != null) apiKeyPropertyPage.Visibility = Visibility.Collapsed;

            // 選択されたページを遅延初期化して表示
            switch (categorySelectionList.SelectedIndex)
            {
                case 0:
                    if (mascotPropertyPage == null)
                    {
                        mascotPropertyPage = new MascotPropertyPage();
                        mascotPropertyPage.MascotChanged += (s, e) => MascotChanged?.Invoke(this, e);
                        propertyPagesContainer.Children.Add(mascotPropertyPage);
                    }
                    mascotPropertyPage.Visibility = Visibility.Visible;
                    break;
                case 1:
                    if (chatAiPropertyPage == null)
                    {
                        chatAiPropertyPage = new ChatAiPropertyPage();
                        chatAiPropertyPage.LlmServiceChanged += (s, e) => LlmServiceChanged?.Invoke(this, e);
                        propertyPagesContainer.Children.Add(chatAiPropertyPage);
                    }
                    chatAiPropertyPage.Visibility = Visibility.Visible;
                    break;
                case 2:
                    if (voiceAiPropertyPage == null)
                    {
                        voiceAiPropertyPage = new VoiceAiPropertyPage();
                        propertyPagesContainer.Children.Add(voiceAiPropertyPage);
                    }
                    voiceAiPropertyPage.Visibility = Visibility.Visible;
                    break;
                case 3:
                    if (imageAiPropertyPage == null)
                    {
                        imageAiPropertyPage = new ImageAiPropertyPage();
                        propertyPagesContainer.Children.Add(imageAiPropertyPage);
                    }
                    imageAiPropertyPage.Visibility = Visibility.Visible;
                    break;
                case 4:
                    if (movieAiPropertyPage == null)
                    {
                        movieAiPropertyPage = new MovieAiPropertyPage();
                        propertyPagesContainer.Children.Add(movieAiPropertyPage);
                    }
                    movieAiPropertyPage.Visibility = Visibility.Visible;
                    break;
                case 5:
                    if (apiKeyPropertyPage == null)
                    {
                        apiKeyPropertyPage = new ApiKeyPropertyPage();
                        propertyPagesContainer.Children.Add(apiKeyPropertyPage);
                    }
                    apiKeyPropertyPage.Visibility = Visibility.Visible;
                    break;
            }
        }
    }
}


