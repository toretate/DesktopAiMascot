using System;
using System.IO;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace DesktopAiMascot.mascots
{
    // YAML の読み取り・解析および MascotConfig との相互変換を担当するユーティリティ
    internal static class MascotConfigIO
    {
        /// <summary>
        /// 指定されたパスのファイルから YAML を読み込み、MascotConfig オブジェクトを作成します。
        /// </summary>
        public static MascotConfig LoadFromFile(string path)
        {
            if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
            {
                return new MascotConfig();
            }

            try
            {
                string yaml = File.ReadAllText(path);
                return Load(yaml);
            }
            catch
            {
                return new MascotConfig();
            }
        }

        /// <summary>
        /// YAML 文字列から MascotConfig オブジェクトを作成します。
        /// </summary>
        public static MascotConfig Load(string yaml)
        {
            if (string.IsNullOrWhiteSpace(yaml)) return new MascotConfig();

            var deserializer = new DeserializerBuilder()
                .WithNamingConvention(UnderscoredNamingConvention.Instance)
                .IgnoreUnmatchedProperties()
                .Build();

            try
            {
                return deserializer.Deserialize<MascotConfig>(yaml);
            }
            catch
            {
                return new MascotConfig();
            }
        }

        /// <summary>
        /// MascotConfig オブジェクトを YAML 文字列に変換します。
        /// </summary>
        public static string Save(MascotConfig config)
        {
            var serializer = new SerializerBuilder()
                .WithNamingConvention(UnderscoredNamingConvention.Instance)
                .ConfigureDefaultValuesHandling(DefaultValuesHandling.OmitDefaults)
                .Build();

            return serializer.Serialize(config);
        }

        /// <summary>
        /// YAML からマスコットの設定（名前、システムプロンプト、Config全体）を解析します。
        /// </summary>
        public static (string Name, string Prompt, MascotConfig Config) ParseFromYaml(string yaml, string defaultName)
        {
            var config = Load(yaml);

            // 名前を取得
            string name = config.SystemPrompt.Profile.Name;
            if (string.IsNullOrWhiteSpace(name))
            {
                name = defaultName;
            }

            // プロンプト文字列を生成（SystemPrompt以下の内容をYAML化したもの）
            var serializer = new SerializerBuilder()
                .WithNamingConvention(UnderscoredNamingConvention.Instance)
                .Build();

            string prompt = serializer.Serialize(config.SystemPrompt);

            return (name, prompt, config);
        }

        /// <summary>
        /// MascotConfig オブジェクトを YAML ファイルに保存します。
        /// </summary>
        public static void SaveToYaml(MascotConfig config, string path)
        {
            try
            {
                string yaml = Save(config);
                
                // デバッグ用：生成されたYAMLをログ出力
                System.Diagnostics.Debug.WriteLine($"[MascotConfigIO] 保存するYAML:\n{yaml}");
                System.Diagnostics.Debug.WriteLine($"[MascotConfigIO] 保存先: {path}");
                
                // Voice設定の内容を確認
                if (config.Voice != null && config.Voice.Count > 0)
                {
                    System.Diagnostics.Debug.WriteLine($"[MascotConfigIO] Voice設定の数: {config.Voice.Count}");
                    foreach (var kvp in config.Voice)
                    {
                        System.Diagnostics.Debug.WriteLine($"[MascotConfigIO] Voice[{kvp.Key}]: Model={kvp.Value.Model}, Speaker={kvp.Value.Speaker}");
                    }
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine("[MascotConfigIO] Voice設定が空です");
                }
                
                File.WriteAllText(path, yaml);
                System.Diagnostics.Debug.WriteLine($"[MascotConfigIO] ファイルへの書き込み完了");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to save config to {path}: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"Exception: {ex}");
                throw;
            }
        }
    }
}
