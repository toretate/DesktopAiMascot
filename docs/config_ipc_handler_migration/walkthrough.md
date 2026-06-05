# Config IPC ハンドラーの移行結果 (マスコットプロンプト設定I/Oの追加)

`ui/electron/main.ts` に直接定義されていた設定の取得・更新用の IPC ハンドラーに加え、マスコットのプロンプト設定 I/O 関連のハンドラー (`get-mascot-prompts`, `save-mascot-prompts`) を [config-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/config-handler.ts) に移行しました。

## 修正内容

### [config-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/config-handler.ts)
- ファイル入出力に必要な `fs`, `path` モジュールをインポートしました。
- `get-mascot-prompts` (読み込み) および `save-mascot-prompts` (書き込み・初期テンプレート自動生成) のハンドラーを `registerConfigHandlers` 内に定義し、移行しました。

### [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
- `main.ts` から `get-mascot-prompts` および `save-mascot-prompts` ハンドラー定義を削除しました。

## 動作確認結果
- `ui` ディレクトリでの `npm run build` によるビルドが正常に完了することを確認しました。
