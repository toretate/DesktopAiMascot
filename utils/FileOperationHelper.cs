using System;
using System.IO;
using System.Threading.Tasks;
using System.Diagnostics;

namespace DesktopAiMascot.utils
{
    /// <summary>
    /// ファイル操作のヘルパークラス
    /// リトライロジックを含むファイル操作を提供
    /// </summary>
    public static class FileOperationHelper
    {
        // 待機時間の定数
        private const int SHORT_DELAY_MS = 200;
        private const int MEDIUM_DELAY_MS = 500;
        private const int LONG_DELAY_MS = 1000;
        private const int EXTRA_LONG_DELAY_MS = 2000;

        // リトライ設定
        private const int DEFAULT_RETRY_COUNT = 10;
        private const int RETRY_DELAY_MS = EXTRA_LONG_DELAY_MS;

        /// <summary>
        /// ガベージコレクションを実行してファイルハンドルを解放
        /// </summary>
        public static async Task ReleaseFileHandlesAsync(int delayMs = MEDIUM_DELAY_MS)
        {
            GC.Collect();
            GC.WaitForPendingFinalizers();
            GC.Collect();
            await Task.Delay(delayMs);
        }

        /// <summary>
        /// リトライロジック付きでファイルを置き換える
        /// </summary>
        /// <param name="tempFilePath">一時ファイルのパス</param>
        /// <param name="targetFilePath">置き換える対象ファイルのパス</param>
        /// <param name="backupFilePath">バックアップファイルのパス</param>
        /// <param name="retryCount">リトライ回数</param>
        /// <returns>成功したかどうか</returns>
        public static async Task<bool> ReplaceFileWithRetryAsync(
            string tempFilePath, 
            string targetFilePath, 
            string backupFilePath, 
            int retryCount = DEFAULT_RETRY_COUNT)
        {
            for (int retry = 0; retry < retryCount; retry++)
            {
                try
                {
                    // 読み取り専用属性をクリア
                    if (File.Exists(targetFilePath))
                    {
                        var attributes = File.GetAttributes(targetFilePath);
                        if ((attributes & FileAttributes.ReadOnly) == FileAttributes.ReadOnly)
                        {
                            File.SetAttributes(targetFilePath, attributes & ~FileAttributes.ReadOnly);
                        }
                    }

                    // ファイルを置き換え
                    File.Replace(tempFilePath, targetFilePath, backupFilePath, ignoreMetadataErrors: true);

                    Debug.WriteLine($"[FileOperationHelper] ファイル置き換え成功: {targetFilePath}");
                    return true;
                }
                catch (IOException ex) when (retry < retryCount - 1)
                {
                    Debug.WriteLine($"[FileOperationHelper] ファイル置き換え失敗、リトライ {retry + 1}/{retryCount}: {ex.Message}");
                    await Task.Delay(RETRY_DELAY_MS);

                    // 追加のGC実行
                    await ReleaseFileHandlesAsync(0);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[FileOperationHelper] ファイル置き換えエラー: {ex.Message}");
                    throw;
                }
            }

            return false;
        }

        /// <summary>
        /// 一時ファイルのクリーンアップ
        /// </summary>
        public static void CleanupTempFile(string tempFilePath)
        {
            try
            {
                if (File.Exists(tempFilePath))
                {
                    File.Delete(tempFilePath);
                    Debug.WriteLine($"[FileOperationHelper] 一時ファイルを削除: {tempFilePath}");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[FileOperationHelper] 一時ファイル削除失敗: {ex.Message}");
            }
        }

        /// <summary>
        /// バックアップファイル名を生成
        /// </summary>
        public static string GenerateBackupFileName(string originalFilePath)
        {
            string directory = Path.GetDirectoryName(originalFilePath) ?? "";
            string fileNameWithoutExt = Path.GetFileNameWithoutExtension(originalFilePath);
            string extension = Path.GetExtension(originalFilePath);

            // 既存のバックアップファイルをカウント
            var existingBackups = Directory.GetFiles(directory, $"{fileNameWithoutExt}.*.back{extension}");
            int backupNumber = existingBackups.Length + 1;

            return $"{fileNameWithoutExt}.{backupNumber}.back{extension}";
        }
    }
}
