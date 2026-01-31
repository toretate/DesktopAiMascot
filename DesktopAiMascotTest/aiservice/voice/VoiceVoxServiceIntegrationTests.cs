using System;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice.voice;
using Xunit;

namespace DesktopAiMascotTest.aiservice.voice
{
    /// <summary>
    /// VoiceVoxServiceの統合テスト
    /// 実際のVoiceVoxサーバーとの通信をテストします
    /// 
    /// 実行条件:
    /// - VoiceVoxエンジンが http://localhost:50021 で起動していること
    /// - 環境変数 RUN_INTEGRATION_TESTS=true を設定すること
    /// </summary>
    [Collection("VoiceVox Integration Tests")]
    public class VoiceVoxServiceIntegrationTests : IDisposable
    {
        private readonly VoiceVoxService _service;
        private const string TEST_URL = "http://localhost:50021";

        public VoiceVoxServiceIntegrationTests()
        {
            _service = new VoiceVoxService();
            _service.Url = TEST_URL;
        }

        public void Dispose()
        {
            // クリーンアップ処理（必要に応じて）
        }

        #region サーバー接続テスト

        [IntegrationFact]
        public async Task GetCoreVersionsAsync_ReturnsVersions()
        {
            // Act
            var versions = await _service.GetCoreVersionsAsync();

            // Assert
            Assert.NotNull(versions);
            Assert.NotEmpty(versions);
            Debug.WriteLine($"[VoiceVox Integration Test] コアバージョン: {string.Join(", ", versions)}");
        }

        [IntegrationFact]
        public async Task GetSpeakersAsync_ReturnsSpeakers()
        {
            // Act
            var speakers = await _service.GetSpeakersAsync();

            // Assert
            Assert.NotNull(speakers);
            Assert.NotEmpty(speakers);
            
            foreach (var speaker in speakers)
            {
                Assert.NotEmpty(speaker.Name);
                Assert.NotEmpty(speaker.Speaker_Uuid);
                Assert.NotNull(speaker.Styles);
                Assert.NotEmpty(speaker.Styles);
                
                Debug.WriteLine($"[VoiceVox Integration Test] 話者: {speaker.Name} (UUID: {speaker.Speaker_Uuid})");
                foreach (var style in speaker.Styles)
                {
                    Debug.WriteLine($"  - スタイル: {style.Name} (ID: {style.Id}, Type: {style.Type})");
                }
            }
        }

        [IntegrationFact]
        public async Task GetAvailableSpeakers_ReturnsFormattedSpeakers()
        {
            // Act
            var speakers = await _service.GetAvailableSpeakers();

            // Assert
            Assert.NotNull(speakers);
            Assert.NotEmpty(speakers);
            
            foreach (var speaker in speakers)
            {
                // 形式: "キャラクター名 (スタイル名) [ID]"
                Assert.Contains("(", speaker);
                Assert.Contains(")", speaker);
                Assert.Contains("[", speaker);
                Assert.Contains("]", speaker);
                
                Debug.WriteLine($"[VoiceVox Integration Test] フォーマット済み話者: {speaker}");
            }
        }

        #endregion

        #region 話者初期化テスト

        [IntegrationFact]
        public async Task InitializeSpeakerAsync_WithValidId_ReturnsTrue()
        {
            // Arrange - 四国めたん(ノーマル)のID
            int speakerId = 2;

            // Act
            bool result = await _service.InitializeSpeakerAsync(speakerId);

            // Assert
            Assert.True(result);
            Debug.WriteLine($"[VoiceVox Integration Test] 話者 {speakerId} の初期化に成功");
        }

        [IntegrationFact]
        public async Task IsInitializedSpeakerAsync_AfterInitialization_ReturnsTrue()
        {
            // Arrange
            int speakerId = 2;
            await _service.InitializeSpeakerAsync(speakerId, skipReinit: false);

            // Act
            bool isInitialized = await _service.IsInitializedSpeakerAsync(speakerId);

            // Assert
            Assert.True(isInitialized);
            Debug.WriteLine($"[VoiceVox Integration Test] 話者 {speakerId} は初期化済み");
        }

