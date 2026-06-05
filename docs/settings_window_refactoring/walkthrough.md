# 設定画面ウィンドウ処理移行 修正内容の確認

`ui/electron/main.ts` に記述されていた設定画面（Settings Window）の生成、位置記憶、サイズ調整、および表示処理を `settings-window.ts` へ移動・整理しました。

## 変更内容

### 1. 設定ウィンドウ関連コードの分離
* [settings-window.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/settings-window.ts) を新規作成し、以下の機能を移植しました：
  * 設定ウィンドウの作成 (`createSettingsWindow`) とゲッター提供
  * 表示とフォーカス制御 (`openSettingsWindow`)
  * デバウンスされた位置・サイズ保存処理 (`debouncedSaveSettingsBounds`)
  * 設定画面を開くための `open-settings` IPCハンドラーの自動登録
  * 依存情報の注入を行う `initSettingsWindow`

### 2. メインプロセス (Electron) のリファクタリング
* [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts) から設定画面ウィンドウ作成やサイズ・位置保存に関するインラインコード、グローバル変数を削除しました。
* `createWindows()` での `config` インスタンス生成直後に `initSettingsWindow(config, isDev)` を呼び出して初期化するように設定しました。
* 開発用の `START_SETTINGS` モード処理を、エクスポートされた `createSettingsWindow()` を用いるように簡略化しました。
* `set-mascot-scale` と `update-app-config` 内の `settingsWindow` への参照を、`getSettingsWindow()` から取得したウィンドウ参照を用いる形に変更しました。

## 検証結果

* `ui` フォルダで `npm run build` を実行し、正常にコンパイルおよびビルドが通ることを確認しました。
  ```bash
  npm run build
  ```
  出力：
  ```
  vite v5.4.21 building for production...
  ✓ built in 1.98s
  ...
  dist-electron/main.js  528.69 kB
  ✓ built in 859ms
  ```
  正常にビルドが成功しています。
