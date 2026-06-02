# 移行プラン作成の確認（Walkthrough）

本ドキュメントは、C# + Godot Editorベースの開発から Electron + Vite + Vue3 + TypeScript への切り替えに向けたプラン作成（ドキュメント作成）の検証および完了レポートです。

---

## 実施した内容

1. **既存仕様およびコードベースの調査**
    - `docs/specs/Application.spec.md` を調査し、アプリの技術要件（透過ウィンドウ、グラスモーフィズムチャットUI、WebGLアニメーション、各種AI/音声API連携など）を確認。
    - `Main.cs` からGodotでのウィンドウ透過処理、マウススルー領域（Ignore Mouse Events）の設定、ウィンドウドラッグ追従移動などの基本仕様の再現方法を検討。

2. **実装計画の作成とアップデート (`implementation_plan.md`)**
    - Electron + Vite + Vue3 + TypeScript を用いた具体的なアーキテクチャ設計。
    - 透過ウィンドウおよび動的マウススルー領域の設定方法を提示。
    - CSSを用いたグラスモーフィズムデザインシステムとタイポグラフィ（Outfit / Inter）の導入計画。
    - ユーザーレビューに基づく決定事項の反映：
        - **設定画面用UIライブラリ**: プレミアムなフォーム制御と優れたダークモードの統合が可能な **PrimeVue (Auraテーマ)** の採用を決定。
        - **ComfyUIによる画像生成**: 初期フェーズではローカルPC環境で生成できる仕組みを実装し、将来的にモバイル等からのリモート生成へ拡張可能なAPI設計とする。
        - **C#コード資産の引き継ぎ**: カナ変換辞書データは破棄し、プロンプトテンプレートや各種主要ロジックをTypeScriptへ移植して再利用する。

3. **タスクリストの作成とアップデート (`task.md`)**
    - 移行作業を5つのフェーズ（初期化、メインプロセス構築、レンダープロセスUI構築、AI/音声サービス移植、検証）に分解し、PrimeVueの導入やUI構築の各フェーズ詳細を含めた詳細なチェックリストを作成。

---

4. **フェーズ1（プロジェクトの初期化とビルド環境の構築）の実行**
    - `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` の新規作成および依存ライブラリ (`electron`, `vite`, `vue`, `primevue` 等) のインストール。
    - 最前面・透過設定を含む Electron メインプロセス (`electron/main.ts`) およびプリロードスクリプト (`electron/preload.ts`) の基本実装。
    - Vue3 エントリーポイント (`src/main.ts`)、ベースCSS (`src/styles/main.css`)、動作検証用のモックアップ (`src/App.vue`) の実装。
    - 開発サーバーの立ち上げ (`npm run dev`) と、Vite のバンドル処理および Electron 透過ウィンドウの起動確認に成功。
    - フォーマットルール設定ファイル (`.prettierrc`) の追加、および C# から TS への移行基準を定めた `conversion_guidelines.md` の作成。

---

---

5. **フェーズ2（ElectronメインプロセスとIPC通信）およびフェーズ3（Vue3レンダープロセス）の構築**
    - **複数ウィンドウの同期制御**: `mascotWindow` (透過ロボット), `chatWindow` (透過チャットパネル), `settingsWindow` (PrimeVue設定) の3つのウィンドウマネジメントを `electron/main.ts` に実装。マスコットウィンドウの移動（`move` イベント）にチャットウィンドウがぴったり追従して移動する処理を実現。
    - **データの永続化**: マスコット位置情報を `app.getPath('userData')/config.json` にJSON保存する軽量設定管理クラス `AppConfig` を作成。ウィンドウの移動終了後に自動的に位置をデバウンス保存し、アプリ再起動時に前回の表示位置から復元する処理を実装。
    - **安全なIPC通信**: レンダラーとメインプロセスを繋ぐプリロードスクリプト (`electron/preload.ts`) および型定義ファイル ([electron.d.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/src/electron.d.ts)) を構築。表示トグル、設定表示、マウススルーのやり取りを仲介。
    - **ハッシュによる単一SPA簡易ルーティング**: URLのハッシュパラメータ (`#mascot`, `#chat`, `#settings`) を `App.vue` 内で動的監視し、1つのVueアプリ内で3つの異なるウィンドウ画面を適切にレンダリングするスマートルーティング構造を構築。
    - **リッチなVue 3 + PrimeVueコンポーネントの実装**:
        - [MascotViewer.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/MascotViewer.vue) (透過マスコット表示、チャット/設定トグルボタン)
        - [ChatPanel.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/ChatPanel.vue) (グラスモーフィズム対応チャットUI、対話機能のモック実装)
        - [SettingsWindow.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/SettingsWindow.vue) (PrimeVueのTabs, Card, Select, Slider, Passwordを利用したダークモード対応設定UI)

