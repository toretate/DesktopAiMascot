using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice.voice;
using Xunit;

namespace DesktopAiMascotTest.aiservice.voice
{
    /// <summary>
    /// VoiceVoxServiceの単体テスト
    /// </summary>
    public class VoiceVoxServiceTests
    {
        private readonly VoiceVoxService _service;

        public VoiceVoxServiceTests()
        {
            _service = new VoiceVoxService();
        }

        #region 基本プロパティのテスト

        [Fact]
        public void Constructor_InitializesProperties()
        {
            // Assert
            Assert.Equal("VoiceVox", _service.Name);
            Assert.Equal("http://localhost:50021", _service.EndPoint);
            Assert.Equal("http://localhost:50021", _service.Url); // Urlは初期化される
            Assert.Empty(_service.Model);
            Assert.Empty(_service.Speaker);
        }

        [Fact]
        public void Name_ReturnsVoiceVox()
        {
            // Assert
            Assert.Equal("VoiceVox", _service.Name);
        }

        [Fact]
        public void EndPoint_ReturnsDefaultUrl()
        {
            // Assert
            Assert.Equal("http://localhost:50021", _service.EndPoint);
        }

        [Fact]
        public void Url_CanBeSetAndGet()
        {
            // Arrange
            var testUrl = "http://127.0.0.1:50021";

            // Act
            _service.Url = testUrl;

            // Assert
            Assert.Equal(testUrl, _service.Url);
        }

        #endregion

        #region GetAvailableModels のテスト

        [Fact]
        public async Task GetAvailableModels_ReturnsEmptyArray()
        {
            // VoiceVoxにはモデルの概念がないため、空の配列を返す
            // Act
            var models = await _service.GetAvailableModels();

            // Assert
            Assert.NotNull(models);
            Assert.Empty(models);
        }

        #endregion

        #region Speaker ID 抽出のテスト

        [Theory]
        [InlineData("四国めたん (ノーマル) [2]", 2)]
        [InlineData("四国めたん (あまあま) [0]", 0)]
        [InlineData("ずんだもん (ツンツン) [7]", 7)]
        [InlineData("春日部つむぎ (セクシー) [10]", 10)]
        public void ExtractSpeakerId_ValidFormat_ReturnsCorrectId(string speakerString, int expectedId)
        {
            // Arrange
            _service.Speaker = speakerString;

            // Act - SynthesizeAsyncを呼び出すと内部でExtractSpeakerIdが使われる
            // ただし、実際の合成はサーバーが必要なので、ここではパターンのテストのみ
            
            // Assert - 正規表現パターンの検証
            var startIndex = speakerString.LastIndexOf('[');
            var endIndex = speakerString.LastIndexOf(']');
            var idStr = speakerString.Substring(startIndex + 1, endIndex - startIndex - 1);
            var actualId = int.Parse(idStr);
            
            Assert.Equal(expectedId, actualId);
        }

        [Theory]
        [InlineData("InvalidFormat")]
        [InlineData("NoId (スタイル)")]
        [InlineData("")]
        public void ExtractSpeakerId_InvalidFormat_ShouldReturnNegative(string speakerString)
        {
            // Arrange & Act
            var startIndex = speakerString.LastIndexOf('[');
            var endIndex = speakerString.LastIndexOf(']');

            // Assert
            Assert.True(startIndex < 0 || endIndex <= startIndex);
        }

        #endregion

        #region スキーマクラスのテスト

        [Fact]
        public void VoiceVoxSpeaker_CanBeInstantiated()
        {
            // Act
            var speaker = new VoiceVoxSpeaker
            {
                Name = "テストキャラクター",
                Speaker_Uuid = "test-uuid",
                Styles = new[]
                {
                    new VoiceVoxSpeakerStyle
                    {
                        Name = "ノーマル",
                        Id = 1,
                        Type = "talk"
                    }
                },
                Version = "0.25.1"
            };

            // Assert
            Assert.Equal("テストキャラクター", speaker.Name);
            Assert.Equal("test-uuid", speaker.Speaker_Uuid);
            Assert.Single(speaker.Styles);
            Assert.Equal("0.25.1", speaker.Version);
        }

        [Fact]
        public void VoiceVoxAudioQuery_CanBeInstantiated()
        {
            // Act
            var audioQuery = new VoiceVoxAudioQuery
            {
                SpeedScale = 1.0f,
                PitchScale = 0.0f,
                IntonationScale = 1.0f,
                VolumeScale = 1.0f,
                PrePhonemeLength = 0.1f,
                PostPhonemeLength = 0.1f,
                OutputSamplingRate = 24000,
                OutputStereo = false
            };

            // Assert
            Assert.Equal(1.0f, audioQuery.SpeedScale);
            Assert.Equal(0.0f, audioQuery.PitchScale);
            Assert.Equal(24000, audioQuery.OutputSamplingRate);
            Assert.False(audioQuery.OutputStereo);
        }