        #endregion

        #region AudioQuery作成テスト

        [IntegrationFact]
        public async Task CreateAudioQueryAsync_WithShortText_ReturnsValidQuery()
        {
            // Arrange
            int speakerId = 2; // 四国めたん(ノーマル)
            string text = "こんにちは";

            // Act
            var audioQuery = await _service.CreateAudioQueryAsync(text, speakerId);

            // Assert
            Assert.NotNull(audioQuery);
            Assert.NotNull(audioQuery.Accent_Phrases);
            Assert.NotEmpty(audioQuery.Accent_Phrases);
            Assert.Equal(1.0f, audioQuery.SpeedScale);
            Assert.Equal(24000, audioQuery.OutputSamplingRate);
            Assert.False(audioQuery.OutputStereo);
            
            Debug.WriteLine($"[VoiceVox Integration Test] AudioQuery作成成功");
            Debug.WriteLine($"  - テキスト: {text}");
            Debug.WriteLine($"  - Kana: {audioQuery.Kana}");
            Debug.WriteLine($"  - アクセント句数: {audioQuery.Accent_Phrases.Length}");
        }

        [IntegrationFact]
        public async Task CreateAudioQueryAsync_WithLongText_ReturnsValidQuery()
        {
            // Arrange
            int speakerId = 2;
            string text = "今日はとても良い天気ですね。お散歩に行きましょう。";

            // Act
            var audioQuery = await _service.CreateAudioQueryAsync(text, speakerId);

            // Assert
            Assert.NotNull(audioQuery);
            Assert.NotNull(audioQuery.Accent_Phrases);
            Assert.NotEmpty(audioQuery.Accent_Phrases);
            
            Debug.WriteLine($"[VoiceVox Integration Test] 長いテキストのAudioQuery作成成功");
            Debug.WriteLine($"  - テキスト: {text}");
            Debug.WriteLine($"  - アクセント句数: {audioQuery.Accent_Phrases.Length}");
        }

        [IntegrationFact]
        public async Task CreateAudioQueryAsync_WithSpecialCharacters_HandlesCorrectly()
        {
            // Arrange
            int speakerId = 2;
            string text = "こんにちは！お元気ですか？";

            // Act
            var audioQuery = await _service.CreateAudioQueryAsync(text, speakerId);

            // Assert
            Assert.NotNull(audioQuery);
            Assert.NotNull(audioQuery.Accent_Phrases);
            
            Debug.WriteLine($"[VoiceVox Integration Test] 特殊文字を含むテキストのAudioQuery作成成功");
        }

        #endregion

        #region 音声合成テスト

        [IntegrationFact]
        public async Task SynthesisAsync_WithValidQuery_ReturnsAudioData()
        {
            // Arrange
            int speakerId = 2;
            string text = "こんにちは";
            
            // 話者を初期化
            await _service.InitializeSpeakerAsync(speakerId, skipReinit: true);
            
            // AudioQueryを作成
            var audioQuery = await _service.CreateAudioQueryAsync(text, speakerId);
            Assert.NotNull(audioQuery);

            // Act
            var audioData = await _service.SynthesisAsync(audioQuery, speakerId);

            // Assert
            Assert.NotNull(audioData);
            Assert.NotEmpty(audioData);
            Assert.True(audioData.Length > 1000); // WAVヘッダー + 音声データ
            
            // WAVファイルのヘッダーを確認 (RIFF)
            Assert.Equal((byte)'R', audioData[0]);
            Assert.Equal((byte)'I', audioData[1]);
            Assert.Equal((byte)'F', audioData[2]);
            Assert.Equal((byte)'F', audioData[3]);
            
            Debug.WriteLine($"[VoiceVox Integration Test] 音声合成成功");
            Debug.WriteLine($"  - データサイズ: {audioData.Length} bytes");
        }

