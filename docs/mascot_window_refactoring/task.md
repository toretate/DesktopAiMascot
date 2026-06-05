# マスコット画面ウィンドウ処理移行タスク

- [x] `ui/electron/mascot-window.ts` へのマスコットウィンドウ作成・位置保存・イベント設定の移植
- [x] `ui/electron/main.ts` での初期化処理呼び出しと、グローバル変数・インライン記述の削除
- [x] `main.ts` 内での `mascotWindow` 参照をゲッター関数 `getMascotWindow()` に差し替え
- [x] UIプロジェクトのビルド検証 (`npm run build`)
