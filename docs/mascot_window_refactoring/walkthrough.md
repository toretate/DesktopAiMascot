# マスコット画面ウィンドウ処理移行 修正内容の確認

`ui/electron/main.ts` に記述されていたマスコット画面（Mascot Window）の生成、位置記憶、ドラッグ追従、および位置保存処理を `mascot-window.ts` へ移動・整理しました。

## 変更内容

### 1. マスコットウィンドウ関連コードの分離
* [mascot-window.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/mascot-window.ts) を新規作成し、以下の機能を移植しました：
  * マスコットウィンドウの作成 (`createMascotWindow`) とゲッター提供
  * 位置保存処理 (`debouncedSaveMascotPosition`)
  * ウィンドウ移動イベント検知時のイベントフック処理
  * 依存情報の注入を行う `initMascotWindow`

### 2. メインプロセス (Electron) のリファクタリング
* [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts) からマスコットウィンドウ作成や位置保存に関するインラインコード、グローバル変数を削除しました。
* `createWindows()` 内でマスコットウィンドウを `createMascotWindow` を呼び出して作成し、チャットウィンドウの初期追従オフセットを設定するロジックに差し替えました。
* 各IPCハンドラーおよびグローバル関数内で `mascotWindow` 変数を直接参照していた箇所を、`getMascotWindow()` から取得したウィンドウ参照を用いる形に書き換えました。

## 検証結果

* `ui` フォルダで `npm run build` を実行し、正常にコンパイルおよびビルドが通ることを確認しました。
  ```bash
  npm run build
  ```
  出力：
  ```
  vite v5.4.21 building for production...
  ✓ built in 2.00s
  ...
  dist-electron/main.js  529.10 kB
  ✓ built in 891ms
  ```
  正常にビルドが成功しています。
