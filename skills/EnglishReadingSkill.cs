using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Speech.Recognition;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Windows.Media.SpeechSynthesis;

namespace DesktopAiMascot.skills
{
    /// <summary>
    /// Windows.Media.SpeechSynthesis を使って英単語の読みを生成するスキル
    /// </summary>
    public class EnglishReadingSkill
    {
        private static readonly Regex EnglishWordRegex = new Regex("[A-Za-z]+", RegexOptions.Compiled);
        private static readonly SemaphoreSlim ConvertLock = new SemaphoreSlim(1, 1);

        /// <summary>
        /// 英単語を含むテキストを読みへ変換する
        /// </summary>
        public async Task<string> ConvertToReadingAsync(string text)
        {
            if (string.IsNullOrEmpty(text))
            {
                return text;
            }

            if (!EnglishWordRegex.IsMatch(text))
            {
                return text;
            }

            var builder = new StringBuilder();
            int lastIndex = 0;
            foreach (Match match in EnglishWordRegex.Matches(text))
            {
                builder.Append(text, lastIndex, match.Index - lastIndex);
                var reading = await ConvertWordAsync(match.Value);
                builder.Append(reading);
                lastIndex = match.Index + match.Length;
            }

            builder.Append(text, lastIndex, text.Length - lastIndex);
            return builder.ToString();
        }

        private async Task<string> ConvertWordAsync(string word)
        {
            await ConvertLock.WaitAsync();
            try
            {
                using var synthesizer = CreateSynthesizer();
                var synthesisStream = await synthesizer.SynthesizeTextToStreamAsync(word);

                using var audioStream = synthesisStream.AsStreamForRead();
                using var memoryStream = new MemoryStream();
                await audioStream.CopyToAsync(memoryStream);
                memoryStream.Position = 0;

                using var recognizer = CreateRecognizer();
                if (recognizer == null)
                {
                    return word;
                }

                recognizer.SetInputToWaveStream(memoryStream);
                var result = recognizer.Recognize();
                var recognized = result?.Text;

                return string.IsNullOrWhiteSpace(recognized) ? word : recognized;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[EnglishReadingSkill] 読み変換エラー: {ex.Message}");
                return word;
            }
            finally
            {
                ConvertLock.Release();
            }
        }

        private static SpeechSynthesizer CreateSynthesizer()
        {
            var synthesizer = new SpeechSynthesizer();
            var jaVoice = SpeechSynthesizer.AllVoices
                .FirstOrDefault(voice => voice.Language.StartsWith("ja", StringComparison.OrdinalIgnoreCase));
            if (jaVoice != null)
            {
                synthesizer.Voice = jaVoice;
            }

            return synthesizer;
        }

        private static SpeechRecognitionEngine? CreateRecognizer()
        {
            try
            {
                var recognizerInfo = SpeechRecognitionEngine.InstalledRecognizers()
                    .FirstOrDefault(info => info.Culture.Name.StartsWith("ja", StringComparison.OrdinalIgnoreCase));

                if (recognizerInfo == null)
                {
                    Debug.WriteLine("[EnglishReadingSkill] 日本語の音声認識エンジンが見つかりません");
                    return null;
                }

                var recognizer = new SpeechRecognitionEngine(recognizerInfo);
                recognizer.LoadGrammar(new DictationGrammar());
                return recognizer;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[EnglishReadingSkill] 音声認識エンジン初期化エラー: {ex.Message}");
                return null;
            }
        }
    }
}
