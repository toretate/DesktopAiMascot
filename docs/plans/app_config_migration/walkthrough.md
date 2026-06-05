# AppConfig 関連コードの移行結果

`ui/electron/main.ts` から設定管理クラス `AppConfig` および関連するデータ型インターフェース (`MascotAsset`, `MascotData`, `ConfigData`) を、新規作成した [app-config.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/app-config.ts) に移行しました。

## 修正内容

### [app-config.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/app-config.ts) (新規)
- `AppConfig` クラスおよびデータ型インターフェースを定義し、外部モジュールから利用できるように export しました。

### [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
- `AppConfig` 関連の定義をすべて削除しました。
- `app-config.ts` から `AppConfig` と `ConfigData` をインポートするように修正しました。

## 動作確認結果
- `ui` ディレクトリでの `npm run build` による TypeScript ビルドが正常に完了することを確認しました。
