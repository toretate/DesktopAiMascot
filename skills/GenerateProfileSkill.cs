using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice.chat;

namespace DesktopAiMascot.skills
{
    /// <summary>
    /// キャラクターのプロフィールをLLMで生成するスキル
    /// </summary>
    public class GenerateProfileSkill
    {
        private readonly ChatAiService _chatService;

        /// <summary>
        /// コンストラクタ
        /// </summary>
        /// <param name="chatService">使用するChatAiServiceインスタンス</param>
        public GenerateProfileSkill(ChatAiService chatService)
        {
            _chatService = chatService ?? throw new ArgumentNullException(nameof(chatService));
        }

        /// <summary>
        /// ランダムにキャラクタープロフィールを生成する
        /// </summary>
        /// <param name="characterName">キャラクター名（オプション）</param>
        /// <param name="genre">ジャンル（例: ファンタジー、SF、現代など）</param>
        /// <returns>生成されたプロフィールテキスト</returns>
        public async Task<string?> GenerateRandomProfileAsync(string? characterName = null, string? genre = null)
        {
            try
            {
                Debug.WriteLine($"[GenerateProfileSkill] ランダムプロフィール生成開始: name={characterName}, genre={genre}");

                // システムプロンプト: AIの役割を定義
                var systemPrompt = @"あなたは創造的なキャラクタープロフィール作成の専門家です。
魅力的で詳細なキャラクタープロフィールを生成してください。

プロフィールには以下の要素を含めてください：
- 名前
- 年齢
- 性別
- 外見の特徴（髪型、目の色、身長、服装など）
- 性格
- 好きなもの/嫌いなもの
- 特技や趣味
- 背景ストーリー
- 口癖や話し方の特徴

日本語で、読みやすく構造化されたフォーマットで出力してください。";

                // ユーザープロンプト: 具体的な生成指示
                var userPromptBuilder = new StringBuilder();
                userPromptBuilder.AppendLine("新しいキャラクターのプロフィールを生成してください。");
                
                if (!string.IsNullOrWhiteSpace(characterName))
                {
                    userPromptBuilder.AppendLine($"キャラクター名: {characterName}");
                }
                else
                {
                    userPromptBuilder.AppendLine("キャラクター名は自由に決めてください。");
                }

                if (!string.IsNullOrWhiteSpace(genre))
                {
                    userPromptBuilder.AppendLine($"ジャンル: {genre}");
                }
                else
                {
                    userPromptBuilder.AppendLine("ジャンルは自由に決めてください。");
                }

                userPromptBuilder.AppendLine("\n個性的で魅力的なキャラクターを作成してください。");

                var response = await _chatService.SendOneShotMessageAsync(systemPrompt, userPromptBuilder.ToString());

                if (response != null)
                {
                    Debug.WriteLine($"[GenerateProfileSkill] プロフィール生成成功: {response.Length}文字");
                }
                else
                {
                    Debug.WriteLine("[GenerateProfileSkill] プロフィール生成失敗: レスポンスがnull");
                }

                return response;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[GenerateProfileSkill] プロフィール生成エラー: {ex.Message}");
                Debug.WriteLine($"[GenerateProfileSkill] スタックトレース: {ex.StackTrace}");
                return null;
            }
        }

        /// <summary>
        /// 画像ファイルからキャラクタープロフィールを生成する
        /// </summary>
        /// <param name="imageFilePath">画像ファイルのパス</param>
        /// <param name="additionalInstructions">追加の指示（オプション）</param>
        /// <returns>生成されたプロフィールテキスト</returns>
        public async Task<string?> GenerateProfileFromImageAsync(string imageFilePath, string? additionalInstructions = null)
        {
            try
            {
                if (!File.Exists(imageFilePath))
                {
                    Debug.WriteLine($"[GenerateProfileSkill] 画像ファイルが見つかりません: {imageFilePath}");
                    return null;
                }

                Debug.WriteLine($"[GenerateProfileSkill] 画像からプロフィール生成開始: {imageFilePath}");

                // 画像をBase64エンコード
                byte[] imageBytes = await File.ReadAllBytesAsync(imageFilePath);
                string base64Image = Convert.ToBase64String(imageBytes);
                
                // 画像の拡張子を取得してMIMEタイプを決定
                string extension = Path.GetExtension(imageFilePath).ToLower();
                string mimeType = extension switch
                {
                    ".png" => "image/png",
                    ".jpg" or ".jpeg" => "image/jpeg",
                    ".gif" => "image/gif",
                    ".webp" => "image/webp",
                    _ => "image/png"
                };

                // Data URI形式に変換
                string imageDataUri = $"data:{mimeType};base64,{base64Image}";

                // プロンプト
                var promptBuilder = new StringBuilder();
                promptBuilder.AppendLine("この画像に描かれているキャラクターの詳細なプロフィールを生成してください。");
                promptBuilder.AppendLine();
                promptBuilder.AppendLine("プロフィールには以下の要素を含めてください：");
                promptBuilder.AppendLine("- 名前（画像の印象から想像してください）");
                promptBuilder.AppendLine("- 年齢");
                promptBuilder.AppendLine("- 性別");
                promptBuilder.AppendLine("- 外見の特徴（髪型、目の色、身長、服装など）");
                promptBuilder.AppendLine("- 性格（外見から想像される性格）");
                promptBuilder.AppendLine("- 好きなもの/嫌いなもの");
                promptBuilder.AppendLine("- 特技や趣味");
                promptBuilder.AppendLine("- 背景ストーリー");
                promptBuilder.AppendLine("- 口癖や話し方の特徴");

                if (!string.IsNullOrWhiteSpace(additionalInstructions))
                {
                    promptBuilder.AppendLine();
                    promptBuilder.AppendLine("追加の指示:");
                    promptBuilder.AppendLine(additionalInstructions);
                }

                promptBuilder.AppendLine();
                promptBuilder.AppendLine("日本語で、読みやすく構造化されたフォーマットで出力してください。");

                var response = await _chatService.SendMessageWithImagesAsync(
                    new[] { imageDataUri }, 
                    promptBuilder.ToString());

                if (response != null)
                {
                    Debug.WriteLine($"[GenerateProfileSkill] 画像からプロフィール生成成功: {response.Length}文字");
                }
                else
                {
                    Debug.WriteLine("[GenerateProfileSkill] 画像からプロフィール生成失敗: レスポンスがnull");
                }

                return response;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[GenerateProfileSkill] 画像からプロフィール生成エラー: {ex.Message}");
                Debug.WriteLine($"[GenerateProfileSkill] スタックトレース: {ex.StackTrace}");
                return null;
            }
        }

