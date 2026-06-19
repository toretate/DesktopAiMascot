# Desktop AI Mascot

デスクトップ上に常駐するAIマスコットアプリケーションです。Electron と Vue.js (TypeScript) で構築されており、ローカルLLM（LM Studio）や音声合成サービス（Style-Bert-VITS2）と連携して、キャラクターとの対話を楽しむことができます。

## 主な機能

- **デスクトップマスコット表示**: デスクトップ上にアニメーション可能なマスコットを表示
- **AI対話機能**: LM Studioと連携したチャット機能（半透明のチャットウィンドウ表示）
- **音声合成**: Style-Bert-VITS2との連携による音声出力
- **マスコット管理**: 複数のマスコット画像の管理とアニメーション・スプライト位置調整
- **ドラッグ移動**: マスコットをドラッグして自由に配置可能
- **位置記憶**: 前回の位置を記憶し、次回起動時に同じ位置に表示
- **システムトレイ常駐**: システムトレイから表示/非表示や終了が可能
- **設定画面**: API設定やマスコット設定をGUIで変更可能

## 動作要件

- **OS**: Windows 11 (Electronが動作する環境)
- **Node.js**: Node.js 18.0以降
- **外部サービス**（任意）:
  - チャット: LM Studio などのローカルLLM
  - 音声合成(TTS): Style-Bert-VITS2（音声合成を使用する場合）

## インストールと実行

### 前提条件

1. [Node.js](https://nodejs.org/) をインストール
2. （任意）LLMの用意
	- [LM Studio](https://lmstudio.ai/) をインストールしてローカルでLLMを実行
3. （任意）TTS of choice:
	- [Style-Bert-VITS2](https://github.com/litagin02/Style-Bert-VITS2) などをインストールして音声合成サーバーを実行

＊画像生成、動画生成などは今後のバージョンで順次拡張予定です。

---

## 使い方

### 起動と操作

1. サーバーとUIを起動すると、デスクトップにマスコットが表示されます
2. マスコットをクリックすると対話パネルが開きます
3. マスコットをドラッグして移動できます
4. マスコットを右クリックすると設定画面を開くことができます

### チャット機能の使用

1. LM Studioを起動し、モデルをロード
2. LM Studioのローカルサーバーを起動（デフォルト: http://127.0.0.1:1234）
3. マスコットをクリックして対話パネルを開く
4. テキスト入力欄にメッセージを入力して送信

---

## ビルドと実行方法

### 開発モードでの実行

UI（Electron）とバックエンドサーバー（Express）をそれぞれ起動します。

#### 1. サーバーの起動
```bash
cd server
npm install
npm run dev
```

#### 2. UIの起動
```bash
cd ui
npm install
npm run dev
```

※ `ui` ディレクトリ側から `npm run server:dev` を使用してサーバー側を同時に立ち上げることも可能です。

### ビルド

```bash
# UI (Electron + Vue.js) のビルド
cd ui
npm run build

# サーバー (Node.js/Express) のビルド
cd server
npm run build
```

---

## プロジェクト構成

本プロジェクトは、UIを描画する `ui`（Electron/Vue）と、AI関連の重い処理や画像処理を行う `server`（Express）に分かれています。

```
DesktopAiMascot/
├── ui/                         # UI / Electronフロントエンド
│   ├── electron/               # Electronメインプロセス (ウィンドウ制御、IPCハンドラー)
│   │   ├── window/             # チャット、マスコット、設定ウィンドウの制御
│   │   └── ipc-handlers/       # 各種プロセス間通信ハンドラー
│   ├── src/                    # Vue.js 3 レンダラープロセス (フロントエンド)
│   │   ├── components/         # MascotViewer, ChatPanel 等のVueコンポーネント
│   │   ├── mascots/            # マスコットのアセット定義・ビルダー
│   │   ├── store/              # Piniaによる状態管理 (config, mascot)
│   │   └── utils/              # 音声再生等のユーティリティ
│   └── package.json
│
├── server/                     # ローカルバックエンドサーバー (Express)
│   ├── src/                    # APIエンドポイント、LM Studio連携、画像・音声処理
│   │   ├── index.ts            # サーバーエントリーポイント
│   │   └── vision/             # 画像認識・スプライト境界検出関連
│   └── package.json
│
└── docs/                       # アプリケーション仕様書・ドキュメント
```

## 技術仕様

- **フレームワーク**: Electron, Express (Node.js)
- **フロントエンド**: Vue.js 3, Vite, Tailwind CSS, TypeScript
- **設定保存**: JSON/YAML形式

---

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

### 主要な使用ライブラリ

- **@lmstudio/sdk**
- **@imgly/background-removal-node**
- **Vue.js 3**
- **Electron**
- **Vite**
