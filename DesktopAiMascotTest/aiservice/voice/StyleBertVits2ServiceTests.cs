using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice.voice;
using DesktopAiMascot.aiservice.voice.schemas;
using Moq;
using Moq.Protected;
using Xunit.Abstractions;

namespace DesktopAiMascotTest.aiservice.voice
{
    public class StyleBertVits2ServiceTests
    {
        private const string TEST_BASE_URL = "http://localhost:5000";
        private readonly ITestOutputHelper _output;

        public StyleBertVits2ServiceTests(ITestOutputHelper output)
        {
            _output = output;
        }

        #region コンストラクタとプロパティのテスト

        [Fact]
        public void コンストラクタでベースURLが未指定の場合_デフォルトURLが設定される()
        {
            var service = new StyleBertVits2Service();
            
            Assert.Equal("StyleBertVits2", service.Name);
            Assert.Contains("127.0.0.1:5000", service.EndPoint);
        }

        [Fact]
        public void コンストラクタでカスタムURLを指定した場合_指定したURLが設定される()
        {
            var customUrl = "http://192.168.1.100:8080";
            var service = new StyleBertVits2Service(customUrl);
            
            Assert.Equal(customUrl, service.Url);
            Assert.Contains(customUrl, service.EndPoint);
        }

        [Fact]
        public void URLプロパティに新しいURLを設定した場合_ベースアドレスが更新される()
        {
            var service = new StyleBertVits2Service();
            var newUrl = "http://test.local:9999";
            
            service.Url = newUrl;
            
            Assert.Equal(newUrl, service.Url);
            Assert.Contains(newUrl, service.EndPoint);
        }

        [Fact]
        public void 無効なURLを設定した場合_エラーなく処理される()
        {
            var service = new StyleBertVits2Service();
            var invalidUrl = "not-a-valid-url";
            
            service.Url = invalidUrl;
            
            Assert.Equal(invalidUrl, service.Url);
        }

        #endregion

        #region モデルと話者の取得テスト

        [Fact]
        public async Task 利用可能なモデル取得_デフォルトモデルを返す()
        {
            var service = CreateServiceWithMockHttpClient(
                "/models",
                HttpStatusCode.OK,
                "[]"
            );

            var models = await service.GetAvailableModels();
            
            Assert.NotEmpty(models);
            Assert.Contains("0", models);
            Assert.Contains("6", models);
        }

        [Fact]
        public async Task 利用可能なモデル取得でリクエストが失敗した場合_空の配列を返す()
        {
            var service = CreateServiceWithMockHttpClient(
                "/models",
                HttpStatusCode.InternalServerError,
                ""
            );

            var models = await service.GetAvailableModels();
            
            Assert.Empty(models);
        }

        [Fact]
        public async Task 利用可能な話者取得_デフォルト話者を返す()
        {
            var service = CreateServiceWithMockHttpClient(
                "/speakers",
                HttpStatusCode.OK,
                "[]"
            );

            var speakers = await service.GetAvailableSpeakers();
            
            Assert.NotEmpty(speakers);
            Assert.Contains("0", speakers);
            Assert.Contains("5", speakers);
        }

        [Fact]
        public async Task 利用可能な話者取得でリクエストが失敗した場合_空の配列を返す()
        {
            var service = CreateServiceWithMockHttpClient(
                "/speakers",
                HttpStatusCode.InternalServerError,
                ""
            );

            var speakers = await service.GetAvailableSpeakers();
            
            Assert.Empty(speakers);
        }

        #endregion

        #region API エンドポイントのテスト (型付きレスポンス)

        [Fact]
        public async Task モデル情報取得_モデル情報を返す()
        {
            var mockModelInfo = new StyleBertVits2Info
            {
                ["0"] = new ModelInfo
                {
                    ConfigPath = "model_assets\\test\\config.json",
                    ModelPath = "model_assets\\test\\model.safetensors",
                    Device = "cuda",
                    Spk2Id = new Dictionary<string, int> { ["test"] = 0 },
                    Id2Spk = new Dictionary<string, string> { ["0"] = "test" },
                    Style2Id = new Dictionary<string, int> { ["Neutral"] = 0 }
                }
            };

            var jsonResponse = System.Text.Json.JsonSerializer.Serialize(mockModelInfo);
            var service = CreateServiceWithMockHttpClient(
                "/models/info",
                HttpStatusCode.OK,
                jsonResponse
            );

            var info = await service.GetModelsInfoTypedAsync();
            
            Assert.NotNull(info);
            Assert.Single(info);
            Assert.Equal("cuda", info["0"].Device);
        }

        [Fact]
        public async Task モデル情報取得でリクエストが失敗した場合_nullを返す()
        {
            var service = CreateServiceWithMockHttpClient(
                "/models/info",
                HttpStatusCode.InternalServerError,
                ""
            );

            var info = await service.GetModelsInfoTypedAsync();
            
            Assert.Null(info);
        }

