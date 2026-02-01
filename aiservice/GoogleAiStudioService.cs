using System;
using System.IO;
using System.Drawing;
using System.Text.Json;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Diagnostics;

namespace DesktopAiMascot.aiservice
{
    internal class GoogleAiStudioService
    {
        private readonly string? apiKey;
        private static readonly HttpClient httpClient = new HttpClient() { Timeout = TimeSpan.FromSeconds(60) };

        public GoogleAiStudioService()
        {
            apiKey = LoadApiKey();
        }

        public void Initialize()
        {
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                Debug.WriteLine("Google AI API key not found. Set environment variable 'DESKTOPAIMASCOT_GOOGLE_API_KEY' or put the key in '%APPDATA%\\DesktopAiMascot\\apikey.txt'.");
            }
        }

        public void sendRequest(string message)
        {
            if (string.IsNullOrWhiteSpace(apiKey)) throw new InvalidOperationException("API key is not configured.");
        }

        public System.Drawing.Image sendImageEditRequest(string prompt, System.Drawing.Image? image, string modelName = "gemini-2.0-flash-exp")
        {
            if (string.IsNullOrWhiteSpace(apiKey)) throw new InvalidOperationException("API key is not configured.");

            try
            {
                // Build payload
                var parts = new List<object>();
                parts.Add(new { text = prompt ?? string.Empty });

                if (image != null)
                {
                    using var ms = new MemoryStream();
                    image.Save(ms, System.Drawing.Imaging.ImageFormat.Png);
                    var bytes = ms.ToArray();
                    var base64 = Convert.ToBase64String(bytes);

                    parts.Add(new
                    {
                        inline_data = new
                        {
                            mime_type = "image/png",
                            data = base64
                        }
                    });
                }

                var contents = new[] { new { parts = parts } };
                var root = new { contents = contents };
                var json = JsonSerializer.Serialize(root);
                using var contentHttp = new StringContent(json, Encoding.UTF8, "application/json");

                // Endpoint: 指定されたモデルを使用
                var endpoint = $"https://generativelanguage.googleapis.com/v1beta/models/{modelName}:generateContent";

                // Attach API key header
                // We'll implement retry/backoff for 429 statuses
                const int maxAttempts = 3;
                for (int attempt = 1; attempt <= maxAttempts; attempt++)
                {
                    // Clone content for each attempt
                    using var reqContent = new StringContent(json, Encoding.UTF8, "application/json");
                    httpClient.DefaultRequestHeaders.Remove("x-goog-api-key");
                    httpClient.DefaultRequestHeaders.Add("x-goog-api-key", apiKey);

                    var resp = httpClient.PostAsync(endpoint, reqContent).GetAwaiter().GetResult();
                    var respBody = resp.Content.ReadAsStringAsync().GetAwaiter().GetResult();

                    if (resp.IsSuccessStatusCode)
                    {
                        try
                        {
                            // レスポンス全体をログ出力
                            Debug.WriteLine($"[GoogleAiStudioService] Gemini API レスポンス: {respBody}");
                            
                            using var doc = JsonDocument.Parse(respBody);
                            var rootElement = doc.RootElement;
                            
                            // candidatesの存在確認
                            if (!rootElement.TryGetProperty("candidates", out var candidates))
                            {
                                Debug.WriteLine("[GoogleAiStudioService] レスポンスに candidates が含まれていません");
                                return CreateOverlayImage(prompt, image);
                            }
                            
                            var candidatesArray = candidates.EnumerateArray().ToArray();
                            if (candidatesArray.Length == 0)
                            {
                                Debug.WriteLine("[GoogleAiStudioService] candidates が空です");
                                return CreateOverlayImage(prompt, image);
                            }
                            
                            var firstCandidate = candidatesArray[0];
                            
                            // contentの存在確認
                            if (!firstCandidate.TryGetProperty("content", out var content))
                            {
                                Debug.WriteLine("[GoogleAiStudioService] candidate に content が含まれていません");
                                return CreateOverlayImage(prompt, image);
                            }
                            
                            // partsの存在確認
                            if (!content.TryGetProperty("parts", out var partsArray))
                            {
                                Debug.WriteLine("[GoogleAiStudioService] content に parts が含まれていません");
                                return CreateOverlayImage(prompt, image);
                            }
                            
                            // inlineDataを持つpartを検索
                            var inlineData = partsArray.EnumerateArray()
                                .FirstOrDefault(part => part.TryGetProperty("inlineData", out _));
                            
                            if (inlineData.ValueKind == JsonValueKind.Undefined)
                            {
                                Debug.WriteLine("[GoogleAiStudioService] inlineData を持つ part が見つかりません");
                                return CreateOverlayImage(prompt, image);
                            }
                            
                            if (!inlineData.TryGetProperty("inlineData", out var inlineDataObj))
                            {
                                Debug.WriteLine("[GoogleAiStudioService] inlineData の取得に失敗しました");
                                return CreateOverlayImage(prompt, image);
                            }
                            
                            if (!inlineDataObj.TryGetProperty("data", out var dataProperty))
                            {
                                Debug.WriteLine("[GoogleAiStudioService] inlineData に data が含まれていません");
                                return CreateOverlayImage(prompt, image);
                            }
                            
                            var base64ImagenResultado = dataProperty.GetString();

                            if (!string.IsNullOrEmpty(base64ImagenResultado))
                            {
                                Debug.WriteLine($"[GoogleAiStudioService] 画像データを取得しました (長さ: {base64ImagenResultado.Length})");
                                var imageBytes = Convert.FromBase64String(base64ImagenResultado);
                                using var ms2 = new MemoryStream(imageBytes);
                                var resultImage = System.Drawing.Image.FromStream(ms2);
                                return new Bitmap(resultImage);
                            }

                            Debug.WriteLine("[GoogleAiStudioService] 画像データが空です");
                            return CreateOverlayImage(prompt, image);
                        }
                        catch (Exception ex)
                        {
                            Debug.WriteLine($"[GoogleAiStudioService] Gemini レスポンスパースエラー: {ex.Message}");
                            Debug.WriteLine($"[GoogleAiStudioService] スタックトレース: {ex.StackTrace}");
                            Debug.WriteLine($"[GoogleAiStudioService] レスポンス内容: {respBody}");
                            return CreateOverlayImage(prompt, image);
                        }
                    }
                    else
                    {
                        // Log
                        Debug.WriteLine($"Gemini API request failed: {resp.StatusCode} {respBody}");

                        // Try parse retry info from JSON body
                        double? delaySeconds = null;
                        try
                        {
                            using var doc = JsonDocument.Parse(respBody);
                            var rootElem = doc.RootElement;
                            if (rootElem.ValueKind == JsonValueKind.Object && rootElem.TryGetProperty("error", out var err) && err.ValueKind == JsonValueKind.Object && err.TryGetProperty("details", out var details) && details.ValueKind == JsonValueKind.Array)
                            {
                                foreach (var item in details.EnumerateArray())
                                {
                                    if (item.ValueKind == JsonValueKind.Object && item.TryGetProperty("@type", out var atType) && atType.GetString() == "type.googleapis.com/google.rpc.RetryInfo")
                                    {
                                        if (item.TryGetProperty("retryDelay", out var rd) && rd.ValueKind == JsonValueKind.String)
                                        {
                                            var s = rd.GetString();
                                            if (!string.IsNullOrEmpty(s) && s.EndsWith('s'))
                                            {
                                                if (double.TryParse(s.AsSpan(0, s.Length - 1), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var val))
                                                {
                                                    delaySeconds = val;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        catch { }

                        // Fallback to Retry-After header
                        if (!delaySeconds.HasValue)
                        {
                            try
                            {
                                if (resp.Headers.TryGetValues("Retry-After", out var vals))
                                {
                                    var first = System.Linq.Enumerable.FirstOrDefault(vals);
                                    if (!string.IsNullOrEmpty(first))
                                    {
                                        if (int.TryParse(first, out var sec)) delaySeconds = sec;
                                        else if (DateTimeOffset.TryParse(first, out var dt))
                                        {
                                            var diff = dt - DateTimeOffset.UtcNow;
                                            delaySeconds = diff.TotalSeconds > 0 ? diff.TotalSeconds : 1.0;
                                        }
                                    }
                                }
                            }
                            catch { }
                        }

                        if (delaySeconds.HasValue)
                        {
                            var waited = Math.Max(0.5, Math.Min(120, delaySeconds.Value));
                            Debug.WriteLine($"Gemini API rate-limited. Waiting {waited:F1}s before retry (attempt {attempt}/{maxAttempts}).");
                            Task.Delay(TimeSpan.FromSeconds(waited)).GetAwaiter().GetResult();
                            continue;
                        }
                        else if (attempt < maxAttempts)
                        {
                            var backoff = Math.Min(30.0, Math.Pow(2, attempt));
                            var jitter = new Random().NextDouble() * 0.5;
                            var wait = backoff + jitter;
                            Debug.WriteLine($"Gemini API non-success ({resp.StatusCode}). Retrying in {wait:F1}s (attempt {attempt}/{maxAttempts}).");
                            Task.Delay(TimeSpan.FromSeconds(wait)).GetAwaiter().GetResult();
                            continue;
                        }
                        else
                        {
                            Debug.WriteLine("Gemini API retries exhausted, falling back to local generation.");
                            return CreateOverlayImage(prompt, image);
                        }
                    }
                }

                // default fallback
                return CreateOverlayImage(prompt, image);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error calling Gemini API: {ex.Message}");
                return CreateOverlayImage(prompt, image);
            }
        }

        private static bool TryFindBase64Image(JsonElement element, out byte[]? bytes)
        {
            bytes = null;
            if (element.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in element.EnumerateObject())
                {
                    if (string.Equals(property.Name, "data", StringComparison.OrdinalIgnoreCase) && property.Value.ValueKind == JsonValueKind.String)
                    {
                        var s = property.Value.GetString();
                        if (!string.IsNullOrEmpty(s) && s.Length > 100)
                        {
                            try
                            {
                                bytes = Convert.FromBase64String(s);
                                return true;
                            }
                            catch { }
                        }
                    }

                    if (TryFindBase64Image(property.Value, out bytes)) return true;
                }
            }
            else if (element.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in element.EnumerateArray())
                {
                    if (TryFindBase64Image(item, out bytes)) return true;
                }
            }

            return false;
        }

        private static System.Drawing.Image CreateOverlayImage(string prompt, System.Drawing.Image? image)
        {
            const int defaultSize = 512;
            Bitmap result;

            if (image != null)
            {
                result = new Bitmap(image.Width, image.Height);
                using (var g = Graphics.FromImage(result))
                {
                    g.DrawImage(image, 0, 0, image.Width, image.Height);
                    var rectHeight = Math.Max(40, image.Height / 8);
                    var rect = new Rectangle(0, image.Height - rectHeight, image.Width, rectHeight);
                    using (var brush = new SolidBrush(Color.FromArgb(160, 0, 0, 0))) g.FillRectangle(brush, rect);
                    using (var font = new Font(FontFamily.GenericSansSerif, Math.Max(12, rectHeight / 3), FontStyle.Bold, GraphicsUnit.Pixel))
                    using (var brush = new SolidBrush(Color.White))
                    {
                        var layoutRect = new RectangleF(rect.X + 8, rect.Y + 4, rect.Width - 16, rect.Height - 8);
                        g.DrawString(prompt ?? string.Empty, font, brush, layoutRect);
                    }
                }
            }
            else
            {
                result = new Bitmap(defaultSize, defaultSize);
                using (var g = Graphics.FromImage(result))
                {
                    g.Clear(Color.White);
                    using (var font = new Font(FontFamily.GenericSansSerif, 20, FontStyle.Regular, GraphicsUnit.Pixel))
                    using (var brush = new SolidBrush(Color.Black))
                    {
                        var layoutRect = new RectangleF(10, 10, defaultSize - 20, defaultSize - 20);
                        g.DrawString(prompt ?? string.Empty, font, brush, layoutRect);
                    }
                }
            }

            return result;
        }

        private static string? LoadApiKey()
        {
            try
            {
                var env = System.Environment.GetEnvironmentVariable("DESKTOPAIMASCOT_GOOGLE_API_KEY");
                if (!string.IsNullOrWhiteSpace(env)) return env.Trim();

                var appData = System.Environment.GetFolderPath(System.Environment.SpecialFolder.ApplicationData);
                if (!string.IsNullOrEmpty(appData))
                {
                    var path = System.IO.Path.Combine(appData, "DesktopAiMascot", "apikey.txt");
                    if (System.IO.File.Exists(path))
                    {
                        var txt = System.IO.File.ReadAllText(path).Trim();
                        if (!string.IsNullOrWhiteSpace(txt)) return txt;
                    }
                }

                var baseDir = AppDomain.CurrentDomain.BaseDirectory;
                var alt = System.IO.Path.Combine(baseDir, ".apikey");
                if (System.IO.File.Exists(alt))
                {
                    var txt = System.IO.File.ReadAllText(alt).Trim();
                    if (!string.IsNullOrWhiteSpace(txt)) return txt;
                }
            }
            catch
            {
                // ignore
            }

            return null;
        }
    }
}
