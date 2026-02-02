using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice.image;

namespace DesktopAiMascot.aiservice
{
    /// <summary>
    /// 画像処理AIサービスを管理するマネージャークラス
    /// </summary>
    internal class ImageAiManager
    {
        private static ImageAiManager? instance = null;
        
        /// <summary>
        /// 利用可能な画像処理サービスのディクショナリ
        /// </summary>
        public Dictionary<string, ImageAiServiceBase> ImageAiServices { get; private set; } = new Dictionary<string, ImageAiServiceBase>();
        
        /// <summary>
        /// 現在選択されているサービス
        /// </summary>
        public ImageAiServiceBase? CurrentService { get; set; } = null;
        
        /// <summary>
        /// シングルトンインスタンス
        /// </summary>
        public static ImageAiManager Instance
        {
            get
            {
                if (instance == null)
                {
                    instance = new ImageAiManager();
                }
                return instance;
            }
        }

        private ImageAiManager()
        {
            InitializeServices();
        }

        /// <summary>
        /// 各画像処理サービスを初期化する
        /// </summary>
        private void InitializeServices()
        {
            // Geminiサービス
            var geminiService = new GeminiImageService();
            ImageAiServices.Add(geminiService.Name, geminiService);

            // ComfyUIサービス (Local)
            var comfyService = new ComfyImageService();
            ImageAiServices.Add(comfyService.Name, comfyService);

            // A1111/Forgeサービス (Local)
            var a1111Service = new A1111ImageService();
            ImageAiServices.Add(a1111Service.Name, a1111Service);

            // ImageMagickサービス (Local)
            var imageMagickService = new ImageMagickService();
            ImageAiServices.Add(imageMagickService.Name, imageMagickService);

            // Microsoft Foundryサービス (Local)
            var foundryService = new FoundryImageService();
            ImageAiServices.Add(foundryService.Name, foundryService);
        }

        /// <summary>
        /// 設定を読み込む
        /// </summary>
        public void Load()
        {
            // TODO: 設定ファイルから各サービスの設定を読み込む
            // - エンドポイントURL
            // - APIキー
            // - デフォルトサービス
        }

        /// <summary>
        /// 設定を保存する
        /// </summary>
        public void Save()
        {
            // TODO: 設定ファイルに各サービスの設定を保存する
        }

        /// <summary>
        /// 指定した名前のサービスを取得する
        /// </summary>
        public ImageAiServiceBase? GetService(string name)
        {
            return ImageAiServices.TryGetValue(name, out var service) ? service : null;
        }

        /// <summary>
        /// 現在のサービスを使用して背景を削除する
        /// </summary>
        public async Task<string?> RemoveBackgroundAsync(string imageData)
        {
            if (CurrentService == null)
            {
                throw new InvalidOperationException("画像処理サービスが選択されていません");
            }

            return await CurrentService.RemoveBackgroundAsync(imageData);
        }
    }
}