        /// <summary>
        /// テキストファイルからキャラクタープロフィールを生成する（既存情報を拡張）
        /// </summary>
        /// <param name="textFilePath">テキストファイルのパス</param>
        /// <param name="mode">生成モード（expand: 拡張, refine: 洗練, complete: 補完）</param>
        /// <param name="llmModel">使用するLLMモデル名（未指定の場合は既定設定を使用）</param>
        /// <returns>生成されたプロフィールテキスト</returns>
        public async Task<string?> GenerateProfileFromTextAsync(string textFilePath, string mode = "expand", string? llmModel = null)
        {
            try
            {
                if (!File.Exists(textFilePath))
                {
                    Debug.WriteLine($"[GenerateProfileSkill] テキストファイルが見つかりません: {textFilePath}");
                    return null;
                }

                Debug.WriteLine($"[GenerateProfileSkill] テキストからプロフィール生成開始: {textFilePath}, mode={mode}");

                // テキストファイルを読み込み
                string existingText = await File.ReadAllTextAsync(textFilePath, Encoding.UTF8);

                if (string.IsNullOrWhiteSpace(existingText))
                {
                    Debug.WriteLine("[GenerateProfileSkill] テキストファイルが空です");
                    return null;
                }

                // システムプロンプト
                var systemPrompt = @"あなたはキャラクタープロフィール作成の専門家です。
既存のキャラクター情報を基に、詳細で魅力的なプロフィールを生成してください。";

                // ユーザープロンプト
                var userPromptBuilder = new StringBuilder();
                userPromptBuilder.AppendLine("以下は既存のキャラクター情報です：");
                userPromptBuilder.AppendLine();
                userPromptBuilder.AppendLine("```");
                userPromptBuilder.AppendLine(existingText);
                userPromptBuilder.AppendLine("```");
                userPromptBuilder.AppendLine();

                switch (mode.ToLower())
                {
                    case "expand":
                        userPromptBuilder.AppendLine("この情報を基に、さらに詳細なプロフィールを作成してください。");
                        userPromptBuilder.AppendLine("不足している要素（外見、性格、背景ストーリーなど）を追加し、豊かなキャラクター像を構築してください。");
                        break;
                    case "refine":
                        userPromptBuilder.AppendLine("この情報を洗練させ、より魅力的で一貫性のあるプロフィールに改善してください。");
                        userPromptBuilder.AppendLine("矛盾を解消し、表現を豊かにしてください。");
                        break;
                    case "complete":
                        userPromptBuilder.AppendLine("この情報の不足している部分を補完し、完全なプロフィールを作成してください。");
                        userPromptBuilder.AppendLine("既存の情報は維持しつつ、欠けている要素を追加してください。");
                        break;
                    default:
                        userPromptBuilder.AppendLine("この情報を基に、より詳細なプロフィールを作成してください。");
                        break;
                }

                userPromptBuilder.AppendLine();
                userPromptBuilder.AppendLine("日本語で、読みやすく構造化されたフォーマットで出力してください。");

                var userPrompt = userPromptBuilder.ToString();
                Debug.WriteLine($"[GenerateProfileSkill] 送信プロンプト長: {userPrompt.Length} 文字");
                Debug.WriteLine($"[GenerateProfileSkill] 送信システムプロンプト長: {systemPrompt.Length} 文字");

                string combinedPrompt = $"{systemPrompt}\n\n{userPrompt}";
                Debug.WriteLine($"[GenerateProfileSkill] 使用モデル: {(string.IsNullOrWhiteSpace(llmModel) ? "(既定)" : llmModel)}");

                var response = await _chatService.SendMessageAsync(combinedPrompt, llmModel);

                if (response != null)
                {
                    Debug.WriteLine($"[GenerateProfileSkill] テキストからプロフィール生成成功: {response.Length}文字");
                    Debug.WriteLine($"[GenerateProfileSkill] 応答内容(先頭200文字): {response.Substring(0, Math.Min(200, response.Length))}");
                }
                else
                {
                    Debug.WriteLine("[GenerateProfileSkill] テキストからプロフィール生成失敗: レスポンスがnull");
                }

                return response;
            }
            catch (HttpRequestException)
            {
                Debug.WriteLine("[GenerateProfileSkill] LLMサービスとの接続エラー");
                return null;
            }
            catch (TaskCanceledException)
            {
                Debug.WriteLine("[GenerateProfileSkill] LLMサービスとの接続エラー (タイムアウト)");
                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[GenerateProfileSkill] テキストからプロフィール生成エラー: {ex.Message}");
                return null;
            }
        }
    }
}
