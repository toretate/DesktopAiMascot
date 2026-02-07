using Xunit;
using DesktopAiMascot.mascots;
using System;
using System.IO;
using System.Diagnostics;
using System.Collections.Generic;

namespace DesktopAiMascotTest.mascots
{
    /// <summary>
    /// MascotConfigIO のテスト - 全マスコットの config.yaml が正しく処理されるか確認
    /// プライベートマスコットはローカルでのみテスト実行
    /// </summary>
    public class MascotConfigIOTests
    {
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
            Assert.Contains("キャラクター名:", prompt);
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
            
            Debug.WriteLine($"[{mascotName}] 性格特性数: {config.SystemPrompt.Personality.Count}");
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
        }

        /// <summary>
        /// Theory テスト用のマスコットリスト取得メソッド
        /// </summary>
        public static IEnumerable<object[]> GetTargetMascotsForTheory() => MascotTestHelper.GetTargetMascotsForTheory();
    }
}
