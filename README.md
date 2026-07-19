# Desktop AI Mascot

デスクトップ上に常駐するAIマスコットアプリケーションです。WebGL (Pixi.js) を用いたアニメーション描画、背景透過や半透明チャットウィンドウを備えています。
Electronによるデスクトップアプリ版に加え、Webブラウザでの動作にも対応しています。
ローカルLLM（LM Studioなど）や音声合成サービス（Style-Bert-VITS2、VOICEVOX、Irodori TTSなど）、画像生成（ComfyUIなど）と連携して、キャラクターとのリアルタイムな対話やインタラクションを楽しむことができます。

## 主な機能

- **デスクトップマスコット表示**: WebGL (Pixi.js) を活用し、アニメーション可能なマスコットを滑らかに描画。
- **AI対話機能**: LM StudioなどのローカルLLMと連携したチャット機能（背景透過/半透明のチャットウィンドウ）。
- **音声合成 (TTS)**: Style-Bert-VITS2、VOICEVOX、Irodori TTSと連携したリアルタイム音声出力。
- **マスコット管理**: 複数マスコットの追加・切り替え、プロフィールや服装、表情、ポーズのカスタマイズ。
- **表情スプライト自動位置合わせ**: 決定論的アルゴリズムやGemini Visionを用いて、表情スプライトの位置やスケールを自動アライメント。
- **インタラクティブ操作**: ドラッグ移動、ウィンドウの追従、ダブルクリックや右クリックメニューによる切り替え。
- **環境設定**: API接続設定（LLM、TTS、画像生成）、マスコットパラメータ調整をGUIから容易に実行。
- **クロスプラットフォーム対応**: Electronによるデスクトップ版（透過対応）と、Webブラウザで動作するWeb版を提供。

## プロジェクト構成

本プロジェクトは、クライアント（Electron + Nuxt/Vue 3 レンダラー）とバックエンド（Nitro サーバー）を同一の `app/` 配下に統合し、共有ライブラリや Python 連携スクリプトを別ディレクトリに配置する構成です。

```
tonarice/
├── app/                        # クライアント + バックエンド (Electron + Nuxt/Vue 3 + Nitro)
│   ├── electron/               # Electron メインプロセス (ウィンドウ管理、IPCハンドラー)
│   ├── src/                    # レンダラープロセス + Nitro サーバー
│   │   ├── components/         # MascotViewer, ChatPanel などのUIコンポーネント
│   │   ├── store/              # Piniaによる状態管理 (config, mascot)
│   │   ├── connector/          # 外部AI・音声合成APIとの接続コネクタ
│   │   ├── server/             # Nitro バックエンド (api/, routes/(WebSocket), skills/, utils/)
│   │   ├── skills/             # アプリケーション固有のスキル・ツール定義
│   │   ├── assets/             # 読み辞書などの静的アセット
│   │   ├── mascots/            # マスコット設定・アセットビルダー
│   │   └── utils/              # ユーティリティ
│   └── web/                    # Web版クライアント向けアセット・設定
│
├── packages/                   # 独立したサブパッケージ・ライブラリ
│   └── expression-alignment/   # 表情スプライト自動位置合わせライブラリ (Node/Browser対応)
│
├── python-services/            # Python 連携スクリプト (背景除去・表情処理など)
│
├── aiservice/                  # AI生成用のリソース管理
│   └── image/comfy_workflows/  # ComfyUIのワークフロー定義 (.json)
│
├── mascots/                    # マスコットキャラクターの定義、画像アセット
│   ├── default_mascot_sample/  # サンプルマスコットの画像・構成ファイル
│   └── Mascot.md               # マスコット定義・感情と表情スプライトの対応
│
├── config.json                 # アプリ設定の永続化ファイル (マスコット定義・読み辞書など)
│
└── docs/                       # 設計書、仕様書、各種機能の実装まとめ
```

## 動作要件

