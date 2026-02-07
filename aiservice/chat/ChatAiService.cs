using System;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System.Diagnostics;

namespace DesktopAiMascot.aiservice.chat
{
    // AIチャットサービスのインターフェース
    public interface ChatAiService
    {
        /// <summary>
        /// 利用可能なモデルリストを取得する
        /// </summary>
        /// <param name="reload">キャッシュを無視して再取得する場合はtrue</param>
        /// <returns>ModelDisplayItemの配列</returns>
        public Task<ModelDisplayItem[]> GetAvailableModels( bool reload );

        // AIにチャットメッセージを送信する
        public Task<string?> SendMessageAsync(string message);

        /// <summary>
        /// 指定したモデルでチャットメッセージを送信する
        /// </summary>
        /// <param name="message">メッセージ</param>
        /// <param name="modelName">モデル名</param>
        public Task<string?> SendMessageAsync(string message, string? modelName);

        /// <summary>
        /// 画像とテキストを含むメッセージを送信する（画像編集用）
        /// </summary>
        /// <param name="images">画像データの配列（Base64エンコード文字列）</param>
        /// <param name="prompt">プロンプト</param>
        /// <returns>生成された画像のBase64文字列、またはテキストレスポンス</returns>
        public Task<string?> SendMessageWithImagesAsync(string[] images, string prompt);

        /// <summary>
        /// システムプロンプトとユーザープロンプトを明示的に指定してメッセージを送信する
        /// 会話履歴を保持せず、1回限りのリクエストを行う
        /// </summary>
        /// <param name="systemPrompt">システムプロンプト（AIの役割や動作を定義）</param>
        /// <param name="userPrompt">ユーザープロンプト（実際のリクエスト内容）</param>
        /// <returns>AIの応答テキスト</returns>
        public Task<string?> SendOneShotMessageAsync(string systemPrompt, string userPrompt);

        // チャット履歴をクリアする
        public void ClearConversation();

        public string EndPoint { get; set; }
    }

    public abstract class ChatAiServiceBase : ChatAiService
    {
        private ModelDisplayItem[]? _cachedModels;

        public virtual async Task<ModelDisplayItem[]> GetAvailableModels( bool reload )
        {
            if (!reload && _cachedModels != null)
            {
                return _cachedModels;
            }

            try
            {
                // OpenAI API互換のmodelsエンドポイントを呼び出す
                var url = EndPoint.TrimEnd('/') + "/models";
                
                using var client = new HttpClient();
                var response = await client.GetAsync(url);
                
                if (!response.IsSuccessStatusCode)
                {
                    return Array.Empty<ModelDisplayItem>();
                }
                
                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                
                if (doc.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
                {
                    var models = data.EnumerateArray()
                        .Select(element => element.TryGetProperty("id", out var id) ? id.GetString() : null)
                        .Where(id => !string.IsNullOrEmpty(id))
                        .Cast<string>()
                        .Select(id => new ModelDisplayItem(id))
                        .ToArray();

                    _cachedModels = models;
                    return _cachedModels;
                }
                
                return Array.Empty<ModelDisplayItem>();
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"GetAvailableModels Error: {ex.Message}");
                return Array.Empty<ModelDisplayItem>();
            }
        }

        public abstract Task<string?> SendMessageAsync(string message);

        /// <summary>
        /// 指定したモデルでチャットメッセージを送信する（デフォルト実装）
        /// </summary>
        public virtual Task<string?> SendMessageAsync(string message, string? modelName)
        {
            return SendMessageAsync(message, modelName);
        }

        /// <summary>
        /// 画像とテキストを含むメッセージを送信する（デフォルト実装：未サポート）
        /// </summary>
        public virtual Task<string?> SendMessageWithImagesAsync(string[] images, string prompt)
        {
            Debug.WriteLine($"[ChatAiService] SendMessageWithImagesAsync is not supported by {this.GetType().Name}");
            return Task.FromResult<string?>("Error: Image input is not supported by this service.");
        }

        /// <summary>
        /// システムプロンプトとユーザープロンプトを明示的に指定してメッセージを送信する（デフォルト実装）
        /// </summary>
        public virtual async Task<string?> SendOneShotMessageAsync(string systemPrompt, string userPrompt)
        {
            // デフォルト実装: システムプロンプトとユーザープロンプトを結合して送信
            var combinedMessage = $"{systemPrompt}\n\n{userPrompt}";
            return await SendMessageAsync(combinedMessage);
        }

        public abstract void ClearConversation();

        public abstract string EndPoint { get; set; }
    }
}
