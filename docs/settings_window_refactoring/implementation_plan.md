# 設定画面ウィンドウ処理移行実装計画

UI（Electron）側の設定画面（Settings Window）に関連するウィンドウ作成およびサイズ保存処理を `ui/electron/settings-window.ts` に移動し、メインプロセスコードの肥大化を防ぎ、関心の分離を進めます。

## ユーザー確認事項

> [!NOTE]
> この変更はリファクタリング（コードの移動と整理）であり、アプリ上の設定ウィンドウの表示、リサイズ、位置記憶といった挙動に影響はありません。

## 予定される変更点

### 1. 設定ウィンドウ制御コードの新規作成・移動
#### [NEW] [settings-window.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/settings-window.ts)
* 設定画面ウィンドウの生成 (`createSettingsWindow`)、表示とフォーカス制御 (`openSettingsWindow`)、位置・サイズ保存処理、および `open-settings` IPCハンドラーの実装をこのファイルに移動します。
* `config` への依存を解消するため、初期化関数 `initSettingsWindow(config, isDev)` を提供します。

### 2. メインプロセス (Electron) の修正
#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
* `main.ts` から設定画面ウィンドウ作成やサイズ・位置保存に関するインライン記述、グローバル変数を削除します。
* `initSettingsWindow` をインポートし、`createWindows()` で `config` が生成された直後に呼び出して初期化します。
* 開発用の `START_SETTINGS` モード処理を、エクスポートされた `createSettingsWindow()` を使用してシンプルにリファクタリングします。
* mascotのスケール調整時やアプリ設定変更時の `settingsWindow` への設定更新ブロードキャスト処理を、ゲッター関数 `getSettingsWindow()` を用いる形に差し替えます。

## 検証計画

### コンパイルチェック
* UIプロジェクトが正常にビルドできることを検証します。
  ```bash
  cd ui
  npm run build
  ```
