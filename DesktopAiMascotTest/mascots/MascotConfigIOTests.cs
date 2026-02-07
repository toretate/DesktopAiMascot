using Xunit;
using DesktopAiMascot.mascots;
using System;
using System.IO;
using System.Diagnostics;
using System.Collections.Generic;
using System.Linq;

namespace DesktopAiMascotTest.mascots
{
    /// <summary>
    /// MascotConfigIO のテスト - 全マスコットの config.yaml が正しく処理されるか確認
    /// プライベートマスコットはローカルでのみテスト実行
    /// </summary>
    public class MascotConfigIOTests
    {
        /// <summary>
        /// ローカル環境でのテストかどうかを判定
        /// 環境変数 "MASCOT_TEST_LOCAL" が設定されている場合、プライベートマスコットもテスト対象
        /// </summary>
        private bool IsLocalTestEnvironment => 
            !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("MASCOT_TEST_LOCAL"));

        /// <summary>
        /// 公開マスコット（GitHub で公開しているもの）を定義
        /// </summary>
        private static readonly HashSet<string> PublicMascots = new(StringComparer.OrdinalIgnoreCase)
        {
            "default"
        };

        private string GetMascotConfigPath(string mascotName)
        {
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            return Path.Combine(baseDir, "assets", "mascots", mascotName, "config.yaml");
        }

        private string LoadYamlContent(string mascotName)
        {
            var configPath = GetMascotConfigPath(mascotName);
            if (!File.Exists(configPath))
            {
                throw new FileNotFoundException($"config.yaml not found: {configPath}");
            }
            return File.ReadAllText(configPath);
        }

        /// <summary>
        /// assets/mascots フォルダから存在するすべてのマスコットを取得
        /// </summary>
        private static List<string> GetAvailableMascots()
        {
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            var mascotsDir = Path.Combine(baseDir, "assets", "mascots");

            if (!Directory.Exists(mascotsDir))
            {
                return new List<string>();
            }

            return Directory.GetDirectories(mascotsDir)
                .Select(dir => Path.GetFileName(dir))
                .Where(name => !string.IsNullOrEmpty(name))
                .ToList();
        }

        /// <summary>
        /// Theory テスト用のマスコットリスト取得メソッド
        /// 実行時に assets/mascots フォルダをスキャンして、テスト対象マスコットを取得
        /// </summary>
        public static IEnumerable<object[]> GetTargetMascotsForTheory()
        {
            var isLocal = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("MASCOT_TEST_LOCAL"));
            var availableMascots = GetAvailableMascots();

            IEnumerable<string> targetMascots;

            if (isLocal)
            {
                // ローカル環境：存在するすべてのマスコットをテスト対象
                targetMascots = availableMascots.OrderBy(m => m);
            }
            else
            {
                // CI環境：公開マスコットのみ
                targetMascots = availableMascots
                    .Where(m => PublicMascots.Contains(m))
                    .OrderBy(m => m);
            }