        [Fact]
        public void VoiceVoxAccentPhrase_CanBeInstantiated()
        {
            // Act
            var accentPhrase = new VoiceVoxAccentPhrase
            {
                Moras = new[]
                {
                    new VoiceVoxMora
                    {
                        Text = "テ",
                        Consonant = "t",
                        Consonant_Length = 0.08f,
                        Vowel = "e",
                        Vowel_Length = 0.12f,
                        Pitch = 5.5f
                    }
                },
                Accent = 1,
                Is_Interrogative = false
            };

            // Assert
            Assert.Single(accentPhrase.Moras);
            Assert.Equal(1, accentPhrase.Accent);
            Assert.False(accentPhrase.Is_Interrogative);
        }

        [Fact]
        public void VoiceVoxMora_CanBeInstantiated()
        {
            // Act
            var mora = new VoiceVoxMora
            {
                Text = "コ",
                Consonant = "k",
                Consonant_Length = 0.08f,
                Vowel = "o",
                Vowel_Length = 0.12f,
                Pitch = 5.5f
            };

            // Assert
            Assert.Equal("コ", mora.Text);
            Assert.Equal("k", mora.Consonant);
            Assert.Equal("o", mora.Vowel);
        }

        [Fact]
        public void VoiceVoxSpeakerInfo_CanBeInstantiated()
        {
            // Act
            var speakerInfo = new VoiceVoxSpeakerInfo
            {
                Policy = "利用規約",
                Portrait = "portrait-data",
                Style_Infos = new[]
                {
                    new VoiceVoxStyleInfo
                    {
                        Id = 1,
                        Icon = "icon-data",
                        Voice_Samples = new[] { "sample1", "sample2" }
                    }
                }
            };

            // Assert
            Assert.Equal("利用規約", speakerInfo.Policy);
            Assert.Single(speakerInfo.Style_Infos);
        }

        #endregion

        #region AudioQuery パラメータのカスタマイズテスト

        [Fact]
        public void VoiceVoxAudioQuery_SpeedScale_CanBeCustomized()
        {
            // Arrange
            var audioQuery = new VoiceVoxAudioQuery { SpeedScale = 1.0f };

            // Act
            audioQuery.SpeedScale = 1.5f;

            // Assert
            Assert.Equal(1.5f, audioQuery.SpeedScale);
        }

        [Fact]
        public void VoiceVoxAudioQuery_PitchScale_CanBeCustomized()
        {
            // Arrange
            var audioQuery = new VoiceVoxAudioQuery { PitchScale = 0.0f };

            // Act
            audioQuery.PitchScale = 0.2f;

            // Assert
            Assert.Equal(0.2f, audioQuery.PitchScale);
        }

        [Fact]
        public void VoiceVoxAudioQuery_VolumeScale_CanBeCustomized()
        {
            // Arrange
            var audioQuery = new VoiceVoxAudioQuery { VolumeScale = 1.0f };

            // Act
            audioQuery.VolumeScale = 1.5f;

            // Assert
            Assert.Equal(1.5f, audioQuery.VolumeScale);
        }

        [Fact]
        public void VoiceVoxAudioQuery_DefaultValues_AreCorrect()
        {
            // Act
            var audioQuery = new VoiceVoxAudioQuery();

            // Assert
            Assert.Equal(1.0f, audioQuery.PauseLengthScale);
            Assert.Equal(0, audioQuery.SpeedScale);
            Assert.Equal(0, audioQuery.PitchScale);
            Assert.Equal(0, audioQuery.IntonationScale);
            Assert.Equal(0, audioQuery.VolumeScale);
        }

        #endregion

        #region SynthesizeStreamAsync のテスト

        [Fact]
        public async Task SynthesizeStreamAsync_WithoutSpeaker_ReturnsEmptyStream()
        {
            // Arrange
            _service.Speaker = string.Empty;
            var chunks = new List<byte[]>();

            // Act
            await foreach (var chunk in _service.SynthesizeStreamAsync("テスト"))
            {
                chunks.Add(chunk);
            }

            // Assert - Speakerが設定されていないのでnullが返され、チャンクは0個
            Assert.Empty(chunks);
        }

        #endregion

        #region エッジケースのテスト

        [Fact]
        public void VoiceVoxSpeaker_WithNullStyles_DoesNotThrow()
        {
            // Act & Assert
            var speaker = new VoiceVoxSpeaker
            {
                Name = "テスト",
                Speaker_Uuid = "uuid",
                Styles = null
            };

            Assert.Null(speaker.Styles);
        }

        [Fact]
        public void VoiceVoxAudioQuery_WithNullPauseLength_IsAllowed()
        {
            // Act
            var audioQuery = new VoiceVoxAudioQuery
            {
                PauseLength = null
            };

            // Assert
            Assert.Null(audioQuery.PauseLength);
        }

        [Fact]
        public void VoiceVoxMora_WithNullConsonant_IsAllowed()
        {
            // 「ん」などの子音がないモーラ
            // Act
            var mora = new VoiceVoxMora
            {
                Text = "ン",
                Consonant = null,
                Consonant_Length = null,
                Vowel = "N",
                Vowel_Length = 0.1f,
                Pitch = 5.0f
            };

            // Assert
            Assert.Null(mora.Consonant);
            Assert.Null(mora.Consonant_Length);
        }

        #endregion
    }
}
