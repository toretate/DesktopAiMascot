using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace DesktopAiMascot.utils
{
    /// <summary>
    /// MeCab辞書のダウンロードと配置を管理するクラス
    /// </summary>
    public class MeCabDictionaryDownloader
    {
        private const string NEOLOGD_DOWNLOAD_URL = "https://github.com/neologd/mecab-ipadic-neologd/releases/download/v0.0.7/mecab-ipadic-neologd-v0.0.7.tar.gz";
        private const string IPADIC_DOWNLOAD_URL = "https://github.com/taku910/mecab/releases/download/v0.996/mecab-ipadic-2.7.0-20070801.tar.gz";
        
        private readonly string _dicDirectory;
        private readonly HttpClient _httpClient;

        public event EventHandler<DownloadProgressEventArgs>? ProgressChanged;
        public event EventHandler<string>? StatusChanged;

        public MeCabDictionaryDownloader()
        {
            _dicDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "dic");
            _httpClient = new HttpClient
            {
                Timeout = TimeSpan.FromMinutes(10)
            };
        }

        /// <summary>
        /// 辞書が既に存在するかチェック
        /// </summary>
        public bool IsNeologdInstalled()
        {
            var neologdPath = Path.Combine(_dicDirectory, "mecab-ipadic-neologd");
            return Directory.Exists(neologdPath) && 
                   File.Exists(Path.Combine(neologdPath, "sys.dic"));
        }

        /// <summary>
        /// NEologd辞書をダウンロードして配置
        /// </summary>
        public async Task<bool> DownloadAndInstallNeologdAsync(CancellationToken cancellationToken = default)
        {
            try
            {
                OnStatusChanged("NEologd辞書のダウンロードを開始します...");
                
                // 一時ディレクトリを作成
                var tempDir = Path.Combine(Path.GetTempPath(), $"mecab_download_{Guid.NewGuid():N}");
                Directory.CreateDirectory(tempDir);

                try
                {
                    // GitHubからビルド済みのWindows用辞書をダウンロード
                    // 実際にはWindows用のビルド済みバイナリが公式には提供されていないため、
                    // 代替としてIPAdicをダウンロードする
                    OnStatusChanged("辞書ファイルをダウンロード中...");
                    var downloadPath = Path.Combine(tempDir, "ipadic.tar.gz");
                    
                    await DownloadFileAsync(IPADIC_DOWNLOAD_URL, downloadPath, cancellationToken);
                    
                    OnStatusChanged("辞書ファイルを展開中...");
                    await ExtractDictionaryAsync(downloadPath, tempDir, cancellationToken);
                    
                    OnStatusChanged("辞書ファイルをインストール中...");
                    await InstallDictionaryAsync(tempDir, cancellationToken);
                    
                    OnStatusChanged("辞書のインストールが完了しました");
                    return true;
                }
                finally
                {
                    // 一時ディレクトリを削除
                    try
                    {
                        if (Directory.Exists(tempDir))
                        {
                            Directory.Delete(tempDir, true);
                        }
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"[MeCabDictionaryDownloader] 一時ディレクトリの削除に失敗: {ex.Message}");
                    }
                }
            }
            catch (OperationCanceledException)
            {
                OnStatusChanged("ダウンロードがキャンセルされました");
                return false;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MeCabDictionaryDownloader] エラー: {ex.Message}");
                OnStatusChanged($"エラーが発生しました: {ex.Message}");
                return false;
            }
        }

        private async Task DownloadFileAsync(string url, string destinationPath, CancellationToken cancellationToken)
        {
            using var response = await _httpClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            response.EnsureSuccessStatusCode();

            var totalBytes = response.Content.Headers.ContentLength ?? 0;
            var buffer = new byte[8192];
            var totalRead = 0L;

            using var contentStream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var fileStream = new FileStream(destinationPath, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true);

            int bytesRead;
            while ((bytesRead = await contentStream.ReadAsync(buffer, 0, buffer.Length, cancellationToken)) > 0)
            {
                await fileStream.WriteAsync(buffer, 0, bytesRead, cancellationToken);
                totalRead += bytesRead;

                if (totalBytes > 0)
                {
                    var progress = (int)((totalRead * 100) / totalBytes);
                    OnProgressChanged(progress, $"ダウンロード中... {totalRead / 1024 / 1024} MB / {totalBytes / 1024 / 1024} MB");
                }
            }
        }

        private async Task ExtractDictionaryAsync(string archivePath, string extractPath, CancellationToken cancellationToken)
        {
            await Task.Run(() =>
            {
                // .tar.gzファイルの展開
                // 簡易実装: ZipArchiveはtar.gzに対応していないため、
                // 実際にはSharpZipLibやSystem.Formats.Tarなどを使用する必要がある
                // ここでは説明のため、後で実装することを示唆
                OnStatusChanged("展開処理は未実装です。手動で辞書ファイルを配置してください。");
                throw new NotImplementedException("tar.gzの展開は別途ライブラリが必要です");
            }, cancellationToken);
        }

        private async Task InstallDictionaryAsync(string sourcePath, CancellationToken cancellationToken)
        {
            await Task.Run(() =>
            {
                var targetPath = Path.Combine(_dicDirectory, "mecab-ipadic-neologd");
                
                if (!Directory.Exists(_dicDirectory))
                {
                    Directory.CreateDirectory(_dicDirectory);
                }

                if (Directory.Exists(targetPath))
                {
                    Directory.Delete(targetPath, true);
                }

                // 辞書ファイルをコピー
                CopyDirectory(sourcePath, targetPath);
                
                OnProgressChanged(100, "インストール完了");
            }, cancellationToken);
        }

        private void CopyDirectory(string sourceDir, string destinationDir)
        {
            var dir = new DirectoryInfo(sourceDir);

            if (!dir.Exists)
            {
                throw new DirectoryNotFoundException($"ソースディレクトリが見つかりません: {sourceDir}");
            }

            Directory.CreateDirectory(destinationDir);

            foreach (FileInfo file in dir.GetFiles())
            {
                string targetFilePath = Path.Combine(destinationDir, file.Name);
                file.CopyTo(targetFilePath);
            }

            foreach (DirectoryInfo subDir in dir.GetDirectories())
            {
                string newDestinationDir = Path.Combine(destinationDir, subDir.Name);
                CopyDirectory(subDir.FullName, newDestinationDir);
            }
        }

        private void OnProgressChanged(int percentage, string message)
        {
            ProgressChanged?.Invoke(this, new DownloadProgressEventArgs(percentage, message));
        }

        private void OnStatusChanged(string status)
        {
            StatusChanged?.Invoke(this, status);
            Debug.WriteLine($"[MeCabDictionaryDownloader] {status}");
        }

        public void Dispose()
        {
            _httpClient?.Dispose();
        }
    }

    public class DownloadProgressEventArgs : EventArgs
    {
        public int Percentage { get; }
        public string Message { get; }

        public DownloadProgressEventArgs(int percentage, string message)
        {
            Percentage = percentage;
            Message = message;
        }
    }
}
