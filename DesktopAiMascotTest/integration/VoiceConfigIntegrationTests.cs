using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.aiservice.voice;
using DesktopAiMascot.aiservice.voice.schemas;
using DesktopAiMascot.mascots;

namespace DesktopAiMascotTest.integration
{
    /// <summary>
    /// Voice設定の統合テスト（実際のワークフローをテスト）
    /// </summary>
    public class VoiceConfigIntegrationTests
    {
        [Fact]
        public void Scenario_SaveAndLoadVoiceConfig_ShouldWork()
        {
            // Arrange
            var tempFile = Path.GetTempFileName();
            try
            {
                var mascot = new MascotModel(
                    "テストマスコット",
                    "test prompt",
                    new string[] { },
                    tempFile
                );

                // Act - Step 1: Voice設定を保存
                mascot.SaveVoiceConfig("StyleBertVits2", "test-model", "test-speaker");

                // Act - Step 2: ファイルから再読み込み
                var yaml = File.ReadAllText(tempFile);
                var loadedConfig = MascotConfigIO.Load(yaml);

                // Assert
                Assert.NotNull(loadedConfig.Voice);
                Assert.True(loadedConfig.Voice.ContainsKey("StyleBertVits2"));
                Assert.Equal("test-model", loadedConfig.Voice["StyleBertVits2"].Model);
                Assert.Equal("test-speaker", loadedConfig.Voice["StyleBertVits2"].Speaker);
            }
            finally
            {
                if (File.Exists(tempFile))
                {
                    File.Delete(tempFile);
                }
            }
        }

        [Fact]
        public void Scenario_SwitchMascot_VoiceConfigShouldChange()
        {
            // Arrange
            var tempFile1 = Path.GetTempFileName();
            var tempFile2 = Path.GetTempFileName();
            
            try
            {
                var mascot1 = new MascotModel("マスコット1", "prompt1", new string[] { }, tempFile1);
                var mascot2 = new MascotModel("マスコット2", "prompt2", new string[] { }, tempFile2);

                // それぞれ異なるVoice設定を保存
                mascot1.SaveVoiceConfig("StyleBertVits2", "model1", "speaker1");
                mascot2.SaveVoiceConfig("StyleBertVits2", "model2", "speaker2");

                // Act & Assert - マスコット1のVoice設定
                Assert.Equal("model1", mascot1.Config.Voice["StyleBertVits2"].Model);
                Assert.Equal("speaker1", mascot1.Config.Voice["StyleBertVits2"].Speaker);

                // Act & Assert - マスコット2のVoice設定
                Assert.Equal("model2", mascot2.Config.Voice["StyleBertVits2"].Model);
                Assert.Equal("speaker2", mascot2.Config.Voice["StyleBertVits2"].Speaker);
            }
            finally
            {
                if (File.Exists(tempFile1)) File.Delete(tempFile1);
                if (File.Exists(tempFile2)) File.Delete(tempFile2);
            }
        }

        [Fact]
        public void Scenario_MultipleVoiceServices_ShouldCoexist()
        {
            // Arrange
            var tempFile = Path.GetTempFileName();
            
            try
            {
                var mascot = new MascotModel("マルチサービステスト", "prompt", new string[] { }, tempFile);

                // Act - 複数のVoice AIサービスの設定を保存
                mascot.SaveVoiceConfig("StyleBertVits2", "sbv2-model", "sbv2-speaker");
                mascot.SaveVoiceConfig("VOICEVOX", "voicevox-model", "voicevox-speaker");
                mascot.SaveVoiceConfig("COEIROINK", "coeiroink-model", "coeiroink-speaker");

                // Assert - すべての設定が保存されている
                Assert.Equal(3, mascot.Config.Voice.Count);
                Assert.Equal("sbv2-model", mascot.Config.Voice["StyleBertVits2"].Model);
                Assert.Equal("voicevox-model", mascot.Config.Voice["VOICEVOX"].Model);
                Assert.Equal("coeiroink-model", mascot.Config.Voice["COEIROINK"].Model);

                // ファイルから再読み込みして確認
                var yaml = File.ReadAllText(tempFile);
                var loadedConfig = MascotConfigIO.Load(yaml);
                Assert.Equal(3, loadedConfig.Voice.Count);
            }
            finally
            {
                if (File.Exists(tempFile)) File.Delete(tempFile);
            }
        }

