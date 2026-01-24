using DesktopAiMascot.mascots;
using System;
using System.Collections.Generic;
using System.IO;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Security.Cryptography;

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

        // APIキーの辞書（メモリ上は平文）
        [YamlIgnore]
        public Dictionary<string, string> ApiKeys { get; set; }
        
        // 暗号化されたAPIキー（YAML保存用）
        public Dictionary<string, string> EncryptedApiKeys { get; set; } = new Dictionary<string, string>();
        

        // 位置情報
        public Point WindowPosition = new Point() { X = 100, Y = 100 };

        public string MascotName { get; set; } = "AIアシスタント";
        public string LlmService { get; set; } = "LM Studio";
        public string VoiceService { get; set; } = "Style Bert Vits 2";
        public string ImageService { get; set; } = "ComfyUI";
        public string MovieService { get; set; } = "ComfyUI";
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
                    
                    // 暗号化されたAPIキーを復号化
                    if (loaded.EncryptedApiKeys != null && loaded.EncryptedApiKeys.Count > 0)
                    {
                        this.ApiKeys = DecryptApiKeys(loaded.EncryptedApiKeys);
                    }
                    // 後方互換性: 平文のAPIキーが存在する場合は読み込む（次回保存時に暗号化される）
                    else if (loaded.ApiKeys != null)
                    {
                        this.ApiKeys = loaded.ApiKeys;
                    }
                    
                    this.WindowPosition = loaded.WindowPosition;
                    this.MascotName = loaded.MascotName;
                    this.ModelName = loaded.ModelName;
                    this.LlmService = loaded.LlmService;
                    this.VoiceService = loaded.VoiceService;
                    this.ImageService = loaded.ImageService;
                    this.MovieService = loaded.MovieService;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Config load failed: {ex.Message}");
            }
        }

        public void Save()
        {
            try
            {
                string settingsPath = Path.Combine(BaseDir, settingFile);
                
                // APIキーを暗号化
                this.EncryptedApiKeys = EncryptApiKeys(this.ApiKeys);
                
                var serializer = new SerializerBuilder()
                    .WithNamingConvention(UnderscoredNamingConvention.Instance)
                    .Build();

                string yaml = serializer.Serialize(this);
                File.WriteAllText(settingsPath, yaml);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Config save failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Windows DPAPIを使用してAPIキーを暗号化します。
        /// </summary>
        private Dictionary<string, string> EncryptApiKeys(Dictionary<string, string> apiKeys)
        {
            var encrypted = new Dictionary<string, string>();
            
            foreach (var kvp in apiKeys)
            {
                try
                {
                    if (string.IsNullOrEmpty(kvp.Value))
                    {
                        encrypted[kvp.Key] = string.Empty;
                        continue;
                    }

                    byte[] plainBytes = Encoding.UTF8.GetBytes(kvp.Value);
                    byte[] encryptedBytes = ProtectedData.Protect(plainBytes, null, DataProtectionScope.CurrentUser);
                    encrypted[kvp.Key] = Convert.ToBase64String(encryptedBytes);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"Failed to encrypt API key '{kvp.Key}': {ex.Message}");
                    encrypted[kvp.Key] = string.Empty;
                }
            }
            
            return encrypted;
        }

        /// <summary>
        /// Windows DPAPIを使用してAPIキーを復号化します。
        /// </summary>
        private Dictionary<string, string> DecryptApiKeys(Dictionary<string, string> encryptedApiKeys)
        {
            var decrypted = new Dictionary<string, string>();
            
            foreach (var kvp in encryptedApiKeys)
            {
                try
                {
                    if (string.IsNullOrEmpty(kvp.Value))
                    {
                        decrypted[kvp.Key] = string.Empty;
                        continue;
                    }

                    byte[] encryptedBytes = Convert.FromBase64String(kvp.Value);
                    byte[] plainBytes = ProtectedData.Unprotect(encryptedBytes, null, DataProtectionScope.CurrentUser);
                    decrypted[kvp.Key] = Encoding.UTF8.GetString(plainBytes);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"Failed to decrypt API key '{kvp.Key}': {ex.Message}");
                    decrypted[kvp.Key] = string.Empty;
                }
            }
            
            return decrypted;
        }
    }
}
