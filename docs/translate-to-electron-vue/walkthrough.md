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

## 作成されたファイルの一覧

以下のファイルが `docs/translate-to-electron-vue/` ディレクトリ配下に正しく作成されたことを確認しました。

- [implementation_plan.md](file:///c:/workspace/workspace-win/DesktopAiMascot/docs/translate-to-electron-vue/implementation_plan.md) (実装計画)
- [task.md](file:///c:/workspace/workspace-win/DesktopAiMascot/docs/translate-to-electron-vue/task.md) (タスクリスト)
- [walkthrough.md](file:///c:/workspace/workspace-win/DesktopAiMascot/docs/translate-to-electron-vue/walkthrough.md) (本ファイル)
- [conversion_guidelines.md](file:///c:/workspace/workspace-win/DesktopAiMascot/docs/translate-to-electron-vue/conversion_guidelines.md) (C# to TS 変換ガイドライン)

---

## 今後のステップ

タスクリストの「フェーズ4: AIサービス・音声サービスの移植」に沿って、以下の実装を進めます。

1. **AI対話API (Gemini API 等) の移植**:
    - `ChatPanel` でのメッセージ送信時に、モックではなく本物のGemini API（または設定されたLLM）へリクエストを送信して対話応答を取得するTypeScriptロジックを実装します。
    - グローバルルールに準拠した、通信ログの保存および接続エラーのシンプルな表示ハンドリングを構築します。
2. **音声生成 (VOICEVOX 等) の移植**:
    - AIのテキスト応答時に、VOICEVOXのローカルAPI等と通信して音声合成を生成・再生する連携ロジックを実装します。
3. **アセット（キャラクター画像）の差し替えと表情・アニメーション制御**:
    - Godot/C#時のマスコットキャラクターアセットを読み込み、会話の返答感情に連動して表情が変化するアニメーション基盤（WebGL/Canvas）を実装します。