- **OS**: Windows 11 (Electronまたはブラウザが動作する環境)
- **Node.js**: 18.0 以降
- **外部AIサービス**（任意）:
    - **対話 (LLM)**: [LM Studio](https://lmstudio.ai/) などのローカルLLMサーバー
    - **音声合成 (TTS)**: [VOICEVOX](https://voicevox.hiroshiba.jp/)、[Style-Bert-VITS2](https://github.com/litagin02/Style-Bert-VITS2)、Irodori TTS
    - **画像生成**: [ComfyUI](https://github.com/comfyanonymous/ComfyUI) など

---

## 開発と実行方法

### 1. 依存関係のインストール

```bash
# アプリ本体 (クライアント + Nitro サーバー)
cd app
npm install

# 表情アライメントライブラリ
cd ../packages/expression-alignment
npm install
npm run build
```

### 2. 開発モードでの実行

バックエンド（Nitro サーバー）はクライアントの開発サーバーに統合されているため、別途起動する必要はありません。いずれも `app` ディレクトリで実行します。

- **Electronデスクトップ版（背景透過・ネイティブ機能対応）**:
  ```bash
  cd app
  npm run dev:electron
  ```

- **Webブラウザ版**:
  ```bash
  cd app
  npm run dev        # 開発サーバー (http://localhost:3000) をブラウザで開く
  ```

- **LAN内の別端末からWeb版を利用する場合**:
  ```bash
  cd app
  npm run dev:remote
  # 別端末から http://<サーバーのLAN IP>:3000 を開く
  ```

  認証を省略する家庭内テストでは、公開範囲を信頼できるLANに限定したうえで
  `ALLOW_AUTH_BYPASS=true` を設定してください。一般公開環境では使用しないでください。

### 3. テストの実行

```bash
# アプリ本体のテスト (クライアント + サーバーを含む)
cd app
npm run test

# 表情アライメントライブラリのテスト
cd packages/expression-alignment
npm run test
```

### 4. ビルド

```bash
# アプリ本体のビルド (Electron 版; dist-electron / dist に出力)
cd app
npm run build
```

---

## 音声読み上げ辞書（TTS読み辞書）のカスタマイズ

音声合成（TTS）に渡す前に、テキストは自動で正規化されます。処理内容は次のとおりです。

- **マークダウン記法の除去**: `**強調**` → `強調`、`` `code` `` → `code`、`[表示](URL)` → `表示` など（読み上げに不要な記号を除去）。
- **日付の読み変換**: `2026/07/13` → `2026年7月13日`、`7/13` → `7月13日`（ISO形式 `2026-07-13` も対応）。
- **時刻の読み変換**: `11:00` → `11時`、`11:15` → `11時15分`。
- **英単語のカタカナ置換**: 後述の読み辞書に基づき、英語表記を日本語の読みに置換（例: `TypeScript` → `タイプスクリプト`）。

このうち英単語のカタカナ置換に使う「読み辞書」は、以下の4層を**後勝ち**（下にある層ほど優先）でマージして使用します。**専用の編集UIはなく、いずれもファイル/設定を手動編集して登録します。**

| 優先度 | 層 | 実体 | 反映タイミング |
| --- | --- | --- | --- |
| 低 | 生成辞書 | （未実装・将来対応予定） | — |
| ↓ | IT・略語補助辞書 | `app/src/assets/tts-it-overrides.json` | **ビルド時**（アプリに埋め込み） |
| ↓ | アプリ共通カスタム辞書 | `app/src/assets/tts-custom-overrides.json` | **ビルド時**（アプリに埋め込み） |
| 高 | マスコット個別辞書 | `config.json` 内の各マスコットの `aiConfig.ttsDictionary` | **実行時**（次回設定読み込み時） |

### 1. アプリ全体に効かせる読みを追加する

`app/src/assets/tts-it-overrides.json`（IT・製品名・略語向け）または `app/src/assets/tts-custom-overrides.json`（汎用）に、`"英語表記": "カタカナ読み"` の形式で追記します。

```json
{
  "API": "エーピーアイ",
  "TypeScript": "タイプスクリプト",
  "WakeUp Mtg": "ウェイクアップ ミーティング"
}
```

> ⚠️ これらのファイルは**ビルド時にアプリへ静的に埋め込まれます**。開発モードでは編集後に再読み込み（HMR/再起動）で反映されますが、**パッケージ済みアプリでは編集しても反映されず、リビルドが必要**です。

### 2. 特定マスコットだけに効かせる読みを追加する

`config.json`（開発時は `storage/config.json`、パッケージ版は `%APPDATA%/tonarice/config.json`）内の対象マスコットの `aiConfig` に `ttsDictionary` を追加します。こちらは**リビルド不要で、次回の設定読み込み時に反映**されます。

```json
"aiConfig": {
  "chat": { "...": "..." },
  "voice": { "...": "..." },
  "ttsDictionary": {
    "Slack": "スラック",
    "Notion": "ノーション"
  }
}
```

同じキーがある場合、マスコット個別辞書がアプリ共通辞書より優先されます。

### 注意事項

- **読み（値）に使える文字はカタカナ・ひらがな・漢字・長音符（`ー`）・中点（`・`）・空白・句読点（`、。！？`）のみ**です。冪等性（多重適用しても結果が崩れないこと）を保証するため、値に英数字・記号・日付/時刻の区切り文字（`:` `/` `-` など）を含むエントリは**自動的に無視されます**（例: `"GPT": "GPTモデル"` は無視される。`"GPT": "ジーピーティー"` と書く）。
- **キーは64文字以内、値は256文字以内**。空文字の値は無視されます。
- マスコット個別辞書は**最大1000エントリ**まで（超過分は無視）。
- キーの大文字・小文字は区別しません（`api` と `API` は同一扱い）。
- スペースを含むキー（例: `WakeUp Mtg`）は最長一致で優先的に置換されます。
- 無効なエントリは読み込み時に警告ログを出して無視されるため、辞書が期待どおり効かない場合はコンソールログを確認してください。

---

## 技術仕様

- **アプリケーションフレームワーク**: Nuxt 3 (Vite と Nitro サーバーを内包)
- **クライアントシェル**: Electron (Desktop版のみ)
- **フロントエンド**: Vue 3, Tailwind CSS, Pixi.js (WebGL 描画), Pinia, TypeScript
- **バックエンド**: Nitro サーバー (Nuxt 内蔵), WebSocket (`ws`)
- **画像・アライメント処理**: Canvas, OpenCV (WebAssembly), `@imgly/background-removal-node`

---

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。主要な外部依存ライブラリのライセンスに関しては [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。
