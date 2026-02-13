using System;
using System.ComponentModel;
using System.IO;
using System.Windows.Media.Imaging;

namespace DesktopAiMascot.views.MascotEdit
{
    /// <summary>
    /// 感情表現アイテム
    /// </summary>
    public class EmoteItem : INotifyPropertyChanged
    {
        private string _imagePath = string.Empty;
        private string _statusText = "未生成";
        private bool _hasImage = false;
        private BitmapImage? _generatedBitmapImage = null;

        public string GroupName { get; set; } = string.Empty;
        public string EmoteName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Prompt { get; set; } = string.Empty;
        public string GeneratedImageBase64 { get; set; } = string.Empty;

        public string ImagePath
        {
            get => _imagePath;
            set
            {
                _imagePath = value;
                OnPropertyChanged(nameof(ImagePath));
            }
        }

        public BitmapImage? GeneratedBitmapImage
        {
            get => _generatedBitmapImage;
            set
            {
                _generatedBitmapImage = value;
                OnPropertyChanged(nameof(GeneratedBitmapImage));
                OnPropertyChanged(nameof(DisplayImage));
            }
        }

        public string StatusText
        {
            get => _statusText;
            set
            {
                _statusText = value;
                OnPropertyChanged(nameof(StatusText));
            }
        }

        public bool HasImage
        {
            get => _hasImage;
            set
            {
                _hasImage = value;
                OnPropertyChanged(nameof(HasImage));
            }
        }

        /// <summary>
        /// 表示用画像（GeneratedBitmapImageが優先、なければImagePathから読み込み）
        /// </summary>
        public BitmapImage? DisplayImage
        {
            get
            {
                // 生成された画像がある場合はそれを返す
                if (_generatedBitmapImage != null)
                {
                    return _generatedBitmapImage;
                }

                // ImagePathがある場合は画像を読み込む
                if (!string.IsNullOrEmpty(_imagePath) && File.Exists(_imagePath))
                {
                    try
                    {
                        var bitmap = new BitmapImage();
                        bitmap.BeginInit();
                        bitmap.UriSource = new Uri(_imagePath, UriKind.Absolute);
                        bitmap.CacheOption = BitmapCacheOption.OnLoad;
                        bitmap.EndInit();
                        bitmap.Freeze();
                        return bitmap;
                    }
                    catch
                    {
                        return null;
                    }
                }

                return null;
            }
        }

        public event PropertyChangedEventHandler? PropertyChanged;

        protected void OnPropertyChanged(string propertyName)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}
