using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace DesktopAiMascot.aiservice.image
{
    /// <summary>
    /// ComfyUIを使用した画像背景削除サービス (Local)
    /// </summary>
    internal class ComfyImageService : ImageAiServiceBase
    {
        private readonly HttpClient _httpClient;
        private string _baseUrl = "http://127.0.0.1:8188";
        private readonly string _clientId = Guid.NewGuid().ToString();

        public override string Name => "ComfyUI";
        public override string EndPoint => _baseUrl;

        public ComfyImageService()
        {
            _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(300) };
            Url = _baseUrl;
        }

        public override async Task<string?> RemoveBackgroundAsync(string imageData)
        {
            try
            {
                Debug.WriteLine("[ComfyImageService] 背景削除処理を開始");

                // 画像をComfyUIにアップロード
                var uploadedFilename = await UploadImageAsync(imageData);
                if (string.IsNullOrEmpty(uploadedFilename))
                {
                    Debug.WriteLine("[ComfyImageService] 画像のアップロードに失敗");
                    return null;
                }

                Debug.WriteLine($"[ComfyImageService] 画像アップロード成功: {uploadedFilename}");

                // 背景削除用のワークフローを生成
                var workflow = await CreateRemoveBackgroundWorkflowAsync(uploadedFilename);

                // ワークフローをComfyUIに送信
                var promptId = await SubmitWorkflowAsync(workflow);
                if (string.IsNullOrEmpty(promptId))
                {
                    Debug.WriteLine("[ComfyImageService] ワークフロー送信に失敗");
                    return null;
                }

                Debug.WriteLine($"[ComfyImageService] ワークフロー送信成功: prompt_id={promptId}");

                // 処理完了を待機
                var result = await WaitForCompletionAsync(promptId);
                if (result == null)
                {
                    Debug.WriteLine("[ComfyImageService] 処理完了の待機に失敗");
                    return null;
                }

                Debug.WriteLine("[ComfyImageService] 背景削除処理が完了しました");
                return result;
            }
            catch (HttpRequestException ex)
            {
                Debug.WriteLine($"[ComfyImageService] ComfyUIとの接続エラー: {ex.Message}");
                return null;
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("[ComfyImageService] タイムアウトエラー");
                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ComfyImageService] エラー: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 画像をComfyUIにアップロードする
        /// </summary>
        private async Task<string?> UploadImageAsync(string imageData)
        {
            try
            {
                // Base64データから画像バイトを取得
                byte[] imageBytes = GetImageBytesFromBase64(imageData);

                // MultipartFormDataContentを作成
                using var content = new MultipartFormDataContent();
                var imageContent = new ByteArrayContent(imageBytes);
                imageContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
                content.Add(imageContent, "image", "uploaded_image.png");

                var url = $"{Url}/upload/image";
                Debug.WriteLine($"[ComfyImageService] POST {url}");

                var response = await _httpClient.PostAsync(url, content);
                response.EnsureSuccessStatusCode();

                var responseJson = await response.Content.ReadAsStringAsync();
                Debug.WriteLine($"[ComfyImageService] アップロード応答: {responseJson}");

                using var doc = JsonDocument.Parse(responseJson);
                if (doc.RootElement.TryGetProperty("name", out var nameElement))
                {
                    return nameElement.GetString();
                }

                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ComfyImageService] 画像アップロードエラー: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 背景削除用のワークフローを生成する
        /// </summary>
        private async Task<Dictionary<string, object>> CreateRemoveBackgroundWorkflowAsync(string uploadedFilename)
        {
            try
            {
                // ワークフローテンプレートのパスを取得
                var workflowPath = Path.Combine(
                    AppDomain.CurrentDomain.BaseDirectory,
                    "aiservice", "image", "comfy_workflows", "remove_background_workflow.json"
                );

                Debug.WriteLine($"[ComfyImageService] ワークフローテンプレートパス: {workflowPath}");

                // ワークフローテンプレートを読み込む
                if (File.Exists(workflowPath))
                {
                    var workflowJson = await File.ReadAllTextAsync(workflowPath);
                    var workflow = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(workflowJson);

                    if (workflow != null)
                    {
                        // 結果を構築
                        var result = new Dictionary<string, object>();
                        
                        foreach (var kvp in workflow)
                        {
                            var nodeData = JsonSerializer.Deserialize<Dictionary<string, object>>(kvp.Value.GetRawText());
                            
                            // LoadImageノード（ノード1）の画像ファイル名を更新
                            if (kvp.Key == "1" && nodeData != null)
                            {
                                if (nodeData.TryGetValue("inputs", out var inputsObj))
                                {
                                    var inputsJson = JsonSerializer.Serialize(inputsObj);
                                    var inputs = JsonSerializer.Deserialize<Dictionary<string, object>>(inputsJson);
                                    if (inputs != null)
                                    {
                                        inputs["image"] = uploadedFilename;
                                        nodeData["inputs"] = inputs;
                                    }
                                }
                            }
                            
                            result[kvp.Key] = nodeData!;
                        }
                        
                        Debug.WriteLine($"[ComfyImageService] ワークフロー生成完了: {result.Count} ノード");
                        return result;
                    }
                }
                else
                {
                    Debug.WriteLine($"[ComfyImageService] ワークフローテンプレートが見つかりません: {workflowPath}");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ComfyImageService] ワークフロー生成エラー: {ex.Message}");
                Debug.WriteLine($"[ComfyImageService] スタックトレース: {ex.StackTrace}");
            }

            // フォールバック: 基本的なワークフローを返す
            Debug.WriteLine("[ComfyImageService] フォールバックワークフローを使用");
            return new Dictionary<string, object>
            {
                ["1"] = new Dictionary<string, object>
                {
                    ["inputs"] = new Dictionary<string, object>
                    {
                        ["image"] = uploadedFilename
                    },
                    ["class_type"] = "LoadImage",
                    ["_meta"] = new Dictionary<string, object>
                    {
                        ["title"] = "Load Image"
                    }
                }
            };
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

                var url = $"{Url}/prompt";
                Debug.WriteLine($"[ComfyImageService] POST {url}");

                var response = await _httpClient.PostAsync(url, content);
                response.EnsureSuccessStatusCode();

                var responseJson = await response.Content.ReadAsStringAsync();
                Debug.WriteLine($"[ComfyImageService] サーバー応答: {responseJson}");

                using var doc = JsonDocument.Parse(responseJson);
                if (doc.RootElement.TryGetProperty("prompt_id", out var promptIdElement))
                {
                    return promptIdElement.GetString();
                }

                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ComfyImageService] ワークフロー送信エラー: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 処理完了を待機して結果を取得する
        /// </summary>
        private async Task<string?> WaitForCompletionAsync(string promptId)
        {
            // ポーリング方式で履歴を確認
            for (int i = 0; i < 60; i++) // 最大5分待機
            {
                await Task.Delay(5000); // 5秒ごとにチェック

                try
                {
                    var url = $"{Url}/history/{promptId}";
                    var response = await _httpClient.GetAsync(url);
                    response.EnsureSuccessStatusCode();

                    var json = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(json);

                    // promptIdのデータを確認
                    if (doc.RootElement.TryGetProperty(promptId, out var historyData))
                    {
                        // outputs を確認
                        if (historyData.TryGetProperty("outputs", out var outputs))
                        {
                            // 最初のノードの画像を取得
                            foreach (var output in outputs.EnumerateObject())
                            {
                                if (output.Value.TryGetProperty("images", out var images) &&
                                    images.GetArrayLength() > 0)
                                {
                                    var firstImage = images[0];
                                    var filename = firstImage.GetProperty("filename").GetString();
                                    var subfolder = firstImage.GetProperty("subfolder").GetString() ?? "";
                                    var type = firstImage.GetProperty("type").GetString() ?? "output";

                                    // 画像を取得
                                    var imageData = await GetImageAsync(filename, subfolder, type);
                                    if (imageData != null)
                                    {
                                        return ConvertImageToBase64(imageData);
                                    }
                                }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[ComfyImageService] 履歴取得エラー: {ex.Message}");
                }
            }

            Debug.WriteLine("[ComfyImageService] タイムアウト: 処理完了を確認できませんでした");
            return null;
        }

        /// <summary>
        /// ComfyUIから画像を取得する
        /// </summary>
        private async Task<byte[]?> GetImageAsync(string filename, string subfolder, string type)
        {
            try
            {
                var url = $"{Url}/view?filename={Uri.EscapeDataString(filename)}&type={type}&subfolder={Uri.EscapeDataString(subfolder)}";
                Debug.WriteLine($"[ComfyImageService] 画像取得: {url}");

                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();

                return await response.Content.ReadAsByteArrayAsync();
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ComfyImageService] 画像取得エラー: {ex.Message}");
                return null;
            }
        }

        public override async Task<string[]> GetAvailableModels()
        {
            try
            {
                // ComfyUIのチェックポイントリストを取得
                var url = $"{Url}/object_info/CheckpointLoaderSimple";
                Debug.WriteLine($"[ComfyImageService] GET {url}");

                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(content);

                var models = new List<string>();

                // CheckpointLoaderSimpleの入力情報からckpt_nameを取得
                if (doc.RootElement.TryGetProperty("input", out var input) &&
                    input.TryGetProperty("required", out var required) &&
                    required.TryGetProperty("ckpt_name", out var ckptName) &&
                    ckptName.GetArrayLength() > 0 &&
                    ckptName[0].ValueKind == JsonValueKind.Array)
                {
                    foreach (var model in ckptName[0].EnumerateArray())
                    {
                        var modelName = model.GetString();
                        if (!string.IsNullOrEmpty(modelName))
                        {
                            models.Add(modelName);
                        }
                    }
                }

                Debug.WriteLine($"[ComfyImageService] 取得したモデル数: {models.Count}");
                return models.ToArray();
            }
            catch (HttpRequestException ex)
            {
                Debug.WriteLine($"[ComfyImageService] ComfyUIとの接続エラー: {ex.Message}");
                return Array.Empty<string>();
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("[ComfyImageService] タイムアウトエラー");
                return Array.Empty<string>();
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ComfyImageService] エラー: {ex.Message}");
                return Array.Empty<string>();
            }
        }

        /// <summary>
        /// ComfyUIサーバーの接続確認
        /// </summary>
        public async Task<bool> CheckConnectionAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync($"{Url}/system_stats");
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }
    }
}
