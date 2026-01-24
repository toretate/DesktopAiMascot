using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace DesktopAiMascot.aiservice.voice
{
    interface AiVoiceService
    {
    }

    public abstract class AiVoiceServiceBase : AiVoiceService
    {
        public abstract string Name { get; }
        public abstract string EndPoint { get; }

        protected const int MAX_TEXT_LENGTH = 100;

        /// <summary>
        /// 括弧で囲まれた動作や感情を表すテキストをフィルタします。
        /// 例: "(笑いながら)こんにちは" → "こんにちは"
        /// </summary>
        /// <param name="text">フィルタ対象のテキスト</param>
        /// <returns>フィルタ後のテキスト</returns>
        protected string FilterEmotionAndActionText(string text)
        {
            if (string.IsNullOrEmpty(text))
                return text;

            // 全角括弧と半角括弧、その他の括弧を削除
            // ()、（）、[]、【】、〔〕、<>、＜＞などに対応
            var patterns = new[]
            {
                @"\([^)]*\)",      // 半角括弧 ()
                @"（[^）]*）",       // 全角括弧 （）
                @"\[[^\]]*\]",     // 半角角括弧 []
                @"【[^】]*】",       // 全角角括弧 【】
                @"〔[^〕]*〕",       // 全角亀甲括弧 〔〕
                @"<[^>]*>",        // 半角山括弧 <>
                @"＜[^＞]*＞"        // 全角山括弧 ＜＞
            };

            string result = text;
            foreach (var pattern in patterns)
            {
                result = Regex.Replace(result, pattern, string.Empty);
            }

            // 同じ行内の複数のスペース・タブを1つに統一（改行は保持）
            result = Regex.Replace(result, @"[ \t]+", " ");
            
            // 行末の空白を削除
            result = Regex.Replace(result, @"[ \t]+(\r?\n)", "$1");
            
            // 3つ以上の連続する改行を2つに制限（過度な空行を防ぐ）
            result = Regex.Replace(result, @"(\r?\n){3,}", "$1$1");
            
            // 前後の空白を削除
            result = result.Trim();

            return result;
        }

        /// <summary>
        /// テキストを指定された最大長で適切に分割します。
        /// 空行、句読点、改行の順で分割を試みます。
        /// </summary>
        protected List<string> SplitText(string text, int maxLength)
        {
            var chunks = new List<string>();
            
            if (string.IsNullOrEmpty(text))
                return chunks;

            // まず空行で分割（段落単位）
            var paragraphs = Regex.Split(text, @"(?:\r?\n){2,}");
            
            foreach (var paragraph in paragraphs)
            {
                if (string.IsNullOrWhiteSpace(paragraph))
                    continue;
                
                var trimmedParagraph = paragraph.Trim();
                
                // 段落が最大長以下の場合はそのまま追加
                if (trimmedParagraph.Length <= maxLength)
                {
                    chunks.Add(trimmedParagraph);
                    continue;
                }
                
                // 段落が最大長を超える場合は、さらに細かく分割
                chunks.AddRange(SplitLongParagraph(trimmedParagraph, maxLength));
            }

            return chunks;
        }

        /// <summary>
        /// 長い段落を句読点や改行で分割します。
        /// </summary>
        private List<string> SplitLongParagraph(string text, int maxLength)
        {
            var chunks = new List<string>();
            int start = 0;
            
            while (start < text.Length)
            {
                int remaining = text.Length - start;
                if (remaining <= maxLength)
                {
                    chunks.Add(text.Substring(start).Trim());
                    break;
                }

                int splitPos = start + maxLength;
                int bestSplit = splitPos;

                // 最大長以内で最適な分割位置を探す
                for (int i = splitPos; i > start + maxLength / 2; i--)
                {
                    char c = text[i];
                    
                    // 改行を最優先
                    if (c == '\n' || c == '\r')
                    {
                        bestSplit = i + 1;
                        break;
                    }
                    
                    // 句読点で分割
                    if (c == '。' || c == '！' || c == '？' || c == '.' || c == '!' || c == '?')
                    {
                        bestSplit = i + 1;
                        break;
                    }
                    
                    // 読点で分割（句点より優先度低）
                    if (c == '、' || c == ',')
                    {
                        bestSplit = i + 1;
                        break;
                    }
                    
                    // 空白で分割（最後の手段）
                    if (c == ' ' || c == '\t')
                    {
                        bestSplit = i + 1;
                    }
                }

                var chunk = text.Substring(start, bestSplit - start).Trim();
                if (!string.IsNullOrWhiteSpace(chunk))
                {
                    chunks.Add(chunk);
                }
                start = bestSplit;
            }

            return chunks;
        }

        /// <summary>
        /// 複数のWAVファイルのデータを結合します。
        /// 簡易実装：WAVヘッダーを考慮せずにデータ部分のみを結合します。
        /// </summary>
        protected byte[] CombineWavFiles(List<byte[]> audioChunks)
        {
            if (audioChunks.Count == 0)
                return Array.Empty<byte>();

            if (audioChunks.Count == 1)
                return audioChunks[0];

            const int WAV_HEADER_SIZE = 44;

            int totalDataSize = 0;
            foreach (var chunk in audioChunks)
            {
                if (chunk.Length > WAV_HEADER_SIZE)
                {
                    totalDataSize += chunk.Length - WAV_HEADER_SIZE;
                }
            }

            var result = new byte[WAV_HEADER_SIZE + totalDataSize];
            Array.Copy(audioChunks[0], 0, result, 0, Math.Min(WAV_HEADER_SIZE, audioChunks[0].Length));

            int offset = WAV_HEADER_SIZE;
            foreach (var chunk in audioChunks)
            {
                if (chunk.Length > WAV_HEADER_SIZE)
                {
                    int dataSize = chunk.Length - WAV_HEADER_SIZE;
                    Array.Copy(chunk, WAV_HEADER_SIZE, result, offset, dataSize);
                    offset += dataSize;
                }
            }

            int fileSize = result.Length - 8;
            result[4] = (byte)(fileSize & 0xFF);
            result[5] = (byte)((fileSize >> 8) & 0xFF);
            result[6] = (byte)((fileSize >> 16) & 0xFF);
            result[7] = (byte)((fileSize >> 24) & 0xFF);

            int dataSizeTotal = totalDataSize;
            result[40] = (byte)(dataSizeTotal & 0xFF);
            result[41] = (byte)((dataSizeTotal >> 8) & 0xFF);
            result[42] = (byte)((dataSizeTotal >> 16) & 0xFF);
            result[43] = (byte)((dataSizeTotal >> 24) & 0xFF);

            return result;
        }
    }
}
