# SPEC: sherpa-onnx (ReazonSpeech K2 v2) 音声認識の導入

> ローカルエージェント向けハンドオフ仕様書
> 対象: Python バックエンドへの ASR モジュール追加
> 作成日: 2026-07-09

---

## 0. このドキュメントの扱い方

- **まずプランモードで全体を読み、実装計画を提示すること。** 承認前にコードを書き始めない。
- フェーズ単位で進め、各フェーズの検証が通ってから次に進む。フェーズ間では `/clear` を推奨。
- **スコープ外の作業をしない**（下記「スコープ制御」を厳守）。
- 不明点・想定外のエラーは、勝手に回避策を入れず、いったん報告する。

---

## 1. ゴール

Python バックエンドに、日本語のオンデバイス音声認識（ASR）機能を追加する。
マイク/クライアントから届いた短い発話音声（チャット入力想定、数秒〜十数秒）を、
テキストに変換して返す最小モジュールを作る。

## 2. ハード制約（変更不可）

| 制約 | 内容 | 理由 |
|---|---|---|
| **GPU 不使用** | ASR は CPU のみで動かす。CUDA / GPU 実行を有効にしない。 | VRAM は LLM・TTS・画像生成(Comfy/Forge)が消費しており、ASR に回す余裕がない |
| **torch 非依存** | PyTorch / NeMo を導入しない。`sherpa-onnx`(onnxruntime) のみ。 | 依存の肥大化と GPU 前提化を避ける |
| **日本語** | 認識対象言語は日本語 | プロダクト要件 |
| **オフライン推論** | モデルDL後はネット接続なしで推論できること | エンジンの前提 |

## 3. スコープ制御（重要）

**やること（このSPECの範囲）:**
- `sherpa-onnx` のインストールとバージョン固定
- ReazonSpeech K2 v2 モデルと Silero VAD モデルのダウンロード・配置
- 単体スモークテスト（wavファイル → テキスト）
- VAD + OfflineRecognizer をラップした**独立した Python モジュール**の実装

**やらないこと（明示的にスコープ外。指示があるまで着手禁止）:**
- 既存 API サーバ（Nuxt/TypeScript）や既存 Python バックエンドのエンドポイント改変
- DB スキーマ・既存 Pinia ストア・フロントエンドの変更
- WebAssembly（ブラウザ内実行）版の実装 ← **別パス。今回は扱わない**
- ストリーミング/リアルタイム WebSocket 配信の実装
- ホットワード（固有名詞登録）機能 ← 将来拡張。§9 の注記のみ
- モデルの量子化変換・再学習

**人間の承認が必要な操作:**
- 既存ファイルの編集（新規ファイル追加は可）
- API へのルート追加・配線（Phase 5 は承認後のみ）
- 依存パッケージを `sherpa-onnx` 以外に追加する場合

---

## 4. Phase 0 — 環境確認

1. Python バージョンを確認（3.9〜3.13 を推奨。3.14 wheel も存在するが安定版優先）。
2. プロジェクトの Python 仮想環境（既存のもの）を特定し、そこに入る。新規に venv を作る場合は場所を報告してから。
3. 現状 `torch` が入っているかを確認し、結果を報告（`pip show torch`）。**このSPECでは torch を新規導入しない。**

検証: `python --version` と `pip list` の出力を提示する。

---

## 5. Phase 1 — sherpa-onnx のインストール

```bash
pip install sherpa-onnx
```

- PyPI の公式 wheel（onnxruntime 同梱、CPU版、torch 非依存）を使う。
- wheel は数MB程度と軽量。CUDA 版 (`sherpa-onnx` の GPU ビルド) は**使わない**。

**検証（必須）:**
```bash
python -c "import sherpa_onnx; print(sherpa_onnx.__version__)"
pip show torch        # 何も出ない / 既存のまま増えていないこと
```
- インストールによって `torch` や `nvidia-*` パッケージが引き込まれていないことを確認して報告する。もし引き込まれていたら**停止して報告**。

---

## 6. Phase 2 — モデルの取得

配置先ディレクトリ（例）: `<backend>/models/asr/`

### 6-1. 日本語 ASR モデル（ReazonSpeech K2 v2）

公式配布物: `sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01`
（HuggingFace の `reazon-research/reazonspeech-k2-v2` を sherpa-onnx 用に ONNX 化したもの。オフライン zipformer transducer、日本語専用、学習データ約35,000時間）

```bash
wget https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01.tar.bz2
tar xvf sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01.tar.bz2
rm sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01.tar.bz2
```

Windows など `wget`/`tar` が無い環境ではクロスプラットフォームなダウンロード手段（`curl -L -O ...` または Python の `urllib`）を使ってよい。**URLとファイル名は上記を厳守。**

展開後に含まれる主なファイル（int8 と fp32 の両方が入っている）:
- `encoder-epoch-99-avg-1.int8.onnx`
- `decoder-epoch-99-avg-1.onnx`
- `joiner-epoch-99-avg-1.int8.onnx`
- `tokens.txt`
- （fp32版: `encoder-epoch-99-avg-1.onnx`, `joiner-epoch-99-avg-1.onnx` も同梱）

**このSPECでは int8 を既定とする**（最小フットプリント）。精度検証で不足なら fp32 に切替（§9）。

### 6-2. VAD モデル（Silero VAD）

```bash
wget https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx
```

短い発話を切り出し、無音を捨てるために使う。

**検証:** 4ファイル（encoder/decoder/joiner/tokens）と `silero_vad.onnx` が配置先に存在し、サイズが 0 でないことを確認して報告。

