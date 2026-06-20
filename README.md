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

本プロジェクトは、フロントエンドUI、バックエンドサーバー、および共有ライブラリで構成されています。

```
DesktopAiMascot/
├── ui/                         # フロントエンド (Electron + Vue 3)
│   ├── electron/               # Electron メインプロセス (ウィンドウ管理、IPCハンドラー)
│   ├── src/                    # Vue 3 レンダラープロセス (共通アプリケーション層)
│   │   ├── components/         # MascotViewer, ChatPanel などのUIコンポーネント
│   │   ├── store/              # Piniaによる状態管理 (config, mascot)
│   │   ├── connector/          # サーバー/API通信コネクタ
│   │   ├── skills/             # アプリケーション固有のスキル・ツール定義
│   │   └── mascots/            # マスコット設定・アセットビルダー
│   └── web/                    # Web版クライアント向けアセット・設定
│
├── server/                     # バックエンドサーバー (Express + WebSocket)
│   ├── src/                    # サーバーソースコード
│   │   ├── index.ts            # エントリーポイント
│   │   ├── connector/          # 外部AI・音声合成APIとの接続コネクタ
│   │   ├── routes/             # APIエンドポイントの定義
│   │   ├── services/           # ビジネスロジック層
│   │   ├── skills/             # LLM向けツール定義 (Tool Use)
│   │   └── utils/              # ユーティリティ
│   ├── vision/                 # 画像処理・スプライト境界検出など
│   └── python/                 # Python 連携スクリプト
│
├── packages/                   # 独立したサブパッケージ・ライブラリ
│   └── expression-alignment/   # 表情スプライト自動位置合わせライブラリ (Node/Browser対応)
│
├── aiservice/                  # AI生成用のリソース管理
│   └── image/comfy_workflows   # ComfyUIのワークフロー定義 (.json)
│
├── mascots/                    # マスコットキャラクターの定義、画像アセット
│   ├── default_mascot_sample/  # サンプルマスコットの画像・構成ファイル
│   └── EmotionDefinitions.md   # 感情と表情スプライトの対応定義
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

プロジェクト全体のセットアップを行います。

```bash
# フロントエンド (ui)
cd ui
npm install

# バックエンド (server)
cd ../server
npm install

# 表情アライメントライブラリ
cd ../packages/expression-alignment
npm install
npm run build
```

### 2. 開発モードでの実行

#### バックエンドサーバーの起動

```bash
cd server
npm run dev
```
または、`ui` ディレクトリからバックエンドサーバーを同時に起動することも可能です：
```bash
cd ui
npm run server:dev
```

#### クライアントの起動

- **Electronデスクトップ版（背景透過・ネイティブ機能対応）**:
  ```bash
  cd ui
  npm run dev
  ```

- **Webブラウザ版**:
  ```bash
  cd ui
  npm run dev:web
  ```

### 3. テストの実行

各モジュールでテストが用意されています。

```bash
# フロントエンドのテスト
cd ui
npm run test

# サーバーのテスト
cd server
npm run test

# 表情アライメントライブラリのテスト
cd packages/expression-alignment
npm run test
```

### 4. ビルド

```bash
# UIのビルド
cd ui
npm run build       # Electron版のビルド (dist-electron / dist)
npm run build:web   # Webブラウザ用静的ファイルのビルド

# サーバーのビルド
cd server
npm run build       # dist ディレクトリに出力
```

---

## 技術仕様

- **クライアントシェル**: Electron (Desktop版のみ)
- **フロントエンド**: Vue 3, Vite, Tailwind CSS, Pixi.js (WebGL 描画), Pinia, TypeScript
- **バックエンド**: Node.js, Express, WebSocket (`ws`), `tsx`
- **画像・アライメント処理**: Canvas, OpenCV (WebAssembly), `@imgly/background-removal-node`

---

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。主要な外部依存ライブラリのライセンスに関しては [THIRD_PARTY_NOTICES.md](file:///C:/workspace/workspace-win/DesktopAiMascot/THIRD_PARTY_NOTICES.md) を参照してください。
