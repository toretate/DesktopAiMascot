using DesktopAiMascot.mascots;
using System;
using System.Collections.Generic;
using System.IO;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace DesktopAiMascot
{
    /**
     * アプリケーション全体の設定情報を管理するシングルトンクラス
     */
    internal class SystemConfig
    {
        private readonly string settingFile = "system_config.yaml";

        private static SystemConfig? instance = null;
        public static SystemConfig Instance
        {
            get
            {
                if (instance == null)
                {
                    instance = new SystemConfig();
                }
                return instance;
            }
        }
        public SystemConfig()
        {
            ApiKeys = new Dictionary<string, string>();
            // デフォルトのBaseDirを設定
            BaseDir = AppDomain.CurrentDomain.BaseDirectory;
        }

        // ここにシステム全体の設定プロパティを追加する
        [YamlIgnore]
        public string BaseDir { get; set; }
        public string Language { get; set; } = "ja-JP";

        // APIキーの辞書
        public Dictionary<string, string> ApiKeys { get; set; }
        

        // 位置情報
        public Point WindowPosition = new Point() { X = 100, Y = 100 };

        public string MascotName { get; set; } = "AIアシスタント";
        public string LlmService { get; set; } = "LM Studio";
        public string ModelName { get; set; } = "gpt-3.5-turbo";

        public void Load()
        {
            try
            {
                string settingsPath = Path.Combine(BaseDir, settingFile);
                if (!File.Exists(settingsPath)) return;

                var deserializer = new DeserializerBuilder()
                    .WithNamingConvention(UnderscoredNamingConvention.Instance)
                    .IgnoreUnmatchedProperties()
                    .Build();

                string yaml = File.ReadAllText(settingsPath);
                var loaded = deserializer.Deserialize<SystemConfig>(yaml);

                if (loaded != null)
                {
                    this.Language = loaded.Language;
                    if (loaded.ApiKeys != null)
                    {
                        this.ApiKeys = loaded.ApiKeys;
                    }
                    this.WindowPosition = loaded.WindowPosition;
                    this.MascotName = loaded.MascotName;
                    this.ModelName = loaded.ModelName;
                    this.LlmService = loaded.LlmService;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Config load failed: {ex.Message}");
            }
        }

        public void Save()
        {
            try
            {
                string settingsPath = Path.Combine(BaseDir, settingFile);
                
                var serializer = new SerializerBuilder()
                    .WithNamingConvention(UnderscoredNamingConvention.Instance)
                    .Build();

                string yaml = serializer.Serialize(this);
                File.WriteAllText(settingsPath, yaml);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Config save failed: {ex.Message}");
            }
        }
    }
}
