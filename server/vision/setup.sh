#!/usr/bin/env bash
#
# vision.cpp (vision-cli) + BiRefNet-ToonOut GGUF モデルのセットアップ。
#
# - macOS                : プレビルトが無いためソースビルド (CMake + C++20)
# - Linux x64 / Win x64  : GitHub Releases のプレビルトを取得
# - 全 OS 共通           : ToonOut GGUF モデル (約420MB) をダウンロード
#
# 実行: cd server/vision && ./setup.sh
#
set -euo pipefail

VISION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VISP_VERSION="0.3.0"

# DL する GGUF モデル: "ファイル名|URL"
MODELS=(
  "BiRefNet-ToonOut-F16.gguf|https://huggingface.co/Acly/BiRefNet-toonout-GGUF/resolve/main/BiRefNet-ToonOut-F16.gguf?download=true"
  "BiRefNet-F16.gguf|https://huggingface.co/Acly/BiRefNet-GGUF/resolve/main/BiRefNet-F16.gguf?download=true"
  "BiRefNet-lite-F16.gguf|https://huggingface.co/Acly/BiRefNet-GGUF/resolve/main/BiRefNet-lite-F16.gguf?download=true"
)

OS="$(uname -s)"
ARCH="$(uname -m)"

echo "[setup] OS=${OS} ARCH=${ARCH}"

# ---------------------------------------------------------------------------
# 1. vision-cli の用意
# ---------------------------------------------------------------------------
build_from_source() {
  echo "[setup] ソースビルドします (CMake + C++20)"
  command -v cmake >/dev/null 2>&1 || { echo "[setup] cmake が必要です (brew install cmake)"; exit 1; }
  if [ ! -d "${VISION_DIR}/vision.cpp" ]; then
    git clone https://github.com/Acly/vision.cpp.git --recursive "${VISION_DIR}/vision.cpp"
  fi
  cmake . -B build -S "${VISION_DIR}/vision.cpp"
  cmake --build "${VISION_DIR}/vision.cpp/build" --config Release -j
  echo "[setup] ビルド完了: ${VISION_DIR}/vision.cpp/build/bin/vision-cli"
}

download_prebuilt() {
  local pkg="$1"
  echo "[setup] プレビルト取得: ${pkg}"
  command -v curl >/dev/null 2>&1 || { echo "[setup] curl が必要です"; exit 1; }
  rm -rf "${VISION_DIR}/dl"
  mkdir -p "${VISION_DIR}/dl"
  curl -L -o "${VISION_DIR}/dl/${pkg}" \
    "https://github.com/Acly/vision.cpp/releases/download/v${VISP_VERSION}/${pkg}"
  tar -xzf "${VISION_DIR}/dl/${pkg}" -C "${VISION_DIR}/dl"
  # リリースの bin/ lib/ 構造をそのまま配置（vision-cli は $ORIGIN と $ORIGIN/../lib を rpath 参照）
  rm -rf "${VISION_DIR}/bin" "${VISION_DIR}/lib"
  cp -R "${VISION_DIR}/dl/bin" "${VISION_DIR}/bin"
  [ -d "${VISION_DIR}/dl/lib" ] && cp -R "${VISION_DIR}/dl/lib" "${VISION_DIR}/lib"
  chmod +x "${VISION_DIR}/bin/vision-cli"
  rm -rf "${VISION_DIR}/dl"
  echo "[setup] 展開完了: ${VISION_DIR}/bin/vision-cli"
}

case "${OS}" in
  Darwin)
    build_from_source
    ;;
  Linux)
    download_prebuilt "visioncpp-linux-x64-${VISP_VERSION}.tar.gz"
    ;;
  *)
    echo "[setup] 未対応OS。手動で vision-cli を ${VISION_DIR}/bin に配置してください"
    ;;
esac

# ---------------------------------------------------------------------------
# 2. BiRefNet GGUF モデルのダウンロード（toonout / general / lite）
# ---------------------------------------------------------------------------
mkdir -p "${VISION_DIR}/models"
for entry in "${MODELS[@]}"; do
  fname="${entry%%|*}"
  url="${entry#*|}"
  dest="${VISION_DIR}/models/${fname}"
  if [ -f "${dest}" ]; then
    echo "[setup] モデル取得済み: ${fname}"
  else
    echo "[setup] モデルをダウンロード: ${fname} ..."
    curl -L -# -o "${dest}" "${url}"
  fi
done

echo "[setup] 完了。"
echo "[setup] ※ isnet-anime (rembg) を使う場合は別途: cd server/python && uv sync"
