# Web版（ブラウザ動作版）の実装計画

この計画では、既存のデスクトップ向けソースコードを共有しながら、ブラウザ上で直接動作する「Web版」を構築します。
Electron API（`window.electronAPI`）をブラウザの標準機能（`localStorage`、`fetch` API）でエミュレートするポリフィル層を導入し、コンポーネント側の変更を最小限に抑えます。

## ユーザー確認事項

> [!NOTE]
> Web版の追加にあたって、既存のElectronデスクトップ版の動作やソースコードへの影響は一切ありません。

> [!IMPORTANT]
> Webブラウザ環境の制限により、以下の機能はWeb版では動作しないか、制限された動作になります。
> 1. **デスクトップ透過/マウスイベント透過**：Webブラウザの制限上、ウィンドウ透過などは動作しません。
> 2. **アプリ再起動/終了・最前面表示**：Electron特有の制御はスキップされ動作しません。
> 3. **ローカル画像のファイルパス読み込み**：ブラウザのセキュリティ制限上、PC上のフルパス指定によるローカルファイル読み込みは使用できません（代わりにBase64アップロードなどを使用します）。
> 4. **ログイン（Google OAuth）**：Electronのログインフローではなく、モックまたはブラウザ用のフローが必要になります。

---

## 提案される変更点

### 1. Web版の動作環境の構築

#### [NEW] [vite.config.web.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/vite.config.web.ts)
Vite のWeb版ビルド用設定ファイル。Electronプラグイン（`vite-plugin-electron`等）を読み込まず、標準のWebアプリとしてビルドを行います。
出力先は `dist-web` とします。

#### [NEW] [index.html](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/web/index.html)
Web版用のエントリーHTML。Web用のエントリースプリクト `main.ts` を読み込みます。

#### [NEW] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/web/main.ts)
Web版用のVueエントリーポイント。Electron環境でない（`window.electronAPI`が存在しない）場合に必要なポリフィルを読み込んだ後、既存の `src/main.ts` をインポートしてアプリを起動します。

---

### 2. ブラウザポリフィルの実装

#### [NEW] [browser-polyfill.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/utils/browser-polyfill.ts)
`window.electronAPI` をブラウザ環境用に擬似実装（ポリフィル）するモジュール。
- **設定データ管理 (`getAppConfig` / `updateAppConfig`)**: `localStorage` を使用して読み書きします。
- **チャット履歴管理 (`getChatHistory` / `saveChatHistory`)**: `localStorage` にJSON文字列として保存します。
- **マスコットプロンプト (`getMascotPrompts` / `saveMascotPrompts`)**: `localStorage` を用いて個別保存します。
- **Gemini APIとの直接通信 (`askGemini` / `getGeminiModels`)**: ブラウザ上で直接 `fetch` API を使い、Google AI Studioにリクエストを送信します。
- **LM Studio APIとの直接通信 (`askLmStudio`)**: 指定されたローカルエンドポイントへ直接 `fetch` リクエストを送信します。
- **VOICEVOXとの直接通信 (`synthesizeVoicevox` / `getVoicevoxSpeakers`)**: ローカルで稼働しているVOICEVOX（`http://localhost:50021`）へ直接 `fetch` して音声データを生成します。

---

### 3. ルーティング設定の調整

#### [MODIFY] [App.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/App.vue)
- ハッシュなし（初期状態 `/`）または `#integrated` の場合に、Web版の基本レイアウトである「統合レイアウト（マスコット＆チャット画面）」を表示するようルーティングを変更します。

---

### 4. 設定ストアの永続化調整

#### [MODIFY] [config.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/store/config.ts)
- `localStorage` との同期処理にチャット履歴などのキーの読み込みが不足している場合、整合性を調整します。

---

### 5. ビルド＆開発スクリプトの追加

#### [MODIFY] [package.json](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/package.json)
Web版の開発サーバー起動およびビルドコマンドを追加します。
- `"dev:web": "vite web/index.html --config vite.config.web.ts"`
- `"build:web": "vue-tsc && vite build --config vite.config.web.ts"`

---

## 検証計画

### 自動テスト
- `npm run build:web` コマンドでWeb版パッケージが型エラーやモジュールエラーなしに正常にビルドできるか検証。

### 手動確認
1. `npm run dev:web` でWeb用開発サーバーを起動し、ブラウザ上で統合レイアウト（Mascot ＋ Chat）が表示されることを確認。
2. APIキーを設定し、Gemini等とのチャット会話がブラウザ上で直接動作することを確認。
3. 会話履歴や設定がリロードしても保持されるか（`localStorage`連携）を確認。
