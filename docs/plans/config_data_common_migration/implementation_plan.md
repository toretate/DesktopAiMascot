# 設定データ定義（ConfigData）の共通化計画

将来的な Web UI への対応を考慮し、Electron 固有ではない設定データの構造定義（`ConfigData`）およびデフォルト設定（`defaultData`）を `ui/electron/app-config.ts` から `ui/src/config/config-data.ts` に移動して、Web/Electron の両方で共通利用できるようにします。

## ユーザーレビューが必要な項目
特になし。

## Proposed Changes

### UI Source

#### [NEW] [config-data.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/config/config-data.ts)
- `ConfigData` インターフェースを定義（`export`）。
- 設定のデフォルト値である `defaultData` を定義（`export`）。

### Electron UI

#### [MODIFY] [app-config.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/app-config.ts)
- `ConfigData` および `defaultData` を `ui/src/config/config-data.ts` からインポートして使用するように修正。
- ローカル定義の `ConfigData` インターフェースと `defaultData` を削除。

## Verification Plan

### 自動テスト
- `ui` ディレクトリでの TypeScript ビルドがエラーなく成功することを確認する。
  - コマンド: `npm run build`

### 手動確認
- アプリケーションが正常に起動し、既存の設定データが正しく読み込まれることを確認。
