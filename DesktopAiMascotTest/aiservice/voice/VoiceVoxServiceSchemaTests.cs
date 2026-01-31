using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice.voice;
using Xunit;

namespace DesktopAiMascotTest.aiservice.voice
{
    /// <summary>
    /// VoiceVoxServiceのスキーマテスト
    /// JSONスキーマファイルとの整合性を検証します
    /// </summary>
    public class VoiceVoxServiceSchemaTests
    {
        private readonly string _schemasDir;

        public VoiceVoxServiceSchemaTests()
        {
            // テストプロジェクトのルートディレクトリを取得
            var testProjectDir = Directory.GetCurrentDirectory();
            
            // ソリューションのルートディレクトリに移動
            while (!Directory.Exists(Path.Combine(testProjectDir, "DesktopAiMascot")) && 
                   Directory.GetParent(testProjectDir) != null)
            {
                testProjectDir = Directory.GetParent(testProjectDir).FullName;
            }
            
            // スキーマディレクトリへのパスを構築
            _schemasDir = Path.Combine(testProjectDir, "DesktopAiMascot", "aiservice", "voice", "schemas");
        }

        #region スキーマファイルの存在確認

        [Fact]
        public void SchemasDirectory_Exists()
        {
            // Assert
            Assert.True(Directory.Exists(_schemasDir), $"スキーマディレクトリが存在しません: {_schemasDir}");
        }

        [Theory]
        [InlineData("VoiceVox_Speaker_Response.json")]
        [InlineData("VoiceVox_AudioQuery_Response.json")]
        [InlineData("VoiceVox_SpeakerInfo_Response.json")]
        [InlineData("VoiceVox_CoreVersions_Response.json")]
        public void SchemaFile_Exists(string fileName)
        {
            // Arrange
            var filePath = Path.Combine(_schemasDir, fileName);

            // Assert
            Assert.True(File.Exists(filePath), $"スキーマファイルが存在しません: {filePath}");
        }

        #endregion

        #region Speaker スキーマテスト

        [Fact]
        public void SpeakerSchema_CanBeDeserialized()
        {
            // Arrange
            var filePath = Path.Combine(_schemasDir, "VoiceVox_Speaker_Response.json");
            var json = File.ReadAllText(filePath);

            // Act
            var speakers = JsonSerializer.Deserialize<VoiceVoxSpeaker[]>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            // Assert
            Assert.NotNull(speakers);
            Assert.NotEmpty(speakers);
            
            foreach (var speaker in speakers)
            {
                Assert.NotEmpty(speaker.Name);
                Assert.NotEmpty(speaker.Speaker_Uuid);
                Assert.NotNull(speaker.Styles);
                Assert.NotEmpty(speaker.Styles);
                
                foreach (var style in speaker.Styles)
                {
                    Assert.NotEmpty(style.Name);
                    Assert.True(style.Id >= 0);
                }
            }
        }

        [Fact]
        public void SpeakerSchema_ContainsExpectedFields()
        {
            // Arrange
            var filePath = Path.Combine(_schemasDir, "VoiceVox_Speaker_Response.json");
            var json = File.ReadAllText(filePath);
            var speakers = JsonSerializer.Deserialize<VoiceVoxSpeaker[]>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            // Assert
            Assert.NotNull(speakers);
            var speaker = speakers[0];
            
            Assert.NotNull(speaker.Name);
            Assert.NotNull(speaker.Speaker_Uuid);
            Assert.NotNull(speaker.Styles);
            Assert.NotNull(speaker.Version);
        }

        [Fact]
        public void SpeakerStyleSchema_ContainsExpectedFields()
        {
            // Arrange
            var filePath = Path.Combine(_schemasDir, "VoiceVox_Speaker_Response.json");
            var json = File.ReadAllText(filePath);
            var speakers = JsonSerializer.Deserialize<VoiceVoxSpeaker[]>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            // Assert
            Assert.NotNull(speakers);
            var style = speakers[0].Styles[0];
            
            Assert.NotNull(style.Name);
            Assert.True(style.Id >= 0);
            Assert.NotNull(style.Type);
        }

        #endregion

        #region AudioQuery スキーマテスト

