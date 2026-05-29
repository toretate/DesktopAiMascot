# Godot (C#) から Electron + Vite + Vue3 + TypeScript への移行計画

現在の C# + Godot Editor ベースの開発スタックを廃止し、当初の設計目標である **Electron + Vite + Vue3 + TypeScript** の構成へ完全移行するための実装計画です。

> [!NOTE]
> この計画は、Web技術（WebGL、HTML5/CSS3）を用いた表現力の向上、マルチプラットフォーム（Webブラウザ、将来のモバイル）への展開の容易さ、およびOSレベルの透過ウィンドウ処理の安定化を実現することを目的としています。

---

## ユーザーレビュー要求事項

> [!IMPORTANT]
> 移行にあたり、以下の決定事項およびトレードオフについてご確認とご承認をお願いいたします。

1. **データ保存・設定管理方式の変更**
    - 既存のC#実装では独自ファイル（`SystemConfig.cs`）を使用していましたが、Electron環境では **Electron-Store** または **LocalForage / Web Storage API** を用いたシンプルな JSON 保存に移行します。
    - ブラウザ単体での動作時も考慮し、ローカル設定は基本 `localStorage` または `IndexedDB` に保存し、Electron実行時は `electron-store` 等を通じてファイルシステムに永続化するハイブリッド構成を提案します。

2. **WebGLマスコットアニメーションエンジンの選定**
    - 2DアニメーションおよびWebGL描画用ライブラリとして、軽量かつ強力な **PixiJS**（WebGL 2D描画ライブラリ）の採用を第一候補とします。
    - Live2DやSpine等の外部フォーマットを利用する場合は、それぞれ対応するWebGL用SDKをVueコンポーネント内でラップして描画します。

3. **AI/音声サービス (Node.js 側) の通信ログ設計**
    - 外部APIとの通信は、原則として Electron の Main プロセス（Node.js 環境）で実行するか、Renderer プロセス（Web環境）の fetch から実行します。
    - グローバルルールに基づき、通信ログを適切に残し、接続エラーの際はスタックトレースを隠蔽してシンプルなデバッグ出力（`Debug.WriteLine` に相当する `console.warn` またはファイルログ）を行います。

---

## オープンクエスチョン

> [!WARNING]
> 実装を開始する前に明確にしておきたい点です。

- **マスコット画像の動的生成機能 (Comfy Workflow 等) の統合範囲について**
    - 既存の仕様にある「服装や表情をプロンプトから生成する機能」は、バックエンドとして ComfyUI 等のローカル/リモートAPIとの通信を必要とします。
    - **決定方針**: 初期フェーズではPCのローカル環境で生成（ComfyUIローカルAPIとの通信）できるように実装し、将来的にはスマートフォンなどのモバイル端末からもリモート生成ができるような設計（API抽象化）を行います。
    
- **既存のC#コードの資産再利用**
    - **決定方針**: 辞書データ（MeCabのカナ変換辞書など）は破棄し、Vue3/Node.js側で最適な代替手法（Web Speech APIやオープンソースの形態素解析ライブラリなど）を選定します。プロンプトテンプレートやその他の主要ロジック、アセットなどはTypeScriptへ移植して引き継ぎます。

---

## 提案される変更点

### 1. プロジェクト構造とディレクトリ設計 [NEW]

移行後のプロジェクトディレクトリは以下の構成になります。

```
DesktopAiMascot/
├── package.json                # 依存パッケージ定義
├── tsconfig.json               # TypeScript コンパイル設定
├── vite.config.ts              # Viteビルド・Electron統合設定
├── electron/                   # Electron メインプロセス関連
│   ├── main.ts                 # メインプロセス（ウィンドウ生成、IPCハンドラー）
│   └── preload.ts              # プリロードスクリプト（安全なAPIブリッジ）
├── src/                        # レンダープロセス（Vue 3 Webアプリ）
│   ├── main.ts                 # Vue エントリーポイント
│   ├── App.vue                 # ルートコンポーネント
│   ├── components/             # 再利用可能なUIコンポーネント
│   │   ├── MascotViewer.vue    # Canvas/WebGLを用いたマスコット表示・アニメーション
│   │   ├── ChatPanel.vue       # チャットパネル（グラスモーフィズム対応）
│   │   └── settings/           # 設定パネル群（Mascot, AI, API Key等）
│   ├── store/                  # 状態管理（Pinia等またはカスタムReactiveストア）
│   │   └── system.ts           # システム設定、チャット履歴管理
│   ├── assets/                 # 静的アセット（マスコット画像、アイコンなど）
│   └── styles/                 # プレミアムCSSデザインシステム
│       ├── main.css            # ベース・ユーティリティ
│       └── glassmorphism.css   # 半透明・グラスモーフィズム用定義
└── docs/                       # ドキュメントディレクトリ
    └── translate-to-electron-vue/
        ├── implementation_plan.md # 本ファイル
        ├── task.md                # タスク管理
        └── walkthrough.md         # 移行検証レポート
```

