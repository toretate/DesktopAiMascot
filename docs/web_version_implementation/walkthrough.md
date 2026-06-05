# Web版（ブラウザ動作版）実装完了報告（Walkthrough）

統合ウィンドウ版をベースとした Web 版の構築および検証がすべて完了いたしました。

## 実装された変更内容

### 1. Web専用エントリー環境の追加
- **[vite.config.web.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/vite.config.web.ts)**: Electronに依存しないピュアなViteビルド設定。ビルド出力先を `dist-web` に設定しています。
- **[ui/web/index.html](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/web/index.html)**: Web版専用のインデックスHTML。Web用エントリースクリプト `web/main.ts` を読み込みます。
- **[ui/web/main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/web/main.ts)**: Web版用のVue起動ファイル。ブラウザ動作ポリフィル（`browser-polyfill.ts`）を読み込んだ上で既存の `src/main.ts` を実行します。

### 2. Electron IPCポリフィルモジュールの作成
- **[browser-polyfill.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/utils/browser-polyfill.ts)**:
  `window.electronAPI` が存在しない（ブラウザ）環境下で、全てのElectron呼び出しを肩代わりします。
  - **設定 & プロンプトの保存**: `localStorage` を使用し、リロードしてもデータが維持されます。
  - **履歴の保存**: 会話履歴を `localStorage` にシリアライズして保存・復元します。
  - **Gemini APIとの直接通信**: `fetch` API を使い、ブラウザから Google AI Studio へ直接リクエストを行います（モデル一覧取得・会話等）。
  - **LM Studio / VOICEVOX との直接通信**: ローカルのエンドポイントへ直接 `fetch` リクエストを実行し、応答テキスト取得およびVOICEVOX音声合成（Base64オーディオ再生）を行います。
  - **ローカル画像選択の代替**: ブラウザの `<input type="file">` ダイアログを開き、選択された画像を Base64（DataURL）として読み取って返却します。
  - **タイマー通知**: ブラウザの `setTimeout` を使用して時間経過後にマスコットからお知らせを行います。

### 3. ルーティングの自動識別化
- **[App.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/App.vue)**: ハッシュなしで初期起動された場合に、Web版のデフォルトレイアウトとして「統合レイアウト（マスコット ＋ チャット）」を表示するように調整しました。

---

## 起動・利用方法

### 開発環境での起動方法
以下のコマンドを実行すると、ブラウザ用のVite開発サーバーが立ち上がります。
```bash
# ui ディレクトリ内にて実行
npm run dev:web
```
出力されるローカルURL（通常 `http://localhost:5173/` など）にブラウザでアクセスしてください。

### 本番ビルド方法
以下のコマンドを実行すると、静的ホスティング（Vercel, GitHub Pages等）が可能な形式でWeb版がビルドされます。
```bash
# ui ディレクトリ内にて実行
npm run build:web
```
ビルド結果は `ui/dist-web` に出力されます。
