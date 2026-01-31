using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.mascots;
using Xunit;

namespace DesktopAiMascotTest.integration
{
    /// <summary>
    /// VoiceVoxとマスコットの統合テスト
    /// </summary>
    public class VoiceVoxMascotIntegrationTests : IDisposable
    {
        private readonly string _testMascotDir;
        private readonly string _testConfigPath;

        public VoiceVoxMascotIntegrationTests()
        {
            // テスト用の一時ディレクトリを作成
            _testMascotDir = Path.Combine(Path.GetTempPath(), $"test_mascot_{Guid.NewGuid()}");
            Directory.CreateDirectory(_testMascotDir);
            _testConfigPath = Path.Combine(_testMascotDir, "config.yaml");
        }

        public void Dispose()
        {
            // テスト用のディレクトリをクリーンアップ
            if (Directory.Exists(_testMascotDir))
            {
                Directory.Delete(_testMascotDir, true);
            }
        }

        [Fact]
        public void VoiceVoxService_IsRegisteredInVoiceAiManager()
        {
            // Act
            var services = VoiceAiManager.Instance.VoiceAiServices;

            // Assert
            Assert.Contains("VoiceVox", services.Keys);
            Assert.NotNull(services["VoiceVox"]);
            Assert.Equal("VoiceVox", services["VoiceVox"].Name);
        }

        [Fact]
        public void VoiceVoxService_HasCorrectEndPoint()
        {
            // Arrange
            var voiceVox = VoiceAiManager.Instance.VoiceAiServices["VoiceVox"];

            // Assert
            Assert.Equal("http://localhost:50021", voiceVox.EndPoint);
        }

        [Fact]
        public void MascotConfig_CanSaveVoiceVoxConfig()
        {
            // Arrange
            var config = new MascotConfig();

            var voiceConfig = new VoiceServiceConfig
            {
                Model = "", // VoiceVoxはモデルの概念がない
                Speaker = "四国めたん (ノーマル) [2]"
            };

            // Act
            config.Voice["VoiceVox"] = voiceConfig;

            // Assert
            Assert.True(config.Voice.ContainsKey("VoiceVox"));
            Assert.Equal("", config.Voice["VoiceVox"].Model);
            Assert.Equal("四国めたん (ノーマル) [2]", config.Voice["VoiceVox"].Speaker);
        }

        [Fact]
        public void MascotModel_CanSaveVoiceVoxConfig()
        {
            // Arrange
            var initialConfig = @"
SystemPrompt:
  Profile:
    Name: TestMascot
";
            File.WriteAllText(_testConfigPath, initialConfig);
            
            var mascot = new MascotModel(
                _testMascotDir,
                _testMascotDir,
                new string[] { },
                "");

            // Act
            mascot.SaveVoiceConfig("VoiceVox", "", "四国めたん (ノーマル) [2]");

            // Assert
            var loadedConfig = MascotConfigIO.LoadFromFile(_testConfigPath);
            Assert.NotNull(loadedConfig.Voice);
            Assert.True(loadedConfig.Voice.ContainsKey("VoiceVox"));
            Assert.Equal("", loadedConfig.Voice["VoiceVox"].Model);
            Assert.Equal("四国めたん (ノーマル) [2]", loadedConfig.Voice["VoiceVox"].Speaker);
        }

        [Fact]
        public void MascotModel_CanSaveBothStyleBertVits2AndVoiceVoxConfigs()
        {
            // Arrange
            var initialConfig = @"
SystemPrompt:
  Profile:
    Name: TestMascot
";
            File.WriteAllText(_testConfigPath, initialConfig);
            
            var mascot = new MascotModel(
                _testMascotDir,
                _testMascotDir,
                new string[] { },
                "");

            // Act - StyleBertVits2の設定を保存
            mascot.SaveVoiceConfig("StyleBertVits2", "jvnv-F2-JP", "七海");
            
            // Act - VoiceVoxの設定を保存
            mascot.SaveVoiceConfig("VoiceVox", "", "四国めたん (ノーマル) [2]");

            // Assert
            var loadedConfig = MascotConfigIO.LoadFromFile(_testConfigPath);
            Assert.NotNull(loadedConfig.Voice);
            Assert.Equal(2, loadedConfig.Voice.Count);
            
            // StyleBertVits2の設定を確認
            Assert.True(loadedConfig.Voice.ContainsKey("StyleBertVits2"));
            Assert.Equal("jvnv-F2-JP", loadedConfig.Voice["StyleBertVits2"].Model);
            Assert.Equal("七海", loadedConfig.Voice["StyleBertVits2"].Speaker);
            
            // VoiceVoxの設定を確認
            Assert.True(loadedConfig.Voice.ContainsKey("VoiceVox"));
            Assert.Equal("", loadedConfig.Voice["VoiceVox"].Model);
            Assert.Equal("四国めたん (ノーマル) [2]", loadedConfig.Voice["VoiceVox"].Speaker);
        }

