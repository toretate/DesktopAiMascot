# LM Studio 疎通確認およびモデル一覧取得機能の実装計画

LM Studio を用いるローカルLLM設定において、設定されたエンドポイントに対して正常に疎通（接続）ができるかを検証する機能を追加します。
また、疎通成功時にロードされているモデルの一覧を自動取得し、ユーザーが手動で名前を入力しなくてもプルダウンリスト（ドロップダウン）から簡単にモデルを選択できるようにします。

## ユーザーレビュー要求事項

> [!NOTE]
> - 疎通成功時は、緑色のチェックマーク（`pi-check-circle`）と成功した旨を表示します。
> - 疎通失敗時は、赤色のバツマーク（`pi-times-circle`）とエラー理由（タイムアウトや接続拒否など）を表示します。
> - 再試行用の再実行ボタンと、モデル一覧の再読み込みボタンを統一・統合した「接続テスト & 再読み込み」ボタンを設置します。
> - モデル名指定エリアは、モデルが読み込めている場合は選択と自由入力の両方が行える PrimeVue の `Select` (editable) を表示し、読み込めていない場合は手動テキスト入力欄を表示するように自動フォールバック制御します。

## オープンクエスチョン

特になし。

---

## 提案される変更

### メインプロセス & IPC通信

#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/electron/main.ts) / [preload.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/electron/preload.ts) / [electron.d.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/src/electron.d.ts)
- （※既に前の工程で `get-lmstudio-models` ハンドラーの実装、preload 登録、型定義の追加を完了しております。）

---

### フロントエンド（Vue.js）

#### [MODIFY] [SettingsWindow.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/SettingsWindow.vue)
- 疎通状況およびモデル状態を保持するリアクティブ変数を定義します：
    - `isTestingConnection` (疎通テスト中フラグ)
    - `connectionState` (現在の接続状態: `'idle' | 'success' | 'failed'`)
    - `connectionErrorMsg` (エラー内容)
    - `lmstudioModels` (取得したモデル一覧の配列)
- エンドポイントへの接続と `/v1/models` の取得を行う `testLmStudioConnection` メソッドを実装します。
- 動的にステータスを出し分けるため、`connectionClass` / `connectionIcon` / `connectionText` 算出プロパティを実装します。
- 設定画面マウント時、すでに LM Studio がアクティブエンジンである場合は、裏で自動的に疎通・モデル読み込みを試みるように `onMounted` 内で統合します。
- **HTML テンプレートの調整**:
    - 「LM Studio エンドポイント」入力エリアに横並びで `pi-sync` アイコン付きの「再実行・再読み込み」ボタンを配置。
    - 入力欄の下に接続ステータスを示すメッセージボックス（チェックマーク、または赤X付き）を表示。
    - 「使用モデル名」設定において、モデル一覧が取得できている場合は PrimeVue の `Select`（`editable` 属性付きで、選択肢からの選択と手動自由入力を両立）をバインドし、取得できていない場合は既存の `InputText` 自由入力フォームへ自動的にフォールバックさせます。
- **CSS スタイルの追加**:
    - 成功時（やさしいグリーン調の背景＋ボーダー）、失敗時（やさしいレッド調）、待機時（ダーク調）のガラスモーフィズムに調和するスタイリングを追加。

---

## 検証計画

### 修正内容のビルド検証
- `cmd.exe /c npm run build` を実行し、ビルドや型エラーが発生しないことを確認。

### 手動確認
- `set START_SETTINGS=true && npm run dev` にて設定画面を単体起動。
- **接続失敗ケース**: エンドポイントに存在しない偽のアドレス（例: `http://localhost:9999/`）を入力し、同期ボタンをクリックした際、赤いバツマークとエラー内容が表示され、モデル入力欄が自由入力テキストボックスにフォールバックすることを確認。
- **接続成功ケース**: 稼働中の LM Studio がある場合は実エンドポイント、またはモック動作で緑のチェックマークとロード済みモデル数が表示され、モデル選択がプルダウンリストに変化することを確認。
- 「アプリ終了」ボタンで安全に終了できることを再確認。