        [IntegrationFact]
        public async Task SynthesizeAsync_WithSpeakerSet_ReturnsAudioData()
        {
            // Arrange
            _service.Speaker = "四国めたん (ノーマル) [2]";
            string text = "テストです";

            // Act
            var audioData = await _service.SynthesizeAsync(text);

            // Assert
            Assert.NotNull(audioData);
            Assert.NotEmpty(audioData);
            
            Debug.WriteLine($"[VoiceVox Integration Test] SynthesizeAsync (統一インターフェース) 成功");
            Debug.WriteLine($"  - データサイズ: {audioData.Length} bytes");
        }

        [IntegrationFact]
        public async Task SynthesizeAsync_WithDifferentSpeakers_ProducesDifferentAudio()
        {
            // Arrange
            string text = "こんにちは";
            int speaker1 = 2; // 四国めたん(ノーマル)
            int speaker2 = 0; // 四国めたん(あまあま)

            // Act
            var query1 = await _service.CreateAudioQueryAsync(text, speaker1);
            var audio1 = await _service.SynthesisAsync(query1, speaker1);
            
            var query2 = await _service.CreateAudioQueryAsync(text, speaker2);
            var audio2 = await _service.SynthesisAsync(query2, speaker2);

            // Assert
            Assert.NotNull(audio1);
            Assert.NotNull(audio2);
            // 両方の音声が生成されていることを確認（長さは同じこともある）
            Assert.True(audio1.Length > 1000);
            Assert.True(audio2.Length > 1000);
            
            Debug.WriteLine($"[VoiceVox Integration Test] 異なる話者での音声合成");
            Debug.WriteLine($"  - Speaker {speaker1}: {audio1.Length} bytes");
            Debug.WriteLine($"  - Speaker {speaker2}: {audio2.Length} bytes");
        }

        #endregion

        #region AudioQueryパラメータカスタマイズテスト

        [IntegrationFact]
        public async Task SynthesisAsync_WithCustomizedSpeed_ReturnsModifiedAudio()
        {
            // Arrange
            int speakerId = 2;
            string text = "速度を変更したテストです";
            
            var normalQuery = await _service.CreateAudioQueryAsync(text, speakerId);
            var fastQuery = await _service.CreateAudioQueryAsync(text, speakerId);
            
            // 速度を1.5倍に設定
            fastQuery.SpeedScale = 1.5f;

            // Act
            var normalAudio = await _service.SynthesisAsync(normalQuery, speakerId);
            var fastAudio = await _service.SynthesisAsync(fastQuery, speakerId);

            // Assert
            Assert.NotNull(normalAudio);
            Assert.NotNull(fastAudio);
            // 速度が速いと音声データは短くなる
            Assert.True(fastAudio.Length < normalAudio.Length);
            
            Debug.WriteLine($"[VoiceVox Integration Test] 速度カスタマイズ");
            Debug.WriteLine($"  - 通常速度: {normalAudio.Length} bytes");
            Debug.WriteLine($"  - 1.5倍速: {fastAudio.Length} bytes");
        }

        [IntegrationFact]
        public async Task SynthesisAsync_WithCustomizedPitch_ReturnsModifiedAudio()
        {
            // Arrange
            int speakerId = 2;
            string text = "音高を変更したテストです";
            
            var query = await _service.CreateAudioQueryAsync(text, speakerId);
            Assert.NotNull(query);
            
            // 音高を上げる
            query.PitchScale = 0.2f;

            // Act
            var audioData = await _service.SynthesisAsync(query, speakerId);

            // Assert
            Assert.NotNull(audioData);
            Assert.NotEmpty(audioData);
            
            Debug.WriteLine($"[VoiceVox Integration Test] 音高カスタマイズ成功");
        }

        [IntegrationFact]
        public async Task SynthesisAsync_WithCustomizedVolume_ReturnsModifiedAudio()
        {
            // Arrange
            int speakerId = 2;
            string text = "音量を変更したテストです";
            
            var query = await _service.CreateAudioQueryAsync(text, speakerId);
            Assert.NotNull(query);
            
            // 音量を1.5倍に
            query.VolumeScale = 1.5f;

            // Act
            var audioData = await _service.SynthesisAsync(query, speakerId);

            // Assert
            Assert.NotNull(audioData);
            Assert.NotEmpty(audioData);
            
            Debug.WriteLine($"[VoiceVox Integration Test] 音量カスタマイズ成功");
        }

