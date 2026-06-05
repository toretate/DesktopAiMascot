# AppConfig の移行計画

`ui/electron/main.ts` に直接定義されている設定管理クラス `AppConfig` および関連するデータ型インターフェース (`MascotAsset`, `MascotData`, `ConfigData`) を、新規作成する `ui/electron/app-config.ts` に移動してモジュール化します。これにより `main.ts` のコード肥大化を防ぎ、見通しを良くします。

## ユーザーレビューが必要な項目
特になし。

## Proposed Changes

### Electron UI

#### [NEW] [app-config.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/app-config.ts)
- `MascotAsset`, `MascotData`, `ConfigData` インターフェースを定義（すべて `export` する）。
- `AppConfig` クラスを定義（`export` する）。

#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
- インターフェース定義および `AppConfig` クラス定義を削除。
- `app-config.ts` から `AppConfig`, `ConfigData` などをインポートして使用するよう修正。

## Verification Plan

### 自動テスト
- `ui` ディレクトリでの TypeScript ビルドがエラーなく成功することを確認する。
  - コマンド: `npm run build`
