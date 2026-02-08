using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace DesktopAiMascot.aiservice.image
{
    /// <summary>
    /// ComfyUIを使用したQwen3 Image Editサービス (Local)
    /// </summary>
    internal class ComfyQwen3ImageEditService : ImageAiServiceBase
    {
        private const string WorkflowFileName = "qwen3_image_edit_workflow.json";
        private const string AngleWorkflowFileName = "qwen3_image_edit_with_angle_workflow.json";
        private const string PositiveTitleMarker = "Positive";
        private readonly HttpClient _httpClient;
        private readonly string _clientId = Guid.NewGuid().ToString();
        private string _baseUrl = "http://127.0.0.1:8188";
        private readonly Random _random = new Random();

        private string PostImageApi => $"{_baseUrl}/api/upload/image";
        private string PostWorkflowApi => $"{_baseUrl}/api/prompt";

        public override string Name => "Comfy - Qwen3ImageEdit";
        public override string EndPoint => _baseUrl;

        public ComfyQwen3ImageEditService()
        {
            _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(300) };
            Url = _baseUrl;
        }

        public override Task<string?> RemoveBackgroundAsync(string imageData)
        {
            Debug.WriteLine("[ComfyQwen3ImageEditService] 背景削除は未対応です");
            return Task.FromResult<string?>(null);
        }

        /// <summary>
        /// 画像をComfyUIにアップロードする
        /// https://docs.comfy.org/development/cloud/api-reference#direct-upload-multipart
        /// </summary>
        private async Task<string?> UploadImageAsync(string imageData)
        {
            try
            {
                byte[] imageBytes = GetImageBytesFromBase64(imageData);

                using var content = new MultipartFormDataContent();
                var imageContent = new ByteArrayContent(imageBytes);
                imageContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
                content.Add(imageContent, "image", "qwen3_edit_source.png");    // -F "image=@..."
                content.Add(new StringContent("input"), "type");                // -F type=input
                content.Add(new StringContent("true"), "overwrite");            // -F overwrite=true

                var url = PostImageApi;
                Debug.WriteLine($"[ComfyQwen3ImageEditService] POST {url}");

                var response = await _httpClient.PostAsync(url, content);
                response.EnsureSuccessStatusCode();

                var responseJson = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseJson);
                if (doc.RootElement.TryGetProperty("name", out var nameElement))
                {
                    return nameElement.GetString();
                }

                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ComfyQwen3ImageEditService] 画像アップロードエラー: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 画像編集を実行する
        /// </summary>
        public Task<string?> EditImageAsync(string imageData, string prompt)
        {
            return EditImageAsync(imageData, prompt, WorkflowFileName);
        }

        /// <summary>
        /// 角度生成用の画像編集を実行する
        /// </summary>
        public Task<string?> EditImageWithAngleAsync(string imageData, string prompt)
        {
            return EditImageAsync(imageData, prompt, AngleWorkflowFileName);
        }

        private async Task<string?> EditImageAsync(string imageData, string prompt, string workflowFileName)
        {
            try
            {
                Debug.WriteLine("[ComfyQwen3ImageEditService] 画像編集を開始");

                var uploadedFilename = await UploadImageAsync(imageData);
                if (string.IsNullOrEmpty(uploadedFilename))
                {
                    Debug.WriteLine("[ComfyQwen3ImageEditService] 画像のアップロードに失敗");
                    return null;
                }

                var workflow = await CreateEditWorkflowAsync(uploadedFilename, prompt, workflowFileName);
                if (workflow == null)
                {
                    Debug.WriteLine("[ComfyQwen3ImageEditService] ワークフローの生成に失敗");
                    return null;
                }

                var promptId = await SubmitWorkflowAsync(workflow);
                if (string.IsNullOrEmpty(promptId))
                {
                    Debug.WriteLine("[ComfyQwen3ImageEditService] ワークフロー送信に失敗");
                    return null;
                }

                var result = await WaitForCompletionAsync(promptId);
                if (result == null)
                {
                    Debug.WriteLine("[ComfyQwen3ImageEditService] 画像生成に失敗");
                    return null;
                }

                Debug.WriteLine("[ComfyQwen3ImageEditService] 画像編集が完了しました");
                return result;
            }
            catch (HttpRequestException)
            {
                Debug.WriteLine("[ComfyQwen3ImageEditService] ComfyUIとの接続エラー");
                return null;
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("[ComfyQwen3ImageEditService] タイムアウトエラー");
                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ComfyQwen3ImageEditService] エラー: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 画像編集用のワークフローを生成する
        /// </summary>
        private async Task<Dictionary<string, object>?> CreateEditWorkflowAsync(string uploadedFilename, string prompt, string workflowFileName)
        {
            try
            {
                var workflowPath = Path.Combine(
                    AppDomain.CurrentDomain.BaseDirectory,
                    "aiservice", "image", "comfy_workflows", workflowFileName
                );

                Debug.WriteLine($"[ComfyQwen3ImageEditService] ワークフローテンプレートパス: {workflowPath}");

                if (!File.Exists(workflowPath))
                {
                    Debug.WriteLine("[ComfyQwen3ImageEditService] ワークフローテンプレートが見つかりません");
                    return null;
                }

                var workflow = await ComfyWorkflow.Load(workflowPath);

                // 画像inputにBind
                workflow.SetImageInput("41", uploadedFilename);

                // prompt入力にBind
                workflow.SetTextPrompt("89:68", prompt);

                // SeedをランダムにBind
                workflow.SetSeed(_random.Next(1, 10000000));

                // WorkflowDataを取得してDictionary<string, object>に変換
                var workflowData = workflow.GetWorkflow();
                var result = new Dictionary<string, object>();
                
                foreach (var kvp in workflowData)
                {
                    result[kvp.Key] = kvp.Value;
                }

                return result;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ComfyQwen3ImageEditService] ワークフロー生成エラー: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// ワークフローをComfyUIに送信する
        /// </summary>
        private async Task<string?> SubmitWorkflowAsync(Dictionary<string, object> workflow)
        {
            try
            {
                var payload = new
                {
                    client_id = _clientId,
                    prompt = workflow
                };

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var url = PostWorkflowApi;
                Debug.WriteLine($"[ComfyQwen3ImageEditService] POST {url}");

                var response = await _httpClient.PostAsync(url, content);
                response.EnsureSuccessStatusCode();

                var responseJson = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseJson);
                if (doc.RootElement.TryGetProperty("prompt_id", out var promptIdElement))
                {
                    return promptIdElement.GetString();
                }

                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ComfyQwen3ImageEditService] ワークフロー送信エラー: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 処理完了を待機して結果を取得する（ローカルComfyUI用）
        /// </summary>
        private async Task<string?> WaitForCompletionAsync(string promptId)
        {
            const int timeoutSeconds = 300;
            const int pollIntervalMs = 3000; // 3秒ごとにポーリング
            var startTime = DateTime.Now;

            Debug.WriteLine($"[ComfyQwen3ImageEditService] PromptID: {promptId} の完了を待機中");

            while ((DateTime.Now - startTime).TotalSeconds < timeoutSeconds)
            {
                await Task.Delay(pollIntervalMs);

                try
                {
                    // ローカルComfyUIではhistoryエンドポイントをポーリング
                    var historyUrl = $"{_baseUrl}/history/{promptId}";
                    var response = await _httpClient.GetAsync(historyUrl);
                    response.EnsureSuccessStatusCode();

                    var json = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(json);

                    // history/{promptId}は直接そのpromptIdのデータを返す
                    if (doc.RootElement.TryGetProperty(promptId, out var historyData))
                    {
                        // statusをチェック（存在する場合）
                        if (historyData.TryGetProperty("status", out var statusData))
                        {
                            if (statusData.TryGetProperty("completed", out var completed) && completed.GetBoolean())
                            {
                                Debug.WriteLine("[ComfyQwen3ImageEditService] ステータスで完了を確認");
                                return await GetCompletedImageAsync(promptId);
                            }
                        }

                        // outputsが存在する場合は完了とみなす
                        if (historyData.TryGetProperty("outputs", out var outputs) && outputs.ValueKind == JsonValueKind.Object)
                        {
                            Debug.WriteLine("[ComfyQwen3ImageEditService] 出力が生成されました");
                            
                            foreach (var output in outputs.EnumerateObject())
                            {
                                if (output.Value.TryGetProperty("images", out var images) &&
                                    images.ValueKind == JsonValueKind.Array &&
                                    images.GetArrayLength() > 0)
                                {
                                    var firstImage = images[0];
                                    if (firstImage.TryGetProperty("filename", out var filenameElement))
                                    {
                                        var filename = filenameElement.GetString();
                                        var subfolder = firstImage.TryGetProperty("subfolder", out var subfolderElement) ? 
                                            subfolderElement.GetString() ?? "" : "";
                                        var type = firstImage.TryGetProperty("type", out var typeElement) ? 
                                            typeElement.GetString() ?? "output" : "output";

                                        Debug.WriteLine($"[ComfyQwen3ImageEditService] 画像ファイル: {filename}");
                                        var imageData = await DownloadOutputAsync(filename, subfolder, type);
                                        if (imageData != null)
                                        {
                                            return ConvertImageToBase64(imageData);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    else
                    {
                        // まだhistoryに登録されていない（実行待ち or 実行中）
                        Debug.WriteLine($"[ComfyQwen3ImageEditService] PromptID: {promptId} はまだ実行中です");
                    }
                }
                catch (HttpRequestException ex)
                {
                    Debug.WriteLine($"[ComfyQwen3ImageEditService] ComfyUIとの接続エラー: {ex.Message}");
                }
                catch (JsonException ex)
                {
                    Debug.WriteLine($"[ComfyQwen3ImageEditService] JSON解析エラー: {ex.Message}");
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[ComfyQwen3ImageEditService] 履歴取得エラー: {ex.Message}");
                }
            }

            Debug.WriteLine($"[ComfyQwen3ImageEditService] タイムアウト: ジョブが {timeoutSeconds}秒以内に完了しませんでした");
            return null;
        }

        /// <summary>
        /// 完了したジョブから画像を取得する
        /// </summary>
        private async Task<string?> GetCompletedImageAsync(string promptId)
        {
            try
            {
                var url = $"{_baseUrl}/history/{promptId}";
                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);

                if (doc.RootElement.TryGetProperty(promptId, out var historyData))
                {
                    if (historyData.TryGetProperty("outputs", out var outputs))
                    {
                        // すべての出力ノードを処理
                        foreach (var output in outputs.EnumerateObject())
                        {
                            // images, video, audio などの出力タイプをチェック
                            if (output.Value.TryGetProperty("images", out var images) &&
                                images.GetArrayLength() > 0)
                            {
                                var firstImage = images[0];
                                var filename = firstImage.GetProperty("filename").GetString();
                                var subfolder = firstImage.GetProperty("subfolder").GetString() ?? "";
                                var type = firstImage.GetProperty("type").GetString() ?? "output";
                                if( type == "output" && filename != null )
                                {
                                    var imageData = await DownloadOutputAsync(filename, subfolder, type);
                                    if (imageData != null)
                                    {
                                        return ConvertImageToBase64(imageData);
                                    }
                                }

                            }
                        }
                    }
                }

                Debug.WriteLine("[ComfyQwen3ImageEditService] 履歴に画像が見つかりませんでした");
                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ComfyQwen3ImageEditService] 画像取得エラー: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// ComfyUIから画像をダウンロードする（302リダイレクト対応）
        /// </summary>
        private async Task<byte[]?> DownloadOutputAsync(string filename, string subfolder = "", string outputType = "output")
        {
            try
            {
                if (string.IsNullOrEmpty(filename))
                {
                    return null;
                }

                // クエリパラメータを構築
                var queryParams = new Dictionary<string, string>
                {
                    { "filename", filename },
                    { "subfolder", subfolder },
                    { "type", outputType }
                };

                var queryString = string.Join("&", queryParams.Select(kvp => 
                    $"{kvp.Key}={Uri.EscapeDataString(kvp.Value)}"));
                var url = $"{_baseUrl}/view?{queryString}";

                Debug.WriteLine($"[ComfyQwen3ImageEditService] 画像ダウンロード: {url}");

                // リダイレクトを手動処理するために HttpCompletionOption.ResponseHeadersRead を使用
                var request = new HttpRequestMessage(HttpMethod.Get, url);
                var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);

                // 302リダイレクトの場合、署名付きURLから取得（Cloud版）
                if (response.StatusCode == System.Net.HttpStatusCode.Redirect || 
                    response.StatusCode == System.Net.HttpStatusCode.Found)
                {
                    var signedUrl = response.Headers.Location?.ToString();
                    if (string.IsNullOrEmpty(signedUrl))
                    {
                        Debug.WriteLine("[ComfyQwen3ImageEditService] リダイレクト先URLが見つかりません");
                        return null;
                    }

                    Debug.WriteLine($"[ComfyQwen3ImageEditService] 署名付きURLから取得: {signedUrl}");
                    var fileResponse = await _httpClient.GetAsync(signedUrl);
                    fileResponse.EnsureSuccessStatusCode();
                    return await fileResponse.Content.ReadAsByteArrayAsync();
                }

                // 通常のレスポンスの場合（ローカル版）
                response.EnsureSuccessStatusCode();
                return await response.Content.ReadAsByteArrayAsync();
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ComfyQwen3ImageEditService] 画像ダウンロードエラー: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// ComfyUIから画像を取得する（旧メソッド、互換性のために残す）
        /// </summary>
        private async Task<byte[]?> GetImageAsync(string filename, string subfolder, string type)
        {
            return await DownloadOutputAsync(filename, subfolder, type);
        }
    }
}
