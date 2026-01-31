using System;

namespace DesktopAiMascot.aiservice.chat
{
    public class ModelDisplayItem
    {
        public string Id { get; set; }        // SDKに渡すID (例: gemini-2.5-flash)
        public string DisplayName { get; set; } // ユーザーに見せる名前 (例: Gemini 2.5 Flash [推奨])

        public ModelDisplayItem(string id, bool supportsThinking = false)
        {
            Id = id;
            DisplayName = CreateFriendlyName(id, supportsThinking);
        }

        private string CreateFriendlyName(string id, bool supportsThinking)
        {
            // 0. 特定のモデル名を特別な名前に変換
            string name = id.Replace("models/", "");
            
            // Nano Banana シリーズ
            if (name == "gemini-2.5-flash-image" || name == "gemini-2.5-flash-image-exp")
            {
                string baseName = "Gemini 2.5-Flash-Image (Nano Banana) [画像生成]";
                if (name.Contains("-exp"))
                {
                    baseName += " [実験版]";
                }
                if (supportsThinking)
                {
                    baseName += " [思考]";
                }
                return baseName;
            }
            
            if (name == "nano-banana-pro-preview" || name == "nano-banana-pro")
            {
                string baseName = "Nano Banana Pro [画像生成]";
                if (name.Contains("preview"))
                {
                    baseName += " Preview";
                }
                if (supportsThinking)
                {
                    baseName += " [思考]";
                }
                return baseName;
            }
            
            // Gemma シリーズ
            if (name.StartsWith("gemma-3n-"))
            {
                // gemma-3n-e4b-it → Gemma 3n (E4B)
                string size = name.Replace("gemma-3n-", "").Replace("-it", " (Chat)").ToUpper();
                string baseName = $"Gemma 3n ({size})";
                if (supportsThinking)
                {
                    baseName += " [思考]";
                }
                return baseName;
            }
            
            if (name.StartsWith("gemma-3-"))
            {
                // gemma-3-1b-it → Gemma 3 (1B)

                string size = name.Replace("gemma-3-", "").Replace("-it", "").ToUpper();
                string baseName = $"Gemma 3 ({size})";
                if (supportsThinking)
                {
                    baseName += " [思考]";
                }
                return baseName;
            }

            // 1. プレフィックスの削除（既に削除済み）

            // 会話用モデルのサフィックス "-it" を削除
            if (name.Contains("-it"))
            {
                name = name.Replace("-lt", "");
            }

            // 2. バージョン情報を日本語化
            if (name.Contains("-latest"))
            {
                name = name.Replace("-latest", " [最新版]");
            }
            else if (name.Contains("-001"))
            {
                name = name.Replace("-001", " [v1]");
            }
            else if (name.Contains("-002"))
            {
                name = name.Replace("-002", " [v2]");
            }

            // 3. モデルタイプを日本語化
            if (name.Contains("flash"))
            {
                name = name.Replace("flash", "Flash");
            }
            if (name.Contains("pro"))
            {
                name = name.Replace("pro", "Pro");
            }

            // 4. 実験版の表記
            if (name.Contains("-exp"))
            {
                name = name.Replace("-exp", " [実験版]");
            }
            else if (name.Contains("-preview"))
            {
                name = name.Replace("-preview", " Preview");
            }

            // 5. 特殊用途のモデルを強調
            if (name.Contains("tts") || name.Contains("text-to-speech"))
            {
                name = name.Replace("-tts", " [音声]");
            }
            else if (name.Contains("image-generation") || name.Contains("imagen"))
            {
                name = name.Replace("-image-generation", " [画像]");
            }
            else if (name.Contains("embedding"))
            {
                name = name.Replace("-embedding", " [埋込]");
            }

            // 6. Geminiバージョン番号を見やすく
            name = name.Replace("gemini-", "Gemini ");
            name = name.Replace("1.0", "1.0");
            name = name.Replace("1.5", "1.5");
            name = name.Replace("2.0", "2.0");
            name = name.Replace("2.5", "2.5");
            name = name.Replace("3.0", "3.0");

            // 7. 思考モード対応
            if (supportsThinking)
            {
                name += " [思考]";
            }

            return name.Trim();
        }

        public override string ToString()
        {
            return DisplayName;
        }
    }
}