            return targetMascots.Select(m => new object[] { m });
        }

        [Theory]
        [MemberData(nameof(GetTargetMascotsForTheory))]
        public void ParseFromYaml_すべてのマスコットで正しくパースできる(string mascotName)
        {
            // Arrange
            var yaml = LoadYamlContent(mascotName);

            // Act
            var (name, prompt, config) = MascotConfigIO.ParseFromYaml(yaml, mascotName);

            // Assert
            Assert.NotNull(name);
            Assert.NotEmpty(name);
            Assert.NotNull(prompt);
            Assert.NotEmpty(prompt);
            
            Debug.WriteLine($"[{mascotName}] マスコット名: {name}");
            Debug.WriteLine($"[{mascotName}] プロンプト長: {prompt.Length}");
        }

        [Theory]
        [MemberData(nameof(GetTargetMascotsForTheory))]
        public void ParseFromYaml_SystemPromptが正しく解析される(string mascotName)
        {
            // Arrange
            var yaml = LoadYamlContent(mascotName);

            // Act
            var (_, _, config) = MascotConfigIO.ParseFromYaml(yaml, mascotName);

            // Assert
            Assert.NotNull(config.SystemPrompt);
            Assert.NotNull(config.SystemPrompt.Profile);
            Assert.NotEmpty(config.SystemPrompt.Profile.Name);
            
            Debug.WriteLine($"[{mascotName}] キャラクター名: {config.SystemPrompt.Profile.Name}");
            Debug.WriteLine($"[{mascotName}] 性格要素数: {config.SystemPrompt.Personality?.Count ?? 0}");
            Debug.WriteLine($"[{mascotName}] 会話スタイル要素数: {config.SystemPrompt.ConversationStyle?.Count ?? 0}");
        }

        [Theory]
        [MemberData(nameof(GetTargetMascotsForTheory))]
        public void ParseFromYaml_プロンプトが人間が読める形式で生成される(string mascotName)
        {
            // Arrange
            var yaml = LoadYamlContent(mascotName);

            // Act
            var (_, prompt, _) = MascotConfigIO.ParseFromYaml(yaml, mascotName);

            // Assert
            // プロンプトには以下の要素を含むはず
            Assert.Contains("キャラクター名:", prompt);
            
            // 性格セクションが含まれるはず
            Assert.Contains("【", prompt);
            
            Debug.WriteLine($"[{mascotName}] プロンプト内容 (最初の300文字):");
            Debug.WriteLine(prompt.Length > 300 ? prompt.Substring(0, 300) + "..." : prompt);
        }

        [Theory]
        [MemberData(nameof(GetTargetMascotsForTheory))]
        public void ParseFromYaml_Personalityが配列として解析される(string mascotName)
        {
            // Arrange
            var yaml = LoadYamlContent(mascotName);

            // Act
            var (_, _, config) = MascotConfigIO.ParseFromYaml(yaml, mascotName);

            // Assert
            Assert.NotNull(config.SystemPrompt.Personality);
            Assert.NotEmpty(config.SystemPrompt.Personality);
            
            foreach (var trait in config.SystemPrompt.Personality)
            {
                Assert.NotEmpty(trait);
            }
            
            Debug.WriteLine($"[{mascotName}] 性格特性:");
            foreach (var trait in config.SystemPrompt.Personality)
            {
                Debug.WriteLine($"  - {trait}");
            }
        }

        [Theory]
        [MemberData(nameof(GetTargetMascotsForTheory))]
        public void ParseFromYaml_SpeechStyleが正しく解析される(string mascotName)
        {
            // Arrange
            var yaml = LoadYamlContent(mascotName);

            // Act
            var (_, _, config) = MascotConfigIO.ParseFromYaml(yaml, mascotName);

            // Assert
            Assert.NotNull(config.SystemPrompt.SpeechStyle);
            Assert.NotEmpty(config.SystemPrompt.SpeechStyle.FirstPerson);
            
            Debug.WriteLine($"[{mascotName}] 一人称: {config.SystemPrompt.SpeechStyle.FirstPerson}");
            Debug.WriteLine($"[{mascotName}] 話し方パターン数: {config.SystemPrompt.SpeechStyle.SpeechPatterns?.Count ?? 0}");
        }

        [Theory]
        [MemberData(nameof(GetTargetMascotsForTheory))]
        public void ParseFromYaml_Voice設定が存在する(string mascotName)
        {
            // Arrange
            var yaml = LoadYamlContent(mascotName);

            // Act
            var (_, _, config) = MascotConfigIO.ParseFromYaml(yaml, mascotName);

            // Assert
            Assert.NotNull(config.Voice);
            
            Debug.WriteLine($"[{mascotName}] Voice設定数: {config.Voice?.Count ?? 0}");
            if (config.Voice != null && config.Voice.Count > 0)
            {
                foreach (var kvp in config.Voice)
                {
                    Debug.WriteLine($"[{mascotName}]   {kvp.Key}: Model={kvp.Value.Model}, Speaker={kvp.Value.Speaker}");
                }
            }
        }
    }
}
