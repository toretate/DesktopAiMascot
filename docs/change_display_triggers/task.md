# タスクリスト: チャットウィンドウと設定ダイアログの表示トリガー変更

- [x] 1. メインプロセスの改修 (`electron/main.ts`)
  - [x] `drag-window` IPCハンドラーの実装 (相対移動 dx, dy によるウィンドウ移動)
- [x] 2. プリロードスクリプトの改修 (`electron/preload.ts`)
  - [x] `dragWindow` APIを露出
- [x] 3. レンダープロセスの改修 (`src/components/MascotViewer.vue`)
  - [x] `.mascot-character` から `drag-area` クラスを除去
  - [x] `onMouseDown` / `onMouseMove` / `onMouseUp` イベントを利用したJSウィンドウドラッグ処理の実装
  - [x] 移動閾値以下の場合のみ「左クリック」と判定して `toggleChat` を実行
- [x] 4. 動作確認・検証
  - [x] ビルドエラーがないことを確認
  - [x] 手動検証 (左クリックでチャットトグル、右クリックで設定、ドラッグでスムーズなウィンドウ移動かつクリック不発)
- [x] 5. ドキュメント作成 & Git コミット・PR作成
  - [x] `walkthrough.md` の作成
  - [x] Git へのコミット & PR作成 (または作成用URL提示)
