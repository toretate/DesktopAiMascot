using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice;
using DesktopAiMascot.aiservice.image;
using DesktopAiMascot.utils;

namespace DesktopAiMascot.skills
{
    /// <summary>
    /// 背景削除処理を実行する
    /// </summary>
    internal class RemoveBGImage
    {
        private readonly string _mascotDirectory;

        public RemoveBGImage(string mascotDirectory)
        {
            _mascotDirectory = mascotDirectory;
        }

        /// <summary>
        /// 背景削除処理を非同期で実行
        /// </summary>
        public async Task<string?> ExecuteAsync(string imagePath, ImageAiServiceBase imageService)
        {
            try
            {
                Debug.WriteLine($"[RemoveBGImage] 背景削除処理を開始: {imagePath}");

                // 画像をBase64 Data URI形式で読み込み
                string? imageData = ImageLoadHelper.LoadImageAsBase64DataUri(imagePath);
                if (imageData == null)
                {
                    throw new InvalidOperationException("画像の読み込みに失敗しました.");
                }

                Debug.WriteLine($"[RemoveBGImage] 画像データサイズ: {imageData.Length} 文字");

                // 背景削除処理を実行
                ImageAiManager.Instance.CurrentService = imageService;
                var result = await ImageAiManager.Instance.RemoveBackgroundAsync(imageData);

                if (result != null)
                {
                    // Base64 Data URIからバイト配列に変換
                    byte[]? resultBytes = ImageLoadHelper.ConvertBase64DataUriToBytes(result);
                    if (resultBytes == null)
                    {
                        throw new InvalidOperationException("背景削除結果の変換に失敗しました。");
                    }

                    // バックアップファイル名を生成
                    string backupFileName = FileOperationHelper.GenerateBackupFileName(imagePath);
                    string backupPath = Path.Combine(_mascotDirectory, backupFileName);

                    // ファイルハンドルを解放（念のため短時間待機）
                    await FileOperationHelper.ReleaseFileHandlesAsync(500);

                    // 一時ファイルに書き込む
                    string tempFilePath = Path.Combine(_mascotDirectory, $"temp_{Guid.NewGuid()}.png");
                    File.WriteAllBytes(tempFilePath, resultBytes);
                    await Task.Delay(200);

                    Debug.WriteLine($"[RemoveBGImage] 一時ファイルを作成: {tempFilePath}");

                    // ファイルを置き換え（リトライロジック付き）
                    bool replaceSuccess = await FileOperationHelper.ReplaceFileWithRetryAsync(
                        tempFilePath,
                        imagePath,
                        backupPath);

                    // 一時ファイルのクリーンアップ
                    FileOperationHelper.CleanupTempFile(tempFilePath);

                    if (!replaceSuccess)
                    {
                        throw new IOException("ファイルの置き換えに失敗しました。ファイルが他のプロセスによって使用されているか、アクセス権限がありません。");
                    }

                    return backupFileName;
                }

                return null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[RemoveBGImage] 背景削除エラー: {ex.Message}");
                Debug.WriteLine($"[RemoveBGImage] スタックトレース: {ex.StackTrace}");
                return null;
            }
        }
    }
}
