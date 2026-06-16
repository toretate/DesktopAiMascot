# vision (BiRefNet-ToonOut 背景除去)

ComfyUI を使わずに、ComfyUI-RMBG と同等の **BiRefNet-ToonOut**（アニメ画像向けに
ファインチューニングした BiRefNet）でローカル背景除去を行うための一式。
torch 非依存で、GGUF モデル + [vision.cpp](https://github.com/Acly/vision.cpp) の
`vision-cli` で推論する。背景除去は **サーバ（Node.js）側で実行**する。

- モデル: [`Acly/BiRefNet-toonout-GGUF`](https://huggingface.co/Acly/BiRefNet-toonout-GGUF)
  （`BiRefNet-ToonOut-F16.gguf`、約420MB、MIT ライセンス）
- 元モデル: [joelseytre/toonout](https://huggingface.co/joelseytre/toonout) /
  [MatteoKartoon/BiRefNet](https://github.com/MatteoKartoon/BiRefNet) /
  論文 [arXiv:2509.06839](https://arxiv.org/abs/2509.06839)
- 推論ランタイム: [Acly/vision.cpp](https://github.com/Acly/vision.cpp)（v0.3.0、ggml ベース）

---

## 選定の経緯

- ComfyUI-RMBG は独自アルゴリズムではなく、HuggingFace の既存チェックポイントを
  PyTorch で呼ぶラッパー。BiRefNet_toonOut もその一つ。
- `rembg`（方法B / ONNX ランタイム）は **ToonOut 非対応**：ToonOut は `.pth` のみ配布で
  ONNX 版が無く、rembg のモデルレジストリにも登録されていないため。
- ToonOut を使うには (A) PyTorch で BiRefNet 直ロード、(B) **GGUF + vision.cpp** の2択。
  デスクトップ/サーバ配布では torch（約2GB）が重いため **GGUF + vision.cpp を採用**。

---

## OS 別セットアップ

`server/vision/` 配下の `setup.sh` / `setup.ps1` / `.gitignore` / `README.md` のみコミット対象。
`bin/` `lib/` `vision.cpp/` `models/` は `setup` で生成され、`.gitignore` 済み。

| OS | vision-cli の入手 | 生成物 | コマンド |
|---|---|---|---|
| **Windows x64**（メイン開発） | プレビルト zip | `bin\`（exe + DLL） | `cd server\vision; .\setup.ps1` |
| **Linux x64**（本番想定） | プレビルト tar.gz | `bin/` + `lib/` | `cd server/vision && ./setup.sh` |
| **macOS**（検証環境） | **ソースビルド**（プレビルト無し） | `vision.cpp/build/bin/vision-cli` | `brew install cmake && ./setup.sh` |
| 全OS共通 | — | `models/BiRefNet-ToonOut-F16.gguf` | 上記 setup に含む |

> Windows で実行ポリシーに弾かれる場合:
> `powershell -ExecutionPolicy Bypass -File .\setup.ps1`

> **vision-cli は mac にも存在する。** プレビルトが無いだけで、`setup.sh` が
> ソース（CMake + C++20）からビルドする。検証環境（Apple M3 Pro）でビルド・動作確認済み。

クライアント（Android / iOS / Web）には不要 — サーバ API（`/api/remove-background`）を叩くだけ。

---

## CLI の使い方（手動確認用）

```sh
vision-cli birefnet -b cpu -m models/BiRefNet-ToonOut-F16.gguf \
  -i input.png -o mask.png --composite cutout.png
```

- `--composite` 出力（`cutout.png`）が透過切り抜き（背景除去結果）。
- `-o` はマスク（グレースケール）。

---

## バックエンド（CPU / GPU）

サービスの既定は **CPU**（`VISION_BACKEND=gpu` で上書き可）。

- **macOS の Metal は使用不可**：auto（Metal）で実行すると下記アサートでクラッシュするため
  CPU 固定にしている。CPU では同条件で正常完了（1枚あたり約16秒 / 1024px）。
- Windows プレビルトは `ggml-vulkan.dll`、Linux プレビルトは `libggml-vulkan.so` 同梱 →
  Vulkan が使える環境では `VISION_BACKEND=gpu` で GPU 推論可能（未検証）。

### macOS Metal クラッシュの記録（一次情報＝本環境での実行ログ）

環境: Apple M3 Pro / vision.cpp v0.3.0（同梱 ggml 0.9.9）/ BiRefNet-ToonOut-F16

```
Running inference... .../ggml/src/ggml-metal/ggml-metal-ops.cpp:3062:
GGML_ASSERT(op->src[1]->type == GGML_TYPE_F32) failed
  ...
  libggml-metal.0.9.9.dylib  ggml_metal_op_bin + 1728
  libggml-metal.0.9.9.dylib  ggml_metal_op_encode + 1528
  libggml-metal.0.9.9.dylib  ggml_metal_graph_compute + 588
  vision-cli                 run_birefnet + 668
```

ggml-metal の二項演算カーネル (`ggml_metal_op_bin`) で「src[1] が F32 であること」という
アサートに失敗して abort。BiRefNet の f16 テンソルと Metal カーネルの型想定不一致が原因。

#### upstream issue 調査結果（このファイル更新時点）

- **ggml 本体に同種の issue あり**: [ggml-org/llama.cpp #9902](https://github.com/ggml-org/llama.cpp/issues/9902)
  「GGML_ASSERT(src1t == GGML_TYPE_F32) failed」。**全く同じアサート**（Metal 二項演算で
  src1 が F32 必須）が **f16 GGUF モデル**で発生。ただし `unconfirmed / stale` で
  **明確な修正は未確認**。我々の発生箇所は `ggml-metal-ops.cpp:3062`、#9902 は旧版の
  `ggml-metal.m:1080` で、ggml のバージョン差はあるがアサートの意味は同一。
- Metal の bin カーネルは src 型を F32 前提でチェックする実装
  （[bin kernels consolidation commit](https://github.com/ggml-org/llama.cpp/commit/8872ad2125336d209a9911a82101f80095a9831d)）。
- **vision.cpp 側にはこの crash の issue は無い**
  （[Acly/vision.cpp issues](https://github.com/Acly/vision.cpp/issues) に該当報告なし）。

→ 結論: 「**ggml-metal の f16 二項演算の制約**」という点は ggml 本体の同種 issue で裏付け
あり。ただし「vision.cpp + ToonOut で既知・修正済み」とまでは言えない（該当 issue 無し・
#9902 も未解決）。当面は **mac は CPU バックエンド固定**で運用する。
新しい ggml / vision.cpp で f16 二項演算が改善されれば Metal 再試行の価値あり。

---

## サーバ統合

- `server/src/services/toonout-service.ts`
  - `removeBackgroundToonOut(buffer)`: 一時ファイル経由で `vision-cli birefnet` を実行し、
    透過 PNG の Buffer を返す（`crop-expression-service.ts` と同じ `execFile` パターン）。
  - `checkToonOutAvailable()`: vision-cli + モデルの有無を判定（テストのスキップ用）。
  - 環境変数: `VISION_CLI`（バイナリパス上書き）/ `TOONOUT_MODEL`（モデルパス）/
    `VISION_BACKEND`（`cpu`(既定) | `gpu`）。
- `server/src/services/remove-bg-service.ts`: `engine === 'toonout'` 分岐を追加。
  既存の `node`(@imgly) / `comfy` はそのまま。
- UI: `BackgroundRemovalModal.vue` と `ExpressionEditorModal.vue` の背景除去エンジン選択に
  「ToonOut」を追加（既定は `node`）。

---

## テスト

- `server/src/test/toonout.test.ts`（`node:test`、`cd server && npm test` で実行）
  - サンプル画像（`mascots/default_mascot_sample/guide_01.png`, `guide_02.png`）を変換し、
    出力が RGBA(透過) PNG・入力と同寸法であることを検証。
  - **未セットアップ環境では自動スキップ**（CI / Windows で setup 未済でも落ちない）。
  - 実行結果は `server/vision/test_results/*_toonout.png` に保存。