        [Fact]
        public void MascotModel_VoiceVoxConfigPersistsAcrossReloads()
        {
            // Arrange
            var initialConfig = @"
SystemPrompt:
  Profile:
    Name: TestMascot
";
            File.WriteAllText(_testConfigPath, initialConfig);
            
            var mascot1 = new MascotModel(
                _testMascotDir,
                _testMascotDir,
                new string[] { },
                "");
            mascot1.SaveVoiceConfig("VoiceVox", "", "四国めたん (あまあま) [0]");

            // Act - 新しいインスタンスでマスコットを再読み込み
            var mascot2 = new MascotModel(
                _testMascotDir,
                _testMascotDir,
                new string[] { },
                "");

            // Assert
            Assert.NotNull(mascot2.Config.Voice);
            Assert.True(mascot2.Config.Voice.ContainsKey("VoiceVox"));
            Assert.Equal("", mascot2.Config.Voice["VoiceVox"].Model);
            Assert.Equal("四国めたん (あまあま) [0]", mascot2.Config.Voice["VoiceVox"].Speaker);
        }

        [Fact]
        public void VoiceVoxConfig_ModelCanBeEmpty()
        {
            // Arrange
            var voiceConfig = new VoiceServiceConfig
            {
                Model = "",
                Speaker = "ずんだもん (ノーマル) [3]"
            };

            // Assert
            Assert.Equal("", voiceConfig.Model);
            Assert.NotNull(voiceConfig.Speaker);
        }

        [Fact]
        public void VoiceVoxConfig_SupportsMultipleSpeakerFormats()
        {
            // VoiceVoxのSpeaker形式: "キャラクター名 (スタイル名) [ID]"
            var testSpeakers = new[]
            {
                "四国めたん (ノーマル) [2]",
                "四国めたん (あまあま) [0]",
                "ずんだもん (ツンツン) [7]",
                "春日部つむぎ (セクシー) [10]"
            };

            foreach (var speaker in testSpeakers)
            {
                // Arrange
                var voiceConfig = new VoiceServiceConfig
                {
                    Model = "",
                    Speaker = speaker
                };

                // Assert
                Assert.NotNull(voiceConfig.Speaker);
                Assert.Contains("(", voiceConfig.Speaker);
                Assert.Contains(")", voiceConfig.Speaker);
                Assert.Contains("[", voiceConfig.Speaker);
                Assert.Contains("]", voiceConfig.Speaker);
            }
        }

        [Fact]
        public void MascotModel_CanUpdateVoiceVoxSpeaker()
        {
            // Arrange
            var initialConfig = @"
SystemPrompt:
  Profile:
    Name: TestMascot
";
            File.WriteAllText(_testConfigPath, initialConfig);
            
            var mascot = new MascotModel(
                _testMascotDir,
                _testMascotDir,
                new string[] { },
                "");

            // 最初の設定を保存
            mascot.SaveVoiceConfig("VoiceVox", "", "四国めたん (ノーマル) [2]");

            // Act - 設定を更新
            mascot.SaveVoiceConfig("VoiceVox", "", "四国めたん (あまあま) [0]");

            // Assert
            var loadedConfig = MascotConfigIO.LoadFromFile(_testConfigPath);
            Assert.NotNull(loadedConfig.Voice);
            Assert.True(loadedConfig.Voice.ContainsKey("VoiceVox"));
            Assert.Equal("四国めたん (あまあま) [0]", loadedConfig.Voice["VoiceVox"].Speaker);
        }
    }
}

