using System;
using System.Collections.Generic;

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
        /** 各ポーズの画像。Key: pose1, pose2, ... */
        public Dictionary<string, MascotImageItem> PoseImages { get; set; }

        /** 各感情の画像。Key: happy, sad, angry, ... */
        public Dictionary<string, MascotImageItem> EmotionImages { get; set; }

        public MascotImageSet(string name)
        {
            Name = name;
            AngleImages = new Dictionary<string, MascotImageItem>();
            PoseImages = new Dictionary<string, MascotImageItem>();
            EmotionImages = new Dictionary<string, MascotImageItem>();
        }
    }
}