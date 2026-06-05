# タスクリスト: 設定データ定義（ConfigData）の共通化

- [x] `ui/src/config/config-data.ts` を作成し、`ConfigData` と `defaultData` を定義する
- [x] `ui/electron/app-config.ts` で `config-data.ts` から `ConfigData` と `defaultData` をインポートするように修正する
- [x] `ui/electron/app-config.ts` からローカルの `ConfigData` インターフェース定義と `defaultData` を削除する
- [x] ビルド検証を行う
