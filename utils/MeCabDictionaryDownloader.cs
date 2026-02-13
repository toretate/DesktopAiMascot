using System;
using System.Diagnostics;
using System.Formats.Tar;
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
        // 標準IPAdic辞書（軽量・確実に動作）
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
            var ipadicPath = Path.Combine(_dicDirectory, "ipadic");
            
            // NEologdまたは標準辞書が存在すればOK
            return (Directory.Exists(neologdPath) && File.Exists(Path.Combine(neologdPath, "sys.dic"))) ||
                   (Directory.Exists(ipadicPath) && File.Exists(Path.Combine(ipadicPath, "sys.dic")));
        }

        /// <summary>
        /// 標準IPAdic辞書をダウンロードして配置
        /// </summary>
        public async Task<bool> DownloadAndInstallIpadicAsync(CancellationToken cancellationToken = default)
        {
            try
            {
                OnStatusChanged("IPAdic辞書のダウンロードを開始します...");
                
                // 一時ディレクトリを作成
                var tempDir = Path.Combine(Path.GetTempPath(), $"mecab_download_{Guid.NewGuid():N}");
                Directory.CreateDirectory(tempDir);

                try
                {
                    // tar.gzファイルをダウンロード
                    OnStatusChanged("辞書ファイルをダウンロード中...");
                    var downloadPath = Path.Combine(tempDir, "ipadic.tar.gz");
                    
                    await DownloadFileAsync(IPADIC_DOWNLOAD_URL, downloadPath, cancellationToken);
                    
                    OnStatusChanged("辞書ファイルを展開中...");
                    var extractPath = Path.Combine(tempDir, "extracted");
                    await ExtractTarGzAsync(downloadPath, extractPath, cancellationToken);
                    
                    OnStatusChanged("辞書ファイルをインストール中...");
                    await InstallDictionaryAsync(extractPath, "ipadic", cancellationToken);
                    
                    OnStatusChanged("辞書のインストールが完了しました");
                    OnProgressChanged(100, "完了");
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

        /// <summary>
        /// NEologd辞書をダウンロードして配置（後方互換性のため）
        /// </summary>
        public Task<bool> DownloadAndInstallNeologdAsync(CancellationToken cancellationToken = default)
        {
            // 現在は標準辞書をダウンロード
            return DownloadAndInstallIpadicAsync(cancellationToken);
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
            var lastProgressUpdate = DateTime.MinValue;
            
            while ((bytesRead = await contentStream.ReadAsync(buffer, 0, buffer.Length, cancellationToken)) > 0)
            {
                await fileStream.WriteAsync(buffer, 0, bytesRead, cancellationToken);
                totalRead += bytesRead;

                // プログレス更新を100msごとに制限（UI負荷軽減)
                if ((DateTime.Now - lastProgressUpdate).TotalMilliseconds >= 100 && totalBytes > 0)
                {
                    var progress = (int)((totalRead * 100) / totalBytes);
                    var downloadedMB = totalRead / 1024.0 / 1024.0;
                    var totalMB = totalBytes / 1024.0 / 1024.0;
                    OnProgressChanged(progress, $"ダウンロード中... {downloadedMB:F1} MB / {totalMB:F1} MB");
                    lastProgressUpdate = DateTime.Now;
                }
            }
        }

        /// <summary>
        /// tar.gzファイルを展開
        /// </summary>
        private async Task ExtractTarGzAsync(string tarGzPath, string extractPath, CancellationToken cancellationToken)
        {
            await Task.Run(() =>
            {
                OnStatusChanged("GZip圧縮を解除中...");
                
                // 展開先ディレクトリを作成
                Directory.CreateDirectory(extractPath);
                
                // 1. GZip解凍
                var tarPath = Path.Combine(Path.GetTempPath(), $"temp_{Guid.NewGuid():N}.tar");
                using (var gzipStream = new FileStream(tarGzPath, FileMode.Open, FileAccess.Read))
                using (var decompressionStream = new GZipStream(gzipStream, CompressionMode.Decompress))
                using (var tarStream = new FileStream(tarPath, FileMode.Create, FileAccess.Write))
                {
                    decompressionStream.CopyTo(tarStream);
                }
                
                OnStatusChanged("Tarアーカイブを展開中...");
                
                // 2. Tar展開
                try
                {
                    using var tarStream = new FileStream(tarPath, FileMode.Open, FileAccess.Read);
                    TarFile.ExtractToDirectory(tarStream, extractPath, overwriteFiles: true);
                }
                finally
                {
                    // 一時tarファイルを削除
                    if (File.Exists(tarPath))
                    {
                        File.Delete(tarPath);
                    }
                }
                
                OnProgressChanged(90, "展開完了");
            }, cancellationToken);
        }

        private async Task InstallDictionaryAsync(string sourcePath, string dicName, CancellationToken cancellationToken)
        {
            await Task.Run(() =>
            {
                if (!Directory.Exists(_dicDirectory))
                {
                    Directory.CreateDirectory(_dicDirectory);
                }

                // 展開されたディレクトリを探す（mecab-ipadic-2.7.0-20070801のような名前）
                var extractedDirs = Directory.GetDirectories(sourcePath);
                if (extractedDirs.Length == 0)
                {
                    throw new DirectoryNotFoundException("展開されたディレクトリが見つかりません");
                }

                var sourceDir = extractedDirs[0];
                var targetPath = Path.Combine(_dicDirectory, dicName);
                
                OnStatusChanged($"{dicName}辞書をインストール中...");
                
                if (Directory.Exists(targetPath))
                {
                    Directory.Delete(targetPath, true);
                }

                // 辞書ファイルをコピー
                CopyDirectory(sourceDir, targetPath);
                
                OnProgressChanged(95, "インストール完了");
                
                Debug.WriteLine($"[MeCabDictionaryDownloader] 辞書を {targetPath} にインストールしました");
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
                file.CopyTo(targetFilePath, overwrite: true);
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
