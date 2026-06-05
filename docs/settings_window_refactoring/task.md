# 設定画面ウィンドウ処理移行タスク

- [x] `ui/electron/settings-window.ts` への設定ウィンドウ作成・管理・IPCハンドラーの移植
- [x] `ui/electron/main.ts` での初期化処理呼び出しと、グローバル変数・インライン記述の削除
- [x] `main.ts` 内での `settingsWindow` 参照をゲッター関数 `getSettingsWindow()` に差し替え
- [x] UIプロジェクトのビルド検証 (`npm run build`)