---

## 7. Phase 3 — 単体スモークテスト（統合前の必須ゲート）

**目的:** モデルとエンジンが CPU 単体で正しく動くことを、アプリ統合前に確認する。

1. 16kHz・モノラルの日本語テスト wav を1つ用意（既存のサンプルがなければ短い録音を1本）。
2. 公式サンプル `python-api-examples/offline-decode-files.py` 相当の最小スクリプトで認識を実行し、日本語テキストが出ることを確認する。

最小の認識器構築コード（このモデルは offline transducer なので `from_transducer` を使う）:

```python
import sherpa_onnx

recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
    encoder="models/asr/sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01/encoder-epoch-99-avg-1.int8.onnx",
    decoder="models/asr/sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01/decoder-epoch-99-avg-1.onnx",
    joiner="models/asr/sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01/joiner-epoch-99-avg-1.int8.onnx",
    tokens="models/asr/sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01/tokens.txt",
    num_threads=2,               # CPU スレッド数。実機に合わせて調整
    sample_rate=16000,
    feature_dim=80,
    decoding_method="greedy_search",
)

stream = recognizer.create_stream()
# samples: 16kHz float32 mono の numpy 配列（-1.0〜1.0）
stream.accept_waveform(16000, samples)
recognizer.decode_stream(stream)
print(stream.result.text)
```

**検証（必須ゲート）:** テスト wav に対して妥当な日本語テキストが返ること。ここが通るまで Phase 4 に進まない。認識精度・レイテンシ（処理秒数）も併せて報告する。

---

## 8. Phase 4 — ASR モジュール実装（独立・API 非配線）

新規モジュールを1つ作る。例: `<backend>/asr/reazon_asr.py`

要件:
1. **モデルは起動時に1回だけロード**し、以降は使い回す（毎リクエストでロードしない）。
2. 入力音声を Silero VAD で発話区間に分割し、各区間を `OfflineRecognizer` で認識、結果を結合して返す関数を用意する。
   - VAD 併用の参考: 公式の VAD + non-streaming ASR サンプル（`sherpa-onnx-vad-*-offline-asr`）の Python 版に相当する構成。
3. 入力音声の**サンプルレート正規化**を必ず入れる（入力が 16kHz mono でない場合はリサンプル）。ReazonSpeech / Silero VAD はいずれも 16kHz 前提。
4. スレッド数 `num_threads` は設定値として外出し（既定 2）。
5. 公開インターフェースは最小に：`transcribe(samples: np.ndarray, sample_rate: int) -> str` 程度。
6. **この時点では既存 API に配線しない。** モジュール単体で import して動く状態がゴール。

検証: モジュールを import し、テスト wav を渡して日本語テキストが返るユニット的な確認スクリプトを提示。

---

## 9. Phase 5 — API 統合（★人間の承認後のみ着手）

- Python バックエンドのサービス層から Phase 4 のモジュールを呼び出す形で公開する。
- エンドポイントの契約（入力音声フォーマット、レスポンス形、同期/非同期）は**着手前に人間と合意する**。
- 既存の API サーバ(Nuxt)・フロントエンドとの結線は、契約合意後に別タスクとして扱う。
- **この Phase は指示があるまで開始しない。**

---

## 10. 補足・既知の注意点（実装判断の材料）

- **int8 と fp32**: 既定は int8。日本語精度が不足する場合のみ、encoder/joiner を fp32 版に差し替えて比較する（速度と精度のトレードオフ）。
- **モデル種別**: ReazonSpeech K2 v2 は **非ストリーミング(offline)** モデル。リアルタイム感は「VADで区切って区間ごとに逐次認識」で出す。真のストリーミング配信は本SPECのスコープ外。
- **VRAM**: onnxruntime CPU 実行のため VRAM 消費はゼロである想定。GPU を使う設定（onnxruntime-gpu 等）を有効化しないこと。念のため実行中の VRAM 使用量が増えていないことを確認できると良い。
- **ホットワード（固有名詞・キャラ名の認識強化）**: `from_transducer` は `hotwords_file` / `hotwords_score` を持つが、この zipformer モデルでは modeling_unit / bpe_vocab の設定が必要で複雑になる。**今回は入れない。** 将来、キャラクター名の誤認識が問題になったら別タスクで検討。
- **入力形式**: sherpa-onnx が受け取るのは 16kHz float32 mono の波形。クライアントから Opus/WebM 等で届く場合のデコードは、このモジュールの外（受信層）で行う前提。

## 11. 参照リンク

- sherpa-onnx リポジトリ: https://github.com/k2-fsa/sherpa-onnx
- ReazonSpeech モデル解説（offline transducer / zipformer）: https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/zipformer-transducer-models.html
- Python API サンプル（offline-decode-files.py）: https://github.com/k2-fsa/sherpa-onnx/blob/master/python-api-examples/offline-decode-files.py
- 元モデル: https://huggingface.co/reazon-research/reazonspeech-k2-v2

---

## 12. 完了条件（Definition of Done, Phase 4 まで）

- [ ] `sherpa-onnx` がインストールされ、torch を引き込んでいないことを確認済み
- [ ] ASR モデル + Silero VAD が配置され、存在確認済み
- [ ] スモークテスト（wav → 日本語テキスト）が成功し、精度・処理時間を報告済み
- [ ] 独立 ASR モジュールが実装され、単体で動作確認済み
- [ ] 既存 API / フロント / スキーマに一切変更を加えていないことを確認済み
