using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using DesktopAiMascot.aiservice.voice;
using DesktopAiMascot.aiservice.voice.schemas;

namespace DesktopAiMascotTest.aiservice.voice
{
    /// <summary>
    /// StyleBertVits2ServiceのVoice設定機能（モデル名/スピーカー名の抽出とマッピング）のテストケース
    /// </summary>
    public class StyleBertVits2VoiceConfigTests
    {
        [Fact]
        public void ExtractModelName_ShouldExtractDirectoryName()
        {
            // Arrange
            var service = new StyleBertVits2Service();
            var testCases = new Dictionary<string, string>
            {
                { "model_assets/jvnv-F1-jp/jvnv-F1-jp_e160_s14000.safetensors", "jvnv-F1-jp" },
                { "model_assets/koharune-ami/koharune-ami.safetensors", "koharune-ami" },
                { "C:/path/to/model_assets/test-model/model.safetensors", "test-model" },
                { "model_assets\\test-model\\model.safetensors", "test-model" }, // Windows path
            };

            // Act & Assert
            foreach (var testCase in testCases)
            {
                // リフレクションを使用してprivateメソッドをテスト
                var method = typeof(StyleBertVits2Service).GetMethod("ExtractModelName", 
                    System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                var result = method?.Invoke(service, new object[] { testCase.Key }) as string;
                
                Assert.Equal(testCase.Value, result);
            }
        }

        [Fact]
        public void ParseModelId_ShouldParseFromModelName()
        {
            // Arrange
            var service = new StyleBertVits2Service();
            var modelNameToId = new Dictionary<string, string>
            {
                { "jvnv-F1-jp", "0" },
                { "koharune-ami", "1" }
            };

            // リフレクションで_modelNameToIdフィールドを設定
            var field = typeof(StyleBertVits2Service).GetField("_modelNameToId",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            field?.SetValue(service, modelNameToId);

            // Act
            var method = typeof(StyleBertVits2Service).GetMethod("ParseModelId",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            
            var result1 = method?.Invoke(service, new object[] { "jvnv-F1-jp" });
            var result2 = method?.Invoke(service, new object[] { "koharune-ami" });

            // Assert
            Assert.Equal(0, result1);
            Assert.Equal(1, result2);
        }

        [Fact]
        public void ParseModelId_ShouldHandleLegacyFormat()
        {
            // Arrange
            var service = new StyleBertVits2Service();

            // Act - "0: モデル名" 形式
            var method = typeof(StyleBertVits2Service).GetMethod("ParseModelId",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            
            var result = method?.Invoke(service, new object[] { "0: jvnv-F1-jp" });

            // Assert
            Assert.Equal(0, result);
        }

        [Fact]
        public void ParseSpeakerId_ShouldParseFromSpeakerName()
        {
            // Arrange
            var service = new StyleBertVits2Service();
            var speakerNameToId = new Dictionary<string, string>
            {
                { "小春音アミ", "0" },
                { "あみたろ", "1" }
            };

            // リフレクションで_speakerNameToIdフィールドを設定
            var field = typeof(StyleBertVits2Service).GetField("_speakerNameToId",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            field?.SetValue(service, speakerNameToId);

            // Act
            var method = typeof(StyleBertVits2Service).GetMethod("ParseSpeakerId",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            
            var result1 = method?.Invoke(service, new object[] { "小春音アミ" });
            var result2 = method?.Invoke(service, new object[] { "あみたろ" });

            // Assert
            Assert.Equal(0, result1);
            Assert.Equal(1, result2);
        }

        [Fact]
        public void ModelInfo_ShouldHaveRequiredProperties()
        {
            // Arrange
            var modelInfo = new ModelInfo
            {
                ConfigPath = "path/to/config.json",
                ModelPath = "model_assets/test-model/model.safetensors",
                Device = "cpu",
                Spk2Id = new Dictionary<string, int> { { "speaker1", 0 } },
                Id2Spk = new Dictionary<string, string> { { "0", "speaker1" } },
                Style2Id = new Dictionary<string, int> { { "Neutral", 0 } }
            };

            // Assert
            Assert.NotNull(modelInfo.ConfigPath);
            Assert.NotNull(modelInfo.ModelPath);
            Assert.NotNull(modelInfo.Device);
            Assert.NotNull(modelInfo.Spk2Id);
            Assert.NotNull(modelInfo.Id2Spk);
            Assert.NotNull(modelInfo.Style2Id);
        }

        [Fact]
        public void VoiceServiceConfig_ShouldInitializeWithEmptyStrings()
        {
            // Arrange & Act
            var config = new DesktopAiMascot.mascots.VoiceServiceConfig();

            // Assert
            Assert.Equal(string.Empty, config.Model);
            Assert.Equal(string.Empty, config.Speaker);
        }

        [Theory]
        [InlineData("", "Unknown")]
        [InlineData(null, "Unknown")]
        [InlineData("invalid/path", "invalid")]  // 最後のディレクトリ名を返す
        public void ExtractModelName_ShouldHandleInvalidPaths(string path, string expected)
        {
            // Arrange
            var service = new StyleBertVits2Service();

            // Act
            var method = typeof(StyleBertVits2Service).GetMethod("ExtractModelName",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            var result = method?.Invoke(service, new object[] { path }) as string;

            // Assert
            Assert.Contains(expected, result ?? "Unknown");
        }

        [Fact]
        public void Service_ShouldMaintainModelAndSpeakerProperties()
        {
            // Arrange
            var service = new StyleBertVits2Service();

            // Act
            service.Model = "test-model";
            service.Speaker = "test-speaker";

            // Assert
            Assert.Equal("test-model", service.Model);
            Assert.Equal("test-speaker", service.Speaker);
        }

        [Fact]
        public void Service_ModelAndSpeakerProperties_ShouldBeIndependent()
        {
            // Arrange
            var service = new StyleBertVits2Service();

            // Act
            service.Model = "model1";
            Assert.Equal("model1", service.Model);
            Assert.Equal(string.Empty, service.Speaker);

            service.Speaker = "speaker1";
            Assert.Equal("model1", service.Model);
            Assert.Equal("speaker1", service.Speaker);

            service.Model = "model2";
            Assert.Equal("model2", service.Model);
            Assert.Equal("speaker1", service.Speaker);
        }
    }
}