        [Fact]
        public void AudioQuerySchema_CanBeDeserialized()
        {
            // Arrange
            var filePath = Path.Combine(_schemasDir, "VoiceVox_AudioQuery_Response.json");
            var json = File.ReadAllText(filePath);

            // Act
            var audioQuery = JsonSerializer.Deserialize<VoiceVoxAudioQuery>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            // Assert
            Assert.NotNull(audioQuery);
            Assert.NotNull(audioQuery.Accent_Phrases);
            Assert.NotEmpty(audioQuery.Accent_Phrases);
            Assert.True(audioQuery.SpeedScale > 0);
            Assert.True(audioQuery.OutputSamplingRate > 0);
        }

        [Fact]
        public void AudioQuerySchema_ContainsExpectedFields()
        {
            // Arrange
            var filePath = Path.Combine(_schemasDir, "VoiceVox_AudioQuery_Response.json");
            var json = File.ReadAllText(filePath);
            var audioQuery = JsonSerializer.Deserialize<VoiceVoxAudioQuery>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            // Assert
            Assert.NotNull(audioQuery);
            Assert.NotNull(audioQuery.Accent_Phrases);
            Assert.True(audioQuery.SpeedScale > 0);
            Assert.True(audioQuery.VolumeScale > 0);
            Assert.True(audioQuery.OutputSamplingRate > 0);
            Assert.NotNull(audioQuery.Kana);
        }

        [Fact]
        public void AccentPhraseSchema_ContainsExpectedFields()
        {
            // Arrange
            var filePath = Path.Combine(_schemasDir, "VoiceVox_AudioQuery_Response.json");
            var json = File.ReadAllText(filePath);
            var audioQuery = JsonSerializer.Deserialize<VoiceVoxAudioQuery>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            // Assert
            Assert.NotNull(audioQuery);
            var accentPhrase = audioQuery.Accent_Phrases[0];
            
            Assert.NotNull(accentPhrase.Moras);
            Assert.NotEmpty(accentPhrase.Moras);
            Assert.True(accentPhrase.Accent >= 0);
        }

        [Fact]
        public void MoraSchema_ContainsExpectedFields()
        {
            // Arrange
            var filePath = Path.Combine(_schemasDir, "VoiceVox_AudioQuery_Response.json");
            var json = File.ReadAllText(filePath);
            var audioQuery = JsonSerializer.Deserialize<VoiceVoxAudioQuery>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            // Assert
            Assert.NotNull(audioQuery);
            var mora = audioQuery.Accent_Phrases[0].Moras[0];
            
            Assert.NotEmpty(mora.Text);
            Assert.NotEmpty(mora.Vowel);
            Assert.True(mora.Vowel_Length > 0);
            Assert.True(mora.Pitch > 0);
        }

        [Fact]
        public void MoraSchema_AllowsNullConsonant()
        {
            // 「ん」などの子音がないモーラを確認
            // Arrange
            var filePath = Path.Combine(_schemasDir, "VoiceVox_AudioQuery_Response.json");
            var json = File.ReadAllText(filePath);
            var audioQuery = JsonSerializer.Deserialize<VoiceVoxAudioQuery>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            // Act - "コンニチワ" の "ン" を探す
            var nMora = audioQuery.Accent_Phrases[0].Moras
                .FirstOrDefault(m => m.Text == "ン");

            // Assert
            if (nMora != null)
            {
                Assert.Null(nMora.Consonant);
                Assert.Null(nMora.Consonant_Length);
            }
        }

        #endregion

        #region SpeakerInfo スキーマテスト

        [Fact]
        public void SpeakerInfoSchema_CanBeDeserialized()
        {
            // Arrange
            var filePath = Path.Combine(_schemasDir, "VoiceVox_SpeakerInfo_Response.json");
            var json = File.ReadAllText(filePath);

            // Act
            var speakerInfo = JsonSerializer.Deserialize<VoiceVoxSpeakerInfo>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            // Assert
            Assert.NotNull(speakerInfo);
            Assert.NotEmpty(speakerInfo.Policy);
            Assert.NotEmpty(speakerInfo.Portrait);
            Assert.NotNull(speakerInfo.Style_Infos);
        }

        [Fact]
        public void SpeakerInfoSchema_ContainsExpectedFields()
        {
            // Arrange
            var filePath = Path.Combine(_schemasDir, "VoiceVox_SpeakerInfo_Response.json");
            var json = File.ReadAllText(filePath);
            var speakerInfo = JsonSerializer.Deserialize<VoiceVoxSpeakerInfo>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            // Assert
            Assert.NotNull(speakerInfo);
            Assert.NotNull(speakerInfo.Policy);
            Assert.NotNull(speakerInfo.Portrait);
            Assert.NotNull(speakerInfo.Style_Infos);
            Assert.NotEmpty(speakerInfo.Style_Infos);
        }

