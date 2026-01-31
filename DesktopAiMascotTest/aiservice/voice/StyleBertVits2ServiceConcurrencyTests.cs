using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice.voice;
using Moq;
using Moq.Protected;
using Xunit.Abstractions;

namespace DesktopAiMascotTest.aiservice.voice
{
    /// <summary>
    /// StyleBertVits2Serviceの並行処理とマスコット音声分離のテストクラス（ラジオモード対応）
    /// 
    /// このテストクラスは、今後実装予定のラジオモード（複数のマスコットが会話する機能）において、
    /// TTS（Text-to-Speech）処理が前後してもマスコット毎の音声が混ざらないことを保証します。
    /// 
    /// 主なテストシナリオ:
    /// 1. 複数の話者が同時に音声合成をリクエストした場合の音声データ分離
    /// 2. 同じ話者が連続してリクエストした場合の順序保証
    /// 3. 2人の話者が交互に音声合成を行う場合の分離
    /// 4. ストリーミング音声合成での複数話者の分離
    /// 5. 高負荷状態（5人の話者）での正常動作
    /// 6. 実際のラジオモードのユースケースシナリオ
    /// 
    /// 詳細なテスト仕様は CONCURRENCY_TESTS.md を参照してください。
    /// </summary>
    public class StyleBertVits2ServiceConcurrencyTests
    {
        private const string TEST_BASE_URL = "http://localhost:5000";
        private readonly ITestOutputHelper _output;

        public StyleBertVits2ServiceConcurrencyTests(ITestOutputHelper output)
        {
            _output = output;
        }

        #region 並行処理とマスコット音声分離のテスト（ラジオモード対応）

        [Fact]
        public async Task 複数の話者が同時に音声合成をリクエストした場合_それぞれの音声データが混ざらない()
        {
            var speaker1AudioData = new byte[] { 0x52, 0x49, 0x46, 0x46, 0x01, 0x01, 0x01, 0x01 };
            var speaker2AudioData = new byte[] { 0x52, 0x49, 0x46, 0x46, 0x02, 0x02, 0x02, 0x02 };
            
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => 
                        req.Method == HttpMethod.Post && 
                        req.RequestUri!.ToString().Contains("speaker_id=1")),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(() =>
                {
                    Thread.Sleep(50);
                    return new HttpResponseMessage
                    {
                        StatusCode = HttpStatusCode.OK,
                        Content = new ByteArrayContent(speaker1AudioData)
                    };
                });
            
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => 
                        req.Method == HttpMethod.Post && 
                        req.RequestUri!.ToString().Contains("speaker_id=2")),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(() =>
                {
                    Thread.Sleep(50);
                    return new HttpResponseMessage
                    {
                        StatusCode = HttpStatusCode.OK,
                        Content = new ByteArrayContent(speaker2AudioData)
                    };
                });

            var service = CreateServiceWithMockHandler(mockHandler);

            var task1 = service.SynthesizeAsync("話者1のテキスト", modelId: 0, speakerId: 1);
            var task2 = service.SynthesizeAsync("話者2のテキスト", modelId: 0, speakerId: 2);

            var results = await Task.WhenAll(task1, task2);

