using System;
using System.Collections.Generic;
using System.Linq;

namespace DesktopAiMascot.mascots
{
    /// <summary>
    /// マスコット画像セットを表す
    /// </summary>
    public class MascotImageSet
    {
        /**
         * 画像セットの名前。所属する各画像のベース名となる
         * 例： Name が mascot01 の場合、
         *     AngleImages の Key が left, right, front, back, top, bottom の場合、
         *     画像ファイル名は mascot01_left.png, mascot01_right.png, ... となる
         */
        public string Name { get; set; }

        /** この画像セットの代表画像。Nameの物を返す */
        public MascotImageItem? Image { get; set; }

        /** 各角度の画像。Key: left, right, front, back, top, bottom */
        public Dictionary<string, MascotImageItem> AngleImages { get; set; }

        /** 各感情の表情画像（顔のみ）。Key: joy, sadness, anger, admiration, amusement, など28種類 */
        public Dictionary<string, MascotImageItem> EmotionFaceImages { get; set; }

        /** 各感情の全身画像。Key: joy, sadness, anger, admiration, amusement, など28種類 */
        public Dictionary<string, MascotImageItem> EmotionFullbodyImages { get; set; }

        public MascotImageSet(string name)
        {
            Name = name;
            AngleImages = new Dictionary<string, MascotImageItem>();
            EmotionFaceImages = new Dictionary<string, MascotImageItem>();
            EmotionFullbodyImages = new Dictionary<string, MascotImageItem>();
        }

        /// <summary>
        /// チャット表示用の正面画像を返す
        /// </summary>
        public MascotImageItem? GetFrontImage()
        {
            if (AngleImages.TryGetValue("front", out var frontImage))
            {
                return frontImage;
            }

            return Image ?? GetPreferredAngleImage();
        }

        /// <summary>
        /// 感情に対応する顔画像を返す
        /// </summary>
        public MascotImageItem? GetEmotionFaceImage(string? emotion)
        {
            if (emotion is null)
            {
                return null;
            }

            var key = emotion.Trim();
            if (key.Length == 0)
            {
                return null;
            }

            return EmotionFaceImages.TryGetValue(key, out var image) ? image : null;
        }

        /// <summary>
        /// 感情に対応する全身画像を返す
        /// </summary>
        public MascotImageItem? GetEmotionFullbodyImage(string? emotion)
        {
            if (emotion is null)
            {
                return null;
            }

            var key = emotion.Trim();
            if (key.Length == 0)
            {
                return null;
            }

            return EmotionFullbodyImages.TryGetValue(key, out var image) ? image : null;
        }

        /// <summary>
        /// 指定方向の画像を返す
        /// </summary>
        public MascotImageItem? GetAngleImage(string? angle)
        {
            if (angle is null)
            {
                return null;
            }

            var key = angle.Trim();
            if (key.Length == 0)
            {
                return null;
            }

            return AngleImages.TryGetValue(key, out var image) ? image : null;
        }

        /// <summary>
        /// 表示用の代表画像を返す
        /// </summary>
        public MascotImageItem? GetPrimaryImage()
        {
            return GetFrontImage()
                ?? EmotionFaceImages.Values.FirstOrDefault()
                ?? EmotionFullbodyImages.Values.FirstOrDefault();
        }

        /// <summary>
        /// このセットに属する全画像を重複なく返す
        /// </summary>
        public IEnumerable<MascotImageItem> GetAllImages()
        {
            var seenPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            if (Image is MascotImageItem primaryImage)
            {
                if (seenPaths.Add(primaryImage.ImagePath))
                {
                    yield return primaryImage;
                }
            }

            foreach (var item in AngleImages.Values)
            {
                if (seenPaths.Add(item.ImagePath))
                {
                    yield return item;
                }
            }

            foreach (var item in EmotionFaceImages.Values)
            {
                if (seenPaths.Add(item.ImagePath))
                {
                    yield return item;
                }
            }

            foreach (var item in EmotionFullbodyImages.Values)
            {
                if (seenPaths.Add(item.ImagePath))
                {
                    yield return item;
                }
            }
        }

        private MascotImageItem? GetPreferredAngleImage()
        {
            string[] preferredOrder = ["front", "left", "right", "back", "top", "bottom", "above", "below", "behind"];
            foreach (var key in preferredOrder)
            {
                if (AngleImages.TryGetValue(key, out var item))
                {
                    return item;
                }
            }

            return AngleImages.Values.FirstOrDefault();
        }
    }
}
