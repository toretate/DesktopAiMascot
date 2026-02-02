using System;
using System.Diagnostics;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace DesktopAiMascot.aiservice.image
{
    /// <summary>
    /// Gemini APIを使用した画像背景削除サービス
    /// </summary>
    internal class GeminiImageService : ImageAiServiceBase
    {
        private readonly HttpClient _httpClient;
        private string _baseUrl = "https://generativelanguage.googleapis.com/v1beta";
        private string _apiKey = string.Empty;

        public override string Name => "Gemini";
        public override string EndPoint => _baseUrl;

        public GeminiImageService()
        {
            _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(120) };
            Url = _baseUrl;
        }

        /// <summary>
        /// APIキーを設定する
        /// </summary>
        public void SetApiKey(string apiKey)
        {
            _apiKey = apiKey;
        }

        public override async Task<string?> RemoveBackgroundAsync(string imageData)
        {
            try
            {
                Debug.WriteLine("[GeminiImageService] 背景削除処理を開始");

                // TODO: Gemini APIを使用した実際の背景削除処理を実装
                // 現在はダミー実装
                await Task.Delay(1000); // API呼び出しをシミュレート

                Debug.WriteLine("[GeminiImageService] 背景削除処理が完了しました");
                return imageData; // ダミー: 入力をそのまま返す
            }
            catch (HttpRequestException ex)
            {
                Debug.WriteLine($"[GeminiImageService] 接続エラー: {ex.Message}");
                return null;
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("[GeminiImageService] タイムアウトエラー");
                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[GeminiImageService] エラー: {ex.Message}");
                return null;
            }
        }

        public override async Task<string[]> GetAvailableModels()
        {
            // ダミー実装: 利用可能なモデルのリストを返す
            await Task.CompletedTask;
            return new[] { "gemini-pro-vision", "gemini-1.5-pro" };
        }
    }
}
