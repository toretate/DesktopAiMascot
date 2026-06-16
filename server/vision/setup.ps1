# vision.cpp (vision-cli.exe) + BiRefNet-ToonOut GGUF モデルのセットアップ (Windows)
#
# Windows x64 はプレビルトを使うためビルド不要。
# GitHub Releases の zip を取得して bin\ に展開し、ToonOut GGUF モデル (約420MB) を取得する。
#
# 実行: PowerShell で
#   cd server\vision
#   .\setup.ps1
#
# 実行ポリシーで弾かれる場合:
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1

$ErrorActionPreference = 'Stop'
# Invoke-WebRequest は進捗バー描画で大容量DLが極端に遅くなるため抑制（数十倍高速化）
$ProgressPreference = 'SilentlyContinue'

$VisionDir   = $PSScriptRoot
$VispVersion = '0.3.0'
$Pkg         = "visioncpp-windows-x64-$VispVersion.zip"
$PkgUrl      = "https://github.com/Acly/vision.cpp/releases/download/v$VispVersion/$Pkg"
$ModelUrl    = 'https://huggingface.co/Acly/BiRefNet-toonout-GGUF/resolve/main/BiRefNet-ToonOut-F16.gguf?download=true'
$ModelPath   = Join-Path $VisionDir 'models\BiRefNet-ToonOut-F16.gguf'

Write-Host "[setup] OS=Windows ARCH=$env:PROCESSOR_ARCHITECTURE"

# ---------------------------------------------------------------------------
# 1. vision-cli.exe の用意（プレビルト zip を bin\ に展開）
# ---------------------------------------------------------------------------
$DlDir  = Join-Path $VisionDir 'dl'
$BinDir = Join-Path $VisionDir 'bin'

if (Test-Path $DlDir) { Remove-Item $DlDir -Recurse -Force }
New-Item -ItemType Directory -Path $DlDir | Out-Null

$ZipPath = Join-Path $DlDir $Pkg
Write-Host "[setup] プレビルト取得: $Pkg"
Invoke-WebRequest -Uri $PkgUrl -OutFile $ZipPath

Expand-Archive -Path $ZipPath -DestinationPath $DlDir -Force

# zip 内 bin\ には vision-cli.exe と各 DLL が同梱されている（同ディレクトリで解決）
if (Test-Path $BinDir) { Remove-Item $BinDir -Recurse -Force }
Copy-Item (Join-Path $DlDir 'bin') $BinDir -Recurse -Force

Remove-Item $DlDir -Recurse -Force
Write-Host "[setup] 展開完了: $BinDir\vision-cli.exe"

# ---------------------------------------------------------------------------
# 2. ToonOut GGUF モデルのダウンロード
# ---------------------------------------------------------------------------
$ModelsDir = Join-Path $VisionDir 'models'
if (-not (Test-Path $ModelsDir)) { New-Item -ItemType Directory -Path $ModelsDir | Out-Null }

if (Test-Path $ModelPath) {
    Write-Host "[setup] モデル取得済み: $ModelPath"
} else {
    Write-Host '[setup] モデルをダウンロード (約420MB)...'
    Invoke-WebRequest -Uri $ModelUrl -OutFile $ModelPath
    Write-Host "[setup] モデル保存: $ModelPath"
}

Write-Host '[setup] 完了。'
