using System;
using System.Collections.Generic;
using System.IO;
using Xunit;
using DesktopAiMascot.mascots;

namespace DesktopAiMascotTest.mascots
{
    /// <summary>
    /// マスコットのVoice設定機能のテストケース
    /// </summary>
    public class MascotVoiceConfigTests
    {
        [Fact]
        public void MascotConfig_VoiceProperty_ShouldBeInitialized()
        {
            // Arrange & Act
            var config = new MascotConfig();

            // Assert
            Assert.NotNull(config.Voice);
            Assert.Empty(config.Voice);
        }

        [Fact]
        public void VoiceServiceConfig_ShouldHaveModelAndSpeaker()
        {
            // Arrange
            var voiceConfig = new VoiceServiceConfig
            {
                Model = "koharune-ami",
                Speaker = "小春音アミ"
            };

            // Assert
            Assert.Equal("koharune-ami", voiceConfig.Model);
            Assert.Equal("小春音アミ", voiceConfig.Speaker);
        }

        [Fact]
        public void MascotConfig_CanAddVoiceConfiguration()
        {
            // Arrange
            var config = new MascotConfig();
            var voiceConfig = new VoiceServiceConfig
            {
                Model = "jvnv-M1-jp",
                Speaker = "jvnv-M1-jp"
            };

            // Act
            config.Voice["StyleBertVits2"] = voiceConfig;

            // Assert
            Assert.Single(config.Voice);
            Assert.True(config.Voice.ContainsKey("StyleBertVits2"));
            Assert.Equal("jvnv-M1-jp", config.Voice["StyleBertVits2"].Model);
            Assert.Equal("jvnv-M1-jp", config.Voice["StyleBertVits2"].Speaker);
        }

        [Fact]
        public void MascotConfig_CanAddMultipleVoiceServices()
        {
            // Arrange
            var config = new MascotConfig();

            // Act
            config.Voice["StyleBertVits2"] = new VoiceServiceConfig
            {
                Model = "koharune-ami",
                Speaker = "小春音アミ"
            };
            config.Voice["VOICEVOX"] = new VoiceServiceConfig
            {
                Model = "ずんだもん",
                Speaker = "ノーマル"
            };

            // Assert
            Assert.Equal(2, config.Voice.Count);
            Assert.True(config.Voice.ContainsKey("StyleBertVits2"));
            Assert.True(config.Voice.ContainsKey("VOICEVOX"));
        }

        [Fact]
        public void MascotConfigIO_ShouldSerializeVoiceConfig()
        {
            // Arrange
            var config = new MascotConfig();
            config.SystemPrompt.Profile.Name = "テストマスコット";
            config.Voice["StyleBertVits2"] = new VoiceServiceConfig
            {
                Model = "test-model",
                Speaker = "test-speaker"
            };

            // Act
            string yaml = MascotConfigIO.Save(config);

            // Assert
            Assert.Contains("voice:", yaml);
            Assert.Contains("StyleBertVits2:", yaml);
            Assert.Contains("model: test-model", yaml);
            Assert.Contains("speaker: test-speaker", yaml);
        }

        [Fact]
        public void MascotConfigIO_ShouldDeserializeVoiceConfig()
        {
            // Arrange
            string yaml = @"
system_prompt:
  profile:
    name: テストマスコット
voice:
  StyleBertVits2:
    model: koharune-ami
    speaker: 小春音アミ
";

            // Act
            var config = MascotConfigIO.Load(yaml);

            // Assert
            Assert.NotNull(config.Voice);
            Assert.Single(config.Voice);
            Assert.True(config.Voice.ContainsKey("StyleBertVits2"));
            Assert.Equal("koharune-ami", config.Voice["StyleBertVits2"].Model);
            Assert.Equal("小春音アミ", config.Voice["StyleBertVits2"].Speaker);
        }

        [Fact]
        public void MascotConfigIO_ShouldHandleEmptyVoiceConfig()
        {
            // Arrange
            string yaml = @"
system_prompt:
  profile:
    name: テストマスコット
";

            // Act
            var config = MascotConfigIO.Load(yaml);

            // Assert
            Assert.NotNull(config.Voice);
            Assert.Empty(config.Voice);
        }

        [Fact]
        public void MascotModel_SaveVoiceConfig_ShouldUpdateConfig()
        {
            // Arrange
            var tempFile = Path.GetTempFileName();
            try
            {
                var model = new MascotModel(
                    "テストマスコット",
                    "test prompt",
                    new string[] { },
                    tempFile
                );

                // Act
                model.SaveVoiceConfig("StyleBertVits2", "test-model", "test-speaker");

                // Assert
                Assert.NotNull(model.Config.Voice);
                Assert.True(model.Config.Voice.ContainsKey("StyleBertVits2"));
                Assert.Equal("test-model", model.Config.Voice["StyleBertVits2"].Model);
                Assert.Equal("test-speaker", model.Config.Voice["StyleBertVits2"].Speaker);

                // ファイルが保存されたことを確認
                Assert.True(File.Exists(tempFile));
                string content = File.ReadAllText(tempFile);
                Assert.Contains("voice:", content);
                Assert.Contains("StyleBertVits2:", content);
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
        public void MascotModel_SaveVoiceConfig_ShouldOverwriteExistingConfig()
        {
            // Arrange
            var tempFile = Path.GetTempFileName();
            try
            {
                var model = new MascotModel(
                    "テストマスコット",
                    "test prompt",
                    new string[] { },
                    tempFile
                );

                // Act - 初回保存
                model.SaveVoiceConfig("StyleBertVits2", "model1", "speaker1");
                
                // Act - 上書き保存
                model.SaveVoiceConfig("StyleBertVits2", "model2", "speaker2");

                // Assert
                Assert.Single(model.Config.Voice);
                Assert.Equal("model2", model.Config.Voice["StyleBertVits2"].Model);
                Assert.Equal("speaker2", model.Config.Voice["StyleBertVits2"].Speaker);
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
        public void MascotConfigIO_RoundTrip_ShouldPreserveVoiceConfig()
        {
            // Arrange
            var originalConfig = new MascotConfig();
            originalConfig.SystemPrompt.Profile.Name = "テストマスコット";
            originalConfig.Voice["StyleBertVits2"] = new VoiceServiceConfig
            {
                Model = "koharune-ami",
                Speaker = "小春音アミ"
            };
            originalConfig.Voice["VOICEVOX"] = new VoiceServiceConfig
            {
                Model = "ずんだもん",
                Speaker = "ノーマル"
            };

            // Act - シリアライズしてデシリアライズ
            string yaml = MascotConfigIO.Save(originalConfig);
            var deserializedConfig = MascotConfigIO.Load(yaml);

            // Assert
            Assert.Equal(2, deserializedConfig.Voice.Count);
            Assert.Equal("koharune-ami", deserializedConfig.Voice["StyleBertVits2"].Model);
            Assert.Equal("小春音アミ", deserializedConfig.Voice["StyleBertVits2"].Speaker);
            Assert.Equal("ずんだもん", deserializedConfig.Voice["VOICEVOX"].Model);
            Assert.Equal("ノーマル", deserializedConfig.Voice["VOICEVOX"].Speaker);
        }
    }
}
