using DesktopAiMascot.utils;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace DesktopAiMascot.mascots
{
    /// <summary>
    /// 画像ファイル名から MascotImageSet を構築する
    /// </summary>
    public static class MascotImageSetBuilder
    {
        private static readonly HashSet<string> AngleSuffixes = new(StringComparer.OrdinalIgnoreCase)
        {
            "left", "right", "front", "back", "top", "bottom", "above", "below", "behind"
        };

        private static readonly HashSet<string> FullbodyTokens = new(StringComparer.OrdinalIgnoreCase)
        {
            "fullbody", "body"
        };

        public static MascotImageSet CreateFromPaths(string mascotName, IEnumerable<string>? imagePaths)
        {
            var paths = imagePaths?.ToArray() ?? [];
            var items = ImageLoadHelper.LoadImages(mascotName, paths);
            return CreateFromItems(mascotName, items);
        }

        public static MascotImageSet CreateFromItems(string mascotName, IEnumerable<MascotImageItem>? imageItems)
        {
            var imageSet = new MascotImageSet(mascotName);

            foreach (var item in imageItems ?? Enumerable.Empty<MascotImageItem>())
            {
                if (item == null)
                {
                    continue;
                }

                var fileName = Path.GetFileNameWithoutExtension(item.FileName);
                if (fileName.Equals("cover", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var parsed = ParseFileName(fileName);

                switch (parsed.Kind)
                {
                    case MascotImageKind.Angle:
                        imageSet.AngleImages[parsed.Key] = item;
                        break;

                    case MascotImageKind.EmotionFace:
                        imageSet.EmotionFaceImages[parsed.Key] = item;
                        break;

                    case MascotImageKind.EmotionFullbody:
                        imageSet.EmotionFullbodyImages[parsed.Key] = item;
                        break;

                    default:
                        imageSet.Image = item;
                        break;
                }
            }

            return imageSet;
        }

        private static ParsedMascotImageName ParseFileName(string fileName)
        {
            var tokens = fileName.Split('_', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (tokens.Length == 0)
            {
                return new ParsedMascotImageName(MascotImageKind.Main, string.Empty);
            }

            var lastToken = tokens[^1];
            if (AngleSuffixes.Contains(lastToken) && tokens.Length >= 2)
            {
                return new ParsedMascotImageName(MascotImageKind.Angle, lastToken.ToLowerInvariant());
            }

            if (TryParseEmotion(tokens, out var parsed))
            {
                return parsed;
            }

            return new ParsedMascotImageName(MascotImageKind.Main, string.Empty);
        }

        private static bool TryParseEmotion(string[] tokens, out ParsedMascotImageName parsed)
        {
            parsed = default;
            if (tokens.Length < 3)
            {
                return false;
            }

            var lastToken = tokens[^1].ToLowerInvariant();
            var prevToken = tokens[^2].ToLowerInvariant();

            if (prevToken == "face")
            {
                parsed = new ParsedMascotImageName(MascotImageKind.EmotionFace, lastToken);
                return true;
            }

            if (lastToken == "face")
            {
                parsed = new ParsedMascotImageName(MascotImageKind.EmotionFace, prevToken);
                return true;
            }

            if (FullbodyTokens.Contains(prevToken))
            {
                parsed = new ParsedMascotImageName(MascotImageKind.EmotionFullbody, lastToken);
                return true;
            }

            if (FullbodyTokens.Contains(lastToken))
            {
                parsed = new ParsedMascotImageName(MascotImageKind.EmotionFullbody, prevToken);
                return true;
            }

            return false;
        }

        private readonly record struct ParsedMascotImageName(MascotImageKind Kind, string Key);

        private enum MascotImageKind
        {
            Main,
            Angle,
            EmotionFace,
            EmotionFullbody,
        }
    }
}