using System;
using System.Diagnostics;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace DesktopAiMascot.aiservice.image
{
    /// <summary>
    /// Microsoft Foundry (Local) を使用した画像背景削除サービス
    /// </summary>
    internal class FoundryImageService : ImageAiServiceBase
    {
        private readonly HttpClient _httpClient;
        private string _baseUrl = "http://127.0.0.1:1234";

        public override string Name => "Microsoft Foundry";
        public override string EndPoint => _baseUrl;

        public FoundryImageService()
        {
            _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(120) };
            Url = _baseUrl;
        }

        public override async Task<string?> RemoveBackgroundAsync(string imageData)
        {
            try
            {
                Debug.WriteLine("[FoundryImageService] 背景削除処理を開始");

                // TODO: Microsoft Foundry APIを使用した実際の背景削除処理を実装
                // OpenAI互換APIエンドポイントを使用する想定
                await Task.Delay(1000); // API呼び出しをシミュレート

                Debug.WriteLine("[FoundryImageService] 背景削除処理が完了しました");
                return imageData; // ダミー: 入力をそのまま返す
            }
            catch (HttpRequestException ex)
            {
                Debug.WriteLine($"[FoundryImageService] Microsoft Foundryとの接続エラー: {ex.Message}");
                return null;
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("[FoundryImageService] タイムアウトエラー");
                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[FoundryImageService] エラー: {ex.Message}");
                return null;
            }
        }

        public override async Task<string[]> GetAvailableModels()
        {
            try
            {
                // OpenAI互換のmodelsエンドポイントを使用
                var url = $"{Url}/v1/models";
                Debug.WriteLine($"[FoundryImageService] GET {url}");

                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(content);
                var models = new System.Collections.Generic.List<string>();

                if (doc.RootElement.TryGetProperty("data", out var data))
                {
                    foreach (var model in data.EnumerateArray())
                    {
                        if (model.TryGetProperty("id", out var id))
                        {
                            models.Add(id.GetString() ?? "");
                        }
                    }
                }

                Debug.WriteLine($"[FoundryImageService] 取得したモデル数: {models.Count}");
                return models.ToArray();
            }
            catch (HttpRequestException ex)
            {
                Debug.WriteLine($"[FoundryImageService] Microsoft Foundryとの接続エラー: {ex.Message}");
                return Array.Empty<string>();
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("[FoundryImageService] タイムアウトエラー");
                return Array.Empty<string>();
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[FoundryImageService] エラー: {ex.Message}");
                return Array.Empty<string>();
            }
        }
    }
}
