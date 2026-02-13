using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace DesktopAiMascot.skills
{
    /// <summary>
    /// 英単語→カタカナ読み の辞書を使用した読み仮名変換スキル
    /// MeCabのセットアップが不要で、シンプルな辞書ファイルを使用
    /// </summary>
    public class BilingualKanaDictionarySkill
    {
        private Dictionary<string, string> _dictionary = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private static readonly Regex EnglishWordRegex = new Regex(@"\b[A-Za-z]+\b", RegexOptions.Compiled);
        private readonly string _dictionaryPath;
        private bool _isLoaded = false;

        public BilingualKanaDictionarySkill(string? dictionaryPath = null)
        {
            if (string.IsNullOrEmpty(dictionaryPath))
            {
                // デフォルト辞書パス
                _dictionaryPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "dic", "bilingual_kana_dictionary.json");
                
                // フォールバック: mascots/english_readings.json
                if (!File.Exists(_dictionaryPath))
                {
                    _dictionaryPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "mascots", "english_readings.json");
                }
            }
            else
            {
                _dictionaryPath = dictionaryPath;
            }

            LoadDictionary();
        }

        /// <summary>
        /// 辞書を読み込む
        /// </summary>
        private void LoadDictionary()
        {
            try
            {
                if (!File.Exists(_dictionaryPath))
                {
                    Debug.WriteLine($"[BilingualKanaDictionary] 辞書ファイルが見つかりません: {_dictionaryPath}");
                    LoadDefaultDictionary();
                    return;
                }

                var json = File.ReadAllText(_dictionaryPath);
                var dict = JsonSerializer.Deserialize<Dictionary<string, string>>(json);

                if (dict != null)
                {
                    _dictionary = new Dictionary<string, string>(dict, StringComparer.OrdinalIgnoreCase);
                    _isLoaded = true;
                    Debug.WriteLine($"[BilingualKanaDictionary] 辞書を読み込みました: {_dictionary.Count}件");
                }
                else
                {
                    Debug.WriteLine("[BilingualKanaDictionary] 辞書のデシリアライズに失敗");
                    LoadDefaultDictionary();
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[BilingualKanaDictionary] 辞書の読み込みエラー: {ex.Message}");
                LoadDefaultDictionary();
            }
        }

        /// <summary>
        /// デフォルト辞書を読み込む（組み込み）
        /// </summary>
        private void LoadDefaultDictionary()
        {
            _dictionary = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                // 基本的な単語
                { "hello", "ハロー" },
                { "world", "ワールド" },
                { "app", "アプリ" },
                { "apps", "アプリ" },
                { "game", "ゲーム" },
                { "games", "ゲーム" },
                { "user", "ユーザー" },
                { "users", "ユーザー" },
                { "service", "サービス" },
                { "services", "サービス" },
                { "system", "システム" },
                { "file", "ファイル" },
                { "files", "ファイル" },
                { "data", "データ" },
                { "desktop", "デスクトップ" },
                { "web", "ウェブ" },
                { "site", "サイト" },
                { "login", "ログイン" },
                { "logout", "ログアウト" },
                { "api", "エーピーアイ" },
                { "tts", "ティーティーエス" },
                { "voice", "ボイス" },
                { "store", "ストア" },
                { "download", "ダウンロード" },
                { "upload", "アップロード" },
                { "error", "エラー" },
                { "ok", "オーケー" },
                { "cancel", "キャンセル" },
                { "yes", "イエス" },
                { "no", "ノー" },
                { "start", "スタート" },
                { "stop", "ストップ" },
                { "menu", "メニュー" },
                { "help", "ヘルプ" },
                { "settings", "セッティング" },
                { "option", "オプション" },
                { "options", "オプション" },
            };
            _isLoaded = true;
            Debug.WriteLine($"[BilingualKanaDictionary] デフォルト辞書を読み込みました: {_dictionary.Count}件");
        }

        /// <summary>
        /// テキスト内の英単語を読み仮名に変換
        /// </summary>
        public Task<string> ConvertToReadingAsync(string text)
        {
            if (string.IsNullOrEmpty(text))
            {
                return Task.FromResult(text);
            }

            if (!_isLoaded || _dictionary.Count == 0)
            {
                Debug.WriteLine("[BilingualKanaDictionary] 辞書が読み込まれていません");
                return Task.FromResult(text);
            }

            try
            {
                var result = EnglishWordRegex.Replace(text, match =>
                {
                    var word = match.Value;
                    
                    // 辞書から検索（大文字小文字を区別しない）
                    if (_dictionary.TryGetValue(word, out var reading))
                    {
                        return reading;
                    }

                    // 辞書に見つからない場合は元の単語を返す
                    return word;
                });

                return Task.FromResult(result);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[BilingualKanaDictionary] 変換エラー: {ex.Message}");
                return Task.FromResult(text);
            }
        }

        /// <summary>
        /// 単語の読みを取得
        /// </summary>
        public string GetWordReading(string word)
        {
            if (string.IsNullOrEmpty(word) || !_isLoaded)
            {
                return word;
            }

            if (_dictionary.TryGetValue(word, out var reading))
            {
                return reading;
            }

            return word;
        }

        /// <summary>
        /// 辞書に単語を追加
        /// </summary>
        public void AddWord(string word, string reading)
        {
            _dictionary[word] = reading;
        }

        /// <summary>
        /// 辞書を保存
        /// </summary>
        public void SaveDictionary()
        {
            try
            {
                var directory = Path.GetDirectoryName(_dictionaryPath);
                if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                var json = JsonSerializer.Serialize(_dictionary, new JsonSerializerOptions
                {
                    WriteIndented = true,
                    Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
                });

                File.WriteAllText(_dictionaryPath, json);
                Debug.WriteLine($"[BilingualKanaDictionary] 辞書を保存しました: {_dictionaryPath}");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[BilingualKanaDictionary] 辞書の保存エラー: {ex.Message}");
            }
        }

        public int DictionaryCount => _dictionary.Count;
        public bool IsLoaded => _isLoaded;
    }
}
