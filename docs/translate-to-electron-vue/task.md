# 移行タスクリスト

このタスクリストは、Godot (C#) から Electron + Vite + Vue3 + TypeScript への移行手順を追跡するためのTODOリストです。

## フェーズ1: プロジェクトの初期化とビルド環境の構築
- [x] プロジェクトの `package.json` の作成および必要なライブラリ（`electron`, `vite`, `vue`, `typescript`, `vue-tsc`, `vite-plugin-electron` など）のインストール
- [x] UIライブラリ（`primevue`, `@primevue/themes`, `primeicons`）のインストールと初期設定
- [x] `tsconfig.json` および `vite.config.ts` の構成定義
- [x] 開発サーバー起動コマンド（`npm run dev`）の実装とElectronの起動確認
- [x] ESLint / Prettierの設定、およびC#からTSへの変換ルールの定義

## フェーズ2: ElectronメインプロセスとIPC通信の実装
- [x] メインプロセス（`electron/main.ts`）の実装
    - [x] 透過・枠なしのマスコットウィンドウの作成
    - [x] 追従するチャットウィンドウの作成
    - [x] 設定画面ウィンドウ（透過なし）の作成
- [x] プリロードスクリプト（`electron/preload.ts`）の実装（セキュアなコンテキスト隔離）
- [x] マスコットのドラッグ移動イベントと位置保存ロジック（`electron-store` 等）の構築
- [x] 動的マウススルー（Ignore Mouse Events）制御用のIPC通信実装

## フェーズ3: Vue3レンダープロセスとUIコンポーネントの構築
- [/] ベースCSSおよびグラスモーフィズムデザインシステム（`src/styles/main.css`, `glassmorphism.css`）の実装
- [/] 状態管理（Pinia / Vue Reactive Store）の設定（システム設定、マスコット一覧、チャット履歴）
- [/] `MascotViewer` コンポーネントの作成
    - [x] Canvasを用いた画像描画と基本スケール処理の移植
    - [ ] WebGL（PixiJSなど）によるアニメーション・表情切り替え基盤の構築
- [/] `ChatPanel` コンポーネントの作成
    - [x] メッセージスクロール領域、入力欄、ヘッダーボタン類の実装
    - [x] グラスモーフィズムスタイル適用
- [/] 設定画面コンポーネントの実装 (PrimeVue + Auraテーマ採用)
    - [x] PrimeVueプラグインのVueへの登録とAuraダークテーマの設定
    - [x] マスコット一覧および詳細情報編集パネル (Card, Listbox, Dialog 等の利用)
    - [x] 各AIエンジン設定・モデル選択パネル (Select, Slider, InputNumber 等の利用)
    - [x] API KEY入力フォーム (InputText, Password 等の利用)
    - [x] PrimeVueの各要素に対するVanilla CSSを用いたデザインチューニング (グラスモーフィズムとの調和)

## フェーズ4: AIサービス・音声サービスの移植
- [x] 既存のC# AIサービス接続（Gemini API、VOICEVOX連携など）のTypeScript移植
    - [x] Mainプロセス（Node.js）側への移行と、接続状態や例外処理の定義
    - [x] 接続エラー時にシンプルなメッセージを出力するエラーログハンドラーの実装
- [x] コールバックまたはIPCを通じたメッセージ返答と表情アニメーションの連動処理

## フェーズ5: テストおよび検証
- [x] 透過ウィンドウとマウススルーの手動検証
- [x] ウィンドウ追従移動の滑らかさ確認
- [x] 各AIエンジンのAPI接続テストと例外系ログ出力テスト
- [ ] Vitestによる状態管理ロジックのユニットテスト作成
