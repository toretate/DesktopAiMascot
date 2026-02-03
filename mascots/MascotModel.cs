using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using DesktopAiMascot.utils;

namespace DesktopAiMascot.mascots
{
    public class MascotModel
    {
        public string Name { get; private set; }
        public string Prompt { get; private set; }
        public string[] ImagePaths { get; private set; } = Array.Empty<string>();
        public MascotConfig Config { get; set; } = new MascotConfig();
        public string ConfigPath { get; private set; } = string.Empty;
        
        /// <summary>
        /// マスコットのディレクトリパス（ロード元のディレクトリ）
        /// </summary>
        public string DirectoryPath { get; private set; } = string.Empty;

        public MascotModel(string name, string prompt, string[] images, string configPath = "", string directoryPath = "")
        {
            Name = name;
            Prompt = prompt;
            ImagePaths = images;
            ConfigPath = configPath;
            DirectoryPath = directoryPath;
        }

        /** 画像キャッシュ */
        private MascotImageItem[] imageCache = [];
        
        /// <summary>
        /// .back.*とtemp_*を除外したフィルタリング済みの画像ファイルパスを取得する
        /// </summary>
        /// <returns>フィルタリング済みの画像ファイルパスの配列</returns>
        public string[] GetFilteredImagePaths()
        {
            return ImagePaths
                .Where(path => !Path.GetFileName(path).Contains(".back."))
                .Where(path => !Path.GetFileName(path).StartsWith("temp_"))
                .ToArray();
        }
        
        /// <summary>
        /// マスコット画像をロードする
        /// バックアップファイル（.back.*）と一時ファイル（temp_*）は除外される
        /// </summary>
        /// <returns>ロードされた画像アイテムの配列</returns>
        public MascotImageItem[] LoadImages()
        {
            // キャッシュがあればそれを返す
            if (imageCache.Length != 0)
            {
                Debug.WriteLine($"[MascotModel] キャッシュから画像を返す: {Name}, 画像数={imageCache.Length}");
                return imageCache;
            }
            
            imageCache = ImageLoadHelper.LoadImages(Name, ImagePaths);
            Debug.WriteLine($"[MascotModel] 画像読み込み完了: {Name}, 読み込み成功={imageCache.Length}/{ImagePaths.Length}");
            return imageCache;
        }

        /// <summary>
        /// キャッシュを破棄する
        /// </summary>
        public void Dispose()
        {
            if (imageCache != null)
            {
                foreach (var im in imageCache)
                {
                    im?.Dispose();
                }
                imageCache = [];
            }
        }

        /// <summary>
        /// Voice設定をConfig に保存し、config.yamlファイルに書き込みます
        /// </summary>
        /// <param name="serviceName">Voice AI サービス名（例: "StyleBertVits2"）</param>
        /// <param name="model">モデル名</param>
        /// <param name="speaker">スピーカー名</param>
        public void SaveVoiceConfig(string serviceName, string model, string speaker)
        {
            try
            {
                Debug.WriteLine($"[MascotModel] SaveVoiceConfig開始: serviceName={serviceName}, model={model}, speaker={speaker}");
                Debug.WriteLine($"[MascotModel] ConfigPath: {ConfigPath}");
                Debug.WriteLine($"[MascotModel] Config.Voice is null: {Config.Voice == null}");
                
                // Voice辞書がnullの場合は初期化
                if (Config.Voice == null)
                {
                    Config.Voice = new Dictionary<string, VoiceServiceConfig>();
                    Debug.WriteLine($"[MascotModel] Config.Voiceを初期化しました");
                }

                // サービスの設定を更新または追加
                Config.Voice[serviceName] = new VoiceServiceConfig
                {
                    Model = model,
                    Speaker = speaker
                };
                
                Debug.WriteLine($"[MascotModel] Config.Voiceに設定を追加: Count={Config.Voice.Count}");

                // config.yaml に書き込み
                if (!string.IsNullOrEmpty(ConfigPath) && File.Exists(ConfigPath))
                {
                    Debug.WriteLine($"[MascotModel] MascotConfigIO.SaveToYaml を呼び出します");
                    MascotConfigIO.SaveToYaml(Config, ConfigPath);
                    Debug.WriteLine($"[MascotModel] Voice設定を保存しました: {serviceName} - Model: {model}, Speaker: {speaker}");
                }
                else
                {
                    Debug.WriteLine($"[MascotModel] Config path not found: {ConfigPath}");
                    Debug.WriteLine($"[MascotModel] File.Exists: {File.Exists(ConfigPath)}");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotModel] Voice設定の保存に失敗しました: {ex.Message}");
                Debug.WriteLine($"[MascotModel] Exception: {ex}");
            }
        }
    }
}

