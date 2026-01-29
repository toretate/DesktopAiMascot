using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice.voice;
using DesktopAiMascot.aiservice.voice.schemas;
using Moq;
using Moq.Protected;

namespace DesktopAiMascotTest.aiservice.voice
{
    /// <summary>
    /// StyleBertVits2Service のスキーマ使用テスト
    /// </summary>
    public class StyleBertVits2ServiceSchemaTests
    {
        private const string TEST_BASE_URL = "http://localhost:5000";

        [Fact]
        public async Task VoiceRequestスキーマを使用して音声合成ができる()
        {
            var expectedAudioData = new byte[] { 0x52, 0x49, 0x46, 0x46 };
            
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.OK,
                    Content = new ByteArrayContent(expectedAudioData)
                });

            var service = CreateServiceWithMockHandler(mockHandler);

            var request = new VoiceRequest
            {
                Text = "こんにちは",
                ModelId = 0,
                SpeakerId = 0,
                Style = "Neutral",
                SdpRatio = 0.2f,
                Noise = 0.6f,
                Noisew = 0.8f,
                Length = 1.0f,
                Language = "JP"
            };

            var result = await service.SynthesizeAsync(request);
            
            Assert.Equal(expectedAudioData, result);
        }

        [Fact]
        public async Task VoiceRequestスキーマを使用してストリーミング音声合成ができる()
        {
            var expectedAudioData = new byte[] { 0x52, 0x49, 0x46, 0x46 };
            
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.OK,
                    Content = new ByteArrayContent(expectedAudioData)
                });

            var service = CreateServiceWithMockHandler(mockHandler);

            var request = new VoiceRequest
            {
                Text = "ストリーミングテスト",
                ModelId = 1,
                SpeakerId = 2,
                Style = "Happy",
                Language = "JP"
            };

            var chunks = new List<byte[]>();
            await foreach (var chunk in service.SynthesizeStreamAsync(request))
            {
                chunks.Add(chunk);
            }
            
            Assert.Single(chunks);
            Assert.Equal(expectedAudioData, chunks[0]);
        }

        [Fact]
        public async Task VoiceRequestのデフォルト値が正しく設定されている()
        {
            var request = new VoiceRequest
            {
                Text = "テスト"
            };

            Assert.Equal(0, request.ModelId);
            Assert.Equal(0, request.SpeakerId);
            Assert.Equal(0.2f, request.SdpRatio);
            Assert.Equal(0.6f, request.Noise);
            Assert.Equal(0.8f, request.Noisew);
            Assert.Equal(1.0f, request.Length);
            Assert.Equal("JP", request.Language);
            Assert.Equal("Neutral", request.Style);
            Assert.True(request.AutoSplit);
            Assert.Equal(0.5f, request.SplitInterval);
            Assert.Equal(1.0f, request.AssistTextWeight);
            Assert.Equal(1.0f, request.StyleWeight);
        }

        [Fact]
        public void Languages列挙型が正しく定義されている()
        {
            Assert.Equal(Languages.JP, Languages.JP);
            Assert.Equal(Languages.EN, Languages.EN);
            Assert.Equal(Languages.ZH, Languages.ZH);
        }

        [Fact]
        public void StatusResponseが正しく定義されている()
        {
            var gpuMemory = new GpuMemory
            {
                Total = 12288.0f,
                Used = 5808.0f,
                Free = 6306.0f
            };

            var gpuInfo = new GpuInfo
            {
                GpuId = 0,
                GpuLoad = 0.22f,
                GpuMemory = gpuMemory
            };

            var response = new StatusResponse
            {
                Devices = new List<string> { "cpu", "cuda:0" },
                CpuPercent = 9.7f,
                MemoryTotal = 34121367552,
                MemoryAvailable = 5537951744,
                MemoryUsed = 28583415808,
                MemoryPercent = 83.8f,
                Gpu = new List<GpuInfo> { gpuInfo }
            };

            Assert.Equal(2, response.Devices.Count);
            Assert.Contains("cuda:0", response.Devices);
            Assert.Equal(9.7f, response.CpuPercent);
            Assert.Equal(83.8f, response.MemoryPercent);
            Assert.Single(response.Gpu);
            Assert.Equal(0, response.Gpu[0].GpuId);
            Assert.Equal(0.22f, response.Gpu[0].GpuLoad);
            Assert.Equal(12288.0f, response.Gpu[0].GpuMemory.Total);
            Assert.Equal(5808.0f, response.Gpu[0].GpuMemory.Used);
            Assert.Equal(6306.0f, response.Gpu[0].GpuMemory.Free);
        }

        [Fact]
        public void RefreshResponseが正しく定義されている()
        {
            var response = new RefreshResponse
            {
                Status = "success",
                Message = "Models refreshed successfully"
            };

            Assert.Equal("success", response.Status);
            Assert.Equal("Models refreshed successfully", response.Message);
        }

        [Fact]
        public void ModelInfoが正しく定義されている()
        {
            var modelInfo = new ModelInfo
            {
                ConfigPath = "/path/to/config.json",
                ModelPath = "/path/to/model.pth",
                Device = "cuda:0"
            };

            modelInfo.Spk2Id["speaker1"] = 0;
            modelInfo.Id2Spk["0"] = "speaker1";
            modelInfo.Style2Id["Neutral"] = 0;

            Assert.Equal("/path/to/config.json", modelInfo.ConfigPath);
            Assert.Equal("/path/to/model.pth", modelInfo.ModelPath);
            Assert.Equal("cuda:0", modelInfo.Device);
            Assert.Equal(0, modelInfo.Spk2Id["speaker1"]);
            Assert.Equal("speaker1", modelInfo.Id2Spk["0"]);
            Assert.Equal(0, modelInfo.Style2Id["Neutral"]);
        }

        [Fact]
        public void StyleBertVits2Infoが正しく定義されている()
        {
            var info = new StyleBertVits2Info();
            var modelInfo = new ModelInfo
            {
                ConfigPath = "/path/to/config.json",
                ModelPath = "/path/to/model.pth"
            };

            info["0"] = modelInfo;

            Assert.Single(info);
            Assert.Equal(modelInfo, info["0"]);
        }

        [Fact]
        public void ValidationErrorが正しく定義されている()
        {
            var error = new ValidationError
            {
                Loc = new List<object> { "body", "text" },
                Msg = "field required",
                Type = "value_error.missing"
            };

            Assert.Equal(2, error.Loc.Count);
            Assert.Equal("field required", error.Msg);
            Assert.Equal("value_error.missing", error.Type);
        }

        [Fact]
        public void HttpValidationErrorが正しく定義されている()
        {
            var validationError = new ValidationError
            {
                Loc = new List<object> { "query", "text" },
                Msg = "field required",
                Type = "value_error.missing"
            };

            var httpError = new HttpValidationError
            {
                Detail = new List<ValidationError> { validationError }
            };

            Assert.Single(httpError.Detail);
            Assert.Equal(validationError, httpError.Detail[0]);
        }

        [Fact]
        public void G2PRequestが正しく定義されている()
        {
            var request = new G2PRequest
            {
                Text = "こんにちは"
            };

            Assert.Equal("こんにちは", request.Text);
        }

        [Fact]
        public void GetAudioRequestが正しく定義されている()
        {
            var request = new GetAudioRequest
            {
                Path = "/path/to/audio.wav"
            };

            Assert.Equal("/path/to/audio.wav", request.Path);
        }

        private StyleBertVits2Service CreateServiceWithMockHandler(Mock<HttpMessageHandler> mockHandler)
        {
            var httpClient = new HttpClient(mockHandler.Object)
            {
                BaseAddress = new Uri(TEST_BASE_URL)
            };

            var service = new StyleBertVits2Service(TEST_BASE_URL);
            
            var httpClientField = typeof(StyleBertVits2Service)
                .GetField("_httpClient", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            httpClientField?.SetValue(service, httpClient);

            return service;
        }
    }
}
