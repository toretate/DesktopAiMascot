#!/usr/bin/env bash
set -euo pipefail

# Python 環境セットアップ (uv)
# git clone 後にこのスクリプトを実行すると python/ の依存関係を構築します。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "${SCRIPT_DIR}/python"
uv sync

echo "setup 完了: ${SCRIPT_DIR}/python/.venv を作成しました"
