using System;
using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using DesktopAiMascot.skills;

namespace DesktopAiMascot.aiservice.voice
{
    /// <summary>
    /// 英単語を読み仮名（カタカナ）に変換するクラス
    /// </summary>
    public class EnglishReadingConverter
    {
        private readonly BilingualKanaDictionarySkill _dictionarySkill;
        private static readonly Regex AlphabetPattern = new Regex("[A-Za-z]+", RegexOptions.Compiled);
        
        public EnglishReadingConverter()
        {
            _dictionarySkill = new BilingualKanaDictionarySkill();
            Debug.WriteLine($"[EnglishReadingConverter] 辞書ベース変換を初期化: {_dictionarySkill.DictionaryCount}件");
        }

        /// <summary>
        /// テキスト内の英単語を読み仮名に変換
        /// </summary>
        public async Task<string> ConvertToReadingAsync(string text)
        {
            if (string.IsNullOrEmpty(text))
            {
                return text;
            }

            try
            {
                // 辞書ベースで変換
                var result = await _dictionarySkill.ConvertToReadingAsync(text);
                
                // 辞書に見つからなかった単語をアルファベット読みに変換
                result = ConvertRemainingAlphabets(result);
                
                return result;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[EnglishReadingConverter] エラー: {ex.Message}");
                return text;
            }
        }

        /// <summary>
        /// 残っているアルファベットを1文字ずつ読みに変換
        /// </summary>
        private string ConvertRemainingAlphabets(string text)
        {
            return AlphabetPattern.Replace(text, match =>
            {
                var word = match.Value;
                var builder = new StringBuilder();

                foreach (var letter in word)
                {
                    var upperLetter = char.ToUpperInvariant(letter);
                    var reading = GetAlphabetReading(upperLetter);
                    builder.Append(reading);
                }

                return builder.ToString();
            });
        }

        /// <summary>
        /// アルファベット1文字の読みを取得
        /// </summary>
        private static string GetAlphabetReading(char letter)
        {
            return letter switch
            {
                'A' => "エー",
                'B' => "ビー",
                'C' => "シー",
                'D' => "ディー",
                'E' => "イー",
                'F' => "エフ",
                'G' => "ジー",
                'H' => "エイチ",
                'I' => "アイ",
                'J' => "ジェイ",
                'K' => "ケー",
                'L' => "エル",
                'M' => "エム",
                'N' => "エヌ",
                'O' => "オー",
                'P' => "ピー",
                'Q' => "キュー",
                'R' => "アール",
                'S' => "エス",
                'T' => "ティー",
                'U' => "ユー",
                'V' => "ヴィー",
                'W' => "ダブリュー",
                'X' => "エックス",
                'Y' => "ワイ",
                'Z' => "ゼット",
                _ => letter.ToString()
            };
        }

        /// <summary>
        /// 辞書に単語を追加
        /// </summary>
        public void AddWord(string word, string reading)
        {
            _dictionarySkill.AddWord(word, reading);
        }

        /// <summary>
        /// 辞書を保存
        /// </summary>
        public void SaveDictionary()
        {
            _dictionarySkill.SaveDictionary();
        }

        public int DictionaryCount => _dictionarySkill.DictionaryCount;
    }
}
