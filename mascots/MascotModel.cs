using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DesktopAiMascot.mascots
{
    public class MascotModel
    {
        public string Name { get; private set; }
        public string Prompt { get; private set; }
        public string[] ImagePaths { get; private set; } = Array.Empty<string>();
        public MascotModel(string name, string prompt, string[] images )
        {
            Name = name;
            Prompt = prompt;
            ImagePaths = images;
        }

        /** 画像キャッシュ */
        private Image[] imageCache = [];
        /** 画像をロードする */
        public Image[] LoadImages()
        {
            // キャッシュがあればそれを返す
            if ( imageCache.Length != 0 )
            {
                return imageCache;
            }

            // 画像をロードしてキャッシュに保存する
            var loadedList = new List<Image>();
            foreach (var path in ImagePaths)
            {
                string fullPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, path);
                var img = LoadSingleImage(fullPath);
                if (img != null)
                {
                    loadedList.Add(img);
                }
            }
            imageCache = loadedList.ToArray();
            return imageCache;
        }

        /** 短画像をロードする */
        private Image? LoadSingleImage(string path)
        {
            try
            {
                if (!System.IO.File.Exists(path)) return null;
                var img = Image.FromFile(path);
                return img;
            }
            catch
            {
                return null;
            }
        }

        /** キャッシュを破棄する */
        public void Dispose()
        {
            if (imageCache != null)
            {
                foreach (var im in imageCache) im?.Dispose();
                imageCache = [];
            }
        }
    }
}