        [Fact]
        public void StyleInfoSchema_ContainsExpectedFields()
        {
            // Arrange
            var filePath = Path.Combine(_schemasDir, "VoiceVox_SpeakerInfo_Response.json");
            var json = File.ReadAllText(filePath);
            var speakerInfo = JsonSerializer.Deserialize<VoiceVoxSpeakerInfo>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            // Assert
            Assert.NotNull(speakerInfo);
            var styleInfo = speakerInfo.Style_Infos[0];
            
            Assert.True(styleInfo.Id >= 0);
            Assert.NotEmpty(styleInfo.Icon);
            Assert.NotNull(styleInfo.Voice_Samples);
            Assert.NotEmpty(styleInfo.Voice_Samples);
        }

        #endregion

        #region CoreVersions スキーマテスト

        [Fact]
        public void CoreVersionsSchema_CanBeDeserialized()
        {
            // Arrange
            var filePath = Path.Combine(_schemasDir, "VoiceVox_CoreVersions_Response.json");
            var json = File.ReadAllText(filePath);

            // Act
            var versions = JsonSerializer.Deserialize<string[]>(json);

            // Assert
            Assert.NotNull(versions);
            Assert.NotEmpty(versions);
            Assert.All(versions, version => Assert.NotEmpty(version));
        }

        [Fact]
        public void CoreVersionsSchema_ContainsValidVersionFormat()
        {
            // Arrange
            var filePath = Path.Combine(_schemasDir, "VoiceVox_CoreVersions_Response.json");
            var json = File.ReadAllText(filePath);
            var versions = JsonSerializer.Deserialize<string[]>(json);

            // Assert
            Assert.NotNull(versions);
            Assert.All(versions, version =>
            {
                // バージョン形式を検証 (例: "0.14.5")
                Assert.Matches(@"^\d+\.\d+\.\d+$", version);
            });
        }

        #endregion

        #region JSON形式の検証

        [Theory]
        [InlineData("VoiceVox_Speaker_Response.json")]
        [InlineData("VoiceVox_AudioQuery_Response.json")]
        [InlineData("VoiceVox_SpeakerInfo_Response.json")]
        [InlineData("VoiceVox_CoreVersions_Response.json")]
        public void SchemaFile_IsValidJson(string fileName)
        {
            // Arrange
            var filePath = Path.Combine(_schemasDir, fileName);
            var json = File.ReadAllText(filePath);

            // Act & Assert - JSONとしてパースできることを確認
            var exception = Record.Exception(() =>
            {
                using var doc = JsonDocument.Parse(json);
                Assert.NotNull(doc.RootElement);
            });

            Assert.Null(exception);
        }

        #endregion

        #region スキーマとクラスの整合性テスト

        [Fact]
        public void VoiceVoxSpeaker_MatchesSchemaStructure()
        {
            // Arrange
            var filePath = Path.Combine(_schemasDir, "VoiceVox_Speaker_Response.json");
            var json = File.ReadAllText(filePath);
            
            // Act
            var speakers = JsonSerializer.Deserialize<VoiceVoxSpeaker[]>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            // Assert - デシリアライズが成功し、すべてのプロパティが読み込まれている
            Assert.NotNull(speakers);
            Assert.All(speakers, speaker =>
            {
                Assert.False(string.IsNullOrEmpty(speaker.Name));
                Assert.False(string.IsNullOrEmpty(speaker.Speaker_Uuid));
                Assert.NotNull(speaker.Styles);
                Assert.False(string.IsNullOrEmpty(speaker.Version));
            });
        }

        [Fact]
        public void VoiceVoxAudioQuery_MatchesSchemaStructure()
        {
            // Arrange
            var filePath = Path.Combine(_schemasDir, "VoiceVox_AudioQuery_Response.json");
            var json = File.ReadAllText(filePath);
            
            // Act
            var audioQuery = JsonSerializer.Deserialize<VoiceVoxAudioQuery>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            // Assert
            Assert.NotNull(audioQuery);
            Assert.NotNull(audioQuery.Accent_Phrases);
            Assert.True(audioQuery.SpeedScale >= 0);
            Assert.True(audioQuery.PitchScale >= -1);
            Assert.True(audioQuery.IntonationScale >= 0);
            Assert.True(audioQuery.VolumeScale >= 0);
            Assert.True(audioQuery.OutputSamplingRate > 0);
        }

        #endregion
    }
}
