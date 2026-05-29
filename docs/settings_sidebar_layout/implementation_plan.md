# 設定画面サイドバーのレイアウト刷新およびアプリ終了ボタンの実装計画

設定画面のユーザーインターフェースを向上させ、使いやすさを改善するために、左サイドバーのメニュー項目を上から「マスコット」「チャットAI」「音声AI」「画像AI」「動画AI」「APIキー」の順に並べ替え、さらに最下部にアプリケーションを安全に終了させるための「アプリ終了」ボタンを設置します。

## ユーザーレビュー要求事項

> [!NOTE]
> すでにコードの書き換え自体はローカルで実施されており、今回はリクエスト内容が完全に反映されているかどうかの検証、およびドキュメントの承認手続きを行います。

## オープンクエスチョン

現在、特に保留中の質問事項はありません。実装されたコードの動作確認およびコミットの準備へ移行します。

---

## 提案される変更

### メインプロセス & IPC通信定義

#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/electron/main.ts)
- `quit-app` という新しいIPCチャネルを追加し、メインプロセス側で `app.quit()` を安全に実行してアプリケーション全体をシャットダウンするようにします。

#### [MODIFY] [preload.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/electron/preload.ts)
- レンダープロセス側の Vue コンポーネントから安全に呼び出せるよう、`contextBridge` 経由で `quitApp` メソッドを公開します。

#### [MODIFY] [electron.d.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/src/electron.d.ts)
- TypeScriptで型安全に開発できるよう、`window.electronAPI.quitApp()` の型定義を追加します。

---

### フロントエンド（Vue.js）

#### [MODIFY] [SettingsWindow.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/SettingsWindow.vue)
- 左サイドバーのメニュー項目を上から以下の順序で並び替えます：
    1. マスコット
    2. チャットAI
    3. 音声AI
    4. 画像AI
    5. 動画AI
    6. APIキー
- サイドバーの最下部に `sidebar-footer` エリアを追加し、`pi-power-off` アイコンを伴った「アプリ終了」ボタンを配置します。
- ボタンクリック時に `window.electronAPI.quitApp()` を呼び出します。
- グラスモーフィズムおよびダークテーマ（Auraベース）に完璧に調和した美しくプレミアムなホバーアニメーションCSSを追加します。

---

## 検証計画

### 自動テスト / ビルド確認
- `npm run build` または `vue-tsc` を実行し、TypeScriptの型エラーやコンパイルエラーが発生しないことを確認します。

### 手動検証
- VS Codeのデバッグ構成から `START_SETTINGS=true`（環境変数付きの設定画面直接起動構成）で起動し、設定画面を開きます。
- 左サイドバーの項目が指定された順序通りに美しく並んでいることを確認します。
- メニュー項目の切り替え、および hover アニメーションが滑らかに動作することを確認します。
- 最下部の「アプリ終了」ボタンをクリックしたときに、Electron アプリケーションが即座に安全に終了することを確認します。
