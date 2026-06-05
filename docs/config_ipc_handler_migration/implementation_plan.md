# Config IPC ハンドラーの移行計画 (マスコットプロンプト設定I/Oの追加)

`ui/electron/main.ts` に直接定義されている設定の取得と更新用の IPC ハンドラー (`get-app-config`, `update-app-config`) に加え、マスコットのプロンプト設定 I/O 関連のハンドラー (`get-mascot-prompts`, `save-mascot-prompts`) を `ui/electron/ipc-handlers/config-handler.ts` に移動してモジュール化します。

## ユーザーレビューが必要な項目
特になし。

## Proposed Changes

### Electron UI

#### [MODIFY] [config-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/config-handler.ts)
- `fs` と `path` をインポート。
- `get-mascot-prompts` および `save-mascot-prompts` の IPC ハンドラーを `registerConfigHandlers` 内に移動。

#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
- `main.ts` から `get-mascot-prompts`, `save-mascot-prompts` の IPC ハンドラー定義を削除。

## Verification Plan

### 自動テスト
- `ui` ディレクトリでの TypeScript ビルドがエラーなく成功することを確認する。
  - コマンド: `npm run build`

### 手動確認
- 設定変更が正常に保存されることに加え、マスコットのプロンプト（soul, identity等）が正常に読み書きできることを確認。
