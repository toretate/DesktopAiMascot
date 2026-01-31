using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace DesktopAiMascot.aiservice.voice
{
    /// <summary>
    /// VoiceVox音声合成サービスの管理クラス
    /// Endpoint: http://localhost:50021
    /// OpenAPI仕様: http://127.0.0.1:50021/openapi.json
    /// </summary>
    internal class VoiceVoxService : AiVoiceServiceBase
    {
        private readonly HttpClient _httpClient;
        private readonly SemaphoreSlim _synthesisLock = new SemaphoreSlim(1, 1);
        private string _baseUrl = "http://localhost:50021";

        public override string Name => "VoiceVox";
        public override string EndPoint => _baseUrl;

        public VoiceVoxService()
        {
            _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
            Url = _baseUrl; // Urlプロパティを初期化
        }

        /// <summary>
        /// 喋れるキャラクターの情報の一覧を取得します
        /// GET /speakers
        /// </summary>
        public async Task<VoiceVoxSpeaker[]?> GetSpeakersAsync()
        {
            try
            {
                var url = $"{Url}/speakers";
                Debug.WriteLine($"[VoiceVox] GET {url}");

                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();

                var speakers = await response.Content.ReadFromJsonAsync<VoiceVoxSpeaker[]>();
                Debug.WriteLine($"[VoiceVox] 取得した話者数: {speakers?.Length ?? 0}");

                return speakers;
            }
            catch (HttpRequestException)
            {
                Debug.WriteLine("VoiceVoxとの接続エラー");
                return null;
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("VoiceVoxとの接続エラー (タイムアウト)");
                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"VoiceVoxとの接続エラー: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 指定されたスタイルを初期化します
        /// POST /initialize_speaker
        /// </summary>
        /// <param name="speaker">話者ID（スタイルID）</param>
        /// <param name="skipReinit">既に初期化済みのスタイルの再初期化をスキップするか</param>
        public async Task<bool> InitializeSpeakerAsync(int speaker, bool skipReinit = false)
        {
            try
            {
                var url = $"{Url}/initialize_speaker?speaker={speaker}&skip_reinit={skipReinit.ToString().ToLower()}";
                Debug.WriteLine($"[VoiceVox] POST {url}");

                var response = await _httpClient.PostAsync(url, null);
                response.EnsureSuccessStatusCode();

                Debug.WriteLine($"[VoiceVox] 話者 {speaker} の初期化に成功しました");
                return true;
            }
            catch (HttpRequestException)
            {
                Debug.WriteLine("VoiceVoxとの接続エラー");
                return false;
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("VoiceVoxとの接続エラー (タイムアウト)");
                return false;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"VoiceVoxとの接続エラー: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// 指定されたスタイルが初期化されているかどうかを確認します
        /// GET /is_initialized_speaker
        /// </summary>
        /// <param name="speaker">話者ID（スタイルID）</param>
        public async Task<bool> IsInitializedSpeakerAsync(int speaker)
        {
            try
            {
                var url = $"{Url}/is_initialized_speaker?speaker={speaker}";
                Debug.WriteLine($"[VoiceVox] GET {url}");

                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();

                var isInitialized = await response.Content.ReadFromJsonAsync<bool>();
                Debug.WriteLine($"[VoiceVox] 話者 {speaker} の初期化状態: {isInitialized}");

                return isInitialized;
            }
            catch (HttpRequestException)
            {
                Debug.WriteLine("VoiceVoxとの接続エラー");
                return false;
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("VoiceVoxとの接続エラー (タイムアウト)");
                return false;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"VoiceVoxとの接続エラー: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// 音声合成用のクエリを作成します
        /// POST /audio_query
        /// </summary>
        /// <param name="text">合成するテキスト</param>
        /// <param name="speaker">話者ID（スタイルID）</param>
        public async Task<VoiceVoxAudioQuery?> CreateAudioQueryAsync(string text, int speaker)
        {
            try
            {
                var encodedText = Uri.EscapeDataString(text);
                var url = $"{Url}/audio_query?text={encodedText}&speaker={speaker}";
                Debug.WriteLine($"[VoiceVox] POST {url}");

                var response = await _httpClient.PostAsync(url, null);
                response.EnsureSuccessStatusCode();

                var audioQuery = await response.Content.ReadFromJsonAsync<VoiceVoxAudioQuery>();
                Debug.WriteLine($"[VoiceVox] AudioQuery作成成功: {text}");

                return audioQuery;
            }
            catch (HttpRequestException)
            {
                Debug.WriteLine("VoiceVoxとの接続エラー");
                return null;
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("VoiceVoxとの接続エラー (タイムアウト)");
                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"VoiceVoxとの接続エラー: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 音声合成を実行します
        /// POST /synthesis
        /// </summary>
        /// <param name="audioQuery">音声合成用クエリ</param>
        /// <param name="speaker">話者ID（スタイルID）</param>
        public async Task<byte[]?> SynthesisAsync(VoiceVoxAudioQuery audioQuery, int speaker)
        {
            await _synthesisLock.WaitAsync();
            try
            {
                var url = $"{Url}/synthesis?speaker={speaker}";
                Debug.WriteLine($"[VoiceVox] POST {url}");

                // JsonPropertyName属性を使用してシリアライズ
                var options = new System.Text.Json.JsonSerializerOptions
                {
                    DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
                };
                
                var json = System.Text.Json.JsonSerializer.Serialize(audioQuery, options);
                Debug.WriteLine($"[VoiceVox] Request JSON: {json.Substring(0, Math.Min(200, json.Length))}...");
                
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync(url, content);
                response.EnsureSuccessStatusCode();

                var audioData = await response.Content.ReadAsByteArrayAsync();
                Debug.WriteLine($"[VoiceVox] 音声合成成功: {audioData.Length} bytes");

                return audioData;
            }
            catch (HttpRequestException)
            {
                Debug.WriteLine("VoiceVoxとの接続エラー");
                return null;
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("VoiceVoxとの接続エラー (タイムアウト)");
                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"VoiceVoxとの接続エラー: {ex.Message}");
                return null;
            }
            finally
            {
                _synthesisLock.Release();
            }
        }

        /// <summary>
        /// UUIDで指定された話者の詳細情報を取得します
        /// GET /speaker_info
        /// </summary>
        /// <param name="speakerUuid">話者のUUID</param>
        public async Task<VoiceVoxSpeakerInfo?> GetSpeakerInfoAsync(string speakerUuid)
        {
            try
            {
                var url = $"{Url}/speaker_info?speaker_uuid={speakerUuid}";
                Debug.WriteLine($"[VoiceVox] GET {url}");

                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();

                var speakerInfo = await response.Content.ReadFromJsonAsync<VoiceVoxSpeakerInfo>();
                Debug.WriteLine($"[VoiceVox] 話者情報取得成功: {speakerUuid}");

                return speakerInfo;
            }
            catch (HttpRequestException)
            {
                Debug.WriteLine("VoiceVoxとの接続エラー");
                return null;
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("VoiceVoxとの接続エラー (タイムアウト)");
                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"VoiceVoxとの接続エラー: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 利用可能なコアのバージョン一覧を取得します
        /// GET /core_versions
        /// </summary>
        public async Task<string[]?> GetCoreVersionsAsync()
        {
            try
            {
                var url = $"{Url}/core_versions";
                Debug.WriteLine($"[VoiceVox] GET {url}");

                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();

                var versions = await response.Content.ReadFromJsonAsync<string[]>();
                Debug.WriteLine($"[VoiceVox] コアバージョン数: {versions?.Length ?? 0}");

                return versions;
            }
            catch (HttpRequestException)
            {
                Debug.WriteLine("VoiceVoxとの接続エラー");
                return null;
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("VoiceVoxとの接続エラー (タイムアウト)");
                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"VoiceVoxとの接続エラー: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// VoiceVoxサーバーが起動しているか確認します
        /// GET /version (軽量なエンドポイント)
        /// </summary>
        public async Task<bool> IsServerAvailableAsync()
        {
            try
            {
                var url = $"{Url}/version";
                Debug.WriteLine($"[VoiceVox] 接続確認: GET {url}");

                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                var response = await _httpClient.GetAsync(url, cts.Token);
                
                bool isAvailable = response.IsSuccessStatusCode;
                Debug.WriteLine($"[VoiceVox] サーバー状態: {(isAvailable ? "起動中" : "停止中")}");
                
                return isAvailable;
            }
            catch (HttpRequestException)
            {
                Debug.WriteLine("VoiceVoxとの接続エラー");
                return false;
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("VoiceVoxとの接続エラー (タイムアウト)");
                return false;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"VoiceVoxとの接続エラー: {ex.Message}");
                return false;
            }
        }

        #region AiVoiceServiceBase実装

        public override async Task<string[]> GetAvailableModels()
        {
            // VoiceVoxはモデルの概念がないため、空の配列を返す
            return await Task.FromResult(Array.Empty<string>());
        }

        public override async Task<string[]> GetAvailableSpeakers()
        {
            var speakers = await GetSpeakersAsync();
            if (speakers == null || speakers.Length == 0)
            {
                return Array.Empty<string>();
            }

            var speakerList = new List<string>();
            foreach (var speaker in speakers)
            {
                foreach (var style in speaker.Styles ?? Array.Empty<VoiceVoxSpeakerStyle>())
                {
                    // "キャラクター名 (スタイル名) [ID]" の形式
                    speakerList.Add($"{speaker.Name} ({style.Name}) [{style.Id}]");
                }
            }

            return speakerList.ToArray();
        }

        public override async Task<byte[]?> SynthesizeAsync(string text)
        {
            if (string.IsNullOrEmpty(Speaker))
            {
                Debug.WriteLine("[VoiceVox] Speaker が設定されていません");
                return null;
            }

            // Speaker形式: "キャラクター名 (スタイル名) [ID]"
            var speakerId = ExtractSpeakerId(Speaker);
            if (speakerId == -1)
            {
                Debug.WriteLine($"[VoiceVox] Speaker ID の抽出に失敗しました: {Speaker}");
                return null;
            }

            // 話者が初期化されているか確認
            var isInitialized = await IsInitializedSpeakerAsync(speakerId);
            if (!isInitialized)
            {
                Debug.WriteLine($"[VoiceVox] 話者 {speakerId} を初期化します");
                await InitializeSpeakerAsync(speakerId, skipReinit: true);
            }

            // AudioQueryを作成
            var audioQuery = await CreateAudioQueryAsync(text, speakerId);
            if (audioQuery == null)
            {
                return null;
            }

            // 音声合成を実行
            return await SynthesisAsync(audioQuery, speakerId);
        }

        public override async IAsyncEnumerable<byte[]> SynthesizeStreamAsync(string text)
        {
            // VoiceVoxは現時点でストリーミング合成をサポートしていないため、
            // 通常の合成結果を1つのチャンクとして返す
            var audioData = await SynthesizeAsync(text);
            if (audioData != null && audioData.Length > 0)
            {
                yield return audioData;
            }
        }

        #endregion

        /// <summary>
        /// Speaker文字列からIDを抽出します
        /// </summary>
        private int ExtractSpeakerId(string speaker)
        {
            try
            {
                // "キャラクター名 (スタイル名) [ID]" から [ID] を抽出
                var startIndex = speaker.LastIndexOf('[');
                var endIndex = speaker.LastIndexOf(']');

                if (startIndex >= 0 && endIndex > startIndex)
                {
                    var idStr = speaker.Substring(startIndex + 1, endIndex - startIndex - 1);
                    if (int.TryParse(idStr, out int id))
                    {
                        return id;
                    }
                }

                return -1;
            }
            catch
            {
                return -1;
            }
        }
    }

    #region スキーマクラス

    /// <summary>
    /// 話者情報
    /// </summary>
    public class VoiceVoxSpeaker
    {
        public string Name { get; set; } = string.Empty;
        public string Speaker_Uuid { get; set; } = string.Empty;
        public VoiceVoxSpeakerStyle[]? Styles { get; set; }
        public string? Version { get; set; }
    }

    /// <summary>
    /// スタイル情報
    /// </summary>
    public class VoiceVoxSpeakerStyle
    {
        public string Name { get; set; } = string.Empty;
        public int Id { get; set; }
        public string? Type { get; set; }
    }

    /// <summary>
    /// 音声合成用クエリ
    /// </summary>
    public class VoiceVoxAudioQuery
    {
        [System.Text.Json.Serialization.JsonPropertyName("accent_phrases")]
        public VoiceVoxAccentPhrase[]? Accent_Phrases { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("speedScale")]
        public float SpeedScale { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("pitchScale")]
        public float PitchScale { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("intonationScale")]
        public float IntonationScale { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("volumeScale")]
        public float VolumeScale { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("prePhonemeLength")]
        public float PrePhonemeLength { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("postPhonemeLength")]
        public float PostPhonemeLength { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("pauseLength")]
        public float? PauseLength { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("pauseLengthScale")]
        public float PauseLengthScale { get; set; } = 1.0f;
        
        [System.Text.Json.Serialization.JsonPropertyName("outputSamplingRate")]
        public int OutputSamplingRate { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("outputStereo")]
        public bool OutputStereo { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("kana")]
        public string? Kana { get; set; }
    }

    /// <summary>
    /// アクセント句
    /// </summary>
    public class VoiceVoxAccentPhrase
    {
        [System.Text.Json.Serialization.JsonPropertyName("moras")]
        public VoiceVoxMora[]? Moras { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("accent")]
        public int Accent { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("pause_mora")]
        public VoiceVoxMora? Pause_Mora { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("is_interrogative")]
        public bool Is_Interrogative { get; set; }
    }

    /// <summary>
    /// モーラ（子音＋母音）
    /// </summary>
    public class VoiceVoxMora
    {
        [System.Text.Json.Serialization.JsonPropertyName("text")]
        public string Text { get; set; } = string.Empty;
        
        [System.Text.Json.Serialization.JsonPropertyName("consonant")]
        public string? Consonant { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("consonant_length")]
        public float? Consonant_Length { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("vowel")]
        public string Vowel { get; set; } = string.Empty;
        
        [System.Text.Json.Serialization.JsonPropertyName("vowel_length")]
        public float Vowel_Length { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("pitch")]
        public float Pitch { get; set; }
    }

    /// <summary>
    /// 話者の詳細情報
    /// </summary>
    public class VoiceVoxSpeakerInfo
    {
        public string Policy { get; set; } = string.Empty;
        public string Portrait { get; set; } = string.Empty;
        public VoiceVoxStyleInfo[]? Style_Infos { get; set; }
    }

    /// <summary>
    /// スタイルの追加情報
    /// </summary>
    public class VoiceVoxStyleInfo
    {
        public int Id { get; set; }
        public string Icon { get; set; } = string.Empty;
        public string? Portrait { get; set; }
        public string[]? Voice_Samples { get; set; }
    }

    #endregion
}