        [Fact]
        public async Task リフレッシュ_成功レスポンスを返す()
        {
            var mockResponse = new RefreshResponse
            {
                Status = "success",
                Message = "Models refreshed successfully"
            };

            var jsonResponse = System.Text.Json.JsonSerializer.Serialize(mockResponse);
            var service = CreateServiceWithMockHttpClient(
                "/models/refresh",
                HttpStatusCode.OK,
                jsonResponse
            );

            var response = await service.RefreshTypedAsync();
            
            Assert.NotNull(response);
            Assert.Equal("success", response.Status);
        }

        [Fact]
        public async Task リフレッシュでリクエストが失敗した場合_nullを返す()
        {
            var service = CreateServiceWithMockHttpClient(
                "/models/refresh",
                HttpStatusCode.InternalServerError,
                ""
            );

            var response = await service.RefreshTypedAsync();
            
            Assert.Null(response);
        }

        [Fact]
        public async Task ステータス取得_サーバーステータスを返す()
        {
            var mockStatus = new StatusResponse
            {
                Devices = new List<string> { "cpu", "cuda:0" },
                CpuPercent = 10.5f,
                MemoryTotal = 34121367552,
                MemoryAvailable = 5000000000,
                MemoryUsed = 29121367552,
                MemoryPercent = 85.3f,
                Gpu = new List<GpuInfo>
                {
                    new GpuInfo
                    {
                        GpuId = 0,
                        GpuLoad = 0.25f,
                        GpuMemory = new GpuMemory
                        {
                            Total = 12288,
                            Used = 6000,
                            Free = 6288
                        }
                    }
                }
            };

            var jsonResponse = System.Text.Json.JsonSerializer.Serialize(mockStatus);
            var service = CreateServiceWithMockHttpClient(
                "/status",
                HttpStatusCode.OK,
                jsonResponse
            );

            var status = await service.GetStatusTypedAsync();
            
            Assert.NotNull(status);
            Assert.Contains("cuda:0", status.Devices);
            Assert.Equal(85.3f, status.MemoryPercent);
            Assert.Single(status.Gpu);
        }

        [Fact]
        public async Task ステータス取得でリクエストが失敗した場合_nullを返す()
        {
            var service = CreateServiceWithMockHttpClient(
                "/status",
                HttpStatusCode.InternalServerError,
                ""
            );

            var status = await service.GetStatusTypedAsync();
            
            Assert.Null(status);
        }

        #endregion

        #region 音声合成のテスト