---

6. **フェーズ4（AIサービス・音声サービスの移植）の構築**
    - **本物のAI対話 (Gemini API) の接続**: メインプロセスに `ask-gemini` IPCハンドラーを追加し、Node.js標準 of `fetch` と `AbortController` (60秒タイムアウト) を用いた Gemini API (v1beta/generateContent) 接続ロジックを実装。
    - **本物の音声合成 (VOICEVOX) の接続**: `synthesize-voicevox` IPCハンドラーを実装し、ローカルで立ち上がっているVOICEVOX (localhost:50021) に対して `audio_query` および `synthesis` リクエストを順にPOST送信。取得した音声バイナリ（WAV）をBase64文字列にエンコードしてレンダラープロセスに転送。
    - **厳格な接続例外ハンドリングと通信ログ設計**: グローバルルールに完全に準拠し、タイムアウト時は `Google AI Studioとの接続エラー (タイムアウト)` を、接続エラー時は `Google AI Studioとの接続エラー` を `console.warn` に出力し、余計なスタックトレースを一切非表示にしました（VOICEVOX側も同様）。
    - **リアルタイム音声再生と感情連動アバターアニメーション**:
        - `ChatPanel.vue` の送信処理を実接続に変更。localStorageからAPIキーやモデル設定をロードし、Gemini対話およびVOICEVOX音声取得を実行。Web標準の `Audio` を用いてBase64音声を即座に再生。
        - 応答の末尾に含まれる感情タグ（`[happy]`, `[sad]` 等）をパースし、IPC経由でメインプロセスを中継して `MascotViewer.vue` に感情をリアルタイムで同期転送。
        - マスコットウィンドウは感情を受け取り、表情絵文字（`🤖` -> `😊` / `😢` / `😠` / `😲`）へ動的変化させると同時に、ぷるんと揺れるポップアップのCSSマイクロアニメーション (`emotion-pop`) を実行。

---

7. **設定画面の垂直ナビゲーション化およびアプリ終了処理の実装**
    - **プレミアムな垂直サイドバーの構築**: `SettingsWindow.vue` にて、従来の水平タブを完全に排除し、左側に幅 240px の洗練された垂直サイドバーメニュー（マスコット、チャットAI、音声AI、画像AI、動画AI、APIキー）を構築。各パネルは `v-if` にて右側にスマートにロードされる設計に変更。
    - **「画像AI」「動画AI」設定の新規追加**: それぞれの生成AIエンジンを切り替えるセレクトボックスと、`localStorage` への設定値の永続化処理を追記。
    - **ネイティブアプリ終了処理 (Quit App)**: メインプロセスに `quit-app` IPCイベントリスナーを追加。サイドバー最下部に設置したプレミアムな赤い「アプリ終了」ボタン（`pi-power-off` アイコン）をクリックした際に、Electron側で安全に `app.quit()` を実行しアプリ全体を完全に終了させるライフサイクル機能を実装。

---

## 作成されたファイルの一覧

以下のファイルが `docs/translate-to-electron-vue/` ディレクトリ配下に正しく作成されたことを確認しました。

- [implementation_plan.md](file:///c:/workspace/workspace-win/DesktopAiMascot/docs/translate-to-electron-vue/implementation_plan.md) (実装計画)
- [task.md](file:///c:/workspace/workspace-win/DesktopAiMascot/docs/translate-to-electron-vue/task.md) (タスクリスト)
- [walkthrough.md](file:///c:/workspace/workspace-win/DesktopAiMascot/docs/translate-to-electron-vue/walkthrough.md) (本ファイル)
- [conversion_guidelines.md](file:///c:/workspace/workspace-win/DesktopAiMascot/docs/translate-to-electron-vue/conversion_guidelines.md) (C# to TS 変換ガイドライン)

---

## 今後のステップ

タスクリストの「フェーズ5: テストおよび検証」に沿って、以下の実装とテストを進めます。

1. **実環境における統合手動テスト**:
    - VS Code上で F5 起動を行い、設定画面からAPIキーを設定し、Gemini対話とVOICEVOX音声再生、およびドラッグ位置の永続化、ウィンドウ追従同期が正しく噛み合って動くかを手動検証します。
2. **ユニットテストの構築 (Vitest)**:
    - 今後追加する状態管理ロジックや位置計算、パース処理などの堅牢性を保つため、Vitestを用いた自動テストコードの追加を検討します。
