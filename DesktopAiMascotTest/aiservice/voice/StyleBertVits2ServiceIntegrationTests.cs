using DesktopAiMascot.aiservice.voice;
using DesktopAiMascot.aiservice.voice.schemas;
using Xunit.Abstractions;

namespace DesktopAiMascotTest.aiservice.voice
{
    /// <summary>
    /// StyleBertVits2Service の統合テスト
    /// 注意: これらのテストは実際のStyleBertVits2サーバーが必要です
    /// サーバーが http://127.0.0.1:5000 で起動している必要があります
    /// </summary>
    public class StyleBertVits2ServiceIntegrationTests
    {
        private readonly ITestOutputHelper _output;
        private const string SERVER_URL = "http://127.0.0.1:5000";

        public StyleBertVits2ServiceIntegrationTests(ITestOutputHelper output)
        {
            _output = output;
        }

        [IntegrationFact]
        public async Task 実際のサーバーからサーバー情報を取得できる()
        {
            var service = new StyleBertVits2Service(SERVER_URL);

            var info = await service.GetModelsInfoTypedAsync();
            
            Assert.NotNull(info);
            Assert.NotEmpty(info);
            _output.WriteLine($"Loaded Models Count: {info.Count}");
            
            foreach (var kvp in info)
            {
                _output.WriteLine($"Model ID: {kvp.Key}");
                _output.WriteLine($"  Device: {kvp.Value.Device}");
            }
        }

        [IntegrationFact]
        public async Task 実際のサーバーからステータスを取得できる()
        {
            var service = new StyleBertVits2Service(SERVER_URL);

            var status = await service.GetStatusTypedAsync();
            
            Assert.NotNull(status);
            _output.WriteLine($"Devices: {string.Join(", ", status.Devices)}");
            _output.WriteLine($"CPU: {status.CpuPercent}%");
            _output.WriteLine($"Memory: {status.MemoryPercent}%");
        }

        [IntegrationFact]
        public async Task 実際のサーバーから利用可能なモデルを取得できる()
        {
            var service = new StyleBertVits2Service(SERVER_URL);

            var models = await service.GetAvailableModels();
            
            _output.WriteLine($"Available Models: {string.Join(", ", models)}");
            Assert.NotNull(models);
        }

        [IntegrationFact]
        public async Task 実際のサーバーから利用可能な話者を取得できる()
        {
            var service = new StyleBertVits2Service(SERVER_URL);

            var speakers = await service.GetAvailableSpeakers();
            
            _output.WriteLine($"Available Speakers: {string.Join(", ", speakers)}");
            Assert.NotNull(speakers);
        }

        [IntegrationFact]
        public async Task 実際のサーバーで音声合成を実行できる()
        {
            var service = new StyleBertVits2Service(SERVER_URL);
            var testText = "こんにちは、テストです。";

            var audioData = await service.SynthesizeAsync(testText);
            
            _output.WriteLine($"Audio Data Size: {audioData.Length} bytes");
            Assert.NotEmpty(audioData);
            
            // WAVファイルのヘッダーチェック (RIFF)
            Assert.Equal(0x52, audioData[0]); // 'R'
            Assert.Equal(0x49, audioData[1]); // 'I'
            Assert.Equal(0x46, audioData[2]); // 'F'
            Assert.Equal(0x46, audioData[3]); // 'F'
        }

        [IntegrationFact]
        public async Task 実際のサーバーで長いテキストを音声合成できる()
        {
            var service = new StyleBertVits2Service(SERVER_URL);
            var longText = "これは長いテキストのテストです。" + new string('あ', 150);

            var audioData = await service.SynthesizeAsync(longText);
            
            _output.WriteLine($"Long Text Audio Data Size: {audioData.Length} bytes");
            Assert.NotEmpty(audioData);
        }

        [IntegrationFact]
        public async Task 実際のサーバーでストリーミング音声合成を実行できる()
        {
            var service = new StyleBertVits2Service(SERVER_URL);
            var testText = "ストリーミングテストです。";

            var chunks = new List<byte[]>();
            await foreach (var chunk in service.SynthesizeStreamAsync(testText))
            {
                chunks.Add(chunk);
                _output.WriteLine($"Received chunk: {chunk.Length} bytes");
            }
            
            Assert.NotEmpty(chunks);
            Assert.All(chunks, chunk => Assert.NotEmpty(chunk));
        }

        [IntegrationFact]
        public async Task 実際のサーバーで感情表現を含むテキストを音声合成できる()
        {
            var service = new StyleBertVits2Service(SERVER_URL);
            var textWithEmotion = "(笑いながら)こんにちは！【驚き】なんと！";

            var audioData = await service.SynthesizeAsync(textWithEmotion);
            
            _output.WriteLine($"Filtered Emotion Audio Data Size: {audioData.Length} bytes");
            Assert.NotEmpty(audioData);
        }

        [IntegrationFact]
        public async Task 実際のサーバーでリフレッシュを実行できる()
        {
            var service = new StyleBertVits2Service(SERVER_URL);

            var response = await service.RefreshTypedAsync();
            
            Assert.NotNull(response);
            _output.WriteLine($"Status: {response.Status}");
            _output.WriteLine($"Message: {response.Message}");
        }

        [IntegrationFact]
        public async Task 実際のサーバーでカスタムパラメータを指定して音声合成できる()
        {
            var service = new StyleBertVits2Service(SERVER_URL);
            service.Model = "0";
            service.Speaker = "0";

            var audioData = await service.SynthesizeAsync(
                text: "カスタムパラメータのテストです。",
                modelId: 0,
                speakerId: 0,
                style: "Neutral",
                sdpRatio: 0.3f,
                noise: 0.5f,
                noiseW: 0.7f,
                length: 1.2f
            );
            
            _output.WriteLine($"Custom Parameters Audio Data Size: {audioData.Length} bytes");
            Assert.NotEmpty(audioData);
        }