---

## 技術要素と実装方針

### 1. 透過＆クリック透過ウィンドウの実装 (Electron)
- **背景透過と枠なしウィンドウ**:
    ```typescript
    const mainWindow = new BrowserWindow({
        width: 512,
        height: 640,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    ```
- **マウススルー (Mouse Passthrough)**:
    マスコットの立ち絵が存在しない透明領域はクリックを透過させ、デスクトップ背面を操作できるようにします。
    - Vue側の `MascotViewer` でCanvasのピクセルアルファ値を判定、またはバウンディングボックス情報を計算。
    - IPC経由でメインプロセスにメッセージを送信し、`mainWindow.setIgnoreMouseEvents(ignore, { forward: true })` を呼び出して動的に透過を切り替えます。

### 2. ウィンドウ追従型チャットパネル
- **チャットパネルの表示位置制御**:
    - チャットパネルはマスコットの右隣にぴったり追従して表示します。
    - マスコットウィンドウの `move` イベントを購読し、マスコットが移動した際にチャットウィンドウの位置も動的に再計算して `setPosition` で同期させます。
    - ブラウザ単体での動作時は、フレックスボックスや絶対配置（`position: absolute`）による単一画面レイアウトとして構成し、違和感のないUIを提供します。

### 3. プレミアム・グラスモーフィズムデザイン
- **Aesthetic (ビジュアルの追求)**:
    - CSSの `backdrop-filter: blur(16px)`、適度な透明度の背景色（`rgba(18, 18, 18, 0.6)`）、極細のグラデーションボーダーを組み合わせることで、OSの背景が透けて見えるプレミアムで近未来的なUIを作成します。
    - Google Fonts から **Outfit** もしくは **Inter** をインポートし、モダンなタイポグラフィを実現します。

### 4. 設定画面UIライブラリの採用 (PrimeVue)
- **PrimeVueの採用**:
    - 設定画面（透過不要・通常ウィンドウ）のUIコンポーネント群として **PrimeVue** を採用します。
    - **Auraテーマ (ダークモード)** をベースに適用し、タブ切り替え、折りたたみ、詳細なパラメータ設定用の各種フォーム入力（スライダー、セレクトボックス、トグルスイッチ等）をスマートかつ統一感のあるデザインで構築します。
    - グローバルルールの「Vanilla CSS」の方針に沿って、PrimeVueの各パーツ（Styledモード）に対してCSS変数を用いたカラーオーバーライドや極微細なマージン調整を行い、アプリ全体のグラスモーフィズムデザインと世界観を統一します。

---

## 検証プラン

### 1. 自動テスト
- **Unit Test (Vitest)**:
    - 状態管理ロジック（チャット履歴の追加、マスコット切り替え）の動作検証。
    - 設定データのシリアライズ・デシリアライズのテスト。
- **E2E / Component Test (Playwright)**:
    - Vueコンポーネントが正しくレンダリングされるかの検証。

### 2. 手動検証
- **ウィンドウの透過動作確認**:
    - Windows環境上で、マスコットの背景が完全に透過し、デスクトップの壁紙が見えることを確認。
    - マスコット以外の透明部分をクリックした際に、背後のデスクトップアイコンやウィンドウがクリック可能であることを確認。
- **ドラッグ＆ドロップ動作確認**:
    - マスコットをドラッグした際に滑らかに移動し、移動後に設定が保存され、再起動時にその位置から復元されるか。
    - チャットウィンドウの開閉時にマスコットの右隣に追従して正しく表示されるか。
