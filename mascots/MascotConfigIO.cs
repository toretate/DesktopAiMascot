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
        /// システムプロンプトの YAML を読み込み、SystemPrompt オブジェクトを作成します。
        /// </summary>
        public static SystemPrompt LoadSystemPrompt(string yaml)
        {
            if (string.IsNullOrWhiteSpace(yaml))
            {
                return new SystemPrompt();
            }

            var deserializer = new DeserializerBuilder()
                .WithNamingConvention(UnderscoredNamingConvention.Instance)
                .IgnoreUnmatchedProperties()
                .Build();

            try
            {
                return deserializer.Deserialize<SystemPrompt>(yaml) ?? new SystemPrompt();
            }
            catch
            {
                return new SystemPrompt();
            }
        }

        /// <summary>
        /// SystemPrompt オブジェクトを YAML 文字列に変換します。
        /// </summary>
        public static string SaveSystemPrompt(SystemPrompt prompt)
        {
            var serializer = new SerializerBuilder()
                .WithNamingConvention(UnderscoredNamingConvention.Instance)
                .Build();

            return serializer.Serialize(prompt);
        }

        /// <summary>
        /// YAML 文字列から MascotConfig オブジェクトを作成します。
        /// </summary>
        public static MascotConfig Load(string yaml)
        {
            if (string.IsNullOrWhiteSpace(yaml)) return new MascotConfig();

            // YamlMember属性を優先的に使用して、スネークケースの自動変換を無効にする
            var deserializer = new DeserializerBuilder()
                .IgnoreUnmatchedProperties()
                .Build();

            try
            {
                var result = deserializer.Deserialize<MascotConfig>(yaml);
                
                // デバッグログ
                System.Diagnostics.Debug.WriteLine($"[MascotConfigIO.Load] 解析成功");
                System.Diagnostics.Debug.WriteLine($"[MascotConfigIO.Load] SystemPrompt is null: {result?.SystemPrompt == null}");
                if (result?.SystemPrompt != null)
                {
                    System.Diagnostics.Debug.WriteLine($"[MascotConfigIO.Load] Profile.Name: {result.SystemPrompt.Profile?.Name}");
                    System.Diagnostics.Debug.WriteLine($"[MascotConfigIO.Load] Personality.Count: {result.SystemPrompt.Personality?.Count ?? -1}");
                }
                
                return result ?? new MascotConfig();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[MascotConfigIO.Load] パース失敗: {ex.Message}");
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

            // プロンプト文字列を生成（SystemPrompt から人間が読めるプロンプトテキストを生成）
            string prompt = GenerateSystemPrompt(config.SystemPrompt);
            
            // デバッグログ
            System.Diagnostics.Debug.WriteLine($"[MascotConfigIO] ParseFromYaml - マスコット名: {name}");
            System.Diagnostics.Debug.WriteLine($"[MascotConfigIO] SystemPrompt.Profile.Name: {config.SystemPrompt.Profile.Name}");
            System.Diagnostics.Debug.WriteLine($"[MascotConfigIO] SystemPrompt.Personality.Count: {config.SystemPrompt.Personality.Count}");
            System.Diagnostics.Debug.WriteLine($"[MascotConfigIO] 生成されたプロンプト長: {prompt.Length}");
            if (prompt.Length > 200)
            {
                System.Diagnostics.Debug.WriteLine($"[MascotConfigIO] プロンプト (最初の200文字): {prompt.Substring(0, 200)}...");
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"[MascotConfigIO] プロンプト: {prompt}");
            }

            return (name, prompt, config);
        }

        /// <summary>
        /// SystemPrompt オブジェクトから AI に送信するシステムプロンプトテキストを生成します。
        /// </summary>
        private static string GenerateSystemPrompt(SystemPrompt systemPrompt)
        {
            var sb = new System.Text.StringBuilder();
            
            System.Diagnostics.Debug.WriteLine($"[GenerateSystemPrompt] 開始");
            System.Diagnostics.Debug.WriteLine($"[GenerateSystemPrompt] Profile.Name: {systemPrompt?.Profile?.Name}");

            // プロフィール情報
            var profile = systemPrompt.Profile;
            if (!string.IsNullOrWhiteSpace(profile.Name))
            {
                sb.AppendLine($"キャラクター名: {profile.Name}");
            }
            if (!string.IsNullOrWhiteSpace(profile.Age))
            {
                sb.AppendLine($"年齢: {profile.Age}");
            }
            if (!string.IsNullOrWhiteSpace(profile.Birthday))
            {
                sb.AppendLine($"誕生日: {profile.Birthday}");
            }
            if (!string.IsNullOrWhiteSpace(profile.Height))
            {
                sb.AppendLine($"身長: {profile.Height}");
            }
            if (!string.IsNullOrWhiteSpace(profile.Affiliation))
            {
                sb.AppendLine($"所属: {profile.Affiliation}");
            }

            sb.AppendLine();

            // 性格
            System.Diagnostics.Debug.WriteLine($"[GenerateSystemPrompt] Personality.Count: {systemPrompt.Personality.Count}");
            if (systemPrompt.Personality != null && systemPrompt.Personality.Count > 0)
            {
                sb.AppendLine("【性格】");
                foreach (var trait in systemPrompt.Personality)
                {
                    if (!string.IsNullOrWhiteSpace(trait))
                    {
                        sb.AppendLine($"- {trait}");
                    }
                }
                sb.AppendLine();
            }

            // 話し方
            var speechStyle = systemPrompt.SpeechStyle;
            if (!string.IsNullOrWhiteSpace(speechStyle.FirstPerson))
            {
                sb.AppendLine($"【一人称】{speechStyle.FirstPerson}");
                sb.AppendLine();
            }

            if (speechStyle.SpeechPatterns != null && speechStyle.SpeechPatterns.Count > 0)
            {
                sb.AppendLine("【話し方の特徴】");
                foreach (var pattern in speechStyle.SpeechPatterns)
                {
                    if (!string.IsNullOrWhiteSpace(pattern))
                    {
                        sb.AppendLine($"- {pattern}");
                    }
                }
                sb.AppendLine();
            }

            // 会話スタイル
            System.Diagnostics.Debug.WriteLine($"[GenerateSystemPrompt] ConversationStyle.Count: {systemPrompt.ConversationStyle.Count}");
            if (systemPrompt.ConversationStyle != null && systemPrompt.ConversationStyle.Count > 0)
            {
                sb.AppendLine("【会話スタイル】");
                foreach (var style in systemPrompt.ConversationStyle)
                {
                    if (!string.IsNullOrWhiteSpace(style))
                    {
                        sb.AppendLine($"- {style}");
                    }
                }
                sb.AppendLine();
            }

            // 禁止事項
            if (systemPrompt.Prohibitions != null && systemPrompt.Prohibitions.Count > 0)
            {
                sb.AppendLine("【禁止事項】");
                foreach (var prohibition in systemPrompt.Prohibitions)
                {
                    if (!string.IsNullOrWhiteSpace(prohibition))
                    {
                        sb.AppendLine($"- {prohibition}");
                    }
                }
                sb.AppendLine();
            }

            // 最後に、テキスト形式の注釈があれば追加
            if (systemPrompt.Notes != null && systemPrompt.Notes.Count > 0)
            {
                foreach (var note in systemPrompt.Notes)
                {
                    if (!string.IsNullOrWhiteSpace(note))
                    {
                        sb.AppendLine(note);
                    }
                }
            }

            var result = sb.ToString().Trim();
            System.Diagnostics.Debug.WriteLine($"[GenerateSystemPrompt] 完了 - 長さ: {result.Length}");
            return result;
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
