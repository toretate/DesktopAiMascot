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
    }
}