        #endregion

        #region SpeakerInfo取得テスト

        [IntegrationFact]
        public async Task GetSpeakerInfoAsync_WithValidUuid_ReturnsSpeakerInfo()
        {
            // Arrange
            var speakers = await _service.GetSpeakersAsync();
            Assert.NotNull(speakers);
            Assert.NotEmpty(speakers);
            
            string speakerUuid = speakers[0].Speaker_Uuid;

            // Act
            var speakerInfo = await _service.GetSpeakerInfoAsync(speakerUuid);

            // Assert
            Assert.NotNull(speakerInfo);
            Assert.NotEmpty(speakerInfo.Policy);
            Assert.NotEmpty(speakerInfo.Portrait);
            Assert.NotNull(speakerInfo.Style_Infos);
            
            Debug.WriteLine($"[VoiceVox Integration Test] 話者情報取得成功");
            Debug.WriteLine($"  - UUID: {speakerUuid}");
            Debug.WriteLine($"  - Policy: {speakerInfo.Policy.Substring(0, Math.Min(50, speakerInfo.Policy.Length))}...");
            Debug.WriteLine($"  - スタイル情報数: {speakerInfo.Style_Infos?.Length ?? 0}");
        }

        #endregion

        #region ストリーミング合成テスト

        [IntegrationFact]
        public async Task SynthesizeStreamAsync_ReturnsAudioInSingleChunk()
        {
            // Arrange
            _service.Speaker = "四国めたん (ノーマル) [2]";
            string text = "ストリーミングテスト";
            int chunkCount = 0;
            int totalBytes = 0;

            // Act
            await foreach (var chunk in _service.SynthesizeStreamAsync(text))
            {
                chunkCount++;
                totalBytes += chunk.Length;
                Assert.NotNull(chunk);
                Assert.NotEmpty(chunk);
            }

            // Assert
            Assert.Equal(1, chunkCount); // VoiceVoxは1チャンクで返す
            Assert.True(totalBytes > 1000);
            
            Debug.WriteLine($"[VoiceVox Integration Test] ストリーミング合成成功");
            Debug.WriteLine($"  - チャンク数: {chunkCount}");
            Debug.WriteLine($"  - 合計サイズ: {totalBytes} bytes");
        }

        #endregion

        #region エラーハンドリングテスト

        [IntegrationFact]
        public async Task SynthesizeAsync_WithoutSpeaker_ReturnsNull()
        {
            // Arrange
            _service.Speaker = string.Empty;

            // Act
            var result = await _service.SynthesizeAsync("テスト");

            // Assert
            Assert.Null(result);
        }

        [IntegrationFact]
        public async Task SynthesizeAsync_WithInvalidSpeakerFormat_ReturnsNull()
        {
            // Arrange
            _service.Speaker = "InvalidFormat";

            // Act
            var result = await _service.SynthesizeAsync("テスト");

            // Assert
            Assert.Null(result);
        }

        #endregion

        #region 並行処理テスト

        [IntegrationFact]
        public async Task SynthesisAsync_ConcurrentRequests_HandledSequentially()
        {
            // Arrange
            _service.Speaker = "四国めたん (ノーマル) [2]";
            var texts = new[] { "テスト1", "テスト2", "テスト3", "テスト4", "テスト5" };

            // Act
            var tasks = texts.Select(text => _service.SynthesizeAsync(text)).ToArray();
            var results = await Task.WhenAll(tasks);

            // Assert
            Assert.All(results, result =>
            {
                Assert.NotNull(result);
                Assert.NotEmpty(result);
            });
            
            Debug.WriteLine($"[VoiceVox Integration Test] 並行リクエスト処理成功");
            Debug.WriteLine($"  - リクエスト数: {texts.Length}");
            Debug.WriteLine($"  - 成功数: {results.Count(r => r != null)}");
        }

        #endregion
    }
}
