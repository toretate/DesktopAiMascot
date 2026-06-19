# システム構成仕様書

本ドキュメントでは、Desktop AI Mascotの全体的なシステム構成およびアーキテクチャについて定義します。

---

## 1. 全体アーキテクチャ概要

Desktop AI Mascotは、マスコットキャラクターとユーザーが対話するためのアプリケーションです。
本システムは、主に以下の3つのコンポーネントおよび外部AIサービスによって構成されています。

```mermaid
graph TD
    subgraph Client [クライアント層 (UI)]
        ElectronApp[Electron デスクトップアプリ]
        WebClient[Web版 クライアント (ブラウザ)]
    end

    subgraph Backend [サーバー層]
        APIServer[バックエンドサーバー (Express / WebSocket)]
    end

    subgraph External [外部AIサービス]
        LMStudio[LM Studio (LLM)]
        Voicevox[VOICEVOX (TTS)]
    end

    ElectronApp -->|HTTP / WebSocket| APIServer
    WebClient -->|HTTP / WebSocket| APIServer
    APIServer -->|API 連携| LMStudio
    APIServer -->|API 連携| Voicevox
```

---

## 2. 各コンポーネントの詳細

### 2.1 クライアント (UI)
ユーザーインターフェースを提供し、マスコットの描画やアニメーション、音声の再生、チャットUIの制御を行います。

- **実装技術**: Vue 3 / TypeScript / Vite / TailwindCSS
- **動作モード**:
    1. **Electronデスクトップ版**:
        - デスクトップ上にキャラクターを常駐させ、シームレスな操作を可能にするモードです。
        - プリロードスクリプトを介してOSネイティブの機能やローカルファイルシステムにアクセスします。
    2. **Web版クライアント**:
        - ブラウザ上で動作するモードです。Electron依存のコードを除外したWeb専用の設定でビルドされます。
- **開発時の挙動（Vite開発サーバーについて）**:
    - **質問に対する回答**: 「UI側で `npm run dev` などを実行した際、サーバーが起動する（ポート `5173` 等で待ち受ける）のはなぜか？」
    - **解説**:
        - モダンなフロントエンド開発環境（Viteなど）では、VueやTypeScriptのファイルをブラウザが解釈できるJavaScript/CSSにオンザフライで高速にトランスパイル（変換）し、ホットモジュール置換（HMR）を行う必要があります。
        - このトランスパイルおよびアセット配信を行うために、Viteは内部で**フロントエンド開発用のWebサーバー（Vite Dev Server）**を起動します。
        - これはあくまで開発時に「クライアント用の静的アセット（HTML/JS/CSS）をローカルブラウザやElectronへ配信するためのサーバー」であり、データベースの操作やAIとの通信を直接行う**バックエンドサーバー（API/WebSocketサーバー）ではありません**。
        - 本番ビルド時（`npm run build` 実行時）には、Vite開発サーバーは不要となり、純粋な静的ファイル（HTML/JS/CSS）として出力されます。

### 2.2 バックエンドサーバー (Server)
クライアントからのリクエストを受け付け、LLMや音声合成などの重い処理や、外部サービスへのプロキシ処理を行います。

- **実装技術**: Node.js / Express / ws (WebSocket) / tsx (TypeScript 実行環境)
- **主な役割**:
    - AIサービス（LM Studio、VOICEVOXなど）との接続中継
    - 音声データの生成や画像処理（背景透過処理など）の実行
    - セッションや履歴の管理
- **開発時の起動**:
    - `server` ディレクトリ内の `npm run dev` を実行することで、バックエンドサーバー（API用ポート）が起動します。

### 2.3 外部連携サービス
AIによるテキスト生成および音声合成を提供する外部のローカルAPIサーバー群です。

- **LM Studio**:
    - ローカルでLLM（大規模言語モデル）を動かし、マスコットの対話テキストを生成するためのAPIを提供します。
- **VOICEVOX**:
    - 生成されたテキストをもとに、キャラクターごとの音声データを合成するためのAPIを提供します。

---

## 3. 通信プロトコルとデータフロー

### 3.1 リアルタイムチャット
マスコットとの対話や音声TTSのリアルタイム配信には、低遅延な通信を実現するために **WebSocket** を採用しています。
- クライアント ⇆ バックエンドサーバー間: WebSocket接続
- バックエンドサーバー ⇆ LM Studio/VOICEVOX: HTTP REST API

### 3.2 静的ファイルの配信
- **開発時**: クライアントはVite開発サーバー（通常 `http://localhost:5173` 等）からアセットをロードします。
- **本番時**:
    - Electron版はビルドされたローカルアセットを直接読み込みます。
    - Web版は、静的ホスティングサーバー（Firebase Hosting等）またはバックエンドサーバー自体が静的ファイルをホストしてブラウザに配信します。
