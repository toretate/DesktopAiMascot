using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace DesktopAiMascot.aiservice.chat
{
    internal static class EmotionTagPromptHelper
    {
        private const string EmotionTagSectionHeader = "【感情タグ】";
        private const string EmotionTagFormat = "[emotion: <id>]";

        private static readonly IReadOnlyList<string> DefaultEmotionKeys = new[]
        {
            "admiration",
            "amusement",
            "anger",
            "annoyance",
            "approval",
            "caring",
            "confusion",
            "curiosity",
            "desire",
            "disappointment",
            "disapproval",
            "disgust",
            "embarrassment",
            "excitement",
            "fear",
            "gratitude",
            "grief",
            "joy",
            "love",
            "nervousness",
            "neutral",
            "optimism",
            "pride",
            "realization",
            "relief",
            "remorse",
            "sadness",
            "surprise"
        };

        public static string AppendEmotionTagInstruction(string? systemPrompt)
        {
            var basePrompt = systemPrompt ?? string.Empty;
            if (basePrompt.Contains(EmotionTagSectionHeader, StringComparison.Ordinal))
            {
                return basePrompt;
            }

            var emotionKeys = LoadEmotionKeys();
            var emotionList = string.Join(", ", emotionKeys);

            var sb = new StringBuilder();
            if (!string.IsNullOrWhiteSpace(basePrompt))
            {
                sb.AppendLine(basePrompt.TrimEnd());
                sb.AppendLine();
            }

            sb.AppendLine(EmotionTagSectionHeader);
            sb.AppendLine("返答の先頭に感情タグを1つ付けてください。");
            sb.AppendLine($"形式: {EmotionTagFormat}");
            sb.AppendLine($"使用可能な感情ID: {emotionList}");
            sb.AppendLine("本文はタグの後に続けてください。");

            return sb.ToString().TrimEnd();
        }

        private static IReadOnlyList<string> LoadEmotionKeys()
        {
            try
            {
                var baseDir = AppDomain.CurrentDomain.BaseDirectory;
                var path = Path.Combine(baseDir, "mascots", "emotions.json");
                if (!File.Exists(path))
                {
                    Debug.WriteLine($"[EmotionTagPromptHelper] emotions.json が見つかりません: {path}");
                    return DefaultEmotionKeys;
                }

                using var stream = File.OpenRead(path);
                using var doc = JsonDocument.Parse(stream);
                if (doc.RootElement.ValueKind != JsonValueKind.Object)
                {
                    Debug.WriteLine("[EmotionTagPromptHelper] emotions.json の形式が不正です");
                    return DefaultEmotionKeys;
                }

                var keys = doc.RootElement.EnumerateObject()
                    .Select(property => property.Name)
                    .Where(name => !string.IsNullOrWhiteSpace(name))
                    .ToArray();

                if (keys.Length == 0)
                {
                    Debug.WriteLine("[EmotionTagPromptHelper] emotions.json から感情IDを取得できませんでした");
                    return DefaultEmotionKeys;
                }

                return keys;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[EmotionTagPromptHelper] emotions.json の読み込みに失敗しました: {ex.Message}");
                return DefaultEmotionKeys;
            }
        }
    }
}