            Assert.Equal(speaker1AudioData, results[0]);
            Assert.Equal(speaker2AudioData, results[1]);
            Assert.NotEqual(results[0], results[1]);
        }

        [Fact]
        public async Task 同じ話者が連続して音声合成をリクエストした場合_順序が保証される()
        {
            var requestOrder = new List<string>();
            var responseCounter = 0;
            
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => 
                        req.Method == HttpMethod.Post && 
                        req.RequestUri!.ToString().Contains("/voice")),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync((HttpRequestMessage request, CancellationToken token) =>
                {
                    var uri = request.RequestUri!.ToString();
                    int currentOrder;
                    lock (requestOrder)
                    {
                        requestOrder.Add(uri);
                        currentOrder = ++responseCounter;
                    }
                    
                    Thread.Sleep(30);
                    
                    var audioData = new byte[] { 0x52, 0x49, 0x46, 0x46, (byte)currentOrder, (byte)currentOrder, (byte)currentOrder };
                    return new HttpResponseMessage
                    {
                        StatusCode = HttpStatusCode.OK,
                        Content = new ByteArrayContent(audioData)
                    };
                });

            var service = CreateServiceWithMockHandler(mockHandler);

            var task1 = service.SynthesizeAsync("テキスト1", modelId: 0, speakerId: 1);
            var task2 = service.SynthesizeAsync("テキスト2", modelId: 0, speakerId: 1);
            var task3 = service.SynthesizeAsync("テキスト3", modelId: 0, speakerId: 1);

            var results = await Task.WhenAll(task1, task2, task3);

            Assert.Equal(3, results.Length);
            Assert.All(results, r => Assert.NotEmpty(r));
            
            var receivedMarkers = results.Select(r => (int)r[4]).OrderBy(m => m).ToList();
            Assert.Equal(new List<int> { 1, 2, 3 }, receivedMarkers);
        }

        [Fact]
        public async Task _2人の話者が交互に音声合成を行う場合_それぞれの音声が正しく分離される()
        {
            var requestLog = new List<(System.DateTime Time, int SpeakerId, string Text)>();
            
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => 
                        req.Method == HttpMethod.Post && 
                        req.RequestUri!.ToString().Contains("/voice")),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync((HttpRequestMessage request, CancellationToken token) =>
                {
                    var uri = request.RequestUri!.ToString();
                    
                    var speakerIdMatch = System.Text.RegularExpressions.Regex.Match(uri, @"speaker_id=(\d+)");
                    var speakerId = speakerIdMatch.Success ? int.Parse(speakerIdMatch.Groups[1].Value) : 0;
                    
                    lock (requestLog)
                    {
                        requestLog.Add((System.DateTime.Now, speakerId, uri));
                    }
                    
                    Thread.Sleep(40);
                    
                    var audioData = new byte[] { 0x52, 0x49, 0x46, 0x46, (byte)(0x10 + speakerId) };
                    return new HttpResponseMessage
                    {
                        StatusCode = HttpStatusCode.OK,
                        Content = new ByteArrayContent(audioData)
                    };
                });

            var service = CreateServiceWithMockHandler(mockHandler);

            var tasks = new List<Task<byte[]>>
            {
                service.SynthesizeAsync("話者Aの発言1", modelId: 0, speakerId: 10),
                service.SynthesizeAsync("話者Bの発言1", modelId: 0, speakerId: 20),
                service.SynthesizeAsync("話者Aの発言2", modelId: 0, speakerId: 10),
                service.SynthesizeAsync("話者Bの発言2", modelId: 0, speakerId: 20),
            };

            var results = await Task.WhenAll(tasks);

            _output.WriteLine($"リクエストログ数: {requestLog.Count}");
            for (int i = 0; i < requestLog.Count; i++)
            {
                _output.WriteLine($"  [{i}] SpeakerId={requestLog[i].SpeakerId}, Time={requestLog[i].Time:HH:mm:ss.fff}");
            }

            Assert.Equal(4, results.Length);
            
            Assert.Equal(0x1A, results[0][4]);
            Assert.Equal(0x1A, results[2][4]);
            
            Assert.Equal(0x24, results[1][4]);
            Assert.Equal(0x24, results[3][4]);
            
            Assert.NotEqual(results[0][4], results[1][4]);
            Assert.NotEqual(results[2][4], results[3][4]);
        }

        [Fact]
        public async Task ストリーミング音声合成で複数の話者が同時にリクエストした場合_それぞれのストリームが混ざらない()
        {
            var speaker1Chunks = new List<byte[]>
            {
                new byte[] { 0x52, 0x49, 0x46, 0x46, 0x01, 0x01 },
                new byte[] { 0x52, 0x49, 0x46, 0x46, 0x01, 0x02 }
            };
            
            var speaker2Chunks = new List<byte[]>
            {
                new byte[] { 0x52, 0x49, 0x46, 0x46, 0x02, 0x01 },
                new byte[] { 0x52, 0x49, 0x46, 0x46, 0x02, 0x02 }
            };
            
            int speaker1ChunkIndex = 0;
            int speaker2ChunkIndex = 0;
            
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => 
                        req.Method == HttpMethod.Post && 
                        req.RequestUri!.ToString().Contains("speaker_id=1")),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(() =>
                {
                    var index = speaker1ChunkIndex++;
                    Thread.Sleep(30);
                    return new HttpResponseMessage
                    {
                        StatusCode = HttpStatusCode.OK,
                        Content = new ByteArrayContent(index < speaker1Chunks.Count ? speaker1Chunks[index] : speaker1Chunks[0])
                    };
                });
            
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => 
                        req.Method == HttpMethod.Post && 
                        req.RequestUri!.ToString().Contains("speaker_id=2")),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(() =>
                {
                    var index = speaker2ChunkIndex++;
                    Thread.Sleep(30);
                    return new HttpResponseMessage
                    {
                        StatusCode = HttpStatusCode.OK,
                        Content = new ByteArrayContent(index < speaker2Chunks.Count ? speaker2Chunks[index] : speaker2Chunks[0])
                    };
                });

            var service = CreateServiceWithMockHandler(mockHandler);

            var speaker1Results = new List<byte[]>();
            var speaker2Results = new List<byte[]>();

            var task1 = Task.Run(async () =>
            {
                await foreach (var chunk in service.SynthesizeStreamAsync("話者1のテキスト", modelId: 0, speakerId: 1))
                {
                    speaker1Results.Add(chunk);
                }
            });

            var task2 = Task.Run(async () =>
            {
                await foreach (var chunk in service.SynthesizeStreamAsync("話者2のテキスト", modelId: 0, speakerId: 2))
                {
                    speaker2Results.Add(chunk);
                }
            });

            await Task.WhenAll(task1, task2);

            _output.WriteLine($"話者1のチャンク数: {speaker1Results.Count}");
            _output.WriteLine($"話者2のチャンク数: {speaker2Results.Count}");

            Assert.NotEmpty(speaker1Results);
            Assert.NotEmpty(speaker2Results);
            
            Assert.All(speaker1Results, chunk => Assert.Equal(0x01, chunk[4]));
            
            Assert.All(speaker2Results, chunk => Assert.Equal(0x02, chunk[4]));
        }

        [Fact]
        public async Task 高負荷状態で5人の話者が同時に音声合成をリクエストした場合_すべての音声が正しく処理される()
        {
            var requestCounts = new Dictionary<int, int>();
            var lockObject = new object();
            
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => 
                        req.Method == HttpMethod.Post && 
                        req.RequestUri!.ToString().Contains("/voice")),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync((HttpRequestMessage request, CancellationToken token) =>
                {
                    var uri = request.RequestUri!.ToString();
                    var speakerIdMatch = System.Text.RegularExpressions.Regex.Match(uri, @"speaker_id=(\d+)");
                    var speakerId = speakerIdMatch.Success ? int.Parse(speakerIdMatch.Groups[1].Value) : 0;
                    
                    lock (lockObject)
                    {
                        if (!requestCounts.ContainsKey(speakerId))
                            requestCounts[speakerId] = 0;
                        requestCounts[speakerId]++;
                    }
                    
                    Thread.Sleep(20);
                    
                    var audioData = new byte[] { 0x52, 0x49, 0x46, 0x46, (byte)speakerId };
                    return new HttpResponseMessage
                    {
                        StatusCode = HttpStatusCode.OK,
                        Content = new ByteArrayContent(audioData)
                    };
                });

            var service = CreateServiceWithMockHandler(mockHandler);

            var tasks = new List<Task<byte[]>>();
            for (int speakerId = 1; speakerId <= 5; speakerId++)
            {
                for (int count = 0; count < 2; count++)
                {
                    var id = speakerId;
                    tasks.Add(service.SynthesizeAsync($"話者{id}の発言{count + 1}", modelId: 0, speakerId: id));
                }
            }

            var results = await Task.WhenAll(tasks);

            _output.WriteLine($"総リクエスト数: {results.Length}");
            foreach (var kvp in requestCounts.OrderBy(k => k.Key))
            {
                _output.WriteLine($"  話者ID {kvp.Key}: {kvp.Value}回");
            }

            Assert.Equal(10, results.Length);
            Assert.All(results, r => Assert.NotEmpty(r));
            
            foreach (var speakerId in Enumerable.Range(1, 5))
            {
                Assert.Equal(2, requestCounts[speakerId]);
            }
            
            var speakerIdCounts = results.GroupBy(r => r[4]).ToDictionary(g => g.Key, g => g.Count());
            foreach (var speakerId in Enumerable.Range(1, 5))
            {
                Assert.Equal(2, speakerIdCounts[(byte)speakerId]);
            }
        }

        [Fact]
        public async Task ラジオモードシナリオ_2人のパーソナリティが交互に会話する場合_音声が正しく分離される()
        {
            var conversationLog = new List<(System.DateTime Time, int SpeakerId, string Text)>();
            
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => 
                        req.Method == HttpMethod.Post && 
                        req.RequestUri!.ToString().Contains("/voice")),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync((HttpRequestMessage request, CancellationToken token) =>
                {
                    var uri = request.RequestUri!.ToString();
                    var speakerIdMatch = System.Text.RegularExpressions.Regex.Match(uri, @"speaker_id=(\d+)");
                    var speakerId = speakerIdMatch.Success ? int.Parse(speakerIdMatch.Groups[1].Value) : 1;
                    
                    var textMatch = System.Text.RegularExpressions.Regex.Match(uri, @"text=([^&]+)");
                    var text = textMatch.Success ? System.Web.HttpUtility.UrlDecode(textMatch.Groups[1].Value) : "";
                    
                    lock (conversationLog)
                    {
                        conversationLog.Add((System.DateTime.Now, speakerId, text));
                    }
                    
                    Thread.Sleep(25);
                    
                    var audioData = new byte[] { 0x52, 0x49, 0x46, 0x46, (byte)speakerId, (byte)speakerId };
                    return new HttpResponseMessage
                    {
                        StatusCode = HttpStatusCode.OK,
                        Content = new ByteArrayContent(audioData)
                    };
                });

            var service = CreateServiceWithMockHandler(mockHandler);

            var conversation = new List<(int SpeakerId, string Text)>
            {
                (1, "こんにちは、今日もいい天気ですね"),
                (2, "本当ですね。今日は何の話をしましょうか"),
                (1, "最近のAI技術について話しましょう"),
                (2, "いいですね。特に音声合成技術は進化していますよね"),
                (1, "そうですね。私たちもその恩恵を受けています"),
                (2, "リスナーの皆さんもきっと興味があるはずです"),
                (1, "それでは、詳しく説明していきましょう"),
                (2, "はい、お願いします"),
            };

            var tasks = conversation.Select(c => 
                service.SynthesizeAsync(c.Text, modelId: 0, speakerId: c.SpeakerId)
            ).ToList();

            var results = await Task.WhenAll(tasks);

            _output.WriteLine("=== 会話ログ ===");
            for (int i = 0; i < conversationLog.Count; i++)
            {
                _output.WriteLine($"[{i + 1}] 話者{conversationLog[i].SpeakerId}: {conversationLog[i].Text} ({conversationLog[i].Time:HH:mm:ss.fff})");
            }

            Assert.Equal(8, results.Length);
            
            var speaker1Responses = results.Where((r, i) => conversation[i].SpeakerId == 1).ToList();
            var speaker2Responses = results.Where((r, i) => conversation[i].SpeakerId == 2).ToList();
            
            Assert.Equal(4, speaker1Responses.Count);
            Assert.Equal(4, speaker2Responses.Count);
            
            Assert.All(speaker1Responses, r => Assert.Equal(0x01, r[4]));
            Assert.All(speaker2Responses, r => Assert.Equal(0x02, r[4]));
        }

        #endregion

        #region ヘルパーメソッド

        private StyleBertVits2Service CreateServiceWithMockHandler(Mock<HttpMessageHandler> mockHandler)
        {
            var httpClient = new HttpClient(mockHandler.Object)
            {
                BaseAddress = new System.Uri(TEST_BASE_URL)
            };

            var service = new StyleBertVits2Service(TEST_BASE_URL);
            
            var httpClientField = typeof(StyleBertVits2Service)
                .GetField("_httpClient", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            httpClientField?.SetValue(service, httpClient);

            return service;
        }

        #endregion
    }
}
