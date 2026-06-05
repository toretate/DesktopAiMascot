# 設定データ定義（ConfigData）の共通化結果

将来的な Web UI への対応を考慮し、Electron 固有ではない設定データの構造定義（`ConfigData`）およびデフォルト設定（`defaultData`）を `ui/electron/app-config.ts` から `ui/src/config/config-data.ts` に移行しました。

## 修正内容

### [config-data.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/config/config-data.ts) (新規)
- アプリケーション全体で共通して使用する `ConfigData` インターフェース、およびデフォルト設定値 `defaultData` を定義しました。
- `defaultData` のマスコットデータには、先に `ui/src/mascots/` に移動された `default-mascot.json` の定義を使用するように構成しました。

### [app-config.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/app-config.ts)
- ローカルに定義されていた `ConfigData` インターフェースおよび `defaultData` を削除しました。
- `ui/src/config/config-data.ts` から `ConfigData` および `defaultData` をインポートし、他モジュールが従来通り利用できるように再エクスポートする形に修正しました。

## 動作確認結果
- `ui` ディレクトリでの `npm run build` によるビルドが正常に完了することを確認しました。