        [Fact]
        public void Scenario_UpdateExistingVoiceConfig_ShouldOverwrite()
        {
            // Arrange
            var tempFile = Path.GetTempFileName();
            
            try
            {
                var mascot = new MascotModel("更新テスト", "prompt", new string[] { }, tempFile);

                // Act - Step 1: 初回保存
                mascot.SaveVoiceConfig("StyleBertVits2", "old-model", "old-speaker");
                var firstYaml = File.ReadAllText(tempFile);

                // Act - Step 2: 更新
                mascot.SaveVoiceConfig("StyleBertVits2", "new-model", "new-speaker");
                var updatedYaml = File.ReadAllText(tempFile);

                // Assert
                Assert.Single(mascot.Config.Voice);
                Assert.Equal("new-model", mascot.Config.Voice["StyleBertVits2"].Model);
                Assert.Equal("new-speaker", mascot.Config.Voice["StyleBertVits2"].Speaker);

                // YAMLファイルも更新されている
                Assert.NotEqual(firstYaml, updatedYaml);
                Assert.Contains("new-model", updatedYaml);
                Assert.DoesNotContain("old-model", updatedYaml);
            }
            finally
            {
                if (File.Exists(tempFile)) File.Delete(tempFile);
            }
        }

        [Fact]
        public void Scenario_VoiceConfigNotSet_ShouldReturnEmptyDictionary()
        {
            // Arrange
            var tempFile = Path.GetTempFileName();
            
            try
            {
                var mascot = new MascotModel("設定なし", "prompt", new string[] { }, tempFile);

                // Act - Voice設定を保存せずにConfigを確認
                var voiceConfig = mascot.Config.Voice;

                // Assert
                Assert.NotNull(voiceConfig);
                Assert.Empty(voiceConfig);
            }
            finally
            {
                if (File.Exists(tempFile)) File.Delete(tempFile);
            }
        }

        [Fact]
        public void Scenario_LoadConfigWithSystemPromptAndVoice_ShouldPreserveBoth()
        {
            // Arrange
            string yaml = @"
system_prompt:
  profile:
    name: テストマスコット
    age: 16
    birthday: 8月31日
  personality:
    - 明るい
    - 元気
voice:
  StyleBertVits2:
    model: test-model
    speaker: test-speaker
";
            // Act
            var config = MascotConfigIO.Load(yaml);

            // Assert - SystemPromptとVoiceの両方が正しく読み込まれる
            Assert.Equal("テストマスコット", config.SystemPrompt.Profile.Name);
            Assert.Equal("16", config.SystemPrompt.Profile.Age);
            Assert.Equal(2, config.SystemPrompt.Personality.Count);
            
            Assert.NotNull(config.Voice);
            Assert.Single(config.Voice);
            Assert.Equal("test-model", config.Voice["StyleBertVits2"].Model);
            Assert.Equal("test-speaker", config.Voice["StyleBertVits2"].Speaker);
        }

        [Fact]
        public void Scenario_EmptyModelOrSpeaker_ShouldBeHandled()
        {
            // Arrange
            var tempFile = Path.GetTempFileName();
            
            try
            {
                var mascot = new MascotModel("空設定テスト", "prompt", new string[] { }, tempFile);

                // Act - 空の値で保存
                mascot.SaveVoiceConfig("StyleBertVits2", "", "");

                // Assert - 空の値でも保存される
                Assert.True(mascot.Config.Voice.ContainsKey("StyleBertVits2"));
                Assert.Equal("", mascot.Config.Voice["StyleBertVits2"].Model);
                Assert.Equal("", mascot.Config.Voice["StyleBertVits2"].Speaker);
            }
            finally
            {
                if (File.Exists(tempFile)) File.Delete(tempFile);
            }
        }
    }
}