        [IntegrationFact]
        public async Task VoiceRequestスキーマを使用して実際のサーバーで音声合成できる()
        {
            var service = new StyleBertVits2Service(SERVER_URL);

            var request = new VoiceRequest
            {
                Text = "スキーマを使った音声合成のテストです。",
                ModelId = 0,
                SpeakerId = 0,
                Style = "Neutral",
                SdpRatio = 0.2f,
                Noise = 0.6f,
                Noisew = 0.8f,
                Length = 1.0f,
                Language = "JP"
            };

            var audioData = await service.SynthesizeAsync(request);
            
            _output.WriteLine($"Schema Request Audio Data Size: {audioData.Length} bytes");
            Assert.NotEmpty(audioData);
            
            // WAVファイルのヘッダーチェック
            Assert.Equal(0x52, audioData[0]); // 'R'
            Assert.Equal(0x49, audioData[1]); // 'I'
            Assert.Equal(0x46, audioData[2]); // 'F'
            Assert.Equal(0x46, audioData[3]); // 'F'
        }

        [IntegrationFact]
        public async Task VoiceRequestスキーマを使用してストリーミング音声合成できる()
        {
            var service = new StyleBertVits2Service(SERVER_URL);

            var request = new VoiceRequest
            {
                Text = "スキーマを使ったストリーミング音声合成のテストです。",
                ModelId = 0,
                SpeakerId = 0,
                Style = "Neutral",
                Language = "JP"
            };

            var chunks = new List<byte[]>();
            await foreach (var chunk in service.SynthesizeStreamAsync(request))
            {
                chunks.Add(chunk);
                _output.WriteLine($"Received chunk: {chunk.Length} bytes");
            }
            
            Assert.NotEmpty(chunks);
            Assert.All(chunks, chunk => Assert.NotEmpty(chunk));
        }

        [IntegrationFact]
        public async Task 型付きステータスレスポンスを取得できる()
        {
            var service = new StyleBertVits2Service(SERVER_URL);

            // まずサーバーの接続テストを行う
            try
            {
                using var httpClient = new HttpClient();
                var testResponse = await httpClient.GetAsync($"{SERVER_URL}/status");
                _output.WriteLine($"サーバー接続テスト - Status Code: {testResponse.StatusCode}");
                
                if (!testResponse.IsSuccessStatusCode)
                {
                    _output.WriteLine($"サーバーが正常に応答していません。サーバーが {SERVER_URL} で起動していることを確認してください。");
                    Assert.Fail($"サーバー接続エラー: {testResponse.StatusCode}");
                }
                
                var rawContent = await testResponse.Content.ReadAsStringAsync();
                _output.WriteLine($"生のレスポンス: {rawContent}");
            }
            catch (Exception ex)
            {
                _output.WriteLine($"サーバー接続エラー: {ex.Message}");
                _output.WriteLine($"サーバーが {SERVER_URL} で起動していることを確認してください。");
                throw;
            }

            var status = await service.GetStatusTypedAsync();
            
            Assert.NotNull(status);
            
            // Devicesの確認
            Assert.NotNull(status.Devices);
            Assert.NotEmpty(status.Devices);
            _output.WriteLine($"Devices: {string.Join(", ", status.Devices)}");
            
            // CPU情報の確認
            _output.WriteLine($"CPU Percent: {status.CpuPercent}%");
            
            // メモリ情報の確認
            _output.WriteLine($"Memory Total: {status.MemoryTotal:N0} bytes");
            _output.WriteLine($"Memory Available: {status.MemoryAvailable:N0} bytes");
            _output.WriteLine($"Memory Used: {status.MemoryUsed:N0} bytes");
            _output.WriteLine($"Memory Percent: {status.MemoryPercent}%");
            
            // GPU情報の確認
            Assert.NotNull(status.Gpu);
            
            foreach (var gpu in status.Gpu)
            {
                _output.WriteLine($"GPU {gpu.GpuId}:");
                _output.WriteLine($"  Load: {gpu.GpuLoad * 100}%");
                
                Assert.NotNull(gpu.GpuMemory);
                _output.WriteLine($"  Memory Total: {gpu.GpuMemory.Total} MB");
                _output.WriteLine($"  Memory Used: {gpu.GpuMemory.Used} MB");
                _output.WriteLine($"  Memory Free: {gpu.GpuMemory.Free} MB");
            }
        }

        [IntegrationFact]
        public async Task 型付きモデル情報を取得できる()
        {
            var service = new StyleBertVits2Service(SERVER_URL);

            var modelsInfo = await service.GetModelsInfoTypedAsync();
            
            Assert.NotNull(modelsInfo);
            _output.WriteLine($"Loaded Models Count: {modelsInfo.Count}");
            
            foreach (var kvp in modelsInfo)
            {
                _output.WriteLine($"Model ID: {kvp.Key}");
                _output.WriteLine($"  Config Path: {kvp.Value.ConfigPath}");
                _output.WriteLine($"  Model Path: {kvp.Value.ModelPath}");
                _output.WriteLine($"  Device: {kvp.Value.Device}");
                _output.WriteLine($"  Speakers: {string.Join(", ", kvp.Value.Spk2Id.Keys)}");
            }
        }

        [IntegrationFact]
        public async Task 型付きリフレッシュレスポンスを取得できる()
        {
            var service = new StyleBertVits2Service(SERVER_URL);

            var response = await service.RefreshTypedAsync();
            
            Assert.NotNull(response);
            _output.WriteLine($"Status: {response.Status}");
            _output.WriteLine($"Message: {response.Message}");
        }
    }
}