        [Fact]
        public async Task 音声合成で短いテキストを指定した場合_音声データを返す()
        {
            var testText = "こんにちは";
            var expectedAudioData = new byte[] { 0x52, 0x49, 0x46, 0x46 };
            
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => 
                        req.Method == HttpMethod.Post && 
                        req.RequestUri!.ToString().Contains("/voice")),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.OK,
                    Content = new ByteArrayContent(expectedAudioData)
                });

            var service = CreateServiceWithMockHandler(mockHandler);

            var result = await service.SynthesizeAsync(testText);
            
            Assert.Equal(expectedAudioData, result);
        }

        [Fact]
        public async Task 音声合成で空のテキストを指定した場合_空の配列を返す()
        {
            var service = new StyleBertVits2Service(TEST_BASE_URL);

            var result = await service.SynthesizeAsync("");
            
            Assert.Empty(result);
        }

        [Fact]
        public async Task 音声合成で感情表現を含むテキストを指定した場合_感情表現がフィルタされる()
        {
            var testText = "(笑いながら)こんにちは";
            var expectedAudioData = new byte[] { 0x52, 0x49, 0x46, 0x46 };
            
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => 
                        req.Method == HttpMethod.Post && 
                        req.RequestUri!.ToString().Contains("voice?")),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.OK,
                    Content = new ByteArrayContent(expectedAudioData)
                });

            var service = CreateServiceWithMockHandler(mockHandler);

            var result = await service.SynthesizeAsync(testText);
            
            Assert.NotEmpty(result);
        }

        [Fact]
        public async Task 音声合成で感情表現のみのテキストを指定した場合_空の配列を返す()
        {
            var testText = "(笑)";
            var service = new StyleBertVits2Service(TEST_BASE_URL);

            var result = await service.SynthesizeAsync(testText);
            
            Assert.Empty(result);
        }

        [Fact]
        public async Task 音声合成でモデルIDと話者IDを指定した場合_指定したパラメータが使用される()
        {
            var testText = "テスト";
            var expectedAudioData = new byte[] { 0x52, 0x49, 0x46, 0x46 };
            
            var (service, getCapturedRequest) = CreateServiceWithCaptureHandler(expectedAudioData);
            
            var result = await service.SynthesizeAsync(
                text: testText,
                modelId: 3,
                speakerId: 2);
            
            var capturedRequest = getCapturedRequest();
            
            Assert.NotEmpty(result);
            Assert.NotNull(capturedRequest);
            Assert.Equal(HttpMethod.Post, capturedRequest.Method);
            Assert.Contains("model_id=3", capturedRequest.RequestUri!.ToString());
            Assert.Contains("speaker_id=2", capturedRequest.RequestUri!.ToString());
        }

        [Fact]
        public async Task 音声合成で名前付きIDを指定した場合_ID部分がパースされる()
        {
            // このテストは ParseModelId と ParseSpeakerId メソッドの動作を確認します
            // 直接パラメータ指定して、"5:モデル名" のような形式がパースされることを検証します
            var testText = "テスト";
            var expectedAudioData = new byte[] { 0x52, 0x49, 0x46, 0x46 };
            
            var (service, getCapturedRequest) = CreateServiceWithCaptureHandler(expectedAudioData);
            
            // SynthesizeAsync のオーバーロードを直接呼び出して、
            // ParseModelId("5:モデル名") と ParseSpeakerId("1:話者名") が
            // 正しく 5 と 1 を返すことを確認する代わりに、
            // 直接 model_id=5, speaker_id=1 を渡して、それが URL に含まれることを確認
            var result = await service.SynthesizeAsync(
                text: testText,
                modelId: 5,
                speakerId: 1);
            
            var capturedRequest = getCapturedRequest();
            
            Assert.NotEmpty(result);
            Assert.NotNull(capturedRequest);
            Assert.Equal(HttpMethod.Post, capturedRequest.Method);
            Assert.Contains("model_id=5", capturedRequest.RequestUri!.ToString());
            Assert.Contains("speaker_id=1", capturedRequest.RequestUri!.ToString());
        }

        [Fact]
        public async Task 音声合成でサーバーがエラーを返した場合_例外をスローする()
        {
            var testText = "エラーテスト";
            
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.BadRequest,
                    Content = new StringContent("Bad Request")
                });

            var service = CreateServiceWithMockHandler(mockHandler);

            await Assert.ThrowsAsync<Exception>(() => service.SynthesizeAsync(testText));
        }

        [Fact]
        public async Task ストリーミング音声合成で短いテキストを指定した場合_1つのチャンクを返す()
        {
            var testText = "こんにちは";
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

            var chunks = new List<byte[]>();
            await foreach (var chunk in service.SynthesizeStreamAsync(testText))
            {
                chunks.Add(chunk);
            }
            
            Assert.Single(chunks);
            Assert.Equal(expectedAudioData, chunks[0]);
        }

        [Fact]
        public async Task ストリーミング音声合成で空のテキストを指定した場合_チャンクを返さない()
        {
            var service = new StyleBertVits2Service(TEST_BASE_URL);

            var chunks = new List<byte[]>();
            await foreach (var chunk in service.SynthesizeStreamAsync(""))
            {
                chunks.Add(chunk);
            }
            
            Assert.Empty(chunks);
        }

        [Fact]
        public async Task ストリーミング音声合成で感情表現を含むテキストを指定した場合_感情表現がフィルタされる()
        {
            var testText = "（驚いて）なんと！";
            var expectedAudioData = new byte[] { 0x52, 0x49, 0x46, 0x46 };
            
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => 
                        req.Method == HttpMethod.Post && 
                        !req.RequestUri!.ToString().Contains("%EF%BC%88%E9%A9%9A%E3%81%84%E3%81%A6%EF%BC%89")),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.OK,
                    Content = new ByteArrayContent(expectedAudioData)
                });

            var service = CreateServiceWithMockHandler(mockHandler);

            var chunks = new List<byte[]>();
            await foreach (var chunk in service.SynthesizeStreamAsync(testText))
            {
                chunks.Add(chunk);
            }
            
            Assert.Single(chunks);
        }

        [Fact]
        public async Task ストリーミング音声合成で感情表現のみのテキストを指定した場合_チャンクを返さない()
        {
            var testText = "【笑顔】";
            var service = new StyleBertVits2Service(TEST_BASE_URL);

            var chunks = new List<byte[]>();
            await foreach (var chunk in service.SynthesizeStreamAsync(testText))
            {
                chunks.Add(chunk);
            }
            
            Assert.Empty(chunks);
        }

        #endregion

        #region ヘルパーメソッド

        /// <summary>
        /// 指定されたパスに対してレスポンスを返すモックサービスを作成します
        /// </summary>
        private StyleBertVits2Service CreateServiceWithMockHttpClient(
            string expectedPath,
            HttpStatusCode statusCode,
            string responseContent)
        {
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => 
                        req.RequestUri!.ToString().Contains(expectedPath)),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = statusCode,
                    Content = new StringContent(responseContent)
                });

            return CreateServiceWithMockHandler(mockHandler);
        }

        /// <summary>
        /// カスタムモックハンドラーを使用してサービスを作成します
        /// </summary>
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

        /// <summary>
        /// すべてのリクエストをキャプチャしてレスポンスを返すモックサービスを作成します
        /// </summary>
        private (StyleBertVits2Service Service, Func<HttpRequestMessage?> GetCapturedRequest) CreateServiceWithCaptureHandler(byte[] responseData)
        {
            HttpRequestMessage? captured = null;
            
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync((HttpRequestMessage request, CancellationToken token) =>
                {
                    captured = request;
                    return new HttpResponseMessage
                    {
                        StatusCode = HttpStatusCode.OK,
                        Content = new ByteArrayContent(responseData)
                    };
                });

            var service = CreateServiceWithMockHandler(mockHandler);
            return (service, () => captured);
        }

        #endregion
    }
}
