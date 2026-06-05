# マスコット画面ウィンドウ処理移行実装計画

UI（Electron）側のマスコット画面（Mascot Window）に関連するウィンドウ作成および位置・サイズ保存処理を `ui/electron/mascot-window.ts` に移動し、メインプロセスコードの肥大化を防ぎ、関心の分離を進めます。

## ユーザー確認事項

> [!NOTE]
> この変更はリファクタリング（コードの移動と整理）であり、アプリ上のマスコットウィンドウの表示、ドラッグ、追従といった挙動に影響はありません。

## 予定される変更点

### 1. マスコットウィンドウ制御コードの新規作成・移動
#### [NEW] [mascot-window.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/mascot-window.ts)
* マスコット画面ウィンドウの生成 (`createMascotWindow`)、ゲッターの提供、ドラッグ時の位置保存デバウンス処理の実装をこのファイルに移動します。
* `config` への依存を解消するため、初期化関数 `initMascotWindow(config, isDev)` を提供します。

### 2. メインプロセス (Electron) の修正
#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
* `main.ts` からマスコット画面ウィンドウ作成や位置保存に関するインライン記述、グローバル変数を削除します。
* `initMascotWindow` をインポートし、`createWindows()` で `config` が生成された直後に呼び出して初期化します。
* `createWindows()` でのインライン生成ロジックを、エクスポートされた `createMascotWindow` を使用する形に置き換えます。
* `toggle-chat` や `set-mascot-scale`、`emotion-changed`、`preview-mascot-state`、タイマー通知などのマスコットウィンドウ参照部分を、ゲッター関数 `getMascotWindow()` を用いる形に差し替えます。

## 検証計画

### コンパイルチェック
* UIプロジェクトが正常にビルドできることを検証します。
  ```bash
  cd ui
  npm run build
  ```
