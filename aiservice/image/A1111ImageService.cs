using System;
using System.Diagnostics;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace DesktopAiMascot.aiservice.image
{
    /// <summary>
    /// A1111系(Forge等)のStable Diffusion WebUIを使用した画像背景削除サービス (Local)
    /// </summary>
    internal class A1111ImageService : ImageAiServiceBase
    {
        private readonly HttpClient _httpClient;
        private string _baseUrl = "http://127.0.0.1:7860";

        public override string Name => "Stable Diffusion WebUI (A1111/Forge)";
        public override string EndPoint => _baseUrl;

        public A1111ImageService()
        {
            _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(120) };
            Url = _baseUrl;
        }

        public override async Task<string?> RemoveBackgroundAsync(string imageData)
        {
            try
            {
                Debug.WriteLine("[A1111ImageService] 背景削除処理を開始");

                // TODO: A1111/Forge APIを使用した実際の背景削除処理を実装
                // rembg拡張機能やその他の背景削除機能を使用
                await Task.Delay(1000); // API呼び出しをシミュレート

                Debug.WriteLine("[A1111ImageService] 背景削除処理が完了しました");
                return imageData; // ダミー: 入力をそのまま返す
            }
            catch (HttpRequestException ex)
            {
                Debug.WriteLine($"[A1111ImageService] Stable Diffusion WebUIとの接続エラー: {ex.Message}");
                return null;
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("[A1111ImageService] タイムアウトエラー");
                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[A1111ImageService] エラー: {ex.Message}");
                return null;
            }
        }

        public override async Task<string[]> GetAvailableModels()
        {
            try
            {
                // A1111/Forgeのモデルリストを取得
                var url = $"{Url}/sdapi/v1/sd-models";
                Debug.WriteLine($"[A1111ImageService] GET {url}");

                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(content);
                var models = new System.Collections.Generic.List<string>();

                foreach (var model in doc.RootElement.EnumerateArray())
                {
                    if (model.TryGetProperty("model_name", out var modelName))
                    {
                        models.Add(modelName.GetString() ?? "");
                    }
                }

                Debug.WriteLine($"[A1111ImageService] 取得したモデル数: {models.Count}");
                return models.ToArray();
            }
            catch (HttpRequestException ex)
            {
                Debug.WriteLine($"[A1111ImageService] Stable Diffusion WebUIとの接続エラー: {ex.Message}");
                return Array.Empty<string>();
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("[A1111ImageService] タイムアウトエラー");
                return Array.Empty<string>();
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[A1111ImageService] エラー: {ex.Message}");
                return Array.Empty<string>();
            }
        }
    }
}
