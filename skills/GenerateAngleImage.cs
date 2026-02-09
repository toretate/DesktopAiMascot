using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.aiservice.image;

namespace DesktopAiMascot.skills
{
    /// <summary>
    /// 角度別画像を生成する
    /// </summary>
    internal class GenerateAngleImage
    {
        private readonly GoogleAiStudioService _googleAiService;
        private readonly ComfyQwen3ImageEditService _comfyQwen3ImageEditService;

        public GenerateAngleImage(GoogleAiStudioService googleAiService, ComfyQwen3ImageEditService comfyQwen3ImageEditService)
        {
            _googleAiService = googleAiService;
            _comfyQwen3ImageEditService = comfyQwen3ImageEditService;
        }

        /// <summary>
        /// 角度別画像を生成する
        /// </summary>
        public async Task<string?> ExecuteAsync(string angle, string modelName, string sourceImagePath, string outputDirectory, string baseFileName)
        {
            Debug.WriteLine($"[GenerateAngleImage] 画像生成開始: angle={angle}, model={modelName}");

            string outputFileName = $"{Path.GetFileNameWithoutExtension(baseFileName)}_{angle}.png";
            string outputPath = Path.Combine(outputDirectory, outputFileName);

            if (modelName == "qwen3-image-edit")
            {
                string prompt = GeneratePromptForQwenAngle(angle);
                Debug.WriteLine($"[GenerateAngleImage] Qwen3プロンプト: {prompt}");

                var imageBase64 = ConvertImageFileToBase64(sourceImagePath);
                var resultBase64 = await _comfyQwen3ImageEditService.EditImageWithAngleAsync(imageBase64, prompt);

                if (string.IsNullOrEmpty(resultBase64))
                {
                    return null;
                }

                using var resultImage = ConvertBase64ToImage(resultBase64);
                resultImage.Save(outputPath, ImageFormat.Png);
                return outputPath;
            }

            string defaultPrompt = GeneratePromptForAngle(angle);
            Debug.WriteLine($"[GenerateAngleImage] プロンプト: {defaultPrompt}");

            Image sourceImage;
            using (var stream = new FileStream(sourceImagePath, FileMode.Open, FileAccess.Read))
            {
                sourceImage = Image.FromStream(stream);
            }

            var resultImageDefault = await Task.Run(() =>
            {
                return _googleAiService.sendImageEditRequest(defaultPrompt, sourceImage, modelName);
            });

            if (resultImageDefault == null)
            {
                return null;
            }

            resultImageDefault.Save(outputPath, ImageFormat.Png);
            return outputPath;
        }

        private static string GeneratePromptForQwenAngle(string angle)
        {
            return angle switch
            {
                "left" => "<sks> left side view eye-level shot medium shot",
                "right" => "<sks> right side view eye-level shot medium shot",
                "above" => "<sks> front view high-angle shot medium shot",
                "below" => "<sks> front view low-angle shot medium shot",
                "behind" => "<sks> back view eye-level shot medium shot",
                _ => "<sks> front view eye-level shot medium shot"
            };
        }

        private static string GeneratePromptForAngle(string angle)
        {
            return angle switch
            {
                "left" => "このキャラクターを左側から見た画像を生成してください。キャラクターの特徴（髪型、服装、色など）を維持し、自然な角度で左側面が見えるように描いてください。",
                "right" => "このキャラクターを右側から見た画像を生成してください。キャラクターの特徴（髪型、服装、色など）を維持し、自然な角度で右側面が見えるように描いてください。",
                "above" => "このキャラクターを上から見下ろした画像を生成してください。キャラクターの特徴（髪型、服装、色など）を維持し、頭頂部や肩が見えるように描いてください。",
                "below" => "このキャラクターを下から見上げた画像を生成してください。キャラクターの特徴（髪型、服装、色など）を維持し、顎や下側が見えるように描いてください。",
                "behind" => "このキャラクターを背面から見た画像を生成してください。キャラクターの特徴（髪型、服装、色など）を維持し、後ろ姿が見えるように描いてください。",
                _ => "このキャラクターの別の角度からの画像を生成してください。"
            };
        }

        private static string ConvertImageFileToBase64(string imagePath)
        {
            byte[] imageBytes = File.ReadAllBytes(imagePath);
            return Convert.ToBase64String(imageBytes);
        }

        private static Image ConvertBase64ToImage(string base64String)
        {
            if (base64String.Contains(","))
            {
                base64String = base64String.Split(',')[1];
            }

            byte[] imageBytes = Convert.FromBase64String(base64String);
            using var ms = new MemoryStream(imageBytes);
            using var tempImage = Image.FromStream(ms);
            return new Bitmap(tempImage);
        }
    }
}
